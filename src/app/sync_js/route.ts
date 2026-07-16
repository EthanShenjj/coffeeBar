import { proxyThinkingDataRequest } from "@/lib/thinkingdata-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyThinkingDataRequest(request, "sync_js");
}

export async function POST(request: Request) {
  return proxyThinkingDataRequest(request, "sync_js");
}
