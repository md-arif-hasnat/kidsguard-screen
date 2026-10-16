import React from 'react';
import { Smartphone, Clock, Layout, ExternalLink } from 'lucide-react';

export interface AppUsage {
    packageName: string;
    appName: string;
    category: string;
    totalTimeMs: number;
    lastUsed: number;
}

interface AppUsagePanelProps {
    usage: AppUsage[];
}

export default function AppUsagePanel({ usage }: AppUsagePanelProps) {
    const formatTime = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const sortedUsage = [...(usage ?? [])].sort((a, b) => b.totalTimeMs - a.totalTimeMs);

    return (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:rounded-[2rem]">
            <div className="border-b border-slate-100 p-4 sm:p-6 md:p-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Smartphone className="text-primary-600" />
                    App Usage Breakdown
                </h3>
            </div>
            <div className="divide-y divide-slate-50">
                {sortedUsage.length > 0 ? sortedUsage.map((app) => (
                    <div key={app.packageName} className="group flex min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                                <Layout size={24} />
                            </div>
                            <div className="min-w-0">
                                <p className="break-words font-bold text-slate-800">{app.appName}</p>
                                <p className="break-all text-xs font-medium text-slate-500">{app.category} • {app.packageName}</p>
                            </div>
                        </div>
                        <div className="pl-[60px] text-left sm:pl-0 sm:text-right">
                            <p className="font-black text-slate-700">{formatTime(app.totalTimeMs)}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Screen Time</p>
                        </div>
                    </div>
                )) : (
                    <div className="py-20 text-center">
                        <p className="text-slate-400 italic">No app usage data recorded for this date.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
