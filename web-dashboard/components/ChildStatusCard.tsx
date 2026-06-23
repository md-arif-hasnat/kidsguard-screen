"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Battery, BatteryCharging, Signal, MapPin, Lock, Unlock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';

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
  };
  childId?: string;
}

const ChildStatusCard: React.FC<ChildStatusCardProps> = ({ child: mockChild, childId }) => {
  const [status, setStatus] = useState<ChildStatus | null>(null);

  useEffect(() => {
    if (childId) {
      const unsubscribe = ChildRepository.listenToChildStatus(childId, (data) => {
        setStatus(data);
      });
      return () => unsubscribe();
    }
  }, [childId]);

  const displayChild = childId ? {
    id: childId,
    name: status?.childName || "Loading...",
    avatarId: status?.avatarId || "avatar_1",
    battery: status?.batteryPercent || 0,
    isCharging: status?.charging || false,
    online: status?.online || false,
    lastSeen: status?.lastSeen ? new Date(status.lastSeen).toLocaleTimeString() : "Updating...",
    currentZone: status?.currentZone || "Unknown",
    status: status?.kidGuardActive ? "LOCKED" : "UNLOCKED"
  } : mockChild;

  if (!displayChild) return null;

  return (
    <Link href={`/dashboard/${displayChild.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg overflow-hidden border-2 border-primary-200">
              {displayChild.avatarId ? (
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${displayChild.avatarId}`}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                displayChild.name[0]
              )}
            </div>
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
