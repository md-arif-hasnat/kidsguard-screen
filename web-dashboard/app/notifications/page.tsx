"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Bell,
  MapPin,
  AlertTriangle,
  Battery,
  Smartphone,
  CheckCircle2,
  Loader2,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Zap,
  CloudOff
} from 'lucide-react';
import { observeAuth } from '@/lib/auth';
import { NotificationRepository, NotificationHistoryItem } from '@/lib/repositories/NotificationRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { clsx } from 'clsx';
import Link from 'next/link';

export default function NotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>([]);
  const [childrenStatus, setChildrenStatus] = useState<Record<string, ChildStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = observeAuth((authUser) => {
      setUser(authUser);
      if (authUser) {
        const unsubNotifs = NotificationRepository.listenToNotifications(authUser.uid, (data) => {
          setNotifications(data);
          setLoading(false);
        });
        return () => unsubNotifs();
      } else {
          setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'SAFE_ZONE': return <MapPin className="text-emerald-500" />;
      case 'SOS': return <AlertTriangle className="text-rose-500" />;
      case 'BATTERY': return <Battery className="text-orange-500" />;
      case 'DEVICE': return <Smartphone className="text-blue-500" />;
      case 'PAIRING': return <ShieldCheck className="text-primary-500" />;
      default: return <Bell className="text-slate-400" />;
    }
  };

  const handleMarkAllRead = async () => {
    if (user) {
      await NotificationRepository.markAllAsRead(user.uid);
    }
  };

  const handleMarkRead = async (id: string) => {
    if (user) {
        await NotificationRepository.markAsRead(user.uid, id);
    }
  };

  function getNotificationTarget(notification: NotificationHistoryItem) {
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
      return `/sos?childId=${encodeURIComponent(childId)}&sosId=${encodeURIComponent(sosId)}`;
    }

    if (
      type.includes("CHILD_PAIRED") &&
      childId
    ) {
      return `/dashboard/${encodeURIComponent(childId)}`;
    }

    if (childId) {
      // Standard fallback for any child-related notification
      return `/dashboard/${encodeURIComponent(childId)}`;
    }

    // Default fallbacks
    return notification.clickAction || "/";
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Safety Alerts</h1>
          <p className="text-slate-500 text-sm md:text-base mt-1">Real-time notifications from your family network.</p>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="text-sm font-bold text-primary-600 hover:underline"
        >
          Mark all as read
        </button>
      </div>

      <div className="max-w-4xl space-y-4">
        {notifications.length > 0 ? notifications.map((item) => (
          <div
            key={item.id}
            onClick={() => handleMarkRead(item.id)}
            className={clsx(
                "group bg-white p-4 md:p-5 rounded-2xl border transition-all hover:shadow-md cursor-pointer flex items-start gap-4",
                item.read ? "border-slate-100 opacity-70" : "border-primary-100 bg-primary-50/20 shadow-sm"
            )}
          >
            <div className={clsx(
                "w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 border",
                item.read ? "bg-slate-50 border-slate-100" : "bg-white border-primary-100 shadow-sm"
            )}>
              {getIcon(item.type)}
            </div>

            <div className="flex-1 min-w-0">
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                  <h3 className={clsx("font-bold text-slate-900 truncate text-sm md:text-base", !item.read && "text-primary-900")}>
                    {item.title}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">
                    {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString() : 'Just now'}
                  </span>
               </div>
               <p className="text-xs md:text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">{item.body}</p>

               <div className="mt-3 flex items-center gap-4">
                    <Link
                        href={getNotificationTarget(item)}
                        className="text-[10px] md:text-[11px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                        View Details
                        <ChevronRight size={12} />
                    </Link>
                    {!item.read && (
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                            <span className="text-[10px] font-bold text-primary-500 uppercase">New</span>
                        </div>
                    )}
               </div>
            </div>
          </div>
        )) : (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell size={40} className="text-slate-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">No Notifications Yet</h2>
            <p className="text-slate-500 max-w-sm mx-auto mt-2">You will receive alerts here when safety events occur across your devices.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
