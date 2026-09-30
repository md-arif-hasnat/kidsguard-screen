"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Share, X } from "lucide-react";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import { useInternalAdmin } from "@/lib/context/InternalAdminContext";

function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function AdminPushPrompt() {
  const { admin } = useInternalAdmin();
  const [visible, setVisible] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!admin || !("Notification" in window)) return;
    const iosNeedsInstall = isIosDevice() && !isStandalone();
    setNeedsInstall(iosNeedsInstall);

    if (Notification.permission === "granted") {
      void NotificationRepository.registerDevice(admin.uid, "Admin iPhone PWA");
      return;
    }

    if (Notification.permission !== "denied") setVisible(true);
  }, [admin]);

  useEffect(() => {
    return NotificationRepository.listenForForegroundMessages(payload => {
      if (Notification.permission !== "granted") return;
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon: "/app-icon.png",
        badge: "/symbol.png",
        data: { url: payload.url }
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign(payload.url);
        notification.close();
      };
    });
  }, []);

  const enable = async () => {
    if (!admin) return;
    setEnabling(true);
    const success = await NotificationRepository.registerDevice(
      admin.uid,
      "Admin iPhone PWA"
    );
    setEnabling(false);
    if (success) {
      setEnabled(true);
      window.setTimeout(() => setVisible(false), 1800);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-slate-900 p-4 text-white shadow-2xl shadow-black/60">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-rose-500/15 p-2.5 text-rose-400">
          {needsInstall ? <Share size={20} /> : enabled ? <CheckCircle2 size={20} /> : <Bell size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">
            {needsInstall
              ? "Install KidsGuard Admin first"
              : enabled
                ? "Lock-screen notifications enabled"
                : "Enable admin push notifications"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {needsInstall
              ? "In Safari tap Share, then Add to Home Screen. Open the installed app and enable notifications."
              : enabled
                ? "New issues, support messages and device warnings will appear on this iPhone."
                : "Receive immediate iPhone alerts for new issues, support messages and device warnings."}
          </p>
          {!needsInstall && !enabled && (
            <button
              type="button"
              onClick={enable}
              disabled={enabling}
              className="mt-3 rounded-lg bg-rose-500 px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors hover:bg-rose-400 disabled:opacity-60"
            >
              {enabling ? "Enabling..." : "Enable Notifications"}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label="Close notification setup"
          onClick={() => setVisible(false)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
