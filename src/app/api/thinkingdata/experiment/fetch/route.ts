import { NextResponse } from "next/server";

const requestTimeoutMs = 500;
const maxAttempts = 3;

function experimentFetchUrl() {
  const configured = process.env.THINKINGDATA_EXPERIMENT_FETCH_URL;
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

async function fetchWithRetry(url: URL, body: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  const url = experimentFetchUrl();
  if (!url) {
    return NextResponse.json({ error: "ThinkingData experiment fetch URL is not configured" }, { status: 503 });
  }

  let body: string;
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid payload");
    body = JSON.stringify(payload);
  } catch {
    return NextResponse.json({ error: "Invalid experiment fetch payload" }, { status: 400 });
  }

  try {
    const response = await fetchWithRetry(url, body);
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "cache-control": "no-store",
        "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json({ error: "ThinkingData experiment fetch failed" }, { status: 502 });
  }
}
