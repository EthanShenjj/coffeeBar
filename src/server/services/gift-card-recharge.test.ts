import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ $transaction: mocks.transaction }) }));

import { rechargeGiftCardForUser } from "@/server/services/gift-card-recharge";

describe("rechargeGiftCardForUser", () => {
  it.each([
    [{ balance: 20_000, duplicate: false }, { ok: true, balance: 20_000, idempotent: false }],
    [{ balance: 20_000, duplicate: true }, { ok: true, balance: 20_000, idempotent: true }],
  ])("preserves the idempotency result in the wire-safe service response", async (serviceResult, expected) => {
    mocks.transaction.mockResolvedValueOnce(serviceResult);
    await expect(rechargeGiftCardForUser("user-1", {
      token: "00000000-0000-4000-8000-000000000001",
      amount: 10_000,
    })).resolves.toEqual(expected);
  });

  it("does not leak unexpected database errors", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("password=database-secret"));
    const result = await rechargeGiftCardForUser("user-1", {
      token: "00000000-0000-4000-8000-000000000001",
      amount: 10000,
    });
    expect(result).toEqual({ ok: false, message: "充值失败，请稍后重试" });
    expect(JSON.stringify(result)).not.toContain("database-secret");
  });
});
