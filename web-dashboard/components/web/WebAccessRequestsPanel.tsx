import React from 'react';
import { UserPlus, Check, X, Clock, ExternalLink } from 'lucide-react';
import { WebAccessRequest } from '@/lib/repositories/WebProtectionRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface WebAccessRequestsPanelProps {
    requests: WebAccessRequest[];
    onHandle: (requestId: string, status: "APPROVED" | "DENIED", domain: string) => void;
}

export default function WebAccessRequestsPanel({ requests, onHandle }: WebAccessRequestsPanelProps) {
    const pending = requests.filter(r => r.status === "PENDING");

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden h-full">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <UserPlus className="text-primary-600" />
                    Access Requests
                </h3>
                {pending.length > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-bounce">
                        {pending.length} NEW
                    </span>
                )}
            </div>
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {requests.length > 0 ? requests.map((req) => (
                    <div key={req.requestId} className="p-6 hover:bg-slate-50 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="font-bold text-slate-800 text-lg">{req.domain}</p>
                                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                    <Clock size={12} />
                                    {new Date(req.timestamp).toLocaleString()}
                                </p>
                            </div>
                            <div className={cn(
                                "text-[10px] font-black px-2 py-1 rounded-full uppercase",
                                req.status === "PENDING" ? "bg-amber-100 text-amber-600" :
                                req.status === "APPROVED" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                            )}>
                                {req.status}
                            </div>
                        </div>

                        {req.status === "PENDING" && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onHandle(req.requestId, "APPROVED", req.domain)}
                                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Check size={18} />
                                    Approve
                                </button>
                                <button
                                    onClick={() => onHandle(req.requestId, "DENIED", req.domain)}
                                    className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <X size={18} />
                                    Deny
                                </button>
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="py-20 text-center">
                        <p className="text-slate-400 italic">No access requests found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
