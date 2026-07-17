import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireUser: vi.fn(),
  hasDatabase: vi.fn(),
  markAnnouncementReadForUser: vi.fn(),
  updateProfileForUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/db", () => ({ hasDatabase: mocks.hasDatabase }));
vi.mock("@/server/services/announcements", () => ({ markAnnouncementReadForUser: mocks.markAnnouncementReadForUser }));
vi.mock("@/server/services/profiles", () => ({ updateProfileForUser: mocks.updateProfileForUser }));

import { markMessageRead, updateProfile } from "@/actions/account";

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

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabase.mockReturnValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.updateProfileForUser.mockResolvedValue(undefined);
  });

  it("rejects impossible calendar birthdays before calling the service", async () => {
    const result = await updateProfile({ name: "林墨", phone: "13800138000", birthday: "2026-02-30" });
    expect(result.ok).toBe(false);
    expect(mocks.updateProfileForUser).not.toHaveBeenCalled();
  });

  it("accepts an empty birthday", async () => {
    await expect(updateProfile({ name: "林墨", phone: "13800138000", birthday: "" })).resolves.toEqual({ ok: true, message: "个人资料已更新" });
  });

  it("does not leak unexpected persistence errors", async () => {
    mocks.updateProfileForUser.mockRejectedValueOnce(new Error("password=database-secret"));
    const result = await updateProfile({ name: "林墨", phone: "13800138000", birthday: "2026-07-17" });
    expect(result).toEqual({ ok: false, message: "保存失败" });
    expect(JSON.stringify(result)).not.toContain("database-secret");
  });

  it("preserves the known expired-session login prompt", async () => {
    mocks.requireUser.mockRejectedValueOnce(new Error("请先登录后再继续"));
    await expect(updateProfile({ name: "林墨", phone: "13800138000", birthday: "" })).resolves.toEqual({
      ok: false,
      message: "请先登录后再继续",
    });
  });
});
