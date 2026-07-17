import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  outerAnnouncementFindFirst: vi.fn(), outerReceiptUpsert: vi.fn(),
  txAnnouncementFindFirst: vi.fn(), txReceiptUpsert: vi.fn(),
}));
const tx = {
  announcement: { findFirst: mocks.txAnnouncementFindFirst },
  messageReceipt: { upsert: mocks.txReceiptUpsert },
};
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    $transaction: mocks.transaction,
    announcement: { findFirst: mocks.outerAnnouncementFindFirst },
    messageReceipt: { upsert: mocks.outerReceiptUpsert },
  }),
}));

import { getAnnouncementForUser, markAnnouncementReadForUser } from "@/server/services/announcements";

describe("markAnnouncementReadForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  });

  it("checks visibility and upserts using the same serializable transaction client", async () => {
    mocks.txAnnouncementFindFirst.mockResolvedValueOnce({ id: "announcement-1" });
    mocks.txReceiptUpsert.mockResolvedValueOnce({ id: "receipt-1" });

    await expect(markAnnouncementReadForUser("user-1", "announcement-1")).resolves.toBeUndefined();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.txAnnouncementFindFirst).toHaveBeenCalledWith({
      where: { id: "announcement-1", status: "PUBLISHED", publishedAt: { lte: expect.any(Date) } },
      select: { id: true },
    });
    expect(mocks.txReceiptUpsert).toHaveBeenCalledOnce();
    expect(mocks.outerAnnouncementFindFirst).not.toHaveBeenCalled();
    expect(mocks.outerReceiptUpsert).not.toHaveBeenCalled();
  });

  it("throws a typed not-found error without upserting missing or invisible IDs", async () => {
    mocks.txAnnouncementFindFirst.mockResolvedValueOnce(null);

    await expect(markAnnouncementReadForUser("user-1", "draft-or-missing")).rejects.toMatchObject({
      name: "ServiceNotFoundError", code: "NOT_FOUND", message: "消息不存在",
    });
    expect(mocks.txReceiptUpsert).not.toHaveBeenCalled();
  });

  it("maps a deletion-race foreign-key failure to the typed not-found error", async () => {
    mocks.txAnnouncementFindFirst.mockResolvedValueOnce({ id: "announcement-1" });
    mocks.txReceiptUpsert.mockRejectedValueOnce({ code: "P2003", message: "secret constraint detail" });

    await expect(markAnnouncementReadForUser("user-1", "announcement-1")).rejects.toMatchObject({
      name: "ServiceNotFoundError", code: "NOT_FOUND", message: "消息不存在",
    });
  });
});

describe("getAnnouncementForUser", () => {
  it("supports public detail reads without querying user receipts", async () => {
    mocks.outerAnnouncementFindFirst.mockResolvedValueOnce({
      id: "announcement-1", title: "News", summary: "Hello", content: "Body", coverUrl: null,
      publishedAt: new Date("2026-07-17T08:00:00.000Z"), createdAt: new Date("2026-07-17T07:00:00.000Z"),
    });

    await expect(getAnnouncementForUser(null, "announcement-1")).resolves.toMatchObject({
      id: "announcement-1", read: false,
    });
    expect(mocks.outerAnnouncementFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ receipts: false }),
    }));
  });
});
