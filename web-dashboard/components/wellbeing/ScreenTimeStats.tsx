import React from 'react';
import { Clock, TrendingUp, Calendar, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ScreenTimeStatsProps {
    todayMs: number;
    yesterdayMs: number;
    avg7DayMs: number;
}

export default function ScreenTimeStats({ todayMs, yesterdayMs, avg7DayMs }: ScreenTimeStatsProps) {
    const formatTime = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return { hours, minutes };
    };

    const today = formatTime(todayMs);
    const diff = todayMs - yesterdayMs;
    const isMore = diff > 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
                label="Today's Screen Time"
                value={`${today.hours}h ${today.minutes}m`}
                subValue={isMore ? `+${Math.round(Math.abs(diff)/60000)}m vs yesterday` : `-${Math.round(Math.abs(diff)/60000)}m vs yesterday`}
                icon={Clock}
                color="bg-primary-600"
                trend={isMore ? 'up' : 'down'}
            />
            <StatCard
                label="Yesterday"
                value={`${formatTime(yesterdayMs).hours}h ${formatTime(yesterdayMs).minutes}m`}
                icon={Calendar}
                color="bg-slate-700"
            />
            <StatCard
                label="7-Day Average"
                value={`${formatTime(avg7DayMs).hours}h ${formatTime(avg7DayMs).minutes}m`}
                icon={TrendingUp}
                color="bg-indigo-600"
            />
        </div>
    );
}

function StatCard({ label, value, subValue, icon: Icon, color, trend }: any) {
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
