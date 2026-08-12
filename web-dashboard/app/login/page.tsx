"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Mail, Loader2, AlertCircle, Phone, Smartphone, Chrome, Apple, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  loginWithEmail,
  signUpWithEmail,
  observeAuth,
  loginWithGoogle,
  loginWithApple,
  signIn,
  signOut,
  setupRecaptcha,
  loginWithPhone,
  resetPassword
} from '@/lib/auth';
import { ParentRepository } from '@/lib/repositories/ParentRepository';
import { FamilyRepository } from '@/lib/repositories/FamilyRepository';
import { ConfirmationResult } from 'firebase/auth';
import { serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false);
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Signing in...');
  const [error, setError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const router = useRouter();

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<any>(null);
  const redirectingRef = useRef(false);
  const authFlowInProgressRef = useRef(false);

  // Consolidated redirect function
  const safeRedirect = () => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace('/');
  };
const getFriendlyAuthError = (err: any): string => {
  switch (err?.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "The email or password you entered is incorrect.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/email-already-in-use":
      return "An account already exists with this email address.";

    case "auth/weak-password":
      return "Your password must contain at least 6 characters.";

    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";

    case "auth/network-request-failed":
      return "Network connection failed. Please check your internet connection.";

    default:
      return "Authentication failed. Please check your details and try again.";
  }
};

  useEffect(() => {
      const unsub = observeAuth((user) => {
          if (user && !loading && !authFlowInProgressRef.current) {
              const isPasswordUser = user.providerData.some(
                  (provider) => provider.providerId === "password"
              );

              if (isPasswordUser && !user.emailVerified) {
                  void signOut();
                  setError(
                      "Please verify your email before accessing the dashboard."
                  );
                  return;
              }

              safeRedirect();
          }
      });

      return () => unsub();
  }, [router, loading]);

  const handlePostLogin = async (user: any, provider: string) => {
    setLoading(true);
    setLoadingMessage("Setting up your family vault...");
    try {
        if (provider === "password" && !user.emailVerified) {
          await signOut();
          authFlowInProgressRef.current = false;
          setError(null);
          setAuthSuccess(
            "Account created successfully! Please check your email and verify your account."
          );
          setLoading(false);
          return;
        }
        try {
          const deletionWasCancelled =
            await FamilyRepository.cancelPendingDeletion();

          if (deletionWasCancelled) {
            console.log(
              "Pending family deletion cancelled after login."
            );
          }
        } catch (cancelError) {
          console.warn(
            "Could not check or cancel pending deletion:",
            cancelError
          );
        }
        let profile = await ParentRepository.createOrUpdateProfile(user, provider);

      if (!profile.familyId) {
          setLoadingMessage("Creating new family vault...");
          const familyId = await FamilyRepository.createFamily(user.uid, user.email, user.displayName);
          await ParentRepository.updateProfile(user.uid, {
              familyId,
              role: 'OWNER'
          });
          localStorage.setItem("kidsguard_family_id", familyId);
      } else {
          localStorage.setItem("kidsguard_family_id", profile.familyId);
      }

      setError(null);
      setAuthSuccess("Login successful! Redirecting to your dashboard...");
      setLoading(false);

      await new Promise((resolve) => setTimeout(resolve, 1200));

      safeRedirect();
    } catch (err: any) {
        authFlowInProgressRef.current = false;
      console.error("Post-login error:", err);
      setError(err.message || "Error setting up parent profile");
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
      if (isSignUp && !acceptedLegalTerms) {
        setError(
          "You must accept the Terms of Service and Privacy Policy to create an account."
        );
        return;
      }
    authFlowInProgressRef.current = true;
    setLoading(true);
    setError(null);
    setAuthSuccess(null);
    setLoadingMessage(isSignUp ? "Creating your account..." : "Authenticating...");

    try {
      const user = isSignUp
        ? await signUpWithEmail(email, password)
        : await loginWithEmail(email, password);

      if (user) {
        if (isSignUp) {
          await ParentRepository.updateProfile(user.uid, {
            uid: user.uid,
            email: user.email,
            phoneNumber: user.phoneNumber,
            displayName: user.displayName || "Parent",
            provider: "password",
            familyId: null,
            role: "OWNER",
            region: "DE",
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            legalConsentAcceptedAt: serverTimestamp(),
            termsVersion: "2026-08-11",
            privacyVersion: "2026-08-11",
            adultConfirmedAt: serverTimestamp(),
          });


        }

        await handlePostLogin(user, "password");
      }
    } catch (err: any) {
        authFlowInProgressRef.current = false;
      setError(getFriendlyAuthError(err));
      setLoading(false);
}
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage("Connecting to Google...");
    try {
      const user = await loginWithGoogle();
      if (user) await handlePostLogin(user, "google.com");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage("Connecting to Apple...");
    try {
      const user = await loginWithApple();
      if (user) await handlePostLogin(user, "apple.com");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage("Entering guest mode...");
    try {
      const user = await signIn();
      if (user) await handlePostLogin(user, "anonymous");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const normalizePhoneNumber = (phone: string) => {
    let cleaned = phone.trim().replace(/\s+/g, '');

    // 00 prefix to +
    if (cleaned.startsWith('00')) {
      return '+' + cleaned.substring(2);
    }

    // Local German format (0...) to +49
    if (cleaned.startsWith('0')) {
      return '+49' + cleaned.substring(1);
    }

    return cleaned;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoadingMessage("Sending verification code...");

    const finalPhone = normalizePhoneNumber(phoneNumber);

    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = setupRecaptcha('recaptcha-container');
      }
      const confirmation = await loginWithPhone(finalPhone, recaptchaRef.current);
      if (confirmation) {
        confirmationResultRef.current = confirmation;
        setShowOtpInput(true);
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Phone auth error:", err);

      let friendlyMessage = err.message;

      if (err.code === 'auth/invalid-phone-number' || err.message?.includes('invalid-phone-number') || err.message?.includes('Invalid format')) {
          friendlyMessage = "FORMAT_ERROR";
      } else if (err.code === 'auth/quota-exceeded') {
          friendlyMessage = "Too many requests. Please try again later.";
      } else if (err.code === 'auth/too-many-requests') {
          friendlyMessage = "Too many attempts. Please wait before trying again.";
      } else {
          friendlyMessage = "Authentication failed. Please verify your number and try again.";
      }

      setError(friendlyMessage);
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoadingMessage("Verifying code...");
    try {
      if (confirmationResultRef.current) {
        const result = await confirmationResultRef.current.confirm(otp);
        if (result.user) {
          await handlePostLogin(result.user, "phone");
        }
      }
    } catch (err: any) {
      setError(err.message || "Invalid code. Please try again.");
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoadingMessage("Sending reset link...");
    try {
      await resetPassword(email);
      setResetSuccess(true);
      setLoading(false);
    } catch (err: any) {
      let friendlyMessage = "Failed to send reset email. Please try again.";
      if (err.code === 'auth/user-not-found') {
          // generic message for security as requested, but if it exists, it sent.
          setResetSuccess(true);
          setLoading(false);
          return;
      } else if (err.code === 'auth/invalid-email') {
          friendlyMessage = "Please enter a valid email address.";
      } else if (err.code === 'auth/too-many-requests') {
          friendlyMessage = "Too many requests. Please try again later.";
      }
      setError(friendlyMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 md:p-10 relative overflow-hidden">
        {/* Loading Overlay - Fixed and Stable */}
        {loading && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                <div className="mb-6">
                    <img src="/loading-logo.png" alt="Loading..." className="h-20 w-auto animate-pulse" />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Secure Authentication</h2>
                <p className="text-slate-500 font-medium italic animate-pulse">{loadingMessage}</p>
                <div className="mt-8 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 animate-progress" style={{ width: '40%' }} />
                </div>
            </div>
        )}

        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <img src="/navbar-logo.png" alt="KidsGuard Logo" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
            KidsGuard
          </h1>
          <p className="text-[10px] font-black text-primary-600 uppercase tracking-[0.3em] mt-1">
            Protect • Guide • Grow
          </p>
        </div>
        {authSuccess && (
          <div className="p-4 rounded-2xl mb-6 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <CheckCircle2
              size={20}
              className="shrink-0 mt-0.5 text-emerald-500"
            />
            <div>
              <p className="font-black text-sm uppercase tracking-tight">
                Login Successful
              </p>
              <p className="font-bold text-sm mt-1">
                {authSuccess}
              </p>
            </div>
          </div>
        )}
        {error && (
            <div className={clsx(
                "p-4 rounded-2xl mb-6 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300 border shadow-sm",
                error === "FORMAT_ERROR"
                    ? "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400"
                    : "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30"
            )}>
                <AlertCircle size={20} className="shrink-0 mt-0.5 text-rose-500" />
                <div className="space-y-3">
                    <p className="font-black text-sm uppercase tracking-tight">
                        {error === "FORMAT_ERROR" ? "Invalid phone number format" : "Security Alert"}
                    </p>
                    {error === "FORMAT_ERROR" ? (
                        <div className="space-y-4">
                            <p className="text-xs font-medium leading-relaxed opacity-90">
                                Please enter your number including your country code (e.g. +49 for Germany).
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase opacity-60">Germany</p>
                                    <code className="text-[11px] font-bold bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg">+49 157 3242 1309</code>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase opacity-60">United Kingdom</p>
                                    <code className="text-[11px] font-bold bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg">+44 7123 456789</code>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase opacity-60">Bangladesh</p>
                                    <code className="text-[11px] font-bold bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg">+880 1712 345678</code>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase opacity-60">France</p>
                                    <code className="text-[11px] font-bold bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg">+33 6 12 34 56 78</code>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="font-bold text-sm">{error}</p>
                    )}
                </div>
            </div>
        )}

        {showForgotPassword ? (
          <form className="space-y-6" onSubmit={handleForgotPasswordSubmit}>
            <div className="text-center mb-6">
               <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
               <p className="text-sm text-slate-500 mt-1 italic">Enter your email to receive a reset link.</p>
            </div>

            {resetSuccess ? (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-6 rounded-2xl text-center animate-in zoom-in-95 duration-300">
                  <CheckCircle2 className="mx-auto mb-4" size={40} />
                  <p className="font-bold">Password reset link sent.</p>
                  <p className="text-xs mt-2 italic">Please check your inbox (and spam folder).</p>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setResetSuccess(false); }}
                    className="mt-6 text-primary-600 font-bold uppercase tracking-widest text-[10px] hover:underline"
                  >
                    Back to Login
                  </button>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-slate-400" size={20} />
                    <input
                      type="email"
                      required
                      disabled={loading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-bold text-slate-700"
                      placeholder="parent@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || (isSignUp && !acceptedLegalTerms)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-xl shadow-lg shadow-primary-200 transition-all transform active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Send Reset Link"}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full text-slate-400 font-bold hover:text-slate-600 text-[10px] uppercase tracking-widest"
                >
                  Back to Login
                </button>
              </>
            )}
          </form>
        ) : !showPhoneLogin ? (
          <>
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-bold text-slate-700"
                    placeholder="parent@example.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="password"
                    required
                    disabled={loading}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-bold text-slate-700"
                    placeholder="••••••••"
                  />
                </div>
                {!isSignUp && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => { setShowForgotPassword(true); setError(null); }}
                      className="text-[10px] font-bold text-primary-600 hover:underline uppercase tracking-widest mt-1"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>
              {isSignUp && (
                                          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <input
                                              type="checkbox"
                                              checked={acceptedLegalTerms}
                                              disabled={loading}
                                              onChange={(e) => setAcceptedLegalTerms(e.target.checked)}
                                              className="mt-1 h-4 w-4 shrink-0 accent-primary-600"
                                            />

                                            <span className="text-xs leading-relaxed text-slate-600">
                                              I confirm that I am at least 18 years old and agree to the{" "}
                                              <a
                                                href="/terms"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-bold text-primary-600 hover:underline"
                                              >
                                                Terms of Service
                                              </a>{" "}
                                              and{" "}
                                              <a
                                                href="/privacy"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-bold text-primary-600 hover:underline"
                                              >
                                                Privacy Policy
                                              </a>
                                              .
                                            </span>
                                          </label>
                                        )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-xl shadow-lg shadow-primary-200 transition-all transform active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
              >
                {isSignUp ? "Create Account" : "Sign In"}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-white px-4 text-slate-400">Security Gateway</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 py-3.5 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-bold text-slate-700 text-sm disabled:opacity-50"
              >
                <Chrome size={18} className="text-rose-500" /> Google
              </button>
              <button
                onClick={handleAppleLogin}
                disabled={loading}
                className="flex items-center justify-center gap-2 py-3.5 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-bold text-slate-700 text-sm disabled:opacity-50"
              >
                <Apple size={18} /> Apple
              </button>
            </div>

            <button
              onClick={() => setShowPhoneLogin(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-bold text-slate-700 text-sm mb-4 disabled:opacity-50"
            >
              <Smartphone size={18} className="text-primary-600" /> Continue with Phone
            </button>

            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-primary-600 transition-colors py-2 disabled:opacity-50"
            >
              Access Developer Sandbox
            </button>
          </>
        ) : (
          <form className="space-y-6" onSubmit={showOtpInput ? handleOtpSubmit : handlePhoneSubmit}>
             {!showOtpInput ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 text-slate-400" size={20} />
                    <input
                      type="tel"
                      required
                      disabled={loading}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-bold text-slate-700"
                      placeholder="+1234567890"
                    />
                  </div>
                </div>
             ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest text-center block">One-Time Password</label>
                  <input
                    type="text"
                    required
                    disabled={loading}
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 text-center text-2xl tracking-[1em] font-black text-primary-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                    placeholder="000000"
                  />
                </div>
             )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-4 rounded-xl shadow-lg shadow-primary-200 transition-all transform active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
            >
              {showOtpInput ? "Verify \u0026 Unlock" : "Send Access Code"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => { setShowPhoneLogin(false); setShowOtpInput(false); }}
              className="w-full text-primary-600 font-bold hover:underline text-sm uppercase tracking-widest text-xs"
            >
              Back to Email Login
            </button>
          </form>
        )}

        {!showPhoneLogin && (
          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <button
                  disabled={loading}
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary-600 font-bold hover:underline text-sm transition-opacity disabled:opacity-50"
              >
                  {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </button>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center text-[10px] font-bold text-slate-500">
        <div className="flex items-center gap-4">
          <a
            href="/privacy"
            className="transition-colors hover:text-slate-300 hover:underline"
          >
            Privacy Policy
          </a>

          <span aria-hidden="true">•</span>

          <a
            href="/terms"
            className="transition-colors hover:text-slate-300 hover:underline"
          >
            Terms of Service
          </a>
        </div>

        <p className="uppercase tracking-[0.2em] opacity-60">
          © 2026 KidsGuard · Operated by United Foreign Trade
        </p>
      </div>
    </div>
  );
}
