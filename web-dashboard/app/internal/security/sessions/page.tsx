"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import InternalLayout from "@/components/InternalLayout";
import { useInternalAdmin } from "@/lib/context/InternalAdminContext";
import {
  InternalLoginDefenseRepository,
  type InternalAdminSession,
  type InternalSessionSecurityEvent,
} from "@/lib/repositories/InternalLoginDefenseRepository";
import { PlatformAdminRole } from "@/lib/repositories/PlatformAdminRepository";

function formatTimestamp(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function stateClass(state: string): string {
  if (state === "ACTIVE") return "bg-emerald-500/15 text-emerald-300";
  if (state === "COMPROMISED") return "bg-rose-500/15 text-rose-300";
  return "bg-slate-700/50 text-slate-300";
}

export default function InternalSessionsPage() {
  const {admin} = useInternalAdmin();
  const [sessions, setSessions] = useState<InternalAdminSession[]>([]);
  const [events, setEvents] = useState<InternalSessionSecurityEvent[]>([]);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setHighlightedEventId(new URLSearchParams(window.location.search).get("eventId"));
  }, []);

  const load = useCallback(async () => {
    if (admin?.role !== PlatformAdminRole.SUPER_ADMIN) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await InternalLoginDefenseRepository.listSessions();
      setSessions(result.sessions);
      setEvents(result.events);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sessions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [admin?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const orderedSessions = useMemo(() => [...sessions].sort((left, right) => {
    if (left.state === "ACTIVE" && right.state !== "ACTIVE") return -1;
    if (right.state === "ACTIVE" && left.state !== "ACTIVE") return 1;
    return String(right.lastSeenAt || "").localeCompare(String(left.lastSeenAt || ""));
  }), [sessions]);

  const revoke = async (session: InternalAdminSession) => {
    if (!window.confirm(`Revoke every Firebase session for ${session.email || session.uid}?`)) return;
    setRevoking(session.uid);
    setError(null);
    setSuccess(null);
    try {
      await InternalLoginDefenseRepository.revokeSession(session.uid);
      setSuccess(`${session.email || session.uid} was revoked immediately.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The session could not be revoked.");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <InternalLayout>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-300">
            <MonitorSmartphone size={13} /> Session theft protection
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Admin <span className="text-indigo-400">Sessions</span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-400">
            Internal sessions are single-login, server-registered and bound to the original IP and browser. A mismatch disables the session, revokes refresh tokens and alerts the owner.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-800 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {admin?.role !== PlatformAdminRole.SUPER_ADMIN ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-black">Super Admin access required</p>
          <p className="mt-2 text-sm text-rose-300/80">Only the verified owner can review or revoke internal sessions.</p>
        </div>
      ) : (
        <>
          {error && <div role="alert" className="mb-6 flex gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-200"><AlertCircle className="shrink-0" size={20} />{error}</div>}
          {success && <div role="status" className="mb-6 flex gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200"><CheckCircle2 className="shrink-0" size={20} />{success}</div>}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60"><Loader2 className="animate-spin text-indigo-400" size={32} /></div>
          ) : (
            <div className="space-y-8">
              <section>
                <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-300">Registered sessions</h2>
                <div className="space-y-4">
                  {orderedSessions.map(session => (
                    <article key={session.uid} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${stateClass(session.state)}`}>{session.state}</span>
                            <span className="break-all text-sm font-bold text-white">{session.email || session.uid}</span>
                            <span className="text-xs font-bold text-slate-500">{session.role}</span>
                          </div>
                          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                            <div><dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">IP</dt><dd className="mt-1 font-mono font-semibold text-slate-200">{session.ip}</dd></div>
                            <div><dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Started</dt><dd className="mt-1 font-semibold text-slate-200">{formatTimestamp(session.createdAt)}</dd></div>
                            <div><dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Last verified</dt><dd className="mt-1 font-semibold text-slate-200">{formatTimestamp(session.lastSeenAt)}</dd></div>
                            <div><dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Expires</dt><dd className="mt-1 font-semibold text-slate-200">{formatTimestamp(session.expiresAt)}</dd></div>
                            <div className="sm:col-span-2 xl:col-span-4"><dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Browser</dt><dd className="mt-1 break-words font-mono text-xs leading-relaxed text-slate-400">{session.userAgent}</dd></div>
                          </dl>
                        </div>
                        {session.state === "ACTIVE" && (
                          <button type="button" onClick={() => void revoke(session)} disabled={revoking !== null} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-50">
                            {revoking === session.uid ? <Loader2 className="animate-spin" size={17} /> : <Ban size={17} />} Revoke
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {orderedSessions.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">No registered internal sessions.</div>}
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-300">Recent security events</h2>
                {events.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center text-sm text-emerald-200">No session security events.</div>
                ) : (
                  <div className="space-y-3">
                    {events.map(event => (
                      <article key={event.eventId} className={`rounded-2xl border bg-slate-900 p-4 ${highlightedEventId === event.eventId ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-800"}`}>
                        <div className="flex items-start gap-3">
                          {event.type.includes("COMPROMISED") ? <ShieldAlert className="mt-0.5 shrink-0 text-rose-400" size={20} /> : <CheckCircle2 className="mt-0.5 shrink-0 text-slate-500" size={20} />}
                          <div className="min-w-0">
                            <p className="break-all text-sm font-black text-white">{event.type.replaceAll("_", " ")}</p>
                            <p className="mt-1 text-xs text-slate-400">{event.email || event.uid} • {formatTimestamp(event.createdAt)}</p>
                            {event.reason && <p className="mt-2 text-xs font-bold text-rose-300">Reason: {event.reason}</p>}
                            {(event.originalIp || event.observedIp) && <p className="mt-1 font-mono text-xs text-slate-500">{event.originalIp || "?"} → {event.observedIp || "?"}</p>}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </InternalLayout>
  );
}
