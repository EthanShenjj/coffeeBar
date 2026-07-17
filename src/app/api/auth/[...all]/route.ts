import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { corsHeadersForRequest } from "@/server/api/cors";

async function handler(request: Request) {
  const cors = corsHeadersForRequest(request);
  cors.headers.set("Access-Control-Expose-Headers", "set-auth-token");
  cors.headers.set("Cache-Control", "no-store");
  if (!cors.allowed) {
    cors.headers.set("Content-Type", "application/json; charset=utf-8");
    return Response.json({ message: "不允许的请求来源" }, { status: 403, headers: cors.headers });
  }
  const handlers = toNextJsHandler(getAuth());
  const response = request.method === "GET" ? await handlers.GET(request) : await handlers.POST(request);
  const headers = new Headers(response.headers);
  cors.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function OPTIONS(request: Request) {
  const cors = corsHeadersForRequest(request);
  cors.headers.set("Access-Control-Expose-Headers", "set-auth-token");
  cors.headers.set("Cache-Control", "no-store");
  if (!cors.allowed) {
    cors.headers.set("Content-Type", "application/json; charset=utf-8");
    return Response.json({ message: "不允许的请求来源" }, { status: 403, headers: cors.headers });
  }
  return new Response(null, { status: 204, headers: cors.headers });
}

export { handler as GET, handler as POST };
