"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { FamilyRepository } from '@/lib/repositories/FamilyRepository';

interface RemoveChildDialogProps {
  familyId: string;
  childId: string;
  childName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RemoveChildDialog({ familyId, childId, childName, onClose, onSuccess }: RemoveChildDialogProps) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      await FamilyRepository.removeChildFromFamily(familyId, childId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to remove child from family');
      setRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="p-8 pb-4 flex justify-end">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
            </button>
        </div>

        <div className="px-8 pb-8 text-center">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-rose-100 animate-pulse">
                <AlertTriangle size={40} className="text-rose-500" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Remove Child?</h2>
            <p className="text-slate-500 text-sm mt-3 font-medium leading-relaxed">
                This will disconnect <span className="font-bold text-slate-700">{childName}</span> from your family vault.
            </p>
            <p className="text-slate-400 text-xs mt-4 italic">
                Note: This will NOT delete the application from the child&apos;s phone.
            </p>

            {error && (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold">
                    {error}
                </div>
            )}

            <div className="mt-10 flex flex-col gap-3">
                <button
                    onClick={handleRemove}
                    disabled={removing}
                    className="w-full px-6 py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {removing ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    Remove Permanently
                </button>
                <button
                    onClick={onClose}
                    disabled={removing}
                    className="w-full px-6 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                >
                    Keep Child
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
