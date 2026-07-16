import { NextResponse } from "next/server";

function thinkingDataBaseUrl() {
  return process.env.NEXT_PUBLIC_THINKINGDATA_SERVER_URL?.replace(/\/$/, "");
}

export async function proxyThinkingDataRequest(request: Request, path: "config" | "sync_js") {
  const baseUrl = thinkingDataBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({ error: "ThinkingData server URL is not configured" }, { status: 500 });
  }

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
