export type BillingInterval = "MONTHLY" | "YEARLY";

export interface RecurringAddOnDefinition {
  key: string;
  name: string;
  description: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxQuantity: number;
}

export const MONTHLY_PRICE_CENTS = 349;
export const YEARLY_PRICE_CENTS = 3599;
export const EXTRA_CHILD_MONTHLY_PRICE_CENTS = 199;
export const EXTRA_CHILD_YEARLY_PRICE_CENTS = 1999;
export const YEARLY_SAVINGS_CENTS =
  MONTHLY_PRICE_CENTS * 12 - YEARLY_PRICE_CENTS;
export const YEARLY_SAVINGS_PERCENT = Math.round(
  (YEARLY_SAVINGS_CENTS / (MONTHLY_PRICE_CENTS * 12)) * 100
);

const extraChildMonthlyPriceId =
  process.env.NEXT_PUBLIC_PADDLE_EXTRA_CHILD_MONTHLY_PRICE_ID ||
  process.env.NEXT_PUBLIC_PADDLE_EXTRA_CHILD_PRICE_ID ||
  "";
const extraChildYearlyPriceId =
  process.env.NEXT_PUBLIC_PADDLE_EXTRA_CHILD_YEARLY_PRICE_ID || "";

function cleanKey(value: unknown): string {
  return typeof value === "string" && /^[a-z0-9_]{2,50}$/.test(value)
    ? value
    : "";
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function cleanPriceId(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.trim();
  return /^pri_[A-Za-z0-9]+$/.test(cleaned) ? cleaned : "";
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function configuredRecurringAddOns(): RecurringAddOnDefinition[] {
  const raw = process.env.NEXT_PUBLIC_PADDLE_RECURRING_ADDONS_JSON || "";
  if (!raw.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((value): RecurringAddOnDefinition[] => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const key = cleanKey(item.key);
      const name = cleanText(item.name, "", 80);
      const monthlyPriceId = cleanPriceId(item.monthlyPriceId);
      const yearlyPriceId = cleanPriceId(item.yearlyPriceId);
      const monthlyPriceCents = positiveInteger(item.monthlyPriceCents, 0);
      const yearlyPriceCents = positiveInteger(item.yearlyPriceCents, 0);

      if (
        !key ||
        key === "extra_child_slot" ||
        !name ||
        (!monthlyPriceId && !yearlyPriceId) ||
        (!monthlyPriceCents && !yearlyPriceCents)
      ) {
        return [];
      }

      return [{
        key,
        name,
        description: cleanText(
          item.description,
          "Recurring add-on billed with your Family Plan.",
          180
        ),
        monthlyPriceId,
        yearlyPriceId,
        monthlyPriceCents,
        yearlyPriceCents,
        maxQuantity: Math.min(99, positiveInteger(item.maxQuantity, 1)),
      }];
    });
  } catch (error) {
    console.error("Invalid recurring add-on billing configuration", error);
    return [];
  }
}

export const RECURRING_ADD_ONS: RecurringAddOnDefinition[] = [
  {
    key: "extra_child_slot",
    name: "Extra child slot",
    description:
      "Two child devices are included. Add more to the same subscription and invoice.",
    monthlyPriceId: extraChildMonthlyPriceId,
    yearlyPriceId: extraChildYearlyPriceId,
    monthlyPriceCents: EXTRA_CHILD_MONTHLY_PRICE_CENTS,
    yearlyPriceCents: EXTRA_CHILD_YEARLY_PRICE_CENTS,
    maxQuantity: 8,
  },
  ...configuredRecurringAddOns(),
].filter(
  (item, index, all) =>
    all.findIndex((candidate) => candidate.key === item.key) === index
);

export function addOnPriceId(
  addOn: RecurringAddOnDefinition,
  interval: BillingInterval
): string {
  return interval === "YEARLY"
    ? addOn.yearlyPriceId
    : addOn.monthlyPriceId;
}

export function addOnPriceCents(
  addOn: RecurringAddOnDefinition,
  interval: BillingInterval
): number {
  return interval === "YEARLY"
    ? addOn.yearlyPriceCents
    : addOn.monthlyPriceCents;
}

export function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
