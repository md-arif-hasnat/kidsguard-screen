import React from 'react';
import { Clock, TrendingUp, Calendar } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ScreenTimeStatsProps {
    todayMs: number;
    yesterdayMs: number;
    avg7DayMs: number;
    recordedDays: number;
    loading?: boolean;
}

export default function ScreenTimeStats({
    todayMs,
    yesterdayMs,
    avg7DayMs,
    recordedDays,
    loading = false,
}: ScreenTimeStatsProps) {
    const formatTime = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['Today', 'Yesterday', '7-Day Average'].map((label) => (
                    <div
                        key={label}
                        className="h-52 animate-pulse rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm"
                    >
                        <div className="mb-12 h-12 w-12 rounded-2xl bg-slate-200" />
                        <div className="mb-3 h-3 w-24 rounded bg-slate-200" />
                        <div className="h-9 w-32 rounded bg-slate-200" />
                    </div>
                ))}
            </div>
        );
    }

    const hasData = recordedDays > 0;
    const diff = todayMs - yesterdayMs;
    const trend = diff > 0 ? 'up' : diff < 0 ? 'down' : undefined;
    const comparison =
        yesterdayMs <= 0
            ? 'No usage recorded yesterday'
            : diff === 0
              ? 'No change vs yesterday'
              : `${diff > 0 ? '+' : '-'}${Math.round(Math.abs(diff) / 60000)}m vs yesterday`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
                label="Today's Screen Time"
                value={hasData ? formatTime(todayMs) : 'No data'}
                subValue={hasData ? comparison : 'Waiting for usage data from the child device'}
                icon={Clock}
                color="bg-primary-600"
                trend={hasData ? trend : undefined}
            />
            <StatCard
                label="Yesterday"
                value={hasData ? formatTime(yesterdayMs) : 'No data'}
                subValue={hasData && yesterdayMs === 0 ? 'No usage recorded' : undefined}
                icon={Calendar}
                color="bg-slate-700"
            />
            <StatCard
                label="7-Day Average"
                value={hasData ? formatTime(avg7DayMs) : 'No data'}
                subValue={
                    hasData
                        ? `Based on ${recordedDays} recorded day${recordedDays === 1 ? '' : 's'}`
                        : 'No usage recorded in the last 7 days'
                }
                icon={TrendingUp}
                color="bg-indigo-600"
            />
        </div>
    );
}

interface StatCardProps {
    label: string;
    value: string;
    subValue?: string;
    icon: React.ElementType;
    color: string;
    trend?: 'up' | 'down';
}

function StatCard({ label, value, subValue, icon: Icon, color, trend }: StatCardProps) {
    return (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-6">
                <div className={cn("p-3 rounded-2xl text-white shadow-lg", color)}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded-full uppercase",
                        trend === 'up' ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                        {trend === 'up' ? "Increased" : "Decreased"}
                    </span>
                )}
            </div>
            <div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-1">{label}</p>
                <h3 className="text-3xl font-black text-slate-800">{value}</h3>
                {subValue && <p className="text-xs text-slate-400 font-medium mt-1">{subValue}</p>}
            </div>
        </div>
    );
}
