import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  announcementFindFirst: vi.fn(),
  receiptUpsert: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    announcement: { findFirst: mocks.announcementFindFirst },
    messageReceipt: { upsert: mocks.receiptUpsert },
  }),
}));

import { markAnnouncementReadForUser } from "@/server/services/announcements";

describe("markAnnouncementReadForUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts receipts without applying published-list visibility rules", async () => {
    mocks.receiptUpsert.mockResolvedValueOnce({ id: "receipt-1" });

    await expect(markAnnouncementReadForUser("user-1", "draft-announcement")).resolves.toBeUndefined();
    expect(mocks.announcementFindFirst).not.toHaveBeenCalled();
    expect(mocks.receiptUpsert).toHaveBeenCalledWith({
      where: { userId_announcementId: { userId: "user-1", announcementId: "draft-announcement" } },
      create: { userId: "user-1", announcementId: "draft-announcement" },
      update: { readAt: expect.any(Date) },
    });
  });

  it("propagates a missing-announcement foreign-key rejection", async () => {
    const foreignKeyError = new Error("Foreign key constraint failed");
    mocks.receiptUpsert.mockRejectedValueOnce(foreignKeyError);

    await expect(markAnnouncementReadForUser("user-1", "missing")).rejects.toBe(foreignKeyError);
  });
});
