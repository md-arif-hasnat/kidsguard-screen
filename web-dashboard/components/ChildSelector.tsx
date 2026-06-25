"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, Users, Check } from 'lucide-react';
import { clsx } from 'clsx';
import ChildAvatar from './ChildAvatar';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { FamilyRepository } from '@/lib/repositories/FamilyRepository';

interface ChildSelectorProps {
  selectedChildId: string | null;
  onSelect: (id: string) => void;
  familyId?: string | null;
  className?: string;
  variant?: 'dropdown' | 'list';
}

export default function ChildSelector({
    selectedChildId,
    onSelect,
    familyId,
    className,
    variant = 'dropdown'
}: ChildSelectorProps) {
    const [children, setChildren] = useState<Record<string, ChildStatus>>({});
    const [childIds, setChildIds] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!familyId) return;

        const unsubFamily = FamilyRepository.listenToFamily(familyId, (data) => {
            if (data) {
                setChildIds(data.childDeviceIds);
            }
        });

        return () => unsubFamily();
    }, [familyId]);

    useEffect(() => {
        if (childIds.length === 0) return;

        const unsubscribes = childIds.map(id =>
            ChildRepository.listenToChildStatus(id, (status) => {
                if (status) {
                    setChildren(prev => ({ ...prev, [id]: status }));
                }
            })
        );

        return () => unsubscribes.forEach(unsub => unsub());
    }, [childIds]);

    const selectedChild = selectedChildId ? children[selectedChildId] : null;

    if (variant === 'list') {
        return (
            <div className={clsx("flex flex-col gap-3", className)}>
                {childIds.map(id => {
                    const child = children[id];
                    const isSelected = selectedChildId === id;
                    const name = child?.childName || "Loading...";

                    return (
                        <div
                            key={id}
                            onClick={() => onSelect(id)}
                            className={clsx(
                                "p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between",
                                isSelected ? "border-primary-500 bg-primary-50" : "border-slate-50 bg-slate-50 hover:border-slate-200"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <ChildAvatar
                                    name={name}
                                    avatarId={child?.avatarId}
                                    photoUrl={child?.photoUrl}
                                    size="md"
                                />
                                <div>
                                    <p className="font-bold text-slate-900 text-xs md:text-sm">{name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className={clsx("w-1.5 h-1.5 rounded-full", child?.online ? "bg-green-500" : "bg-slate-400")} />
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                            {child?.online ? "Online" : "Offline"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={clsx("relative", className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm min-w-[180px]"
            >
                <ChildAvatar
                    name={selectedChild?.childName}
                    avatarId={selectedChild?.avatarId}
                    photoUrl={selectedChild?.photoUrl}
                    size="sm"
                />
                <span className="flex-1 text-left truncate">{selectedChild?.childName || "Select Child"}</span>
                <ChevronDown size={16} className={clsx("text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        {childIds.map(id => {
                            const child = children[id];
                            const name = child?.childName || "Loading...";
                            return (
                                <button
                                    key={id}
                                    onClick={() => {
                                        onSelect(id);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full text-left px-4 py-3 text-sm font-bold transition-colors flex items-center gap-3",
                                        selectedChildId === id ? "bg-primary-50 text-primary-600" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                >
                                    <ChildAvatar
                                        name={name}
                                        avatarId={child?.avatarId}
                                        photoUrl={child?.photoUrl}
                                        size="sm"
                                    />
                                    <span className="flex-1">{name}</span>
                                    {selectedChildId === id && <Check size={14} />}
                                </button>
                            );
                        })}
                        {childIds.length === 0 && (
                             <div className="px-4 py-6 text-center text-slate-400 text-xs italic">
                                No children found
                             </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
