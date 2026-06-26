"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Mail, Loader2, AlertCircle, Phone, Smartphone, Chrome, Apple, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  loginWithEmail,
  signUpWithEmail,
  observeAuth,
  loginWithGoogle,
  loginWithApple,
  signIn,
  setupRecaptcha,
  loginWithPhone
} from '@/lib/auth';
import { ParentRepository } from '@/lib/repositories/ParentRepository';
import { FamilyRepository } from '@/lib/repositories/FamilyRepository';
import { ConfirmationResult } from 'firebase/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Signing in...');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<any>(null);
  const redirectingRef = useRef(false);

  // Consolidated redirect function
  const safeRedirect = () => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;
    router.replace('/');
  };

  useEffect(() => {
    const unsub = observeAuth((user) => {
        if (user && !loading) { // Only auto-redirect if we aren't already in a manual login flow
            safeRedirect();
        }
    });
    return () => unsub();
  }, [router, loading]);

  const handlePostLogin = async (user: any, provider: string) => {
    setLoading(true);
    setLoadingMessage("Setting up your family vault...");
    try {
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

      setLoadingMessage("Ready! Launching dashboard...");
      safeRedirect();
    } catch (err: any) {
      console.error("Post-login error:", err);
      setError(err.message || "Error setting up parent profile");
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoadingMessage(isSignUp ? "Creating your account..." : "Authenticating...");

    try {
      const user = isSignUp
        ? await signUpWithEmail(email, password)
        : await loginWithEmail(email, password);

      if (user) {
        await handlePostLogin(user, "password");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication");
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

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoadingMessage("Sending verification code...");
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = setupRecaptcha('recaptcha-container');
      }
      const confirmation = await loginWithPhone(phoneNumber, recaptchaRef.current);
      if (confirmation) {
        confirmationResultRef.current = confirmation;
        setShowOtpInput(true);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message);
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 md:p-10 relative overflow-hidden">
        {/* Loading Overlay - Fixed and Stable */}
        {loading && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mb-6">
                    <Loader2 className="animate-spin text-primary-600" size={40} />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Secure Authentication</h2>
                <p className="text-slate-500 font-medium italic animate-pulse">{loadingMessage}</p>
                <div className="mt-8 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 animate-progress" style={{ width: '40%' }} />
                </div>
            </div>
        )}

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600 mb-4 shadow-sm">
            <Shield size={36} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {showPhoneLogin ? (showOtpInput ? "Verify Code" : "Phone Login") : (isSignUp ? "Create Account" : "Welcome Back")}
          </h1>
          <p className="text-slate-500 mt-2 text-center font-medium">
            {showPhoneLogin
              ? (showOtpInput ? "Enter the 6-digit code sent to your phone" : "Enter your phone number to continue")
              : (isSignUp ? "Sign up to start protecting your family" : "Sign in to your Parent Dashboard")}
          </p>
        </div>

        {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl mb-6 flex items-start gap-3 text-sm animate-in slide-in-from-top-2 duration-300">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="font-bold">{error}</p>
            </div>
        )}

        {!showPhoneLogin ? (
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
              </div>

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

      <p className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-50">© 2026 KidsGuard Safety Inc.</p>
    </div>
  );
}
