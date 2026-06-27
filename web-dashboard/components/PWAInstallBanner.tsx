"use client";

import React, { useState, useEffect } from 'react';
import { Share, Download, X, PlusSquare, MoreVertical, Smartphone, Shield } from 'lucide-react';
import { AuditRepository, AuditAction, AuditSeverity } from '@/lib/repositories/AuditRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';

export default function PWAInstallBanner() {
  const { profile, family } = useParentProfile();
  const [showBanner, setShowBanner] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    window.addEventListener('appinstalled', () => {
        if (profile && family) {
            AuditRepository.log({
                actorUid: profile.uid,
                actorEmail: profile.email || "user",
                familyId: family.familyId,
                action: AuditAction.PWA_INSTALLED,
                targetType: 'SYSTEM',
                severity: AuditSeverity.INFO
            });
        }
    });

    // 1. Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    // 2. Detect if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

    if (isStandalone) return;

    // 3. Check dismiss status
    const dismissedAt = localStorage.getItem('kidsguard_pwa_install_banner_dismissed');
    if (dismissedAt) {
        const dismissedDate = new Date(parseInt(dismissedAt));
        const now = new Date();
        const diffDays = (now.getTime() - dismissedDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays < 7) return; // Don't show for 7 days
    }

    // 4. Show only on mobile
    if (isIOS) {
        setPlatform('ios');
        setShowBanner(true);
    } else if (isAndroid) {
        setPlatform('android');
        setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('kidsguard_pwa_install_banner_dismissed', Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="bg-slate-900 text-white p-3 md:p-4 flex items-center justify-between shadow-lg sticky top-0 z-[100] animate-in slide-in-from-top duration-500 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight leading-none">KidsGuard for Mobile</p>
            <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest mt-1">Protect • Guide • Grow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={() => {
                    setShowInstructions(true);
                    if (profile && family) {
                        AuditRepository.log({
                            actorUid: profile.uid,
                            actorEmail: profile.email || "user",
                            familyId: family.familyId,
                            action: AuditAction.PWA_INSTALL_CLICKED,
                            targetType: 'SYSTEM',
                            severity: AuditSeverity.INFO
                        });
                    }
                }}
                className="bg-white text-primary-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-primary-50 transition-colors"
            >
                Install
            </button>
            <button onClick={handleDismiss} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
            </button>
        </div>
      </div>

      {showInstructions && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative">
                <button onClick={() => setShowInstructions(false)} className="absolute top-6 right-6 text-slate-400">
                    <X size={24} />
                </button>

                <h2 className="text-2xl font-black text-slate-900 mb-2">Install KidsGuard</h2>
                <p className="text-slate-500 text-sm mb-8 font-medium">Follow these steps to add KidsGuard to your home screen.</p>

                <div className="space-y-6">
                    {platform === 'ios' ? (
                        <>
                            <Step number={1} text="Tap the Share button at the bottom of Safari" icon={<Share size={18} className="text-blue-500" />} />
                            <Step number={2} text="Scroll down and tap 'Add to Home Screen'" icon={<PlusSquare size={18} />} />
                            <Step number={3} text="Tap 'Add' in the top right corner" />
                        </>
                    ) : (
                        <>
                            <Step number={1} text="Tap the Menu ⋮ icon in Chrome" icon={<MoreVertical size={18} />} />
                            <Step number={2} text="Tap 'Add to Home Screen' or 'Install App'" icon={<Download size={18} />} />
                            <Step number={3} text="Confirm the installation" />
                        </>
                    )}
                </div>

                <button
                    onClick={() => setShowInstructions(false)}
                    className="w-full mt-10 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl"
                >
                    Got it
                </button>
            </div>
        </div>
      )}
    </>
  );
}

function Step({ number, text, icon }: { number: number, text: string, icon?: React.ReactNode }) {
    return (
        <div className="flex gap-4 items-start">
            <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                {number}
            </div>
            <div className="flex-1">
                <p className="text-sm font-bold text-slate-700 leading-snug">{text}</p>
                {icon && <div className="mt-2 bg-slate-50 p-2 rounded-lg inline-flex">{icon}</div>}
            </div>
        </div>
    );
}
