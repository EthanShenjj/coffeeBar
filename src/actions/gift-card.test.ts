import { beforeEach, describe, expect, it, vi } from "vitest";
import { rechargeGiftCard } from "@/actions/gift-card";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  hasDatabase: vi.fn(),
  transaction: vi.fn(),
  creditGiftCard: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({
  hasDatabase: mocks.hasDatabase,
  getDb: () => ({ $transaction: mocks.transaction }),
}));
vi.mock("@/lib/gift-card-service", () => ({
  creditGiftCard: mocks.creditGiftCard,
}));

describe("rechargeGiftCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("hides unexpected transaction errors", async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Error("connection failed: password=database-secret"),
    );

    const result = await rechargeGiftCard({
      token: "00000000-0000-4000-8000-000000000001",
      amount: 10_000,
    });

    expect(result).toEqual({ ok: false, message: "充值失败，请稍后重试" });
    expect(JSON.stringify(result)).not.toContain("database-secret");
  });
});
