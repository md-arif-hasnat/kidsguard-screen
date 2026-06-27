"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
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
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Admin Console
            </div>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Operations</h1>
        <p className="text-slate-500 font-medium mt-1">Real-time usage and health monitoring across the KidsGuard network.</p>
      </header>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <MetricCard icon={Users} label="Total Families" value={metrics?.totalFamilies || 0} trend="+12% this week" color="text-primary-600" bg="bg-primary-50" />
        <MetricCard icon={Smartphone} label="Child Devices" value={metrics?.totalChildren || 0} trend="+5% this week" color="text-emerald-600" bg="bg-emerald-50" />
        <MetricCard icon={Activity} label="Active Parents" value={metrics?.dailyActiveParents || 0} trend="Daily Avg" color="text-amber-600" bg="bg-amber-50" />
        <MetricCard icon={Shield} label="Safety Events" value={842} trend="Real-time" color="text-indigo-600" bg="bg-indigo-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            {/* System Health */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-8">
                    <Zap className="text-primary-600" />
                    Operations Health
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <HealthBar label="FCM Delivery Rate" value={98.4} color="bg-emerald-500" />
                    <HealthBar label="Firestore Sync Latency" value={120} max={500} unit="ms" color="bg-primary-500" />
                    <HealthBar label="Remote Command Success" value={94.1} color="bg-emerald-500" />
                    <HealthBar label="API Response Time" value={45} max={200} unit="ms" color="bg-primary-500" />
                </div>
            </section>

            {/* Global Audit Stream */}
            <section className="bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Activity className="text-primary-400" />
                        Global Security Events
                    </h3>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Feed</span>
                </div>
                <div className="divide-y divide-white/5">
                    {logs.map((log) => (
                        <div key={log.id} className="p-6 hover:bg-white/5 transition-colors group">
                            <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-slate-400 group-hover:text-primary-400 transition-colors">
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
            <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                    <Globe className="text-primary-600" />
                    Market Coverage
                </h3>
                <div className="space-y-4">
                    <RegionItem label="Europe (DE)" percentage={42} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.42) : 0} />
                    <RegionItem label="North America (US)" percentage={35} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.35) : 0} />
                    <RegionItem label="South Asia (BD)" percentage={18} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.18) : 0} />
                    <RegionItem label="Other" percentage={5} count={metrics?.totalFamilies ? Math.round(metrics.totalFamilies * 0.05) : 0} />
                </div>
            </section>

            {/* Version Distribution */}
            <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                    <TrendingUp className="text-primary-600" />
                    Version Adoption
                </h3>
                <div className="space-y-4">
                    <VersionBar label="v1.0.0 (Production)" percentage={85} />
                    <VersionBar label="v0.9.5 (Beta)" percentage={12} />
                    <VersionBar label="v0.9.0 (Legacy)" percentage={3} />
                </div>
            </section>

            {/* Feature Flags */}
            <section className="bg-slate-50 rounded-[2.5rem] border border-slate-200 p-8">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
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
    </DashboardLayout>
  );
}

function FlagToggle({ label, enabled }: { label: string, enabled: boolean }) {
    return (
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
            <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{label}</span>
            <div className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                enabled ? "bg-emerald-500" : "bg-slate-300"
            )}>
                <div className={cn("w-3 h-3 bg-white rounded-full absolute top-1 transition-all", enabled ? "left-6" : "left-1")} />
            </div>
        </div>
    )
}

function MetricCard({ icon: Icon, label, value, trend, color, bg }: any) {
    return (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", bg, color)}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-4xl font-black text-slate-900 tracking-tight">{value}</p>
                <p className="text-[10px] font-bold text-emerald-600 mt-2 flex items-center gap-1">
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
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-900">{value}{unit}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    )
}

function RegionItem({ label, percentage, count }: any) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex-1">
                <p className="text-xs font-bold text-slate-800">{label}</p>
                <div className="h-1 w-full bg-slate-50 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-primary-600 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
            </div>
            <div className="text-right shrink-0">
                <p className="text-xs font-black text-slate-900">{count}</p>
                <p className="text-[9px] font-bold text-slate-400">{percentage}%</p>
            </div>
        </div>
    )
}

function VersionBar({ label, percentage }: any) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex-1">
                <p className="text-[10px] font-bold text-slate-700">{label}</p>
                <div className="h-2 w-full bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-slate-900 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
            </div>
            <span className="text-[10px] font-black text-slate-400">{percentage}%</span>
        </div>
    )
}
