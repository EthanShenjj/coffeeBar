import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

async function handler(request: Request) {
  const handlers = toNextJsHandler(getAuth());
  return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export { handler as GET, handler as POST };
