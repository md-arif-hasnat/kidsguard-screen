"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Bell,
  MapPin,
  AlertTriangle,
  Battery,
  Smartphone,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { observeAuth } from "@/lib/auth";
import {
  NotificationRepository,
  NotificationHistoryItem,
} from "@/lib/repositories/NotificationRepository";
import { clsx } from "clsx";
import Link from "next/link";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const [user, setUser] = useState<any>(null);

  const [notifications, setNotifications] = useState<
    NotificationHistoryItem[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [visibleCount, setVisibleCount] =
    useState(PAGE_SIZE);

  useEffect(() => {
    let unsubscribeNotifications: (() => void) | undefined;

    const unsubscribeAuth = observeAuth((authUser) => {
      console.log("PARENT_AUTH_UID =", authUser?.uid);

      setUser(authUser);

      if (unsubscribeNotifications) {
        unsubscribeNotifications();
        unsubscribeNotifications = undefined;
      }

      if (authUser) {
        unsubscribeNotifications =
          NotificationRepository.listenToNotifications(
            authUser.uid,
            (data) => {
              setNotifications(data);
              setLoading(false);
            }
          );
      } else {
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }

      unsubscribeAuth();
    };
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "SAFE_ZONE":
        return <MapPin className="text-emerald-500" />;

      case "SOS":
        return <AlertTriangle className="text-rose-500" />;

      case "BATTERY":
        return <Battery className="text-orange-500" />;

      case "DEVICE":
        return <Smartphone className="text-blue-500" />;

      case "PAIRING":
        return <ShieldCheck className="text-primary-500" />;

      case "APP_INSTALLED":
        return <Zap className="text-purple-500" />;

      case "APP_ACCESS_REQUEST":
        return <AlertTriangle className="text-orange-500" />;

      case "TAMPER_ALERT":
      case "LOCATION_PERMISSION_DISABLED":
      case "BACKGROUND_LOCATION_DISABLED":
        return <AlertTriangle className="text-rose-500" />;

      default:
        return <Bell className="text-slate-400" />;
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) {
      return;
    }

    await NotificationRepository.markAllAsRead(user.uid);
  };

  const handleMarkRead = async (id: string) => {
    if (!user) {
      return;
    }

    await NotificationRepository.markAsRead(
      user.uid,
      id
    );
  };

  function getNotificationTarget(
    notification: NotificationHistoryItem
  ) {
    const childId =
      notification.childId ||
      (notification as any).targetId ||
      (notification as any).data?.childId;

    const sosId =
      (notification as any).sosId ||
      (notification as any).alertId ||
      (notification as any).incidentId ||
      (notification as any).data?.sosId ||
      (notification as any).data?.alertId;

    const type = String(
      notification.type ||
        (notification as any).eventType ||
        (notification as any).data?.type ||
        ""
    ).toUpperCase();

    if (
      type.includes("SOS") &&
      childId &&
      sosId
    ) {
      return `/sos?childId=${encodeURIComponent(
        childId
      )}&sosId=${encodeURIComponent(sosId)}`;
    }

    if (
      type.includes("CHILD_PAIRED") &&
      childId
    ) {
      return `/dashboard/${encodeURIComponent(
        childId
      )}`;
    }

    if (
      type === "APP_INSTALLED" &&
      childId
    ) {
      const packageName =
        (notification as any).packageName ||
        (notification as any).data?.packageName ||
        "";

      return `/dashboard/${encodeURIComponent(
        childId
      )}?tab=installed-apps&pkg=${encodeURIComponent(
        packageName
      )}`;
    }

    if (
      type === "APP_ACCESS_REQUEST" &&
      childId
    ) {
      const packageName =
        (notification as any).packageName ||
        (notification as any).data?.packageName ||
        "";

      return `/dashboard/${encodeURIComponent(
        childId
      )}?tab=installed-apps&pkg=${encodeURIComponent(
        packageName
      )}`;
    }

    if (childId) {
      return `/dashboard/${encodeURIComponent(
        childId
      )}`;
    }

    return notification.clickAction || "/";
  }

  const getCreatedTime = (
    notification: NotificationHistoryItem
  ) => {
    const createdAt = notification.createdAt as any;

    if (!createdAt) {
      return "Just now";
    }

    if (
      typeof createdAt.seconds === "number"
    ) {
      return new Date(
        createdAt.seconds * 1000
      ).toLocaleTimeString();
    }

    if (
      typeof createdAt.toDate === "function"
    ) {
      return createdAt
        .toDate()
        .toLocaleTimeString();
    }

    const parsedDate = new Date(createdAt);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleTimeString();
    }

    return "Just now";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2
            className="animate-spin text-primary-600"
            size={48}
          />
        </div>
      </DashboardLayout>
    );
  }

  const visibleNotifications =
    notifications.slice(0, visibleCount);

  const hasMore =
    visibleCount < notifications.length;

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
            Safety Alerts
          </h1>

          <p className="mt-1 text-sm text-slate-500 md:text-base">
            Real-time notifications from your family
            network.
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          className="text-sm font-bold text-primary-600 hover:underline"
        >
          Mark all as read
        </button>
      </div>

      <div className="max-w-4xl space-y-4">
        {notifications.length > 0 ? (
          <>
            {visibleNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() =>
                  handleMarkRead(item.id)
                }
                className={clsx(
                  "group flex cursor-pointer items-start gap-4 rounded-2xl border bg-white p-4 transition-all hover:shadow-md md:p-5",
                  item.read
                    ? "border-slate-100 opacity-70"
                    : "border-primary-100 bg-primary-50/20 shadow-sm"
                )}
              >
                <div
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border md:h-12 md:w-12",
                    item.read
                      ? "border-slate-100 bg-slate-50"
                      : "border-primary-100 bg-white shadow-sm"
                  )}
                >
                  {getIcon(item.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <h3
                      className={clsx(
                        "truncate text-sm font-bold text-slate-900 md:text-base",
                        !item.read &&
                          "text-primary-900"
                      )}
                    >
                      {item.title}
                    </h3>

                    <span className="whitespace-nowrap text-[10px] font-bold uppercase text-slate-400">
                      {getCreatedTime(item)}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 md:text-sm">
                    {item.body}
                  </p>

                  <div className="mt-3 flex items-center gap-4">
                    <Link
                      href={getNotificationTarget(
                        item
                      )}
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary-600 hover:underline md:text-[11px]"
                    >
                      View Details
                      <ChevronRight size={12} />
                    </Link>

                    {!item.read && (
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary-500" />

                        <span className="text-[10px] font-bold uppercase text-primary-500">
                          New
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount(
                      (current) =>
                        current + PAGE_SIZE
                    )
                  }
                  className="rounded-xl border border-primary-200 bg-white px-6 py-3 text-sm font-bold text-primary-600 shadow-sm transition hover:bg-primary-50"
                >
                  Load More
                </button>

                <p className="mt-2 text-xs text-slate-400">
                  Showing{" "}
                  {Math.min(
                    visibleCount,
                    notifications.length
                  )}{" "}
                  of {notifications.length} alerts
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-slate-100 bg-white py-20 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
              <Bell
                size={40}
                className="text-slate-300"
              />
            </div>

            <h2 className="text-xl font-bold text-slate-800">
              No Notifications Yet
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-slate-500">
              You will receive alerts here when safety
              events occur across your devices.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}