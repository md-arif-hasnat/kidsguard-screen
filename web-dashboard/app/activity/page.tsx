"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Activity as ActivityIcon, Loader2 } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ActivityRepository, ActivityEvent } from '@/lib/repositories/ActivityRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import FirebaseConfigurationError from '@/components/FirebaseConfigurationError';

export default function ActivityPage() {
  const { family, loading } = useParentProfile();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [childId, setChildId] = useState<string | null>(null);
  const childIdsKey = (family?.childDeviceIds ?? []).join("\u0000");

  useEffect(() => {
    if (loading) return;

    const childIds = childIdsKey ? childIdsKey.split("\u0000") : [];
    const savedChildId = localStorage.getItem("kidsguard_selected_child");
    setChildId(
      savedChildId && childIds.includes(savedChildId)
        ? savedChildId
        : childIds[0] ?? null
    );
  }, [childIdsKey, loading]);

  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    const unsubscribe = ActivityRepository.listenToActivity(childId, setEvents);
    return () => unsubscribe();
  }, [childId]);

  if (!isFirebaseConfigured) {
    return (
      <DashboardLayout>
        <FirebaseConfigurationError />
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Activity Feed</h1>
        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">Realtime Sync Active</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <ActivityIcon size={20} className="text-primary-500" />
          <h2 className="font-bold">Recent Safety Events</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {events.length > 0 ? events.map((item: ActivityEvent) => (
            <div key={item.id} className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 shrink-0" />
                <div>
                  <p className="font-bold text-slate-900 text-sm md:text-base">{item.title}</p>
                  <p className="text-xs md:text-sm text-slate-500">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                  {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                </div>
              </div>
              <span className="self-start sm:self-center text-[10px] font-black px-3 py-1 bg-slate-100 text-slate-600 rounded-full uppercase whitespace-nowrap">
                {item.type?.replace('_', ' ') || "INFO"}
              </span>
            </div>
          )) : (
            <div className="p-12 text-center text-slate-400 italic font-medium">
                {childId
                  ? 'No activity recorded yet for this device.'
                  : 'Connect or select a child device to view activity.'}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
