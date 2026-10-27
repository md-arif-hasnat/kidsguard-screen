"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
  RotateCcw,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import {
  FamilyRepository,
  FamilyRole,
} from "@/lib/repositories/FamilyRepository";
import {
  EXTRA_CHILD_MONTHLY_PRICE_CENTS,
  EXTRA_CHILD_YEARLY_PRICE_CENTS,
  MONTHLY_PRICE_CENTS,
  YEARLY_PRICE_CENTS,
  formatEuroCents,
} from "@/lib/billing/pricing";

function formatDate(value: any): string {
  if (!value) return "the end of the current billing period";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "the end of the current billing period";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function timestampMillis(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ManageSubscriptionPage() {
  const router = useRouter();
  const { family, loading, role } = useParentProfile();
  const [working, setWorking] = useState(false);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && role !== FamilyRole.OWNER) {
      router.replace("/");
    }
  }, [loading, role, router]);

  const subscription = family?.subscription;
  const status = String(subscription?.status || "NONE").toUpperCase();
  const isGooglePlaySubscription =
    subscription?.provider === "GOOGLE_PLAY";
  const isPromotionalAccess =
    subscription?.provider === "PROMO" && status === "ACTIVE";
  const promoAccessEndsAt = timestampMillis(subscription?.promoAccessEndsAt);
  const promotionalAccessExpired =
    isPromotionalAccess &&
    promoAccessEndsAt !== null &&
    promoAccessEndsAt <= now;
  // New parent families are provisioned with PENDING before they ever open
  // or complete Paddle checkout. Treat that as "not subscribed" instead of
  // showing paid subscription controls.
  const neverSubscribed = status === "NONE" || status === "PENDING";
  const subscribedAt = timestampMillis(subscription?.subscribedAt);
  const isTrial = status === "TRIAL" || status === "TRIALING";
  const calculatedTrialEnd =
    isTrial && subscribedAt !== null
      ? subscribedAt + 7 * 24 * 60 * 60 * 1000
      : null;
  const cancellationEffectiveAt = timestampMillis(
    subscription?.cancellationEffectiveAt ||
      (isTrial ? subscription?.trialEndsAt : null) ||
      subscription?.currentPeriodEndsAt ||
      subscription?.nextBilledAt ||
      calculatedTrialEnd
  );
  const cancellationTimePassed =
    cancellationEffectiveAt !== null && cancellationEffectiveAt <= now;
  const ended =
    status === "CANCELED" ||
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    promotionalAccessExpired ||
    cancellationTimePassed ||
    neverSubscribed;
  const cancellationRequested =
    subscription?.cancellationStatus === "PENDING_PROVIDER_CONFIRMATION";
  const cancellationScheduled =
    !ended &&
    !cancellationTimePassed &&
    !kept &&
    (subscription?.cancelAtPeriodEnd === true || cancellationRequested);
  const cancellationPendingProvider =
    subscription?.cancelAtPeriodEnd !== true &&
    subscription?.cancellationStatus === "PENDING_PROVIDER_CONFIRMATION";
  const effectiveDate = formatDate(
    subscription?.cancellationEffectiveAt ||
      (isTrial ? subscription?.trialEndsAt : null) ||
      subscription?.currentPeriodEndsAt ||
      subscription?.nextBilledAt ||
      calculatedTrialEnd
  );
  const firstChargeAt = formatDate(
    subscription?.trialEndsAt ||
      subscription?.nextBilledAt ||
      calculatedTrialEnd
  );
  const nextChargeAt = formatDate(
    subscription?.nextBilledAt ||
      subscription?.currentPeriodEndsAt
  );
  const billingInterval =
    subscription?.billingInterval === "YEARLY" ? "YEARLY" : "MONTHLY";
  const billingPeriodLabel =
    billingInterval === "YEARLY" ? "yearly" : "monthly";
  const billedPriceCents =
    typeof subscription?.basePriceCents === "number"
      ? subscription.basePriceCents
      : billingInterval === "YEARLY"
        ? YEARLY_PRICE_CENTS
        : MONTHLY_PRICE_CENTS;
  const billedPriceLabel = formatEuroCents(billedPriceCents);
  const baseChildSlots = Math.max(2, Number(subscription?.baseChildSlots || 2));
  const extraChildSlots = Math.max(
    0,
    Number(subscription?.extraChildSlots || 0)
  );
  const storedExtraChildPriceCents =
    typeof subscription?.extraChildPriceCents === "number"
      ? subscription.extraChildPriceCents
      : 0;
  // Older family documents store the monthly 199-cent default even after a
  // parent selects yearly billing. Ignore that legacy value for yearly plans.
  const extraChildUnitPriceCents =
    billingInterval === "YEARLY"
      ? storedExtraChildPriceCents >= 1000
        ? storedExtraChildPriceCents
        : EXTRA_CHILD_YEARLY_PRICE_CENTS
      : storedExtraChildPriceCents > 0 && storedExtraChildPriceCents < 1000
        ? storedExtraChildPriceCents
        : EXTRA_CHILD_MONTHLY_PRICE_CENTS;
  const providerAddOns = Array.isArray(subscription?.recurringAddOns)
    ? subscription.recurringAddOns.filter(
        (item) =>
          item &&
          typeof item.key === "string" &&
          typeof item.name === "string" &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0 &&
          Number.isInteger(item.unitPriceCents) &&
          item.unitPriceCents > 0
      )
    : [];
  const recurringAddOns = providerAddOns.length > 0
    ? providerAddOns
    : extraChildSlots > 0
      ? [{
          key: "extra_child_slot",
          name: "Extra child slot",
          priceId: "",
          quantity: extraChildSlots,
          unitPriceCents: extraChildUnitPriceCents,
          currency: "EUR",
          billingInterval,
        }]
      : [];
  const addOnTotalCents = recurringAddOns.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0
  );
  const recurringTotalCents = billedPriceCents + addOnTotalCents;
  const recurringTotalLabel = formatEuroCents(recurringTotalCents);

  const keepSubscription = async () => {
    setWorking(true);
    setError(null);

    try {
      const response =
        await FamilyRepository.resumeScheduledSubscription();

      if (!response.success) {
        throw new Error("The subscription could not be kept active.");
      }

      setKept(true);
    } catch (keepError: any) {
      setError(
        keepError?.message ||
          "The cancellation could not be undone."
      );
    } finally {
      setWorking(false);
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
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <CreditCard className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">
                Manage Subscription
              </h1>
              <p className="mt-2 text-slate-500">
                Review, keep, cancel or restart your KidsGuard subscription.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-7 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {isGooglePlaySubscription ? (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-3 text-xl font-black text-emerald-900">
                Google Play subscription {ended ? "inactive" : "active"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                Google Play securely manages payment, renewal and cancellation
                for this family subscription.
              </p>
              <a
                href={`https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(
                  subscription?.googlePlayProductId || "kidsguard_family"
                )}&package=secure.kidsguard.app`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 flex w-full items-center justify-center rounded-xl border-2 border-emerald-200 bg-white px-5 py-4 font-black text-emerald-700 hover:bg-emerald-100"
              >
                Manage in Google Play
              </a>
            </section>
          ) : isPromotionalAccess && !promotionalAccessExpired ? (
            <section className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-6">
              <CheckCircle2 className="h-10 w-10 text-violet-600" />
              <h2 className="mt-3 text-xl font-black text-violet-950">
                Promotional access active
              </h2>
              <p className="mt-2 text-sm leading-6 text-violet-800">
                Coupon <strong>{subscription?.promoCode || "PROMO"}</strong>{" "}
                gives this family full KidsGuard access{" "}
                {promoAccessEndsAt
                  ? `until ${formatDate(promoAccessEndsAt)}.`
                  : "while the promotion remains active."}
              </p>
              <p className="mt-3 text-xs font-bold text-violet-700">
                No payment method is charged for this promotional access.
              </p>
              <Link
                href="/subscribe"
                className="mt-6 flex w-full items-center justify-center rounded-xl border-2 border-violet-200 bg-white px-5 py-4 font-black text-violet-700 hover:bg-violet-100"
              >
                Switch to a Paid Subscription
              </Link>
            </section>
          ) : kept ? (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-3 text-xl font-black text-emerald-900">
                Subscription active
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                The cancellation has been withdrawn. Your subscription will
                remain active and continue renewing normally.
              </p>
              <Link
                href="/cancel-subscription"
                className="mt-6 flex w-full items-center justify-center rounded-xl border-2 border-rose-200 bg-white px-5 py-4 font-black text-rose-600 hover:bg-rose-50"
              >
                Cancel Subscription
              </Link>
            </section>
          ) : cancellationScheduled ? (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <CalendarClock className="h-10 w-10 text-amber-600" />
              <h2 className="mt-3 text-xl font-black text-amber-900">
                {cancellationPendingProvider
                  ? "Cancellation request received"
                  : "Cancellation scheduled"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                {cancellationPendingProvider
                  ? "Your cancellation request has been recorded and is awaiting payment-provider confirmation. You do not need to submit it again."
                  : `Your subscription is scheduled to end on ${effectiveDate}. You can keep the subscription before that date.`}
              </p>

              <button
                disabled={working}
                onClick={keepSubscription}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 font-black text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {working ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RotateCcw className="h-5 w-5" />
                )}
                Keep Subscription
              </button>

              <p className="mt-3 text-center text-xs text-amber-700">
                This cancels the cancellation request, not your subscription.
              </p>
            </section>
          ) : ended ? (
            <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h2 className="text-xl font-black text-blue-950">
                {neverSubscribed
                  ? "Start your subscription"
                  : "Subscription inactive"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-blue-800">
                {neverSubscribed
                  ? "Subscribe to unlock paid KidsGuard access."
                  : "Start a new subscription to restore paid KidsGuard access."}
              </p>
              <Link
                href="/subscribe"
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-4 font-black text-white hover:bg-blue-700"
              >
                {neverSubscribed ? "Subscribe Now" : "Subscribe Again"}
              </Link>
            </section>
          ) : (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-3 text-xl font-black text-emerald-900">
                Subscription active
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                {isTrial
                  ? `€0 due today. Your first ${recurringTotalLabel} ${billingPeriodLabel} charge is scheduled for ${firstChargeAt}.`
                  : `Your KidsGuard subscription is active. Your next ${recurringTotalLabel} ${billingPeriodLabel} charge is scheduled for ${nextChargeAt}.`}
              </p>
              <Link
                href="/cancel-subscription"
                className="mt-6 flex w-full items-center justify-center rounded-xl border-2 border-rose-200 bg-white px-5 py-4 font-black text-rose-600 hover:bg-rose-50"
              >
                Cancel Subscription
              </Link>
            </section>
          )}

          {!neverSubscribed && !isPromotionalAccess && !isGooglePlaySubscription && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-black text-slate-900">
                Recurring billing breakdown
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Paddle bills these items together on one subscription invoice.
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-600">
                    Family Plan · {baseChildSlots} children included
                  </span>
                  <span className="font-bold text-slate-900">
                    {billedPriceLabel}/{billingInterval === "YEARLY" ? "year" : "month"}
                  </span>
                </div>
                {recurringAddOns.map((item) => (
                  <div
                    key={`${item.key}-${item.priceId}`}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-slate-600">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatEuroCents(
                        item.unitPriceCents * item.quantity
                      )}/
                      {billingInterval === "YEARLY" ? "year" : "month"}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 font-black text-slate-950">
                  <span>Total recurring charge</span>
                  <span>
                    {recurringTotalLabel}/
                    {billingInterval === "YEARLY" ? "year" : "month"}
                  </span>
                </div>
              </div>
            </section>
          )}

          <div className="mt-8 grid gap-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Current status
              </p>
              <p className="mt-1 font-bold text-slate-900">
                {promotionalAccessExpired ? "EXPIRED" : status}
              </p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Billing
              </p>
              <p className="mt-1 font-bold text-slate-900">
                {isPromotionalAccess
                  ? "PROMOTIONAL ACCESS"
                  : isGooglePlaySubscription
                    ? `GOOGLE PLAY · ${subscription?.billingInterval || "PLAN"}`
                    : subscription?.billingInterval || "Not configured"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
