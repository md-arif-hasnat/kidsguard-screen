"use client";

import React, { useEffect, useState } from 'react';
import {
  Shield,
  Download,
  Smartphone,
  Clock,
  Info,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Monitor,
  Apple,
  FileText
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ConfigRepository, UpdateConfig, AppRelease } from '@/lib/repositories/ConfigRepository';
import { clsx } from 'clsx';

export default function DownloadPage() {
  const [config, setConfig] = useState<UpdateConfig | null>(null);
  const [history, setHistory] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const downloadUrl = "https://kidsguard-screen.vercel.app/download";

  useEffect(() => {
    async function fetchData() {
      if (!isFirebaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const [updateData, releases] = await Promise.all([
            ConfigRepository.getUpdateConfig(),
            ConfigRepository.getRecentReleases(3)
        ]);

        if (updateData) {
          setConfig(updateData);
        } else {
          setError("Configuration not found.");
        }
        setHistory(releases);
      } catch (err) {
        setError("Failed to load download information.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleDownload = () => {
    if (config?.apkDownloadUrl) {
      window.open(config.apkDownloadUrl, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-primary-600" size={48} />
          <p className="font-bold text-slate-500 italic uppercase tracking-widest">Verifying latest release...</p>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
            <AlertTriangle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Download Unavailable</h2>
          <p className="text-slate-500 leading-relaxed">
            {error || "Download currently unavailable. Please try again later."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-primary-100">
      {/* Navbar */}
      <nav className="h-20 bg-white border-b border-slate-100 flex items-center px-6 md:px-12 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
            <Shield size={24} />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 tracking-tighter block leading-none">KidsGuard</span>
            <span className="text-[8px] font-black text-primary-600 uppercase tracking-widest">Protect • Guide • Grow</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="space-y-6 md:space-y-8 animate-in slide-in-from-left duration-700">
          <div>
            <div className="flex items-center gap-3">
                <span className="bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-primary-100">
                    Official Release
                </span>
                {config.releaseChannel !== 'stable' && (
                    <span className={clsx(
                        "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border",
                        config.releaseChannel === 'beta' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-rose-50 text-rose-600 border-rose-100"
                    )}>
                        {config.releaseChannel}
                    </span>
                )}
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 mt-4 leading-[1.1]">
              Download <span className="text-primary-600">KidsGuard</span>
            </h1>
            <p className="text-base md:text-lg text-slate-500 mt-6 max-w-lg leading-relaxed font-medium">
              Always download the latest secure version directly from our official distribution point. Install the application on your child&apos;s device to start monitoring.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <ReleaseInfo label="Version" value={config.latestVersionName} icon={Info} />
            <ReleaseInfo label="Size" value={config.fileSize || "N/A"} icon={FileText} />
            <ReleaseInfo label="Released" value={config.releasedAt ? new Date(config.releasedAt.seconds * 1000).toLocaleDateString() : "Recent"} icon={Clock} />
            <ReleaseInfo label="Android" value={config.minimumAndroidVersion || "8.0+"} icon={Smartphone} />
          </div>

          <div className="pt-2 md:pt-4">
            <button
                onClick={handleDownload}
                className="group w-full md:w-auto bg-primary-600 hover:bg-primary-700 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-black text-base md:text-lg shadow-2xl shadow-primary-200 transition-all flex items-center justify-center gap-3 hover:-translate-y-1 active:scale-95"
            >
              <Download size={24} className="group-hover:animate-bounce" />
              Download APK
            </button>
            <p className="text-[10px] md:text-[11px] text-slate-400 mt-4 font-bold uppercase tracking-widest text-center md:text-left">
                Verified secure by KidsGuard Security
            </p>
          </div>
        </div>

        <div className="space-y-8 animate-in slide-in-from-right duration-700">
            {/* Desktop QR Section */}
            <div className="hidden lg:block bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-center">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Scan to Download on Phone</p>
                <div className="relative inline-block group">
                    <div className="absolute -inset-4 bg-primary-500/5 rounded-3xl blur-xl group-hover:bg-primary-500/10 transition-all duration-500" />
                    <div className="relative bg-white p-6 rounded-3xl border-2 border-slate-50 shadow-sm">
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`}
                            alt="Download QR"
                            className="w-48 h-48"
                        />
                    </div>
                </div>
                <div className="mt-8 space-y-2">
                    <p className="text-sm font-black text-slate-700">{downloadUrl}</p>
                    <p className="text-xs text-slate-400 font-medium">Point your camera to start the installation</p>
                </div>
            </div>

            {/* Platform Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PlatformCard icon={Smartphone} name="Android" status="Available" active />
                <PlatformCard icon={Apple} name="iOS" status="Coming Soon" />
                <PlatformCard icon={Monitor} name="Windows" status="Coming Soon" />
            </div>

            {/* Release Notes */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-900/20">
                <h3 className="font-bold text-primary-400 uppercase tracking-widest text-xs mb-4">Release Notes</h3>
                <div className="prose prose-invert prose-sm">
                    <p className="text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                        {config.releaseNotes || "Security improvements and background stability enhancements."}
                    </p>
                </div>
            </div>

            {/* Recent History */}
            {history.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-400 uppercase tracking-widest text-[10px] ml-1">Recent Releases</h3>
                    <div className="space-y-3">
                        {history.map(rel => (
                            <div key={rel.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-primary-100 transition-all cursor-pointer" onClick={() => window.open(rel.apkDownloadUrl, '_blank')}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">v{rel.latestVersionName}</p>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{rel.releaseChannel} • {rel.releasedAt ? new Date(rel.releasedAt.seconds * 1000).toLocaleDateString() : 'Previous'}</p>
                                    </div>
                                </div>
                                <Download size={16} className="text-slate-300 group-hover:text-primary-600 transition-colors" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </main>

      <footer className="mt-20 border-t border-slate-100 py-12 text-center">
         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">© 2026 KidsGuard Family Safety</p>
      </footer>
    </div>
  );
}

function ReleaseInfo({ label, value, icon: Icon }: any) {
    return (
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1">
            <div className="flex items-center gap-2 text-slate-400">
                <Icon size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-base font-bold text-slate-700">{value}</span>
        </div>
    )
}

function PlatformCard({ icon: Icon, name, status, active }: any) {
    return (
        <div className={clsx(
            "p-5 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3",
            active ? "bg-white border-slate-100 shadow-sm" : "bg-slate-50/50 border-transparent opacity-60"
        )}>
            <div className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center",
                active ? "bg-primary-100 text-primary-600" : "bg-slate-200 text-slate-500"
            )}>
                <Icon size={20} />
            </div>
            <div className="text-center">
                <p className="text-xs font-black text-slate-900 leading-none">{name}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-tighter">{status}</p>
            </div>
        </div>
    )
}
