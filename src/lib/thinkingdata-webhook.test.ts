import { describe, expect, it } from "vitest";
import {
  parseThinkingDataWebhookMessages,
  signThinkingDataWebhookBody,
  thinkingDataWebhookSuccess,
  validateThinkingDataWebhookMessages,
  verifyThinkingDataWebhookSignature,
} from "@/lib/thinkingdata-webhook";

describe("thinkingdata webhook channel", () => {
  it("accepts a valid batch and returns the documented response shape", () => {
    const body = JSON.stringify([
      {
        push_id: "user-1",
        params: { title: "每日活动", content: "欢迎回来" },
        custom_params: { name: "张三" },
        "#ops_receipt_properties": {
          ops_task_id: "0050",
          ops_request_id: "f7b66eb7-3363-4a46-a402-601a64b45f76",
          ops_project_id: 1,
        },
      },
    ]);

    const messages = parseThinkingDataWebhookMessages(body);
    expect(validateThinkingDataWebhookMessages(messages)).toEqual([]);
    expect(thinkingDataWebhookSuccess()).toEqual({
      return_code: 0,
      return_message: "success",
      data: { fail_list: [] },
    });
  });

  it("reports invalid messages with one-based fail_list indexes", () => {
    const messages = parseThinkingDataWebhookMessages(JSON.stringify([
      { push_id: "", "#ops_receipt_properties": {} },
      { push_id: "user-2" },
      { push_id: "user-3", params: "bad", "#ops_receipt_properties": {} },
    ]));

    expect(validateThinkingDataWebhookMessages(messages)).toEqual([
      { index: 1, message: "push_id is required" },
      { index: 2, message: "#ops_receipt_properties is required" },
      { index: 3, message: "params must be an object when provided" },
    ]);
  });

  it("verifies optional HmacSHA1 signatures from ThinkingData headers", () => {
    const body = JSON.stringify([{ push_id: "user-1", "#ops_receipt_properties": {} }]);
    const secret = "coffee-secret";
    const signature = signThinkingDataWebhookBody(secret, body);

    expect(verifyThinkingDataWebhookSignature({ body, secret, headers: new Headers({ "X-AE-OPS-Signature": signature }) })).toBe(true);
    expect(verifyThinkingDataWebhookSignature({ body, secret, headers: new Headers({ "X-TE-OPS-Signature": signature }) })).toBe(true);
    expect(verifyThinkingDataWebhookSignature({ body, secret, headers: new Headers({ "X-AE-OPS-Signature": "bad" }) })).toBe(false);
    expect(verifyThinkingDataWebhookSignature({ body, headers: new Headers() })).toBe(true);
  });

  it("rejects non-array request bodies", () => {
    expect(() => parseThinkingDataWebhookMessages(JSON.stringify({ push_id: "user-1" }))).toThrow("request body must be a JSON array");
  });
});
