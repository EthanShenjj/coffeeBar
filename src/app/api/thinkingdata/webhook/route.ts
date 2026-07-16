import { NextResponse } from "next/server";
import {
  parseThinkingDataWebhookMessages,
  thinkingDataWebhookFailure,
  thinkingDataWebhookSuccess,
  validateThinkingDataWebhookMessages,
  verifyThinkingDataWebhookSignature,
} from "@/lib/thinkingdata-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function webhookSecret() {
  return process.env.THINKINGDATA_WEBHOOK_SECRET || process.env.AE_OPS_WEBHOOK_SECRET;
}

export async function POST(request: Request) {
  const body = await request.text();

  if (!verifyThinkingDataWebhookSignature({ body, headers: request.headers, secret: webhookSecret() })) {
    return NextResponse.json(thinkingDataWebhookFailure("invalid signature"), { status: 401 });
  }

  try {
    const messages = parseThinkingDataWebhookMessages(body);
    const failList = validateThinkingDataWebhookMessages(messages);

    // This endpoint currently acknowledges and validates webhook-channel batches.
    // When CoffeeBar has a concrete delivery target, persist or dispatch each valid message here.
    return NextResponse.json(thinkingDataWebhookSuccess(failList));
  } catch (error) {
    return NextResponse.json(
      thinkingDataWebhookFailure(error instanceof Error ? error.message : "invalid request body"),
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "thinkingdata-webhook" });
}
