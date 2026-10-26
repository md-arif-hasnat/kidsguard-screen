"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
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
import { isAllowedPlatformAdminRole } from "@/lib/repositories/PlatformAdminRepository";
import {
  InternalLoginDefenseRepository,
  isInternalLoginBlockedError,
  isInternalSessionSecurityError,
} from "@/lib/repositories/InternalLoginDefenseRepository";
import { isFullPlatformAdmin } from "@/lib/platformAccess";
import {
  clearInternalSessionActivity,
  getInternalSessionStartedAt,
  isInternalSessionExpired,
  prepareInternalAuthSession,
  signOutInternalSession,
  writeInternalSessionActivity,
} from "@/lib/internalSessionSecurity";

type LoginView = "login" | "challenge" | "enroll";
const BLOCKED_LOGIN_MESSAGE = "Access blocked. Contact your God Father!";

function loginReturnPath(): string {
  if (typeof window === "undefined") return "/internal";
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");
  if (
    returnTo &&
    returnTo.startsWith("/internal") &&
    !returnTo.startsWith("//") &&
    !returnTo.startsWith("/internal/login")
  ) {
    return returnTo;
  }
  return "/internal";
}

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

function isPasswordCredentialError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  return [
    "auth/invalid-credential",
    "auth/wrong-password",
    "auth/user-not-found",
  ].includes(String(error.code));
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
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [guardBlocked, setGuardBlocked] = useState(false);
  const [guardChecking, setGuardChecking] = useState(true);
  const [guardUnavailable, setGuardUnavailable] = useState(false);
  const previousGuardBlocked = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "idle") {
      setSessionNotice("For security, you were signed out after 30 minutes of inactivity.");
    } else if (reason === "expired") {
      setSessionNotice("Your 8-hour internal session ended. Sign in again to continue.");
    } else if (reason === "blocked") {
      setSessionNotice(BLOCKED_LOGIN_MESSAGE);
    } else if (reason === "security") {
      setSessionNotice(
        "Your internal session was revoked because its security context changed. Sign in again; reset your password first if this was not you."
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let firstCheck = true;

    const checkGuard = async () => {
      try {
        const status = await InternalLoginDefenseRepository.getStatus();
        if (cancelled) return;
        setGuardBlocked(status.blocked);
        setGuardUnavailable(false);
        setError(current => current?.startsWith("Login security") ? null : current);
        if (previousGuardBlocked.current && !status.blocked) {
          setError(null);
          setSessionNotice(null);
          setSuccess("This IP was approved. You can sign in again now.");
        }
        previousGuardBlocked.current = status.blocked;
      } catch {
        if (cancelled) return;
        setGuardUnavailable(true);
        setError("Login security check is temporarily unavailable. Try again shortly.");
      } finally {
        if (!cancelled && firstCheck) {
          firstCheck = false;
          setGuardChecking(false);
        }
      }
    };

    void checkGuard();
    const intervalId = window.setInterval(checkGuard, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    void prepareInternalAuthSession()
      .then(() => {
        if (cancelled) return;
        unsubscribe = observeAuth(async user => {
          if (!user) return;

          try {
            const startedAt = await getInternalSessionStartedAt(user);
            if (isInternalSessionExpired(startedAt)) {
              await signOutInternalSession("expired");
              return;
            }

            const profile = await PlatformAdminRepository.getAdminProfile(user.uid);
            const authorized = Boolean(
              profile?.active && isAllowedPlatformAdminRole(profile.role)
            );
            const mfaVerified = authorized && profile
              ? !isFullPlatformAdmin(profile.role) ||
                await hasCurrentAdminTotpSignIn(user)
              : false;
            if (!cancelled && authorized && mfaVerified) {
              await InternalLoginDefenseRepository.finalizeLogin();
              writeInternalSessionActivity(user.uid, Date.now());
              router.replace(loginReturnPath());
            }
          } catch (caught) {
            if (isInternalLoginBlockedError(caught)) {
              setGuardBlocked(true);
              previousGuardBlocked.current = true;
              await signOutInternalSession("blocked");
            } else if (isInternalSessionSecurityError(caught)) {
              await signOutInternalSession("security");
            }
            // The explicit sign-in action below presents actionable errors.
          }
        });
      })
      .catch(caught => {
        if (!cancelled) setError(friendlyAuthError(caught));
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  const prepareAuthorizedUser = async (user: User) => {
    const profile = await PlatformAdminRepository.getAdminProfile(user.uid);
    const authorized = Boolean(
      profile?.active && isAllowedPlatformAdminRole(profile.role)
    );
    if (!authorized || !profile) {
      clearInternalSessionActivity(user.uid);
      if (auth) await firebaseSignOut(auth);
      throw new Error("Access denied: this internal account is not active or approved.");
    }

    if (!isFullPlatformAdmin(profile.role)) {
      await InternalLoginDefenseRepository.finalizeLogin();
      writeInternalSessionActivity(user.uid, Date.now());
      router.replace(loginReturnPath());
      return;
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
      clearInternalSessionActivity(user.uid);
      if (auth) await firebaseSignOut(auth);
      throw new Error("Sign in again and complete the authenticator challenge.");
    }

    await InternalLoginDefenseRepository.finalizeLogin();
    writeInternalSessionActivity(user.uid, Date.now());
    router.replace(loginReturnPath());
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
    if (guardBlocked || guardChecking || guardUnavailable) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await prepareInternalAuthSession();
      const user = await loginWithEmail(email.trim(), password);
      if (!user) throw new Error("Authentication is not configured.");
      await prepareAuthorizedUser(user);
    } catch (caught) {
      if (!handleMfaChallenge(caught)) {
        if (isInternalLoginBlockedError(caught)) {
          setGuardBlocked(true);
          previousGuardBlocked.current = true;
          setError(null);
        } else if (isInternalSessionSecurityError(caught)) {
          await signOutInternalSession("security");
        } else if (isPasswordCredentialError(caught)) {
          try {
            const failure = await InternalLoginDefenseRepository.recordFailure(email);
            if (failure.blocked) {
              setGuardBlocked(true);
              previousGuardBlocked.current = true;
              setError(null);
            } else {
              setError(
                `The email or password is incorrect. ${failure.remainingAttempts} attempt${failure.remainingAttempts === 1 ? "" : "s"} remaining before this IP is blocked.`
              );
            }
          } catch {
            setGuardUnavailable(true);
            setError("Login security service is unavailable. Sign-in is disabled until the check recovers.");
          }
        } else {
          setError(friendlyAuthError(caught));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (guardBlocked || guardChecking || guardUnavailable) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await prepareInternalAuthSession();
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
      clearInternalSessionActivity(enrollmentUser.uid);
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
    if (auth?.currentUser) {
      clearInternalSessionActivity(auth.currentUser.uid);
      await firebaseSignOut(auth);
    }
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
            Secure access for the internal team
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-8">
          {guardBlocked && (
            <div role="alert" className="mb-6 rounded-xl border border-rose-500/50 bg-rose-500/15 p-5 text-center text-rose-200 shadow-lg shadow-rose-950/20">
              <AlertCircle className="mx-auto mb-2" size={24} aria-hidden="true" />
              <p className="text-sm font-black uppercase tracking-wide">IP address blocked</p>
              <p className="mt-2 text-xs font-bold leading-relaxed">{BLOCKED_LOGIN_MESSAGE}</p>
              <p className="mt-2 text-[10px] font-medium leading-relaxed text-rose-300/80">
                The Super Admin has been notified by email and phone. This page checks for approval automatically.
              </p>
            </div>
          )}
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
          {sessionNotice && (
            <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
              <KeyRound className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              <p className="text-xs font-bold leading-relaxed">{sessionNotice}</p>
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
                    disabled={loading || guardBlocked || guardChecking || guardUnavailable}
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
                    disabled={loading || guardBlocked || guardChecking || guardUnavailable}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3.5 text-sm font-medium text-white outline-none transition-all focus:ring-2 focus:ring-rose-500"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <PrimaryButton
                  loading={loading || guardChecking}
                  label="Authenticate"
                  disabled={guardBlocked || guardUnavailable}
                />
              </form>

              <div className="mt-8 border-t border-slate-800 pt-8">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading || guardBlocked || guardChecking || guardUnavailable}
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
          Admin roles require two-factor verification.<br />
          Other staff can enable it from Settings.<br />
          Sessions end after 30 minutes idle or 8 hours total.
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

function PrimaryButton({
  loading,
  label,
  disabled = false,
}: {
  loading: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
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
