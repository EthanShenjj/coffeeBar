import type { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi } from "vitest";
import { creditGiftCard } from "@/lib/gift-card-service";

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
