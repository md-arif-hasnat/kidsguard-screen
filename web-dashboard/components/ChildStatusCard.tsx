import React from 'react';
import Link from 'next/link';
import { Battery, BatteryCharging, Signal, MapPin, Lock, Unlock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface ChildStatusCardProps {
  child: {
    id: string;
    name: string;
    battery: number;
    isCharging: boolean;
    online: boolean;
    lastSeen: string;
    currentZone: string;
    status: string;
  };
}

const ChildStatusCard: React.FC<ChildStatusCardProps> = ({ child }) => {
  return (
    <Link href={`/dashboard/${child.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-lg">
              {child.name[0]}
            </div>
            <div>
              <h3 className="font-bold text-lg">{child.name}</h3>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  child.online ? "bg-green-500" : "bg-slate-400"
                )} />
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  {child.online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 font-medium">
            {child.lastSeen}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            {child.isCharging ? (
              <BatteryCharging size={18} className="text-green-500" />
            ) : (
              <Battery size={18} className={child.battery < 20 ? "text-red-500" : "text-slate-600"} />
            )}
            <span className="text-sm font-semibold">{child.battery}%</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-slate-600" />
            <span className="text-sm font-semibold">{child.currentZone}</span>
          </div>
          <div className="flex items-center gap-2">
            {child.status === 'LOCKED' ? (
              <Lock size={18} className="text-red-500" />
            ) : (
              <Unlock size={18} className="text-green-500" />
            )}
            <span className="text-sm font-semibold">{child.status}</span>
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
