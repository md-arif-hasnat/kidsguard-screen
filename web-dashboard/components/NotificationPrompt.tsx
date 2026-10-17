"use client";

import React, { useEffect, useState } from "react";
import { Bell, CheckCircle2, HelpCircle, Share, X } from "lucide-react";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { translateUiText } from "@/lib/i18n/uiTranslations";

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function NotificationPrompt() {
  const { profile } = useParentProfile();
  const { locale } = useLanguage();
  const [show, setShow] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const tr = (source: string) => translateUiText(source, locale);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const dismissed = sessionStorage.getItem("notif_prompt_dismissed");
        if (!dismissed) setShow(true);
      }
    }
  }, []);

  useEffect(() => {
    const openHelp = () => setShowHelp(true);
    window.addEventListener("kidsguard:show-notification-help", openHelp);
    return () => window.removeEventListener("kidsguard:show-notification-help", openHelp);
  }, []);

  useEffect(() => {
    return NotificationRepository.listenForForegroundMessages(payload => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: "/icon.png",
        badge: "/symbol.png",
        data: { url: payload.url },
      });

      notification.onclick = () => {
        window.focus();
        window.location.assign(payload.url);
        notification.close();
      };
    });
  }, []);

  const handleEnable = async () => {
    if (!profile) return;

    if (isIosDevice() && !isStandalone()) {
      setShowHelp(false);
      window.dispatchEvent(new Event("kidsguard:show-install-instructions"));
      return;
    }

    setFailed(false);
    const success = await NotificationRepository.registerDevice(
      profile.uid,
      window.navigator.userAgent.split(") ")[0].split(" (")[1] || "Web Browser",
      locale
    );

    if (success) {
      setEnabled(true);
      setShowHelp(true);
      setShow(false);
    } else {
      setFailed(true);
      setShowHelp(true);
    }
  };

  if (!show && !showHelp) return null;

  const iosNeedsInstall = isIosDevice() && !isStandalone();
  const permissionDenied = "Notification" in window && Notification.permission === "denied";

  return (
    <>
      {show && (
        <div className="bg-primary-600 text-white px-4 py-3 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4 animate-in slide-in-from-top duration-500">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg bg-white/20 p-2">
              <Bell size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">{tr("Stay Alert")}</p>
              <p className="text-xs text-primary-100">{tr("Enable push notifications to receive instant SOS and safety alerts.")}</p>
            </div>
          </div>
          <div className="flex flex-wrap shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/10"
            >
              <HelpCircle size={15} />
              {tr("How to enable notifications")}
            </button>
            <button
              type="button"
              onClick={handleEnable}
              className="rounded-lg bg-white px-4 py-1.5 text-xs font-black uppercase tracking-widest text-primary-600 shadow-sm transition-colors hover:bg-primary-50"
            >
              {tr("Enable Now")}
            </button>
            <button
              type="button"
              aria-label={tr("Close")}
              onClick={() => {
                setShow(false);
                sessionStorage.setItem("notif_prompt_dismissed", "true");
              }}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-help-title"
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            dir={locale === "ar" ? "rtl" : "ltr"}
          >
            <button
              type="button"
              aria-label={tr("Close")}
              onClick={() => setShowHelp(false)}
              className="absolute end-5 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={20} />
            </button>

            <div className="mb-5 flex items-center gap-3 pe-10">
              <div className={`rounded-2xl p-3 ${enabled ? "bg-emerald-100 text-emerald-600" : "bg-primary-100 text-primary-600"}`}>
                {enabled ? <CheckCircle2 size={24} /> : iosNeedsInstall ? <Share size={24} /> : <Bell size={24} />}
              </div>
              <div>
                <h2 id="notification-help-title" className="text-xl font-black text-slate-900">{tr("How to enable notifications")}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {enabled
                    ? tr("Notifications are enabled on this device.")
                    : failed
                      ? tr("Notifications could not be enabled. Follow the steps below and try again.")
                      : tr("Enable push notifications to receive instant SOS and safety alerts.")}
                </p>
              </div>
            </div>

            {!enabled && (
              <div className="space-y-4">
                {iosNeedsInstall ? (
                  <>
                    <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
                      {tr("On iPhone or iPad, add KidsGuard to the Home Screen before enabling notifications.")}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowHelp(false);
                        window.dispatchEvent(new Event("kidsguard:show-install-instructions"));
                      }}
                      className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
                    >
                      {tr("Open the Home Screen guide")}
                    </button>
                  </>
                ) : isIosDevice() ? (
                  <InstructionList items={[
                    tr("Open KidsGuard from your Home Screen."),
                    tr("Tap Enable Notifications, then choose Allow."),
                    ...(permissionDenied ? [tr("If permission was blocked, open iPhone Settings → Notifications → KidsGuard and turn on Allow Notifications.")] : []),
                  ]} />
                ) : (
                  <InstructionList items={[
                    tr("Tap Enable Notifications and choose Allow in the browser prompt."),
                    ...(permissionDenied ? [tr("If permission was blocked, open your browser's site settings, select Notifications, and allow this site.")] : []),
                    tr("Notifications need a supported browser and a secure connection."),
                  ]} />
                )}

                {!iosNeedsInstall && (
                  <button
                    type="button"
                    onClick={handleEnable}
                    className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-black text-white hover:bg-primary-700"
                  >
                    {tr(failed ? "Try Again" : "Enable Notifications")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InstructionList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-black text-primary-700">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
