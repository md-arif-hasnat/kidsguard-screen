export type BillingInterval = "MONTHLY" | "YEARLY";

export const MONTHLY_PRICE_CENTS = 349;
export const YEARLY_PRICE_CENTS = 3599;
export const YEARLY_SAVINGS_CENTS =
  MONTHLY_PRICE_CENTS * 12 - YEARLY_PRICE_CENTS;
export const YEARLY_SAVINGS_PERCENT = Math.round(
  (YEARLY_SAVINGS_CENTS / (MONTHLY_PRICE_CENTS * 12)) * 100
);

export function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
