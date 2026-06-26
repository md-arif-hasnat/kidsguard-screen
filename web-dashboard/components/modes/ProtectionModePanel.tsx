import React, { useState, useEffect } from 'react';
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    Clock,
    MapPin,
    Plus,
    Trash2,
    Edit2,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Smartphone,
    Globe,
    ChevronRight,
    Lock,
    Unlock,
    Info,
    Layout
} from 'lucide-react';
import { ProtectionModeRepository, ProtectionMode, ProtectionModeType } from '@/lib/repositories/ProtectionModeRepository';
import { SafeZone } from '@/lib/repositories/SafeZoneRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ProtectionModePanelProps {
    childId: string;
    familyId: string;
    safeZones: SafeZone[];
    role: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProtectionModePanel({ childId, familyId, safeZones, role }: ProtectionModePanelProps) {
    const [modes, setModes] = useState<ProtectionMode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowAddForm] = useState(false);
    const [editingMode, setEditingMode] = useState<ProtectionMode | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState<ProtectionModeType>(ProtectionModeType.SCHOOL);
    const [enabled, setEnabled] = useState(true);
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('15:00');
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [triggerZoneId, setTriggerZoneId] = useState<string>('');
    const [lockDevice, setLockDevice] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!childId) return;
        return ProtectionModeRepository.listenToModes(childId, (data) => {
            setModes(data);
            setLoading(false);
        });
    }, [childId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await ProtectionModeRepository.saveMode(childId, familyId, {
                id: editingMode?.id || '',
                name,
                type,
                enabled,
                schedule: {
                    days: selectedDays,
                    startTime,
                    endTime
                },
                triggerZoneId: triggerZoneId || null,
                allowedApps: [], // Future picker
                blockedApps: [], // Future picker
                allowedDomains: [], // Future picker
                blockedDomains: [], // Future picker
                lockDevice
            });
            resetForm();
        } catch (e) {
            alert("Failed to save protection mode.");
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setName('');
        setType(ProtectionModeType.SCHOOL);
        setEnabled(true);
        setStartTime('08:00');
        setEndTime('15:00');
        setSelectedDays([1, 2, 3, 4, 5]);
        setTriggerZoneId('');
        setLockDevice(false);
        setEditingMode(null);
        setShowAddForm(false);
    };

    const handleEdit = (mode: ProtectionMode) => {
        setEditingMode(mode);
        setName(mode.name);
        setType(mode.type);
        setEnabled(mode.enabled);
        setStartTime(mode.schedule?.startTime || '08:00');
        setEndTime(mode.schedule?.endTime || '15:00');
        setSelectedDays(mode.schedule?.days || []);
        setTriggerZoneId(mode.triggerZoneId || '');
        setLockDevice(mode.lockDevice);
        setShowAddForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this protection mode?")) return;
        await ProtectionModeRepository.deleteMode(childId, familyId, id);
    };

    const toggleDay = (day: number) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <Shield className="text-primary-600" />
                        Protection Modes
                    </h2>
                    <p className="text-slate-500 font-medium mt-1 italic text-sm">Automate safety rules based on time or location.</p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="bg-primary-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-primary-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} />
                        New Mode
                    </button>
                )}
            </header>

            {showForm && (
                <section className="bg-white rounded-[2.5rem] border-2 border-primary-100 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-8 border-b border-slate-100 bg-primary-50/30 flex justify-between items-center">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            {editingMode ? <Edit2 size={18} className="text-primary-600" /> : <Plus size={18} className="text-primary-600" />}
                            {editingMode ? `Edit Mode: ${editingMode.name}` : 'Configure New Protection Mode'}
                        </h3>
                        <button onClick={resetForm} className="text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest">Cancel</button>
                    </div>
                    <form onSubmit={handleSave} className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Mode Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g. Science Class"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Type</label>
                                    <select
                                        value={type}
                                        onChange={e => setType(e.target.value as ProtectionModeType)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                                    >
                                        {Object.values(ProtectionModeType).map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Lock Device</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Completely blocks phone usage except emergency apps.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setLockDevice(!lockDevice)}
                                        className={cn(
                                            "w-12 h-6 rounded-full relative transition-colors",
                                            lockDevice ? "bg-rose-500" : "bg-slate-300"
                                        )}
                                    >
                                        <div className={cn("w-4 h-4 bg-white rounded-full absolute top-1 transition-all", lockDevice ? "left-7" : "left-1")} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2">
                                        <Clock size={12} /> Schedule Triggers
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map((day, i) => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => toggleDay(i)}
                                                className={cn(
                                                    "w-10 h-10 rounded-xl text-[10px] font-black border transition-all",
                                                    selectedDays.includes(i) ? "bg-primary-600 text-white border-primary-600 shadow-md" : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                                )}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700"
                                        />
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={e => setEndTime(e.target.value)}
                                            className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2">
                                        <MapPin size={12} /> Location Activation
                                    </label>
                                    <select
                                        value={triggerZoneId}
                                        onChange={e => setTriggerZoneId(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none"
                                    >
                                        <option value="">No Location Trigger</option>
                                        {safeZones.map(z => (
                                            <option key={z.id} value={z.id}>Enter: {z.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-50 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-primary-600 hover:bg-primary-700 text-white px-12 py-4 rounded-2xl font-black shadow-xl shadow-primary-100 transition-all flex items-center gap-2"
                            >
                                {saving ? <Loader2 className="animate-spin" /> : <ShieldCheck size={20} />}
                                {editingMode ? 'Update Protection Mode' : 'Activate Mode'}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modes.map((mode) => (
                    <div key={mode.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 group hover:shadow-md transition-all flex flex-col justify-between h-full">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                                    mode.enabled ? "bg-primary-50 text-primary-600" : "bg-slate-50 text-slate-400"
                                )}>
                                    <Shield size={24} />
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(mode)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-slate-50 rounded-lg transition-all"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(mode.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-slate-800">{mode.name}</h3>
                            <p className="text-[10px] font-black text-primary-600 uppercase tracking-[0.2em] mt-1">{mode.type}</p>

                            <div className="mt-6 space-y-3">
                                {mode.schedule && (
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                                        <Clock size={14} className="text-slate-400" />
                                        <span>{mode.schedule.startTime} - {mode.schedule.endTime}</span>
                                        <div className="flex gap-1">
                                            {mode.schedule.days.map(d => (
                                                <span key={d} className="text-[8px] bg-slate-100 px-1 rounded uppercase">{DAYS[d][0]}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {mode.triggerZoneId && (
                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                                        <MapPin size={14} className="text-slate-400" />
                                        <span>{safeZones.find(z => z.id === mode.triggerZoneId)?.name || 'Unknown Zone'}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                                    {mode.lockDevice ? (
                                        <div className="flex items-center gap-1.5 text-rose-600">
                                            <Lock size={14} />
                                            <span>Full Device Lock</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-emerald-600">
                                            <Unlock size={14} />
                                            <span>App Limits Active</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                            <span className={cn(
                                "text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter",
                                mode.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                            )}>
                                {mode.enabled ? 'Enabled' : 'Paused'}
                            </span>
                            <button className="text-primary-600 text-xs font-black uppercase tracking-widest hover:underline flex items-center gap-1">
                                Preview Rules <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>
                ))}

                {modes.length === 0 && !showForm && (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                        <ShieldAlert className="mx-auto text-slate-300 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-800">No Automation Modes</h3>
                        <p className="text-slate-500 max-w-sm mx-auto mt-2 italic">Set up your first protection mode to automate device rules for School, Bedtime, or Focus sessions.</p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
                        >
                            Create First Mode
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
