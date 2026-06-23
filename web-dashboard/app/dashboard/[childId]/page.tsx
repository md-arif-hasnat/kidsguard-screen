"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import LiveMap from '@/components/LiveMap';
import { MOCK_CHILDREN, MOCK_ACTIVITY, MOCK_SUMMARY, MOCK_SAFE_ZONES, MOCK_ROUTE_HISTORY, MOCK_DEVIATIONS } from '@/lib/mockData';
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
  RotateCcw,
  CloudOff,
  CheckCircle2,
  Info,
  Camera
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { LocationRepository, LocationPoint } from '@/lib/repositories/LocationRepository';
import { ActivityRepository, ActivityEvent } from '@/lib/repositories/ActivityRepository';
import { DailySummaryRepository, DailySummary } from '@/lib/repositories/DailySummaryRepository';
import { CommandRepository, CommandType } from '@/lib/repositories/CommandRepository';
import { SafeZoneRepository, SafeZone } from '@/lib/repositories/SafeZoneRepository';
import { DeviationRepository, RouteDeviation } from '@/lib/repositories/DeviationRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AvatarPicker from '@/components/AvatarPicker';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ChildDashboard() {
  const params = useParams();
  const childId = params.childId as string;

  const [status, setStatus] = useState<ChildStatus | null>(null);
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [deviations, setDeviations] = useState<RouteDeviation[]>([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    const unsubStatus = ChildRepository.listenToChildStatus(childId, setStatus);
    const unsubLocation = LocationRepository.listenToLatestLocation(childId, setLocation);
    const unsubActivity = ActivityRepository.listenToActivity(childId, setActivities);
    const unsubSummary = DailySummaryRepository.listenToLatestSummary(childId, setSummary);
    const unsubHistory = LocationRepository.listenToLocationHistory(childId, setRouteHistory);
    const unsubDeviations = DeviationRepository.listenToDeviations(childId, setDeviations);

    const familyId = localStorage.getItem("kidsguard_family_id") || "mock_family_123";
    const unsubZones = SafeZoneRepository.listenToSafeZones(familyId, setSafeZones);

    return () => {
      unsubStatus();
      unsubLocation();
      unsubActivity();
      unsubSummary();
      unsubHistory();
      unsubDeviations();
      unsubZones();
    };
  }, [childId]);

  const mockChild = MOCK_CHILDREN.find(c => c.id === childId) || MOCK_CHILDREN[0];

  const displayData = isFirebaseConfigured ? {
    name: status?.childName || "Loading...",
    battery: status?.batteryPercent || 0,
    isCharging: status?.charging || false,
    lastSeen: status?.lastSeen ? new Date(status.lastSeen).toLocaleTimeString() : "Updating...",
    currentZone: status?.currentZone || "Updating...",
    status: status?.kidGuardActive ? "LOCKED" : "UNLOCKED",
    lat: location?.latitude || 0,
    lng: location?.longitude || 0,
    accuracy: location?.accuracy || 20,
    activities: activities,
    summary: summary ? { score: summary.safetyScore, text: summary.summaryText } : null,
    avatarId: status?.avatarId,
    isLoading: status === null
  } : {
    ...mockChild,
    accuracy: 20,
    activities: MOCK_ACTIVITY,
    summary: MOCK_SUMMARY,
    avatarId: (mockChild as any).avatarId,
    isLoading: false
  };

  const handleCommand = async (type: CommandType) => {
    if (!isFirebaseConfigured) {
        alert("Firebase not configured. Commands disabled in mock mode.");
        return;
    }
    try {
        await CommandRepository.sendCommand(childId, type);
        alert(`Command ${type} sent!`);
    } catch (e) {
        alert("Failed to send command.");
    }
  };

  const handleAvatarSelect = async (newAvatarId: string) => {
    try {
      await ChildRepository.updateAvatar(childId, newAvatarId);
      setStatus(prev => prev ? { ...prev, avatarId: newAvatarId } : null);
      setShowAvatarPicker(false);
    } catch (err: any) {
      alert("Failed to update child avatar.");
    }
  };

  const displayZones = isFirebaseConfigured ? safeZones.map(z => ({
    id: z.id,
    name: z.name,
    lat: z.latitude,
    lng: z.longitude,
    radius: z.radiusMeters
  })) : MOCK_SAFE_ZONES;

  const displayRoute = isFirebaseConfigured ? routeHistory.map(p => ({
    lat: p.latitude,
    lng: p.longitude
  })) : MOCK_ROUTE_HISTORY;

  const displayDeviations = isFirebaseConfigured ? deviations.map(d => ({
    id: d.id,
    lat: d.latitude,
    lng: d.longitude,
    message: d.message,
    time: new Date(d.timestamp).toLocaleTimeString(),
    severity: d.severity
  })) : MOCK_DEVIATIONS;

  return (
    <DashboardLayout>
      {showAvatarPicker && (
        <AvatarPicker
          type="child"
          currentAvatarId={displayData.avatarId || "child_1"}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
      {isFirebaseConfigured ? (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-8 flex items-center gap-3">
          <CheckCircle2 className="text-emerald-600" />
          <p className="text-emerald-700 font-medium text-sm">
            Firebase Live Mode: Viewing real-time telemetry for {childId}.
          </p>
        </div>
      ) : (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 flex items-center gap-3">
          <CloudOff className="text-yellow-600" />
          <p className="text-yellow-700 font-medium text-sm">
            Firebase not configured. Using mock data for preview.
          </p>
        </div>
      )}

      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-2xl overflow-hidden border-2 border-primary-200 transition-transform group-hover:scale-105">
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${displayData.avatarId}`}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="absolute -bottom-1 -right-1 bg-primary-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white hover:bg-primary-700 transition-colors"
            >
              <Camera size={14} />
            </button>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{displayData.name}&apos;s Dashboard</h1>
            <p className="text-slate-500 font-medium">Child Device: {childId}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleCommand(CommandType.REFRESH_LOCATION)}
            className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <RotateCcw size={18} />
            Refresh GPS
          </button>
          <button
            onClick={() => handleCommand(status?.kidGuardActive ? CommandType.UNLOCK_NOW : CommandType.LOCK_NOW)}
            className={`${status?.kidGuardActive ? 'bg-green-600 shadow-green-100 hover:bg-green-700' : 'bg-red-600 shadow-red-100 hover:bg-red-700'} text-white px-5 py-2.5 rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2`}
          >
            {status?.kidGuardActive ? <Unlock size={18} /> : <Lock size={18} />}
            {status?.kidGuardActive ? 'Unlock' : 'Lock Now'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Battery Status</div>
          <div className="flex items-center gap-3">
            <Battery className={displayData.battery < 20 ? "text-red-500" : "text-primary-500"} size={24} />
            <span className="text-2xl font-bold">{displayData.battery}%</span>
            {displayData.isCharging && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Charging</span>}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Last Seen</div>
          <div className="flex items-center gap-3">
            <Zap className={status?.online ? "text-yellow-500" : "text-slate-400"} size={24} />
            <span className="text-2xl font-bold text-slate-700">{displayData.lastSeen}</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Current Zone</div>
          <div className="flex items-center gap-3">
            <MapPin className="text-green-500" size={24} />
            <span className="text-2xl font-bold text-slate-700 truncate">{displayData.currentZone}</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Security Mode</div>
          <div className="flex items-center gap-3">
            {displayData.status === 'LOCKED' ? <Lock className="text-red-500" size={24} /> : <Unlock className="text-green-500" size={24} />}
            <span className="text-2xl font-bold text-slate-700">{displayData.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[450px] relative">
            {displayData.isLoading ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 animate-pulse">
                    <p className="text-slate-400 font-bold italic">Establishing secure connection...</p>
                </div>
            ) : (
                <>
                <LiveMap
                    childLocation={{ lat: displayData.lat, lng: displayData.lng, accuracy: displayData.accuracy }}
                    avatarId={displayData.avatarId}
                    safeZones={displayZones}
                    routeHistory={displayRoute}
                    deviations={displayDeviations}
                    followChild={true}
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-slate-100 z-10">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Device Status</p>
                <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full animate-pulse", status?.online ? "bg-green-500" : "bg-red-500")} />
                    <p className="text-sm font-bold text-slate-700">{isFirebaseConfigured ? (status?.online ? 'Connected' : 'Offline') : 'Mock Online'}</p>
                </div>
                </div>
                </>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
             <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ShieldCheck className="text-primary-600" />
                Live Telemetry Panel
             </h2>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <TelemetryItem label="GPS Accuracy" value={`±${displayData.accuracy.toFixed(1)}m`} status={displayData.accuracy < 30 ? "healthy" : "warning"} />
                <TelemetryItem label="Move Speed" value={`${(location?.speed || 0).toFixed(1)} m/s`} status="healthy" />
                <TelemetryItem label="Sync Delay" value={status?.lastSeen ? `${Math.round((Date.now() - status.lastSeen) / 1000)}s` : "N/A"} status={status?.lastSeen && (Date.now() - status.lastSeen < 60000) ? "healthy" : "warning"} />
                <TelemetryItem label="App Version" value={status?.appVersion || "Unknown"} status="healthy" />
             </div>
          </section>

          <section className="bg-primary-600 rounded-2xl p-8 text-white shadow-xl shadow-primary-100">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={24} />
              <h2 className="text-xl font-bold">AI Daily Safety Summary</h2>
            </div>
            {displayData.summary ? (
              <div className="flex items-start gap-6">
                <div className="text-4xl font-black bg-white/20 w-24 h-24 rounded-2xl flex items-center justify-center backdrop-blur-md shrink-0">
                  {displayData.summary.score}
                </div>
                <div>
                  <p className="text-primary-100 font-medium leading-relaxed italic">
                    &quot;{displayData.summary.text}&quot;
                  </p>
                  <button className="mt-4 text-sm font-bold flex items-center gap-1 hover:text-primary-200 transition-colors">
                    View Full Report
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                  <p className="text-primary-100 italic">No safety summary generated for today yet. Data is analyzed every evening.</p>
              </div>
            )}
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
              {displayData.activities.length > 0 ? displayData.activities.map((item: any) => (
                <div key={item.id} className="flex gap-4 items-start">
                  <div className="w-1 bg-slate-100 self-stretch rounded-full mt-2 ml-2" />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400">
                        {typeof item.timestamp === 'number' ? new Date(item.timestamp).toLocaleTimeString() : item.time}
                    </p>
                    <p className="font-bold text-slate-700">{item.title}</p>
                    {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                  </div>
                </div>
              )) : (
                <p className="text-center py-8 text-slate-400 italic text-sm">No activity recorded today.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <History className="text-primary-500" size={20} />
              <h2 className="font-bold">Remote Controls</h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
               <ControlBtn icon={Lock} label="Force Lock" onClick={() => handleCommand(CommandType.LOCK_NOW)} color="text-red-600" />
               <ControlBtn icon={Unlock} label="Force Unlock" onClick={() => handleCommand(CommandType.UNLOCK_NOW)} color="text-green-600" />
               <ControlBtn icon={Play} label="Start Tracking" onClick={() => handleCommand(CommandType.START_TRACKING)} color="text-primary-600" />
               <ControlBtn icon={RotateCcw} label="Stop Tracking" onClick={() => handleCommand(CommandType.STOP_TRACKING)} color="text-slate-600" />
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ControlBtn({ icon: Icon, label, onClick, color }: any) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 p-3 w-full bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors"
        >
            <Icon size={18} className={color} />
            <span className="text-sm font-bold text-slate-700">{label}</span>
        </button>
    )
}

function TelemetryItem({ label, value, status }: { label: string, value: string, status: 'healthy' | 'warning' | 'offline' }) {
    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
            <div className="flex items-center gap-2">
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    status === 'healthy' ? "bg-green-500" : status === 'warning' ? "bg-orange-500" : "bg-red-500"
                )} />
                <span className="text-sm font-black text-slate-700">{value}</span>
            </div>
        </div>
    )
}
