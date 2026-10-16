import React from 'react';
import { Globe, ShieldAlert, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { WebActivityEvent } from '@/lib/repositories/WebProtectionRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface WebActivityPanelProps {
    events: WebActivityEvent[];
}

export default function WebActivityPanel({ events }: WebActivityPanelProps) {
    return (
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:rounded-[2rem]">
            <div className="border-b border-slate-100 p-4 sm:p-6 md:p-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Globe className="text-primary-600" />
                    Web Browsing Activity
                </h3>
            </div>
            <div className="divide-y divide-slate-50">
                {(events ?? []).length > 0 ? (events ?? []).map((event, i) => (
                    <div key={i} className="group flex min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                                event.status === "BLOCKED" ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"
                            )}>
                                {event.status === "BLOCKED" ? <ShieldAlert size={24} /> : <Globe size={24} />}
                            </div>
                            <div className="min-w-0">
                                <p className="break-all font-bold text-slate-800">{event.domain}</p>
                                <p className="break-words text-xs font-medium text-slate-500">{event.category} • {event.browserApp.split('.').pop()}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 pl-[60px] text-left sm:block sm:pl-0 sm:text-right">
                            <p className="text-xs font-bold text-slate-400">
                                {new Date(event.timestamp).toLocaleTimeString()}
                            </p>
                            <span className={cn(
                                "text-[10px] font-black uppercase px-2 py-0.5 rounded-full mt-1 inline-block",
                                event.status === "BLOCKED" ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                            )}>
                                {event.status}
                            </span>
                        </div>
                    </div>
                )) : (
                    <div className="py-20 text-center">
                        <p className="text-slate-400 italic">No web activity recorded for today.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
