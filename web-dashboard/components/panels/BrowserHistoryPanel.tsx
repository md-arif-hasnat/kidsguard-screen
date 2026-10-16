"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Search,
  Calendar,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Smartphone,
  ExternalLink,
  History,
  X,
  Compass,
  Monitor
} from 'lucide-react';
import { BrowserHistoryRepository, BrowserHistoryItem } from '@/lib/repositories/BrowserHistoryRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { formatLastUsed, formatDurationSeconds } from '@/lib/utils/FormatUtils';
import { clsx } from 'clsx';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface BrowserHistoryPanelProps {
  childId: string;
}

type DateFilter = 'all' | 'today' | '7d' | '30d';

export default function BrowserHistoryPanel({ childId }: BrowserHistoryPanelProps) {
  const { family, isChildAccessible, loading: profileLoading } = useParentProfile();

  const [history, setHistory] = useState<BrowserHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [browserFilter, setBrowserFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const [selectedActivity, setSelectedActivity] = useState<BrowserHistoryItem | null>(null);

  useEffect(() => {
    if (!childId || !family?.familyId || profileLoading) return;
    if (!isChildAccessible(childId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setHistory([]);
    setLastDoc(null);
    setHasMore(true);

    const loadData = async () => {
      try {
        const result = await BrowserHistoryRepository.getBrowserHistoryPage(family.familyId, childId);
        setHistory(result.data);
        setLastDoc(result.lastDoc);
        setHasMore(result.data.length === 20);
      } catch (err) {
        console.error("Error loading browser history:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [childId, family?.familyId, profileLoading, isChildAccessible]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore || !family?.familyId) return;

    setLoadingMore(true);
    try {
      const result = await BrowserHistoryRepository.getBrowserHistoryPage(family.familyId, childId, lastDoc);
      setHistory(prev => [...prev, ...result.data]);
      setLastDoc(result.lastDoc);
      setHasMore(result.data.length === 20);
    } catch (err) {
      console.error("Error loading more browser history:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return BrowserHistoryRepository.filterHistory(history, searchQuery, browserFilter, dateFilter);
  }, [history, searchQuery, browserFilter, dateFilter]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, BrowserHistoryItem[]> = {};

    filteredHistory.forEach(item => {
      const date = new Date(item.capturedAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });

    return Object.entries(groups).sort((a, b) => {
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
    });
  }, [filteredHistory]);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getBrowserName = (pkg: string) => {
    if (pkg.includes('chrome')) return 'Chrome';
    if (pkg.includes('firefox')) return 'Firefox';
    if (pkg.includes('msedge') || pkg.includes('emmx')) return 'Edge';
    if (pkg.includes('brave')) return 'Brave';
    if (pkg.includes('opera')) return 'Opera';
    const parts = pkg.split('.');
    return parts[parts.length - 1] || 'Browser';
  };

  if (profileLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="animate-spin text-primary-600" size={48} />
        <p className="font-bold text-slate-400 italic">Accessing browser activity...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="text-primary-600" size={24} />
            Browser History
          </h2>
          <p className="text-slate-500 text-sm mt-1">Websites visited on the child&apos;s device.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search websites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm font-bold text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-primary-500 sm:w-48 md:w-64"
            />
          </div>

          <select
            value={browserFilter}
            onChange={(e) => setBrowserFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none shadow-sm"
          >
            <option value="all">All Browsers</option>
            <option value="chrome">Chrome</option>
            <option value="firefox">Firefox</option>
            <option value="brave">Brave</option>
            <option value="opera">Opera</option>
            <option value="msedge">Edge</option>
          </select>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shadow-sm">
            <FilterBtn active={dateFilter === 'all'} onClick={() => setDateFilter('all')} label="All" />
            <FilterBtn active={dateFilter === 'today'} onClick={() => setDateFilter('today')} label="Today" />
            <FilterBtn active={dateFilter === '7d'} onClick={() => setDateFilter('7d')} label="7d" />
          </div>
        </div>
      </header>

      {history.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Compass size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">No Browser History Yet</h3>
          <p className="text-slate-500 max-w-xs mx-auto mt-2 italic text-sm">Website visits detected on this device will appear here.</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
          <Search size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">No results match your filters.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {groupedHistory.map(([dateStr, items]) => (
            <details key={dateStr} className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="font-black text-slate-700 text-xs uppercase tracking-[0.2em]">{getDateLabel(dateStr)}</span>
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-black text-primary-600">{items.length}</span>
                </span>
                <ChevronDown size={18} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>

              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 bg-slate-50/50 p-4 md:grid-cols-2 md:gap-6 md:p-6 lg:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedActivity(item)}
                    className="group relative min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-primary-200 hover:shadow-xl hover:shadow-primary-50/50 sm:rounded-[2rem] sm:p-5"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                        <Globe size={20} />
                      </div>
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        {new Date(item.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-800 line-clamp-1 group-hover:text-primary-600 transition-colors leading-tight mb-1">
                      {item.pageTitle || item.domain || "Unknown Page"}
                    </h4>

                    <p className="text-xs text-slate-400 truncate mb-4 font-medium">{item.url || item.domain}</p>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock size={12} />
                          <span className="text-[10px] font-black uppercase tracking-tighter">
                            {formatDurationSeconds(item.durationSeconds)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Monitor size={12} />
                          <span className="text-[10px] font-black uppercase tracking-tighter">
                            {getBrowserName(item.browserPackage)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-8">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="bg-white border-2 border-slate-200 text-slate-700 px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-primary-500 hover:text-primary-600 transition-all shadow-sm disabled:opacity-50 flex items-center gap-3"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <History size={16} />
                    Load More History
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedActivity && (
        <BrowserDetailsModal
          item={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          getBrowserName={getBrowserName}
        />
      )}
    </div>
  );
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

function BrowserDetailsModal({ item, onClose, getBrowserName }: any) {
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-6 md:rounded-[2.5rem] md:p-10"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-6 top-6 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
          <X size={24} />
        </button>

        <header className="flex flex-col gap-6 mb-10">
          <div className="w-16 h-16 bg-primary-50 rounded-3xl flex items-center justify-center text-primary-600 border border-primary-100">
            <Globe size={32} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight break-words">{item.pageTitle || "Untitled Page"}</h2>
            <div className="flex items-center gap-2 mt-2 text-primary-600 font-bold">
              <Compass size={16} />
              <span className="truncate">{item.domain || "Unknown Domain"}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div className="space-y-6">
            <ModalInfo label="Visited At" value={new Date(item.capturedAt).toLocaleString()} icon={Calendar} />
            <ModalInfo label="Visit Duration" value={formatDurationSeconds(item.durationSeconds)} icon={Clock} color="text-primary-600" />
            <ModalInfo label="Browser App" value={getBrowserName(item.browserPackage)} icon={Monitor} />
          </div>

          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ExternalLink size={14} /> Technical Details
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase">Full URL</span>
                <p className="text-xs font-bold text-slate-700 break-all bg-white p-3 rounded-xl border border-slate-200">{item.url || "N/A"}</p>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Package</span>
                <span className="text-xs font-bold text-slate-700">{item.browserPackage}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Device ID</span>
                <span className="text-xs font-mono font-bold text-slate-700">{item.deviceId?.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Close History Details
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalInfo({ label, value, icon: Icon, color }: any) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className={clsx("text-sm font-bold", color || "text-slate-800")}>{value}</p>
      </div>
    </div>
  );
}
