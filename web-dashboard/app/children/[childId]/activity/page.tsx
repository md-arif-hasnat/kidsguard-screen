"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Smartphone,
  BarChart3,
  Activity,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Search
} from 'lucide-react';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { AppUsageRepository, AppUsageItem } from '@/lib/repositories/AppUsageRepository';
import { formatDuration, formatLastUsed } from '@/lib/utils/FormatUtils';
import { isFirebaseConfigured } from '@/lib/firebase';
import { clsx } from 'clsx';

export default function AppActivityPage() {
  const params = useParams();
  const childId = params.childId as string;
  const router = useRouter();

  const { profile, family, role, isChildAccessible, loading: profileLoading } = useParentProfile();
  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [usage, setUsage] = useState<AppUsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date selection
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const normalizedRole = useMemo(() => {
    return String(role || profile?.role || "").toUpperCase();
  }, [role, profile]);

  const canViewActivity = useMemo(() => {
    return (
      normalizedRole === "OWNER" ||
      normalizedRole === "ADMIN" ||
      normalizedRole === "PARENT"
    );
  }, [normalizedRole]);

  // Listen to child status
  useEffect(() => {
    if (!childId || !isFirebaseConfigured) return;
    return ChildRepository.listenToChildStatus(childId, setChildStatus);
  }, [childId]);

  // Subscribe to usage data
  useEffect(() => {
    if (!childId || !selectedDate || !isFirebaseConfigured) return;

    if (!profileLoading && !isChildAccessible(childId)) {
        setLoading(false);
        return;
    }

    setLoading(true);
    setError(null);

    const unsub = AppUsageRepository.subscribeToChildAppUsageForDate(
      childId,
      selectedDate,
      (data) => {
        setUsage(data);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [childId, selectedDate, profileLoading, isChildAccessible]);

  // Summary Metrics
  const summary = useMemo(() => {
    if (usage.length === 0) return null;

    const totalScreenTimeMs = usage.reduce((acc, app) => acc + app.totalTimeMs, 0);
    const mostUsedApp = usage[0]; // Already sorted by repo
    const lastActivity = usage.reduce((max, app) => Math.max(max, app.lastUsed), 0);

    return {
      totalScreenTimeMs,
      appsUsedCount: usage.length,
      mostUsedAppName: mostUsedApp.appName,
      lastActivityTimestamp: lastActivity
    };
  }, [usage]);

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);

    const today = new Date();
    if (date > today) return;

    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const setYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setSelectedDate(yesterday.toISOString().split('T')[0]);
  };

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  if (!isChildAccessible(childId)) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border-2 border-rose-100">
            <ShieldAlert size={40} className="text-rose-500" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Access Restricted</h2>
          <p className="text-slate-500 max-w-md mx-auto mt-2 italic font-medium">
            You do not have permission to view app activity for this device.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
          >
            Return to Overview
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!canViewActivity) {
      return (
          <DashboardLayout>
              <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border-2 border-rose-100">
                      <ShieldAlert size={40} className="text-rose-500" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">Permission Required</h2>
                  <p className="text-slate-500 max-w-md mx-auto mt-2 italic font-medium">
                      Your current role ({role}) does not have permission to view detailed app activity.
                  </p>
              </div>
          </DashboardLayout>
      )
  }

  return (
    <DashboardLayout>
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="text-primary-600" />
              App Activity
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Monitoring usage for <span className="text-slate-900 font-bold">{childStatus?.childName || "Loading..."}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <button
                  onClick={setToday}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    isToday ? "bg-primary-50 text-primary-600" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                    Today
                </button>
                <button
                  onClick={setYesterday}
                  className={clsx(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                    selectedDate === new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split('T')[0] ? "bg-primary-50 text-primary-600" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                    Yesterday
                </button>
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-sm">
                <button
                  onClick={() => changeDate(-1)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-2 px-2 border-x border-slate-100">
                    <CalendarIcon size={16} className="text-primary-500" />
                    <input
                      type="date"
                      value={selectedDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-sm font-bold text-slate-700 outline-none bg-transparent"
                    />
                </div>
                <button
                  onClick={() => changeDate(1)}
                  disabled={isToday}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-20"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                ))}
            </div>
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                ))}
            </div>
        </div>
      ) : error ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
            <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800">Unable to load data</h2>
            <p className="text-slate-500 mt-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-primary-600 text-white rounded-xl font-bold shadow-lg"
            >
                Retry
            </button>
        </div>
      ) : usage.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                <Activity size={40} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">No app activity recorded for this date.</h2>
            <p className="text-slate-500 max-w-sm mx-auto mt-2 italic text-sm">
              Usage data appears after the child device syncs app activity.
            </p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            <SummaryCard
              label="Total Screen Time"
              value={formatDuration(summary?.totalScreenTimeMs || 0)}
              icon={Clock}
              color="text-primary-600"
              bgColor="bg-primary-50"
            />
            <SummaryCard
              label="Apps Used"
              value={summary?.appsUsedCount.toString() || "0"}
              icon={Smartphone}
              color="text-emerald-600"
              bgColor="bg-emerald-50"
            />
            <SummaryCard
              label="Most Used App"
              value={summary?.mostUsedAppName || "None"}
              icon={BarChart3}
              color="text-orange-600"
              bgColor="bg-orange-50"
            />
            <SummaryCard
              label="Last Activity"
              value={summary?.lastActivityTimestamp ? formatLastUsed(summary.lastActivityTimestamp) : "Never"}
              icon={Activity}
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
          </div>

          {/* Usage Breakdown Chart (Horizontal Bar) */}
          <section className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Usage Breakdown</h3>
              <div className="flex h-10 w-full rounded-2xl overflow-hidden bg-slate-100 mb-8 border-4 border-white shadow-inner">
                  {usage.slice(0, 8).map((app, i) => {
                      const percentage = (app.totalTimeMs / (summary?.totalScreenTimeMs || 1)) * 100;
                      if (percentage < 2) return null;

                      const colors = [
                          'bg-primary-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500',
                          'bg-sky-500', 'bg-rose-500', 'bg-amber-500', 'bg-indigo-500'
                      ];

                      return (
                          <div
                            key={app.packageName}
                            className={clsx(colors[i % colors.length], "h-full transition-all hover:brightness-110")}
                            style={{ width: `${percentage}%` }}
                            title={`${app.appName}: ${formatDuration(app.totalTimeMs)}`}
                          />
                      );
                  })}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {usage.slice(0, 5).map((app, i) => (
                      <div key={app.packageName} className="flex items-center gap-2">
                          <div className={clsx(
                              "w-2.5 h-2.5 rounded-full",
                              ['bg-primary-500', 'bg-emerald-500', 'bg-orange-500', 'bg-purple-500', 'bg-sky-500'][i]
                          )} />
                          <span className="text-xs font-bold text-slate-600">{app.appName}</span>
                          <span className="text-[10px] font-black text-slate-400">({Math.round((app.totalTimeMs / (summary?.totalScreenTimeMs || 1)) * 100)}%)</span>
                      </div>
                  ))}
              </div>
          </section>

          {/* App List */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Detailed Activity</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase">Sorted by duration</span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {usage.map((app) => (
                <AppUsageRow
                  key={app.packageName}
                  app={app}
                  maxTimeMs={usage[0].totalTimeMs}
                  totalTimeMs={summary?.totalScreenTimeMs || 1}
                />
              ))}
            </div>
          </section>
        </div>
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

function AppUsageRow({ app, maxTimeMs, totalTimeMs }: { app: AppUsageItem, maxTimeMs: number, totalTimeMs: number }) {
  const percentage = (app.totalTimeMs / totalTimeMs) * 100;
  const relativeToMax = (app.totalTimeMs / maxTimeMs) * 100;

  return (
    <div className="group bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary-100 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-xl font-black text-slate-300 border border-slate-100 shrink-0 group-hover:bg-primary-50 group-hover:text-primary-300 transition-colors">
          {app.appName[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h4 className="font-black text-slate-800 truncate group-hover:text-primary-900 transition-colors">{app.appName}</h4>
              <p className="text-[10px] font-medium text-slate-400 truncate break-words">{app.packageName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-black text-slate-900">{formatDuration(app.totalTimeMs)}</p>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">{Math.round(percentage)}% of screen time</p>
            </div>
          </div>

          <div className="space-y-3">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${relativeToMax}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase">Last used: {formatLastUsed(app.lastUsed)}</span>
                  </div>
                  {app.category && (
                      <span className="text-[10px] font-black px-2 py-0.5 bg-slate-50 text-slate-400 rounded-md border border-slate-100 uppercase tracking-tighter">
                          {app.category}
                      </span>
                  )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
