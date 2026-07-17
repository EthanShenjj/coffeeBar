import { requireUserFromHeaders } from "@/lib/auth";
import { executeApi, routeOptions } from "@/server/api/http";
import { markAnnouncementReadForUser } from "@/server/services/announcements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return executeApi(request, { access: "authenticated" }, async () => {
    const [user, { id }] = await Promise.all([requireUserFromHeaders(request.headers), context.params]);
    await markAnnouncementReadForUser(user.id, id);
    return { read: true as const };
  });
}
