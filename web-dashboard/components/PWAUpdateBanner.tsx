"use client";

import React, { useEffect, useState } from 'react';
import { ConfigRepository } from '@/lib/repositories/ConfigRepository';
import { RefreshCw, X } from 'lucide-react';

const PWAUpdateBanner: React.FC = () => {
    const [show, setShow] = useState(false);
    const [webVersion, setWebVersion] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const checkUpdate = async () => {
            try {
                const config = await ConfigRepository.getUpdateConfig();
                if (config && config.webVersion) {
                    const lastSeenVersion = localStorage.getItem('kg_last_web_version') || '0.0.0';
                    if (config.webVersion !== lastSeenVersion) {
                        setWebVersion(config.webVersion);
                        setMessage(config.webUpdateMessage || 'New version available');
                        setShow(true);
                    }
                }
            } catch (error) {
                console.error("Failed to check for PWA update:", error);
            }
        };

        // Check on mount
        checkUpdate();
    }, []);

    const handleUpdate = () => {
        localStorage.setItem('kg_last_web_version', webVersion);
        setShow(false);
        // Reload to get fresh code
        window.location.reload();
    };

    const handleDismiss = () => {
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-96 z-[100] animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl border border-slate-800 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white">
                            <RefreshCw size={20} />
                        </div>
                        <div>
                            <h4 className="font-black text-sm uppercase tracking-tight">App Update Available</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Version {webVersion}</p>
                        </div>
                    </div>
                    <button onClick={handleDismiss} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                    {message}
                </p>

                <div className="flex gap-2">
                    <button
                        onClick={handleUpdate}
                        className="flex-1 bg-white text-slate-900 font-black py-3 rounded-2xl text-xs hover:bg-slate-200 transition-colors uppercase tracking-widest"
                    >
                        Update Now
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="px-6 py-3 border border-slate-700 rounded-2xl text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
                    >
                        Later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWAUpdateBanner;
