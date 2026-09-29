import React, { useState, useEffect } from 'react';
import {
    Zap,
    Bell,
    Lock,
    Unlock,
    MessageSquare,
    Vibrate,
    RefreshCw,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    ChevronDown
} from 'lucide-react';
import { CommandRepository, CommandType } from '@/lib/repositories/CommandRepository';
import { db } from '@/lib/firebase';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface RemoteControlPanelProps {
    childId: string;
}

export default function RemoteControlPanel({ childId }: RemoteControlPanelProps) {
    const { profile, family } = useParentProfile();
    const [loading, setLoading] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [recentCommands, setRecentCommands] = useState<any[]>([]);

    useEffect(() => {
        if (!db || !childId) return;
        const q = query(
            collection(db, "children", childId, "remoteCommands"),
            orderBy("createdAt", "desc"),
            limit(5)
        );
        return onSnapshot(q, (snapshot) => {
            setRecentCommands(snapshot.docs.map(commandDoc => ({
                id: commandDoc.id,
                ...commandDoc.data()
            })));
        });
    }, [childId]);

    const handleSend = async (type: CommandType, payload: string | null = null) => {
        if (!profile || !family) return;
        setLoading(type);
        try {
            await CommandRepository.sendCommand(
                childId,
                family.familyId,
                profile.uid,
                profile.displayName || "Parent",
                type,
                payload
            );
            if (type === CommandType.SHOW_MESSAGE) setMessage('');
        } catch (e) {
            alert("Failed to send command");
        } finally {
            setTimeout(() => setLoading(null), 2000);
        }
    };

    return (
        <div className="space-y-4">
            <details className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 md:p-8 [&::-webkit-details-marker]:hidden">
                    <div>
                        <h3 className="flex items-center gap-2 text-xl font-black text-slate-800">
                            <Zap className="text-primary-600" />
                            Remote Control Panel
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            Execute immediate safety actions on the child device.
                        </p>
                    </div>
                    <ChevronDown className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                </summary>

                <div className="border-t border-slate-100 p-6 md:p-8">
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <CommandBtn
                                icon={RefreshCw}
                                label="Refresh GPS"
                                loading={loading === CommandType.REFRESH_LOCATION}
                                onClick={() => handleSend(CommandType.REFRESH_LOCATION)}
                            />
                            <CommandBtn
                                icon={Bell}
                                label="Ring Device"
                                loading={loading === CommandType.RING_DEVICE}
                                onClick={() => handleSend(CommandType.RING_DEVICE)}
                            />
                            <CommandBtn
                                icon={Lock}
                                label="Lock Device"
                                color="text-rose-600"
                                loading={loading === CommandType.LOCK_DEVICE}
                                onClick={() => handleSend(CommandType.LOCK_DEVICE)}
                            />
                            <CommandBtn
                                icon={Unlock}
                                label="Unlock Device"
                                color="text-emerald-600"
                                loading={loading === CommandType.UNLOCK_DEVICE}
                                onClick={() => handleSend(CommandType.UNLOCK_DEVICE)}
                            />
                            <CommandBtn
                                icon={Vibrate}
                                label="Vibrate"
                                loading={loading === CommandType.VIBRATE_DEVICE}
                                onClick={() => handleSend(CommandType.VIBRATE_DEVICE)}
                            />
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                            <label className="mb-3 block text-xs font-black uppercase text-slate-400">
                                Send Remote Message
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-primary-300"
                                    value={message}
                                    onChange={event => setMessage(event.target.value)}
                                />
                                <button
                                    disabled={!message || loading === CommandType.SHOW_MESSAGE}
                                    onClick={() => handleSend(CommandType.SHOW_MESSAGE, message)}
                                    className="rounded-xl bg-primary-600 p-3 text-white transition-all hover:bg-primary-700 disabled:opacity-50"
                                >
                                    {loading === CommandType.SHOW_MESSAGE
                                        ? <Loader2 className="animate-spin" />
                                        : <MessageSquare size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </details>

            <details className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 md:p-8 [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center gap-2">
                        <Clock className="text-primary-600" />
                        <h3 className="text-xl font-black text-slate-800">
                            Command History
                        </h3>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                            {recentCommands.length}
                        </span>
                    </div>
                    <ChevronDown className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                </summary>

                <div className="border-t border-slate-100 bg-slate-50 p-6 md:p-8">
                    <div className="space-y-4">
                        {recentCommands.length > 0 ? recentCommands.map(cmd => {
                            const effectiveStatus = getEffectiveStatus(cmd);
                            return (
                                <div key={cmd.commandId || cmd.id} className="rounded-xl border border-slate-100 bg-white p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">
                                                {cmd.commandType.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-[10px] font-medium text-slate-400">
                                                {new Date(cmd.createdAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <StatusBadge status={effectiveStatus} />
                                    </div>
                                    {cmd.resultMessage && (
                                        <p className="mt-2 text-[10px] font-medium text-slate-500">
                                            {cmd.resultMessage}
                                        </p>
                                    )}
                                </div>
                            );
                        }) : (
                            <p className="py-8 text-center text-sm italic text-slate-400">
                                No recent commands.
                            </p>
                        )}
                    </div>
                </div>
            </details>
        </div>
    );
}

function CommandBtn({ icon: Icon, label, onClick, loading, color = "text-slate-700" }: any) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 transition-all group active:scale-95 disabled:opacity-50"
        >
            <div className={cn("p-3 rounded-xl bg-white shadow-sm group-hover:shadow-md transition-all", color)}>
                {loading ? <Loader2 size={24} className="animate-spin text-primary-600" /> : <Icon size={24} />}
            </div>
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider">{label}</span>
        </button>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: any = {
        PENDING: { icon: Clock, color: "bg-slate-100 text-slate-500" },
        DELIVERED: { icon: Loader2, color: "bg-blue-50 text-blue-600 animate-pulse" },
        APPLIED: { icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
        FAILED: { icon: XCircle, color: "bg-rose-50 text-rose-600" },
        EXPIRED: { icon: Clock, color: "bg-amber-50 text-amber-600" }
    };

    const { icon: Icon, color } = config[status] || config.PENDING;

    return (
        <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase", color)}>
            <Icon size={12} className={status === 'DELIVERED' ? 'animate-spin' : ''} />
            {status}
        </span>
    );
}

function getEffectiveStatus(command: any): string {
    const legacyStatus: Record<string, string> = {
        EXECUTING: 'DELIVERED',
        RECEIVED: 'DELIVERED',
        SUCCESS: 'APPLIED',
        EXECUTED: 'APPLIED'
    };
    const status = legacyStatus[command.status] || command.status || 'PENDING';
    if (
        (status === 'PENDING' || status === 'DELIVERED') &&
        command.expiresAt &&
        Date.now() > command.expiresAt
    ) {
        return 'EXPIRED';
    }
    return status;
}
