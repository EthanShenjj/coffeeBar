import { proxyThinkingDataRequest } from "@/lib/thinkingdata-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyThinkingDataRequest(request, "config");
}
