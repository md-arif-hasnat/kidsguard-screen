"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import { auth } from "@/lib/firebase";
import { FamilyRole } from "@/lib/repositories/FamilyRepository";
import {
  BillingInterval,
  MONTHLY_PRICE_CENTS,
  YEARLY_PRICE_CENTS,
  YEARLY_SAVINGS_CENTS,
  YEARLY_SAVINGS_PERCENT,
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
          settings: {
            successUrl: string;
            displayMode: "overlay";
            theme: "light";
            locale: string;
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
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [earlyStartAccepted, setEarlyStartAccepted] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && role !== FamilyRole.OWNER) {
      router.replace("/");
    }
  }, [loading, role, router]);

  const selectedPriceId =
    billingInterval === "YEARLY" ? yearlyPriceId : monthlyPriceId;
  const selectedPriceCents =
    billingInterval === "YEARLY"
      ? YEARLY_PRICE_CENTS
      : MONTHLY_PRICE_CENTS;
  const selectedPeriodLabel =
    billingInterval === "YEARLY" ? "year" : "month";
  const sdkConfigured = Boolean(
    clientToken && (monthlyPriceId || yearlyPriceId)
  );
  const checkoutConfigured = Boolean(clientToken && selectedPriceId);
  const parentUid =
    profile?.uid || auth?.currentUser?.uid || "";
  const familyId =
    family?.familyId ||
    profile?.activeFamilyId ||
    profile?.ownedFamilyId ||
    profile?.familyId ||
    profile?.familyIds?.[0] ||
    "";

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
      window.Paddle.Checkout.open({
        items: [{ priceId: selectedPriceId, quantity: 1 }],
        customData: {
          parentUid,
          familyId,
          product: "kidsguard_family",
          billingInterval,
        },
        settings: {
          successUrl: `${window.location.origin}/manage-subscription?checkout=success`,
          displayMode: "overlay",
          theme: "light",
          locale: "en",
        },
      });
    } catch (checkoutError) {
      console.error("Paddle checkout failed", checkoutError);
      setError("Secure checkout could not be opened.");
    } finally {
      setOpening(false);
    }
  };

  if (loading || role !== FamilyRole.OWNER) {
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
              7-day trial, then {formatEuroCents(selectedPriceCents)}/
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
                className={`rounded-xl border-2 p-4 text-left transition ${
                  billingInterval === "MONTHLY"
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Monthly
                </span>
                <span className="mt-1 block text-2xl font-black text-slate-950">
                  €3.49
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
                <span className="mt-1 block text-2xl font-black text-slate-950">
                  €35.99
                  <span className="text-sm font-bold text-slate-500">/year</span>
                </span>
                <span className="mt-1 block text-xs font-bold text-emerald-700">
                  Save {formatEuroCents(YEARLY_SAVINGS_CENTS)} per year
                </span>
              </button>
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
                  {formatEuroCents(selectedPriceCents)}/{selectedPeriodLabel}
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
                and the selected {selectedPeriodLabel}ly recurring price ID
                to the production environment.
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

              {error && (
                <div className="mt-5 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {error}
                </div>
              )}

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
