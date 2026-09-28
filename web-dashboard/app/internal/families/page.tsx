"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Baby,
  CalendarDays,
  Home,
  Loader2,
  Search,
  ShieldAlert,
  Users
} from 'lucide-react';
import InternalLayout from '@/components/InternalLayout';
import {
  AdminFamilyOverview,
  AdminRepository
} from '@/lib/repositories/AdminRepository';

function createdLabel(timestamp?: number) {
  return timestamp
    ? new Date(timestamp).toLocaleDateString()
    : 'Unknown';
}

export default function InternalFamiliesPage() {
  const [families, setFamilies] = useState<AdminFamilyOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    AdminRepository.getFamilyOverview()
      .then(data => {
        if (active) setFamilies(data);
      })
      .catch(() => {
        if (active) setError('Family overview could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredFamilies = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return families;
    return families.filter(family => [
      family.familyName,
      family.familyId,
      family.ownerName,
      family.ownerEmail,
      family.ownerId,
      family.subscriptionStatus
    ].some(value => value?.toLowerCase().includes(term)));
  }, [families, search]);

  const totalChildren = families.reduce(
    (total, family) => total + family.childCount,
    0
  );
  const pendingDeletion = families.filter(
    family => family.deletionStatus === 'PENDING_DELETION'
  ).length;

  return (
    <InternalLayout>
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Home className="text-rose-500" size={28} />
          <h1 className="text-3xl font-black uppercase italic text-white">
            Families
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          {families.length} families · {totalChildren} children · {pendingDeletion} pending deletion
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <Search size={18} className="text-slate-500" />
        <input
          aria-label="Search families"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search family, owner, email or subscription..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="animate-spin text-rose-500" size={42} />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/50 text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-4">Family</th>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4">Members</th>
                  <th className="px-5 py-4">Children</th>
                  <th className="px-5 py-4">Subscription</th>
                  <th className="px-5 py-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredFamilies.map(family => (
                  <tr key={family.familyId} className="text-slate-300 hover:bg-slate-800/40">
                    <td className="px-5 py-4">
                      <p className="font-bold text-white">{family.familyName}</p>
                      <p className="mt-1 font-mono text-[10px] text-slate-600">
                        {family.familyId}
                      </p>
                      {family.deletionStatus === 'PENDING_DELETION' && (
                        <span className="mt-2 inline-flex items-center gap-1 text-xs text-rose-400">
                          <ShieldAlert size={13} /> Pending deletion
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p>{family.ownerName || 'Unknown owner'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {family.ownerEmail || family.ownerId}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2">
                        <Users size={15} /> {family.memberCount}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">
                        {family.managerCount} managers
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2">
                        <Baby size={15} /> {family.childCount}/{family.childSlots || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
                        {family.subscriptionStatus}
                      </span>
                      <p className="mt-2 text-xs text-slate-500">
                        Retention: {family.dataRetentionDays
                          ? `${family.dataRetentionDays} days`
                          : 'Disabled'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays size={14} /> {createdLabel(family.createdAt)}
                      </span>
                      {family.lastActiveDate && (
                        <p className="mt-2">Active: {family.lastActiveDate}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredFamilies.length === 0 && (
            <p className="px-6 py-16 text-center text-sm text-slate-500">
              No matching families.
            </p>
          )}
        </div>
      )}
    </InternalLayout>
  );
}
