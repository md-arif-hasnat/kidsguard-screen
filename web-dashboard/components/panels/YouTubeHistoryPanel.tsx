"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Youtube,
  Search,
  Calendar,
  Clock,
  Loader2,
  ChevronRight,
  AlertCircle,
  Smartphone,
  CheckCircle2,
  ExternalLink,
  History,
  Play,
  User,
  Filter,
  X
} from 'lucide-react';
import { YouTubeHistoryRepository, YouTubeActivity } from '@/lib/repositories/YouTubeHistoryRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { formatLastUsed, formatDurationSeconds } from '@/lib/utils/FormatUtils';
import { clsx } from 'clsx';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

interface YouTubeHistoryPanelProps {
  childId: string;
}

type DateFilter = 'all' | 'today' | '7d' | '30d';

export default function YouTubeHistoryPanel({ childId }: YouTubeHistoryPanelProps) {
  const { family, role, isChildAccessible, loading: profileLoading } = useParentProfile();

  const [history, setHistory] = useState<YouTubeActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const [selectedActivity, setSelectedActivity] = useState<YouTubeActivity | null>(null);

  // Initial load
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
        const result = await YouTubeHistoryRepository.getYouTubeHistoryPage(family.familyId, childId);
        setHistory(result.data);
        setLastDoc(result.lastDoc);
        setHasMore(result.data.length === 20);
      } catch (err) {
        console.error("Error loading YouTube history:", err);
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
      const result = await YouTubeHistoryRepository.getYouTubeHistoryPage(family.familyId, childId, lastDoc);
      setHistory(prev => [...prev, ...result.data]);
      setLastDoc(result.lastDoc);
      setHasMore(result.data.length === 20);
    } catch (err) {
      console.error("Error loading more YouTube history:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return YouTubeHistoryRepository.filterHistory(history, searchQuery, dateFilter);
  }, [history, searchQuery, dateFilter]);

  const groupedHistory = useMemo(() => {
    const groups: Record<string, YouTubeActivity[]> = {};

    filteredHistory.forEach(activity => {
      const date = new Date(activity.capturedAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(activity);
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

  if (profileLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="animate-spin text-primary-600" size={48} />
        <p className="font-bold text-slate-400 italic">Accessing YouTube activity...</p>
      </div>
    );
  }

  if (!isChildAccessible(childId)) {
    return (
      <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
        <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        <p className="text-slate-500 mt-2">You don&apos;t have permission to view this child&apos;s history.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Youtube className="text-red-600" size={24} />
            YouTube Watch History
          </h2>
          <p className="text-slate-500 text-sm mt-1">Videos detected on the child&apos;s device.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search videos or channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm w-64"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shadow-sm">
            <FilterBtn active={dateFilter === 'all'} onClick={() => setDateFilter('all')} label="All" />
            <FilterBtn active={dateFilter === 'today'} onClick={() => setDateFilter('today')} label="Today" />
            <FilterBtn active={dateFilter === '7d'} onClick={() => setDateFilter('7d')} label="7 Days" />
          </div>
        </div>
      </header>

      {history.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
            <Youtube size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-800">No YouTube history yet</h3>
          <p className="text-slate-500 max-w-xs mx-auto mt-2 italic text-sm">Videos detected on this child&apos;s device will appear here.</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
          <Search size={40} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">No videos match your current filters.</p>
          <button
            onClick={() => { setSearchQuery(''); setDateFilter('all'); }}
            className="mt-4 text-primary-600 font-bold text-sm hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {groupedHistory.map(([dateStr, activities]) => (
            <div key={dateStr} className="space-y-4">
              <div className="flex items-center gap-4">
                <h3 className="font-black text-slate-400 text-xs uppercase tracking-[0.2em]">{getDateLabel(dateStr)}</h3>
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => setSelectedActivity(activity)}
                    className="group bg-white p-5 rounded-[2rem] border border-slate-100 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-50/50 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex items-start gap-3 mb-4">

                      {/* Thumbnail */}
                      <div className="w-28 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-slate-100">
                        {activity.thumbnailUrl ? (
                          <img
                            src={activity.thumbnailUrl}
                            alt={activity.videoTitle || "YouTube thumbnail"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-red-600">
                            <Play size={24} fill="currentColor" />
                          </div>
                        )}
                      </div>

                      {/* Title + Channel */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 text-[15px] leading-snug line-clamp-2">
                          {activity.videoTitle}
                        </h4>

                        <div className="flex items-center gap-1.5 text-slate-500 mt-1">
                          <User size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="text-[11px] font-bold truncate">
                            {activity.channelName || "Unknown Channel"}
                          </span>
                        </div>
                      </div>

                    </div>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock size={12} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">
                          {activity.watchDurationSeconds ? formatDurationSeconds(activity.watchDurationSeconds) : "Unknown"}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
        <ActivityDetailsModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
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

function ActivityDetailsModal({ activity, onClose }: any) {
  const safeYoutubeUrl = useMemo(() => {
    if (!activity.youtubeUrl) return null;
    try {
      const url = new URL(activity.youtubeUrl);
      const validHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
      if (url.protocol === "https:" && validHosts.some(host => url.hostname === host || url.hostname.endsWith("." + host))) {
        return activity.youtubeUrl;
      }
    } catch (e) {
      return null;
    }
    return null;
  }, [activity.youtubeUrl]);

  const derivedThumbnail = useMemo(() => {
    if (activity.thumbnailUrl) return activity.thumbnailUrl;
    if (activity.videoId) return `https://img.youtube.com/vi/${activity.videoId}/hqdefault.jpg`;
    return null;
  }, [activity.thumbnailUrl, activity.videoId]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] bg-white p-6 md:p-10 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-6 top-6 p-2 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
          <X size={24} />
        </button>

        <header className="flex flex-col gap-6 mb-10">
          <div className="w-full aspect-video bg-slate-100 rounded-3xl overflow-hidden border border-slate-100 relative group">
            {derivedThumbnail ? (
              <img src={derivedThumbnail} alt={activity.videoTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-red-600 bg-red-50">
                <Youtube size={64} />
              </div>
            )}

            {safeYoutubeUrl && (
               <a
                href={safeYoutubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center text-red-600 shadow-xl">
                    <Play size={32} fill="currentColor" className="ml-1" />
                 </div>
               </a>
            )}
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{activity.videoTitle}</h2>
            <div className="flex items-center gap-2 mt-2 text-slate-500 font-bold">
              <User size={16} />
              <span>{activity.channelName || "Unknown Channel"}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
          <div className="space-y-6">
            <ModalInfo label="Captured At" value={new Date(activity.capturedAt).toLocaleString()} icon={Calendar} />
            <ModalInfo label="Watch Duration" value={formatDurationSeconds(activity.watchDurationSeconds)} icon={Clock} color="text-primary-600" />
            <ModalInfo label="Sync Status" value="Synced to Cloud" icon={CheckCircle2} color="text-emerald-600" />
          </div>

          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Smartphone size={14} /> Device Information
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Device ID</span>
                <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200">{activity.deviceId?.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Video ID</span>
                <span className="text-xs font-bold text-slate-700">{activity.videoId || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Sync Version</span>
                <span className="text-xs font-bold text-slate-700">v{activity.syncVersion}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {safeYoutubeUrl ? (
            <a
              href={safeYoutubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100"
            >
              <Youtube size={18} />
              Open on YouTube
              <ExternalLink size={14} />
            </a>
          ) : (
            <div className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center italic">
              Link unavailable
            </div>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Close Details
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
