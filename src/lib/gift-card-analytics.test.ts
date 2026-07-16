import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  trackAnalytics: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackAnalytics: mocks.trackAnalytics,
}));

import {
  GIFT_CARD_ANALYTICS_EVENTS,
  giftCardAnalytics,
  rechargeGiftCardWithAnalytics,
  trackAppliedGiftCardPayment,
  trackGiftCardEvent,
  trackGiftCardPaymentToggle,
} from "@/lib/gift-card-analytics";

describe("gift card analytics", () => {
  beforeEach(() => {
    mocks.trackAnalytics.mockReset();
  });

  it("forwards every gift-card event with its exact reporting name", () => {
    const properties = { amount_cents: 10_000 };

    for (const eventName of Object.values(GIFT_CARD_ANALYTICS_EVENTS)) {
      trackGiftCardEvent(eventName, properties);
    }

    expect(mocks.trackAnalytics.mock.calls).toEqual([
      ["gift_card_viewed", properties],
      ["gift_card_amount_selected", properties],
      ["gift_card_recharge_submitted", properties],
      ["gift_card_recharge_succeeded", properties],
      ["gift_card_recharge_failed", properties],
      ["gift_card_payment_enabled", properties],
      ["gift_card_payment_disabled", properties],
      ["gift_card_payment_applied", properties],
    ]);
  });

  it("maps gift-card lifecycle data to stable analytics properties", () => {
    giftCardAnalytics.viewed({ balance: 10_000, persistent: true });
    giftCardAnalytics.amountSelected({ amount: 20_000, balance: 10_000 });
    giftCardAnalytics.rechargeSubmitted({ amount: 20_000, balance: 10_000 });
    giftCardAnalytics.rechargeSucceeded({ amount: 20_000, balanceBefore: 10_000, balanceAfter: 30_000 });
    giftCardAnalytics.rechargeFailed({ amount: 20_000, balance: 10_000, failureCode: "server_rejected" });
    giftCardAnalytics.paymentEnabled({ balance: 10_000, orderAmount: 12_800, giftCardAmount: 10_000, externalAmount: 2_800 });
    giftCardAnalytics.paymentDisabled({ balance: 10_000, orderAmount: 12_800 });
    giftCardAnalytics.paymentApplied({ orderId: "order-1", productChannel: "SHOP", orderAmount: 12_800, giftCardAmount: 10_000, externalAmount: 2_800 });

    expect(mocks.trackAnalytics.mock.calls).toEqual([
      ["gift_card_viewed", { balance_cents: 10_000, has_balance: true, is_persistent: true }],
      ["gift_card_amount_selected", { amount_cents: 20_000, balance_before_cents: 10_000 }],
      ["gift_card_recharge_submitted", { amount_cents: 20_000, balance_before_cents: 10_000 }],
      ["gift_card_recharge_succeeded", { amount_cents: 20_000, balance_before_cents: 10_000, balance_after_cents: 30_000 }],
      ["gift_card_recharge_failed", { amount_cents: 20_000, balance_before_cents: 10_000, failure_code: "server_rejected" }],
      ["gift_card_payment_enabled", { gift_card_balance_cents: 10_000, order_amount_cents: 12_800, gift_card_amount_cents: 10_000, external_amount_cents: 2_800 }],
      ["gift_card_payment_disabled", { gift_card_balance_cents: 10_000, order_amount_cents: 12_800 }],
      ["gift_card_payment_applied", { order_id: "order-1", product_channel: "SHOP", order_amount_cents: 12_800, gift_card_amount_cents: 10_000, external_amount_cents: 2_800 }],
    ]);
  });

  it("wires the gift-card page to every recharge lifecycle event", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/gift-card-panel.tsx"), "utf8");

    expect(source).toContain("giftCardAnalytics.viewed");
    expect(source).toContain("giftCardAnalytics.amountSelected");
    expect(source).toContain("rechargeGiftCardWithAnalytics");
  });

  it("wires checkout to gift-card toggle and applied-payment events", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/checkout-view.tsx"), "utf8");

    expect(source).toContain("trackGiftCardPaymentToggle");
    expect(source).toContain("trackAppliedGiftCardPayment");
  });

  it("reports recharge submission before the request and success only after it resolves", async () => {
    let resolveRecharge!: (result: { ok: true; balance: number }) => void;
    const recharge = vi.fn(() => new Promise<{ ok: true; balance: number }>((resolve) => {
      resolveRecharge = resolve;
    }));

    const pending = rechargeGiftCardWithAnalytics({ recharge, amount: 10_000, balance: 2_000, token: "token-1" });

    expect(mocks.trackAnalytics.mock.calls).toEqual([
      ["gift_card_recharge_submitted", { amount_cents: 10_000, balance_before_cents: 2_000 }],
    ]);

    resolveRecharge({ ok: true, balance: 30_000 });
    await expect(pending).resolves.toEqual({ ok: true, balance: 30_000 });
    expect(mocks.trackAnalytics.mock.calls.at(-1)).toEqual([
      "gift_card_recharge_succeeded",
      { amount_cents: 10_000, balance_before_cents: 20_000, balance_after_cents: 30_000 },
    ]);
  });

  it("reports returned and thrown recharge failures without a success event", async () => {
    await expect(rechargeGiftCardWithAnalytics({
      recharge: vi.fn().mockResolvedValue({ ok: false, message: "nope" }),
      amount: 20_000,
      balance: 1_000,
      token: "token-2",
    })).resolves.toEqual({ ok: false, message: "nope" });
    expect(mocks.trackAnalytics.mock.calls.at(-1)).toEqual([
      "gift_card_recharge_failed",
      { amount_cents: 20_000, balance_before_cents: 1_000, failure_code: "server_rejected" },
    ]);

    mocks.trackAnalytics.mockReset();
    await expect(rechargeGiftCardWithAnalytics({
      recharge: vi.fn().mockRejectedValue(new Error("network")),
      amount: 30_000,
      balance: 1_000,
      token: "token-3",
    })).rejects.toThrow("network");
    expect(mocks.trackAnalytics.mock.calls.at(-1)).toEqual([
      "gift_card_recharge_failed",
      { amount_cents: 30_000, balance_before_cents: 1_000, failure_code: "unexpected_error" },
    ]);
    expect(mocks.trackAnalytics.mock.calls.some(([name]) => name === "gift_card_recharge_succeeded")).toBe(false);
  });

  it("reports the selected payment toggle and only applies server-confirmed gift-card amounts", () => {
    trackGiftCardPaymentToggle({ enabled: true, balance: 10_000, orderAmount: 12_800 });
    trackGiftCardPaymentToggle({ enabled: false, balance: 10_000, orderAmount: 12_800 });
    trackAppliedGiftCardPayment({ orderId: "order-zero", productChannel: "SHOP", orderAmount: 12_800, giftCardAmount: 0, externalAmount: 12_800 });
    trackAppliedGiftCardPayment({ orderId: "order-paid", productChannel: "SHOP", orderAmount: 12_800, giftCardAmount: 10_000, externalAmount: 2_800 });
    trackAppliedGiftCardPayment({ orderId: "order-paid", productChannel: "SHOP", orderAmount: 12_800, giftCardAmount: 10_000, externalAmount: 2_800 });

    expect(mocks.trackAnalytics.mock.calls).toEqual([
      ["gift_card_payment_enabled", { gift_card_balance_cents: 10_000, order_amount_cents: 12_800, gift_card_amount_cents: 10_000, external_amount_cents: 2_800 }],
      ["gift_card_payment_disabled", { gift_card_balance_cents: 10_000, order_amount_cents: 12_800 }],
      ["gift_card_payment_applied", { order_id: "order-paid", product_channel: "SHOP", order_amount_cents: 12_800, gift_card_amount_cents: 10_000, external_amount_cents: 2_800 }],
    ]);
  });
});
