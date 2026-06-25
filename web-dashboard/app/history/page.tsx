"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import LiveMap from '@/components/LiveMap';
import {
    History as HistoryIcon,
    Calendar,
    Search,
    Play,
    Pause,
    RotateCcw,
    CloudOff,
    MapPin,
    Clock,
    FastForward,
    Users,
    ChevronDown,
    AlertCircle,
    Activity as ActivityIcon,
    ArrowRight,
    Loader2
} from 'lucide-react';
import { isFirebaseConfigured, showMocks } from '@/lib/firebase';
import { MOCK_CHILDREN, MOCK_ROUTE_HISTORY, MOCK_SAFE_ZONES } from '@/lib/mockData';
import { LocationRepository, LocationPoint, RouteSummary } from '@/lib/repositories/LocationRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { ParentRepository, ParentProfile } from '@/lib/repositories/ParentRepository';
import { FamilyRepository, FamilyData } from '@/lib/repositories/FamilyRepository';
import { ActivityRepository, ActivityEvent } from '@/lib/repositories/ActivityRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { observeAuth } from '@/lib/auth';
import { calculateDistance, formatDuration } from '@/lib/utils/GeofenceUtils';
import { clsx } from 'clsx';

export default function HistoryPage() {
  const { profile, loading: profileLoading } = useParentProfile();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childrenStatus, setChildrenStatus] = useState<Record<string, ChildStatus>>({});

  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  // Replay State
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedChildId = localStorage.getItem("kidsguard_selected_child");
    if (savedChildId) setSelectedChildId(savedChildId);

    if (profile) {
        if (profile.familyId) {
            FamilyRepository.listenToFamily(profile.familyId, (data) => {
                if (data) {
                    setFamily(data);
                    if (!selectedChildId && data.childDeviceIds.length > 0) {
                        setSelectedChildId(data.childDeviceIds[0]);
                    }
                }
            });
        }
    } else if (!profileLoading) {
        setLoading(false);
    }
  }, [profile, profileLoading]);

  // Listen to status of all children for names
  useEffect(() => {
    if (!family) return;
    const unsubscribes = family.childDeviceIds.map(id =>
        ChildRepository.listenToChildStatus(id, (s) => {
            if (s) setChildrenStatus(prev => ({ ...prev, [id]: s }));
        })
    );
    return () => unsubscribes.forEach(u => u());
  }, [family]);

  // Load History Data
  useEffect(() => {
    if (!selectedChildId || !date) {
        setLoading(false);
        return;
    }

    setLoading(true);
    setIsReplaying(false);
    setReplayIndex(0);

    const unsubStatus = ChildRepository.listenToChildStatus(selectedChildId, setChildStatus);
    const unsubHistory = LocationRepository.listenToLocationHistoryByDate(selectedChildId, date, (history) => {
        setRouteHistory(history);
        setLoading(false);
    });
    const unsubActivity = ActivityRepository.listenToActivity(selectedChildId, setActivities);

    return () => {
      unsubStatus();
      unsubHistory();
      unsubActivity();
    };
  }, [selectedChildId, date]);

  // Route Summary Logic (Client-side implementation)
  const summary = useMemo(() => {
    if (routeHistory.length < 2) return null;

    let totalDist = 0;
    let maxSpeed = 0;
    for (let i = 1; i < routeHistory.length; i++) {
        totalDist += calculateDistance(
            routeHistory[i-1].latitude, routeHistory[i-1].longitude,
            routeHistory[i].latitude, routeHistory[i].longitude
        );
        if (routeHistory[i].speed > maxSpeed) maxSpeed = routeHistory[i].speed;
    }

    const start = routeHistory[0].timestamp;
    const end = routeHistory[routeHistory.length - 1].timestamp;
    const duration = (end - start) / 60000;

    return {
        totalDistanceMeters: totalDist,
        totalDurationMinutes: duration,
        maxSpeedKmh: maxSpeed * 3.6,
        startTime: start,
        endTime: end,
        stopsCount: 0, // Simplified for now
        safeZoneVisits: activities.filter(a => a.type === 'ENTER_ZONE').length
    };
  }, [routeHistory, activities]);

  // Timeline Events
  const timelineEvents = useMemo(() => {
    const events = activities
        .filter(a => {
            const aDate = new Date(a.timestamp).toISOString().split('T')[0];
            return aDate === date;
        })
        .map(a => ({
            id: a.id,
            time: new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: a.title,
            type: a.type,
            timestamp: a.timestamp,
            description: a.description
        }));

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, [activities, date]);

  // Replay Timer
  useEffect(() => {
    if (isReplaying && routeHistory.length > 0) {
        replayTimerRef.current = setInterval(() => {
            setReplayIndex(prev => {
                if (prev >= routeHistory.length - 1) {
                    setIsReplaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 1000 / replaySpeed);
    } else {
        if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    }
    return () => { if (replayTimerRef.current) clearInterval(replayTimerRef.current); };
  }, [isReplaying, replaySpeed, routeHistory.length]);

  const displayRoute = routeHistory.map(p => ({
    lat: p.latitude,
    lng: p.longitude,
    timestamp: p.timestamp
  }));

  const replayPoint = routeHistory[replayIndex] ? {
      lat: routeHistory[replayIndex].latitude,
      lng: routeHistory[replayIndex].longitude
  } : null;

  const selectedChildName = selectedChildId ? (childrenStatus[selectedChildId]?.childName || "Child") : "Select a child";

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Route History</h1>
          <p className="text-slate-500 mt-1">Review activity and historical movements.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Child Selector */}
          <div className="relative group">
                <button className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[10px] text-primary-600">
                        {selectedChildName[0]}
                    </div>
                    <span>{selectedChildName}</span>
                    <ChevronDown size={16} className="text-slate-400" />
                </button>
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                    {family?.childDeviceIds.map(id => (
                        <button
                            key={id}
                            onClick={() => {
                                setSelectedChildId(id);
                                localStorage.setItem("kidsguard_selected_child", id);
                            }}
                            className={clsx(
                                "w-full text-left px-4 py-3 text-sm font-bold transition-colors",
                                selectedChildId === id ? "bg-primary-50 text-primary-600" : "text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            {childrenStatus[id]?.childName || "Child"}
                        </button>
                    ))}
                </div>
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </div>
        </div>
      </div>

      {!selectedChildId ? (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                  <Users size={40} className="text-primary-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Please select your child first.</h2>
              <p className="text-slate-500 max-w-sm mx-auto mt-2">Use the dropdown to see where your child went.</p>
          </div>
      ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-primary-600" size={48} />
              <p className="font-bold text-slate-400 italic">Accessing Cloud Archival...</p>
          </div>
      ) : routeHistory.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <HistoryIcon size={40} className="text-slate-300" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">No route history available for this date.</h2>
              <p className="text-slate-500 max-w-sm mx-auto mt-2">We haven&apos;t received any movement data for {selectedChildName} on {new Date(date).toLocaleDateString()}.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">
            <div className="xl:col-span-3 space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative h-[400px] md:h-[500px]">
                    <LiveMap
                        childLocation={null}
                        defaultRegion={profile?.region}
                        avatarId={childStatus?.avatarId}
                        safeZones={[]}
                        routeHistory={displayRoute}
                        deviations={[]}
                        followChild={true}
                        replayPoint={replayPoint}
                    />

                    {/* Replay Controls */}
                    <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-1/2 md:transform md:-translate-x-1/2 bg-white/95 backdrop-blur-md px-4 md:px-6 py-3 md:py-4 rounded-2xl shadow-xl border border-slate-100 flex flex-col md:flex-row items-center gap-3 md:gap-6 z-10">
                        <div className="flex items-center gap-2 w-full md:w-auto justify-center">
                            <button
                                onClick={() => { setReplayIndex(0); setIsReplaying(false); }}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                            >
                                <RotateCcw size={20} />
                            </button>
                            <button
                                onClick={() => setIsReplaying(!isReplaying)}
                                className="w-10 h-10 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-primary-200 transition-all active:scale-95"
                            >
                                {isReplaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                            </button>
                        </div>

                        <div className="flex flex-col gap-1 w-full md:min-w-[200px]">
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                                <span>Progress</span>
                                <span>{Math.round((replayIndex / (routeHistory.length - 1)) * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max={routeHistory.length - 1}
                                value={replayIndex}
                                onChange={(e) => { setIsReplaying(false); setReplayIndex(parseInt(e.target.value)); }}
                                className="w-full accent-primary-600 h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer"
                            />
                            <p className="text-[10px] font-bold text-slate-500 text-center">
                                {new Date(routeHistory[replayIndex]?.timestamp).toLocaleTimeString()}
                            </p>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                            {[1, 2, 5].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setReplaySpeed(s)}
                                    className={clsx(
                                        "px-2 py-1 rounded text-[10px] font-black transition-all",
                                        replaySpeed === s ? "bg-white text-primary-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <SummaryCard label="Distance" value={`${(summary?.totalDistanceMeters || 0 / 1000).toFixed(1)} km`} icon={MapPin} color="text-blue-500" />
                    <SummaryCard label="Duration" value={formatDuration(summary?.totalDurationMinutes || 0)} icon={Clock} color="text-emerald-500" />
                    <SummaryCard label="Max Speed" value={`${Math.round(summary?.maxSpeedKmh || 0)} km/h`} icon={FastForward} color="text-orange-500" />
                    <SummaryCard label="Zones" value={`${summary?.safeZoneVisits || 0} visits`} icon={ShieldCheck} color="text-primary-500" />
                </div>
            </div>

            <div className="space-y-6">
                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 overflow-hidden flex flex-col h-full max-h-[500px] md:max-h-[700px]">
                    <div className="flex items-center gap-2 mb-6">
                        <ActivityIcon className="text-primary-500" size={20} />
                        <h2 className="font-bold">Timeline</h2>
                    </div>

                    <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {timelineEvents.map((event, idx) => (
                            <div key={event.id} className="relative pl-6 border-l-2 border-slate-100 pb-2">
                                <div className={clsx(
                                    "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm",
                                    event.type === 'EXIT_ZONE' ? "bg-rose-500" : "bg-emerald-500"
                                )} />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{event.time}</p>
                                <h4 className="text-sm font-bold text-slate-800">{event.title}</h4>
                                <p className="text-xs text-slate-500 mt-1">{event.description}</p>
                            </div>
                        ))}

                        {/* Start/End placeholders if no activities */}
                        {timelineEvents.length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-xs text-slate-400 italic">No significant events logged today.</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-50">
                         <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                            <div className="text-left">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">First Seen</p>
                                <p className="text-xs font-bold text-slate-700">{new Date(routeHistory[0]?.timestamp).toLocaleTimeString()}</p>
                            </div>
                            <ArrowRight size={14} className="text-slate-300" />
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Last Seen</p>
                                <p className="text-xs font-bold text-slate-700">{new Date(routeHistory[routeHistory.length-1]?.timestamp).toLocaleTimeString()}</p>
                            </div>
                         </div>
                    </div>
                </section>
            </div>
          </div>
      )}
    </DashboardLayout>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <Icon size={16} className={color} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-xl font-black text-slate-900">{value}</span>
        </div>
    )
}

function ShieldCheck({ size, className }: any) {
    return <ActivityIcon size={size} className={className} />;
}
