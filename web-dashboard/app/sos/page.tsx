"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { AlertTriangle, MapPin, CloudOff, Loader2, ShieldAlert, Map as MapIcon, CheckCircle2 } from 'lucide-react';
import { MOCK_SOS } from '@/lib/mockData';
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SosRepository, SosEvent } from '@/lib/repositories/SosRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { useSearchParams } from 'next/navigation';

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
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [childLoading, setChildLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const targetEventId = searchParams.get('eventId');
  const queryChildId = searchParams.get('childId');
  const [childId, setChildId] = useState<string | null>(null);

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
  }, [family, queryChildId]);

  // Listen to ALL children SOS events in the family
  useEffect(() => {
    if (!isFirebaseConfigured || !family?.childDeviceIds || family.childDeviceIds.length === 0) {
        console.warn("WEB SosSync: Listener skipped (no children or firebase not configured)");
        return;
    }

    console.log(`WEB SosSync: Starting family listeners for children:`, family.childDeviceIds);

    // Canonical SOS Center logic: Listen to ALL family children's sosEvents sub-collections
    const unsubscribe = SosRepository.listenToFamilySosEvents(family.childDeviceIds, (events) => {
        console.log(`WEB SosSync: Received ${events.length} total SOS events from family.`);
        setSosEvents(events);

        // Auto-open target incident if eventId is in URL and events are loaded
        if (targetEventId && events.length > 0 && !selectedSos) {
            const target = events.find(e => e.id === targetEventId);
            if (target) {
                console.log("WEB SosSync: Auto-opening targeted incident:", targetEventId);
                setSelectedSos(target);
            }
        }
    });
    return () => unsubscribe();
  }, [family?.childDeviceIds, targetEventId, selectedSos]);

  // Handle deep link (auto-open modal)
  useEffect(() => {
    if (targetEventId && sosEvents.length > 0) {
      const target = sosEvents.find(e => e.id === targetEventId);
      if (target) {
        setSelectedSos(target);
      }
    }
  }, [targetEventId, sosEvents]);

  // Display data logic (merge with mocks if not configured)
  const displaySos = useMemo(() => {
    let list: SosEvent[] = isFirebaseConfigured ? [...sosEvents] : MOCK_SOS.map(m => ({
        id: m.id,
        childId: "child_001", // Default for mock
        timestamp: Date.now(),
        latitude: 51.5074,
        longitude: -0.1278,
        message: "Mock SOS",
        status: m.resolved ? "RESOLVED" : "ACTIVE",
        active: !m.resolved,
        batteryPercent: 85,
        address: m.location,
        childName: m.childName // For fallback display
    } as any));

    if (targetEventId) {
        list = [...list].sort((a, b) => {
            if (a.id === targetEventId) return -1;
            if (b.id === targetEventId) return 1;
            return 0;
        });
    }
    return list;
  }, [sosEvents, targetEventId]);

  // Fetch child names for all relevant children
  useEffect(() => {
    const loadChildNames = async () => {
      if (!isFirebaseConfigured || !db || displaySos.length === 0) return;

      const uniqueChildIds = Array.from(new Set(
        displaySos
          .map((sos) => sos.childId)
          .filter((id): id is string => Boolean(id))
      ));

      const missingIds = uniqueChildIds.filter((id) => !childNames[id]);
      if (missingIds.length === 0) return;

      try {
        setChildLoading(true);
        const entries = await Promise.all(
          missingIds.map(async (id) => {
            const snapshot = await getDoc(doc(db!, "children", id));
            if (!snapshot.exists()) return [id, "Unknown Child"] as const;
            const data = snapshot.data();
            const name = typeof data.name === "string" && data.name.trim() ? data.name : "Unknown Child";
            return [id, name] as const;
          })
        );

        setChildNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      } catch (error) {
        console.error("Failed to load SOS child names:", error);
      } finally {
        setChildLoading(false);
      }
    };

    loadChildNames();
  }, [displaySos, childNames]);

  const handleResolveSos = async (e: React.MouseEvent, sos: SosEvent) => {
    e.stopPropagation();
    if (!profile?.uid) return;

    if (!window.confirm("Are you sure you want to mark this SOS as resolved?")) {
      return;
    }

    try {
      setResolvingId(sos.id);
      await SosRepository.resolveSos(sos.childId, sos.id, profile.uid);
      if (selectedSos?.id === sos.id) {
        setSelectedSos(prev => prev ? { ...prev, status: "RESOLVED", active: false } : null);
      }
    } catch (error) {
      console.error("Failed to resolve SOS:", error);
      alert("Failed to resolve SOS. Please try again.");
    } finally {
      setResolvingId(null);
    }
  };

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={48} />
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
                <h3 className="text-lg font-bold text-slate-900">
                  {childNames[sos.childId] || sos.childName || "Loading child..."}
                </h3>
                <p className="mt-1 text-sm font-semibold text-red-600">
                  Emergency SOS Triggered
                </p>
                <p className="text-xs md:text-sm text-slate-500 font-medium">
                  {typeof sos.timestamp === 'number' ? new Date(sos.timestamp).toLocaleString() : sos.time}
                </p>
                {(sos.address || sos.location || (sos.latitude !== undefined && sos.latitude !== null)) && (
                  <div className="flex items-start gap-1 mt-2 text-primary-600 font-bold text-xs md:text-sm">
                    <MapPin size={14} className="mt-1 shrink-0" />
                    <div className="flex flex-col">
                        <span className="whitespace-pre-line">{sos.address || sos.location || `${sos.latitude?.toFixed(4)}, ${sos.longitude?.toFixed(4)}`}</span>
                        {(sos.locationAccuracy != null || sos.accuracy != null) && (
                            <span className="text-[10px] text-slate-400 font-medium">
                                ±{(sos.locationAccuracy ?? sos.accuracy).toFixed(0)}m accuracy • {sos.locationSource || 'Recently updated'}
                            </span>
                        )}
                    </div>
                  </div>
                )}
                {sos.message && (
                    <div className="mt-3 bg-red-50 border-l-4 border-red-500 p-3 rounded-r-xl shadow-sm">
                        <p className="text-slate-800 text-sm font-semibold leading-relaxed italic">&quot;{sos.message}&quot;</p>
                    </div>
                )}

                {sos.latitude && sos.longitude && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${sos.latitude},${sos.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-4 font-black uppercase tracking-widest text-xs text-white shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95"
                    >
                      <MapPin size={16} />
                      Google Maps
                    </a>
                    <a
                      href={`http://maps.apple.com/?q=${sos.latitude},${sos.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-4 font-black uppercase tracking-widest text-xs text-white shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                    >
                      <MapIcon size={16} />
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

              {!(sos.resolved || sos.status === 'RESOLVED') && (
                <button
                  type="button"
                  disabled={resolvingId === sos.id}
                  onClick={(e) => handleResolveSos(e, sos)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-5 md:px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-colors whitespace-nowrap"
                >
                  {resolvingId === sos.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Resolve SOS
                </button>
              )}

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
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedSos(null)}
        >
          <div
            className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl md:p-8 animate-in fade-in zoom-in duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedSos(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-600 hover:bg-slate-200 transition-colors"
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
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                    selectedSos.status === "RESOLVED"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {selectedSos.status === "RESOLVED" ? "RESOLVED" : "ACTIVE"}
                </span>
              </div>

              <h2 className="mt-2 text-2xl font-black text-slate-900">
                Emergency SOS
              </h2>

              <p className="mt-2 text-sm text-slate-600 font-medium">
                Triggered:{" "}
                <span className="font-bold text-slate-900">
                  {formatSosDate(selectedSos.createdAt ?? selectedSos.timestamp)}
                </span>
              </p>

              {(selectedSos.status === "RESOLVED" && selectedSos.resolvedAt) && (
                <p className="mt-1 text-sm text-slate-600 font-medium">
                  Resolved:{" "}
                  <span className="font-bold text-green-700">
                    {formatSosDate(selectedSos.resolvedAt)}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50/30">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Child Profile</p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  {childNames[selectedSos.childId] || (selectedSos as any).childName || "Loading..."}
                </p>
                <p className="mt-1 break-all text-[10px] font-medium text-slate-400">
                  UUID: {selectedSos.childId}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50/30">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Device Battery</p>
                <p className="mt-2 text-lg font-bold text-slate-900 flex items-center gap-2">
                  {selectedSos.batteryPercent != null ? `${selectedSos.batteryPercent}%` : "N/A"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50/30 md:col-span-2">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Physical Address</p>
                {selectedSos.address ? (
                  <>
                    <p className="mt-2 font-bold text-slate-900 whitespace-pre-line">{selectedSos.address}</p>
                    {selectedSos.country && <p className="text-xs text-slate-500 font-medium mt-1">{selectedSos.country}</p>}
                  </>
                ) : (
                  <p className="mt-2 font-bold text-slate-400 italic">Address details pending...</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50/30">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Precise Coordinates</p>
                <p className="mt-2 text-sm font-bold text-slate-900">
                  {selectedSos.latitude?.toFixed(6) ?? "—"}, {selectedSos.longitude?.toFixed(6) ?? "—"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50/30">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">GPS Accuracy</p>
                <p className="mt-2 text-sm font-bold text-slate-900">
                  {selectedSos.accuracy != null ? `±${selectedSos.accuracy} meters` : "Standard Accuracy"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50/30 md:col-span-2">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Emergency Message</p>
                <p className="mt-2 text-sm font-medium text-slate-700 leading-relaxed italic border-l-4 border-red-500 pl-4 py-1">
                  &quot;{selectedSos.message || "No custom message provided."}&quot;
                </p>
              </div>
            </div>

            {selectedSos.latitude != null && selectedSos.longitude != null && (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedSos.latitude},${selectedSos.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-4 font-black uppercase tracking-widest text-xs text-white shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95"
                >
                  <MapPin size={16} />
                  Google Maps
                </a>

                <a
                  href={`https://maps.apple.com/?ll=${selectedSos.latitude},${selectedSos.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-4 font-black uppercase tracking-widest text-xs text-white shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                >
                  <MapIcon size={16} />
                  Apple Maps
                </a>
              </div>
            )}

            {selectedSos.status === "ACTIVE" && (
              <button
                type="button"
                disabled={resolvingId === selectedSos.id}
                onClick={(e) => handleResolveSos(e, selectedSos)}
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 font-black uppercase tracking-widest text-xs text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {resolvingId === selectedSos.id ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Mark Incident as Resolved
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedSos(null)}
              className="mt-6 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-black uppercase tracking-widest text-xs text-slate-500 hover:bg-slate-50 transition-all"
            >
              Back to Center
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
