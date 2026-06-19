"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { MOCK_CHILDREN, MOCK_ACTIVITY, MOCK_SUMMARY } from '@/lib/mockData';
import {
  Battery,
  MapPin,
  Lock,
  Unlock,
  ShieldCheck,
  Activity,
  ChevronRight,
  History,
  Zap,
  Play,
  RotateCcw
} from 'lucide-react';

export default function ChildDashboard() {
  const params = useParams();
  const childId = params.childId as string;
  const child = MOCK_CHILDREN.find(c => c.id === childId) || MOCK_CHILDREN[0];

  return (
    <DashboardLayout>
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{child.name}&apos;s Dashboard</h1>
          <p className="text-slate-500 font-medium">Child Device: {child.id}</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
            <RotateCcw size={18} />
            Refresh GPS
          </button>
          <button className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-red-100 hover:bg-red-700 transition-colors flex items-center gap-2">
            <Lock size={18} />
            Lock Now
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Battery Status</div>
          <div className="flex items-center gap-3">
            <Battery className="text-primary-500" size={24} />
            <span className="text-2xl font-bold">{child.battery}%</span>
            {child.isCharging && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Charging</span>}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Last Seen</div>
          <div className="flex items-center gap-3">
            <Zap className="text-yellow-500" size={24} />
            <span className="text-2xl font-bold text-slate-700">{child.lastSeen}</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Current Zone</div>
          <div className="flex items-center gap-3">
            <MapPin className="text-green-500" size={24} />
            <span className="text-2xl font-bold text-slate-700">{child.currentZone}</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Security Mode</div>
          <div className="flex items-center gap-3">
            {child.status === 'LOCKED' ? <Lock className="text-red-500" size={24} /> : <Unlock className="text-green-500" size={24} />}
            <span className="text-2xl font-bold text-slate-700">{child.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[400px] flex items-center justify-center bg-slate-100 relative">
            <div className="text-center">
              <MapPin className="text-primary-500 w-12 h-12 mx-auto mb-4" />
              <p className="font-bold text-slate-500 tracking-tight text-lg">Google Maps Integration Placeholder</p>
              <p className="text-slate-400 text-sm">Lat: {child.lat}, Lng: {child.lng}</p>
            </div>
            <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md border border-slate-100">
               <p className="text-xs font-bold text-slate-400 uppercase">Live Telemetry</p>
               <p className="text-sm font-bold text-slate-700">Moving • 4 km/h</p>
            </div>
          </section>

          <section className="bg-primary-600 rounded-2xl p-8 text-white shadow-xl shadow-primary-100">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={24} />
              <h2 className="text-xl font-bold">AI Daily Safety Summary</h2>
            </div>
            <div className="flex items-start gap-6">
              <div className="text-4xl font-black bg-white/20 w-24 h-24 rounded-2xl flex items-center justify-center backdrop-blur-md">
                {MOCK_SUMMARY.score}
              </div>
              <div>
                <p className="text-primary-100 font-medium leading-relaxed italic">
                  &quot;{MOCK_SUMMARY.text}&quot;
                </p>
                <button className="mt-4 text-sm font-bold flex items-center gap-1 hover:text-primary-200 transition-colors">
                  View Full Report
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="text-primary-500" size={20} />
                <h2 className="font-bold">Activity Feed</h2>
              </div>
              <button className="text-xs font-bold text-primary-600">View All</button>
            </div>
            <div className="space-y-6">
              {MOCK_ACTIVITY.map((item) => (
                <div key={item.id} className="flex gap-4 items-start">
                  <div className="w-1 bg-slate-100 self-stretch rounded-full mt-2 ml-2" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400">{item.time}</p>
                    <p className="font-bold text-slate-700">{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <History className="text-primary-500" size={20} />
              <h2 className="font-bold">Recent Routes</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-700">Home → School</p>
                  <p className="text-xs text-slate-500">12 mins • 3.2 km</p>
                </div>
                <button className="p-2 bg-white rounded-lg shadow-sm">
                  <Play size={16} className="text-primary-600" />
                </button>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between opacity-60">
                <div>
                  <p className="text-sm font-bold text-slate-700">School → Home</p>
                  <p className="text-xs text-slate-500">Yesterday • 14 mins</p>
                </div>
                <button className="p-2 bg-white rounded-lg shadow-sm">
                  <Play size={16} className="text-primary-600" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
