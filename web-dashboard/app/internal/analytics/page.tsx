"use client";

import React, { useEffect, useState } from 'react';
import InternalLayout from '@/components/InternalLayout';
import {
  BarChart3,
  Users,
  Smartphone,
  Shield,
  Zap,
  Activity,
  Globe,
  Loader2,
  TrendingUp,
  AlertCircle,
  Clock
} from 'lucide-react';
import { AdminRepository, GlobalMetrics } from '@/lib/repositories/AdminRepository';
import { FeatureFlagRepository, FeatureFlags } from '@/lib/repositories/FeatureFlagRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState<GlobalMetrics | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubFlags = FeatureFlagRepository.listenToFlags(setFlags);

    async function load() {
      try {
        const [m, l] = await Promise.all([
          AdminRepository.getGlobalMetrics(),
          AdminRepository.getRecentAuditLogs(10)
        ]);
        setMetrics(m);
        setLogs(l);
      } catch (e) {
        console.error("Admin fetch failed", e);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => unsubFlags();
  }, []);

  if (loading) {
    return (
      <InternalLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-rose-500" size={48} />
        </div>
      </InternalLayout>
    );
  }

  return (
    <InternalLayout>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-rose-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Internal Analytics
            </div>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">System <span className="text-rose-500">Operations</span></h1>
        <p className="text-slate-500 font-medium mt-1">Real-time usage and health monitoring across the KidsGuard network.</p>
      </header>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <MetricCard icon={Users} label="Total Families" value={metrics?.totalFamilies || 0} trend="+12% this week" color="text-rose-500" bg="bg-rose-500/10" />
        <MetricCard icon={Smartphone} label="Child Devices" value={metrics?.totalChildren || 0} trend="+5% this week" color="text-emerald-500" bg="bg-emerald-500/10" />
        <MetricCard icon={Activity} label="Active Parents" value={metrics?.dailyActiveParents || 0} trend="Daily Avg" color="text-amber-500" bg="bg-amber-500/10" />
        <MetricCard icon={Shield} label="Safety Events" value={842} trend="Real-time" color="text-indigo-500" bg="bg-indigo-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            {/* System Health */}
            <section className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-sm p-8">
                <h3 className="text-lg font-black text-white flex items-center gap-2 mb-8 uppercase tracking-tight">
                    <Zap className="text-rose-500" />
                    Operations Health
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <HealthBar label="FCM Delivery Rate" value={98.4} color="bg-emerald-500" />
                    <HealthBar label="Firestore Sync Latency" value={120} max={500} unit="ms" color="bg-rose-500" />
                    <HealthBar label="Remote Command Success" value={94.1} color="bg-emerald-500" />
                    <HealthBar label="API Response Time" value={45} max={200} unit="ms" color="bg-rose-500" />
                </div>
            </section>

            {/* Global Audit Stream */}
            <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
                        <Activity className="text-rose-500" />
                        Global Security Events
                    </h3>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Feed</span>
                </div>
                <div className="divide-y divide-white/5">
                    {logs.map((log) => (
                        <div key={log.id} className="p-6 hover:bg-white/5 transition-colors group">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 group-hover:text-rose-500 transition-colors">
                                        <Clock size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-200">{log.action}</p>
                                        <p className="text-xs text-slate-500 mt-1">{log.actorEmail} • Family: {log.familyId.substring(0,8)}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-black text-slate-500">{log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString() : 'Recent'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>

        <div className="space-y-8">
            {/* Usage by Region */}
            <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-sm p-8">
                <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6 uppercase tracking-tight">
                    <Globe className="text-rose-500" />
                    Market Coverage
                </h3>
                <div className="space-y-4">
                    <RegionItem label="Europe (DE)" percentage={42} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.42) : 0} />
                    <RegionItem label="North America (US)" percentage={35} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.35) : 0} />
                    <RegionItem label="South Asia (BD)" percentage={18} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.18) : 0} />
                    <RegionItem label="Other" percentage={5} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.05) : 0} />
                </div>
            </section>

            {/* Feature Flags */}
            <section className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8">
                <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6 uppercase tracking-tight">
                    <Zap className="text-amber-500" />
                    Feature Rollout
                </h3>
                <div className="space-y-3">
                    <FlagToggle label="AI Insights" enabled={flags?.enableAiInsights ?? false} />
                    <FlagToggle label="Protection Modes" enabled={flags?.enableProtectionModes ?? false} />
                    <FlagToggle label="Web Filtering" enabled={flags?.enableWebFiltering ?? false} />
                    <FlagToggle label="Beta Enrollment" enabled={flags?.betaEnrollmentOpen ?? false} />
                </div>
            </section>
        </div>
      </div>
    </InternalLayout>
  );
}

function FlagToggle({ label, enabled }: { label: string, enabled: boolean }) {
    return (
        <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
            <span className="text-xs font-black text-slate-400 uppercase tracking-tight">{label}</span>
            <div className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                enabled ? "bg-emerald-500" : "bg-slate-800"
            )}>
                <div className={cn("w-3 h-3 bg-white rounded-full absolute top-1 transition-all", enabled ? "left-6" : "left-1")} />
            </div>
        </div>
    )
}

function MetricCard({ icon: Icon, label, value, trend, color, bg }: any) {
    return (
        <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-sm flex flex-col gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", bg, color)}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-4xl font-black text-white tracking-tight">{value}</p>
                <p className="text-[10px] font-bold text-emerald-500 mt-2 flex items-center gap-1">
                    <TrendingUp size={12} />
                    {trend}
                </p>
            </div>
        </div>
    );
}

function HealthBar({ label, value, max = 100, unit = "%", color }: any) {
    const percentage = Math.min((value / max) * 100, 100);
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                <span className="text-slate-500">{label}</span>
                <span className="text-white">{value}{unit}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000 shadow-lg", color)} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    )
}

function RegionItem({ label, percentage, count }: any) {
    return (
        <div className="flex items-center gap-4 text-slate-300">
            <div className="flex-1">
                <p className="text-xs font-bold">{label}</p>
                <div className="h-1 w-full bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className="text-xs font-black text-white">{count}</p>
                <p className="text-[9px] font-bold text-slate-500">{percentage}%</p>
            </div>
        </div>
    )
}
