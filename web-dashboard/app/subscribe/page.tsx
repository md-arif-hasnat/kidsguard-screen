"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BadgePercent,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import { auth } from "@/lib/firebase";
import { FamilyRole } from "@/lib/repositories/FamilyRepository";
import {
  PromoCodeRepository,
  PromoRedemptionResult,
} from "@/lib/repositories/PromoCodeRepository";
import {
  RECURRING_ADD_ONS,
  BillingInterval,
  MONTHLY_PRICE_CENTS,
  MONTHLY_SAVINGS_PERCENT,
  STANDARD_MONTHLY_PRICE_CENTS,
  STANDARD_YEARLY_PRICE_CENTS,
  YEARLY_PRICE_CENTS,
  YEARLY_SAVINGS_CENTS,
  YEARLY_SAVINGS_PERCENT,
  addOnPriceCents,
  addOnPriceId,
  formatEuroCents,
} from "@/lib/billing/pricing";

declare global {
  interface Window {
    Paddle?: {
      Environment?: { set: (environment: "sandbox") => void };
      Initialize: (options: { token: string }) => void;
      Checkout: {
        open: (options: {
          items: Array<{ priceId: string; quantity: number }>;
          customData: Record<string, string>;
          discountId?: string;
          settings: {
            successUrl: string;
            displayMode: "overlay";
            theme: "light";
            locale: string;
            showAddDiscounts?: boolean;
            allowDiscountRemoval?: boolean;
          };
        }) => void;
      };
    };
  }
}

const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
const monthlyPriceId =
  process.env.NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID ||
  process.env.NEXT_PUBLIC_PADDLE_PRICE_ID ||
  "";
const yearlyPriceId =
  process.env.NEXT_PUBLIC_PADDLE_YEARLY_PRICE_ID || "";
const environment =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";

export default function SubscribePage() {
  const router = useRouter();
  const { profile, family, loading, role } = useParentProfile();
  const [sdkReady, setSdkReady] = useState(false);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("MONTHLY");
  const [addOnQuantities, setAddOnQuantities] = useState<
    Record<string, number>
  >({});
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [earlyStartAccepted, setEarlyStartAccepted] = useState(false);
  const [opening, setOpening] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<
    Extract<PromoRedemptionResult, { kind: "PERCENTAGE" }> | null
  >(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && role !== FamilyRole.OWNER) {
      router.replace("/");
    }
  }, [loading, role, router]);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("coupon");
    if (code) setCouponCode(code.toUpperCase());
  }, []);

  const selectedPriceId =
    billingInterval === "YEARLY" ? yearlyPriceId : monthlyPriceId;
  const selectedPriceCents =
    billingInterval === "YEARLY"
      ? YEARLY_PRICE_CENTS
      : MONTHLY_PRICE_CENTS;
  const selectedPeriodLabel =
    billingInterval === "YEARLY" ? "year" : "month";
  const selectedAddOns = RECURRING_ADD_ONS.map((addOn) => ({
    ...addOn,
    quantity: Math.max(0, addOnQuantities[addOn.key] || 0),
    priceId: addOnPriceId(addOn, billingInterval),
    priceCents: addOnPriceCents(addOn, billingInterval),
  })).filter((addOn) => addOn.quantity > 0);
  const recurringTotalCents =
    selectedPriceCents +
    selectedAddOns.reduce(
      (total, addOn) => total + addOn.quantity * addOn.priceCents,
      0
    );
  const discountedRecurringTotalCents = appliedCoupon
    ? Math.round(
        recurringTotalCents * (100 - appliedCoupon.percentage) / 100
      )
    : recurringTotalCents;
  const sdkConfigured = Boolean(
    clientToken && (monthlyPriceId || yearlyPriceId)
  );
  const checkoutConfigured = Boolean(
    clientToken &&
      selectedPriceId &&
      selectedAddOns.every((addOn) => addOn.priceId && addOn.priceCents > 0)
  );
  const extraChildSlots = addOnQuantities.extra_child_slot || 0;
  const parentUid =
    profile?.uid || auth?.currentUser?.uid || "";
  const familyId =
    family?.familyId ||
    profile?.activeFamilyId ||
    profile?.ownedFamilyId ||
    profile?.familyId ||
    profile?.familyIds?.[0] ||
    "";
  const existingSubscriptionStatus = String(
    family?.subscription?.status || "NONE"
  ).toUpperCase();
  const hasActiveGooglePlaySubscription =
    family?.subscription?.provider === "GOOGLE_PLAY" &&
    ["ACTIVE", "TRIALING", "PAST_DUE"].includes(
      existingSubscriptionStatus
    );

  useEffect(() => {
    if (!loading && hasActiveGooglePlaySubscription) {
      router.replace("/manage-subscription?provider=google-play");
    }
  }, [hasActiveGooglePlaySubscription, loading, router]);

  const applyCoupon = async () => {
    const normalized = couponCode.trim().toUpperCase();
    if (!normalized) {
      setError("Enter a coupon code.");
      return;
    }

    setApplyingCoupon(true);
    setError(null);
    setCouponMessage(null);
    try {
      const result = await PromoCodeRepository.redeem(normalized);
      if (result.kind === "FREE") {
        setCouponMessage(
          result.accessEndsAt
            ? `Free access activated until ${new Intl.DateTimeFormat("en", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(result.accessEndsAt))}.`
            : "Free access activated. It remains available while this promotion is active."
        );
        window.setTimeout(
          () => router.push("/manage-subscription?coupon=success"),
          900
        );
        return;
      }

      setAppliedCoupon(result);
      setCouponMessage(
        `${result.percentage}% discount applied${
          result.recurringIntervals
            ? ` for ${result.recurringIntervals} billing ${result.recurringIntervals === 1 ? "cycle" : "cycles"}`
            : " to every renewal"
        }.`
      );
    } catch (couponError) {
      setAppliedCoupon(null);
      setError(
        couponError instanceof Error
          ? couponError.message
          : "Coupon could not be applied."
      );
    } finally {
      setApplyingCoupon(false);
    }
  };

  const initializePaddle = () => {
    if (!sdkConfigured || !window.Paddle) return;

    try {
      if (environment === "sandbox") {
        window.Paddle.Environment?.set("sandbox");
      }
      window.Paddle.Initialize({ token: clientToken });
      setSdkReady(true);
    } catch (sdkError) {
      console.error("Paddle initialization failed", sdkError);
      setError("Secure checkout could not be initialized.");
    }
  };

  const openCheckout = () => {
    if (hasActiveGooglePlaySubscription) {
      setError(
        "This family already has a subscription managed by Google Play."
      );
      return;
    }

    if (!window.Paddle || !sdkReady) {
      setError("Secure checkout is still loading. Please try again.");
      return;
    }

    if (!parentUid) {
      setError("Your signed-in parent account could not be verified. Please sign in again.");
      return;
    }

    if (!familyId) {
      setError("Your family account is not ready for checkout. Please refresh the page and try again.");
      return;
    }

    if (!legalAccepted || !earlyStartAccepted) {
      setError("Complete the required confirmations before checkout.");
      return;
    }

    setOpening(true);
    setError(null);

    try {
      const checkoutItems = [
        { priceId: selectedPriceId, quantity: 1 },
      ];
      for (const addOn of selectedAddOns) {
        checkoutItems.push({
          priceId: addOn.priceId,
          quantity: addOn.quantity,
        });
      }

      window.Paddle.Checkout.open({
        items: checkoutItems,
        customData: {
          parentUid,
          familyId,
          product: "kidsguard_family",
          billingInterval,
          extraChildSlots: String(extraChildSlots),
          promoCode: appliedCoupon?.code || "",
        },
        discountId: appliedCoupon?.paddleDiscountId,
        settings: {
          successUrl: `${window.location.origin}/manage-subscription?checkout=success`,
          displayMode: "overlay",
          theme: "light",
          locale: "en",
          showAddDiscounts: false,
          allowDiscountRemoval: false,
        },
      });
    } catch (checkoutError) {
      console.error("Paddle checkout failed", checkoutError);
      setError("Secure checkout could not be opened.");
    } finally {
      setOpening(false);
    }
  };

  if (
    loading ||
    role !== FamilyRole.OWNER ||
    hasActiveGooglePlaySubscription
  ) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {sdkConfigured && (
        <Script
          src="https://cdn.paddle.com/paddle/v2/paddle.js"
          strategy="afterInteractive"
          onLoad={initializePaddle}
          onError={() =>
            setError("Secure checkout could not be loaded.")
          }
        />
      )}

      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <CreditCard className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">
                Subscribe to KidsGuard
              </h1>
              <p className="mt-2 text-slate-500">
                Secure recurring billing powered by Paddle.
              </p>
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-blue-600">
              Family plan
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              7-day trial, then {formatEuroCents(discountedRecurringTotalCents)}/
              {selectedPeriodLabel}
            </h2>
            <div
              className="mt-5 grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Billing frequency"
            >
              <button
                type="button"
                role="radio"
                aria-checked={billingInterval === "MONTHLY"}
                onClick={() => {
                  setBillingInterval("MONTHLY");
                  setError(null);
                }}
                className={`relative rounded-xl border-2 p-4 text-left transition ${
                  billingInterval === "MONTHLY"
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-black text-white">
                  Save {MONTHLY_SAVINGS_PERCENT}%
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Monthly
                </span>
                <span className="mt-2 block text-sm font-bold text-slate-400 line-through">
                  {formatEuroCents(STANDARD_MONTHLY_PRICE_CENTS)}
                </span>
                <span className="mt-1 block text-2xl font-black text-slate-950">
                  {formatEuroCents(MONTHLY_PRICE_CENTS)}
                  <span className="text-sm font-bold text-slate-500">/month</span>
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={billingInterval === "YEARLY"}
                onClick={() => {
                  setBillingInterval("YEARLY");
                  setError(null);
                }}
                className={`relative rounded-xl border-2 p-4 text-left transition ${
                  billingInterval === "YEARLY"
                    ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100"
                    : "border-slate-200 bg-white hover:border-emerald-300"
                }`}
              >
                <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-black text-white">
                  Save {YEARLY_SAVINGS_PERCENT}%
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Yearly
                </span>
                <span className="mt-2 block text-sm font-bold text-slate-400 line-through">
                  {formatEuroCents(STANDARD_YEARLY_PRICE_CENTS)}
                </span>
                <span className="mt-1 block text-2xl font-black text-slate-950">
                  {formatEuroCents(YEARLY_PRICE_CENTS)}
                  <span className="text-sm font-bold text-slate-500">/year</span>
                </span>
                <span className="mt-1 block text-xs font-bold text-emerald-700">
                  Save {formatEuroCents(YEARLY_SAVINGS_CENTS)} per year
                </span>
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {RECURRING_ADD_ONS.map((addOn) => {
                const quantity = addOnQuantities[addOn.key] || 0;
                const unitPriceCents = addOnPriceCents(
                  addOn,
                  billingInterval
                );
                const intervalAvailable = Boolean(
                  addOnPriceId(addOn, billingInterval) && unitPriceCents > 0
                );

                return (
                  <div
                    key={addOn.key}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-slate-900">
                          {addOn.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {addOn.description}
                        </p>
                        <p className="mt-2 text-sm font-black text-blue-700">
                          {unitPriceCents > 0
                            ? `${formatEuroCents(unitPriceCents)}/${selectedPeriodLabel}`
                            : `Not available for the selected ${selectedPeriodLabel}ly plan`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 self-start rounded-xl border border-slate-200 bg-slate-50 p-2 sm:self-auto">
                        <button
                          type="button"
                          aria-label={`Remove one ${addOn.name}`}
                          disabled={quantity === 0}
                          onClick={() =>
                            setAddOnQuantities((current) => ({
                              ...current,
                              [addOn.key]: Math.max(
                                0,
                                (current[addOn.key] || 0) - 1
                              ),
                            }))
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span
                          className="min-w-8 text-center text-xl font-black text-slate-950"
                          aria-live="polite"
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${addOn.name}`}
                          disabled={
                            !intervalAvailable || quantity >= addOn.maxQuantity
                          }
                          onClick={() =>
                            setAddOnQuantities((current) => ({
                              ...current,
                              [addOn.key]: Math.min(
                                addOn.maxQuantity,
                                (current[addOn.key] || 0) + 1
                              ),
                            }))
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:p-5">
                <div className="flex items-center justify-between gap-4 text-slate-600">
                  <span>KidsGuard Family Plan</span>
                  <span className="font-bold text-slate-900">
                    {formatEuroCents(selectedPriceCents)}
                  </span>
                </div>
                {selectedAddOns.map((addOn) => (
                  <div
                    key={addOn.key}
                    className="flex items-center justify-between gap-4 text-slate-600"
                  >
                    <span>{addOn.name} × {addOn.quantity}</span>
                    <span className="font-bold text-slate-900">
                      {formatEuroCents(addOn.priceCents * addOn.quantity)}
                    </span>
                  </div>
                ))}
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-4 text-emerald-700">
                    <span className="font-bold">
                      Coupon {appliedCoupon.code} ({appliedCoupon.percentage}%)
                    </span>
                    <span className="font-black">
                      −{formatEuroCents(
                        recurringTotalCents - discountedRecurringTotalCents
                      )}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2 font-black text-slate-950">
                  <span>Recurring total</span>
                  <span>
                    {formatEuroCents(discountedRecurringTotalCents)}/{selectedPeriodLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 text-indigo-600 shadow-sm">
                  <BadgePercent className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-indigo-950">Have a coupon?</p>
                  <p className="mt-1 text-xs leading-5 text-indigo-700">
                    Use a promotional discount or activate an admin-issued free access code.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={couponCode}
                  onChange={(event) => {
                    const nextCode = event.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase();
                    setCouponCode(nextCode);
                    if (nextCode !== appliedCoupon?.code) {
                      setAppliedCoupon(null);
                      setCouponMessage(null);
                    }
                    setError(null);
                  }}
                  minLength={4}
                  maxLength={32}
                  placeholder="ENTER CODE"
                  aria-label="Coupon code"
                  className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white px-4 py-3 font-black uppercase tracking-wider text-slate-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={applyingCoupon || couponCode.trim().length < 4}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applyingCoupon ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <TicketCheck className="h-5 w-5" />
                  )}
                  Apply
                </button>
              </div>
              {couponMessage ? (
                <p
                  role="status"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-700"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {couponMessage}
                </p>
              ) : null}
              {error ? (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                  Due today
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-950">
                  €0.00
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-blue-700">
                  After 7 days
                </p>
                <p className="mt-1 text-2xl font-black text-blue-950">
                  {formatEuroCents(discountedRecurringTotalCents)}/{selectedPeriodLabel}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• Includes up to two child devices</li>
              <li>
                • Recurs {billingInterval === "YEARLY" ? "yearly" : "monthly"} until cancelled
              </li>
              <li>• Taxes and final total shown in secure checkout</li>
              <li>• Manage or cancel online at any time</li>
            </ul>
          </section>

          {!checkoutConfigured ? (
            <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <AlertCircle className="h-7 w-7 text-amber-600" />
              <h2 className="mt-3 font-black text-amber-900">
                Checkout setup pending
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                No payment can be collected yet. The operator must finish
                Paddle account verification and add the approved client token
                and the selected {selectedPeriodLabel}ly recurring price IDs
                to the production environment. Extra-child prices are required
                only when extra slots are selected.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-7 space-y-4">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(event) =>
                      setLegalAccepted(event.target.checked)
                    }
                    className="mt-1 h-5 w-5"
                  />
                  <span className="text-sm leading-6 text-slate-700">
                    I am at least 18 and agree to the{" "}
                    <Link className="font-bold text-blue-600 underline" href="/terms">
                      Terms
                    </Link>
                    ,{" "}
                    <Link className="font-bold text-blue-600 underline" href="/privacy">
                      Privacy Policy
                    </Link>{" "}
                    and recurring {selectedPeriodLabel}ly billing shown at checkout.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={earlyStartAccepted}
                    onChange={(event) =>
                      setEarlyStartAccepted(event.target.checked)
                    }
                    className="mt-1 h-5 w-5"
                  />
                  <span className="text-sm leading-6 text-slate-700">
                    I expressly request KidsGuard service to begin during the
                    14-day withdrawal period and understand that, if I
                    withdraw, I may owe the proportionate amount for service
                    already supplied, where permitted by law.
                  </span>
                </label>
              </div>

              <button
                onClick={openCheckout}
                disabled={
                  !checkoutConfigured ||
                  !sdkReady ||
                  !legalAccepted ||
                  !earlyStartAccepted ||
                  opening
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {opening ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-5 w-5" />
                )}
                Continue to Secure Checkout
              </button>
            </>
          )}

          <div className="mt-7 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              Payment details are entered only in Paddle&apos;s secure checkout.
            </div>
            <p className="mt-3 border-t border-emerald-200 pt-3">
              Need help? Email{" "}
              <a
                href="mailto:arifhasnat07@gmail.com?subject=KidsGuard%20Subscription%20Support"
                className="font-black text-emerald-900 underline"
              >
                arifhasnat07@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
