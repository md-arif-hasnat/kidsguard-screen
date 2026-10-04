"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  AppWindow,
  BarChart3,
  Clock3,
  Globe2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Youtube
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import {
  WeeklyReportRepository,
  WeeklySafetyReport
} from "@/lib/repositories/WeeklyReportRepository";

function duration(value: number): string {
  const minutes = Math.round(Math.max(0, value) / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function dateRange(report: WeeklySafetyReport): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric"
  };
  return `${new Date(report.periodStart).toLocaleDateString(undefined, options)} – ${new Date(report.periodEnd).toLocaleDateString(undefined, options)}`;
}

export default function WeeklyReportsPage() {
  const { profile, family, loading: profileLoading } = useParentProfile();
  const familyId =
    profile?.activeFamilyId ||
    profile?.ownedFamilyId ||
    profile?.familyId ||
    profile?.familyIds?.[0] ||
    "";
  const [reports, setReports] = useState<WeeklySafetyReport[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!familyId) {
      setLoading(false);
      return;
    }
    return WeeklyReportRepository.listen(
      familyId,
      data => {
        setReports(data);
        setSelectedId(current => current || data[0]?.id || "");
        setLoading(false);
      },
      () => {
        setError("Weekly reports could not be loaded.");
        setLoading(false);
      }
    );
  }, [familyId]);

  const report = useMemo(
    () => reports.find(item => item.id === selectedId) || reports[0],
    [reports, selectedId]
  );

  const generate = async () => {
    if (!familyId) return;
    setGenerating(true);
    setError("");
    try {
      const reportId = await WeeklyReportRepository.generateNow(familyId);
      setSelectedId(reportId);
    } catch (generationError) {
      console.error(generationError);
      setError("Report generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  if (profileLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="animate-spin text-primary-500" size={42} />
        </div>
      </DashboardLayout>
    );
  }

  const cards = report ? [
    { label: "Screen time", value: duration(report.totals.screenTimeMs), icon: Clock3, tone: "text-blue-500" },
    { label: "YouTube views", value: report.totals.youtubeViews, icon: Youtube, tone: "text-rose-500" },
    { label: "Web visits", value: report.totals.browserVisits, icon: Globe2, tone: "text-violet-500" },
    { label: "New apps", value: report.totals.installedApps, icon: AppWindow, tone: "text-emerald-500" },
    { label: "Blocked attempts", value: report.totals.blockedAttempts, icon: ShieldCheck, tone: "text-amber-500" },
    { label: "Offline devices", value: report.totals.offlineDevices, icon: Smartphone, tone: "text-slate-500" }
  ] : [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-600">Family intelligence</p>
            <h1 className="mt-1 text-3xl font-black text-slate-900">Weekly Safety Report</h1>
            <p className="mt-1 text-sm text-slate-500">A clear seven-day view of activity, safety and device health.</p>
          </div>
          <button
            onClick={generate}
            disabled={generating || !familyId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary-500/20 hover:bg-primary-700 disabled:opacity-60"
          >
            {generating ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
            {generating ? "Generating…" : "Generate latest report"}
          </button>
        </header>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {!report ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <BarChart3 className="mx-auto text-primary-500" size={44} />
            <h2 className="mt-4 text-xl font-black text-slate-900">No weekly report yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Generate the first report now. Future reports will be created automatically every Monday.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Reporting period</p>
                <p className="mt-1 font-black text-slate-900">{dateRange(report)}</p>
              </div>
              <select
                value={report.id}
                onChange={event => setSelectedId(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500"
              >
                {reports.map(item => <option key={item.id} value={item.id}>{dateRange(item)}</option>)}
              </select>
            </div>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
              {cards.map(card => (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <card.icon className={card.tone} size={21} />
                  <p className="mt-4 text-xl font-black text-slate-900">{card.value}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{card.label}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1fr_1.7fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-black text-slate-900">Priority highlights</h2>
                <div className="mt-4 space-y-3">
                  {report.highlights.map((highlight, index) => (
                    <div key={`${highlight}-${index}`} className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-black text-primary-700">{index + 1}</span>
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl bg-primary-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-primary-700">Screen-time trend</p>
                  <p className="mt-1 text-2xl font-black text-primary-900">
                    {report.totals.screenTimeChangePercent > 0 ? "+" : ""}{report.totals.screenTimeChangePercent}%
                  </p>
                  <p className="text-xs text-primary-700">compared with the previous seven days</p>
                </div>
              </div>

              <div className="space-y-4">
                {report.childReports.map(child => (
                  <article key={child.childId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-900">{child.childName}</h2>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                          {child.deviceOnline ? "Device online" : "Device offline"}
                        </p>
                      </div>
                      <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">{duration(child.screenTimeMs)}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 p-3"><p className="font-black text-slate-900">{child.youtubeViews}</p><p className="text-[10px] uppercase text-slate-400">YouTube</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="font-black text-slate-900">{child.browserVisits}</p><p className="text-[10px] uppercase text-slate-400">Web</p></div>
                      <div className="rounded-xl bg-slate-50 p-3"><p className="font-black text-slate-900">{child.blockedAttempts}</p><p className="text-[10px] uppercase text-slate-400">Blocked</p></div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-400">Most used apps</p>
                      <div className="mt-2 space-y-2">
                        {child.topApps.length === 0 ? <p className="text-sm text-slate-400">No app-usage data reported.</p> : child.topApps.map(app => (
                          <div key={app.packageName || app.appName} className="flex items-center justify-between text-sm">
                            <span className="truncate font-bold text-slate-700">{app.appName}</span>
                            <span className="ml-3 shrink-0 text-slate-500">{duration(app.totalTimeMs)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
