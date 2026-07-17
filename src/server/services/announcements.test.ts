import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ announcementFindFirst: vi.fn(), receiptUpsert: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    announcement: { findFirst: mocks.announcementFindFirst },
    messageReceipt: { upsert: mocks.receiptUpsert },
  }),
}));

import { markAnnouncementReadForUser } from "@/server/services/announcements";

describe("markAnnouncementReadForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("checks the same published visibility rule before upserting", async () => {
    mocks.announcementFindFirst.mockResolvedValueOnce({ id: "announcement-1" });
    mocks.receiptUpsert.mockResolvedValueOnce({ id: "receipt-1" });

    await expect(markAnnouncementReadForUser("user-1", "announcement-1")).resolves.toBeUndefined();
    expect(mocks.announcementFindFirst).toHaveBeenCalledWith({
      where: {
        id: "announcement-1",
        status: "PUBLISHED",
        publishedAt: { lte: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(mocks.receiptUpsert).toHaveBeenCalledOnce();
  });

  it("throws a typed not-found error without attempting an upsert for missing or invisible IDs", async () => {
    mocks.announcementFindFirst.mockResolvedValueOnce(null);

    await expect(markAnnouncementReadForUser("user-1", "draft-or-missing")).rejects.toMatchObject({
      name: "ServiceNotFoundError",
      code: "NOT_FOUND",
      message: "消息不存在",
    });
    expect(mocks.receiptUpsert).not.toHaveBeenCalled();
  });

  it("maps a deletion race foreign-key failure to the typed not-found error", async () => {
    mocks.announcementFindFirst.mockResolvedValueOnce({ id: "announcement-1" });
    mocks.receiptUpsert.mockRejectedValueOnce({ code: "P2003", message: "secret constraint detail" });

    const promise = markAnnouncementReadForUser("user-1", "announcement-1");
    await expect(promise).rejects.toMatchObject({ name: "ServiceNotFoundError", code: "NOT_FOUND", message: "消息不存在" });
    await expect(promise).rejects.not.toMatchObject({ message: expect.stringContaining("secret") });
  });
});
