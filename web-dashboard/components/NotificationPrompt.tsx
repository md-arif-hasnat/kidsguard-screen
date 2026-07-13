"use client";

import React, { useEffect, useState } from 'react';
import { Bell, X, Shield } from 'lucide-react';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';

export default function NotificationPrompt() {
    const { profile } = useParentProfile();
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Only show if not granted and not previously dismissed in this session
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                const dismissed = sessionStorage.getItem('notif_prompt_dismissed');
                if (!dismissed) {
                    setShow(true);
                }
            }
        }
    }, []);

    const handleEnable = async () => {
        if (!profile) return;
        try {
            await NotificationRepository.registerDevice(
                profile.uid,
                window.navigator.userAgent.split(') ')[0].split(' (')[1] || "Web Browser"
            );
            setShow(false);
        } catch (e) {
            console.error("Failed to enable notifications", e);
        }
    };

    if (!show) return null;

    return (
        <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                    <Bell size={18} className="text-white" />
                </div>
                <div>
                    <p className="text-sm font-bold">Stay Alert</p>
                    <p className="text-xs text-primary-100 hidden sm:block">Enable push notifications to receive instant SOS and safety alerts.</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={handleEnable}
                    className="bg-white text-primary-600 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-sm hover:bg-primary-50 transition-colors"
                >
                    Enable Now
                </button>
                <button
                    onClick={() => {
                        setShow(false);
                        sessionStorage.setItem('notif_prompt_dismissed', 'true');
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
