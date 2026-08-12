"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { observeAuth } from "@/lib/auth";
import { FamilyRepository } from "@/lib/repositories/FamilyRepository";

export default function DeleteAccountPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] =
    useState(false);
  const [isSignedIn, setIsSignedIn] =
    useState(false);
  const [confirmed, setConfirmed] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [success, setSuccess] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = observeAuth((user) => {
      setIsSignedIn(Boolean(user));
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  const requestDeletion = async () => {
    if (!confirmed || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result =
        await FamilyRepository.requestFamilyDeletion();

      if (!result) {
        throw new Error(
          "The deletion request could not be completed."
        );
      }

      setSuccess(true);
    } catch (requestError: any) {
      setError(
        requestError?.message ||
          "The deletion request failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Shield className="mb-4 h-12 w-12 text-blue-600" />
          <h1 className="text-3xl font-black text-slate-900">
            Delete KidsGuard Account
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
            Request permanent deletion of your family
            account and associated data.
          </p>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <h2 className="font-black text-emerald-800">
              Deletion Scheduled
            </h2>
            <p className="mt-2 text-sm font-medium leading-6 text-emerald-700">
              Your family account is scheduled for
              permanent deletion in 30 days. Sign in
              again during this period to cancel the
              deletion.
            </p>
          </div>
        ) : !isSignedIn ? (
          <div className="space-y-5 text-center">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
              <p className="text-sm font-bold leading-6 text-amber-800">
                Sign in with the Family Owner account
                before requesting deletion.
              </p>
            </div>

            <button
              onClick={() => {
                sessionStorage.setItem(
                  "kidsguard_return_after_login",
                  "/delete-account"
                );
                router.push("/login");
              }}
              className="w-full rounded-xl bg-blue-600 px-5 py-4 text-sm font-black uppercase tracking-wider text-white hover:bg-blue-700"
            >
              Sign In to Continue
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
                <div>
                  <h2 className="font-black text-rose-800">
                    Important Warning
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-rose-700">
                    Only the Family Owner can request
                    deletion. Your family account,
                    connected children and associated
                    data will be permanently deleted
                    after 30 days.
                  </p>
                </div>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) =>
                  setConfirmed(event.target.checked)
                }
                className="mt-1 h-5 w-5"
              />
              <span className="text-sm font-bold leading-6 text-slate-700">
                I understand that the deletion becomes
                permanent after 30 days.
              </span>
            </label>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {error}
              </div>
            )}

            <button
              disabled={!confirmed || submitting}
              onClick={requestDeletion}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-4 text-sm font-black uppercase tracking-wider text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              Schedule Account Deletion
            </button>
          </div>
        )}

        <div className="mt-8 border-t border-slate-100 pt-6 text-center">
          <Link
            href="/privacy"
            className="text-sm font-bold text-blue-600 hover:underline"
          >
            View Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}