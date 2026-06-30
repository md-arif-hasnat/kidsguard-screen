"use client";

import React, { useEffect, useState } from 'react';
import InternalLayout from '@/components/InternalLayout';
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
  Lock,
  Monitor
} from 'lucide-react';
import { ConfigRepository, ReleaseChannel, AppRelease, UpdateConfig } from '@/lib/repositories/ConfigRepository';
import { useInternalAdmin } from '@/lib/context/InternalAdminContext';
import { PlatformAdminRole } from '@/lib/repositories/PlatformAdminRepository';
import { clsx } from 'clsx';

export default function ReleaseManager() {
  const { admin, loading: adminLoading } = useInternalAdmin();
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

  // Web Fields
  const [webVersion, setWebVersion] = useState('1.0.0');
  const [webMessage, setWebMessage] = useState('New web version available.');
  const [webNotes, setWebNotes] = useState('');

  const canPublish = admin?.role === PlatformAdminRole.SUPER_ADMIN || admin?.role === PlatformAdminRole.ADMIN;

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
          setReleaseNotes(Array.isArray(active.releaseNotes) ? active.releaseNotes.join('\n') : active.releaseNotes);
          setFileSize(active.fileSize);
          setMinAndroid(active.minimumAndroidVersion);

          setWebVersion(active.webVersion || '1.0.0');
          setWebMessage(active.webUpdateMessage || 'New web version available.');
          setWebNotes(Array.isArray(active.webReleaseNotes) ? active.webReleaseNotes.join('\n') : active.webReleaseNotes || '');
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
    if (!canPublish) return;

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
        releaseNotes: notes.split('\n').filter(n => n.trim() !== ''),
        fileSize,
        minimumAndroidVersion: minAndroid,
        webVersion,
        webUpdateMessage: webMessage,
        webReleaseNotes: webNotes.split('\n').filter(n => n.trim() !== '')
      }, {
        uid: admin?.uid || "unknown",
        email: admin?.email
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

  if (loading || adminLoading) {
    return (
      <InternalLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-rose-500" size={48} />
        </div>
      </InternalLayout>
    );
  }

  return (
    <InternalLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white uppercase italic tracking-tight">Release <span className="text-rose-500">Manager</span></h1>
          <p className="text-slate-500 text-sm md:text-base mt-1">Deploy application updates across all channels.</p>
        </div>
        <div className="flex gap-2">
            <span className="bg-rose-500/10 text-rose-500 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5 border border-rose-500/20 uppercase tracking-widest">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Live Control
            </span>
        </div>
      </div>

      {status && (
        <div className={clsx(
          "mb-8 p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-2 duration-300",
          status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        )}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="font-bold text-xs uppercase tracking-wider">{status.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
            <section className="bg-slate-900 rounded-3xl border border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 md:p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                    <h2 className="font-black text-white flex items-center gap-2 text-xs md:text-sm uppercase tracking-widest">
                        <Rocket size={18} className="text-rose-500" />
                        Publish New Release
                    </h2>
                </div>
                <form onSubmit={handlePublish} className="p-5 md:p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Version Name</label>
                            <input
                                type="text"
                                value={versionName}
                                onChange={e => setVersionName(e.target.value)}
                                placeholder="1.0.0"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Version Code</label>
                            <input
                                type="number"
                                value={versionCode}
                                onChange={e => setVersionCode(parseInt(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm text-white"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">APK Download URL</label>
                            <input
                                type="url"
                                value={apkUrl}
                                onChange={e => setApkUrl(e.target.value)}
                                placeholder="https://github.com/.../release.apk"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-medium text-sm text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Release Channel</label>
                            <select
                                value={channel}
                                onChange={e => setChannel(e.target.value as any)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-bold appearance-none text-sm text-white"
                            >
                                <option value="stable">Stable (Production)</option>
                                <option value="beta">Beta (Testing)</option>
                                <option value="alpha">Alpha (Development)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mandatory Update</label>
                            <div className="flex items-center gap-4 h-[52px] bg-slate-950 border border-slate-800 rounded-xl px-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={mandatory}
                                        onChange={e => setMandatory(e.target.checked)}
                                        className="w-5 h-5 accent-rose-500 cursor-pointer bg-slate-900 border-slate-700"
                                    />
                                    <span className="text-xs font-bold text-slate-400 group-hover:text-rose-500 transition-colors uppercase tracking-tight">Force Update</span>
                                </label>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">File Size</label>
                            <input
                                type="text"
                                value={fileSize}
                                onChange={e => setFileSize(e.target.value)}
                                placeholder="12.5 MB"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Min Android</label>
                            <input
                                type="text"
                                value={minAndroid}
                                onChange={e => setMinAndroid(e.target.value)}
                                placeholder="8.0"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm text-white"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Prompt Message</label>
                            <input
                                type="text"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-medium text-sm text-white"
                            />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Release Notes (One per line)</label>
                            <textarea
                                rows={4}
                                value={notes}
                                onChange={e => setReleaseNotes(e.target.value)}
                                placeholder="✓ Added Safe Zone alerts"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-medium text-sm resize-none text-white"
                            />
                        </div>
                    </div>

                    <div className="border-t border-slate-800 pt-8">
                        <h3 className="text-xs font-black text-white mb-6 flex items-center gap-2 uppercase tracking-[0.2em]">
                            <Monitor size={16} className="text-rose-500" />
                            Web / PWA Update Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Web Version</label>
                                <input
                                    type="text"
                                    value={webVersion}
                                    onChange={e => setWebVersion(e.target.value)}
                                    placeholder="1.0.0"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm text-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Web Update Message</label>
                                <input
                                    type="text"
                                    value={webMessage}
                                    onChange={e => setWebMessage(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-medium text-sm text-white"
                                />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Web Release Notes (One per line)</label>
                                <textarea
                                    rows={3}
                                    value={webNotes}
                                    onChange={e => setWebNotes(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 focus:ring-2 focus:ring-rose-500 outline-none font-medium text-sm resize-none text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-800 flex justify-end">
                        <button
                            disabled={publishing || !canPublish}
                            type="submit"
                            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black py-4 px-12 rounded-2xl shadow-xl shadow-rose-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-xs uppercase tracking-widest italic"
                        >
                            {publishing ? <Loader2 className="animate-spin" size={20} /> : <Rocket size={20} />}
                            Deploy Release
                        </button>
                    </div>
                </form>
            </section>
        </div>

        <div className="space-y-6">
            <section className="bg-slate-900 rounded-3xl p-5 md:p-6 text-white shadow-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black flex items-center gap-2 text-[10px] uppercase tracking-widest">
                        <History size={16} className="text-rose-500" />
                        Audit History
                    </h3>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{history.length} Saved</span>
                </div>

                <div className="space-y-4 max-h-[400px] md:max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {history.map(rel => (
                        <div key={rel.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-rose-500/50 transition-all group">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-xs">v{rel.latestVersionName}</p>
                                        <span className={clsx(
                                            "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                            rel.releaseChannel === 'stable' ? "bg-emerald-500/10 text-emerald-400" : rel.releaseChannel === 'beta' ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                                        )}>
                                            {rel.releaseChannel}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1 font-bold">Code: {rel.latestVersionCode}</p>
                                </div>
                                <div className="flex gap-2">
                                    {rel.mandatoryUpdate && <ShieldAlert size={14} className="text-rose-500" />}
                                    <a href={rel.apkDownloadUrl} target="_blank" className="text-slate-600 hover:text-rose-500 transition-colors">
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm">
                <h3 className="font-black text-white mb-4 flex items-center gap-2 text-[10px] uppercase tracking-widest">
                    <FileCode size={18} className="text-rose-500" />
                    Security Notice
                </h3>
                <ul className="space-y-3">
                    <TipItem label="Auth" text="Only Super Admins can deploy to Stable." />
                    <TipItem label="Audit" text="Every release is logged with UID." />
                    <TipItem label="Verify" text="Test in Alpha before Stable deployment." />
                </ul>
            </div>
        </div>
      </div>
    </InternalLayout>
  );
}

function TipItem({ label, text }: { label: string, text: string }) {
    return (
        <li className="flex flex-col">
            <span className="text-[9px] font-black text-rose-400 uppercase tracking-tighter">{label}</span>
            <span className="text-[10px] text-slate-500 font-medium">{text}</span>
        </li>
    )
}
