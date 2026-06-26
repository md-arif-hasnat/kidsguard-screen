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
  Calendar,
  History,
  ShieldAlert
} from 'lucide-react';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { AuditRepository, AuditLog, AuditAction, AuditSeverity } from '@/lib/repositories/AuditRepository';
import { FamilyRepository, FamilyData, FamilyRole } from '@/lib/repositories/FamilyRepository';
import { RoleHelper } from '@/lib/utils/RoleHelper';
import { SecurityRepository } from '@/lib/repositories/SecurityRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SecurityPage() {
  const { profile, family, role, loading: profileLoading } = useParentProfile();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [indexError, setIndexError] = useState(false);

  useEffect(() => {
    if (!family?.familyId) return;

    const unsub = AuditRepository.listenToFamilyLogs(family.familyId, (data) => {
      setLogs(data);
      setLoadingLogs(false);
    });

    return () => unsub();
  }, [family?.familyId]);

  const handleAuditExport = async (format: 'JSON' | 'CSV') => {
    if (!family?.familyId || !profile) return;

    const data = await AuditRepository.getFamilyLogsForExport(family.familyId);
    let blob: Blob;
    let filename: string;

    if (format === 'JSON') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        filename = `kidsguard-security-audit-${new Date().toISOString()}.json`;
    } else {
        const header = "Timestamp,Actor,Action,Target,Severity,Details\n";
        const rows = data.map(l => {
            const date = l.createdAt?.toDate ? l.createdAt.toDate().toISOString() : new Date(l.createdAt).toISOString();
            return `${date},${l.actorEmail},${l.action},${l.targetType}:${l.targetId},${l.severity},"${l.metadata ? JSON.stringify(l.metadata).replace(/"/g, '""') : ''}"`;
        }).join("\n");
        blob = new Blob([header + rows], { type: 'text/csv' });
        filename = `kidsguard-security-audit-${new Date().toISOString()}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    await AuditRepository.log({
        actorUid: profile.uid,
        actorEmail: profile.email || "admin",
        familyId: family.familyId,
        action: AuditAction.DATA_EXPORTED,
        targetType: 'SECURITY',
        targetId: profile.uid,
        severity: AuditSeverity.NOTICE,
        metadata: { format }
    });
  };

  const handleFullExport = async () => {
    if (!family?.familyId || !profile) return;

    setLoadingLogs(true);
    try {
        const data = await SecurityRepository.exportAllFamilyData(family.familyId);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const filename = `kidsguard-full-export-${new Date().toISOString()}.json`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        await AuditRepository.log({
            actorUid: profile.uid,
            actorEmail: profile.email || "admin",
            familyId: family.familyId,
            action: AuditAction.DATA_EXPORTED,
            targetType: 'SECURITY',
            targetId: profile.uid,
            severity: AuditSeverity.NOTICE,
            metadata: { type: 'FULL_JSON' }
        });
    } catch (e) {
        alert("Export failed.");
    } finally {
        setLoadingLogs(false);
    }
  };

  const handleRetentionChange = async (days: number) => {
    if (!family?.familyId || !profile) return;

    try {
        await FamilyRepository.updateFamilySettings(family.familyId, { dataRetentionDays: days });

        await AuditRepository.log({
            actorUid: profile.uid,
            actorEmail: profile.email || "admin",
            familyId: family.familyId,
            action: AuditAction.RETENTION_POLICY_CHANGED,
            targetType: 'FAMILY',
            targetId: family.familyId,
            severity: AuditSeverity.WARNING,
            metadata: { newRetentionDays: days }
        });

        alert(`Data retention policy updated to ${days === 0 ? 'Forever' : days + ' days'}.`);
    } catch (e) {
        alert("Failed to update retention policy.");
    }
  };

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Security \u0026 Compliance</h1>
          <p className="text-slate-500 mt-1">Audit logs, session management, and data portability.</p>
        </div>
        <div className="flex gap-2">
            <button
                onClick={() => handleAuditExport('CSV')}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
                <Download size={16} />
                Export Audit CSV
            </button>
            <button
                onClick={() => handleAuditExport('JSON')}
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last 100 Events</span>
            </div>
            <div className="divide-y divide-slate-50">
              {loadingLogs ? (
                  <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary-600" /></div>
              ) : logs.length > 0 ? logs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                log.severity === AuditSeverity.CRITICAL ? "bg-rose-100 text-rose-600" :
                                log.severity === AuditSeverity.WARNING ? "bg-amber-100 text-amber-600" :
                                "bg-slate-100 text-slate-500"
                            )}>
                                <Shield size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">
                                    {log.action.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Target: <span className="font-bold">{log.targetType}</span> ({log.targetId})
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    <span className="font-bold text-slate-600">{log.actorEmail}</span> •
                                    {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Just now'}
                                </p>
                            </div>
                        </div>
                        <span className={cn(
                            "text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter",
                            log.severity === AuditSeverity.CRITICAL ? "bg-rose-50 text-rose-500" :
                            log.severity === AuditSeverity.WARNING ? "bg-amber-50 text-amber-600" :
                            "bg-slate-100 text-slate-500"
                        )}>
                            {log.severity}
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
          {/* Data Retention Policy */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
              <Calendar size={20} className="text-primary-600" />
              Data Retention
            </h3>
            <div className="space-y-3">
                {[
                    { label: '30 Days', val: 30 },
                    { label: '90 Days', val: 90 },
                    { label: '1 Year', val: 365 },
                    { label: 'Forever', val: 0 }
                ].map((p) => (
                    <button
                        key={p.val}
                        disabled={role !== FamilyRole.OWNER}
                        onClick={() => handleRetentionChange(p.val)}
                        className={cn(
                            "w-full p-4 rounded-xl border transition-all text-left text-xs font-bold flex justify-between items-center",
                            family?.settings?.dataRetentionDays === p.val ? "bg-primary-600 text-white border-primary-600" : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                        )}
                    >
                        {p.label}
                        {family?.settings?.dataRetentionDays === p.val && <UserCheck size={14} />}
                    </button>
                ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed italic">
                {role === FamilyRole.OWNER ? "Automatically purges location and activity logs older than the selected period." : "Only the Family Owner can change the retention policy."}
            </p>
          </section>

          {/* Sessions Placeholder */}
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
              <Smartphone size={20} className="text-primary-600" />
              Active Sessions
            </h3>
            <div className="space-y-4">
                <div className="p-4 bg-primary-50 border border-primary-100 rounded-2xl">
                    <p className="text-sm font-bold text-slate-800">Current Device</p>
                    <p className="text-xs text-slate-500 mt-0.5">Browser Session • {new Date().toLocaleDateString()}</p>
                    <div className="mt-3 flex justify-between items-center">
                        <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase">Active Now</span>
                    </div>
                </div>
            </div>
            <button className="w-full mt-6 text-xs font-black text-slate-400 p-3 rounded-xl border border-slate-100 cursor-not-allowed">
                Sign Out All Other Devices
            </button>
          </section>

          {/* GDPR Section */}
          <section className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/20 rounded-full -mr-16 -mt-16 blur-2xl" />
            <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                <ShieldAlert className="text-primary-400" />
                GDPR & Privacy
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
                You have the right to access and delete your personal data.
                KidsGuard processes data strictly for family safety.
            </p>
            <div className="space-y-3">
                <button
                    onClick={handleFullExport}
                    className="w-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold p-4 rounded-xl transition-all text-left flex justify-between items-center"
                >
                    Download All Data
                    <ChevronRight size={14} />
                </button>
                <button
                    className="w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-bold p-4 rounded-xl transition-all text-left flex justify-between items-center opacity-50 cursor-not-allowed"
                >
                    Request Account Deletion
                    <AlertTriangle size={14} />
                </button>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
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
