import { describe, expect, it } from "vitest";
import {
  GIFT_CARD_RECHARGE_AMOUNTS,
  calculatePaymentSplit,
} from "@/lib/gift-card";

describe("gift card payment rules", () => {
  it("defines the supported recharge amounts", () => {
    expect(GIFT_CARD_RECHARGE_AMOUNTS).toEqual([10_000, 20_000, 30_000, 50_000]);
  });

  it.each([
    [12_800, 50_000, false, { giftCardAmount: 0, externalAmount: 12_800 }],
    [12_800, 20_000, true, { giftCardAmount: 12_800, externalAmount: 0 }],
    [12_800, 10_000, true, { giftCardAmount: 10_000, externalAmount: 2_800 }],
    [12_800, 0, true, { giftCardAmount: 0, externalAmount: 12_800 }],
  ])(
    "splits a %i total with a %i balance when gift card use is %s",
    (totalAmount, balance, useGiftCard, expected) => {
      expect(calculatePaymentSplit(totalAmount, balance, useGiftCard)).toEqual(expected);
    },
  );
});
