"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Unlock,
} from "lucide-react";

import InternalLayout from "@/components/InternalLayout";
import { useInternalAdmin } from "@/lib/context/InternalAdminContext";
import { PlatformAdminRole } from "@/lib/repositories/PlatformAdminRepository";
import {
  InternalLoginDefenseRepository,
  type InternalLoginBlock,
} from "@/lib/repositories/InternalLoginDefenseRepository";

function formatTimestamp(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export default function LoginBlocksPage() {
  const {admin} = useInternalAdmin();
  const [blocks, setBlocks] = useState<InternalLoginBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setHighlightedId(new URLSearchParams(window.location.search).get("requestId"));
  }, []);

  const loadBlocks = useCallback(async () => {
    if (admin?.role !== PlatformAdminRole.SUPER_ADMIN) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setBlocks(await InternalLoginDefenseRepository.listBlocks());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blocked logins could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [admin?.role]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const approve = async (block: InternalLoginBlock) => {
    const confirmed = window.confirm(
      `Approve ${block.ip}? Only continue if you recognize this login activity.`
    );
    if (!confirmed) return;

    setApproving(block.requestId);
    setError(null);
    setSuccess(null);
    try {
      await InternalLoginDefenseRepository.approveBlock(block.requestId);
      setBlocks(current => current.filter(item => item.requestId !== block.requestId));
      setSuccess(`${block.ip} is approved. The login page will unlock within 15 seconds.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This IP could not be approved.");
    } finally {
      setApproving(null);
    }
  };

  return (
    <InternalLayout>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-400">
            <ShieldAlert size={13} />
            Super Admin Security
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Login <span className="text-rose-500">Defense</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
            IPs are blocked after five failed password attempts within 15 minutes.
            Only the verified Super Admin owner can approve another attempt.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBlocks()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {admin?.role !== PlatformAdminRole.SUPER_ADMIN ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="font-black">Super Admin access required</p>
          <p className="mt-2 text-sm text-rose-300/80">Only the verified owner can review or approve blocked login IPs.</p>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="mb-6 flex gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-bold text-rose-200">
              <AlertCircle className="shrink-0" size={20} />
              {error}
            </div>
          )}
          {success && (
            <div role="status" className="mb-6 flex gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
              <CheckCircle2 className="shrink-0" size={20} />
              {success}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60">
              <Loader2 className="animate-spin text-rose-500" size={32} />
            </div>
          ) : blocks.length === 0 ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-10 text-center">
              <CheckCircle2 className="mx-auto text-emerald-400" size={36} />
              <p className="mt-4 font-black text-white">No blocked login IPs</p>
              <p className="mt-1 text-sm text-slate-500">New security events will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map(block => {
                const highlighted = highlightedId === block.requestId;
                return (
                  <article
                    key={block.requestId}
                    className={`rounded-2xl border bg-slate-900 p-5 shadow-xl ${highlighted ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-800"}`}
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-300">Blocked</span>
                          <span className="font-mono text-sm font-bold text-white">{block.ip}</span>
                        </div>
                        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Attempted email</dt>
                            <dd className="mt-1 break-all font-semibold text-slate-200">{block.attemptedEmail || "Unknown"}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Blocked at</dt>
                            <dd className="mt-1 font-semibold text-slate-200">{formatTimestamp(block.blockedAt)}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Failed attempts</dt>
                            <dd className="mt-1 font-semibold text-slate-200">{block.failureCount}</dd>
                          </div>
                          <div className="sm:col-span-2 xl:col-span-3">
                            <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">Browser</dt>
                            <dd className="mt-1 break-words font-mono text-xs leading-relaxed text-slate-400">{block.userAgent}</dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                          <span className={block.emailAlertSent ? "text-emerald-400" : "text-amber-400"}>Email {block.emailAlertSent ? "sent" : "pending"}</span>
                          <span className="text-slate-700">•</span>
                          <span className={block.pushAlertSent ? "text-emerald-400" : "text-amber-400"}>Phone alert {block.pushAlertSent ? "sent" : "pending"}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void approve(block)}
                        disabled={approving !== null}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {approving === block.requestId ? <Loader2 className="animate-spin" size={17} /> : <Unlock size={17} />}
                        Approve IP
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </InternalLayout>
  );
}

