"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Clock3,
  History,
  Loader2,
  TimerOff
} from "lucide-react";
import {
  RestrictionEvent,
  RestrictionEventRepository
} from "@/lib/repositories/RestrictionEventRepository";

interface RestrictionHistoryPanelProps {
  childId: string;
}

type Range = "today" | "7days" | "all";

function reasonDetails(reason: string) {
  switch (reason) {
    case "LIMIT_REACHED":
      return { label: "App limit reached", icon: TimerOff, color: "text-amber-700 bg-amber-50" };
    case "TOTAL_LIMIT_REACHED":
      return { label: "Daily screen time finished", icon: Clock3, color: "text-rose-700 bg-rose-50" };
    case "SCHEDULE":
      return { label: "Blocked by schedule", icon: Clock3, color: "text-indigo-700 bg-indigo-50" };
    default:
      return { label: "Blocked app attempt", icon: Ban, color: "text-rose-700 bg-rose-50" };
  }
}

export default function RestrictionHistoryPanel({
  childId
}: RestrictionHistoryPanelProps) {
  const [events, setEvents] = useState<RestrictionEvent[]>([]);
  const [range, setRange] = useState<Range>("7days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    return RestrictionEventRepository.subscribe(
      childId,
      data => {
        setEvents(data);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
  }, [childId]);

  const filteredEvents = useMemo(() => {
    if (range === "all") return events;
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (range === "7days") start.setDate(start.getDate() - 6);
    return events.filter(event => event.occurredAt >= start.getTime());
  }, [events, range]);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-800">
            <History className="text-primary-600" />
            Restriction History
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            App blocks and screen-time limits recorded by the child device.
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(["today", "7days", "all"] as Range[]).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={
                "rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-wider transition " +
                (range === option
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-slate-500")
              }
            >
              {option === "today" ? "Today" : option === "7days" ? "7 Days" : "All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
          <Loader2 className="animate-spin" />
          <span className="text-sm font-bold">Loading restriction events...</span>
        </div>
      ) : error ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-amber-50 p-5 text-amber-800">
          <AlertTriangle size={20} />
          <p className="text-sm font-bold">Restriction history could not be loaded.</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-14 text-center">
          <Ban className="mx-auto mb-3 text-slate-300" size={34} />
          <p className="font-bold text-slate-700">No restriction events in this period</p>
          <p className="mt-1 text-xs text-slate-400">New blocked attempts and limit events will appear here.</p>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-slate-100">
          {filteredEvents.map(event => {
            const details = reasonDetails(event.reason);
            const Icon = details.icon;
            return (
              <div key={event.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <div className={"rounded-2xl p-3 " + details.color}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="truncate font-black text-slate-800">{event.appName}</h4>
                    <time className="shrink-0 text-[11px] font-bold text-slate-400">
                      {event.occurredAt
                        ? new Date(event.occurredAt).toLocaleString()
                        : event.date || "Time unavailable"}
                    </time>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">{details.label}</p>
                  {event.packageName && event.packageName !== "total_screen_time" ? (
                    <p className="mt-1 truncate text-[10px] text-slate-400">{event.packageName}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
