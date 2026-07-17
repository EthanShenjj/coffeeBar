import { getDb } from "@/lib/db";

const publishedWhere = () => ({ status: "PUBLISHED" as const, publishedAt: { lte: new Date() } });

export function getAnnouncementsForUser(userId: string | null) {
  return getDb().announcement.findMany({
    where: publishedWhere(),
    orderBy: { publishedAt: "desc" },
    include: { receipts: userId ? { where: { userId }, select: { id: true } } : false },
  });
}

export function getAnnouncementForUser(userId: string, announcementId: string) {
  return getDb().announcement.findFirst({
    where: { id: announcementId, ...publishedWhere() },
    include: { receipts: { where: { userId }, select: { id: true } } },
  });
}

export async function markAnnouncementReadForUser(userId: string, announcementId: string) {
  await getDb().messageReceipt.upsert({
    where: { userId_announcementId: { userId, announcementId } },
    create: { userId, announcementId },
    update: { readAt: new Date() },
  });
}
