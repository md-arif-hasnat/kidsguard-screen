"use client";

import React, { useEffect, useState } from 'react';
import LiveMap from '@/components/LiveMap';
import { MapPin, Battery, Zap, CloudOff, Info } from 'lucide-react';
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
}

export default function ChildLocationPanel({ childId }: ChildLocationPanelProps) {
  const { profile } = useParentProfile();
  const [childStatus, setChildStatus] = useState<ChildStatus | null>(null);
  const [currentChildLocation, setCurrentChildLocation] = useState<LocationPoint | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [deviations, setDeviations] = useState<RouteDeviation[]>([]);
  const [followChild, setFollowChild] = useState(true);

  // Listen to status of child
  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;
    return ChildRepository.listenToChildStatus(childId, setChildStatus);
  }, [childId]);

  // Listen to data of child
  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    const unsubLocation = LocationRepository.listenToLatestLocation(childId, setCurrentChildLocation);
    const unsubHistory = LocationRepository.listenToLocationHistory(childId, setRouteHistory);
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
    </div>
  );
}
