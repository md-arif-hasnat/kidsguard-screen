"use client";

import React, { useEffect, useState, useRef } from 'react';
import LiveMap from '@/components/LiveMap';
import { MapPin, Battery, Zap, CloudOff, Info, Clock, Gauge, Navigation, History, ChevronRight } from 'lucide-react';
import { formatDuration, formatLastUsed, formatAddress } from '@/lib/utils/FormatUtils';
import { isFirebaseConfigured, showMocks } from '@/lib/firebase';
import { MOCK_CHILDREN, MOCK_SAFE_ZONES, MOCK_ROUTE_HISTORY, MOCK_DEVIATIONS } from '@/lib/mockData';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { LocationRepository, LocationPoint } from '@/lib/repositories/LocationRepository';
import { SafeZoneRepository, SafeZone } from '@/lib/repositories/SafeZoneRepository';
import { DeviationRepository, RouteDeviation } from '@/lib/repositories/DeviationRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { clsx } from 'clsx';
import ChildAvatar from '@/components/ChildAvatar';

interface ChildLocationPanelProps {
  childId: string;
  onViewHistory?: () => void;
}

export default function ChildLocationPanel({ childId, onViewHistory }: ChildLocationPanelProps) {
  const { profile } = useParentProfile();
  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [currentChildLocation, setCurrentChildLocation] = useState<LocationPoint | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [recentHistory, setRecentHistory] = useState<LocationPoint[]>([]);
  const [deviations, setDeviations] = useState<RouteDeviation[]>([]);
  const [followChild, setFollowChild] = useState(true);

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Listen to status of child
  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;
    return ChildRepository.listenToChildStatus(childId, setChildStatus);
  }, [childId]);

  // Listen to data of child
  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    const unsubLocation = LocationRepository.listenToLatestLocation(childId, setCurrentChildLocation);
    const unsubHistory = LocationRepository.listenToLocationHistory(childId, (history) => {
        setRouteHistory(history);
        setRecentHistory(history.slice(0, 10));
    });
    const unsubDeviations = DeviationRepository.listenToDeviations(childId, setDeviations);

    const familyId = profile?.familyId || localStorage.getItem("kidsguard_family_id") || "mock_family_123";
    const unsubZones = SafeZoneRepository.listenToSafeZones(familyId, setSafeZones);

    return () => {
      unsubLocation();
      unsubHistory();
      unsubDeviations();
      unsubZones();
    };
  }, [childId, profile?.familyId]);

  const handleCardClick = (index: number) => {
    setHighlightedIndex(index);
    setFollowChild(false); // Stop following live location to show the historical point
  };

  const handleMarkerClick = (index: number) => {
    setHighlightedIndex(index);
    const card = cardRefs.current[index];
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const mockActiveChild = MOCK_CHILDREN.find(c => c.id === childId) || MOCK_CHILDREN[0];

  const displayLocation = currentChildLocation ? {
    lat: currentChildLocation.latitude,
    lng: currentChildLocation.longitude,
    accuracy: currentChildLocation.accuracy,
    speed: currentChildLocation.speed,
    timestamp: currentChildLocation.timestamp
  } : (mockActiveChild ? { lat: mockActiveChild.lat, lng: mockActiveChild.lng, accuracy: 20, speed: 0 } : null);

  const displayZones = isFirebaseConfigured ? safeZones.map(z => ({
    id: z.id,
    name: z.name,
    lat: z.latitude,
    lng: z.longitude,
    radius: z.radiusMeters,
    type: z.type
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-slate-900">Live Map Center</h2>
        {!isFirebaseConfigured && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 px-4 flex items-center gap-2">
            <CloudOff size={16} className="text-yellow-600" />
            <span className="text-yellow-700 text-[10px] font-bold uppercase tracking-wide">Mock Mode</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative h-[500px] md:h-[calc(100vh-320px)]">
            <LiveMap
                childLocation={displayLocation}
                defaultRegion={profile?.region}
                avatarId={childStatus?.avatarId || mockActiveChild?.avatarId}
                currentZoneName={childStatus?.currentZone}
                safeZoneStatus={childStatus?.safeZoneStatus}
                safeZones={displayZones}
                routeHistory={displayRoute}
                deviations={displayDeviations}
                followChild={followChild}
                highlightedPointIndex={highlightedIndex}
                onHistoryPointClick={handleMarkerClick}
            />

            {/* Float Info Panel */}
            <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-auto md:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-4 md:p-5 space-y-3 md:space-y-4 z-10">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <ChildAvatar
                            name={childStatus?.childName || mockActiveChild?.name}
                            avatarId={childStatus?.avatarId || mockActiveChild?.avatarId}
                            photoUrl={childStatus?.photoUrl}
                            size="lg"
                            className="border-2 border-primary-200"
                        />
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm md:text-base">{childStatus?.childName || mockActiveChild?.name || "Loading..."}</h3>
                            <p className="text-[10px] text-slate-400 font-medium">{displayLocation?.timestamp ? new Date(displayLocation.timestamp).toLocaleTimeString() : "Updating..."}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setFollowChild(!followChild)}
                        className={clsx(
                            "p-2 rounded-lg transition-colors",
                            followChild ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-500"
                        )}
                    >
                        <MapPin size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-100">
                        <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">Battery</p>
                        <div className="flex items-center gap-2">
                            <Battery size={14} className="text-primary-500" />
                            <span className="text-xs md:text-sm font-bold">{childStatus?.batteryPercent || mockActiveChild?.battery || 0}%</span>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-100">
                        <p className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">Zone</p>
                        <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-green-500" />
                            <span className="text-xs md:text-sm font-bold truncate">{childStatus?.currentZone || mockActiveChild?.currentZone || "Unknown"}</span>
                        </div>
                    </div>
                </div>

                {displayLocation && (
                    <div className="bg-primary-50 p-2 md:p-3 rounded-xl border border-primary-100 flex items-start gap-3">
                        <Info size={16} className="text-primary-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-[8px] md:text-[10px] font-bold text-primary-400 uppercase">Current Telemetry</p>
                            <p className="text-[10px] md:text-xs font-medium text-primary-700">
                                {displayLocation.lat.toFixed(5)}, {displayLocation.lng.toFixed(5)}
                            </p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2">
                <Zap size={18} className="text-primary-500" />
                Map Display
            </h2>
            <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-slate-700">Show Safe Zones</span>
                    <input type="checkbox" className="w-4 h-4 accent-primary-600" defaultChecked />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-slate-700">Show Route Path</span>
                    <input type="checkbox" className="w-4 h-4 accent-primary-600" defaultChecked />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium text-slate-700">Traffic Layer</span>
                    <input type="checkbox" className="w-4 h-4 accent-primary-600" />
                </label>
            </div>
          </div>
        </div>
      </div>

      {/* Location History Section */}
      <section className="space-y-6">
          <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <History className="text-primary-600" size={24} />
                  Recent Location History
              </h2>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last 10 Records</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {recentHistory.map((point, idx) => (
                  <div
                    key={`card-${idx}-${point.timestamp}`}
                    ref={el => { cardRefs.current[idx] = el; }}
                    onClick={() => handleCardClick(idx)}
                    className={clsx(
                        "bg-white p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md",
                        highlightedIndex === idx ? "border-primary-500 ring-2 ring-primary-50 shadow-sm scale-[1.02]" : "border-slate-100 shadow-sm"
                    )}
                  >
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                                  <Clock size={16} />
                              </div>
                              <span className="font-bold text-slate-900">{point.timestamp ? new Date(point.timestamp).toLocaleTimeString() : 'Unknown'}</span>
                          </div>
                          <div className="bg-slate-50 px-2 py-1 rounded text-[10px] font-black text-slate-500 uppercase border border-slate-100">
                              ±{Math.round(point.accuracy)}m
                          </div>
                      </div>

                      {(() => {
                          const { street, area } = formatAddress(point);
                          return (
                              <div className="mb-4">
                                  <p className="text-sm font-bold text-slate-700 line-clamp-2 leading-snug">{street}</p>
                                  {area && <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{area}</p>}
                              </div>
                          );
                      })()}

                      <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Latitude</p>
                              <p className="text-xs font-bold text-slate-600">{point.latitude.toFixed(6)}</p>
                          </div>
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Longitude</p>
                              <p className="text-xs font-bold text-slate-600">{point.longitude.toFixed(6)}</p>
                          </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                              <Gauge size={14} className="text-emerald-500" />
                              <span className="text-xs font-bold text-slate-700">{Math.round(point.speed * 3.6)} km/h</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                              <Navigation size={14} className="text-orange-400" style={{ transform: `rotate(${point.bearing}deg)` }} />
                              <span className="text-[10px] font-black uppercase">{Math.round(point.bearing)}°</span>
                          </div>
                      </div>
                  </div>
              ))}
          </div>

          <div className="flex justify-center pt-4">
              <button
                onClick={onViewHistory}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 group"
              >
                  View Full History
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
          </div>
      </section>
    </div>
  );
}
