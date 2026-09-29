"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import InternalLayout from "@/components/InternalLayout";
import {
  AdminErrorReport,
  AdminIssueStatus,
  AdminIssueTriage,
  AdminRepository
} from "@/lib/repositories/AdminRepository";

type IssueStatusFilter = "ALL" | AdminIssueStatus;

interface IssueGroup {
  key: string;
  reports: AdminErrorReport[];
  latest: AdminErrorReport;
  firstSeen: number;
  lastSeen: number;
  deviceCount: number;
  status: AdminIssueStatus;
}

const statusStyles: Record<AdminIssueStatus, string> = {
  OPEN: "bg-rose-500/10 text-rose-400",
  ACKNOWLEDGED: "bg-amber-500/10 text-amber-400",
  RESOLVED: "bg-emerald-500/10 text-emerald-400"
};

export default function InternalIssuesPage() {
  const [reports, setReports] = useState<AdminErrorReport[]>([]);
  const [triage, setTriage] = useState<Record<string, AdminIssueTriage>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      AdminRepository.getErrorReports(),
      AdminRepository.getIssueTriage()
    ])
      .then(([reportData, triageData]) => {
        if (active) {
          setReports(reportData);
          setTriage(triageData);
        }
      })
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
      const savedTriage = triage[key];
      const hasRecurredAfterResolution =
        savedTriage?.status === "RESOLVED" &&
        savedTriage.updatedAt !== undefined &&
        ordered[0].capturedAt > savedTriage.updatedAt;
      return {
        key,
        reports: ordered,
        latest: ordered[0],
        firstSeen: ordered[ordered.length - 1].capturedAt,
        lastSeen: ordered[0].capturedAt,
        deviceCount: new Set(ordered.map(item => item.deviceId || item.childId)).size,
        status: hasRecurredAfterResolution
          ? "OPEN"
          : savedTriage?.status || "OPEN"
      };
    }).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [reports, triage]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter(group => {
      if (statusFilter !== "ALL" && group.status !== statusFilter) return false;
      if (!term) return true;
      return group.reports.some(report => [
        report.tag,
        report.message,
        report.childId,
        report.familyId,
        report.deviceModel,
        report.appVersion,
        report.fingerprint
      ].some(value => value?.toLowerCase().includes(term)));
    });
  }, [groups, search, statusFilter]);

  const statusCounts = useMemo(() => ({
    OPEN: groups.filter(group => group.status === "OPEN").length,
    ACKNOWLEDGED: groups.filter(group => group.status === "ACKNOWLEDGED").length,
    RESOLVED: groups.filter(group => group.status === "RESOLVED").length
  }), [groups]);

  const affectedDevices = new Set(reports.map(report => report.deviceId || report.childId)).size;

  async function changeStatus(fingerprint: string, status: AdminIssueStatus) {
    setUpdatingStatus(fingerprint);
    setError("");
    try {
      await AdminRepository.setIssueStatus(fingerprint, status);
      setTriage(current => ({
        ...current,
        [fingerprint]: {
          fingerprint,
          status,
          updatedAt: Date.now()
        }
      }));
    } catch {
      setError("Issue status could not be updated.");
    } finally {
      setUpdatingStatus(null);
    }
  }

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

      <div className="mb-4 flex flex-wrap gap-2">
        {(["ALL", "OPEN", "ACKNOWLEDGED", "RESOLVED"] as IssueStatusFilter[]).map(status => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-4 py-2 text-xs font-black transition ${
              statusFilter === status
                ? "bg-white text-slate-950"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {status === "ALL" ? `All (${groups.length})` : `${status} (${statusCounts[status]})`}
          </button>
        ))}
      </div>

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
      ) : error && reports.length === 0 ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">{error}</div>
      ) : (
        <div className="space-y-3">
          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>
          )}
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
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${statusStyles[group.status]}`}>{group.status}</span>
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
                    <div className="mb-4 flex flex-wrap gap-2">
                      {(["OPEN", "ACKNOWLEDGED", "RESOLVED"] as AdminIssueStatus[]).map(status => (
                        <button
                          key={status}
                          type="button"
                          disabled={updatingStatus === group.key || group.status === status}
                          onClick={() => changeStatus(group.key, status)}
                          className={`rounded-lg px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 ${statusStyles[status]}`}
                        >
                          {updatingStatus === group.key && group.status !== status ? "Saving..." : status}
                        </button>
                      ))}
                    </div>
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
