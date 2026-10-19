"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Chrome,
  Clipboard,
  KeyRound,
  Loader2,
  Shield,
  Smartphone,
} from "lucide-react";
import { signOut as firebaseSignOut, User } from "firebase/auth";
import type { MultiFactorResolver } from "firebase/auth";

import {
  AdminTotpEnrollment,
  completeAdminTotpEnrollment,
  createAdminTotpEnrollment,
  getAdminMfaResolver,
  hasCurrentAdminTotpSignIn,
  hasEnrolledAdminTotp,
  isAdminMfaChallenge,
  resolveAdminTotpChallenge,
} from "@/lib/adminMfa";
import { loginWithEmail, loginWithGoogle, observeAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { PlatformAdminRepository } from "@/lib/repositories/PlatformAdminRepository";

type LoginView = "login" | "challenge" | "enroll";

function friendlyAuthError(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return error instanceof Error ? error.message : "Authentication failed.";
  }

  switch (String(error.code)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/invalid-verification-code":
      return "That authenticator code is invalid or expired.";
    case "auth/operation-not-allowed":
      return "TOTP 2FA is not enabled for this Firebase project yet.";
    default:
      return error instanceof Error ? error.message : "Authentication failed.";
  }
}

export default function InternalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [view, setView] = useState<LoginView>("login");
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [enrollment, setEnrollment] = useState<AdminTotpEnrollment | null>(null);
  const [enrollmentUser, setEnrollmentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = observeAuth(async user => {
      if (!user) return;

      try {
        const [isAdmin, mfaVerified] = await Promise.all([
          PlatformAdminRepository.isAdmin(user.uid),
          hasCurrentAdminTotpSignIn(user),
        ]);
        if (!cancelled && isAdmin && mfaVerified) {
          router.replace("/internal");
        }
      } catch {
        // The explicit sign-in action below presents actionable errors.
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  const prepareAuthorizedUser = async (user: User) => {
    const isAdmin = await PlatformAdminRepository.isAdmin(user.uid);
    if (!isAdmin) {
      if (auth) await firebaseSignOut(auth);
      throw new Error("Access denied: this account is not an active platform administrator.");
    }

    if (!hasEnrolledAdminTotp(user)) {
      const nextEnrollment = await createAdminTotpEnrollment(user);
      setEnrollmentUser(user);
      setEnrollment(nextEnrollment);
      setCode("");
      setView("enroll");
      return;
    }

    if (!(await hasCurrentAdminTotpSignIn(user, true))) {
      if (auth) await firebaseSignOut(auth);
      throw new Error("Sign in again and complete the authenticator challenge.");
    }

    router.replace("/internal");
  };

  const handleMfaChallenge = (caught: unknown): boolean => {
    if (!isAdminMfaChallenge(caught)) return false;

    try {
      setResolver(getAdminMfaResolver(caught));
      setCode("");
      setView("challenge");
      return true;
    } catch (resolverError) {
      setError(friendlyAuthError(resolverError));
      return true;
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const user = await loginWithEmail(email.trim(), password);
      if (!user) throw new Error("Authentication is not configured.");
      await prepareAuthorizedUser(user);
    } catch (caught) {
      if (!handleMfaChallenge(caught)) {
        setError(friendlyAuthError(caught));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const user = await loginWithGoogle();
      if (!user) throw new Error("Authentication is not configured.");
      await prepareAuthorizedUser(user);
    } catch (caught) {
      if (!handleMfaChallenge(caught)) {
        setError(friendlyAuthError(caught));
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyChallenge = async (event: FormEvent) => {
    event.preventDefault();
    if (!resolver) return;
    setLoading(true);
    setError(null);

    try {
      const user = await resolveAdminTotpChallenge(resolver, code);
      await prepareAuthorizedUser(user);
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setLoading(false);
    }
  };

  const finishEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    if (!enrollment || !enrollmentUser || !auth) return;
    setLoading(true);
    setError(null);

    try {
      await completeAdminTotpEnrollment(enrollmentUser, enrollment, code);
      await firebaseSignOut(auth);
      setEnrollment(null);
      setEnrollmentUser(null);
      setPassword("");
      setCode("");
      setView("login");
      setSuccess("2FA is active. Sign in once more and enter your authenticator code.");
    } catch (caught) {
      setError(friendlyAuthError(caught));
    } finally {
      setLoading(false);
    }
  };

  const returnToLogin = async () => {
    if (auth?.currentUser) await firebaseSignOut(auth);
    setResolver(null);
    setEnrollment(null);
    setEnrollmentUser(null);
    setCode("");
    setError(null);
    setView("login");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6">
      <div className="absolute right-0 top-0 h-96 w-96 -mr-48 -mt-48 rounded-full bg-rose-500/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-96 w-96 -mb-48 -ml-48 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/20">
            <Shield className="text-rose-500" size={32} aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-black uppercase italic tracking-tight text-white">
            Platform <span className="text-rose-500">Internal</span>
          </h1>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Password + authenticator protected
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-8">
          {error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
              <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}
          {success && (
            <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
              <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              <p className="text-xs font-bold leading-relaxed">{success}</p>
            </div>
          )}

          {view === "login" && (
            <>
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-1.5">
                  <label htmlFor="admin-email" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Work email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3.5 text-sm font-medium text-white outline-none transition-all focus:ring-2 focus:ring-rose-500"
                    placeholder="admin@kidsguard.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="admin-password" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3.5 text-sm font-medium text-white outline-none transition-all focus:ring-2 focus:ring-rose-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <PrimaryButton loading={loading} label="Authenticate" />
              </form>

              <div className="mt-8 border-t border-slate-800 pt-8">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 py-3.5 font-bold text-white transition-all hover:bg-slate-700 disabled:opacity-50"
                >
                  <Chrome size={20} aria-hidden="true" />
                  Sign in with Google
                </button>
              </div>
            </>
          )}

          {view === "challenge" && (
            <form onSubmit={verifyChallenge} className="space-y-6">
              <SecurityHeading
                icon={KeyRound}
                title="Two-factor verification"
                description="Open your authenticator app and enter the current code."
              />
              <TotpCodeInput code={code} setCode={setCode} />
              <PrimaryButton loading={loading} label="Verify and continue" />
              <BackButton onClick={returnToLogin} />
            </form>
          )}

          {view === "enroll" && enrollment && (
            <form onSubmit={finishEnrollment} className="space-y-6">
              <SecurityHeading
                icon={Smartphone}
                title="Secure this admin account"
                description="Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app."
              />
              <div className="mx-auto w-fit rounded-2xl bg-white p-3">
                <Image
                  src={enrollment.qrCodeDataUrl}
                  alt="Authenticator setup QR code"
                  width={224}
                  height={224}
                  unoptimized
                  priority
                />
              </div>
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Manual setup key
                </p>
                <button
                  type="button"
                  onClick={copySecret}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left"
                >
                  <code className="min-w-0 break-all text-xs font-bold tracking-wider text-slate-300">
                    {enrollment.secretKey}
                  </code>
                  {copied ? <CheckCircle2 className="shrink-0 text-emerald-400" size={18} /> : <Clipboard className="shrink-0 text-slate-500" size={18} />}
                </button>
              </div>
              <TotpCodeInput code={code} setCode={setCode} />
              <PrimaryButton loading={loading} label="Enable 2FA" />
              <BackButton onClick={returnToLogin} />
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] font-bold uppercase leading-loose tracking-widest text-slate-600">
          A new browser must pass two-factor verification.<br />
          System access is logged and monitored.
        </p>
      </div>
    </div>
  );
}

function TotpCodeInput({
  code,
  setCode,
}: {
  code: string;
  setCode: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="totp-code" className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
        6-digit code
      </label>
      <input
        id="totp-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-4 text-center text-2xl font-black tracking-[0.45em] text-white outline-none transition-all focus:ring-2 focus:ring-rose-500"
        placeholder="000000"
        required
        autoFocus
      />
    </div>
  );
}

function SecurityHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400">
        <Icon size={23} aria-hidden="true" />
      </div>
      <h2 className="text-lg font-black uppercase tracking-tight text-white">{title}</h2>
      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

function PrimaryButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-4 font-black uppercase italic tracking-wider text-white shadow-xl shadow-rose-900/20 transition-all hover:bg-rose-700 disabled:opacity-50"
    >
      {loading ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : (
        <>
          {label}
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-slate-300"
    >
      <ArrowLeft size={15} aria-hidden="true" />
      Back to sign in
    </button>
  );
}
