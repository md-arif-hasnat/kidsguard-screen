"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Globe,
  Filter,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  AlertCircle,
  Settings2
} from 'lucide-react';
import {
  WebsitePolicyRepository,
  WebsitePolicy,
  WebsiteCategory,
  WebsiteRiskLevel,
  WebsiteDecision
} from '@/lib/repositories/WebsitePolicyRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { clsx } from 'clsx';

interface WebsiteRulesPanelProps {
  childId: string;
}

export default function WebsiteRulesPanel({ childId }: WebsiteRulesPanelProps) {
  const { family, profile, role, loading: profileLoading } = useParentProfile();

  const [policy, setPolicy] = useState<WebsitePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [domainInput, setDomainInput] = useState('');
  const [domainType, setDomainType] = useState<'blocked' | 'allowed'>('blocked');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'blocked' | 'allowed'>('all');

  useEffect(() => {
    if (!family?.familyId || profileLoading) return;

    setLoading(true);
    const unsub = WebsitePolicyRepository.listenToFamilyPolicy(family.familyId, (data) => {
      setPolicy(data);
      setLoading(false);
    });

    return () => unsub();
  }, [family?.familyId, profileLoading]);

  const handleToggleCategory = async (category: WebsiteCategory, type: 'blocked' | 'allowed') => {
    if (!family?.familyId || !profile?.uid || !policy) return;

    setSaving(true);
    try {
      const field = type === 'blocked' ? 'blockedCategories' : 'allowedCategories';
      const oppositeField = type === 'blocked' ? 'allowedCategories' : 'blockedCategories';

      let newList = [...(policy[field] || [])];
      let oppositeList = [...(policy[oppositeField] || [])];

      if (newList.includes(category)) {
        newList = newList.filter(c => c !== category);
      } else {
        newList.push(category);
        // Remove from opposite list if it exists there
        oppositeList = oppositeList.filter(c => c !== category);
      }

      await WebsitePolicyRepository.updatePolicy(family.familyId, profile.uid, {
        [field]: newList,
        [oppositeField]: oppositeList
      }, role);
    } catch (err) {
      console.error("Failed to toggle category:", err);
      alert("Permission denied or update failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family?.familyId || !profile?.uid || !policy || !domainInput.trim()) return;

    const normalized = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!normalized.includes('.')) {
        alert("Please enter a valid domain name.");
        return;
    }

    const field = domainType === 'blocked' ? 'blockedDomains' : 'allowedDomains';
    const oppositeField = domainType === 'blocked' ? 'allowedDomains' : 'blockedDomains';

    if (policy[field].includes(normalized)) {
        alert("Domain already in list.");
        return;
    }

    setSaving(true);
    try {
        let newList = [...policy[field], normalized];
        let oppositeList = policy[oppositeField].filter(d => d !== normalized);

        await WebsitePolicyRepository.updatePolicy(family.familyId, profile.uid, {
            [field]: newList,
            [oppositeField]: oppositeList
        }, role);
        setDomainInput('');
    } catch (err) {
        console.error("Failed to add domain:", err);
    } finally {
        setSaving(false);
    }
  };

  const handleRemoveDomain = async (domain: string, type: 'blocked' | 'allowed') => {
    if (!family?.familyId || !profile?.uid || !policy) return;

    const field = type === 'blocked' ? 'blockedDomains' : 'allowedDomains';
    setSaving(true);
    try {
        const newList = policy[field].filter(d => d !== domain);
        await WebsitePolicyRepository.updatePolicy(family.familyId, profile.uid, {
            [field]: newList
        }, role);
    } catch (err) {
        console.error("Failed to remove domain:", err);
    } finally {
        setSaving(false);
    }
  };

  const handleUpdateRiskDecision = async (risk: WebsiteRiskLevel, decision: WebsiteDecision) => {
    if (!family?.familyId || !profile?.uid || !policy) return;

    setSaving(true);
    try {
        const newRiskLevels = { ...policy.riskLevels, [risk]: decision };
        await WebsitePolicyRepository.updatePolicy(family.familyId, profile.uid, {
            riskLevels: newRiskLevels
        }, role);
    } catch (err) {
        console.error("Failed to update risk policy:", err);
    } finally {
        setSaving(false);
    }
  };

  const filteredDomains = useMemo(() => {
    if (!policy) return [];

    let blocked = policy.blockedDomains.map(d => ({ name: d, type: 'blocked' as const }));
    let allowed = policy.allowedDomains.map(d => ({ name: d, type: 'allowed' as const }));

    let combined = [...blocked, ...allowed];

    if (filterType === 'blocked') combined = blocked;
    if (filterType === 'allowed') combined = allowed;

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        combined = combined.filter(d => d.name.includes(q));
    }

    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [policy, filterType, searchQuery]);

  if (profileLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="animate-spin text-primary-600" size={48} />
        <p className="font-bold text-slate-400 italic">Loading website policies...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="text-primary-600" size={24} />
            Website \u0026 Category Rules
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm">Manage what websites and categories your children can access.</p>
            {policy?.updatedAt && (
              <>
                <span className="text-slate-300">•</span>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Updated {new Date(typeof policy.updatedAt === 'number' ? policy.updatedAt : policy.updatedAt.toMillis?.() || Date.now()).toLocaleString()}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (confirm("Reset all rules to default settings? This cannot be undone.")) {
                WebsitePolicyRepository.updatePolicy(family!.familyId, profile!.uid, WebsitePolicyRepository.getDefaultPolicy(), role);
              }
            }}
            className="text-slate-400 hover:text-rose-600 text-xs font-bold transition-colors"
          >
            Reset to Defaults
          </button>
          {saving && (
            <div className="flex items-center gap-2 bg-primary-50 text-primary-600 px-4 py-2 rounded-xl text-xs font-bold animate-pulse">
              <Loader2 size={14} className="animate-spin" />
              Syncing...
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Domain Rules */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
              <h3 className="text-lg font-black text-slate-800">Domain Rules</h3>

              <div className="flex items-center gap-3">
                 <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search domains..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                 </div>
                 <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                 >
                    <option value="all">All Rules</option>
                    <option value="blocked">Blocked</option>
                    <option value="allowed">Allowed</option>
                 </select>
              </div>
            </div>

            <div className="p-8 bg-slate-50/50">
              <form onSubmit={handleAddDomain} className="flex flex-col md:flex-row gap-3">
                 <div className="flex-1 relative">
                    <Globe className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Enter domain (e.g. facebook.com)"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-primary-500 transition-all shadow-sm"
                    />
                 </div>
                 <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setDomainType(domainType === 'blocked' ? 'allowed' : 'blocked')}
                        className={clsx(
                            "px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2",
                            domainType === 'blocked' ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-emerald-50 border-emerald-200 text-emerald-600"
                        )}
                    >
                        {domainType === 'blocked' ? <Lock size={14} /> : <Unlock size={14} />}
                        {domainType}
                    </button>
                    <button
                        type="submit"
                        disabled={!domainInput || saving}
                        className="bg-slate-900 text-white px-6 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
                    >
                        <Plus size={16} />
                        Add
                    </button>
                 </div>
              </form>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Domain</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredDomains.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-12 text-center text-slate-400 italic text-sm">
                        {searchQuery ? "No matching domains found." : "No specific domain rules yet."}
                      </td>
                    </tr>
                  ) : (
                    filteredDomains.map((d) => (
                      <tr key={d.name} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4">
                          <span className="font-bold text-slate-700">{d.name}</span>
                        </td>
                        <td className="px-8 py-4">
                          <span className={clsx(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                            d.type === 'blocked' ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {d.type === 'blocked' ? <Lock size={10} /> : <Unlock size={10} />}
                            {d.type}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <button
                            onClick={() => handleRemoveDomain(d.name, d.type)}
                            className="p-2 text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Risk Policy Section */}
          <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
                    <Settings2 size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-800">Global Risk Policy</h3>
                    <p className="text-xs text-slate-500 font-medium italic">Automatic handling for unknown websites based on AI analysis.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <RiskConfigCard
                    label="Safe Sites"
                    desc="Education, Search, News"
                    risk={WebsiteRiskLevel.SAFE}
                    decision={policy?.riskLevels[WebsiteRiskLevel.SAFE] || WebsiteDecision.ALLOW}
                    onUpdate={(d: WebsiteDecision) => handleUpdateRiskDecision(WebsiteRiskLevel.SAFE, d)}
                />
                <RiskConfigCard
                    label="Caution Sites"
                    desc="Social, Video, Gaming"
                    risk={WebsiteRiskLevel.CAUTION}
                    decision={policy?.riskLevels[WebsiteRiskLevel.CAUTION] || WebsiteDecision.ALLOW}
                    onUpdate={(d: WebsiteDecision) => handleUpdateRiskDecision(WebsiteRiskLevel.CAUTION, d)}
                />
                <RiskConfigCard
                    label="Restricted Sites"
                    desc="Adult, Gambling, Drugs"
                    risk={WebsiteRiskLevel.RESTRICTED}
                    decision={policy?.riskLevels[WebsiteRiskLevel.RESTRICTED] || WebsiteDecision.BLOCK}
                    onUpdate={(d: WebsiteDecision) => handleUpdateRiskDecision(WebsiteRiskLevel.RESTRICTED, d)}
                />
            </div>
          </section>
        </div>

        {/* Right Column: Categories */}
        <div className="space-y-8">
            <section className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/20 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <LayoutGrid size={20} />
                        </div>
                        <h3 className="text-xl font-black">Categories</h3>
                    </div>

                    <p className="text-slate-400 text-xs font-medium mb-8">Block or Allow entire categories of websites automatically.</p>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {Object.values(WebsiteCategory).map(cat => {
                            if (cat === WebsiteCategory.UNKNOWN) return null;
                            const isBlocked = policy?.blockedCategories.includes(cat);
                            const isAllowed = policy?.allowedCategories.includes(cat);

                            return (
                                <div key={cat} className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                                    <span className="text-xs font-bold text-slate-300">{cat.toLowerCase().replace('_', ' ')}</span>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleToggleCategory(cat, 'allowed')}
                                            className={clsx(
                                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                                isAllowed ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white/5 text-slate-500 hover:text-emerald-400"
                                            )}
                                        >
                                            <ShieldCheck size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleCategory(cat, 'blocked')}
                                            className={clsx(
                                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                                isBlocked ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-white/5 text-slate-500 hover:text-rose-400"
                                            )}
                                        >
                                            <ShieldAlert size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200">
                <div className="flex items-center gap-2 mb-4 text-orange-600">
                    <AlertCircle size={20} />
                    <h4 className="font-black text-sm uppercase tracking-tighter">Policy Enforcement</h4>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Changes made here are applied to all children in your family.
                    Enforcement happens via the KidsGuard Accessibility service on the child device.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}

function RiskConfigCard({ label, desc, risk, decision, onUpdate }: any) {
    return (
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between gap-6">
            <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-tighter mb-1">{label}</p>
                <p className="text-[10px] text-slate-400 font-medium">{desc}</p>
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                <RiskBtn active={decision === WebsiteDecision.ALLOW} onClick={() => onUpdate(WebsiteDecision.ALLOW)} label="Allow" color="emerald" />
                <RiskBtn active={decision === WebsiteDecision.WARN} onClick={() => onUpdate(WebsiteDecision.WARN)} label="Warn" color="orange" />
                <RiskBtn active={decision === WebsiteDecision.BLOCK} onClick={() => onUpdate(WebsiteDecision.BLOCK)} label="Block" color="rose" />
            </div>
        </div>
    )
}

function RiskBtn({ active, onClick, label, color }: any) {
    const colorClasses = {
        emerald: active ? "bg-emerald-500 text-white" : "text-slate-400 hover:bg-emerald-50",
        orange: active ? "bg-orange-500 text-white" : "text-slate-400 hover:bg-orange-50",
        rose: active ? "bg-rose-500 text-white" : "text-slate-400 hover:bg-rose-50"
    };

    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                colorClasses[color as keyof typeof colorClasses]
            )}
        >
            {label}
        </button>
    )
}

function FilterBtn({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
        active ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
      )}
    >
      {label}
    </button>
  );
}
