import { createHmac, timingSafeEqual } from "node:crypto";

type JsonObject = Record<string, unknown>;

export type ThinkingDataWebhookMessage = {
  push_id?: unknown;
  params?: unknown;
  custom_params?: unknown;
  "#ops_receipt_properties"?: unknown;
};

export type ThinkingDataWebhookFailure = {
  index: number;
  message: string;
};

export type ThinkingDataWebhookResponse = {
  return_code: 0 | 1;
  return_message: string;
  data?: {
    fail_list: ThinkingDataWebhookFailure[];
  };
};

const signatureHeaders = ["x-ae-ops-signature", "x-te-ops-signature"];

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function signThinkingDataWebhookBody(secret: string, body: string) {
  return createHmac("sha1", secret).update(body).digest("hex");
}

export function getThinkingDataWebhookSignature(headers: Headers) {
  for (const header of signatureHeaders) {
    const value = headers.get(header);
    if (value) return value.trim();
  }
  return "";
}

export function verifyThinkingDataWebhookSignature({
  body,
  headers,
  secret,
}: {
  body: string;
  headers: Headers;
  secret?: string;
}) {
  if (!secret) return true;
  const signature = getThinkingDataWebhookSignature(headers);
  if (!signature) return false;

  const expected = signThinkingDataWebhookBody(secret, body);
  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseThinkingDataWebhookMessages(body: string) {
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed)) throw new Error("request body must be a JSON array");
  return parsed as ThinkingDataWebhookMessage[];
}

export function validateThinkingDataWebhookMessages(messages: ThinkingDataWebhookMessage[]) {
  const failList: ThinkingDataWebhookFailure[] = [];

  messages.forEach((message, index) => {
    if (!isObject(message)) {
      failList.push({ index: index + 1, message: "message must be an object" });
      return;
    }
    if (typeof message.push_id !== "string" || !message.push_id.trim()) {
      failList.push({ index: index + 1, message: "push_id is required" });
      return;
    }
    if (!isObject(message["#ops_receipt_properties"])) {
      failList.push({ index: index + 1, message: "#ops_receipt_properties is required" });
      return;
    }
    if (message.params !== undefined && !isObject(message.params)) {
      failList.push({ index: index + 1, message: "params must be an object when provided" });
      return;
    }
    if (message.custom_params !== undefined && !isObject(message.custom_params)) {
      failList.push({ index: index + 1, message: "custom_params must be an object when provided" });
    }
  });

  return failList;
}

export function thinkingDataWebhookSuccess(failList: ThinkingDataWebhookFailure[] = []): ThinkingDataWebhookResponse {
  return {
    return_code: 0,
    return_message: "success",
    data: {
      fail_list: failList,
    },
  };
}

export function thinkingDataWebhookFailure(message: string): ThinkingDataWebhookResponse {
  return {
    return_code: 1,
    return_message: message,
  };
}
