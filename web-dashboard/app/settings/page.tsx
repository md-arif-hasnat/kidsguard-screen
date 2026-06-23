"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { User as UserIcon, Bell, Loader2, Save, CheckCircle, AlertCircle, Phone, Mail, Fingerprint, Home, Camera } from 'lucide-react';
import { observeAuth } from '@/lib/auth';
import { ParentRepository, ParentProfile } from '@/lib/repositories/ParentRepository';
import { User } from 'firebase/auth';
import AvatarPicker from '@/components/AvatarPicker';

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    const unsub = observeAuth(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        try {
          const p = await ParentRepository.getProfile(authUser.uid);
          if (p) {
            setProfile(p);
            setDisplayName(p.displayName || authUser.displayName || '');
            setPhoneNumber(p.phoneNumber || authUser.phoneNumber || '');
          }
        } catch (err) {
          console.error("Error loading profile:", err);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setStatus(null);

    try {
      await ParentRepository.updateProfile(user.uid, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim()
      });
      setStatus({ type: 'success', message: 'Profile updated successfully!' });

      // Refresh profile data
      const updated = await ParentRepository.getProfile(user.uid);
      if (updated) setProfile(updated);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (avatarId: string) => {
    if (!user) return;
    try {
      await ParentRepository.updateProfile(user.uid, { avatarId });
      setProfile(prev => prev ? { ...prev, avatarId } : null);
      setShowAvatarPicker(false);
      setStatus({ type: 'success', message: 'Avatar updated successfully!' });
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Failed to update avatar' });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
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
          <p className="font-medium">{status.message}</p>
        </div>
      )}

      <div className="max-w-4xl space-y-8 pb-12">
        {/* Profile Section */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50">
             <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 overflow-hidden border-4 border-white shadow-md transition-transform group-hover:scale-105">
                    {profile?.avatarId ? (
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.avatarId}`} alt="Profile" className="w-full h-full object-cover" />
                    ) : user?.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon size={40} />
                    )}
                  </div>
                  <button
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute -bottom-1 -right-1 bg-primary-600 text-white p-2 rounded-full shadow-lg border-2 border-white hover:bg-primary-700 transition-colors"
                  >
                    <Camera size={16} />
                  </button>
                </div>
                <div className="text-center md:text-left">
                   <h2 className="text-2xl font-bold text-slate-900">{profile?.displayName || "Parent Account"}</h2>
                   <p className="text-slate-500 font-medium">Logged in via {profile?.provider || "Firebase"}</p>
                </div>
             </div>
          </div>

          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium"
                    placeholder="+1234567890"
                  />
                </div>
              </div>

              <div className="space-y-1.5 opacity-70">
                <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="email"
                    disabled
                    value={profile?.email || ""}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none font-medium cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-400 ml-1 italic">Email cannot be changed here.</p>
              </div>

              <div className="space-y-1.5 opacity-70">
                <label className="text-sm font-bold text-slate-700 ml-1">Family ID</label>
                <div className="relative">
                  <Home className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    disabled
                    value={profile?.familyId || "No family assigned"}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none font-medium cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-50">
               <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <Fingerprint size={14} />
                  ID: {user?.uid}
               </div>
               <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-8 rounded-xl shadow-lg shadow-primary-200 transition-all flex items-center gap-2 disabled:opacity-50"
               >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
               </button>
            </div>
          </form>
        </section>

        {/* Notifications Section */}
        <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-900">
            <Bell size={20} className="text-primary-500" />
            <h2 className="font-bold text-lg">Notifications</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 text-sm">Browser Push Alerts</span>
                <p className="text-xs text-slate-500">Receive real-time safety alerts in your browser.</p>
              </div>
              <input type="checkbox" className="w-5 h-5 accent-primary-600" defaultChecked />
            </label>
            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 text-sm">Critical SOS Alerts (Sound)</span>
                <p className="text-xs text-slate-500">Play an audible alarm when an SOS is triggered.</p>
              </div>
              <input type="checkbox" className="w-5 h-5 accent-primary-600" defaultChecked />
            </label>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
