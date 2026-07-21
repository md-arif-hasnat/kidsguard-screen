import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, ShieldCheck, Loader2, Save } from 'lucide-react';
import { ChildRepository, LockSchedule } from '@/lib/repositories/ChildRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface LockSchedulePanelProps {
    childId: string;
    canEdit: boolean;
}

const DAYS = [
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 7 },
];

export default function LockSchedulePanel({ childId, canEdit }: LockSchedulePanelProps) {
    const [schedule, setSchedule] = useState<LockSchedule | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [enabled, setEnabled] = useState(false);
    const [startTime, setStartTime] = useState('21:00');
    const [endTime, setEndTime] = useState('07:00');
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

    useEffect(() => {
        if (!childId) return;
        setLoading(true);
        return ChildRepository.listenToLockSchedule(childId, (data) => {
            if (data) {
                setSchedule(data);
                setEnabled(data.enabled);
                setStartTime(minutesToTimeString(data.startMinutes));
                setEndTime(minutesToTimeString(data.endMinutes));
                setSelectedDays(data.days);
            }
            setLoading(false);
        });
    }, [childId]);

    const minutesToTimeString = (minutes: number) => {
        const h = Math.floor(minutes / 60).toString().padStart(2, '0');
        const m = (minutes % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    const timeToMinutes = (time: string) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await ChildRepository.setLockSchedule(childId, {
                enabled,
                startMinutes: timeToMinutes(startTime),
                endMinutes: timeToMinutes(endTime),
                days: selectedDays,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
        } catch (e) {
            alert("Failed to save schedule");
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (day: number) => {
        if (!canEdit) return;
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const currentStatus = useMemo(() => {
        if (!enabled) return "Disabled";

        const now = new Date();
        // Day of week: Sun=0, Mon=1, ... Sat=6
        // Our mapping: Mon=1, ... Sun=7
        let dayOfWeek = now.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7;

        if (!selectedDays.includes(dayOfWeek)) return "Outside Schedule";

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);

        let isActive = false;
        if (start <= end) {
            isActive = currentMinutes >= start && currentMinutes < end;
        } else {
            isActive = currentMinutes >= start || currentMinutes < end;
        }

        return isActive ? "Schedule Active" : "Outside Schedule";
    }, [enabled, startTime, endTime, selectedDays]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-primary-600" />
            </div>
        );
    }

    return (
        <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Clock className="text-primary-600" />
                        Lock Schedule
                    </h3>
                    <p className="text-slate-500 font-medium text-sm mt-1 italic">Automatically lock device during specific hours.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn(
                        "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                        currentStatus === 'Schedule Active' ? "bg-rose-100 text-rose-700" :
                        currentStatus === 'Disabled' ? "bg-slate-100 text-slate-400" : "bg-emerald-100 text-emerald-700"
                    )}>
                        {currentStatus}
                    </span>
                    <Switch enabled={enabled} onChange={() => canEdit && setEnabled(!enabled)} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Lock</label>
                            <input
                                type="time"
                                disabled={!canEdit}
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-lg font-black text-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Lock</label>
                            <input
                                type="time"
                                disabled={!canEdit}
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-lg font-black text-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Calendar size={12} /> Repeat Days
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map((day) => (
                                <button
                                    key={day.value}
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => toggleDay(day.value)}
                                    className={cn(
                                        "w-10 h-10 rounded-xl text-[10px] font-black border transition-all",
                                        selectedDays.includes(day.value)
                                            ? "bg-primary-600 text-white border-primary-600 shadow-md"
                                            : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                    )}
                                >
                                    {day.label[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-primary-600">
                                <ShieldCheck size={16} />
                            </div>
                            <h4 className="font-bold text-slate-800">Schedule Rules</h4>
                        </div>
                        <ul className="space-y-3">
                            <RuleItem text="The device will lock automatically at the start time." />
                            <RuleItem text="Unlocking is only possible after the end time or with parent override." />
                            <RuleItem text="Manual lock commands always take priority over schedule." />
                            <RuleItem text="Schedule accounts for overnight windows (e.g. 9 PM to 7 AM)." />
                        </ul>
                    </div>

                    <button
                        disabled={!canEdit || saving}
                        onClick={handleSave}
                        className="mt-8 w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        Save Schedule
                    </button>
                </div>
            </div>
        </section>
    );
}

function Switch({ enabled, onChange }: { enabled: boolean, onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={cn(
                "w-12 h-6 rounded-full relative transition-colors",
                enabled ? "bg-primary-600" : "bg-slate-200"
            )}
        >
            <div className={cn(
                "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                enabled ? "left-7" : "left-1"
            )} />
        </button>
    );
}

function RuleItem({ text }: { text: string }) {
    return (
        <li className="flex items-start gap-2 text-xs text-slate-500 font-medium leading-relaxed">
            <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
            {text}
        </li>
    );
}
