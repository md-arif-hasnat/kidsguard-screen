"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import InternalLayout from "@/components/InternalLayout";
import { AdminErrorReport, AdminRepository } from "@/lib/repositories/AdminRepository";

interface IssueGroup {
  key: string;
  reports: AdminErrorReport[];
  latest: AdminErrorReport;
  firstSeen: number;
  lastSeen: number;
  deviceCount: number;
}

export default function InternalIssuesPage() {
  const [reports, setReports] = useState<AdminErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    AdminRepository.getErrorReports()
      .then(data => { if (active) setReports(data); })
      .catch(() => { if (active) setError("Error reports could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const groups = useMemo<IssueGroup[]>(() => {
    const byFingerprint = new Map<string, AdminErrorReport[]>();
    reports.forEach(report => {
      const key = report.fingerprint || `${report.tag}:${report.message}`;
      byFingerprint.set(key, [...(byFingerprint.get(key) || []), report]);
    });

    return Array.from(byFingerprint.entries()).map(([key, items]) => {
      const ordered = [...items].sort((a, b) => b.capturedAt - a.capturedAt);
      return {
        key,
        reports: ordered,
        latest: ordered[0],
        firstSeen: ordered[ordered.length - 1].capturedAt,
        lastSeen: ordered[0].capturedAt,
        deviceCount: new Set(ordered.map(item => item.deviceId || item.childId)).size
      };
    }).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [reports]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(group => group.reports.some(report => [
      report.tag,
      report.message,
      report.childId,
      report.familyId,
      report.deviceModel,
      report.appVersion,
      report.fingerprint
    ].some(value => value?.toLowerCase().includes(term))));
  }, [groups, search]);

  const affectedDevices = new Set(reports.map(report => report.deviceId || report.childId)).size;

  return (
    <InternalLayout>
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <AlertCircle className="text-rose-500" size={28} />
          <h1 className="text-3xl font-black uppercase italic text-white">App Issues</h1>
        </div>
        <p className="text-sm text-slate-500">
          {groups.length} unique issues · {reports.length} reports · {affectedDevices} affected devices
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <Search size={18} className="text-slate-500" />
        <input
          aria-label="Search issues"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search tag, message, child, family or version..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="animate-spin text-rose-500" size={42} /></div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">{error}</div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const report = group.latest;
            const expanded = expandedId === group.key;
            return (
              <article key={group.key} className="rounded-2xl border border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : group.key)}
                  className="flex w-full items-start justify-between gap-4 p-5 text-left"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-400">{report.tag}</span>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-amber-400">
                        {group.reports.length} occurrence{group.reports.length === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs text-slate-600">{group.deviceCount} device{group.deviceCount === 1 ? "" : "s"}</span>
                    </div>
                    <p className="break-words font-bold text-white">{report.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Last seen {new Date(group.lastSeen).toLocaleString()} · v{report.appVersion || "Unknown"} · {report.deviceModel || "Unknown device"}
                    </p>
                  </div>
                  {expanded ? <ChevronUp className="shrink-0 text-slate-500" /> : <ChevronDown className="shrink-0 text-slate-500" />}
                </button>

                {expanded && (
                  <div className="border-t border-slate-800 p-5">
                    <div className="mb-4 grid grid-cols-1 gap-3 text-xs text-slate-500 sm:grid-cols-3">
                      <p>First seen<br /><span className="text-slate-300">{new Date(group.firstSeen).toLocaleString()}</span></p>
                      <p>Latest child<br /><span className="text-slate-300">{report.childId}</span></p>
                      <p>Latest family<br /><span className="text-slate-300">{report.familyId}</span></p>
                    </div>
                    <p className="mb-3 break-all font-mono text-[10px] text-slate-600">Fingerprint: {group.key}</p>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs text-slate-300">
                      {report.stackTrace || "No stack trace was captured."}
                    </pre>
                  </div>
                )}
              </article>
            );
          })}

          {filteredGroups.length === 0 && (
            <p className="py-16 text-center text-sm text-slate-500">No matching error reports.</p>
          )}
        </div>
      )}
    </InternalLayout>
  );
}
