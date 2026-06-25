import React from 'react';
import { Shield, ShieldAlert, Lock, Unlock, Search, Youtube, UserPlus, Globe, Trash2, Plus } from 'lucide-react';
import { WebRuleSet, WebCategory } from '@/lib/repositories/WebProtectionRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface WebProtectionControlsProps {
    rules: WebRuleSet;
    onUpdate: (rules: WebRuleSet) => void;
}

export default function WebProtectionControls({ rules, onUpdate }: WebProtectionControlsProps) {
    const toggleCategory = (cat: WebCategory) => {
        const isBlocked = rules.blockedCategories.includes(cat);
        const newBlocked = isBlocked
            ? rules.blockedCategories.filter(c => c !== cat)
            : [...rules.blockedCategories, cat];
        onUpdate({ ...rules, blockedCategories: newBlocked });
    };

    return (
        <div className="space-y-8">
            {/* Global Safe Settings */}
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-8">
                    <Shield className="text-primary-600" />
                    Global Search \u0026 Content Safety
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ToggleCard
                        icon={Search}
                        label="Google SafeSearch"
                        active={rules.safeSearchEnabled}
                        onChange={(v: boolean) => onUpdate({...rules, safeSearchEnabled: v})}
                    />
                    <ToggleCard
                        icon={Youtube}
                        label="YT Restricted Mode"
                        active={rules.youtubeRestrictedMode}
                        onChange={(v: boolean) => onUpdate({...rules, youtubeRestrictedMode: v})}
                    />
                    <ToggleCard
                        icon={ShieldAlert}
                        label="Adult Content Filter"
                        active={rules.adultContentBlockEnabled}
                        onChange={(v: boolean) => onUpdate({...rules, adultContentBlockEnabled: v})}
                    />
                </div>
            </section>

            {/* Category Blocking */}
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-8">
                    <Globe className="text-indigo-600" />
                    Content Category Filter
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Object.values(WebCategory).filter(c => c !== WebCategory.SAFE).map((cat) => (
                        <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                            className={cn(
                                "p-4 rounded-2xl border transition-all text-left group",
                                rules.blockedCategories.includes(cat)
                                    ? "bg-rose-50 border-rose-100"
                                    : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                            )}
                        >
                            <p className={cn(
                                "text-[10px] font-black uppercase mb-1",
                                rules.blockedCategories.includes(cat) ? "text-rose-600" : "text-slate-400"
                            )}>
                                {rules.blockedCategories.includes(cat) ? "Blocked" : "Allowed"}
                            </p>
                            <p className="font-bold text-slate-700">{cat.charAt(0) + cat.slice(1).toLowerCase()}</p>
                        </button>
                    ))}
                </div>
            </section>

            {/* Custom Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <UrlList
                    title="Blocked Domains"
                    icon={ShieldAlert}
                    domains={rules.blockedDomains}
                    onAdd={(d: string) => onUpdate({...rules, blockedDomains: [...rules.blockedDomains, d]})}
                    onDelete={(d: string) => onUpdate({...rules, blockedDomains: rules.blockedDomains.filter(x => x !== d)})}
                    color="text-rose-600"
                />
                <UrlList
                    title="Always Allowed"
                    icon={Unlock}
                    domains={rules.allowedDomains}
                    onAdd={(d: string) => onUpdate({...rules, allowedDomains: [...rules.allowedDomains, d]})}
                    onDelete={(d: string) => onUpdate({...rules, allowedDomains: rules.allowedDomains.filter(x => x !== d)})}
                    color="text-emerald-600"
                />
            </div>
        </div>
    );
}

function ToggleCard({ icon: Icon, label, active, onChange }: any) {
    return (
        <div className={cn(
            "p-6 rounded-2xl border transition-all flex flex-col justify-between h-full",
            active ? "bg-primary-50 border-primary-100" : "bg-slate-50 border-slate-100"
        )}>
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-2 rounded-xl", active ? "bg-primary-500 text-white" : "bg-slate-200 text-slate-500")}>
                    <Icon size={20} />
                </div>
                <Switch enabled={active} onChange={() => onChange(!active)} />
            </div>
            <p className="font-bold text-slate-800">{label}</p>
        </div>
    );
}

function UrlList({ title, icon: Icon, domains, onAdd, onDelete, color }: any) {
    const [newUrl, setNewUrl] = React.useState('');

    return (
        <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                <Icon className={color} size={20} />
                {title}
            </h3>
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    placeholder="example.com"
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-primary-300 transition-all"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                />
                <button
                    onClick={() => { if(newUrl) { onAdd(newUrl); setNewUrl(''); } }}
                    className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 transition-all"
                >
                    <Plus size={20} />
                </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {domains.map((d: string) => (
                    <div key={d} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-50 group">
                        <span className="text-sm font-bold text-slate-600">{d}</span>
                        <button onClick={() => onDelete(d)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Switch({ enabled, onChange }: { enabled: boolean, onChange: () => void }) {
    return (
        <button
            onClick={onChange}
            className={cn(
                "w-10 h-5 rounded-full relative transition-colors",
                enabled ? "bg-primary-600" : "bg-slate-300"
            )}
        >
            <div className={cn(
                "w-3 h-3 bg-white rounded-full absolute top-1 transition-all",
                enabled ? "left-6" : "left-1"
            )} />
        </button>
    );
}
