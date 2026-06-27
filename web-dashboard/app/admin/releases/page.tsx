"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Rocket,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  History,
  ExternalLink,
  ShieldAlert,
  ArrowUpCircle,
  FileCode,
  Lock
} from 'lucide-react';
import { ConfigRepository, ReleaseChannel, AppRelease, UpdateConfig } from '@/lib/repositories/ConfigRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { FamilyRole } from '@/lib/repositories/FamilyRepository';
import { clsx } from 'clsx';

export default function ReleaseManager() {
  const { profile, role, loading: profileLoading } = useParentProfile();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [history, setHistory] = useState<AppRelease[]>([]);
  const [currentConfig, setCurrentConfig] = useState<UpdateConfig | null>(null);

  // Form State
  const [versionCode, setVersionCode] = useState(1);
  const [versionName, setVersionName] = useState('1.0.0');
  const [apkUrl, setApkUrl] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [channel, setChannel] = useState<ReleaseChannel>('stable');
  const [message, setMessage] = useState('New version available. Please update for the best experience.');
  const [notes, setReleaseNotes] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [minAndroid, setMinAndroid] = useState('8.0');

  const isAdmin = role === FamilyRole.OWNER;

  useEffect(() => {
    async function loadData() {
      try {
        const [active, releases] = await Promise.all([
          ConfigRepository.getUpdateConfig(),
          ConfigRepository.getRecentReleases(10)
        ]);

        if (active) {
          setCurrentConfig(active);
          setVersionCode(active.latestVersionCode + 1);
          setVersionName(active.latestVersionName);
          setApkUrl(active.apkDownloadUrl);
          setMandatory(active.mandatoryUpdate);
          setChannel(active.releaseChannel);
          setMessage(active.updateMessage);
          setReleaseNotes(active.releaseNotes);
          setFileSize(active.fileSize);
          setMinAndroid(active.minimumAndroidVersion);
        }
        setHistory(releases);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const validate = () => {
    if (!versionName) return "Version Name is required.";
    if (isNaN(versionCode) || versionCode <= 0) return "Version Code must be a positive number.";
    if (currentConfig && versionCode <= currentConfig.latestVersionCode) {
        return `Version Code must be greater than current (${currentConfig.latestVersionCode}).`;
    }
    if (!apkUrl.startsWith("https://")) return "APK Download URL must start with https://";
    return null;
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const error = validate();
    if (error) {
        setStatus({ type: 'error', message: error });
        return;
    }

    setPublishing(true);
    setStatus(null);

    try {
      await ConfigRepository.publishRelease({
        latestVersionCode: versionCode,
        latestVersionName: versionName,
        apkDownloadUrl: apkUrl,
        mandatoryUpdate: mandatory,
        releaseChannel: channel,
        updateMessage: message,
        releaseNotes: notes,
        fileSize,
        minimumAndroidVersion: minAndroid
      }, {
        uid: profile?.uid || "unknown",
        email: profile?.email
      });

      setStatus({ type: 'success', message: `Release v${versionName} published successfully!` });

      const releases = await ConfigRepository.getRecentReleases(10);
      setHistory(releases);
      const active = await ConfigRepository.getUpdateConfig();
      if (active) {
          setCurrentConfig(active);
          setVersionCode(active.latestVersionCode + 1);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to publish release' });
    } finally {
      setPublishing(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-6">
                    <Lock size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Access Denied</h2>
                <p className="text-slate-500 mt-2 max-w-md">
                    Only system owners and administrators have permission to manage application releases.
                </p>
            </div>
        </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Release Manager</h1>
          <p className="text-slate-500 text-sm md:text-base mt-1">Deploy application updates across all channels.</p>
        </div>
        <div className="flex gap-2">
            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border border-slate-200">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                System Active
            </span>
        </div>
      </div>

      {status && (
        <div className={clsx(
          "mb-8 p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-2 duration-300",
          status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
        )}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-medium text-sm">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 md:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm md:text-base">
                        <Rocket size={18} className="text-primary-600" />
                        Publish New Release
                    </h2>
                </div>
                <form onSubmit={handlePublish} className="p-5 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Version Name</label>
                            <input
                                type="text"
                                value={versionName}
                                onChange={e => setVersionName(e.target.value)}
                                placeholder="1.0.0"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Version Code</label>
                            <input
                                type="number"
                                value={versionCode}
                                onChange={e => setVersionCode(parseInt(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">APK Download URL</label>
                            <input
                                type="url"
                                value={apkUrl}
                                onChange={e => setApkUrl(e.target.value)}
                                placeholder="https://github.com/.../release.apk"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-medium text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Release Channel</label>
                            <select
                                value={channel}
                                onChange={e => setChannel(e.target.value as any)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-bold appearance-none text-sm"
                            >
                                <option value="stable">Stable (Production)</option>
                                <option value="beta">Beta (Testing)</option>
                                <option value="alpha">Alpha (Development)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mandatory Update</label>
                            <div className="flex items-center gap-4 h-[52px] bg-slate-50 border border-slate-200 rounded-xl px-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={mandatory}
                                        onChange={e => setMandatory(e.target.checked)}
                                        className="w-5 h-5 accent-primary-600 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700 group-hover:text-primary-600 transition-colors">Force Update</span>
                                </label>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">File Size</label>
                            <input
                                type="text"
                                value={fileSize}
                                onChange={e => setFileSize(e.target.value)}
                                placeholder="12.5 MB"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min Android</label>
                            <input
                                type="text"
                                value={minAndroid}
                                onChange={e => setMinAndroid(e.target.value)}
                                placeholder="8.0"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prompt Message</label>
                            <input
                                type="text"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-medium text-sm"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Release Notes</label>
                            <textarea
                                rows={4}
                                value={notes}
                                onChange={e => setReleaseNotes(e.target.value)}
                                placeholder="✓ Added Safe Zone alerts"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-medium text-sm resize-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex justify-end">
                        <button
                            disabled={publishing}
                            type="submit"
                            className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-black py-4 px-12 rounded-2xl shadow-xl shadow-primary-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-sm"
                        >
                            {publishing ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                            Publish Release
                        </button>
                    </div>
                </form>
            </section>
        </div>

        <div className="space-y-6">
            <section className="bg-slate-900 rounded-3xl p-5 md:p-6 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold flex items-center gap-2 text-sm md:text-base">
                        <History size={18} className="text-primary-400" />
                        History
                    </h3>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{history.length} Saved</span>
                </div>

                <div className="space-y-4 max-h-[400px] md:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {history.map(rel => (
                        <div key={rel.id} className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-primary-500/50 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-xs md:text-sm">v{rel.latestVersionName}</p>
                                        <span className={clsx(
                                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                            rel.releaseChannel === 'stable' ? "bg-emerald-500/10 text-emerald-400" : rel.releaseChannel === 'beta' ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                                        )}>
                                            {rel.releaseChannel}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Code: {rel.latestVersionCode}</p>
                                </div>
                                <div className="flex gap-2">
                                    {rel.mandatoryUpdate && <ShieldAlert size={14} className="text-rose-400" />}
                                    <a href={rel.apkDownloadUrl} target="_blank" className="text-slate-500 hover:text-primary-400 transition-colors">
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm md:text-base">
                    <FileCode size={18} className="text-slate-400" />
                    Hosting Tips
                </h3>
                <ul className="space-y-3">
                    <TipItem label="GitHub" text="Releases are free and fast for Betas." />
                    <TipItem label="Firebase" text="Use Hosting for private distribution." />
                    <TipItem label="R2/S3" text="Best for large scale production." />
                </ul>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function TipItem({ label, text }: { label: string, text: string }) {
    return (
        <li className="flex flex-col">
            <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{label}</span>
            <span className="text-[10px] text-slate-500">{text}</span>
        </li>
    )
}
