import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getGiftCardSummaryForUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }) }));
vi.mock("@/lib/db", () => ({ hasDatabase: vi.fn(() => true) }));
vi.mock("@/server/services/gift-cards", () => ({ getGiftCardSummaryForUser: mocks.getGiftCardSummaryForUser }));

import { getGiftCardSummary } from "@/lib/gift-card-data";

describe("getGiftCardSummary Web projection", () => {
  it("keeps the legacy transaction shape without exposing service reference metadata", async () => {
    const createdAt = new Date("2026-07-17T00:00:00.000Z");
    mocks.getGiftCardSummaryForUser.mockResolvedValueOnce({
      balance: 10000,
      persistent: true,
      transactions: [{
        id: "transaction-1",
        type: "RECHARGE",
        amount: 10000,
        reference: "RECHARGE:private-token",
        createdAt: createdAt.toISOString(),
        orderNumber: null,
      }],
    });

    await expect(getGiftCardSummary()).resolves.toEqual({
      balance: 10000,
      persistent: true,
      transactions: [{
        id: "transaction-1",
        type: "RECHARGE",
        amount: 10000,
        createdAt,
        order: null,
      }],
    });
  });
});
