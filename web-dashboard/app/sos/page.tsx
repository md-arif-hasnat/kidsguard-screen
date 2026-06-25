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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-red-600 flex items-center gap-3">
            <AlertTriangle size={32} />
            SOS Alert Center
        </h1>
        {isFirebaseConfigured && (
            <span className="text-[10px] font-black text-red-400 bg-red-50 border border-red-100 px-3 py-1 rounded-full uppercase tracking-widest">Realtime Active</span>
        )}
      </div>

      {!isFirebaseConfigured && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 flex items-center gap-3">
          <CloudOff className="text-yellow-600" />
          <p className="text-yellow-700 font-medium text-sm">
            Firebase not configured. Using mock data.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        {displaySos.length > 0 ? displaySos.map((sos: any) => (
          <div key={sos.id} className={`bg-white rounded-2xl border-2 ${sos.resolved || sos.status === 'RESOLVED' ? 'border-slate-200' : 'border-red-500 animate-pulse'} p-5 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between shadow-sm gap-6`}>
            <div className="flex gap-4 md:gap-6 items-start md:items-center">
              <div className={`w-12 h-12 md:w-16 md:h-16 shrink-0 ${sos.resolved || sos.status === 'RESOLVED' ? 'bg-slate-100 text-slate-400' : 'bg-red-100 text-red-600'} rounded-full flex items-center justify-center`}>
                <AlertTriangle size={24} className="md:w-8 md:h-8" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 truncate">
                    {sos.childName || "Emergency Trigger"}
                </h3>
                <p className="text-xs md:text-sm text-slate-500 font-medium">
                    {typeof sos.timestamp === 'number' ? new Date(sos.timestamp).toLocaleString() : sos.time}
                </p>
                {(sos.location || (sos.latitude !== undefined && sos.latitude !== null)) && (
                  <div className="flex items-center gap-1 mt-2 text-primary-600 font-bold text-xs md:text-sm">
                    <MapPin size={14} />
                    <span className="truncate">{sos.location || `${sos.latitude?.toFixed(4)}, ${sos.longitude?.toFixed(4)}`}</span>
                  </div>
                )}
                {sos.message && <p className="mt-2 text-slate-700 text-sm">{sos.message}</p>}
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-none border-slate-50">
              <span className={`${sos.resolved || sos.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-4 py-1.5 rounded-full font-bold text-[10px] md:text-xs uppercase`}>
                {sos.resolved || sos.status === 'RESOLVED' ? 'Resolved' : 'Active'}
              </span>
              <button className="bg-slate-900 hover:bg-slate-800 text-white px-5 md:px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-colors whitespace-nowrap">View Incident</button>
            </div>
          </div>
        )) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-10 md:p-20 flex flex-col items-center text-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                    <AlertTriangle size={32} className="md:w-10 md:h-10" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">No SOS Alerts Found</h2>
                <p className="text-sm md:text-base text-slate-500 max-w-sm">Everything looks safe. No emergency signals have been received.</p>
            </div>
        )}
      </div>
    </DashboardLayout>
  );
}
