"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import LiveMap from '@/components/LiveMap';
import {
    History as HistoryIcon,
    Calendar,
    Play,
    Pause,
    RotateCcw,
    MapPin,
    Clock,
    FastForward,
    AlertCircle,
    Activity as ActivityIcon,
    ArrowRight,
    Loader2,
    ShieldAlert
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { LocationRepository, LocationPoint } from '@/lib/repositories/LocationRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { ActivityRepository, ActivityEvent } from '@/lib/repositories/ActivityRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { RoleHelper } from '@/lib/utils/RoleHelper';
import { calculateDistance, formatDuration } from '@/lib/utils/GeofenceUtils';
import { clsx } from 'clsx';

interface ChildHistoryPanelProps {
  childId: string;
}

export default function ChildHistoryPanel({ childId }: ChildHistoryPanelProps) {
  const { profile, family, role, isChildAccessible, loading: profileLoading } = useParentProfile();
  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canViewHistory = RoleHelper.canViewRouteHistory(role);

  useEffect(() => {
    if (!childId || !date) {
        setLoading(false);
        return;
    }

    if (!profileLoading && !isChildAccessible(childId)) {
        setLoading(false);
        return;
    }

    setLoading(true);
    setIsReplaying(false);
    setReplayIndex(0);

    const unsubStatus = ChildRepository.listenToChildStatus(childId, setChildStatus);
    const unsubHistory = LocationRepository.listenToLocationHistoryByDate(childId, date, (history) => {
        setRouteHistory(history);
        setLoading(false);
    });
    const unsubActivity = ActivityRepository.listenToActivity(childId, setActivities);

    return () => {
      unsubStatus();
      unsubHistory();
      unsubActivity();
    };
  }, [childId, date, profileLoading, isChildAccessible]);

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
        stopsCount: 0,
        safeZoneVisits: activities.filter(a => a.type === 'ENTER_ZONE').length
    };
  }, [routeHistory, activities]);

  const timelineEvents = useMemo(() => {
    const events = (activities ?? [])
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

  if (isFirebaseConfigured && !isChildAccessible(childId)) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6 border border-rose-100">
                <ShieldAlert size={32} className="text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        </div>
    );
  }

  if (!canViewHistory) {
      return (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert size={32} className="text-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
            <p className="text-slate-500 max-w-sm mx-auto mt-2 text-sm">Your role does not have permission to view route history.</p>
        </div>
      )
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <HistoryIcon className="text-primary-600" size={24} />
            Route History Archive
          </h2>
          <p className="text-slate-500 text-sm mt-1">Review activity for {childStatus?.childName || "your child"}.</p>
        </div>

        <div className="flex items-center gap-3">
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

      {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="animate-spin text-primary-600" size={48} />
              <p className="font-bold text-slate-400 italic">Accessing movement data...</p>
          </div>
      ) : routeHistory.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <HistoryIcon size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">No route history for this date.</h2>
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

                    <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-1/2 md:transform md:-translate-x-1/2 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-slate-100 flex flex-col md:flex-row items-center gap-3 md:gap-6 z-10">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { setReplayIndex(0); setIsReplaying(false); }}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                            >
                                <RotateCcw size={20} />
                            </button>
                            <button
                                onClick={() => setIsReplaying(!isReplaying)}
                                className="w-10 h-10 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all"
                            >
                                {isReplaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                            </button>
                        </div>

                        <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
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
                    <SummaryCard label="Distance" value={`${((summary?.totalDistanceMeters || 0) / 1000).toFixed(1)} km`} icon={MapPin} color="text-blue-500" />
                    <SummaryCard label="Duration" value={formatDuration(summary?.totalDurationMinutes || 0)} icon={Clock} color="text-emerald-500" />
                    <SummaryCard label="Max Speed" value={`${Math.round(summary?.maxSpeedKmh || 0)} km/h`} icon={FastForward} color="text-orange-500" />
                    <SummaryCard label="Visits" value={`${summary?.safeZoneVisits || 0}`} icon={ActivityIcon} color="text-primary-500" />
                </div>
            </div>

            <div className="space-y-6">
                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col h-[500px]">
                    <div className="flex items-center gap-2 mb-6">
                        <ActivityIcon className="text-primary-500" size={20} />
                        <h2 className="font-bold">Timeline</h2>
                    </div>

                    <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {timelineEvents.map((event) => (
                            <div key={event.id} className="relative pl-6 border-l-2 border-slate-100 pb-2">
                                <div className={clsx(
                                    "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm",
                                    event.type === 'EXIT_ZONE' ? "bg-rose-500" : "bg-emerald-500"
                                )} />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{event.time}</p>
                                <h4 className="text-sm font-bold text-slate-800">{event.title}</h4>
                            </div>
                        ))}

                        {timelineEvents.length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-xs text-slate-400 italic">No events logged today.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
          </div>
      )}
    </div>
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
