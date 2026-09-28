"use client";

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Search } from 'lucide-react';
import InternalLayout from '@/components/InternalLayout';
import { AdminRepository } from '@/lib/repositories/AdminRepository';

interface AdminAuditLog {
  id: string;
  actorEmail?: string | null;
  actorUid?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  familyId?: string | null;
  createdAt?: { toDate?: () => Date };
}

export default function InternalAuditPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    AdminRepository.getRecentAuditLogs(200)
      .then(data => {
        if (active) setLogs(data as AdminAuditLog[]);
      })
      .catch(() => {
        if (active) setError('Audit logs could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;

    return logs.filter(log => [
      log.action,
      log.actorEmail,
      log.actorUid,
      log.targetType,
      log.targetId,
      log.familyId
    ].some(value => value?.toLowerCase().includes(term)));
  }, [logs, search]);

  return (
    <InternalLayout>
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ClipboardList className="text-rose-500" size={28} />
          <h1 className="text-3xl font-black uppercase italic text-white">
            Audit Logs
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          Immutable family, security, release and support activity.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <Search size={18} className="text-slate-500" />
        <input
          aria-label="Search audit logs"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search action, actor, family or target..."
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
                  <th className="px-5 py-4">Time</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Actor</th>
                  <th className="px-5 py-4">Target</th>
                  <th className="px-5 py-4">Family</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="text-slate-300 hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {log.createdAt?.toDate
                        ? log.createdAt.toDate().toLocaleString()
                        : 'Pending'}
                    </td>
                    <td className="px-5 py-4 font-bold text-white">
                      {log.action || 'UNKNOWN'}
                    </td>
                    <td className="px-5 py-4">
                      {log.actorEmail || log.actorUid || 'System'}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {log.targetType || '—'}
                      {log.targetId ? ` / ${log.targetId}` : ''}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {log.familyId || 'Platform'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <p className="px-6 py-16 text-center text-sm text-slate-500">
              No matching audit records.
            </p>
          )}
        </div>
      )}
    </InternalLayout>
  );
}
