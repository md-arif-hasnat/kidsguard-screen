"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Battery, BatteryCharging, Signal, MapPin, Lock, Unlock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { SosRepository, SosEvent } from '@/lib/repositories/SosRepository';
import ChildAvatar from './ChildAvatar';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface ChildStatusCardProps {
  child?: {
    id: string;
    name: string;
    avatarId?: string;
    battery: number;
    isCharging: boolean;
    online: boolean;
    lastSeen: string;
    currentZone: string;
    status: string;
    sos?: boolean;
  };
  childId?: string;
}

const ChildStatusCard: React.FC<ChildStatusCardProps> = ({ child: mockChild, childId }) => {
  const [status, setStatus] = useState<ChildStatus | null>(null);
  const [sosEvents, setSosEvents] = useState<SosEvent[]>([]);

  useEffect(() => {
    if (childId) {
      const unsubStatus = ChildRepository.listenToChildStatus(childId, (data) => {
        setStatus(data);
      });
      const unsubSos = SosRepository.listenToSosEvents(childId, (events) => {
        setSosEvents(events);
      });
      return () => {
        unsubStatus();
        unsubSos();
      };
    }
  }, [childId]);

  const isSosActive = sosEvents.some(e => e.status === "ACTIVE");

  const displayChild = childId ? {
    id: childId,
    name: status?.childName || "Loading...",
    avatarId: status?.avatarId,
    battery: status?.batteryPercent || 0,
    isCharging: status?.charging || false,
    online: status?.online || false,
    lastSeen: status?.lastSeen ? new Date(status.lastSeen).toLocaleTimeString() : "Updating...",
    currentZone: status?.currentZone || "Unknown",
    status: status?.kidGuardActive ? "LOCKED" : "UNLOCKED",
    sos: isSosActive
  } : mockChild;

  if (!displayChild) return null;

  return (
    <Link href={`/dashboard/${displayChild.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <ChildAvatar
              name={displayChild.name}
              avatarId={displayChild.avatarId}
              photoUrl={status?.photoUrl}
              size="xl"
            />
            <div>
              <h3 className="font-bold text-lg">{displayChild.name}</h3>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  displayChild.online ? "bg-green-500" : "bg-slate-400"
                )} />
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {displayChild.online ? 'Online' : 'Offline'}
                </span>
              </div>
              {displayChild.sos && (
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-red-600 font-black uppercase">Active SOS</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 font-medium">
            {displayChild.lastSeen}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            {displayChild.isCharging ? (
              <BatteryCharging size={18} className="text-green-500" />
            ) : (
              <Battery size={18} className={displayChild.battery < 20 ? "text-red-500" : "text-slate-600"} />
            )}
            <span className="text-sm font-semibold">{displayChild.battery}%</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-slate-600" />
            <span className="text-sm font-semibold">{displayChild.currentZone}</span>
          </div>
          <div className="flex items-center gap-2">
            {displayChild.status === 'LOCKED' ? (
              <Lock size={18} className="text-red-500" />
            ) : (
              <Unlock size={18} className="text-green-500" />
            )}
            <span className="text-sm font-semibold">{displayChild.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <Signal size={18} className="text-slate-600" />
            <span className="text-sm font-semibold">Active</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ChildStatusCard;
