"use client";

import { trackAnalytics, type AnalyticsProperties } from "@/lib/analytics";
import { calculatePaymentSplit } from "@/lib/gift-card";

export const GIFT_CARD_ANALYTICS_EVENTS = {
  viewed: "gift_card_viewed",
  amountSelected: "gift_card_amount_selected",
  rechargeSubmitted: "gift_card_recharge_submitted",
  rechargeSucceeded: "gift_card_recharge_succeeded",
  rechargeFailed: "gift_card_recharge_failed",
  paymentEnabled: "gift_card_payment_enabled",
  paymentDisabled: "gift_card_payment_disabled",
  paymentApplied: "gift_card_payment_applied",
} as const;

export type GiftCardAnalyticsEventName = typeof GIFT_CARD_ANALYTICS_EVENTS[keyof typeof GIFT_CARD_ANALYTICS_EVENTS];

const appliedPaymentOrderIds = new Set<string>();

export function trackGiftCardEvent(eventName: GiftCardAnalyticsEventName, properties: AnalyticsProperties = {}) {
  trackAnalytics(eventName, properties);
}

export const giftCardAnalytics = {
  viewed({ balance, persistent }: { balance: number; persistent: boolean }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.viewed, {
      balance_cents: balance,
      has_balance: balance > 0,
      is_persistent: persistent,
    });
  },
  amountSelected({ amount, balance }: { amount: number; balance: number }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.amountSelected, {
      amount_cents: amount,
      balance_before_cents: balance,
    });
  },
  rechargeSubmitted({ amount, balance }: { amount: number; balance: number }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.rechargeSubmitted, {
      amount_cents: amount,
      balance_before_cents: balance,
    });
  },
  rechargeSucceeded({ amount, balanceBefore, balanceAfter }: { amount: number; balanceBefore: number; balanceAfter: number }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.rechargeSucceeded, {
      amount_cents: amount,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceAfter,
    });
  },
  rechargeFailed({ amount, balance, failureCode }: { amount: number; balance: number; failureCode: "server_rejected" | "unexpected_error" }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.rechargeFailed, {
      amount_cents: amount,
      balance_before_cents: balance,
      failure_code: failureCode,
    });
  },
  paymentEnabled({ balance, orderAmount, giftCardAmount, externalAmount }: { balance: number; orderAmount: number; giftCardAmount: number; externalAmount: number }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.paymentEnabled, {
      gift_card_balance_cents: balance,
      order_amount_cents: orderAmount,
      gift_card_amount_cents: giftCardAmount,
      external_amount_cents: externalAmount,
    });
  },
  paymentDisabled({ balance, orderAmount }: { balance: number; orderAmount: number }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.paymentDisabled, {
      gift_card_balance_cents: balance,
      order_amount_cents: orderAmount,
    });
  },
  paymentApplied({ orderId, productChannel, orderAmount, giftCardAmount, externalAmount }: { orderId: string; productChannel: string; orderAmount: number; giftCardAmount: number; externalAmount: number }) {
    trackGiftCardEvent(GIFT_CARD_ANALYTICS_EVENTS.paymentApplied, {
      order_id: orderId,
      product_channel: productChannel,
      order_amount_cents: orderAmount,
      gift_card_amount_cents: giftCardAmount,
      external_amount_cents: externalAmount,
    });
  },
};

type GiftCardRechargeResult =
  | { ok: true; balance: number }
  | { ok: false; message: string };

export async function rechargeGiftCardWithAnalytics({
  recharge,
  amount,
  balance,
  token,
}: {
  recharge: (input: { amount: number; token: string }) => Promise<GiftCardRechargeResult>;
  amount: number;
  balance: number;
  token: string;
}) {
  giftCardAnalytics.rechargeSubmitted({ amount, balance });
  try {
    const result = await recharge({ amount, token });
    if (result.ok) {
      giftCardAnalytics.rechargeSucceeded({
        amount,
        balanceBefore: Math.max(result.balance - amount, 0),
        balanceAfter: result.balance,
      });
    } else {
      giftCardAnalytics.rechargeFailed({ amount, balance, failureCode: "server_rejected" });
    }
    return result;
  } catch (error) {
    giftCardAnalytics.rechargeFailed({ amount, balance, failureCode: "unexpected_error" });
    throw error;
  }
}

export function trackGiftCardPaymentToggle({ enabled, balance, orderAmount }: { enabled: boolean; balance: number; orderAmount: number }) {
  if (enabled) {
    const split = calculatePaymentSplit(orderAmount, balance, true);
    giftCardAnalytics.paymentEnabled({
      balance,
      orderAmount,
      giftCardAmount: split.giftCardAmount,
      externalAmount: split.externalAmount,
    });
    return;
  }
  giftCardAnalytics.paymentDisabled({ balance, orderAmount });
}

export function trackAppliedGiftCardPayment({ orderId, productChannel, orderAmount, giftCardAmount, externalAmount }: { orderId: string; productChannel: string; orderAmount: number; giftCardAmount: number; externalAmount: number }) {
  if (giftCardAmount <= 0) return;
  if (appliedPaymentOrderIds.has(orderId)) return;
  if (typeof window !== "undefined") {
    const storageKey = `coffeebar-analytics:gift-card-payment-applied:${orderId}`;
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") {
        appliedPaymentOrderIds.add(orderId);
        return;
      }
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // In-memory deduplication still covers this page when storage is unavailable.
    }
  }
  appliedPaymentOrderIds.add(orderId);
  giftCardAnalytics.paymentApplied({ orderId, productChannel, orderAmount, giftCardAmount, externalAmount });
}
