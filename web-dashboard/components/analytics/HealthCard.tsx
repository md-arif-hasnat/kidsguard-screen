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
    Signal
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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
