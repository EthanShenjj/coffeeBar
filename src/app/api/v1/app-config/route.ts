import { appConfigSchema } from "@coffeebar/contracts";
import { executeApi, routeOptions, validateApiOutput } from "@/server/api/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const OPTIONS = routeOptions;

function appBaseUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function GET(request: Request) {
  return executeApi(request, { access: "public" }, () => {
    const base = appBaseUrl();
    return validateApiOutput(appConfigSchema, {
      minimumIosVersion: process.env.MINIMUM_IOS_VERSION ?? "1.0.0",
      maintenance: process.env.APP_MAINTENANCE_MODE === "true",
      privacyUrl: new URL("/privacy", base).toString(),
      supportUrl: new URL("/support", base).toString(),
      apiVersion: "v1",
    });
  });
}
