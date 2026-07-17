import { z } from "zod";
import type { ApiErrorCode } from "@coffeebar/contracts";
import { requireUserFromHeaders, UnauthorizedError } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";
import { ServiceConflictError, ServiceNotFoundError } from "@/server/services/errors";
import { corsHeadersForRequest, type ApiEnvironment } from "@/server/api/cors";

export { corsHeadersForRequest } from "@/server/api/cors";
export type { ApiEnvironment } from "@/server/api/cors";

export class ApiConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConflictError";
  }
}

export class ApiValidationError extends Error {
  constructor(message = "请求内容不是有效的 JSON") {
    super(message);
    this.name = "ApiValidationError";
  }
}

export class ApiForbiddenError extends Error {
  constructor() {
    super("不允许的请求来源");
    this.name = "ApiForbiddenError";
  }
}

export class ApiServiceUnavailableError extends Error {
  constructor() {
    super("服务暂时不可用");
    this.name = "ApiServiceUnavailableError";
  }
}

export class ApiOutputValidationError extends Error {
  constructor() {
    super("API output validation failed");
    this.name = "ApiOutputValidationError";
  }
}

export function assertCustomerDatabaseAvailable(input: {
  available: boolean;
  nodeEnv: string | undefined;
  access: "public" | "authenticated";
}) {
  if (!input.available && !(input.nodeEnv === "development" && input.access === "public")) {
    throw new ApiServiceUnavailableError();
  }
}

export function assertBearerAuthorization(headers: Headers) {
  const authorization = headers.get("authorization");
  if (!authorization || !/^Bearer [^\s]+$/.test(authorization)) throw new UnauthorizedError();
}

export function requireBearerUserFromHeaders(headers: Headers) {
  assertBearerAuthorization(headers);
  const bearerOnlyHeaders = new Headers(headers);
  bearerOnlyHeaders.delete("cookie");
  return requireUserFromHeaders(bearerOnlyHeaders);
}

export type MappedApiError = {
  status: number;
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

function responseHeaders(request: Request, env?: ApiEnvironment) {
  const { headers } = corsHeadersForRequest(request, env);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return headers;
}

function zodFieldErrors(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.length ? issue.path.join(".") : "_root";
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function mapApiError(error: unknown): MappedApiError {
  if (error instanceof UnauthorizedError) {
    return { status: 401, error: { code: "UNAUTHORIZED", message: "请先登录后再继续" } };
  }
  if (error instanceof ApiForbiddenError) {
    return { status: 403, error: { code: "FORBIDDEN", message: error.message } };
  }
  if (error instanceof ServiceNotFoundError) {
    return { status: 404, error: { code: "NOT_FOUND", message: error.message } };
  }
  if (error instanceof ApiConflictError) {
    return { status: 409, error: { code: "CONFLICT", message: error.message } };
  }
  if (error instanceof ServiceConflictError) {
    return { status: 409, error: { code: "CONFLICT", message: error.message } };
  }
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      error: { code: "VALIDATION_ERROR", message: "请求参数无效", fieldErrors: zodFieldErrors(error) },
    };
  }
  if (error instanceof ApiValidationError) {
    return { status: 400, error: { code: "VALIDATION_ERROR", message: error.message } };
  }
  if (error instanceof ApiServiceUnavailableError) {
    return { status: 503, error: { code: "SERVICE_UNAVAILABLE", message: error.message } };
  }
  return { status: 500, error: { code: "INTERNAL_ERROR", message: "服务器暂时无法处理请求" } };
}

export function apiSuccessResponse<T>(
  data: T,
  request: Request,
  init: { status?: number; env?: ApiEnvironment } = {},
) {
  return Response.json({ data }, {
    status: init.status ?? 200,
    headers: responseHeaders(request, init.env),
  });
}

export function apiErrorResponse(error: unknown, request: Request, env?: ApiEnvironment) {
  const mapped = mapApiError(error);
  return Response.json({ error: mapped.error }, {
    status: mapped.status,
    headers: responseHeaders(request, env),
  });
}

export function handleOptions(request: Request, env?: ApiEnvironment) {
  const cors = corsHeadersForRequest(request, env);
  if (!cors.allowed) return apiErrorResponse(new ApiForbiddenError(), request, env);
  cors.headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 204, headers: cors.headers });
}

export function routeOptions(request: Request, context?: unknown) {
  void context;
  return handleOptions(request);
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiValidationError();
  }
  return schema.parse(value);
}

export function validateApiOutput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiOutputValidationError();
  return parsed.data;
}

export async function executeApi<T>(
  request: Request,
  options: { access: "public" | "authenticated" },
  operation: () => Promise<T> | T,
) {
  try {
    if (!corsHeadersForRequest(request).allowed) throw new ApiForbiddenError();
    assertCustomerDatabaseAvailable({
      available: hasDatabase(),
      nodeEnv: process.env.NODE_ENV,
      access: options.access,
    });
    if (options.access === "authenticated") assertBearerAuthorization(request.headers);
    return apiSuccessResponse(await operation(), request);
  } catch (error) {
    return apiErrorResponse(error, request);
  }
}
