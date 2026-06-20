"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { MOCK_ACTIVITY } from '@/lib/mockData';
import { Activity as ActivityIcon, CloudOff } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ActivityRepository, ActivityEvent } from '@/lib/repositories/ActivityRepository';

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    const savedChildId = localStorage.getItem("kidsguard_selected_child") || "child_001";
    setChildId(savedChildId);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    const unsubscribe = ActivityRepository.listenToActivity(childId, setEvents);
    return () => unsubscribe();
  }, [childId]);

  const displayEvents = isFirebaseConfigured && events.length > 0 ? events : MOCK_ACTIVITY;

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8">Activity Feed</h1>

      {!isFirebaseConfigured && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 flex items-center gap-3">
          <CloudOff className="text-yellow-600" />
          <p className="text-yellow-700 font-medium text-sm">
            Firebase not configured. Using mock data.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <ActivityIcon size={20} className="text-primary-500" />
          <h2 className="font-bold">Recent Safety Events</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {displayEvents.map((item: any) => (
            <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <div>
                  <p className="font-bold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">
                    {typeof item.timestamp === 'number' ? new Date(item.timestamp).toLocaleString() : `${item.date} • ${item.time}`}
                  </p>
                  {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full uppercase">
                {item.type?.replace('_', ' ') || "INFO"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
