import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  hasDatabase: vi.fn(),
  rechargeGiftCardForUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ hasDatabase: mocks.hasDatabase }));
vi.mock("@/server/services/gift-card-recharge", () => ({ rechargeGiftCardForUser: mocks.rechargeGiftCardForUser }));

import { rechargeGiftCard } from "@/actions/gift-card";

describe("rechargeGiftCard web wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.rechargeGiftCardForUser.mockResolvedValue({ ok: true, balance: 10000 });
  });

  it("delegates with explicit ownership and preserves Web revalidation", async () => {
    const input = { token: "00000000-0000-4000-8000-000000000001", amount: 10000 };
    await expect(rechargeGiftCard(input)).resolves.toEqual({ ok: true, balance: 10000 });
    expect(mocks.rechargeGiftCardForUser).toHaveBeenCalledWith("user-1", input);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile/gift-card");
  });
});
