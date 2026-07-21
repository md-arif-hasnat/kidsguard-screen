"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  AppWindow,
  Search,
  Calendar,
  ArrowUpDown,
  ShieldCheck,
  Loader2,
  Package,
  Clock,
  ExternalLink
} from 'lucide-react';
import { InstalledAppsRepository, InstalledApp } from '@/lib/repositories/InstalledAppsRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { clsx } from 'clsx';

type SortOption = 'newest' | 'oldest' | 'alphabetical';

export default function InstalledAppsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const childId = params.childId as string;
  const highlightPkg = searchParams.get('pkg');

  const { profile, family, isChildAccessible, loading: profileLoading } = useParentProfile();
  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    if (!childId) return;
    return ChildRepository.listenToChildStatus(childId, setChildStatus);
  }, [childId]);

  useEffect(() => {
    if (!childId || profileLoading) return;

    if (!isChildAccessible(childId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    return InstalledAppsRepository.listenToInstalledApps(childId, (data) => {
      setApps(data);
      setLoading(false);
    });
  }, [childId, profileLoading, isChildAccessible]);

  const filteredAndSortedApps = useMemo(() => {
    let result = apps.filter(app =>
      app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => b.installedAt - a.installedAt);
        break;
      case 'oldest':
        result.sort((a, b) => a.installedAt - b.installedAt);
        break;
      case 'alphabetical':
        result.sort((a, b) => a.appName.localeCompare(b.appName));
        break;
    }

    return result;
  }, [apps, searchQuery, sortBy]);

  if (profileLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2">
              <AppWindow className="text-primary-600" />
              Installed Apps
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Applications found on <span className="text-slate-900 font-bold">{childStatus?.childName || "Child device"}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
              <SortButton active={sortBy === 'newest'} onClick={() => setSortBy('newest')} label="Newest" />
              <SortButton active={sortBy === 'alphabetical'} onClick={() => setSortBy('alphabetical')} label="A-Z" />
            </div>
          </div>
        </div>
      </header>

      {filteredAndSortedApps.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={40} className="text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">No Apps Found</h2>
          <p className="text-slate-500 max-w-xs mx-auto mt-2">Try adjusting your search or check back later after the device syncs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
          {filteredAndSortedApps.map((app) => (
            <div
              key={app.packageName}
              className={clsx(
                "group bg-white p-5 rounded-2xl border transition-all hover:shadow-md relative overflow-hidden",
                highlightPkg === app.packageName ? "border-primary-500 ring-4 ring-primary-50" : "border-slate-100"
              )}
            >
              {highlightPkg === app.packageName && (
                <div className="absolute top-0 right-0 bg-primary-600 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">
                  New Install
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-xl font-black text-slate-300 border border-slate-100 shrink-0 group-hover:bg-primary-50 group-hover:text-primary-300 transition-colors">
                  {app.appName[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-slate-800 truncate group-hover:text-primary-900 transition-colors">
                    {app.appName}
                  </h3>
                  <p className="text-[10px] font-medium text-slate-400 truncate">{app.packageName}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Installed</p>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar size={12} className="text-slate-400" />
                    <span className="text-xs font-bold">{new Date(app.installedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Version</p>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <ShieldCheck size={12} className="text-primary-500" />
                    <span className="text-xs font-bold">{app.versionName}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock size={12} />
                  <span className="text-[10px] font-bold uppercase">First seen: {new Date(app.firstInstallTime).toLocaleDateString()}</span>
                </div>
                <button
                  className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-300 hover:text-primary-500 transition-all"
                  title="View on Play Store"
                  onClick={() => window.open(`https://play.google.com/store/apps/details?id=${app.packageName}`, '_blank')}
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

function SortButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
        active ? "bg-primary-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}
