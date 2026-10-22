"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Clipboard,
  Database,
  KeyRound,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";

import InternalLayout from "@/components/InternalLayout";
import {
  AdminTotpEnrollment,
  completeAdminTotpEnrollment,
  createAdminTotpEnrollment,
  hasEnrolledAdminTotp,
} from "@/lib/adminMfa";
import { useInternalAdmin } from "@/lib/context/InternalAdminContext";
import { auth } from "@/lib/firebase";
import { isFullPlatformAdmin } from "@/lib/platformAccess";

const checks = [
  {
    title: "Session protection",
    description: "Internal access ends after 30 minutes idle, 8 hours total, or when the browser session closes.",
    icon: Clock3,
  },
  {
    title: "Role-based access",
    description: "Each internal role can access only the tools and data assigned to it.",
    icon: ShieldCheck,
  },
  {
    title: "Error reporting",
    description: "Child error reports are sanitized before cloud upload.",
    icon: Wrench,
  },
  {
    title: "Data retention",
    description: "Scheduled cleanup includes expired child error reports.",
    icon: Database,
  },
];

function friendlyEnrollmentError(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (String(error.code) === "auth/requires-recent-login") {
      return "For security, sign out, sign in again, and then enable 2FA.";
    }
    if (String(error.code) === "auth/invalid-verification-code") {
      return "That authenticator code is invalid or expired.";
    }
  }
  return error instanceof Error ? error.message : "Could not enable 2FA.";
}

export default function InternalSettingsPage() {
  const { admin } = useInternalAdmin();
  const [totpEnrolled, setTotpEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<AdminTotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mandatory = Boolean(admin && isFullPlatformAdmin(admin.role));

  useEffect(() => {
    const user = auth?.currentUser;
    setTotpEnrolled(Boolean(user && hasEnrolledAdminTotp(user)));
  }, [admin]);

  const startEnrollment = async () => {
    const user = auth?.currentUser;
    if (!user) {
      setError("Your session has expired. Sign in again.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (hasEnrolledAdminTotp(user)) {
        setTotpEnrolled(true);
        return;
      }
      setEnrollment(await createAdminTotpEnrollment(user));
      setCode("");
    } catch (caught) {
      setError(friendlyEnrollmentError(caught));
    } finally {
      setLoading(false);
    }
  };

  const finishEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    const user = auth?.currentUser;
    if (!user || !enrollment) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await completeAdminTotpEnrollment(user, enrollment, code);
      setTotpEnrolled(true);
      setEnrollment(null);
      setCode("");
      setSuccess("2FA is enabled. Your next sign-in will require an authenticator code.");
    } catch (caught) {
      setError(friendlyEnrollmentError(caught));
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secretKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy failed. Select and copy the setup key manually.");
    }
  };

  return (
    <InternalLayout>
      <header className="mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tight text-white">
          Internal <span className="text-rose-500">Settings</span>
        </h1>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Platform configuration and security status
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-xl lg:col-span-2 xl:col-span-1">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-rose-500">
              <KeyRound size={23} />
            </div>
            <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${totpEnrolled ? "text-emerald-400" : "text-amber-300"}`}>
              {totpEnrolled ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {totpEnrolled ? "Enabled" : mandatory ? "Required" : "Optional"}
            </span>
          </div>
          <h2 className="text-base font-black uppercase tracking-tight text-white">
            Authenticator 2FA
          </h2>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
            {mandatory
              ? "2FA is mandatory for admin roles and must be completed on every new sign-in."
              : "2FA is optional for your role. Enable it for extra protection on every sign-in."}
          </p>
          {!totpEnrolled && !enrollment ? (
            <button
              type="button"
              onClick={startEnrollment}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={17} /> : <Smartphone size={17} />}
              Enable 2FA
            </button>
          ) : null}
        </article>

        {checks.map(({ title, description, icon: Icon }) => (
          <article key={title} className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-rose-500">
                <Icon size={23} />
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                <CheckCircle2 size={14} /> Active
              </span>
            </div>
            <h2 className="text-base font-black uppercase tracking-tight text-white">{title}</h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
          </article>
        ))}
      </section>

      {error ? (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
          <AlertCircle className="mt-0.5 shrink-0" size={18} />
          <p className="text-xs font-bold leading-relaxed">{error}</p>
        </div>
      ) : null}

      {success ? (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          <p className="text-xs font-bold leading-relaxed">{success}</p>
        </div>
      ) : null}

      {enrollment ? (
        <form onSubmit={finishEnrollment} className="mt-6 max-w-2xl rounded-3xl border border-rose-500/20 bg-slate-900 p-7 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-black uppercase tracking-tight text-white">Set up authenticator 2FA</h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">
              Scan the QR code with Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-[224px_1fr] sm:items-center">
            <div className="w-fit rounded-2xl bg-white p-3">
              <Image
                src={enrollment.qrCodeDataUrl}
                alt="Authenticator setup QR code"
                width={200}
                height={200}
                unoptimized
              />
            </div>
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Manual setup key</p>
                <button
                  type="button"
                  onClick={copySecret}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left"
                >
                  <code className="min-w-0 break-all text-xs font-bold tracking-wider text-slate-300">{enrollment.secretKey}</code>
                  {copied ? <CheckCircle2 className="shrink-0 text-emerald-400" size={18} /> : <Clipboard className="shrink-0 text-slate-500" size={18} />}
                </button>
              </div>
              <div>
                <label htmlFor="settings-totp-code" className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">6-digit code</label>
                <input
                  id="settings-totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-center text-xl font-black tracking-[0.35em] text-white outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="000000"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={17} /> : <ShieldCheck size={17} />}
                  Confirm 2FA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnrollment(null);
                    setCode("");
                    setError(null);
                  }}
                  disabled={loading}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : null}

      <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
        <p className="text-xs font-semibold leading-relaxed text-amber-200/80">
          Runtime configuration changes are intentionally deployment-controlled. This prevents accidental production changes from the browser.
        </p>
      </div>
    </InternalLayout>
  );
}
