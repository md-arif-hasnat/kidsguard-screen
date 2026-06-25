"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Shield,
  Lock,
  Clock,
  UserCheck,
  AlertTriangle,
  Smartphone,
  Fingerprint,
  LogOut,
  ChevronRight,
  Loader2,
  FileText,
  Download,
  Calendar
} from 'lucide-react';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { AuditRepository, AuditLog, AuditAction } from '@/lib/repositories/AuditRepository';
import { DataRetentionRepository, RetentionPeriod } from '@/lib/repositories/DataRetentionRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FamilyRepository, FamilyData } from '@/lib/repositories/FamilyRepository';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SecurityPage() {
  const { profile } = useParentProfile();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.familyId) {
      setLoading(false);
      return;
    }

    const unsubLogs = AuditRepository.listenToFamilyLogs(profile.familyId, (data) => {
      setLogs(data);
      setLoading(false);
    });

    const unsubFamily = FamilyRepository.listenToFamily(profile.familyId, setFamily);

    return () => {
        unsubLogs();
        unsubFamily();
    };
  }, [profile]);

  const handleRetentionChange = async (period: RetentionPeriod) => {
    if (!profile?.familyId) return;
    await DataRetentionRepository.updateRetentionPolicy(profile.familyId, period);

    await AuditRepository.log({
        familyId: profile.familyId,
        actorUid: profile.uid,
        actorName: profile.displayName || "Admin",
        action: AuditAction.SETTINGS_CHANGED,
        details: `Updated data retention to ${period}`
    });
  };

  const handleExport = async (format: 'JSON' | 'CSV') => {
    if (!profile?.familyId) return;

    const data = await AuditRepository.getLogsForExport(profile.familyId);
    let blob: Blob;
    let filename: string;

    if (format === 'JSON') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `kidsguard-audit-${new Date().toISOString()}.json`;
    } else {
        const header = "Timestamp,Actor,Action,Target,Details\n";
        const rows = data.map(l => `${l.timestamp?.toDate?.() || l.timestamp},${l.actorName},${l.action},${l.targetId || ''},"${l.details}"`).join("\n");
        blob = new Blob([header + rows], { type: 'text/csv' });
        filename = `kidsguard-audit-${new Date().toISOString()}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    await AuditRepository.log({
        familyId: profile.familyId,
        actorUid: profile.uid,
        actorName: profile.displayName || "Admin",
        action: AuditAction.DATA_EXPORTED,
        details: `Exported audit logs as ${format}`
    });
  };

  return (
    <DashboardLayout>
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Security \u0026 Compliance</h1>
          <p className="text-slate-500 mt-1">Audit logs, session management, and data export.</p>
        </div>
        <div className="flex gap-2">
            <button
                onClick={() => handleExport('CSV')}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
                <Download size={16} />
                Export CSV
            </button>
            <button
                onClick={() => handleExport('JSON')}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
            >
                <FileText size={16} />
                JSON
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Audit Logs */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Clock className="text-primary-600" />
                Security Audit Log
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last 50 Events</span>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                  <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary-600" /></div>
              ) : logs.length > 0 ? logs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                log.action === AuditAction.LOGIN_FAILED ? "bg-rose-50 text-rose-500" :
                                log.action === AuditAction.REMOTE_COMMAND_SENT ? "bg-amber-50 text-amber-500" :
                                "bg-slate-100 text-slate-500"
                            )}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">{log.details}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    <span className="font-bold text-slate-600">{log.actorName}</span> •
                                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Just now'}
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-black px-2 py-1 bg-slate-100 text-slate-500 rounded-full uppercase">
                            {log.action.replace('_', ' ')}
                        </span>
                    </div>
                </div>
              )) : (
                <div className="p-20 text-center text-slate-400 italic font-medium">No security events recorded.</div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Active Sessions */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
              <Smartphone className="text-primary-600" />
              Active Sessions
            </h3>
            <div className="space-y-4">
                <SessionItem
                    device="MacBook Pro"
                    browser="Chrome (Current)"
                    location="Berlin, Germany"
                    ip="92.117.xx.xx"
                    active
                />
                <SessionItem
                    device="iPhone 15"
                    browser="KidsGuard App"
                    location="Berlin, Germany"
                    ip="188.22.xx.xx"
                />
            </div>
            <button className="w-full mt-6 text-xs font-black text-rose-600 hover:bg-rose-50 p-3 rounded-xl transition-all uppercase border border-rose-100">
                Sign Out All Other Devices
            </button>
          </section>

          {/* Data Retention */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
              <Calendar size={20} className="text-primary-600" />
              Data Retention
            </h3>
            <div className="space-y-3">
                {(['30_DAYS', '90_DAYS', '1_YEAR', 'FOREVER'] as RetentionPeriod[]).map((p) => (
                    <button
                        key={p}
                        onClick={() => handleRetentionChange(p)}
                        className={cn(
                            "w-full p-4 rounded-xl border transition-all text-left text-xs font-bold",
                            (family as any)?.settings?.dataRetention === p ? "bg-primary-600 text-white border-primary-600" : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                        )}
                    >
                        {p.replace('_', ' ')}
                    </button>
                ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
                Automatically purges location and activity logs older than the selected period.
            </p>
          </section>

          {/* Privacy \u0026 Compliance */}
          <section className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/20 rounded-full -mr-16 -mt-16 blur-2xl" />
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <Shield className="text-primary-400" />
                GDPR Compliance
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
                You have the right to access and delete your personal data.
                KidsGuard processes data strictly for child safety.
            </p>
            <div className="space-y-3">
                <button className="w-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold p-4 rounded-xl transition-all text-left flex justify-between items-center">
                    Download My Data
                    <ChevronRight size={14} />
                </button>
                <button className="w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-bold p-4 rounded-xl transition-all text-left flex justify-between items-center">
                    Delete My Account
                    <AlertTriangle size={14} />
                </button>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SessionItem({ device, browser, location, ip, active }: any) {
    return (
        <div className={cn(
            "p-4 rounded-2xl border transition-all",
            active ? "bg-primary-50 border-primary-100" : "bg-slate-50 border-slate-100"
        )}>
            <div className="flex items-center gap-3 mb-2">
                <div className={cn("p-2 rounded-lg", active ? "bg-primary-500 text-white" : "bg-slate-200 text-slate-500")}>
                    <Smartphone size={16} />
                </div>
                <div>
                    <p className="font-bold text-slate-800 text-sm">{device}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{browser}</p>
                </div>
            </div>
            <div className="flex justify-between items-end">
                <div className="text-[10px] text-slate-500 font-medium">
                    <p>{location}</p>
                    <p className="font-mono">{ip}</p>
                </div>
                {active ? (
                    <span className="text-[8px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">Current</span>
                ) : (
                    <button className="text-[8px] font-black text-rose-500 hover:underline uppercase">Revoke</button>
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                active ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
        >
            <Icon size={18} />
            {label}
        </button>
    )
}
