"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { User as UserIcon, Bell, Loader2, Save, CheckCircle, AlertCircle, Phone, Mail, Fingerprint, Camera, Globe, Smartphone, Languages } from 'lucide-react';
import { observeAuth } from '@/lib/auth';
import { ParentRepository } from '@/lib/repositories/ParentRepository';
import { NotificationRepository, NotificationSettings } from '@/lib/repositories/NotificationRepository';
import { useParentProfile, getAvatarUrl, getDisplayName } from '@/lib/context/ParentProfileContext';
import { User } from 'firebase/auth';
import AvatarPicker from '@/components/AvatarPicker';
import { clsx } from 'clsx';
import RemoteImage from '@/components/RemoteImage';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { translateUiText } from '@/lib/i18n/uiTranslations';
import BillingInvoicesSection from '@/components/BillingInvoicesSection';
import OwnerEmailChangeDialog from '@/components/OwnerEmailChangeDialog';
import { FamilyRole } from '@/lib/repositories/FamilyRepository';

export default function SettingsPage() {
  const { profile, family, role: profileRole, loading: profileLoading } = useParentProfile();
  const { preference, locale, t } = useLanguage();
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    safeZone: true,
    sos: true,
    battery: true,
    deviceStatus: true,
    pairing: true,
    appUsage: true,
    requestAlerts: true,
    permissionChanges: true,
    syncErrors: true,
    appUpdates: true,
    securityAlerts: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);

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

  // Debug Logging
  useEffect(() => {
    if (profile && family) {
        console.log("RBAC DEBUG [Settings]:", {
            uid: profile.uid,
            familyId: family.familyId,
            ownerId: family.ownerId,
            resolvedRole: profileRole
        });
    }
  }, [profile, family, profileRole]);

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

      setStatus({ type: 'success', message: t('profileSaved') });
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || t('saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif = (key: keyof NotificationSettings) => {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNotificationSave = async () => {
    if (!profile) return;
    setSaving(true);
    setStatus(null);
    try {
      await NotificationRepository.updateNotificationSettings(
        profile.uid,
        notifSettings
      );
      setStatus({
        type: 'success',
        message: t('notificationSaved')
      });
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || t('notificationSaveFailed')
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = async (avatarId: string) => {
    if (!profile) return;
    try {
      await ParentRepository.updateProfile(profile.uid, { avatarId });
      setShowAvatarPicker(false);
      setStatus({ type: 'success', message: t('avatarSaved') });
    } catch (err: any) {
      setStatus({ type: 'error', message: t('avatarSaveFailed') });
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
  const isFamilyOwner = Boolean(
    profile?.uid &&
    family?.ownerId === profile.uid &&
    profileRole === FamilyRole.OWNER
  );

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('accountSettings')}</h1>
      </div>

      {showAvatarPicker && (
        <AvatarPicker
          type="parent"
          currentAvatarId={profile?.avatarId || "parent_1"}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      <OwnerEmailChangeDialog
        currentEmail={profile?.email || ""}
        open={showEmailChange && isFamilyOwner}
        onClose={() => setShowEmailChange(false)}
      />

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
                  <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 overflow-hidden border-4 border-white shadow-md transition-transform group-hover:scale-105">
                    {avatarUrl ? (
                        <RemoteImage src={avatarUrl} alt="Profile" fill sizes="96px" className="object-cover" />
                    ) : (
                        <UserIcon size={32} />
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={t('changeAvatar')}
                    onClick={() => setShowAvatarPicker(true)}
                    className="absolute -bottom-1 -right-1 bg-primary-600 text-white p-1.5 md:p-2 rounded-full shadow-lg border-2 border-white hover:bg-primary-700 transition-colors"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <div className="text-center md:text-left">
                   <h2 className="text-xl md:text-2xl font-bold text-slate-900">{profile?.displayName || t('parentAccount')}</h2>
                   <p className="text-slate-500 font-medium text-sm">{t('loggedInVia', { provider: profile?.provider || 'Firebase' })}</p>
                </div>
             </div>
          </div>

          <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 mx-1 uppercase tracking-wider">{t('fullName')}</label>
                <div className="relative">
                  <UserIcon className="absolute start-3 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 ps-10 pe-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium text-sm"
                    placeholder={t('enterName')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 mx-1 uppercase tracking-wider">{t('phoneNumber')}</label>
                <div className="relative">
                  <Phone className="absolute start-3 top-3 text-slate-400" size={18} />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 ps-10 pe-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium text-sm"
                    placeholder="+1234567890"
                  />
                </div>
              </div>

              <div className={`space-y-1.5 ${isFamilyOwner ? '' : 'opacity-70'}`}>
                <label className="text-xs font-bold text-slate-700 mx-1 uppercase tracking-wider">{t('emailAddress')}</label>
                <div className="relative">
                  <Mail className="absolute start-3 top-3 text-slate-400" size={18} />
                  <input
                    type="email"
                    disabled
                    value={profile?.email || ""}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2.5 ps-10 pe-4 outline-none font-medium cursor-not-allowed text-sm"
                  />
                </div>
                {isFamilyOwner && (
                  <div className="flex items-center justify-between gap-3 px-1 pt-1">
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Only the family owner can change the login email.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowEmailChange(true)}
                      className="shrink-0 text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      Change email
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 mx-1 uppercase tracking-wider">{t('defaultRegion')}</label>
                <div className="relative">
                  <Globe className="absolute start-3 top-3 text-slate-400" size={18} />
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 ps-10 pe-4 focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium appearance-none text-sm"
                  >
                    <option value="DE">{t('germany')}</option>
                    <option value="BD">{t('bangladesh')}</option>
                    <option value="US">{t('unitedStates')}</option>
                    <option value="Global">{t('globalView')}</option>
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
                  {saving ? t('saving') : t('saveChanges')}
               </button>
            </div>
          </form>
        </section>

        <BillingInvoicesSection
          isFamilyOwner={Boolean(
            profile?.uid && family?.ownerId === profile.uid
          )}
        />

        <section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <Languages size={20} className="text-primary-500" />
            <h2 className="font-bold text-lg">{t('displayLanguage')}</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('languageHelp')}</p>
          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <LanguageSwitcher />
            {preference === 'auto' ? <p className="text-xs font-semibold text-primary-700">{t('autoActive', { language: t(locale === 'en' ? 'english' : locale === 'de' ? 'german' : locale === 'es' ? 'spanish' : locale === 'ar' ? 'arabic' : 'turkish') })}</p> : null}
          </div>
          <p className="mt-3 text-xs text-slate-400">{t('languageFallback')}</p>
        </section>

        {/* Notifications Section */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-900">
            <Bell size={20} className="text-primary-500" />
            <h2 className="font-bold text-lg">{t('notifications')}</h2>
          </div>
          <div className="space-y-3">
            <NotificationToggle
                label={t('safeZoneAlerts')} description={t('safeZoneHelp')}
                checked={notifSettings.safeZone}
                onChange={() => toggleNotif('safeZone')}
            />
            <NotificationToggle
                label={t('sosAlerts')} description={t('sosHelp')}
                checked={notifSettings.sos}
                onChange={() => toggleNotif('sos')}
            />
            <NotificationToggle
                label={t('batteryAlerts')} description={t('batteryHelp')}
                checked={notifSettings.battery}
                onChange={() => toggleNotif('battery')}
            />
            <NotificationToggle
                label={t('deviceAlerts')} description={t('deviceHelp')}
                checked={notifSettings.deviceStatus}
                onChange={() => toggleNotif('deviceStatus')}
            />
            <NotificationToggle
                label={t('appAlerts')} description={t('appHelp')}
                checked={notifSettings.appUsage}
                onChange={() => toggleNotif('appUsage')}
            />
            <NotificationToggle
                label={t('requestAlerts')} description={t('requestHelp')}
                checked={notifSettings.requestAlerts}
                onChange={() => toggleNotif('requestAlerts')}
            />
            <NotificationToggle
                label={t('permissionAlerts')} description={t('permissionHelp')}
                checked={notifSettings.permissionChanges}
                onChange={() => toggleNotif('permissionChanges')}
            />
            <NotificationToggle
                label={t('protectionAlerts')} description={t('protectionHelp')}
                checked={notifSettings.securityAlerts}
                onChange={() => toggleNotif('securityAlerts')}
            />
            <NotificationToggle
                label={t('syncAlerts')} description={t('syncHelp')}
                checked={notifSettings.syncErrors}
                onChange={() => toggleNotif('syncErrors')}
            />
            <NotificationToggle
                label={t('updateAlerts')} description={t('updateHelp')}
                checked={notifSettings.appUpdates}
                onChange={() => toggleNotif('appUpdates')}
            />
            <NotificationToggle
                label={t('pairingAlerts')} description={t('pairingHelp')}
                checked={notifSettings.pairing}
                onChange={() => toggleNotif('pairing')}
            />

            <button
                type="button"
                onClick={handleNotificationSave}
                disabled={saving}
                className="mt-4 w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? t('saving') : t('saveNotifications')}
            </button>

            <div className="mt-8 pt-6 border-t border-slate-100">
                <button
                    type="button"
                    onClick={async () => {
                        if (!profile) return;
                        const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
                        const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
                        if (isIos && !standalone) {
                          window.dispatchEvent(new Event('kidsguard:show-install-instructions'));
                          return;
                        }

                        const success = await NotificationRepository.registerDevice(
                          profile.uid,
                          window.navigator.userAgent.split(') ')[0].split(' (')[1] || "Web Browser",
                          locale
                        );
                        if (success) {
                          alert(translateUiText('Notifications are enabled on this device.', locale));
                        } else {
                          window.dispatchEvent(new Event('kidsguard:show-notification-help'));
                        }
                    }}
                    className="w-full sm:w-auto text-primary-600 font-bold hover:underline flex items-center justify-center gap-2 text-sm"
                >
                    <Smartphone size={16} />
                    {t('enablePush')}
                </button>
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new Event('kidsguard:show-notification-help'))}
                    className="mt-3 w-full sm:w-auto sm:ms-5 text-slate-600 font-bold hover:text-primary-600 hover:underline inline-flex items-center justify-center gap-2 text-sm"
                >
                    <Bell size={16} />
                    How to enable notifications
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
