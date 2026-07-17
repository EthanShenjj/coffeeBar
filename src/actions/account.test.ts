import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  hasDatabase: vi.fn(),
  markAnnouncementReadForUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ hasDatabase: mocks.hasDatabase }));
vi.mock("@/server/services/announcements", () => ({ markAnnouncementReadForUser: mocks.markAnnouncementReadForUser }));
vi.mock("@/server/services/profiles", () => ({ updateProfileForUser: vi.fn() }));

import { markMessageRead } from "@/actions/account";

describe("markMessageRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.markAnnouncementReadForUser.mockResolvedValue(true);
  });

  it("delegates message ownership with the authenticated user id", async () => {
    await expect(markMessageRead("announcement-1")).resolves.toEqual({ ok: true });
    expect(mocks.markAnnouncementReadForUser).toHaveBeenCalledWith("user-1", "announcement-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/messages");
  });
});
