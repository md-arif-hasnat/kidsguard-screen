"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Battery, BatteryCharging, Signal, MapPin, Lock, Unlock, MoreVertical, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { SosRepository, SosEvent } from '@/lib/repositories/SosRepository';
import ChildAvatar from './ChildAvatar';
import EditChildModal from './EditChildModal';
import RemoveChildDialog from './RemoveChildDialog';
import { useParentProfile } from '@/lib/context/ParentProfileContext';

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
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { family } = useParentProfile();

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowMenu(false);
      }
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

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
    <>
      {showEditModal && (
        <EditChildModal
          childId={displayChild.id}
          initialName={displayChild.name}
          initialAvatarId={displayChild.avatarId}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {}}
        />
      )}

      {showRemoveDialog && family && (
        <RemoveChildDialog
          familyId={family.familyId}
          childId={displayChild.id}
          childName={displayChild.name}
          onClose={() => setShowRemoveDialog(false)}
          onSuccess={() => {}}
        />
      )}

      <div className="relative group/card">
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
              <div className="text-right text-xs text-slate-400 font-medium pr-8">
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
                <span className="text-sm font-semibold truncate">{displayChild.currentZone}</span>
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

        {/* Management Menu */}
        <div className="absolute top-4 right-4" ref={menuRef}>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                }}
                className={cn(
                    "p-2 rounded-lg transition-all duration-200 hover:bg-slate-100",
                    showMenu ? "bg-slate-100 text-slate-900 shadow-inner" : "text-slate-400"
                )}
            >
                <MoreVertical size={20} />
            </button>

            {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowEditModal(true);
                            setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                    >
                        <Edit2 size={16} />
                        Edit Child
                    </button>
                    <div className="my-1 border-t border-slate-50" />
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowRemoveDialog(true);
                            setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                        <Trash2 size={16} />
                        Remove Child
                    </button>
                </div>
            )}
        </div>
      </div>
    </>
  );
};

export default ChildStatusCard;
