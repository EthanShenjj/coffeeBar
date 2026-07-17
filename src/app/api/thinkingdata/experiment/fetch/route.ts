import { NextResponse } from "next/server";

const requestTimeoutMs = 500;
const maxAttempts = 3;
const maxPayloadBytes = 64 * 1024;
type FetchResult = { body: string; status: number; contentType: string };
const inFlight = new Map<string, Promise<FetchResult>>();

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

async function fetchWithRetry(url: URL, body: string): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        cache: "no-store",
        signal: controller.signal,
      });
      return {
        body: await response.text(),
        status: response.status,
        contentType: response.headers.get("content-type") ?? "application/json; charset=utf-8",
      };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function validPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  const accountId = payload["#account_id"];
  const distinctId = payload["#distinct_id"];
  if (!(typeof accountId === "string" && accountId.trim()) && !(typeof distinctId === "string" && distinctId.trim())) return false;
  const featureKeys = payload["#feature_key"];
  if (featureKeys !== undefined && (!Array.isArray(featureKeys) || featureKeys.length > 100 || featureKeys.some((key) => typeof key !== "string" || !key.trim()))) return false;
  const bucketId = payload["#custom_bucketid"];
  if (bucketId !== undefined && (!bucketId || typeof bucketId !== "object" || Array.isArray(bucketId))) return false;
  return true;
}

function fetchDeduplicated(url: URL, body: string) {
  const key = `${url.toString()}\n${body}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = fetchWithRetry(url, body).finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

export async function POST(request: Request) {
  const url = experimentFetchUrl();
  if (!url) {
    return NextResponse.json({ error: "ThinkingData experiment fetch URL is not configured" }, { status: 503 });
  }

  let body: string;
  try {
    const payload = await request.json();
    if (!validPayload(payload)) throw new Error("invalid payload");
    body = JSON.stringify(payload);
    if (new TextEncoder().encode(body).byteLength > maxPayloadBytes) throw new Error("payload too large");
  } catch {
    return NextResponse.json({ error: "Invalid experiment fetch payload" }, { status: 400 });
  }

  try {
    const response = await fetchDeduplicated(url, body);
    return new Response(response.body, {
      status: response.status,
      headers: {
        "cache-control": "no-store",
        "content-type": response.contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: "ThinkingData experiment fetch failed" }, { status: 502 });
  }
}
