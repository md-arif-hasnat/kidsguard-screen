"use client";

import React from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface AvatarPickerProps {
  type: 'parent' | 'child';
  currentAvatarId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const CHILD_AVATARS = Array.from({ length: 12 }, (_, i) => `child_${i + 1}`);
const PARENT_AVATARS = Array.from({ length: 8 }, (_, i) => `parent_${i + 1}`);

const AvatarPicker: React.FC<AvatarPickerProps> = ({ type, currentAvatarId, onSelect, onClose }) => {
  const avatars = type === 'child' ? CHILD_AVATARS : PARENT_AVATARS;
  const style = type === 'child' ? 'bottts' : 'avataaars';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900">Select Avatar</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-4 md:grid-cols-6 gap-6">
            {avatars.map((id) => (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={cn(
                  "relative group transition-all duration-200 aspect-square rounded-2xl p-1 overflow-hidden border-4",
                  currentAvatarId === id ? "border-primary-500 bg-primary-50 shadow-lg shadow-primary-100 scale-105" : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                )}
              >
                <img
                  src={`https://api.dicebear.com/7.x/${style}/svg?seed=${id}`}
                  alt={id}
                  className="w-full h-full object-contain"
                />
                {currentAvatarId === id && (
                  <div className="absolute top-1 right-1 bg-primary-500 text-white rounded-full p-0.5 shadow-sm">
                    <X size={10} className="rotate-45" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
           <button
             onClick={onClose}
             className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
           >
             Cancel
           </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarPicker;
