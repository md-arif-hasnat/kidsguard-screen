"use client";

import { useState } from "react";
import Link from "next/link";
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
import { FamilyRepository } from "@/lib/repositories/FamilyRepository";

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

export default function ManageSubscriptionPage() {
  const { family, loading } = useParentProfile();
  const [working, setWorking] = useState(false);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscription = family?.subscription;
  const status = String(subscription?.status || "NONE").toUpperCase();
  const cancellationScheduled =
    subscription?.cancelAtPeriodEnd === true && !kept;
  const ended =
    status === "CANCELED" ||
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "NONE";
  const effectiveDate = formatDate(
    subscription?.cancellationEffectiveAt ||
      subscription?.currentPeriodEndsAt
  );

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

  if (loading) {
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

          {kept ? (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-3 text-xl font-black text-emerald-900">
                Your subscription will remain active
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                The scheduled cancellation has been withdrawn. Your current
                subscription and renewal settings remain active.
              </p>
            </section>
          ) : cancellationScheduled ? (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <CalendarClock className="h-10 w-10 text-amber-600" />
              <h2 className="mt-3 text-xl font-black text-amber-900">
                Cancellation scheduled
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                Your subscription is scheduled to end on {effectiveDate}.
                You can keep the subscription before that date.
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
                Subscription inactive
              </h2>
              <p className="mt-2 text-sm leading-6 text-blue-800">
                Start a new subscription to restore paid KidsGuard access.
              </p>
              <a
                href="mailto:anish.jmc07@yahoo.com?subject=KidsGuard%20Subscribe%20Again"
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-4 font-black text-white hover:bg-blue-700"
              >
                Subscribe Again
              </a>
              <p className="mt-3 text-center text-xs text-blue-700">
                Online checkout will replace this contact action when the
                payment provider is connected.
              </p>
            </section>
          ) : (
            <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <h2 className="mt-3 text-xl font-black text-emerald-900">
                Subscription active
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                Your KidsGuard subscription is active. You can submit a clear
                cancellation request at any time.
              </p>
              <Link
                href="/cancel-subscription"
                className="mt-6 flex w-full items-center justify-center rounded-xl border-2 border-rose-200 bg-white px-5 py-4 font-black text-rose-600 hover:bg-rose-50"
              >
                Cancel Subscription
              </Link>
            </section>
          )}

          <div className="mt-8 grid gap-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Current status
              </p>
              <p className="mt-1 font-bold text-slate-900">{status}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Billing
              </p>
              <p className="mt-1 font-bold text-slate-900">
                {subscription?.billingInterval || "Not configured"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
