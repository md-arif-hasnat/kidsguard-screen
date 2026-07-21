"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AppWindow,
  Search,
  Calendar,
  ArrowUpDown,
  ShieldCheck,
  Loader2,
  Package,
  Clock,
  ExternalLink,
  Shield,
  ShieldAlert,
  ShieldOff,
  Timer,
  AlertTriangle,
  Activity,
  ChevronRight,
  Filter,
  Trash2,
  CheckCircle2,
  Save,
  X,
  Info,
  Smartphone
} from 'lucide-react';
import { InstalledAppsRepository, InstalledApp, AppControl } from '@/lib/repositories/InstalledAppsRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { AppUsageRepository, AppUsageItem } from '@/lib/repositories/AppUsageRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { formatDuration, formatLastUsed } from '@/lib/utils/FormatUtils';
import { isFirebaseConfigured } from '@/lib/firebase';
import { clsx } from 'clsx';

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'usage_high' | 'usage_low';
type FilterOption = 'all' | 'allowed' | 'blocked' | 'limited' | 'recent';

export default function InstalledAppsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const childId = params.childId as string;
  const highlightPkg = searchParams.get('pkg');

  const { profile, family, isChildAccessible, role, loading: profileLoading } = useParentProfile();
  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [controls, setControls] = useState<Record<string, AppControl>>({});
  const [usage, setUsage] = useState<Record<string, AppUsageItem>>({});

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');

  const [selectedApp, setSelectedSosApp] = useState<string | null>(null); // Package name for details modal
  const [isSaving, setIsSaving] = useState<string | null>(null); // Package name being saved

  const appRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!childId) return;
    return ChildRepository.listenToChildStatus(childId, setChildStatus);
  }, [childId]);

  useEffect(() => {
    if (!childId || profileLoading) return;

    if (!isChildAccessible(childId)) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubApps = InstalledAppsRepository.listenToInstalledApps(childId, (data) => {
      setApps(data);
      setLoading(false);
    });

    const unsubControls = InstalledAppsRepository.listenToAppControls(childId, setControls);

    const todayStr = new Date().toISOString().split('T')[0];
    const unsubUsage = AppUsageRepository.subscribeToChildAppUsageForDate(childId, todayStr, (data) => {
      const usageMap: Record<string, AppUsageItem> = {};
      data.forEach(item => {
        usageMap[item.packageName] = item;
      });
      setUsage(usageMap);
    });

    return () => {
      unsubApps();
      unsubControls();
      unsubUsage();
    };
  }, [childId, profileLoading, isChildAccessible]);

  // Handle highlighting from query param
  useEffect(() => {
    if (highlightPkg && apps.length > 0) {
      setTimeout(() => {
        const element = appRefs.current[highlightPkg];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightPkg, apps]);

  const appList = useMemo(() => {
    const isAppsEmpty = apps.length === 0;
    const usagePackages = Object.keys(usage);

    if (isAppsEmpty && usagePackages.length > 0) {
      // Fallback to usage-derived data
      return usagePackages.map(pkg => {
        const appUsage = usage[pkg];
        const sanitizedPkg = pkg.replace(/\./g, "_");
        const control = controls[sanitizedPkg] || { blocked: false, dailyLimitMinutes: null };

        return {
          packageName: pkg,
          appName: appUsage.appName || pkg,
          installedAt: appUsage.lastUsed,
          firstInstallTime: appUsage.lastUsed,
          versionName: "N/A",
          versionCode: 0,
          control,
          usage: appUsage,
          isDerived: true
        } as (InstalledApp & { control: AppControl, usage: AppUsageItem, isDerived: boolean });
      });
    }

    return apps.map(app => {
      const sanitizedPkg = app.packageName.replace(/\./g, "_");
      const control = controls[sanitizedPkg] || { blocked: false, dailyLimitMinutes: null };
      const appUsage = usage[app.packageName];

      return {
        ...app,
        control,
        usage: appUsage,
        isDerived: false
      };
    });
  }, [apps, controls, usage]);

  const summary = useMemo(() => {
    return {
      total: appList.length,
      allowed: appList.filter(a => !a.control.blocked).length,
      blocked: appList.filter(a => a.control.blocked).length,
      limited: appList.filter(a => a.control.dailyLimitMinutes !== null).length,
    };
  }, [appList]);

  const filteredAndSortedApps = useMemo(() => {
    let result = appList.filter(app =>
      app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter
    switch (filterBy) {
      case 'allowed':
        result = result.filter(a => !a.control.blocked);
        break;
      case 'blocked':
        result = result.filter(a => a.control.blocked);
        break;
      case 'limited':
        result = result.filter(a => a.control.dailyLimitMinutes !== null);
        break;
      case 'recent':
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        result = result.filter(a => a.installedAt > sevenDaysAgo);
        break;
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => b.installedAt - a.installedAt);
        break;
      case 'oldest':
        result.sort((a, b) => a.installedAt - b.installedAt);
        break;
      case 'alphabetical':
        result.sort((a, b) => a.appName.localeCompare(b.appName));
        break;
      case 'usage_high':
        result.sort((a, b) => (b.usage?.totalTimeMs || 0) - (a.usage?.totalTimeMs || 0));
        break;
      case 'usage_low':
        result.sort((a, b) => (a.usage?.totalTimeMs || 0) - (b.usage?.totalTimeMs || 0));
        break;
    }

    return result;
  }, [appList, searchQuery, sortBy, filterBy]);

  const handleToggleBlock = async (app: any) => {
    if (!profile?.uid) return;
    const newStatus = !app.control.blocked;

    if (newStatus && !confirm(`Block ${app.appName}? It will be prevented from opening on the child's device.`)) {
        return;
    }

    setIsSaving(app.packageName);
    try {
      await InstalledAppsRepository.updateAppControl(childId, profile.uid, {
        packageName: app.packageName,
        appName: app.appName,
        blocked: newStatus
      });
    } catch (err) {
      alert("Failed to update app control");
    } finally {
      setIsSaving(null);
    }
  };

  const handleSetLimit = async (packageName: string, appName: string, minutes: number | null) => {
    if (!profile?.uid) return;
    setIsSaving(packageName);
    try {
        await InstalledAppsRepository.updateAppControl(childId, profile.uid, {
            packageName,
            appName,
            dailyLimitMinutes: minutes
        });
    } catch (err) {
        alert("Failed to update time limit");
    } finally {
        setIsSaving(null);
    }
  };

  if (profileLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  const selectedAppData = selectedApp ? appList.find(a => a.packageName === selectedApp) : null;

  return (
    <DashboardLayout>
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
              <AppWindow className="text-primary-600" />
              Installed Apps
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Manage applications and limits for <span className="text-slate-900 font-bold">{childStatus?.childName || "Child device"}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
          <SummaryCard label="Total Apps" value={summary.total} icon={Package} color="text-primary-600" bgColor="bg-primary-50" />
          <SummaryCard label="Allowed" value={summary.allowed} icon={ShieldCheck} color="text-emerald-600" bgColor="bg-emerald-50" />
          <SummaryCard label="Blocked" value={summary.blocked} icon={ShieldOff} color="text-rose-600" bgColor="bg-rose-50" />
          <SummaryCard label="Limited" value={summary.limited} icon={Timer} color="text-orange-600" bgColor="bg-orange-50" />
      </div>

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-8 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name or package..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                      <FilterBtn active={filterBy === 'all'} onClick={() => setFilterBy('all')} label="All" />
                      <FilterBtn active={filterBy === 'allowed'} onClick={() => setFilterBy('allowed')} label="Allowed" />
                      <FilterBtn active={filterBy === 'blocked'} onClick={() => setFilterBy('blocked')} label="Blocked" />
                      <FilterBtn active={filterBy === 'limited'} onClick={() => setFilterBy('limited')} label="Limited" />
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                  >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="alphabetical">Name A-Z</option>
                      <option value="usage_high">Highest Usage</option>
                      <option value="usage_low">Lowest Usage</option>
                  </select>
              </div>
          </div>
      </div>

      {appList.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={40} className="text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">No installed apps have been synced yet.</h2>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 italic">Open KidsGuard on the child device and install or scan applications.</p>
        </div>
      ) : filteredAndSortedApps.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
              <Search size={40} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-500 font-medium">No apps match your current filters or search.</p>
              <button onClick={() => {setSearchQuery(''); setFilterBy('all');}} className="mt-4 text-primary-600 font-bold hover:underline">Clear all filters</button>
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in fade-in duration-500">
          {filteredAndSortedApps.map((app) => (
            <div
              key={app.packageName}
              ref={el => { appRefs.current[app.packageName] = el; }}
              className={clsx(
                "group bg-white p-5 md:p-6 rounded-[2rem] border transition-all hover:shadow-lg relative overflow-hidden flex flex-col justify-between",
                highlightPkg === app.packageName ? "border-primary-500 ring-4 ring-primary-50 scale-[1.02] z-10" : "border-slate-100",
                app.control.blocked && "bg-slate-50/50"
              )}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className={clsx(
                        "w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 transition-colors border",
                        app.control.blocked ? "bg-slate-200 text-slate-400 border-slate-300" : "bg-primary-50 text-primary-600 border-primary-100"
                    )}>
                        {app.appName[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-black text-slate-800 truncate group-hover:text-primary-900 transition-colors leading-tight">
                            {app.appName}
                        </h3>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-medium text-slate-400 truncate">{app.packageName}</p>
                            {app.isDerived && (
                                <span className="px-1.5 py-0.5 bg-yellow-50 text-yellow-600 text-[8px] font-bold uppercase rounded border border-yellow-100 whitespace-nowrap">Usage-derived</span>
                            )}
                        </div>
                    </div>
                </div>
                <StatusBadge control={app.control} usage={app.usage} />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <InfoItem label="Installed" value={new Date(app.installedAt).toLocaleDateString()} icon={Calendar} />
                <InfoItem label="Today's Usage" value={formatDuration(app.usage?.totalTimeMs || 0)} icon={Clock} highlight={Boolean(app.usage?.totalTimeMs)} />
              </div>

              <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleBlock(app)}
                        disabled={isSaving === app.packageName}
                        className={clsx(
                            "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2",
                            app.control.blocked
                                ? "bg-emerald-50 border-emerald-500 text-emerald-700 hover:bg-emerald-100"
                                : "bg-rose-50 border-rose-500 text-rose-700 hover:bg-rose-100"
                        )}
                      >
                        {isSaving === app.packageName ? <Loader2 size={14} className="animate-spin" /> : (app.control.blocked ? <ShieldCheck size={14} /> : <ShieldOff size={14} />)}
                        {app.control.blocked ? "Allow App" : "Block App"}
                      </button>
                      <button
                        onClick={() => setSelectedSosApp(app.packageName)}
                        className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                      >
                        Details
                      </button>
                  </div>

                  {!app.control.blocked && (
                      <div className="flex items-center gap-2 mt-1">
                          {app.control.dailyLimitMinutes ? (
                              <button
                                onClick={() => handleSetLimit(app.packageName, app.appName, null)}
                                className="flex-1 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 transition-all flex items-center justify-center gap-2"
                              >
                                  <Timer size={12} />
                                  Remove Limit
                              </button>
                          ) : (
                              <button
                                onClick={() => setSelectedSosApp(app.packageName)}
                                className="flex-1 py-2 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                              >
                                  <Timer size={12} />
                                  Set Time Limit
                              </button>
                          )}
                      </div>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* App Details Modal */}
      {selectedAppData && (
          <AppDetailsModal
            app={selectedAppData}
            onClose={() => setSelectedSosApp(null)}
            onUpdateControl={(updates) => handleSetLimit(selectedAppData.packageName, selectedAppData.appName, updates.dailyLimitMinutes!)}
            isSaving={isSaving === selectedAppData.packageName}
          />
      )}
    </DashboardLayout>
  );
}

function SummaryCard({ label, value, icon: Icon, color, bgColor }: any) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
        <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0", bgColor, color)}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-wider mb-1">{label}</p>
          <p className="text-lg font-black text-slate-800 truncate">{value}</p>
        </div>
      </div>
    );
}

function FilterBtn({ active, onClick, label }: any) {
    return (
        <button
          onClick={onClick}
          className={clsx(
            "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
            active ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {label}
        </button>
    );
}

function SortButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
        active ? "bg-primary-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}

function InfoItem({ label, value, icon: Icon, highlight }: any) {
    return (
        <div className="space-y-1 min-w-0">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            <div className="flex items-center gap-1.5 text-slate-600">
                <Icon size={12} className={clsx(highlight ? "text-primary-500" : "text-slate-400")} />
                <span className={clsx("text-xs font-bold truncate", highlight && "text-slate-900")}>{value}</span>
            </div>
        </div>
    );
}

function StatusBadge({ control, usage }: { control: AppControl, usage?: AppUsageItem }) {
    if (control.blocked) {
        return (
            <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                <ShieldAlert size={10} /> Blocked
            </span>
        );
    }

    if (control.dailyLimitMinutes) {
        const usageMins = usage ? Math.floor(usage.totalTimeMs / 60000) : 0;
        const reached = usageMins >= control.dailyLimitMinutes;

        return (
            <span className={clsx(
                "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1",
                reached ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
            )}>
                <Timer size={10} /> {reached ? "Limit Reached" : `${control.dailyLimitMinutes}m Limit`}
            </span>
        );
    }

    return (
        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
            <ShieldCheck size={10} /> Allowed
        </span>
    );
}

function AppDetailsModal({ app, onClose, onUpdateControl, isSaving }: { app: any, onClose: () => void, onUpdateControl: (c: Partial<AppControl>) => void, isSaving: boolean }) {
    const [customLimit, setCustomLimit] = useState(app.control.dailyLimitMinutes?.toString() || "");
    const [showCustomInput, setShowCustomInput] = useState(false);

    const limits = [
        { label: 'No Limit', value: null },
        { label: '15m', value: 15 },
        { label: '30m', value: 30 },
        { label: '45m', value: 45 },
        { label: '1h', value: 60 },
        { label: '2h', value: 120 },
    ];

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] bg-white p-6 md:p-10 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute right-6 top-6 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X size={24} /></button>

                <header className="flex items-center gap-6 mb-10">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-primary-50 rounded-3xl flex items-center justify-center text-3xl font-black text-primary-600 border border-primary-100">
                        {app.appName[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-2xl md:text-3xl font-black text-slate-900 truncate">{app.appName}</h2>
                        <p className="text-sm font-bold text-slate-400 truncate">{app.packageName}</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div className="space-y-6">
                        <ModalInfo label="Status" value={app.control.blocked ? "Currently Blocked" : "Active / Allowed"} icon={Shield} color={app.control.blocked ? "text-rose-600" : "text-emerald-600"} />
                        <ModalInfo label="Version" value={app.versionName} icon={Smartphone} />
                        <ModalInfo label="First Installed" value={new Date(app.firstInstallTime).toLocaleDateString()} icon={Calendar} />
                        <ModalInfo label="Last Activity" value={app.usage ? formatLastUsed(app.usage.lastUsed) : "Never"} icon={Activity} />
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Timer size={14} /> Usage Control
                        </h3>

                        <div className="space-y-4">
                            <p className="text-sm font-bold text-slate-700">Set daily time limit:</p>
                            <div className="grid grid-cols-3 gap-2">
                                {limits.map((l) => (
                                    <button
                                        key={l.label}
                                        onClick={() => { onUpdateControl({ dailyLimitMinutes: l.value }); setShowCustomInput(false); }}
                                        className={clsx(
                                            "py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2",
                                            app.control.dailyLimitMinutes === l.value && !showCustomInput ? "bg-primary-600 text-white border-primary-600 shadow-md" : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                                        )}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setShowCustomInput(true)}
                                    className={clsx(
                                        "py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2",
                                        showCustomInput ? "bg-primary-600 text-white border-primary-600 shadow-md" : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"
                                    )}
                                >
                                    Custom
                                </button>
                            </div>

                            {showCustomInput && (
                                <div className="flex gap-2 animate-in slide-in-from-top-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="1440"
                                        value={customLimit}
                                        onChange={e => setCustomLimit(e.target.value)}
                                        placeholder="Mins"
                                        className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-primary-500"
                                    />
                                    <button
                                        onClick={() => onUpdateControl({ dailyLimitMinutes: parseInt(customLimit) })}
                                        disabled={!customLimit || isSaving}
                                        className="bg-primary-600 text-white px-4 rounded-xl font-black text-[10px] uppercase hover:bg-primary-700 disabled:opacity-50"
                                    >
                                        Set
                                    </button>
                                </div>
                            )}

                            {app.control.dailyLimitMinutes && (
                                <div className="pt-4 border-t border-slate-200 mt-4">
                                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-2">
                                        <span>Today's Progress</span>
                                        <span>{Math.floor((app.usage?.totalTimeMs || 0) / 60000)} / {app.control.dailyLimitMinutes}m</span>
                                    </div>
                                    <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-slate-100 shadow-sm">
                                        <div
                                          className={clsx(
                                              "h-full transition-all duration-1000",
                                              (app.usage?.totalTimeMs || 0) / 60000 >= app.control.dailyLimitMinutes ? "bg-orange-500" : "bg-primary-500"
                                          )}
                                          style={{ width: `${Math.min(100, ((app.usage?.totalTimeMs || 0) / 60000 / app.control.dailyLimitMinutes) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => { onUpdateControl({ blocked: !app.control.blocked }); onClose(); }}
                        className={clsx(
                            "flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg",
                            app.control.blocked ? "bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700" : "bg-rose-600 text-white shadow-rose-100 hover:bg-rose-700"
                        )}
                    >
                        {app.control.blocked ? "Unblock Application" : "Block Application"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModalInfo({ label, value, icon: Icon, color }: any) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                <Icon size={18} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <p className={clsx("text-sm font-bold", color || "text-slate-800")}>{value}</p>
            </div>
        </div>
    );
}
