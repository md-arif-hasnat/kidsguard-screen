"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ChildStatusCard from '@/components/ChildStatusCard';
import { MOCK_CHILDREN, MOCK_SOS } from '@/lib/mockData';
import { AlertTriangle, Plus, CloudOff } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { signIn, observeAuth } from '@/lib/auth';
import { FamilyRepository, FamilyData } from '@/lib/repositories/FamilyRepository';
import { User } from 'firebase/auth';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribeAuth = observeAuth((user) => {
      setUser(user);
      if (!user) {
        signIn();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const familyId = localStorage.getItem("kidsguard_family_id") || "mock_family_123";

      const unsubscribeFamily = FamilyRepository.listenToFamily(familyId, (data) => {
        setFamily(data);
        setLoading(false);
      });

      return () => unsubscribeFamily();
    }
  }, [user]);

  const activeSos = MOCK_SOS.filter(s => !s.resolved);

  return (
    <DashboardLayout>
      {!isFirebaseConfigured && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 flex items-center gap-3">
          <CloudOff className="text-yellow-600" />
          <p className="text-yellow-700 font-medium text-sm">
            Firebase not configured. Using local mock data for preview.
          </p>
        </div>
      )}

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Family Overview</h1>
        <p className="text-slate-500 mt-1">
          {family ? `Monitoring ${family.childDeviceIds.length} devices` : `Monitoring ${MOCK_CHILDREN.length} devices (Mock)`}
        </p>
      </header>

      {activeSos.length > 0 && (
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {family ? (
          family.childDeviceIds.map((childId) => (
            <ChildStatusCard key={childId} childId={childId} />
          ))
        ) : (
          MOCK_CHILDREN.map((child) => (
            <ChildStatusCard key={child.id} child={child} />
          ))
        )}

        <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 hover:bg-slate-100 hover:border-slate-400 transition-all cursor-pointer min-h-[200px]">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-4">
            <Plus size={24} />
          </div>
          <p className="font-bold">Add Another Child</p>
          <p className="text-sm">Pair a new Android device</p>
        </div>
      </div>

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
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
