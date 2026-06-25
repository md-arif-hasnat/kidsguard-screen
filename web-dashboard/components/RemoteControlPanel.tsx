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
    Clock
} from 'lucide-react';
import { CommandRepository, CommandType } from '@/lib/repositories/CommandRepository';
import { db } from '@/lib/firebase';
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
            setRecentCommands(snapshot.docs.map(doc => doc.data()));
        });
    }, [childId]);

    const handleSend = async (type: CommandType, payload: string | null = null) => {
        setLoading(type);
        try {
            await CommandRepository.sendCommand(childId, type, payload);
            if (type === CommandType.SHOW_MESSAGE) setMessage('');
        } catch (e) {
            alert("Failed to send command");
        } finally {
            setTimeout(() => setLoading(null), 2000);
        }
    };

    return (
        <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Zap className="text-primary-600" />
                    Remote Control Panel
                </h3>
                <p className="text-slate-500 font-medium mt-1">Execute immediate safety actions on the child device.</p>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
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

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <label className="block text-xs font-black text-slate-400 uppercase mb-3">Send Remote Message</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Type a message..."
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-primary-300"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                            <button
                                disabled={!message || loading === CommandType.SHOW_MESSAGE}
                                onClick={() => handleSend(CommandType.SHOW_MESSAGE, message)}
                                className="bg-primary-600 text-white p-3 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all"
                            >
                                {loading === CommandType.SHOW_MESSAGE ? <Loader2 className="animate-spin" /> : <MessageSquare size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase mb-6 flex items-center gap-2">
                        <Clock size={14} />
                        Command History
                    </h4>
                    <div className="space-y-4">
                        {recentCommands.length > 0 ? recentCommands.map((cmd) => (
                            <div key={cmd.commandId} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100">
                                <div>
                                    <p className="text-sm font-bold text-slate-700">{cmd.commandType.replace('_', ' ')}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{new Date(cmd.createdAt).toLocaleTimeString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <StatusBadge status={cmd.status} />
                                </div>
                            </div>
                        )) : (
                            <p className="text-center py-12 text-slate-400 italic text-sm">No recent commands.</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
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
        RECEIVED: { icon: Loader2, color: "bg-blue-50 text-blue-600 animate-pulse" },
        EXECUTED: { icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
        FAILED: { icon: XCircle, color: "bg-rose-50 text-rose-600" },
        EXPIRED: { icon: Clock, color: "bg-amber-50 text-amber-600" }
    };

    const { icon: Icon, color } = config[status] || config.PENDING;

    return (
        <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase", color)}>
            <Icon size={12} className={status === 'RECEIVED' ? 'animate-spin' : ''} />
            {status}
        </span>
    );
}
