import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ThinkingDataProxyContext = {
  params: Promise<{ path?: string[] }>;
};

function thinkingDataBaseUrl() {
  return process.env.NEXT_PUBLIC_THINKINGDATA_SERVER_URL?.replace(/\/$/, "");
}

async function proxyThinkingData(request: Request, context: ThinkingDataProxyContext) {
  const baseUrl = thinkingDataBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "ThinkingData server URL is not configured" }, { status: 500 });
  }

  const params = await context.params;
  const path = params.path?.join("/") ?? "";
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${baseUrl}/${path}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    cache: "no-store",
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "cache-control": "no-store",
      "content-type": response.headers.get("content-type") ?? "text/plain; charset=utf-8",
    },
  });
}

export async function GET(request: Request, context: ThinkingDataProxyContext) {
  return proxyThinkingData(request, context);
}

export async function POST(request: Request, context: ThinkingDataProxyContext) {
  return proxyThinkingData(request, context);
}
