"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  MessageSquare,
  Smartphone,
  Users
} from "lucide-react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useInternalAdmin } from "@/lib/context/InternalAdminContext";
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

type NotificationType = "ISSUE" | "SUPPORT" | "DEVICE" | "CUSTOMER";

type AdminNotification = {
  id: string;
  title: string;
  detail: string;
  href: string;
  timestamp: number;
  type: NotificationType;
};

type StoredAdminNotification = {
  id: string;
  title?: string;
  body?: string;
  clickAction?: string;
  type?: string;
  createdAt?: unknown;
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

function readStateId(notificationId: string): string {
  return encodeURIComponent(notificationId);
}

export default function AdminNotificationCenter() {
  const { admin } = useInternalAdmin();
  const [reports, setReports] = useState<AdminErrorReport[]>([]);
  const [triage, setTriage] = useState<Record<string, AdminIssueTriage>>({});
  const [devices, setDevices] = useState<AdminDeviceHealth[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [storedEvents, setStoredEvents] = useState<StoredAdminNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
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
    if (!db || !admin?.uid) return;
    const database = db;
    const readRef = collection(
      database,
      "users",
      admin.uid,
      "adminNotificationState"
    );
    return onSnapshot(readRef, snapshot => {
      setReadIds(new Set(snapshot.docs.map(document => document.data().notificationId)));
    });
  }, [admin?.uid]);

  useEffect(() => {
    if (!db) return;
    const eventsQuery = query(
      collection(db, "adminNotifications"),
      orderBy("createdAt", "desc"),
      limit(200)
    );
    return onSnapshot(eventsQuery, snapshot => {
      setStoredEvents(snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      })));
    }, error => {
      console.error("Stored admin notifications could not be loaded:", error);
    });
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
        id: `issue:${fingerprint}:${report.capturedAt || 0}`,
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
      const timestamp = toMillis(
        latestParentReply?.createdAt || ticket.updatedAt || ticket.createdAt
      );
      items.push({
        id: `support:${ticket.ticketId}:${timestamp}`,
        title: ticket.subject || "Support message",
        detail:
          latestParentReply?.message ||
          ticket.message ||
          "A support ticket needs attention.",
        href: `/internal/support?ticket=${encodeURIComponent(ticket.ticketId)}`,
        timestamp,
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
      const warningKind = syncFailure ? "sync" : "offline";
      items.push({
        id: `device:${device.childId}:${warningKind}:${device.lastSeen || 0}`,
        title: `${device.childName} device warning`,
        detail,
        href: `/internal/devices?child=${encodeURIComponent(device.childId)}`,
        timestamp: device.lastSeen || 0,
        type: "DEVICE"
      });
    });

    storedEvents.forEach(event => {
      if (event.type !== "ADMIN_SUBSCRIPTION") return;
      items.push({
        id: `event:${event.id}`,
        title: event.title || "Customer subscription update",
        detail: event.body || "A customer subscription changed.",
        href: event.clickAction || "/internal/customers",
        timestamp: toMillis(event.createdAt),
        type: "CUSTOMER"
      });
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [devices, reports, storedEvents, tickets, triage]);

  const unreadNotifications = useMemo(
    () => notifications.filter(notification => !readIds.has(notification.id)),
    [notifications, readIds]
  );

  useEffect(() => {
    const counts: Record<NotificationType, number> = {
      ISSUE: 0,
      SUPPORT: 0,
      DEVICE: 0,
      CUSTOMER: 0
    };
    unreadNotifications.forEach(notification => {
      counts[notification.type] += 1;
    });
    window.dispatchEvent(new CustomEvent("admin-notification-counts", {
      detail: counts
    }));
  }, [unreadNotifications]);

  const markRead = async (notification: AdminNotification) => {
    if (!db || !admin?.uid) return;
    setReadIds(current => new Set(current).add(notification.id));
    await setDoc(
      doc(
        db,
        "users",
        admin.uid,
        "adminNotificationState",
        readStateId(notification.id)
      ),
      {
        notificationId: notification.id,
        type: notification.type,
        readAt: serverTimestamp()
      },
      { merge: true }
    );
  };

  const markAllRead = async () => {
    if (!db || !admin?.uid || unreadNotifications.length === 0) return;
    const database = db;
    const adminUid = admin.uid;
    const batch = writeBatch(database);
    unreadNotifications.forEach(notification => {
      batch.set(
        doc(
          database,
          "users",
          adminUid,
          "adminNotificationState",
          readStateId(notification.id)
        ),
        {
          notificationId: notification.id,
          type: notification.type,
          readAt: serverTimestamp()
        },
        { merge: true }
      );
    });
    setReadIds(current => {
      const next = new Set(current);
      unreadNotifications.forEach(notification => next.add(notification.id));
      return next;
    });
    await batch.commit();
  };

  const icon = (type: NotificationType) => {
    if (type === "SUPPORT") return <MessageSquare size={16} className="text-sky-400" />;
    if (type === "DEVICE") return <Smartphone size={16} className="text-amber-400" />;
    if (type === "CUSTOMER") return <Users size={16} className="text-violet-400" />;
    return <AlertTriangle size={16} className="text-rose-400" />;
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Admin notifications: ${unreadNotifications.length}`}
        onClick={() => setOpen(value => !value)}
        className="relative rounded-xl border border-slate-800 bg-slate-800/50 p-2.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
      >
        <Bell size={20} />
        {unreadNotifications.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {unreadNotifications.length > 99 ? "99+" : unreadNotifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-3 right-3 top-[74px] z-50 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[390px]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <p className="text-sm font-black text-white">Admin Notifications</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Prioritized by unread section
              </p>
            </div>
            {unreadNotifications.length > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[65vh] overflow-y-auto">
            {unreadNotifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell size={28} className="mx-auto mb-3 text-emerald-400" />
                <p className="text-sm font-bold text-white">Nothing unread</p>
                <p className="mt-1 text-xs text-slate-500">New alerts will appear here.</p>
              </div>
            ) : unreadNotifications.map(notification => (
              <Link
                key={notification.id}
                href={notification.href}
                onClick={() => {
                  void markRead(notification);
                  setOpen(false);
                }}
                className="flex gap-3 border-b border-slate-800/80 px-4 py-3 transition-colors last:border-0 hover:bg-slate-800/70"
              >
                <span className="mt-0.5 rounded-lg bg-slate-950 p-2">
                  {icon(notification.type)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="truncate text-xs font-black text-white">
                      {notification.title}
                    </span>
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
