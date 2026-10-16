"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Battery, BatteryCharging, Signal, MapPin, Lock, Unlock, MoreVertical, Edit2, Trash2, ShieldAlert, BarChart3, AppWindow } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { SosRepository, SosEvent } from '@/lib/repositories/SosRepository';
import ChildAvatar from './ChildAvatar';
import EditChildModal from './EditChildModal';
import RemoveChildDialog from './RemoveChildDialog';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { RoleHelper } from '@/lib/utils/RoleHelper';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));

}

interface ChildStatusCardProps {
  childId: string;
}

const ChildStatusCard: React.FC<ChildStatusCardProps> = ({ childId }) => {
  const [status, setStatus] = useState<ChildStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [sosEvents, setSosEvents] = useState<SosEvent[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { family, role } = useParentProfile();

  useEffect(() => {
    setStatusLoaded(false);
    const unsubStatus = ChildRepository.listenToChildStatus(childId, (nextStatus) => {
      setStatus(nextStatus);
      setStatusLoaded(true);
    });
    const unsubSos = SosRepository.listenToSosEvents(childId, setSosEvents);
    return () => {
      unsubStatus();
      unsubSos();
    };
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

  if (!statusLoaded) {
    return (
      <div
        className="min-h-[200px] animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-label="Loading child device status"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-slate-100" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(item => (
            <div key={item} className="h-5 rounded bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <Link href={`/dashboard/${childId}`}>
        <div className="min-h-[200px] rounded-xl border border-amber-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <ShieldAlert size={26} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Device status unavailable</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                This paired child has not reported live status yet. Open the
                device dashboard for setup and connection details.
              </p>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  const displayChild = {
    id: childId,
    name: status.childName || "Child",
    avatarId: status.avatarId,
    battery: status.batteryPercent ?? 0,
    isCharging: status.charging || false,
    online: status.online || false,
    lastSeen: status.lastSeen ? new Date(status.lastSeen).toLocaleTimeString() : "Not reported",
    currentZone: status.currentZone || "Not reported",
    status: status.kidGuardActive ? "LOCKED" : "UNLOCKED",
    sos: isSosActive
  };

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
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate">{displayChild.currentZone}</span>
                    {status?.lastLocation?.timestamp && (
                        <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap">
                            {(() => {
                                const diff = Date.now() - status.lastLocation.timestamp;
                                if (diff < 60000) return "Live / Recently updated";
                                if (diff < 300000) return "Updated few mins ago";
                                return `Updated ${Math.round(diff / 60000)}m ago`;
                            })()}
                        </span>
                    )}
                </div>
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
        {RoleHelper.canManageChildren(role) && (
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
                      {RoleHelper.canEditChild(role) && (
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
                      )}
                          <Link
                              href={`/dashboard/${displayChild.id}?tab=app-activity`}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                          >
                              <BarChart3 size={16} />
                              View App Activity
                          </Link>
                          <Link
                              href={`/dashboard/${displayChild.id}?tab=installed-apps`}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setShowMenu(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                          >
                              <AppWindow size={16} />
                              View Installed Apps
                          </Link>

                          {RoleHelper.canRemoveChild(role) && (
                            <>
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
                            </>
                          )}
                  </div>
              )}
          </div>
        )}
      </div>
    </>
  );
};

export default ChildStatusCard;
