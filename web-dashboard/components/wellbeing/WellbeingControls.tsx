import React from 'react';
import { ShieldAlert, ShieldCheck, Lock, Unlock, Timer, Trash2, Plus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface AppLimit {
    packageName: string;
    appName: string;
    dailyLimitMs: number;
    enabled: boolean;
}

export interface BlockRule {
    packageName: string;
    appName: string;
    isBlocked: boolean;
}

interface WellbeingControlsProps {
    limits: AppLimit[];
    blocks: BlockRule[];
    onUpdateLimit: (limit: AppLimit) => void;
    onDeleteLimit: (packageName: String) => void;
    onToggleBlock: (packageName: String, isBlocked: boolean) => void;
}

export default function WellbeingControls({ limits, blocks, onUpdateLimit, onDeleteLimit, onToggleBlock }: WellbeingControlsProps) {
    return (
        <div className="space-y-8">
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Timer className="text-primary-600" />
                        App Time Limits
                    </h3>
                    <button className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-2 rounded-xl transition-colors">
                        <Plus size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {(limits ?? []).length > 0 ? (limits ?? []).map((limit) => (
                        <div key={limit.packageName} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary-600">
                                    <Timer size={20} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{limit.appName}</p>
                                    <p className="text-xs text-slate-500 font-medium">{Math.floor(limit.dailyLimitMs / 60000)} mins per day</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 text-slate-400 hover:text-rose-500 transition-colors" onClick={() => onDeleteLimit(limit.packageName)}>
                                    <Trash2 size={18} />
                                </button>
                                <Switch enabled={limit.enabled} onChange={() => onUpdateLimit({...limit, enabled: !limit.enabled})} />
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-slate-400 text-sm py-4 italic">No active time limits.</p>
                    )}
                </div>
            </section>

            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-8">
                    <ShieldAlert className="text-rose-600" />
                    App Blocking
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(blocks ?? []).map((block) => (
                        <div key={block.packageName} className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border transition-all",
                            block.isBlocked ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-2 rounded-xl",
                                    block.isBlocked ? "bg-rose-500 text-white" : "bg-white text-slate-400 shadow-sm"
                                )}>
                                    {block.isBlocked ? <Lock size={18} /> : <Unlock size={18} />}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{block.appName}</p>
                                    <p className={cn("text-[10px] font-black uppercase", block.isBlocked ? "text-rose-600" : "text-slate-400")}>
                                        {block.isBlocked ? "Blocked" : "Allowed"}
                                    </p>
                                </div>
                            </div>
                            <Switch enabled={block.isBlocked} onChange={() => onToggleBlock(block.packageName, !block.isBlocked)} danger />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

function Switch({ enabled, onChange, danger }: { enabled: boolean, onChange: () => void, danger?: boolean }) {
    return (
        <button
            onClick={onChange}
            className={cn(
                "w-12 h-6 rounded-full relative transition-colors",
                enabled ? (danger ? "bg-rose-500" : "bg-primary-600") : "bg-slate-200"
            )}
        >
            <div className={cn(
                "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                enabled ? "left-7" : "left-1"
            )} />
        </button>
    );
}
