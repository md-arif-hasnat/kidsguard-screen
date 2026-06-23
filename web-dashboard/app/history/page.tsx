"use client";

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LiveMap from '@/components/LiveMap';
import { History as HistoryIcon, Calendar, Search, Play, CloudOff } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { MOCK_CHILDREN, MOCK_ROUTE_HISTORY, MOCK_SAFE_ZONES } from '@/lib/mockData';
import { LocationRepository, LocationPoint } from '@/lib/repositories/LocationRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { clsx } from 'clsx';

export default function HistoryPage() {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const savedChildId = localStorage.getItem("kidsguard_selected_child") || (MOCK_CHILDREN.length > 0 ? MOCK_CHILDREN[0].id : null);
    setSelectedChildId(savedChildId);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !selectedChildId) return;

    const unsubStatus = ChildRepository.listenToChildStatus(selectedChildId, setChildStatus);
    // In a full implementation, we would filter history by date.
    // For now, we listen to the generic history.
    const unsubHistory = LocationRepository.listenToLocationHistory(selectedChildId, setRouteHistory);
    return () => {
      unsubStatus();
      unsubHistory();
    };
  }, [selectedChildId, date]);

  const displayRoute = isFirebaseConfigured ? routeHistory.map(p => ({
    lat: p.latitude,
    lng: p.longitude
  })) : MOCK_ROUTE_HISTORY;

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Route History</h1>
        <div className="flex gap-3">
          {!isFirebaseConfigured && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 flex items-center gap-2">
              <CloudOff size={16} className="text-yellow-600" />
              <span className="text-yellow-700 text-xs font-bold uppercase">Mock Mode</span>
            </div>
          )}
          {isFirebaseConfigured && (
            <span className="text-xs font-bold text-slate-400 bg-slate-100 flex items-center px-3 rounded-lg uppercase">Cloud Archival Active</span>
          )}
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button className="bg-primary-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-primary-700 transition-colors">
            <Search size={18} />
            Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-220px)]">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
            <LiveMap
                childLocation={null}
                avatarId={childStatus?.avatarId}
                safeZones={isFirebaseConfigured ? [] : MOCK_SAFE_ZONES}
                routeHistory={displayRoute}
                deviations={[]}
                followChild={false}
            />
            {displayRoute.length > 0 && (
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-lg shadow-md border border-slate-100 flex items-center gap-2">
                    <Play size={16} className="text-primary-600" />
                    <span className="text-sm font-bold text-slate-700">Replaying {displayRoute.length} points</span>
                </div>
            )}
            {displayRoute.length === 0 && isFirebaseConfigured && (
                <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-slate-400 font-medium italic">
                    No route history found for this date.
                </div>
            )}
        </div>

        <div className="space-y-6 overflow-y-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Route Summary</h3>
                <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Total Distance</span>
                        <span className="font-bold">{isFirebaseConfigured ? "--" : "3.2 km"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Active Duration</span>
                        <span className="font-bold">{isFirebaseConfigured ? "--" : "42 mins"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Avg. Speed</span>
                        <span className="font-bold">{isFirebaseConfigured ? "--" : "4.5 km/h"}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-4">Known Routes</h3>
                <div className="space-y-2">
                    {isFirebaseConfigured ? (
                        <p className="text-xs text-slate-400 italic">Analysis pending...</p>
                    ) : (
                        ["Home → School", "School → Playground"].map((route) => (
                            <div key={route} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between group hover:border-primary-200 transition-colors cursor-pointer">
                                <span className="text-xs font-bold text-slate-700">{route}</span>
                                <Play size={12} className="text-slate-400 group-hover:text-primary-500" />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
