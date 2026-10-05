"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Loader2,
  RefreshCw,
  XCircle
} from "lucide-react";
import Link from "next/link";
import InternalLayout from "@/components/InternalLayout";
import {
  AdminDeviceHealth,
  AdminErrorReport,
  AdminIssueTriage,
  AdminRepository
} from "@/lib/repositories/AdminRepository";
import { SupportRepository, SupportTicket } from "@/lib/repositories/SupportRepository";
import { ConfigRepository, UpdateConfig } from "@/lib/repositories/ConfigRepository";

type CheckStatus = "HEALTHY" | "WARNING" | "CRITICAL";
type HealthCheck = {
  name: string;
  detail: string;
  status: CheckStatus;
  href: string;
  action: string;
  count?: number;
};

const REQUIRED_PERMISSIONS: Array<keyof AdminDeviceHealth> = [
  "locationPermissionGranted",
  "backgroundLocationPermissionGranted",
  "usageAccessGranted",
  "overlayPermissionGranted",
  "accessibilityPermissionGranted",
  "batteryOptimizationExempt"
];

export default function InternalHealthPage() {
  const [devices, setDevices] = useState<AdminDeviceHealth[]>([]);
  const [reports, setReports] = useState<AdminErrorReport[]>([]);
  const [triage, setTriage] = useState<Record<string, AdminIssueTriage>>({});
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [release, setRelease] = useState<UpdateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState(0);

  const runChecks = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const [deviceData, errorData, triageData, releaseData] = await Promise.all([
        AdminRepository.getDeviceHealth(),
        AdminRepository.getErrorReports(),
        AdminRepository.getIssueTriage(),
        ConfigRepository.getUpdateConfig()
      ]);
      setDevices(deviceData);
      setReports(errorData);
      setTriage(triageData);
      setRelease(releaseData);
      setCheckedAt(Date.now());
    } catch (loadError) {
      console.error(loadError);
      setError("One or more automated health checks could not run.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void runChecks();
    const timer = window.setInterval(() => void runChecks(), 60_000);
    const unsubscribe = SupportRepository.listenToAllTickets(setTickets);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [runChecks]);

  const checks = useMemo<HealthCheck[]>(() => {
    const staleBefore = Date.now() - 30 * 60_000;
    const stale = devices.filter(device => !device.lastSeen || device.lastSeen < staleBefore);
    const unhealthy = devices.filter(device => device.syncHealthy === false);
    const permissionWarnings = devices.filter(device =>
      REQUIRED_PERMISSIONS.some(permission => device[permission] === false)
    );
    const neverReported = devices.filter(device => !device.lastSeen);
    const openFingerprints = new Set<string>();
    reports.forEach(report => {
      const key = report.fingerprint || report.id;
      const saved = triage[key];
      const reopened = saved?.status === "RESOLVED" &&
        saved.updatedAt !== undefined && report.capturedAt > saved.updatedAt;
      if (!saved || saved.status === "OPEN" || reopened) openFingerprints.add(key);
    });
    const openTickets = tickets.filter(ticket => ["OPEN", "IN_PROGRESS"].includes(ticket.status));

    return [
      {
        name: "Device heartbeat",
        detail: stale.length ? `${stale.length} device(s) have not reported in 30 minutes.` : "All reporting devices have a recent heartbeat.",
        status: stale.length ? "WARNING" : "HEALTHY",
        href: "/internal/devices",
        action: "View devices",
        count: stale.length
      },
      {
        name: "Cloud sync pipeline",
        detail: unhealthy.length ? `${unhealthy.length} device(s) report an unhealthy sync state.` : "No device reports an active sync failure.",
        status: unhealthy.length ? "CRITICAL" : "HEALTHY",
        href: "/internal/devices",
        action: "Inspect sync",
        count: unhealthy.length
      },
      {
        name: "Permission coverage",
        detail: permissionWarnings.length ? `${permissionWarnings.length} device(s) have a required permission disabled.` : "All reported permission sets are healthy.",
        status: permissionWarnings.length ? "WARNING" : "HEALTHY",
        href: "/internal/devices",
        action: "Review permissions",
        count: permissionWarnings.length
      },
      {
        name: "Telemetry onboarding",
        detail: neverReported.length ? `${neverReported.length} paired device(s) have never sent telemetry.` : "Every paired device has reported telemetry.",
        status: neverReported.length ? "WARNING" : "HEALTHY",
        href: "/internal/devices",
        action: "View onboarding",
        count: neverReported.length
      },
      {
        name: "Open application issues",
        detail: openFingerprints.size ? `${openFingerprints.size} unresolved issue group(s) need review.` : "No unresolved application issue is detected.",
        status: openFingerprints.size ? "CRITICAL" : "HEALTHY",
        href: "/internal/issues",
        action: "Open issues",
        count: openFingerprints.size
      },
      {
        name: "Support response queue",
        detail: openTickets.length ? `${openTickets.length} support conversation(s) are open.` : "No support conversation is waiting.",
        status: openTickets.length ? "WARNING" : "HEALTHY",
        href: "/internal/support",
        action: "Open support",
        count: openTickets.length
      },
      {
        name: "Release configuration",
        detail: release?.latestVersionName ? `Latest configured version is ${release.latestVersionName}.` : "No active application release is configured.",
        status: release?.latestVersionName ? "HEALTHY" : "CRITICAL",
        href: "/internal/releases",
        action: "Manage releases"
      }
    ];
  }, [devices, release, reports, tickets, triage]);

  const critical = checks.filter(check => check.status === "CRITICAL").length;
  const warning = checks.filter(check => check.status === "WARNING").length;
  const healthy = checks.filter(check => check.status === "HEALTHY").length;
  const overall = critical ? "CRITICAL" : warning ? "WARNING" : "HEALTHY";

  const statusStyle: Record<CheckStatus, string> = {
    HEALTHY: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    WARNING: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    CRITICAL: "border-rose-500/20 bg-rose-500/5 text-rose-400"
  };

  if (loading) {
    return <InternalLayout><div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-rose-500" size={44} /></div></InternalLayout>;
  }

  return (
    <InternalLayout>
      <div className="space-y-7">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">Automated regression monitor</p>
            <h1 className="mt-1 text-3xl font-black uppercase italic text-white">System <span className="text-rose-500">Health</span></h1>
            <p className="mt-2 text-sm text-slate-500">Runs automatically every minute while this page is open.</p>
          </div>
          <button onClick={() => void runChecks(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-rose-500 disabled:opacity-60">
            {refreshing ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Run checks now
          </button>
        </header>

        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-bold text-rose-300">{error}</div>}

        <section className={`rounded-3xl border p-6 ${statusStyle[overall]}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-slate-950/60 p-3"><HeartPulse size={28} /></div>
              <div><p className="text-xs font-black uppercase tracking-widest opacity-70">Overall platform state</p><p className="mt-1 text-2xl font-black">{overall}</p></div>
            </div>
            <div className="flex gap-3 text-xs font-black"><span>{healthy} Healthy</span><span>{warning} Warning</span><span>{critical} Critical</span></div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {checks.map(check => {
            const Icon = check.status === "HEALTHY" ? CheckCircle2 : check.status === "WARNING" ? AlertTriangle : XCircle;
            return (
              <Link
                key={check.name}
                href={check.href}
                aria-label={`${check.action}: ${check.name}`}
                className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:border-current ${statusStyle[check.status]}`}
              >
                <div className="flex items-start justify-between gap-3"><Icon size={22} /><span className="rounded-full bg-slate-950/50 px-2 py-1 text-[9px] font-black tracking-wider">{check.status}</span></div>
                <h2 className="mt-5 font-black text-white">{check.name}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-400">{check.detail}</p>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider opacity-70 transition group-hover:opacity-100">
                  {check.action}<ArrowUpRight size={13} />
                </div>
              </Link>
            );
          })}
        </section>

        <div className="flex items-center gap-2 text-xs text-slate-600"><Clock3 size={14} />Last completed: {checkedAt ? new Date(checkedAt).toLocaleString() : "Not available"}</div>
      </div>
    </InternalLayout>
  );
}
