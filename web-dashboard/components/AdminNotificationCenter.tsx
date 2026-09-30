"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, MessageSquare, Smartphone } from "lucide-react";
import {
  AdminDeviceHealth,
  AdminErrorReport,
  AdminIssueTriage,
  AdminRepository
} from "@/lib/repositories/AdminRepository";
import {
  SupportRepository,
  SupportTicket
} from "@/lib/repositories/SupportRepository";

type AdminNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  timestamp: number;
  type: "ISSUE" | "SUPPORT" | "DEVICE";
};

function toMillis(value: any): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function relativeTime(timestamp: number): string {
  if (!timestamp) return "Current";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminNotificationCenter() {
  const [reports, setReports] = useState<AdminErrorReport[]>([]);
  const [triage, setTriage] = useState<Record<string, AdminIssueTriage>>({});
  const [devices, setDevices] = useState<AdminDeviceHealth[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextReports, nextTriage, nextDevices] = await Promise.all([
          AdminRepository.getErrorReports(),
          AdminRepository.getIssueTriage(),
          AdminRepository.getDeviceHealth()
        ]);
        if (!active) return;
        setReports(nextReports);
        setTriage(nextTriage);
        setDevices(nextDevices);
      } catch (error) {
        console.error("Admin notifications could not be loaded:", error);
      }
    };

    void load();
    const timer = window.setInterval(load, 60_000);
    const unsubscribe = SupportRepository.listenToAllTickets(setTickets);
    return () => {
      active = false;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const notifications = useMemo<AdminNotification[]>(() => {
    const items: AdminNotification[] = [];
    const issueGroups = new Map<string, AdminErrorReport>();

    reports.forEach(report => {
      const key = report.fingerprint || report.id;
      const current = issueGroups.get(key);
      if (!current || report.capturedAt > current.capturedAt) {
        issueGroups.set(key, report);
      }
    });

    issueGroups.forEach((report, fingerprint) => {
      const savedTriage = triage[fingerprint];
      const recurredAfterResolution =
        savedTriage?.status === "RESOLVED" &&
        savedTriage.updatedAt !== undefined &&
        report.capturedAt > savedTriage.updatedAt;
      if (savedTriage?.status === "ACKNOWLEDGED") return;
      if (savedTriage?.status === "RESOLVED" && !recurredAfterResolution) return;
      items.push({
        id: `issue:${fingerprint}`,
        title: report.tag || "Open issue",
        detail: report.message || "An app error needs review.",
        href: `/internal/issues?fingerprint=${encodeURIComponent(fingerprint)}`,
        timestamp: report.capturedAt || 0,
        type: "ISSUE"
      });
    });

    tickets.forEach(ticket => {
      if (!["OPEN", "IN_PROGRESS"].includes(ticket.status)) return;
      const latestParentReply = [...(ticket.replies || [])]
        .reverse()
        .find(reply => reply.authorRole === "PARENT");
      items.push({
        id: `support:${ticket.ticketId}`,
        title: ticket.subject || "Support message",
        detail: latestParentReply?.message || ticket.message || "A support ticket needs attention.",
        href: `/internal/support?ticket=${encodeURIComponent(ticket.ticketId)}`,
        timestamp: toMillis(latestParentReply?.createdAt || ticket.updatedAt || ticket.createdAt),
        type: "SUPPORT"
      });
    });

    const staleBefore = Date.now() - 30 * 60_000;
    devices.forEach(device => {
      const stale = !device.lastSeen || device.lastSeen < staleBefore;
      const syncFailure = device.syncHealthy === false;
      if (!syncFailure && !stale && device.online) return;
      const detail = syncFailure
        ? device.syncErrorMessage || "Device sync is unhealthy."
        : stale
          ? "Device has not reported for more than 30 minutes."
          : "Device is offline.";
      items.push({
        id: `device:${device.childId}`,
        title: `${device.childName} device warning`,
        detail,
        href: `/internal/devices?child=${encodeURIComponent(device.childId)}`,
        timestamp: device.lastSeen || 0,
        type: "DEVICE"
      });
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [devices, reports, tickets, triage]);

  const icon = (type: AdminNotification["type"]) => {
    if (type === "SUPPORT") return <MessageSquare size={16} className="text-sky-400" />;
    if (type === "DEVICE") return <Smartphone size={16} className="text-amber-400" />;
    return <AlertTriangle size={16} className="text-rose-400" />;
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Admin notifications: ${notifications.length}`}
        onClick={() => setOpen(value => !value)}
        className="relative rounded-xl border border-slate-800 bg-slate-800/50 p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <Bell size={20} />
        {notifications.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-3 right-3 top-[74px] z-50 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[390px]">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <p className="text-sm font-black text-white">Admin Notifications</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Issues, support and devices
              </p>
            </div>
            <span className="rounded-full bg-rose-500/10 px-2 py-1 text-xs font-black text-rose-400">
              {notifications.length} open
            </span>
          </div>

          <div className="max-h-[65vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell size={28} className="mx-auto mb-3 text-emerald-400" />
                <p className="text-sm font-bold text-white">Nothing needs attention</p>
                <p className="mt-1 text-xs text-slate-500">All monitored items are clear.</p>
              </div>
            ) : notifications.map(notification => (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={() => setOpen(false)}
                className="flex gap-3 border-b border-slate-800/80 px-4 py-3 transition-colors last:border-0 hover:bg-slate-800/70"
              >
                <span className="mt-0.5 rounded-lg bg-slate-950 p-2">{icon(notification.type)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="truncate text-xs font-black text-white">{notification.title}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {relativeTime(notification.timestamp)}
                    </span>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-400">
                    {notification.detail}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
