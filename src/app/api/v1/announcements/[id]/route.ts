import type { AnnouncementDetail } from "@coffeebar/contracts";
import { getSessionFromHeaders } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { DEMO_ANNOUNCEMENTS } from "@/lib/demo-data";
import { executeApi, routeOptions } from "@/server/api/http";
import { requireFound } from "@/server/api/routes";
import { getAnnouncementForUser } from "@/server/services/announcements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

function demoAnnouncement(id: string): AnnouncementDetail | null {
  const item = DEMO_ANNOUNCEMENTS.find((entry) => entry.id === id);
  if (!item) return null;
  const year = new Date().getFullYear();
  const publishedAt = new Date(`${year}-${item.date.replace(".", "-")}T00:00:00+08:00`).toISOString();
  return { ...item, content: item.summary, coverUrl: null, publishedAt, createdAt: publishedAt };
}

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeApi(request, { access: "public" }, async () => {
    const { id } = await context.params;
    if (!hasDatabase()) return requireFound(demoAnnouncement(id), "消息不存在");
    const session = await getSessionFromHeaders(request.headers);
    return requireFound(await getAnnouncementForUser(session?.user.id ?? null, id), "消息不存在");
  });
}
