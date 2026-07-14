"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { AlertTriangle, MapPin, CloudOff } from 'lucide-react';
import { MOCK_SOS } from '@/lib/mockData';
import { isFirebaseConfigured } from '@/lib/firebase';
import { SosRepository, SosEvent } from '@/lib/repositories/SosRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function SosPage() {
    return (
        <Suspense fallback={
            <DashboardLayout>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="animate-spin text-primary-600" size={48} />
                </div>
            </DashboardLayout>
        }>
            <SosPageContent />
        </Suspense>
    );
}

function formatSosDate(value: unknown): string {
if (!value) return "Not available";

let date: Date;

if (typeof value === "number") {
date = new Date(value);
} else if (value instanceof Date) {
date = value;
} else if (
typeof value === "object" &&
value !== null &&
"toDate" in value &&
typeof (value as { toDate: () => Date }).toDate === "function"
) {
date = (value as { toDate: () => Date }).toDate();
} else if (
typeof value === "object" &&
value !== null &&
"seconds" in value
) {
date = new Date(
Number((value as { seconds: number }).seconds) * 1000
);
} else {
return "Not available";
}

if (Number.isNaN(date.getTime())) {
return "Not available";
}

return new Intl.DateTimeFormat("en-GB", {
dateStyle: "medium",
timeStyle: "short",
}).format(date);
}

function SosPageContent() {
  const { profile, family, isChildAccessible, loading: profileLoading } = useParentProfile();
  const [sosEvents, setSosEvents] = useState<SosEvent[]>([]);
  const [selectedSos, setSelectedSos] = useState<SosEvent | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const targetEventId = searchParams.get('eventId');
  const queryChildId = searchParams.get('childId');

  useEffect(() => {
    if (queryChildId) {
        setChildId(queryChildId);
        return;
    }

    const savedChildId = localStorage.getItem("kidsguard_selected_child");
    setChildId(savedChildId);

    if (family && !savedChildId && (family.childDeviceIds ?? []).length > 0) {
        setChildId(family.childDeviceIds[0]);
    }
  }, [family]);

  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    // Multi-tenant Guard
    if (!profileLoading && !isChildAccessible(childId)) {
        console.warn(`SECURITY: Blocked access to SOS for child ${childId}`);
        setSosEvents([]);
        return;
    }

    const unsubscribe = SosRepository.listenToSosEvents(childId, setSosEvents);
    return () => unsubscribe();
  }, [childId, profileLoading, isChildAccessible]);

  const displaySos = React.useMemo(() => {
    let list = isFirebaseConfigured ? [...sosEvents] : [...MOCK_SOS];
    if (targetEventId) {
        list = list.sort((a, b) => {
            if (a.id === targetEventId) return -1;
            if (b.id === targetEventId) return 1;
            return 0;
        });
    }
    return list;
  }, [sosEvents, targetEventId, isFirebaseConfigured]);

  if (profileLoading) {
      return (
          <DashboardLayout>
              <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-primary-600" size={48} />
              </div>
          </DashboardLayout>
      );
  }

  if (isFirebaseConfigured && childId && !isChildAccessible(childId)) {
      return (
          <DashboardLayout>
              <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border-2 border-rose-100">
                      <ShieldAlert size={40} className="text-rose-500" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">Access Restricted</h2>
                  <p className="text-slate-500 max-w-md mx-auto mt-2 italic font-medium">
                      You do not have permission to view emergency signals for this device.
                  </p>
              </div>
          </DashboardLayout>
      );
  }

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
        {targetEventId && displaySos.length > 0 && !displaySos.find(s => s.id === targetEventId) && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm font-medium">
                The specific SOS incident (ID: {targetEventId}) was not found in recent records.
            </div>
        )}
        {displaySos.length > 0 ? displaySos.map((sos: any) => (
          <div key={sos.id} className={`bg-white rounded-2xl border-2 ${sos.id === targetEventId ? 'border-primary-500 shadow-lg scale-[1.02] z-10' : (sos.resolved || sos.status === 'RESOLVED' ? 'border-slate-200' : 'border-red-500 animate-pulse')} p-5 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between shadow-sm gap-6 transition-all`}>
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
                {(sos.address || sos.location || (sos.latitude !== undefined && sos.latitude !== null)) && (
                  <div className="flex items-start gap-1 mt-2 text-primary-600 font-bold text-xs md:text-sm">
                    <MapPin size={14} className="mt-1 shrink-0" />
                    <span className="whitespace-pre-line">{sos.address || sos.location || `${sos.latitude?.toFixed(4)}, ${sos.longitude?.toFixed(4)}`}</span>
                  </div>
                )}
                {sos.message && <p className="mt-2 text-slate-700 text-sm italic">&quot;{sos.message}&quot;</p>}

                {sos.latitude && sos.longitude && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <a
                      href={`https://www.google.com/maps/search/?api\u003d1\u0026query\u003d${sos.latitude},${sos.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                    >
                      <img src="https://www.google.com/s2/favicons?domain\u003dmaps.google.com" className="w-3 h-3" />
                      Google Maps
                    </a>
                    <a
                      href={`http://maps.apple.com/?q\u003d${sos.latitude},${sos.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                    >
                      <img src="https://www.google.com/s2/favicons?domain\u003dapple.com" className="w-3 h-3" />
                      Apple Maps
                    </a>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-4 lg:pt-0 border-t lg:border-none border-slate-50">
              <span className={`${sos.resolved || sos.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} px-4 py-1.5 rounded-full font-bold text-[10px] md:text-xs uppercase`}>
                {sos.resolved || sos.status === 'RESOLVED' ? 'Resolved' : 'Active'}
              </span>
              <button
              type="button"
              onClick={() => setSelectedSos(sos)}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 md:px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-colors whitespace-nowrap"
              >
              View Incident
              </button>
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
      {selectedSos && (
       <div
       className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4"
       onClick={() => setSelectedSos(null)}
       >
       <div
       className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl md:p-8"
       onClick={(event) => event.stopPropagation()}
       >
       <button
       type="button"
       onClick={() => setSelectedSos(null)}
       className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-600 hover:bg-slate-200"
       aria-label="Close incident details"
       >
       ×
       </button>

       <div className="pr-12">
       <div className="flex flex-wrap items-center gap-3">
       <p className="text-sm font-bold uppercase tracking-wide text-red-600">
       Emergency SOS Incident
       </p>

       <span
       className={`rounded-full px-3 py-1 text-xs font-bold ${
       selectedSos.status === "RESOLVED"
       ? "bg-green-100 text-green-700"
       : "bg-red-100 text-red-700"
       }`}
       >
       {selectedSos.status === "RESOLVED" ? "RESOLVED" : "ACTIVE"}
       </span>
       </div>

       <h2 className="mt-2 text-2xl font-bold text-slate-900">
       Emergency SOS
       </h2>

       <p className="mt-2 text-sm text-slate-600">
       Triggered:{" "}
       <span className="font-semibold text-slate-900">
       {formatSosDate(
       selectedSos.createdAt ?? selectedSos.timestamp
       )}
       </span>
       </p>

       {selectedSos.status === "RESOLVED" &&
       selectedSos.resolvedAt && (
       <p className="mt-1 text-sm text-slate-600">
       Resolved:{" "}
       <span className="font-semibold text-green-700">
       {formatSosDate(selectedSos.resolvedAt)}
       </span>
       </p>
       )}
       </div>

       <div className="mt-6 grid gap-4 md:grid-cols-2">
       <div className="rounded-2xl border border-slate-200 p-4">
       <p className="text-xs font-semibold uppercase text-slate-500">
       Child ID
       </p>
       <p className="mt-1 break-all font-semibold text-slate-900">
       {selectedSos.childId}
       </p>
       </div>

       <div className="rounded-2xl border border-slate-200 p-4">
       <p className="text-xs font-semibold uppercase text-slate-500">
       Battery
       </p>
       <p className="mt-1 font-semibold text-slate-900">
       {selectedSos.batteryPercent != null
       ? `${selectedSos.batteryPercent}%`
       : "Not available"}
       </p>
       </div>

       <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
       <p className="text-xs font-semibold uppercase text-slate-500">
       Address
       </p>

       <p className="mt-1 font-semibold text-slate-900">
       {[selectedSos.street, selectedSos.houseNumber]
       .filter(Boolean)
       .join(" ") || "Address unavailable"}
       </p>

       <p className="text-slate-600">
       {[selectedSos.postalCode, selectedSos.city]
       .filter(Boolean)
       .join(" ")}
       </p>

       {selectedSos.country && (
       <p className="text-slate-600">{selectedSos.country}</p>
       )}
       </div>

       <div className="rounded-2xl border border-slate-200 p-4">
       <p className="text-xs font-semibold uppercase text-slate-500">
       Coordinates
       </p>
       <p className="mt-1 text-sm font-semibold text-slate-900">
       {selectedSos.latitude ?? "—"}, {selectedSos.longitude ?? "—"}
       </p>
       </div>

       <div className="rounded-2xl border border-slate-200 p-4">
       <p className="text-xs font-semibold uppercase text-slate-500">
       GPS Accuracy
       </p>
       <p className="mt-1 font-semibold text-slate-900">
       {selectedSos.accuracy != null
       ? `${selectedSos.accuracy} m`
       : "Not available"}
       </p>
       </div>

       <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
       <p className="text-xs font-semibold uppercase text-slate-500">
       Message
       </p>
       <p className="mt-1 font-semibold text-slate-900">
       {selectedSos.message || "Emergency SOS Triggered"}
       </p>
       </div>
       </div>

       {selectedSos.latitude != null &&
       selectedSos.longitude != null && (
       <div className="mt-6 grid gap-3 sm:grid-cols-2">
       <a
       href={`https://www.google.com/maps/search/?api=1&query=${selectedSos.latitude},${selectedSos.longitude}`}
       target="_blank"
       rel="noopener noreferrer"
       className="flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
       >
       Open Google Maps
       </a>

       <a
       href={`https://maps.apple.com/?ll=${selectedSos.latitude},${selectedSos.longitude}`}
       target="_blank"
       rel="noopener noreferrer"
       className="flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"
       >
       Open Apple Maps
       </a>
       </div>
       )}

       <button
       type="button"
       onClick={() => setSelectedSos(null)}
       className="mt-4 w-full rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50"
       >
       Close
       </button>
       </div>
       </div>
      )}

    </DashboardLayout>
  );
}
