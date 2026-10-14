"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { observeAuth } from "@/lib/auth";
import {
  FamilyRepository,
  FamilyRole,
} from "@/lib/repositories/FamilyRepository";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import LegalFooter from "@/components/LegalFooter";

export default function CancelSubscriptionPage() {
  const router = useRouter();
  const { role, loading: profileLoading } = useParentProfile();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    requestId: string | null;
    pendingProviderConfirmation: boolean;
    alreadyCanceled: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return observeAuth((user) => {
      setIsSignedIn(Boolean(user));
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (
      authChecked &&
      isSignedIn &&
      !profileLoading &&
      role !== FamilyRole.OWNER
    ) {
      router.replace("/");
    }
  }, [authChecked, isSignedIn, profileLoading, role, router]);

  const submitCancellation = async () => {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response =
        await FamilyRepository.requestSubscriptionCancellation(reason);
      setResult({
        requestId: response.requestId,
        pendingProviderConfirmation:
          response.pendingProviderConfirmation,
        alreadyCanceled: response.alreadyCanceled,
      });
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "The cancellation request could not be submitted."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (
    !authChecked ||
    (isSignedIn && (profileLoading || role !== FamilyRole.OWNER))
  ) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl md:p-10">
        <ShieldCheck className="h-12 w-12 text-blue-400" />
        <h1 className="mt-5 text-3xl font-black text-white">
          Cancel KidsGuard Subscription
        </h1>
        <p className="mt-3 leading-7 text-slate-400">
          Submit a clear cancellation request without contacting support.
          The Family Owner must sign in so we can identify the correct
          subscription and provide a cancellation record.
        </p>

        {result ? (
          <div className="mt-8 rounded-2xl border border-emerald-700 bg-emerald-950/40 p-6">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <h2 className="mt-3 text-xl font-bold text-emerald-200">
              {result.alreadyCanceled
                ? "Cancellation already scheduled"
                : "Cancellation request recorded"}
            </h2>
            <p className="mt-2 leading-6 text-emerald-100/80">
              {result.alreadyCanceled
                ? "No duplicate request was created. Your existing cancellation remains active."
                : "Your request has been timestamped and linked to your family subscription."}
            </p>
            {result.requestId && (
              <p className="mt-3 break-all text-xs text-emerald-300">
                Confirmation: {result.requestId}
              </p>
            )}
            <Link
              href="/"
              className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600"
            >
              Return to Dashboard
            </Link>
            {result.pendingProviderConfirmation && (
              <p className="mt-4 rounded-xl bg-amber-950/60 p-4 text-sm text-amber-200">
                Payment-provider confirmation is pending. Keep this
                confirmation number; the operator must complete provider-side
                cancellation before another renewal.
              </p>
            )}
          </div>
        ) : !isSignedIn ? (
          <div className="mt-8 rounded-2xl border border-amber-700 bg-amber-950/40 p-6">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="mt-3 text-amber-100">
              Sign in with the Family Owner account to continue.
            </p>
            <button
              onClick={() => {
                sessionStorage.setItem(
                  "kidsguard_return_after_login",
                  "/cancel-subscription"
                );
                router.push("/login");
              }}
              className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-4 font-black text-white hover:bg-blue-700"
            >
              Sign In to Cancel
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-5">
              <h2 className="font-bold text-white">Before you continue</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                <li>The request applies to the signed-in family subscription.</li>
                <li>No new renewal should be taken after the effective cancellation date.</li>
                <li>Mandatory consumer and withdrawal rights remain unaffected.</li>
              </ul>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-slate-300">
                Reason (optional)
              </span>
              <textarea
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-white outline-none focus:border-blue-500"
                placeholder="Tell us why you are cancelling"
              />
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 p-4">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span className="text-sm font-semibold leading-6">
                I clearly request cancellation of my KidsGuard subscription.
              </span>
            </label>

            {error && (
              <p className="rounded-xl border border-rose-700 bg-rose-950/40 p-4 text-sm font-bold text-rose-200">
                {error}
              </p>
            )}

            <button
              disabled={!confirmed || submitting}
              onClick={submitCancellation}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-4 font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
              Confirm Cancellation
            </button>
          </div>
        )}

        <section className="mt-10 border-t border-slate-800 pt-7">
          <h2 className="text-xl font-bold text-white">
            Withdrawal information
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Consumers may have a statutory right to withdraw from a distance
            service contract within 14 days. Any request to begin full digital
            service during that period and any effect on the withdrawal right
            must be presented separately at checkout. KidsGuard does not limit
            rights that cannot legally be excluded.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            See the{" "}
            <Link className="text-blue-400 underline" href="/terms">
              Terms of Service
            </Link>{" "}
            or contact{" "}
            <a className="text-blue-400 underline" href="mailto:anish.jmc07@yahoo.com">
              anish.jmc07@yahoo.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-2xl">
        <LegalFooter dark />
      </div>
    </main>
  );
}
