"use client";

import React from 'react';
import {
    Battery,
    Wifi,
    Globe,
    HardDrive,
    Cpu,
    Thermometer,
    Navigation,
    Bluetooth,
    Smartphone,
    Database,
    Zap,
    Signal,
    AlertTriangle,
    ShieldCheck,
    ShieldAlert,
    RefreshCw
} from 'lucide-react';
import { ChildStatus } from '@/lib/repositories/ChildRepository';
import { clsx } from 'clsx';

interface HealthCardProps {
    status: ChildStatus;
}

export default function HealthCard({ status }: HealthCardProps) {
    const formatBytes = (bytes: number = 0) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const storageUsage = status.storageTotalBytes ? (status.storageUsedBytes || 0) / status.storageTotalBytes : 0;
    const ramUsage = status.ramTotalBytes ? (status.ramUsedBytes || 0) / status.ramTotalBytes : 0;
    const permissions = [
        ['Location', status.locationPermissionGranted],
        ['Background location', status.backgroundLocationPermissionGranted],
        ['Usage access', status.usageAccessGranted],
        ['Display overlay', status.overlayPermissionGranted],
        ['Accessibility', status.accessibilityPermissionGranted],
        ['Battery exemption', status.batteryOptimizationExempt],
        ['Notifications', status.notificationPermissionGranted],
        ['Microphone', status.microphonePermissionGranted]
    ] as const;
    const permissionsReported = permissions.some(([, granted]) => typeof granted === 'boolean');
    const missingPermissionCount = permissions.filter(([, granted]) => granted === false).length;
    const syncStatusReported = typeof status.syncHealthy === 'boolean';
    const lastSuccessfulSync = Number(status.lastSuccessfulDataSyncAt || 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {status.syncHealthy === false && (
                <div className="md:col-span-2 lg:col-span-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-4">
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                        <AlertTriangle size={22} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-black text-amber-900">
                            Child data sync needs attention
                        </h3>
                        <p className="mt-1 text-sm font-medium text-amber-800">
                            {status.syncFailureSource?.replace(/_/g, ' ') || 'Background sync'} failed {status.syncFailureCount || 0} consecutive times.
                            {' '}Check the child phone&apos;s internet connection and open KidsGuard once.
                        </p>
                        {status.lastSyncFailureAt ? (
                            <p className="mt-2 text-[11px] font-bold text-amber-700">
                                Last failure: {new Date(status.lastSyncFailureAt).toLocaleString()}
                            </p>
                        ) : null}
                    </div>
                </div>
            )}
            <div className="md:col-span-2 lg:col-span-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="flex items-center gap-2 font-bold text-slate-900">
                        {missingPermissionCount > 0 ? (
                            <ShieldAlert size={19} className="text-rose-500" />
                        ) : (
                            <ShieldCheck size={19} className="text-emerald-500" />
                        )}
                        Permission Health
                    </h3>
                    <span className={clsx(
                        "w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider",
                        !permissionsReported
                            ? "bg-slate-100 text-slate-500"
                            : missingPermissionCount > 0
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
                    )}>
                        {!permissionsReported
                            ? 'Awaiting child update'
                            : missingPermissionCount > 0
                            ? `${missingPermissionCount} need attention`
                            : 'All required access active'}
                    </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {permissions.map(([label, granted]) => (
                        <PermissionBadge
                            key={label}
                            label={label}
                            granted={granted}
                        />
                    ))}
                </div>
                {missingPermissionCount > 0 && (
                    <p className="mt-4 text-xs font-medium text-rose-600">
                        Open KidsGuard on the child phone and restore the permissions marked Off.
                    </p>
                )}
            </div>
            {/* Battery & Thermal */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Battery size={18} className="text-primary-600" />
                        Power & Thermal
                    </h3>
                    <span className={clsx(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded",
                        status.charging ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                    )}>
                        {status.charging ? 'Charging' : 'Unplugged'}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <HealthItem label="Battery" value={`${status.batteryPercent}%`} sub={status.charging ? 'Fast' : 'Normal'} />
                    <HealthItem label="Temp" value={`${status.batteryTemp?.toFixed(1) || '--'}°C`} sub="Safe Range" />
                </div>
            </div>

            {/* Connectivity */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Signal size={18} className="text-primary-600" />
                    Connectivity
                </h3>
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <HealthItem
                        label="Network"
                        value={status.internetType || 'NONE'}
                        icon={status.internetType === 'WIFI' ? Wifi : Globe}
                        sub={status.wifiSsid || 'Mobile Data'}
                    />
                    <HealthItem
                        label="GPS Status"
                        value={status.gpsEnabled ? 'Active' : 'Disabled'}
                        icon={Navigation}
                        sub="Location Engine"
                        active={status.gpsEnabled}
                    />
                </div>
            </div>

            {/* Resources */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 md:col-span-2 lg:col-span-1">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Database size={18} className="text-primary-600" />
                    Resources
                </h3>
                <div className="space-y-4">
                    <ResourceBar
                        label="Storage"
                        used={status.storageUsedBytes || 0}
                        total={status.storageTotalBytes || 0}
                        formatter={formatBytes}
                    />
                    <ResourceBar
                        label="RAM"
                        used={status.ramUsedBytes || 0}
                        total={status.ramTotalBytes || 0}
                        formatter={formatBytes}
                    />
                </div>
            </div>

            {/* Data sync diagnostics */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 md:col-span-2 lg:col-span-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <RefreshCw size={18} className="text-primary-600" />
                        Data Sync
                    </h3>
                    <span className={clsx(
                        "w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider",
                        !syncStatusReported
                            ? "bg-slate-100 text-slate-500"
                            : status.syncHealthy
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                    )}>
                        {!syncStatusReported
                            ? 'Awaiting child update'
                            : status.syncHealthy
                            ? 'Healthy'
                            : 'Needs attention'}
                    </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <SyncDetail
                        label="Last successful data sync"
                        value={lastSuccessfulSync > 0
                            ? new Date(lastSuccessfulSync).toLocaleString()
                            : syncStatusReported
                            ? 'Waiting for first sync'
                            : 'Unknown'}
                    />
                    <SyncDetail
                        label="Consecutive failures"
                        value={syncStatusReported
                            ? String(status.syncFailureCount || 0)
                            : 'Unknown'}
                    />
                    <SyncDetail
                        label="Affected source"
                        value={status.syncFailureSource
                            ? status.syncFailureSource.replace(/_/g, ' ')
                            : syncStatusReported
                            ? 'None'
                            : 'Unknown'}
                    />
                </div>
            </div>

            {/* Device Info */}
            <div className="lg:col-span-3 bg-slate-900 rounded-3xl p-8 text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-xl shadow-slate-900/20">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                        <Smartphone size={32} className="text-primary-400" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-primary-400 uppercase tracking-[0.2em]">Device Model</p>
                        <h4 className="text-2xl font-black">{status.deviceName || 'Android Device'}</h4>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center md:text-left">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Android OS</p>
                        <p className="font-black text-lg">v{status.androidVersion || '13'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">App Version</p>
                        <p className="font-black text-lg">v{status.appVersion || '1.0.0'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Last Seen</p>
                        <p className="font-black text-lg">{new Date(status.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
                        <div className="flex items-center gap-2 justify-center md:justify-start">
                            <div className={clsx("w-2 h-2 rounded-full", status.online ? "bg-emerald-500" : "bg-rose-500")} />
                            <span className="font-black text-lg">{status.online ? 'ONLINE' : 'OFFLINE'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SyncDetail({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {label}
            </p>
            <p className="mt-1 break-words text-sm font-black text-slate-800">
                {value}
            </p>
        </div>
    );
}

function PermissionBadge({
    label,
    granted
}: {
    label: string;
    granted: boolean | undefined;
}) {
    const unknown = typeof granted !== 'boolean';
    return (
        <div className={clsx(
            "rounded-2xl border px-4 py-3",
            unknown
                ? "border-slate-100 bg-slate-50"
                : granted
                ? "border-emerald-100 bg-emerald-50"
                : "border-rose-100 bg-rose-50"
        )}>
            <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-500">
                {label}
            </p>
            <p className={clsx(
                "mt-1 text-sm font-black",
                unknown
                    ? "text-slate-400"
                    : granted
                    ? "text-emerald-700"
                    : "text-rose-700"
            )}>
                {unknown ? 'Unknown' : granted ? 'On' : 'Off'}
            </p>
        </div>
    );
}

function HealthItem({ label, value, sub, icon: Icon, active = true }: any) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={14} className={active ? "text-primary-500" : "text-slate-400"} />}
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
            </div>
            <p className="text-lg font-black text-slate-900 leading-none">{value}</p>
            <p className="text-[10px] font-bold text-slate-500">{sub}</p>
        </div>
    )
}

function ResourceBar({ label, used, total, formatter }: any) {
    const pct = total > 0 ? (used / total) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{label}</span>
                <span className="text-[10px] font-bold text-slate-400">{formatter(used)} / {formatter(total)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                <div
                    className={clsx(
                        "h-full transition-all duration-1000",
                        pct > 90 ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-primary-500"
                    )}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}
