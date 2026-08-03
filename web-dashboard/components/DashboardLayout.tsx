"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import PWAInstallBanner from "./PWAInstallBanner";
import PWAUpdateBanner from "./PWAUpdateBanner";
import NotificationPrompt from "./NotificationPrompt";
import { Bell, Search, Menu, ArrowLeft, Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationRepository } from "@/lib/repositories/NotificationRepository";
import {
  useParentProfile,
  getDisplayName,
  getAvatarUrl,
} from "@/lib/context/ParentProfileContext";
import Link from "next/link";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type LanguageCode = "en" | "de";

const LANGUAGE_STORAGE_KEY = "kidsguard-dashboard-language";

const translations = {
  en: {
    search: "Search...",
    notifications: "Notifications",
    settings: "Settings",
    openMenu: "Open menu",
    language: "Language",
    account: "ACCOUNT",
  },
  de: {
    search: "Suchen...",
    notifications: "Benachrichtigungen",
    settings: "Einstellungen",
    openMenu: "Menü öffnen",
    language: "Sprache",
    account: "KONTO",
  },
} as const;

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
      const router = useRouter();
      const pathname = usePathname();

      const showBackButton =
        pathname !== "/" &&
        pathname !== "/dashboard";
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const { profile, family, role } = useParentProfile();
  const text = translations[language];

  useEffect(() => {
    // Night mode পুরোপুরি বন্ধ রাখবে
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";

    const savedLanguage = window.localStorage.getItem(
      LANGUAGE_STORAGE_KEY
    ) as LanguageCode | null;

    if (savedLanguage === "en" || savedLanguage === "de") {
      setLanguage(savedLanguage);
    }

    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language, settingsLoaded]);

  useEffect(() => {
    if (!profile?.uid) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = NotificationRepository.listenToUnreadCount(
      profile.uid,
      setUnreadCount
    );

    return () => unsubscribe();
  }, [profile?.uid]);

  useEffect(() => {
    if (profile && family) {
      console.log("RBAC DEBUG [Header]:", {
        uid: profile.uid,
        familyId: family.familyId,
        ownerId: family.ownerId,
        resolvedRole: role,
        displayName: profile.displayName,
      });
    }
  }, [profile, family, role]);

  const displayName = getDisplayName(profile, profile?.email);
  const avatarUrl = getAvatarUrl(profile);

  const handleLanguageChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setLanguage(event.target.value as LanguageCode);
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header
          className="
            fixed left-0 right-0 top-0 z-[1000]
            flex h-20 items-center justify-between
            border-b border-[#e5e5e7]
            bg-white/95 px-4
            pt-[env(safe-area-inset-top)]
            box-content backdrop-blur-xl
            md:px-8
            lg:sticky lg:top-0 lg:z-30 lg:box-border lg:pt-0
          "
        >
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            {showBackButton && (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Go back"
                title="Back"
                className="
                  flex h-11 w-11 shrink-0
                  items-center justify-center
                  rounded-2xl border border-[#e5e5e7]
                  bg-[#f5f5f7] text-[#1d1d1f]
                  transition-all
                  hover:bg-[#ebebed]
                  hover:text-[#0071e3]
                  active:scale-95
                "
              >
                <ArrowLeft size={21} />
              </button>
            )}
          
            <div
              className="
                hidden w-64 items-center gap-3
                rounded-2xl border border-[#e5e5e7]
                bg-[#f5f5f7] px-4 py-2.5
                md:flex lg:w-80 xl:w-96
              "
            >
              <Search size={18} className="shrink-0 text-[#86868b]" />

              <input
                type="text"
                placeholder={text.search}
                className="
                  min-w-0 flex-1 border-none bg-transparent
                  text-sm font-medium text-[#1d1d1f]
                  outline-none placeholder:text-[#86868b]
                "
              />
            </div>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">


            <div
              className="
                flex h-11 items-center gap-2
                rounded-2xl border border-[#e5e5e7]
                bg-[#f5f5f7] px-3
              "
            >
              <Languages size={17} className="text-[#6e6e73]" />

              <label htmlFor="dashboard-language" className="sr-only">
                {text.language}
              </label>

              <select
                id="dashboard-language"
                value={language}
                onChange={handleLanguageChange}
                className="
                  cursor-pointer border-none
                  bg-transparent text-xs font-bold
                  text-[#1d1d1f] outline-none
                "
              >
                <option value="en">🇬🇧 EN</option>
                <option value="de">🇩🇪 DE</option>
              </select>
            </div>

            <Link
              href="/notifications"
              aria-label={text.notifications}
              title={text.notifications}
              className="
                relative flex h-11 w-11
                items-center justify-center
                rounded-2xl border border-[#e5e5e7]
                bg-[#f5f5f7] text-[#6e6e73]
                transition-all hover:bg-[#ebebed]
                hover:text-[#0071e3]
              "
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span
                  className="
                    absolute -right-1 -top-1
                    flex h-5 min-w-5 items-center justify-center
                    rounded-full border-2 border-white
                    bg-[#ff3b30] px-1
                    text-[10px] font-black text-white shadow-sm
                  "
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <Link
              href="/settings"
              aria-label={text.settings}
              title={text.settings}
              className="
                flex items-center gap-3 rounded-2xl
                border border-[#e5e5e7]
                bg-[#f5f5f7] p-1.5
                transition-all hover:bg-[#ebebed]
                md:pr-4
              "
            >
              <div
                className="
                  flex h-9 w-9 items-center justify-center
                  overflow-hidden rounded-xl
                  bg-[#e8f2ff] font-bold text-[#0071e3]
                "
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>

              <div className="hidden text-left xl:block">
                <p className="text-xs font-bold leading-none text-[#1d1d1f]">
                  {displayName}
                </p>

                <p
                  className="
                    mt-1 text-[10px] font-black uppercase
                    tracking-wider text-[#0071e3]
                  "
                >
                  {role} {text.account}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label={text.openMenu}
              title={text.openMenu}
              className="
                flex h-11 w-11 items-center justify-center
                rounded-2xl border border-[#e5e5e7]
                bg-[#f5f5f7] text-[#1d1d1f]
                transition-all hover:bg-[#ebebed]
                lg:hidden
              "
            >
              <Menu size={22} />
            </button>
          </div>
        </header>

        <div
          className="
            flex flex-1 flex-col
            pt-[calc(5rem+env(safe-area-inset-top))]
            lg:pt-0
          "
        >
          <NotificationPrompt />
          <PWAInstallBanner />
          <PWAUpdateBanner />

          <main className="min-h-full bg-[#f5f5f7] p-4 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;