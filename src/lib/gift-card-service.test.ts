import type { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  creditGiftCard,
  reserveGiftCardPayment,
} from "@/lib/gift-card-service";

function createFakeTransaction() {
  const giftCardTransaction = {
    findUnique: vi.fn().mockResolvedValue(null),
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    create: vi.fn().mockResolvedValue({ id: "txn-1" }),
  };
  const giftCardAccount = {
    upsert: vi.fn().mockResolvedValue({
      id: "card-1",
      userId: "user-1",
      balance: 2_000,
    }),
    update: vi.fn().mockResolvedValue({ id: "card-1", balance: 12_000 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };

  return {
    giftCardTransaction,
    giftCardAccount,
    tx: { giftCardTransaction, giftCardAccount } as unknown as Prisma.TransactionClient,
  };
}

describe("creditGiftCard", () => {
  it("credits the account and records the recharge atomically", async () => {
    const { tx, giftCardAccount, giftCardTransaction } = createFakeTransaction();

    const result = await creditGiftCard(tx, {
      userId: "user-1",
      amount: 10_000,
      reference: "RECHARGE:token-1",
    });

    expect(giftCardAccount.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { balance: { increment: 10_000 } },
    });
    expect(giftCardTransaction.createMany).toHaveBeenCalledWith({
      data: [{
        accountId: "card-1",
        type: "RECHARGE",
        amount: 10_000,
        reference: "RECHARGE:token-1",
      }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ balance: 12_000, duplicate: false });
  });

  it("returns the current balance without crediting a duplicate recharge", async () => {
    const { tx, giftCardAccount, giftCardTransaction } = createFakeTransaction();
    giftCardTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-existing",
      type: "RECHARGE",
      account: { userId: "user-1", balance: 12_000 },
    });

    const result = await creditGiftCard(tx, {
      userId: "user-1",
      amount: 10_000,
      reference: "RECHARGE:token-1",
    });

    expect(giftCardAccount.update).not.toHaveBeenCalled();
    expect(result).toEqual({ balance: 12_000, duplicate: true });
  });

  it("returns the winning recharge when a concurrent insert claims the reference", async () => {
    const { tx, giftCardAccount, giftCardTransaction } = createFakeTransaction();
    giftCardTransaction.createMany.mockResolvedValueOnce({ count: 0 });
    giftCardTransaction.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "txn-existing",
        type: "RECHARGE",
        account: { userId: "user-1", balance: 12_000 },
      });

    const result = await creditGiftCard(tx, {
      userId: "user-1",
      amount: 10_000,
      reference: "RECHARGE:token-1",
    });

    expect(giftCardAccount.update).not.toHaveBeenCalled();
    expect(result).toEqual({ balance: 12_000, duplicate: true });
  });

  it("rejects a recharge reference owned by another user", async () => {
    const { tx, giftCardAccount, giftCardTransaction } = createFakeTransaction();
    giftCardTransaction.findUnique.mockResolvedValueOnce({
      id: "txn-existing",
      type: "RECHARGE",
      account: { userId: "user-2", balance: 12_000 },
    });

    await expect(creditGiftCard(tx, {
      userId: "user-1",
      amount: 10_000,
      reference: "RECHARGE:token-1",
    })).rejects.toThrow("充值令牌不可用");
    expect(giftCardAccount.update).not.toHaveBeenCalled();
  });
});

describe("reserveGiftCardPayment", () => {
  it("returns the external-only split without touching an account when opted out", async () => {
    const { tx, giftCardAccount } = createFakeTransaction();

    const result = await reserveGiftCardPayment(tx, {
      userId: "user-1",
      totalAmount: 12_800,
      useGiftCard: false,
    });

    expect(result).toEqual({
      giftCardAmount: 0,
      externalAmount: 12_800,
      accountId: null,
    });
    expect(giftCardAccount.upsert).not.toHaveBeenCalled();
  });

  it("reserves the available balance for a mixed payment", async () => {
    const { tx, giftCardAccount } = createFakeTransaction();
    giftCardAccount.upsert.mockResolvedValueOnce({
      id: "card-1",
      userId: "user-1",
      balance: 10_000,
    });
    giftCardAccount.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await reserveGiftCardPayment(tx, {
      userId: "user-1",
      totalAmount: 12_800,
      useGiftCard: true,
    });

    expect(result).toEqual({
      giftCardAmount: 10_000,
      externalAmount: 2_800,
      accountId: "card-1",
    });
    expect(giftCardAccount.updateMany).toHaveBeenCalledWith({
      where: { id: "card-1", balance: { gte: 10_000 } },
      data: { balance: { decrement: 10_000 } },
    });
  });

  it("rejects when the balance changes before it can be reserved", async () => {
    const { tx, giftCardAccount } = createFakeTransaction();
    giftCardAccount.upsert.mockResolvedValueOnce({
      id: "card-1",
      userId: "user-1",
      balance: 10_000,
    });
    giftCardAccount.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(reserveGiftCardPayment(tx, {
      userId: "user-1",
      totalAmount: 12_800,
      useGiftCard: true,
    })).rejects.toThrow("购物卡余额已变化，请重试支付");
  });
});
