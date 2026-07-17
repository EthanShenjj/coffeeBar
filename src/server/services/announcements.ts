import type { AnnouncementDetail, AnnouncementSummary } from "@coffeebar/contracts";
import { getDb } from "@/lib/db";
import { ServiceNotFoundError } from "@/server/services/errors";

const publishedWhere = () => ({ status: "PUBLISHED" as const, publishedAt: { lte: new Date() } });

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export async function getAnnouncementsForUser(userId: string | null): Promise<AnnouncementSummary[]> {
  const rows = await getDb().announcement.findMany({
    where: publishedWhere(),
    orderBy: { publishedAt: "desc" },
    select: {
      id: true, title: true, summary: true, publishedAt: true, createdAt: true,
      receipts: userId ? { where: { userId }, select: { readAt: true } } : false,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    date: dateKey(row.publishedAt ?? row.createdAt),
    read: Array.isArray(row.receipts) && row.receipts.length > 0,
  }));
}

export async function getAnnouncementForUser(userId: string | null, announcementId: string): Promise<AnnouncementDetail | null> {
  const row = await getDb().announcement.findFirst({
    where: { id: announcementId, ...publishedWhere() },
    select: {
      id: true, title: true, summary: true, content: true, coverUrl: true, publishedAt: true, createdAt: true,
      receipts: userId ? { where: { userId }, select: { readAt: true } } : false,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    coverUrl: row.coverUrl,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
    read: Array.isArray(row.receipts) && row.receipts.length > 0,
  };
}

export async function markAnnouncementReadForUser(userId: string, announcementId: string) {
  await getDb().$transaction(async (tx) => {
    const announcement = await tx.announcement.findFirst({
      where: { id: announcementId, ...publishedWhere() },
      select: { id: true },
    });
    if (!announcement) throw new ServiceNotFoundError("消息不存在");
    try {
      await tx.messageReceipt.upsert({
        where: { userId_announcementId: { userId, announcementId } },
        create: { userId, announcementId },
        update: { readAt: new Date() },
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2003") {
        throw new ServiceNotFoundError("消息不存在");
      }
      throw error;
    }
  }, { isolationLevel: "Serializable" });
}
