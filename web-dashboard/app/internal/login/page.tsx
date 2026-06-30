"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { loginWithEmail, loginWithGoogle, observeAuth } from '@/lib/auth';
import { PlatformAdminRepository } from '@/lib/repositories/PlatformAdminRepository';

export default function InternalLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    return observeAuth(async (user) => {
      if (user) {
        console.log(`INTERNAL_DEBUG: Auth state changed. User signed in: ${user.email}, UID: ${user.uid}`);
        const isAdmin = await PlatformAdminRepository.isAdmin(user.uid);
        if (isAdmin) {
          console.log("INTERNAL_DEBUG: Redirecting to /internal via observeAuth");
          router.push('/internal');
        }
      }
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const user = await loginWithEmail(email, password);
      if (user) {
        console.log(`INTERNAL_DEBUG: Login success for ${user.email}, UID: ${user.uid}`);
        const isAdmin = await PlatformAdminRepository.isAdmin(user.uid);
        if (isAdmin) {
          console.log("INTERNAL_DEBUG: Redirecting to /internal");
          router.push('/internal');
        } else {
          setError("Access Denied: You do not have platform admin permissions.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setLoading(true);
      setError(null);
      try {
          const user = await loginWithGoogle();
          if (user) {
              console.log(`INTERNAL_DEBUG: Google login success for ${user.email}, UID: ${user.uid}`);
              const isAdmin = await PlatformAdminRepository.isAdmin(user.uid);
              if (isAdmin) {
                  console.log("INTERNAL_DEBUG: Redirecting to /internal");
                  router.push('/internal');
              } else {
                  setError("Access Denied: Your account is not authorized for internal access.");
              }
          }
      } catch (err: any) {
          setError(err.message || "Google sign-in failed");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full -mr-48 -mt-48 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full -ml-48 -mb-48 blur-3xl" />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-500/30">
            <Shield className="text-rose-500" size={32} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Platform <span className="text-rose-500">Internal</span></h1>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest text-[10px]">Secure Gateway • Authorization Required</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
              <AlertCircle size={18} />
              <p className="text-xs font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-rose-500 outline-none text-white font-medium text-sm transition-all"
                placeholder="admin@kidsguard.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Key</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3.5 px-4 focus:ring-2 focus:ring-rose-500 outline-none text-white font-medium text-sm transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-900/20 transition-all flex items-center justify-center gap-2 group italic uppercase tracking-wider"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  Authenticate
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-800">
            <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-3"
            >
                <img src="/google-icon.png" alt="G" className="w-5 h-5" onError={(e) => (e.currentTarget.style.display = 'none')} />
                Sign in with Google
            </button>
          </div>
        </div>

        <div className="mt-12 text-center">
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest leading-loose">
                System access is logged and monitored.<br/>
                Unauthorized access attempts will be investigated.
            </p>
        </div>
      </div>
    </div>
  );
}
