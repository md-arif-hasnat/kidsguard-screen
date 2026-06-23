"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { AlertTriangle, MapPin, CloudOff } from 'lucide-react';
import { MOCK_SOS } from '@/lib/mockData';
import { isFirebaseConfigured } from '@/lib/firebase';
import { SosRepository, SosEvent } from '@/lib/repositories/SosRepository';

export default function SosPage() {
  const [sosEvents, setSosEvents] = useState<SosEvent[]>([]);
  const [childId, setChildId] = useState<string | null>(null);

  useEffect(() => {
    const savedChildId = localStorage.getItem("kidsguard_selected_child") || "child_001";
    setChildId(savedChildId);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    const unsubscribe = SosRepository.listenToSosEvents(childId, setSosEvents);
    return () => unsubscribe();
  }, [childId]);

  const displaySos = isFirebaseConfigured ? sosEvents : MOCK_SOS;

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-red-600 flex items-center gap-3">
            <AlertTriangle size={32} />
            SOS Alert Center
        </h1>
        {isFirebaseConfigured && (
            <span className="text-xs font-bold text-red-400 bg-red-50 border border-red-100 px-3 py-1 rounded-full uppercase">Realtime Watchdog Active</span>
        )}
      </div>

      {!isFirebaseConfigured && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 flex items-center gap-3">
          <CloudOff className="text-yellow-600" />
          <p className="text-yellow-700 font-medium text-sm">
            Firebase not configured. Using mock data for demo.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {displaySos.length > 0 ? displaySos.map((sos: any) => (
          <div key={sos.id} className={`bg-white rounded-2xl border-2 ${sos.resolved || sos.status === 'RESOLVED' ? 'border-slate-200' : 'border-red-500 animate-pulse'} p-8 flex items-center justify-between shadow-sm`}>
            <div className="flex gap-6 items-center">
              <div className={`w-16 h-16 ${sos.resolved || sos.status === 'RESOLVED' ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-600'} rounded-full flex items-center justify-center`}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                    {sos.childName || "Emergency Trigger"}
                </h3>
                <p className="text-slate-500 font-medium">
                    {typeof sos.timestamp === 'number' ? new Date(sos.timestamp).toLocaleString() : sos.time}
                </p>
                {(sos.location || (sos.latitude !== undefined && sos.latitude !== null)) && (
                  <div className="flex items-center gap-1 mt-2 text-primary-600 font-bold">
                    <MapPin size={16} />
                    {sos.location || `${sos.latitude?.toFixed(4)}, ${sos.longitude?.toFixed(4)}`}
                  </div>
                )}
                {sos.message && <p className="mt-2 text-slate-700">{sos.message}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`${sos.resolved || sos.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-4 py-1.5 rounded-full font-bold text-sm uppercase`}>
                {sos.resolved || sos.status === 'RESOLVED' ? 'Resolved' : 'Active'}
              </span>
              <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold">View Incident Report</button>
            </div>
          </div>
        )) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-20 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                    <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">No SOS Alerts Found</h2>
                <p className="text-slate-500 max-w-md">Everything looks safe. No emergency signals have been received from the paired devices.</p>
            </div>
        )}
      </div>
    </DashboardLayout>
  );
}
