"use client";

import React, { useState } from 'react';
import { X, User, Save, Loader2, Camera } from 'lucide-react';
import { ChildRepository } from '@/lib/repositories/ChildRepository';
import AvatarPicker from './AvatarPicker';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface EditChildModalProps {
  childId: string;
  initialName: string;
  initialAvatarId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditChildModal({ childId, initialName, initialAvatarId, onClose, onSuccess }: EditChildModalProps) {
  const [name, setName] = useState(initialName);
  const [avatarId, setAvatarId] = useState(initialAvatarId || 'child_1');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      await ChildRepository.updateChild(childId, {
        name: name.trim(),
        avatarId: avatarId
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update child profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        {showAvatarPicker && (
          <AvatarPicker
            type="child"
            currentAvatarId={avatarId}
            onSelect={(id) => {
              setAvatarId(id);
              setShowAvatarPicker(false);
            }}
            onClose={() => setShowAvatarPicker(false)}
          />
        )}

        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Edit Profile</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 italic">Child Management</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-sm font-bold">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center">
             <div className="relative group">
                <div className="w-28 h-28 rounded-3xl bg-primary-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                    <img
                        src={`https://api.dicebear.com/7.x/bottts/svg?seed=${avatarId}`}
                        alt="Avatar"
                        className="w-full h-full object-contain"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute -bottom-2 -right-2 bg-primary-600 text-white p-2.5 rounded-2xl shadow-lg border-2 border-white hover:bg-primary-700 transition-colors"
                >
                    <Camera size={18} />
                </button>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase mt-4 tracking-tighter">Tap to change avatar</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Child&apos;s Name</label>
            <div className="relative">
              <User className="absolute left-4 top-4 text-slate-400" size={20} />
              <input
                type="text"
                required
                disabled={saving}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-primary-50 focus:border-primary-500 outline-none transition-all font-bold text-slate-700"
                placeholder="Ibbaad-8"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-[2] px-6 py-4 bg-primary-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
