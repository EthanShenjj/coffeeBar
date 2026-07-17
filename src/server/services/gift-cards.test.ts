import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ giftCardAccount: { findUnique: mocks.findUnique } }) }));

import { getGiftCardSummaryForUser } from "@/server/services/gift-cards";

describe("getGiftCardSummaryForUser", () => {
  it("returns the explicit shared wire DTO without Prisma nesting", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      balance: 10000,
      transactions: [{
        id: "transaction-1", type: "RECHARGE", amount: 10000, reference: "RECHARGE:token",
        createdAt: new Date("2026-07-17T00:00:00.000Z"), order: { orderNumber: "CB1" },
        accountId: "secret-account",
      }],
    });

    await expect(getGiftCardSummaryForUser("user-1")).resolves.toEqual({
      balance: 10000,
      persistent: true,
      transactions: [{
        id: "transaction-1", type: "RECHARGE", amount: 10000, reference: "RECHARGE:token",
        createdAt: "2026-07-17T00:00:00.000Z", orderNumber: "CB1",
      }],
    });
  });
});
