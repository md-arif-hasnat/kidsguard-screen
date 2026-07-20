"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ChildStatusCard from '@/components/ChildStatusCard';
import { MOCK_CHILDREN, MOCK_SOS, MOCK_ACTIVITY } from '@/lib/mockData';
import { AlertTriangle, Plus, CloudOff, Info, CheckCircle2, AlertCircle, Loader2, Smartphone, MapPin } from 'lucide-react';
import { isFirebaseConfigured, showMocks } from '@/lib/firebase';
import { observeAuth } from '@/lib/auth';
import { FamilyRepository, FamilyData } from '@/lib/repositories/FamilyRepository';
import { User } from 'firebase/auth';
import { SosRepository, SosEvent } from '@/lib/repositories/SosRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { ActivityRepository, ActivityEvent } from '@/lib/repositories/ActivityRepository';
import { useParentProfile, getDisplayName } from '@/lib/context/ParentProfileContext';
import { clsx } from 'clsx';
import ChildAvatar from '@/components/ChildAvatar';

import { ParentRepository } from '@/lib/repositories/ParentRepository';

export default function Home() {
  const { profile, family: profileFamily, loading: contextLoading } = useParentProfile();
  const [childrenStatus, setChildrenStatus] = useState<Record<string, ChildStatus>>({});
  const [childrenSos, setChildrenSos] = useState<Record<string, SosEvent[]>>({});
  const [childrenActivities, setChildrenActivities] = useState<Record<string, ActivityEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const [showPairingForm, setShowPairingForm] = useState(false);

  const router = useRouter();

  const family = profileFamily;

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    if (profile) {
        // If family is loaded OR profile exists but has no familyId yet (context will auto-provision)
        // OR context has finished all loading
        if (family || !contextLoading) {
            setLoading(false);
        }

        // Safety timeout to prevent infinite hang
        const timer = setTimeout(() => {
            setLoading(false);
        }, 8000);
        return () => clearTimeout(timer);
    } else if (!contextLoading) {
        if (isFirebaseConfigured) {
            router.push('/login');
        } else {
            setLoading(false);
        }
    }
  }, [profile, contextLoading, family, router]);

  // Listen to status and SOS for all children in family
  useEffect(() => {
    if (!family || !isFirebaseConfigured) return;

    const unsubStatus = family.childDeviceIds.map(id =>
      ChildRepository.listenToChildStatus(id, (status) => {
        if (status) setChildrenStatus(prev => ({ ...prev, [id]: status }));
      })
    );

    const unsubSos = family.childDeviceIds.map(id =>
      SosRepository.listenToSosEvents(id, (events) => {
        setChildrenSos(prev => ({ ...prev, [id]: events }));
      })
    );

    const unsubActivity = family.childDeviceIds.map(id =>
      ActivityRepository.listenToActivity(id, (events) => {
        setChildrenActivities(prev => ({ ...prev, [id]: events }));
      })
    );

    return () => {
      unsubStatus.forEach(unsub => unsub());
      unsubSos.forEach(unsub => unsub());
      unsubActivity.forEach(unsub => unsub());
    };
  }, [family]);

  // Handle SOS Geocoding
  useEffect(() => {
    if (showMocks || !isFirebaseConfigured) return;

    const eventsToGeocode = Object.values(childrenSos).flat()
        .filter(e => (e.status === "ACTIVE" || e.status === "TRIGGERED") && !e.address && e.latitude && e.longitude);

    eventsToGeocode.forEach(async (event) => {
        try {
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            if (!apiKey) return;

            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${event.latitude},${event.longitude}&key=${apiKey}`);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                const components = result.address_components;

                let street = '';
                let houseNumber = '';
                let city = '';
                let postalCode = '';
                let country = '';

                components.forEach((c: any) => {
                    if (c.types.includes('route')) street = c.long_name;
                    if (c.types.includes('street_number')) houseNumber = c.long_name;
                    if (c.types.includes('locality')) city = c.long_name;
                    if (c.types.includes('postal_code')) postalCode = c.long_name;
                    if (c.types.includes('country')) country = c.long_name;
                });

                const displayAddress = street
                    ? `${street}${houseNumber ? ' ' + houseNumber : ''}\n${postalCode}${city ? ' ' + city : ''}`
                    : result.formatted_address;

                await SosRepository.updateSosAddress(event.childId, event.id, {
                    address: displayAddress,
                    street,
                    houseNumber,
                    city,
                    postalCode,
                    country
                });
            }
        } catch (err) {
            console.error("SOS Geocoding failed:", err);
        }
    });
  }, [childrenSos]);

  const handlePairChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !pairingCode) return;

    setIsPairing(true);
    setPairingError(null);

    try {
      const parentName = profile?.displayName || "Parent";
      const success = await FamilyRepository.pairChild(family.familyId, pairingCode, parentName);
      if (success) {
        setPairingCode('');
        setShowPairingForm(false);
        // Family listener will update UI
      } else {
        setPairingError("Invalid or expired pairing code. Please generate a new code on the child's device.");
      }
    } catch (err: any) {
      setPairingError(err.message || "An error occurred during pairing.");
    } finally {
      setIsPairing(false);
    }
  };

  const activeSosEvents = showMocks
    ? MOCK_SOS.filter(s => !s.resolved).map(s => ({
        ...s,
        name: s.childName,
        childId: MOCK_CHILDREN[0].id // Link mock SOS to first mock child
      }))
    : Object.values(childrenSos).flat().filter(e => e.status === "ACTIVE" || e.status === "TRIGGERED").map(e => {
        let displayLocation = "Locating address...";
        if (e.address) {
            displayLocation = e.address;
        } else if (e.street) {
            displayLocation = `${e.street}${e.houseNumber ? ' ' + e.houseNumber : ''}\n${e.postalCode || ''}${e.city ? ' ' + e.city : ''}`;
        }

        return {
            ...e,
            name: childrenStatus[e.childId]?.childName || "Unknown Child",
            location: displayLocation
        };
      });

  //const isLive = isFirebaseConfigured && !!user && !!family;
  const isLive = isFirebaseConfigured && Boolean(profile) && Boolean(family);
  const noChildrenPaired = isLive && family && family.childDeviceIds.length === 0;


  const allActivities = showMocks
    ? MOCK_ACTIVITY
    : Object.values(childrenActivities).flat().sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  if (loading && isFirebaseConfigured) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="flex flex-col items-center gap-6">
                <img src="/loading-logo.png" alt="KidsGuard" className="h-24 w-auto animate-pulse" />
                <p className="font-black uppercase tracking-[0.3em] text-primary-500 animate-pulse">Syncing Family Vault...</p>
            </div>
        </div>
    );
  }

  return (
    <DashboardLayout>
      {showDebug && (
        <div className="bg-slate-900 text-slate-300 p-6 rounded-xl mb-8 font-mono text-xs overflow-auto border border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-primary-400 font-bold flex items-center gap-2">
                    <Info size={14} /> SYSTEM DIAGNOSTICS
                </h3>
                <button
                    onClick={() => setShowDebug(false)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-400 font-bold"
                >
                    CLOSE
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                <DebugRow label="Firebase Configured" value={isFirebaseConfigured ? "YES" : "NO"} color={isFirebaseConfigured ? "text-emerald-400" : "text-yellow-400"} />
                <DebugRow label="Auth User UID" value={profile?.uid || "Not Signed In"} />
                <DebugRow label="Parent Name" value={getDisplayName(profile)} />
                <DebugRow label="Family ID" value={family?.familyId || "None"} />
                <DebugRow label="Child Device Count" value={family?.childDeviceIds.length.toString() || "0"} />
                <DebugRow label="Stored Family ID" value={typeof window !== 'undefined' ? localStorage.getItem("kidsguard_family_id") || "None" : "N/A"} />
                <DebugRow label="Mock Mode Active" value={showMocks ? "YES" : "NO"} />
                <DebugRow label="Last Error" value={error || "None"} color={error ? "text-rose-400" : "text-slate-500"} />
            </div>
        </div>
      )}

      <header className="mb-8">
        <h1
          className="text-3xl font-bold text-slate-900 cursor-default select-none"
          onDoubleClick={() => setShowDebug(!showDebug)}
        >
          Family Overview
        </h1>
        <p className="text-slate-500 mt-1">
          {family
            ? `Monitoring ${family.childDeviceIds.length} ${family.childDeviceIds.length === 1 ? 'child' : 'children'}`
            : showMocks
            ? `Monitoring ${MOCK_CHILDREN.length} children (Mock)`
            : 'Searching for children...'}
        </p>
      </header>

      {(noChildrenPaired || showPairingForm) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mb-8 shadow-sm relative">
            {showPairingForm && !noChildrenPaired && (
              <button
                onClick={() => setShowPairingForm(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
              >
                Close
              </button>
            )}
            <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6 text-primary-600">
                <Smartphone size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {noChildrenPaired ? "No Child Connected Yet" : "Pair Another Child"}
            </h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
                {noChildrenPaired
                  ? "Your family vault is ready, but you haven't linked any devices."
                  : "Link another device to your family vault."}
                Open the KidsGuard app on your child&apos;s phone to get a pairing code.
            </p>

            <form onSubmit={handlePairChild} className="max-w-xs mx-auto space-y-4">
                <input
                    type="text"
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-digit code"
                    className="w-full text-center text-2xl font-black tracking-widest py-4 border-2 border-slate-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-50 outline-none uppercase"
                    maxLength={6}
                />
                {pairingError && <p className="text-rose-600 text-xs font-bold">{pairingError}</p>}
                <button
                    disabled={isPairing || pairingCode.length < 6}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isPairing && <Loader2 size={18} className="animate-spin" />}
                    Pair Device Now
                </button>
            </form>
        </div>
      )}

      {activeSosEvents.length > 0 && !noChildrenPaired && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 md:p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 animate-pulse shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-red-900 font-bold text-base md:text-lg uppercase tracking-tighter italic">Active SOS Alert</h2>
              <p className="text-red-700 font-bold text-sm md:text-base">
                {activeSosEvents[0].name} triggered an emergency SOS
              </p>
              <div className="flex items-start gap-1 mt-1 text-red-800 text-xs md:text-sm font-medium">
                 <MapPin size={14} className="mt-0.5 shrink-0" />
                 <span className="whitespace-pre-line">{activeSosEvents[0].location}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push(`/sos?childId=${activeSosEvents[0].childId}&eventId=${activeSosEvents[0].id}`)}
            className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-200 transition-all active:scale-95"
          >
            View Details
          </button>
        </div>
      )}

      {!noChildrenPaired && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {family ? (
            family.childDeviceIds.map((childId) => (
                <ChildStatusCard key={childId} childId={childId} />
            ))
            ) : showMocks ? (
            MOCK_CHILDREN.map((child) => (
                <ChildStatusCard key={child.id} child={child} />
            ))
            ) : null}

            <div
                onClick={() => setShowPairingForm(true)}
                className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-slate-400 transition-all cursor-pointer min-h-[160px] md:min-h-[200px]"
            >
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                <Plus size={24} />
            </div>
            <p className="font-bold">Add Another Child</p>
            <p className="text-sm">Pair a new Android device</p>
            </div>
        </div>
      )}

      {!noChildrenPaired && (
        <section className="mt-12">
            <h2 className="text-xl font-bold mb-6">Recent Alerts</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Child</th>
                            <th className="px-6 py-4">Event</th>
                            <th className="px-6 py-4">Location</th>
                            <th className="px-6 py-4">Time</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {allActivities.length > 0 ? allActivities.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 font-medium">
                                <div className="flex items-center gap-2">
                                <ChildAvatar
                                    name={childrenStatus[item.childId]?.childName}
                                    avatarId={childrenStatus[item.childId]?.avatarId}
                                    photoUrl={childrenStatus[item.childId]?.photoUrl}
                                    size="sm"
                                />
                                {childrenStatus[item.childId]?.childName || "Child"}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                <div className={clsx(
                                    "w-2 h-2 rounded-full",
                                    item.type === 'EXIT_ZONE' ? "bg-red-500" : "bg-emerald-500"
                                )} />
                                <span className="font-bold">{item.title}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-slate-600 font-medium">{item.zoneName || item.description || "System Alert"}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                {typeof item.timestamp === 'number' ? new Date(item.timestamp).toLocaleTimeString() : item.time}
                            </td>
                        </tr>
                        )) : (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No recent alerts recorded.</td>
                        </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile List */}
                <div className="md:hidden divide-y divide-slate-100">
                    {allActivities.length > 0 ? allActivities.map((item: any) => (
                        <div key={item.id} className="p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <ChildAvatar
                                        name={childrenStatus[item.childId]?.childName}
                                        avatarId={childrenStatus[item.childId]?.avatarId}
                                        photoUrl={childrenStatus[item.childId]?.photoUrl}
                                        size="sm"
                                    />
                                    <span className="text-sm font-bold text-slate-900">{childrenStatus[item.childId]?.childName || "Child"}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {typeof item.timestamp === 'number' ? new Date(item.timestamp).toLocaleTimeString() : item.time}
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className={clsx(
                                        "w-2 h-2 rounded-full",
                                        item.type === 'EXIT_ZONE' ? "bg-red-500" : "bg-emerald-500"
                                    )} />
                                    <span className="text-sm font-bold text-slate-800">{item.title}</span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-1 ml-4">
                                    {item.zoneName || item.description || "System Alert"}
                                </p>
                            </div>
                        </div>
                    )) : (
                        <div className="px-6 py-12 text-center text-slate-400 italic text-sm">No recent alerts recorded.</div>
                    )}
                </div>
            </div>
        </section>
      )}
    </DashboardLayout>
  );
}

function DebugRow({ label, value, color = "text-slate-300" }: { label: string, value: string, color?: string }) {
    return (
        <div className="flex justify-between border-b border-slate-800 pb-1">
            <span className="text-slate-500">{label}:</span>
            <span className={`font-bold ${color} truncate ml-2`}>{value}</span>
        </div>
    );
}
