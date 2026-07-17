import type { AnnouncementSummary } from "@coffeebar/contracts";
import { getSessionFromHeaders } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { DEMO_ANNOUNCEMENTS } from "@/lib/demo-data";
import { executeApi, routeOptions } from "@/server/api/http";
import { getAnnouncementsForUser } from "@/server/services/announcements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

function demoAnnouncements(): AnnouncementSummary[] {
  const year = new Date().getFullYear();
  return DEMO_ANNOUNCEMENTS.map((item) => ({
    ...item,
    date: `${year}-${item.date.replace(".", "-")}`,
  }));
}

export function GET(request: Request) {
  return executeApi(request, { access: "public" }, async () => {
    if (!hasDatabase()) return demoAnnouncements();
    const session = await getSessionFromHeaders(request.headers);
    return getAnnouncementsForUser(session?.user.id ?? null);
  });
}
