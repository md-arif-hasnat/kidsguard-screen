"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  X
} from "lucide-react";
import { requestOwnerEmailChange, signOut } from "@/lib/auth";

type OwnerEmailChangeDialogProps = {
  currentEmail: string;
  open: boolean;
  onClose: () => void;
};

const friendlyEmailChangeError = (error: unknown): string => {
  const authError = error as { code?: string; message?: string };

  switch (authError.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "The current password is incorrect.";
    case "auth/email-already-in-use":
      return "That email address is already connected to another account.";
    case "auth/invalid-email":
      return "Enter a valid new email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "The network request failed. Check your connection and try again.";
    case "auth/requires-recent-login":
      return "Your session is too old. Sign in again before changing the email.";
    case "auth/same-email":
    case "auth/missing-password":
    case "auth/password-provider-required":
    case "auth/user-not-found":
      return authError.message || "The email change could not be started.";
    default:
      return "The email change could not be started. Please try again.";
  }
};

export default function OwnerEmailChangeDialog({
  currentEmail,
  open,
  onClose
}: OwnerEmailChangeDialogProps) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNewEmail("");
      setCurrentPassword("");
      setSubmitting(false);
      setSentTo(null);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const destination = await requestOwnerEmailChange(
        newEmail,
        currentPassword
      );
      setCurrentPassword("");
      setSentTo(destination);
    } catch (requestError) {
      setError(friendlyEmailChangeError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    await signOut();
    window.location.replace("/login");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-owner-email-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-5">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded-xl bg-primary-100 p-2 text-primary-700">
              <ShieldCheck size={21} />
            </div>
            <div>
              <h2
                id="change-owner-email-title"
                className="text-lg font-bold text-slate-900"
              >
                Change owner email
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Available only to the family owner. Your current password is
                required.
              </p>
            </div>
          </div>
          {!sentTo && (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="Close email change dialog"
            >
              <X size={19} />
            </button>
          )}
        </div>

        {sentTo ? (
          <div className="space-y-5 p-6">
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-bold">Verification email sent</p>
                <p className="mt-1 break-all text-sm leading-relaxed">
                  Open the link sent to <strong>{sentTo}</strong>. Until you
                  verify it, <strong>{currentEmail}</strong> remains your login
                  email.
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              After verification, sign in with the new email and your existing
              password. Your family, subscription, settings, history and paired
              child devices remain unchanged.
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 font-bold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
              Sign out and continue
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 p-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Current email
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                {currentEmail}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="owner-new-email"
                className="mx-1 text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                New email address
              </label>
              <div className="relative">
                <Mail
                  className="absolute start-3 top-3 text-slate-400"
                  size={18}
                />
                <input
                  id="owner-new-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-4 ps-10 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                  placeholder="new-email@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="owner-current-password"
                className="mx-1 text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Current password
              </label>
              <div className="relative">
                <KeyRound
                  className="absolute start-3 top-3 text-slate-400"
                  size={18}
                />
                <input
                  id="owner-current-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pe-4 ps-10 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                  placeholder="Enter your current password"
                />
              </div>
            </div>

            {error && (
              <div
                className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
                role="alert"
              >
                <AlertCircle className="mt-0.5 shrink-0" size={17} />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Mail size={17} />
                )}
                {submitting ? "Verifying password..." : "Send verification link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
