"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Loader2,
  TimerReset,
  X
} from "lucide-react";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import {
  ScreenTimeRequest,
  ScreenTimeRequestRepository
} from "@/lib/repositories/ScreenTimeRequestRepository";

interface ScreenTimeRequestsPanelProps {
  childId: string;
  canEdit: boolean;
  focusRequestId?: string | null;
}

const QUICK_MINUTES = [5, 10, 30, 45];

function requestTime(value: unknown): string {
  const timestamp = value as any;
  if (typeof timestamp?.toDate === "function") {
    return timestamp.toDate().toLocaleString();
  }
  if (typeof timestamp?.seconds === "number") {
    return new Date(timestamp.seconds * 1000).toLocaleString();
  }
  return "Just now";
}

function readableReason(reason: string): string {
  switch (String(reason || "").toUpperCase()) {
    case "TOTAL_LIMIT_REACHED":
      return "Daily total screen-time limit reached";
    case "LIMIT_REACHED":
      return "App time limit reached";
    case "SCHEDULE":
      return "Blocked by schedule";
    case "STATIC_BLOCK":
      return "App is blocked";
    default:
      return "Additional access requested";
  }
}

export default function ScreenTimeRequestsPanel({
  childId,
  canEdit,
  focusRequestId
}: ScreenTimeRequestsPanelProps) {
  const { profile } = useParentProfile();
  const [requests, setRequests] = useState<ScreenTimeRequest[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState("60");

  useEffect(
    () => ScreenTimeRequestRepository.listen(childId, setRequests),
    [childId]
  );

  const pending = useMemo(() => {
    const items = requests.filter(request => request.status === "PENDING");
    if (!focusRequestId) return items;
    return [...items].sort(request =>
      request.requestId === focusRequestId ? -1 : 1
    );
  }, [focusRequestId, requests]);

  const resolve = async (
    request: ScreenTimeRequest,
    status: "APPROVED" | "DENIED",
    minutes?: number
  ) => {
    if (!profile?.uid || !canEdit) return;
    try {
      setWorkingId(request.requestId);
      await ScreenTimeRequestRepository.resolve(
        childId,
        request.requestId,
        profile.uid,
        status,
        minutes
      );
      setCustomFor(null);
    } catch (error) {
      console.error("Failed to resolve screen-time request", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "The request could not be updated."
      );
    } finally {
      setWorkingId(null);
    }
  };

  if (pending.length === 0) return null;

  return (
    <section
      id="screen-time-requests"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-amber-200 p-4 sm:flex-row sm:items-start sm:justify-between md:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <TimerReset size={22} />
          </div>
          <div>
            <h2 className="break-words font-black text-amber-950">
              App access request
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Approve the request, adjust the allowed time, or deny it.
            </p>
          </div>
        </div>
        <span className="self-start whitespace-nowrap rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-black text-white">
          {pending.length} PENDING
        </span>
      </div>

      <div className="divide-y divide-amber-200">
        {pending.map(request => {
          const loading = workingId === request.requestId;
          const showCustom = customFor === request.requestId;

          return (
            <div
              key={request.requestId}
              className={
                "min-w-0 p-4 md:p-6 " +
                (request.requestId === focusRequestId
                  ? "bg-white ring-2 ring-inset ring-amber-400"
                  : "bg-white/60")
              }
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words font-black text-slate-900">
                    {request.appName || request.packageName}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {readableReason(request.reason)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                    <Clock3 size={12} />
                    {requestTime(request.requestedAt)}
                  </p>
                </div>

                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    disabled={!canEdit || loading}
                    onClick={() => resolve(request, "APPROVED", 30)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {loading
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Check size={15} />}
                    Approve 30m
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit || loading}
                    onClick={() => {
                      setCustomFor(showCustom ? null : request.requestId);
                      setCustomMinutes("60");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-primary-300 disabled:opacity-50"
                  >
                    Adjust time
                  </button>
                  <button
                    type="button"
                    disabled={!canEdit || loading}
                    onClick={() => resolve(request, "DENIED")}
                    className="flex items-center justify-center gap-1 rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-black text-rose-700 transition hover:bg-rose-200 disabled:opacity-50"
                  >
                    <X size={15} />
                    Deny
                  </button>
                </div>
              </div>

              {showCustom && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-white p-3">
                  <p className="mb-3 text-xs font-bold text-slate-500">
                    Select an adjusted duration or enter custom minutes.
                  </p>
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {QUICK_MINUTES.map(minutes => (
                      <button
                        key={minutes}
                        type="button"
                        disabled={!canEdit || loading}
                        onClick={() => resolve(request, "APPROVED", minutes)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500" htmlFor={`custom-${request.requestId}`}>
                    Custom
                  </label>
                  <input
                    id={`custom-${request.requestId}`}
                    type="number"
                    min={1}
                    max={1440}
                    value={customMinutes}
                    onChange={event => setCustomMinutes(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 font-bold outline-none focus:border-primary-500"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => resolve(
                      request,
                      "APPROVED",
                      Number.parseInt(customMinutes, 10)
                    )}
                    className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                  >
                    {loading
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Check size={15} />}
                    Approve
                  </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
