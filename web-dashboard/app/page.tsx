"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import ChildStatusCard from '@/components/ChildStatusCard';
import { MOCK_CHILDREN, MOCK_SOS } from '@/lib/mockData';
import { AlertTriangle, Plus, CloudOff, Info, CheckCircle2, AlertCircle, Loader2, Smartphone } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { observeAuth } from '@/lib/auth';
import { FamilyRepository, FamilyData } from '@/lib/repositories/FamilyRepository';
import { User } from 'firebase/auth';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = observeAuth((user) => {
      setUser(user);
      if (!user && isFirebaseConfigured) {
        router.push('/login');
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (user) {
      const familyId = localStorage.getItem("kidsguard_family_id");

      if (familyId) {
        const unsubscribeFamily = FamilyRepository.listenToFamily(familyId, (data) => {
          setFamily(data);
          setLoading(false);
        });
        return () => unsubscribeFamily();
      } else {
        setLoading(false);
      }
    }
  }, [user]);

  const handlePairChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !pairingCode) return;

    setIsPairing(true);
    setPairingError(null);

    try {
      const success = await FamilyRepository.pairChild(family.familyId, pairingCode);
      if (success) {
        setPairingCode('');
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

  const useMockData = !isFirebaseConfigured;
  const activeSos = useMockData ? MOCK_SOS.filter(s => !s.resolved) : []; // Future: Implement real multi-child SOS listener
  const isLive = isFirebaseConfigured && !!user && !!family;
  const noChildrenPaired = isLive && family && family.childDeviceIds.length === 0;

  if (loading && isFirebaseConfigured) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-primary-600" size={48} />
                <p className="font-bold">Syncing Family Vault...</p>
            </div>
        </div>
    );
  }

  return (
    <DashboardLayout>
      {isLive ? (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600" />
            <p className="text-emerald-700 font-medium text-sm">
              Firebase Live Mode: Connected as {user?.email}
            </p>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
        </div>
      ) : isFirebaseConfigured ? (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="text-blue-600" />
            <p className="text-blue-700 font-medium text-sm">
              Initial setup required. Please pair a child device.
            </p>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs font-bold text-blue-700 hover:underline"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
        </div>
      ) : (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CloudOff className="text-yellow-600" />
            <p className="text-yellow-700 font-medium text-sm">
              Firebase not configured. Using local mock data for preview.
            </p>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs font-bold text-yellow-700 hover:underline"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>
        </div>
      )}

      {showDebug && (
        <div className="bg-slate-900 text-slate-300 p-6 rounded-xl mb-8 font-mono text-xs overflow-auto border border-slate-700 shadow-2xl">
            <h3 className="text-primary-400 font-bold mb-4 flex items-center gap-2">
                <Info size={14} /> SYSTEM DIAGNOSTICS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                <DebugRow label="Firebase Configured" value={isFirebaseConfigured ? "YES" : "NO"} color={isFirebaseConfigured ? "text-emerald-400" : "text-yellow-400"} />
                <DebugRow label="Auth User UID" value={user?.uid || "Not Signed In"} />
                <DebugRow label="Family ID" value={family?.familyId || "None"} />
                <DebugRow label="Child Device Count" value={family?.childDeviceIds.length.toString() || "0"} />
                <DebugRow label="Mock Mode Active" value={useMockData ? "YES" : "NO"} />
                <DebugRow label="Last Error" value={error || "None"} color={error ? "text-rose-400" : "text-slate-500"} />
            </div>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Family Overview</h1>
        <p className="text-slate-500 mt-1">
          {family ? `Monitoring ${family.childDeviceIds.length} devices` : useMockData ? `Monitoring ${MOCK_CHILDREN.length} devices (Mock)` : 'Searching for devices...'}
        </p>
      </header>

      {noChildrenPaired && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center mb-8 shadow-sm">
            <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6 text-primary-600">
                <Smartphone size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No Child Connected Yet</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
                Your family vault is ready, but you haven&apos;t linked any devices.
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

      {activeSos.length > 0 && !noChildrenPaired && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 animate-pulse">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-red-900 font-bold text-lg">ACTIVE SOS ALERT</h2>
              <p className="text-red-700 font-medium">{activeSos[0].childName} triggered an SOS at {activeSos[0].location}</p>
            </div>
          </div>
          <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors">
            View Details
          </button>
        </div>
      )}

      {!noChildrenPaired && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {family ? (
            family.childDeviceIds.map((childId) => (
                <ChildStatusCard key={childId} childId={childId} />
            ))
            ) : useMockData ? (
            MOCK_CHILDREN.map((child) => (
                <ChildStatusCard key={child.id} child={child} />
            ))
            ) : null}

            <div
                onClick={() => setPairingCode('')} // In a real app this might open a modal
                className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-slate-400 transition-all cursor-pointer min-h-[200px]"
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
                {useMockData ? (
                  <>
                    <tr className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium">Sam</td>
                        <td className="px-6 py-4">Battery Low (15%)</td>
                        <td className="px-6 py-4">School</td>
                        <td className="px-6 py-4 text-slate-500">10:30 AM</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium">Alex</td>
                        <td className="px-6 py-4">Entered Home</td>
                        <td className="px-6 py-4">Home</td>
                        <td className="px-6 py-4 text-slate-500">09:12 AM</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No recent alerts recorded.</td>
                  </tr>
                )}
                </tbody>
            </table>
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
