export const GIFT_CARD_RECHARGE_AMOUNTS = [10_000, 20_000, 30_000, 50_000] as const;

export type PaymentSplit = {
  giftCardAmount: number;
  externalAmount: number;
};

export function calculatePaymentSplit(
  totalAmount: number,
  balance: number,
  useGiftCard: boolean,
): PaymentSplit {
  const giftCardAmount = useGiftCard
    ? Math.min(Math.max(balance, 0), Math.max(totalAmount, 0))
    : 0;

  return {
    giftCardAmount,
    externalAmount: Math.max(totalAmount - giftCardAmount, 0),
  };
}
