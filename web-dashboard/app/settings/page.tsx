"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { User as UserIcon, Bell, Loader2, Save, CheckCircle, AlertCircle, Phone, Mail, Fingerprint, Home, Camera, Globe, Smartphone } from 'lucide-react';
import { observeAuth } from '@/lib/auth';
import { ParentRepository } from '@/lib/repositories/ParentRepository';
import { NotificationRepository, NotificationSettings } from '@/lib/repositories/NotificationRepository';
import { useParentProfile, getAvatarUrl, getDisplayName } from '@/lib/context/ParentProfileContext';
import { User } from 'firebase/auth';
import AvatarPicker from '@/components/AvatarPicker';
import { clsx } from 'clsx';

export default function SettingsPage() {
  const { profile, loading: profileLoading } = useParentProfile();
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    safeZone: true,
    sos: true,
    battery: true,
    deviceStatus: true,
    pairing: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [region, setRegion] = useState<'DE' | 'BD' | 'US' | 'Global'>('DE');

  useEffect(() => {
    if (profile) {
        setDisplayName(profile.displayName || '');
        setPhoneNumber(profile.phoneNumber || '');
        setRegion(profile.region || 'DE');

        const loadNotifs = async () => {
            const ns = await NotificationRepository.getNotificationSettings(profile.uid);
            if (ns) setNotifSettings(ns);
            setLoading(false);
        };
        loadNotifs();
    } else if (!profileLoading) {
        setLoading(false);
    }
  }, [profile, profileLoading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setStatus(null);

    try {
      await Promise.all([
        ParentRepository.updateProfile(profile.uid, {
            displayName: displayName.trim(),
            phoneNumber: phoneNumber.trim(),
            region
        }),
        NotificationRepository.updateNotificationSettings(profile.uid, notifSettings)
      ]);

      setStatus({ type: 'success', message: 'Profile and notification settings updated successfully!' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif = (key: keyof NotificationSettings) => {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAvatarSelect = async (avatarId: string) => {
    if (!profile) return;
    try {
      await ParentRepository.updateProfile(profile.uid, { avatarId });
      setShowAvatarPicker(false);
      setStatus({ type: 'success', message: 'Avatar updated successfully!' });
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Failed to update avatar' });
    }
  };

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  const avatarUrl = getAvatarUrl(profile);

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Account Settings</h1>
      </div>

      {showAvatarPicker && (
        <AvatarPicker
          type="parent"
          currentAvatarId={profile?.avatarId || "parent_1"}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      {status && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${
          status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
        }`}>
          {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <p className="font-medium text-sm">{status.message}</p>
        </div>
      )}

      <div className="max-w-4xl space-y-6 md:space-y-8 pb-12">
        {/* Profile Section */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
             <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
                <div className="relative group">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 overflow-hidden border-4 border-white shadow-md transition-transform group-hover:scale-105">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon size={32} />
                    )}
                  </div>
                  <button
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute -bottom-1 -right-1 bg-primary-600 text-white p-1.5 md:p-2 rounded-full shadow-lg border-2 border-white hover:bg-primary-700 transition-colors"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <div className="text-center md:text-left">
                   <h2 className="text-xl md:text-2xl font-bold text-slate-900">{profile?.displayName || "Parent Account"}</h2>
                   <p className="text-slate-500 font-medium text-sm">Logged in via {profile?.provider || "Firebase"}</p>
                </div>
             </div>
          </div>

          <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium text-sm"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium text-sm"
                    placeholder="+1234567890"
                  />
                </div>
              </div>

              <div className="space-y-1.5 opacity-70">
                <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="email"
                    disabled
                    value={profile?.email || ""}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none font-medium cursor-not-allowed text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 ml-1 uppercase tracking-wider">Default Region</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 text-slate-400" size={18} />
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium appearance-none text-sm"
                  >
                    <option value="DE">Germany</option>
                    <option value="BD">Bangladesh</option>
                    <option value="US">United States</option>
                    <option value="Global">Global View</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-50">
               <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono break-all">
                  <Fingerprint size={12} />
                  ID: {profile?.uid}
               </div>
               <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
               >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
               </button>
            </div>
          </form>
        </section>

        {/* Notifications Section */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-900">
            <Bell size={20} className="text-primary-500" />
            <h2 className="font-bold text-lg">Notifications</h2>
          </div>
          <div className="space-y-3">
            <NotificationToggle
                label="Safe Zone Alerts"
                description="Arrived/Left Home, School, etc."
                checked={notifSettings.safeZone}
                onChange={() => toggleNotif('safeZone')}
            />
            <NotificationToggle
                label="SOS Alerts"
                description="Critical emergency signals."
                checked={notifSettings.sos}
                onChange={() => toggleNotif('sos')}
            />
            <NotificationToggle
                label="Battery Alerts"
                description="Low battery warnings."
                checked={notifSettings.battery}
                onChange={() => toggleNotif('battery')}
            />

            <div className="mt-8 pt-6 border-t border-slate-100">
                <button
                    type="button"
                    onClick={async () => {
                        if (!profile) return;
                        await NotificationRepository.registerDevice(profile.uid, window.navigator.userAgent.split(') ')[0].split(' (')[1] || "Web Browser");
                        alert("Device registration requested.");
                    }}
                    className="w-full sm:w-auto text-primary-600 font-bold hover:underline flex items-center justify-center gap-2 text-sm"
                >
                    <Smartphone size={16} />
                    Enable Push on this Device
                </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

function NotificationToggle({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: () => void }) {
    return (
        <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
            <div className="space-y-0.5">
                <span className="font-bold text-slate-800 text-sm">{label}</span>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <input
                type="checkbox"
                className="w-5 h-5 accent-primary-600 cursor-pointer"
                checked={checked}
                onChange={onChange}
            />
        </label>
    )
}
