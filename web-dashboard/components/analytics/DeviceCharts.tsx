"use client";

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import { DeviceAnalytics } from '@/lib/repositories/AnalyticsRepository';
import {
    Activity as ActivityIcon,
    Clock,
    Navigation,
    Zap,
    AlertTriangle,
    ShieldCheck,
    FastForward,
    MapPin
} from 'lucide-react';
import { formatDuration } from '@/lib/utils/GeofenceUtils';
import { clsx } from 'clsx';

interface DeviceChartsProps {
    data: DeviceAnalytics;
}

export default function DeviceCharts({ data }: DeviceChartsProps) {
    const batteryData = data.batteryHistory.map(h => ({
        time: new Date(h.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        level: h.p,
        charging: h.c
    }));

    const usageData = [
        { name: 'Online', value: data.onlineMinutes, color: '#0ea5e9' },
        { name: 'Movement', value: data.movementMinutes, color: '#10b981' },
        { name: 'Stationary', value: data.stationaryMinutes, color: '#64748b' }
    ];

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-500';
        if (score >= 70) return 'text-primary-500';
        if (score >= 50) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 90) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 50) return 'Warning';
        return 'Critical';
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Safety Score */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Safety Score</p>
                    <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-50" />
                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                                className={getScoreColor(data.safetyScore)}
                                strokeDasharray={364}
                                strokeDashoffset={364 - (364 * data.safetyScore) / 100}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={clsx("text-4xl font-black", getScoreColor(data.safetyScore))}>{data.safetyScore}</span>
                    </div>
                    <h4 className="font-bold text-slate-900">{getScoreLabel(data.safetyScore)}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Daily Compliance Level</p>
                </div>

                {/* Performance Metrics */}
                <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard label="Distance" value={`${(data.distanceTravelledMeters / 1000).toFixed(1)} km`} icon={Navigation} color="text-blue-500" />
                    <MetricCard label="Avg Speed" value={`${data.avgSpeedKmh.toFixed(1)} km/h`} icon={Zap} color="text-emerald-500" />
                    <MetricCard label="Alerts" value={data.alertCount.toString()} icon={AlertTriangle} color="text-rose-500" />
                    <MetricCard label="Zone Visits" value={data.safeZoneVisits.toString()} icon={ShieldCheck} color="text-primary-500" />
                    <MetricCard label="Online" value={formatDuration(data.onlineMinutes)} icon={Clock} color="text-sky-500" />
                    <MetricCard label="Moving" value={formatDuration(data.movementMinutes)} icon={ActivityIcon} color="text-indigo-500" />
                    <MetricCard label="Max Speed" value={`${data.maxSpeedKmh.toFixed(1)} km/h`} icon={FastForward} color="text-amber-500" />
                    <MetricCard label="Stops" value={data.stationaryMinutes > 60 ? Math.floor(data.stationaryMinutes / 30).toString() : '0'} icon={MapPin} color="text-slate-500" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Battery Graph */}
                <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Zap size={20} className="text-amber-500" />
                            Battery Performance
                        </h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">24h Log</span>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={batteryData}>
                                <defs>
                                    <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} minTickGap={30} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ fontWeight: 800, color: '#1e293b' }}
                                />
                                <Area type="monotone" dataKey="level" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorLevel)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Usage Distribution */}
                <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <Clock size={20} className="text-primary-500" />
                            Device Usage Activity
                        </h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate Time</span>
                    </div>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usageData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 800, fill: '#475569'}} />
                                <Tooltip
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                                    {usageData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2 hover:border-primary-100 transition-colors">
            <div className="flex items-center gap-2">
                <Icon size={14} className={color} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-lg font-black text-slate-900">{value}</span>
        </div>
    )
}
