import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/thinkingdata/webhook/route";
import { signThinkingDataWebhookBody } from "@/lib/thinkingdata-webhook";

describe("ThinkingData webhook route", () => {
  const originalSecret = process.env.THINKINGDATA_WEBHOOK_SECRET;

  afterEach(() => {
    process.env.THINKINGDATA_WEBHOOK_SECRET = originalSecret;
  });

  it("acknowledges valid webhook batches", async () => {
    process.env.THINKINGDATA_WEBHOOK_SECRET = "";
    const request = new Request("https://coffeebar.test/api/thinkingdata/webhook", {
      method: "POST",
      body: JSON.stringify([{ push_id: "user-1", "#ops_receipt_properties": { ops_request_id: "request-1" } }]),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      return_code: 0,
      return_message: "success",
      data: { fail_list: [] },
    });
  });

  it("rejects invalid signatures when a secret is configured", async () => {
    process.env.THINKINGDATA_WEBHOOK_SECRET = "coffee-secret";
    const body = JSON.stringify([{ push_id: "user-1", "#ops_receipt_properties": {} }]);
    const request = new Request("https://coffeebar.test/api/thinkingdata/webhook", {
      method: "POST",
      body,
      headers: { "X-AE-OPS-Signature": signThinkingDataWebhookBody("wrong-secret", body) },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      return_code: 1,
      return_message: "invalid signature",
    });
  });
});
