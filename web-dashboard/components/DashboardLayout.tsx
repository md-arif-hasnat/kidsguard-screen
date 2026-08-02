"use client";

import React, {
  useEffect,
  useState,
} from "react";
import Sidebar from "./Sidebar";
import PWAInstallBanner from "./PWAInstallBanner";
import PWAUpdateBanner from "./PWAUpdateBanner";
import NotificationPrompt from "./NotificationPrompt";
import {
  Bell,
  Search,
  Menu,
  Sun,
  Moon,
  Languages,
} from "lucide-react";
import {
  NotificationRepository,
} from "@/lib/repositories/NotificationRepository";
import {
  useParentProfile,
  getDisplayName,
  getAvatarUrl,
} from "@/lib/context/ParentProfileContext";
import Link from "next/link";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type ThemeMode = "light" | "dark";
type LanguageCode = "en" | "de";

const THEME_STORAGE_KEY =
  "kidsguard-dashboard-theme";

const LANGUAGE_STORAGE_KEY =
  "kidsguard-dashboard-language";

const translations = {
  en: {
    search: "Search...",
    notifications: "Notifications",
    settings: "Settings",
    openMenu: "Open menu",
    lightMode: "Use light mode",
    darkMode: "Use dark mode",
    language: "Language",
    account: "ACCOUNT",
  },

  de: {
    search: "Suchen...",
    notifications: "Benachrichtigungen",
    settings: "Einstellungen",
    openMenu: "Menü öffnen",
    lightMode: "Hellen Modus verwenden",
    darkMode: "Dunklen Modus verwenden",
    language: "Sprache",
    account: "KONTO",
  },
} as const;

const DashboardLayout: React.FC<
  DashboardLayoutProps
> = ({ children }) => {
  const [unreadCount, setUnreadCount] =
    useState(0);

  const {
    profile,
    family,
    role,
  } = useParentProfile();

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(false);

  const [
    theme,
    setTheme,
  ] = useState<ThemeMode>("light");

  const [
    language,
    setLanguage,
  ] = useState<LanguageCode>("en");

  const [
    settingsLoaded,
    setSettingsLoaded,
  ] = useState(false);

  const text = translations[language];

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        THEME_STORAGE_KEY
      ) as ThemeMode | null;

    const savedLanguage =
      window.localStorage.getItem(
        LANGUAGE_STORAGE_KEY
      ) as LanguageCode | null;

    if (
      savedTheme === "light" ||
      savedTheme === "dark"
    ) {
      setTheme(savedTheme);
    }

    if (
      savedLanguage === "en" ||
      savedLanguage === "de"
    ) {
      setLanguage(savedLanguage);
    }

    setSettingsLoaded(true);
  }, []);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    const root =
      document.documentElement;

    root.classList.toggle(
      "dark",
      theme === "dark"
    );

    root.style.colorScheme = theme;

    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      theme
    );
  }, [theme, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    document.documentElement.lang =
      language;

    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      language
    );
  }, [language, settingsLoaded]);

  useEffect(() => {
    if (!profile?.uid) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe =
      NotificationRepository
        .listenToUnreadCount(
          profile.uid,
          setUnreadCount
        );

    return () => unsubscribe();
  }, [profile?.uid]);

  useEffect(() => {
    if (profile && family) {
      console.log(
        "RBAC DEBUG [Header]:",
        {
          uid: profile.uid,
          familyId: family.familyId,
          ownerId: family.ownerId,
          resolvedRole: role,
          displayName:
            profile.displayName,
        }
      );
    }
  }, [profile, family, role]);

  const displayName =
    getDisplayName(
      profile,
      profile?.email
    );

  const avatarUrl =
    getAvatarUrl(profile);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "light"
        ? "dark"
        : "light"
    );
  };

  const handleLanguageChange = (
    event:
      React.ChangeEvent<HTMLSelectElement>
  ) => {
    setLanguage(
      event.target.value as LanguageCode
    );
  };

  return (
    <div
      className="
        flex min-h-screen overflow-x-hidden
        bg-[#f5f5f7] text-[#1d1d1f]
        transition-colors duration-300
        dark:bg-[#111113]
        dark:text-[#f5f5f7]
      "
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() =>
          setIsSidebarOpen(false)
        }
      />

      <div
        className="
          flex min-w-0 flex-1 flex-col
          lg:ml-64
        "
      >
        <header
          className="
            fixed left-0 right-0 top-0
            z-[1000]
            flex h-20 items-center
            justify-between
            border-b border-[#e5e5e7]
            bg-white/95
            px-4
            pt-[env(safe-area-inset-top)]
            box-content
            backdrop-blur-xl
            transition-colors duration-300

            md:px-8

            lg:sticky
            lg:top-0
            lg:z-30
            lg:box-border
            lg:pt-0

            dark:border-[#2c2c2e]
            dark:bg-[#1c1c1e]/95
          "
        >
          <div
            className="
              hidden items-center
              md:flex
            "
          >
            <div
              className="
                flex w-64 items-center gap-3
                rounded-2xl
                border border-[#e5e5e7]
                bg-[#f5f5f7]
                px-4 py-2.5

                lg:w-96

                dark:border-[#343437]
                dark:bg-[#2c2c2e]
              "
            >
              <Search
                size={18}
                className="
                  text-[#86868b]
                "
              />

              <input
                type="text"
                placeholder={text.search}
                className="
                  w-full border-none
                  bg-transparent
                  text-sm font-medium
                  text-[#1d1d1f]
                  outline-none
                  placeholder:text-[#86868b]

                  dark:text-[#f5f5f7]
                "
              />
            </div>
          </div>

          <div
            className="
              flex flex-1 items-center
              justify-end gap-2

              md:gap-3
            "
          >
            <div
              className="
                hidden lg:block
                lg:mr-2
              "
            >
              <img
                src="/navbar-logo.png"
                alt="KidsGuard"
                className="h-8 w-auto"
              />
            </div>

            <div
              className="
                flex h-11 items-center gap-2
                rounded-2xl
                border border-[#e5e5e7]
                bg-[#f5f5f7]
                px-3

                dark:border-[#343437]
                dark:bg-[#2c2c2e]
              "
            >
              <Languages
                size={17}
                className="
                  text-[#6e6e73]
                  dark:text-[#aeaeb2]
                "
              />

              <label
                htmlFor="dashboard-language"
                className="sr-only"
              >
                {text.language}
              </label>

              <select
                id="dashboard-language"
                value={language}
                onChange={
                  handleLanguageChange
                }
                className="
                  cursor-pointer appearance-none
                  border-none bg-transparent
                  pr-1 text-xs font-bold
                  text-[#1d1d1f]
                  outline-none

                  dark:text-[#f5f5f7]
                "
              >
                <option value="en">
                  EN
                </option>

                <option value="de">
                  DE
                </option>
              </select>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? text.darkMode
                  : text.lightMode
              }
              title={
                theme === "light"
                  ? text.darkMode
                  : text.lightMode
              }
              className="
                flex h-11 w-11
                items-center justify-center
                rounded-2xl
                border border-[#e5e5e7]
                bg-[#f5f5f7]
                text-[#1d1d1f]
                transition-all
                hover:bg-[#ebebed]

                dark:border-[#343437]
                dark:bg-[#2c2c2e]
                dark:text-[#f5f5f7]
                dark:hover:bg-[#3a3a3c]
              "
            >
              {theme === "light" ? (
                <Moon size={19} />
              ) : (
                <Sun size={19} />
              )}
            </button>

            <Link
              href="/notifications"
              aria-label={
                text.notifications
              }
              title={text.notifications}
              className="
                relative flex h-11 w-11
                items-center justify-center
                rounded-2xl
                border border-[#e5e5e7]
                bg-[#f5f5f7]
                text-[#6e6e73]
                transition-all
                hover:bg-[#ebebed]
                hover:text-[#0071e3]

                dark:border-[#343437]
                dark:bg-[#2c2c2e]
                dark:text-[#d1d1d6]
                dark:hover:bg-[#3a3a3c]
              "
            >
              <Bell size={20} />

              {unreadCount > 0 && (
                <span
                  className="
                    absolute -right-1 -top-1
                    flex h-5 min-w-5
                    items-center justify-center
                    rounded-full
                    border-2 border-white
                    bg-[#ff3b30]
                    px-1
                    text-[10px] font-black
                    text-white shadow-sm

                    dark:border-[#1c1c1e]
                  "
                >
                  {unreadCount > 9
                    ? "9+"
                    : unreadCount}
                </span>
              )}
            </Link>

            <Link
              href="/settings"
              aria-label={text.settings}
              title={text.settings}
              className="
                flex items-center gap-3
                rounded-2xl
                border border-[#e5e5e7]
                bg-[#f5f5f7]
                p-1.5
                transition-all
                hover:bg-[#ebebed]

                md:pr-4

                dark:border-[#343437]
                dark:bg-[#2c2c2e]
                dark:hover:bg-[#3a3a3c]
              "
            >
              <div
                className="
                  flex h-9 w-9
                  items-center justify-center
                  overflow-hidden
                  rounded-xl
                  bg-[#e8f2ff]
                  font-bold text-[#0071e3]

                  dark:bg-[#16324f]
                  dark:text-[#64a8ff]
                "
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="
                      h-full w-full
                      object-cover
                    "
                  />
                ) : (
                  displayName
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>

              <div
                className="
                  hidden text-left
                  xl:block
                "
              >
                <p
                  className="
                    text-xs font-bold
                    leading-none
                    text-[#1d1d1f]

                    dark:text-[#f5f5f7]
                  "
                >
                  {displayName}
                </p>

                <p
                  className="
                    mt-1 text-[10px]
                    font-black uppercase
                    tracking-wider
                    text-[#0071e3]
                  "
                >
                  {role} {text.account}
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() =>
                setIsSidebarOpen(true)
              }
              aria-label={text.openMenu}
              title={text.openMenu}
              className="
                flex h-11 w-11
                items-center justify-center
                rounded-2xl
                border border-[#e5e5e7]
                bg-[#f5f5f7]
                text-[#1d1d1f]
                transition-all
                hover:bg-[#ebebed]

                lg:hidden

                dark:border-[#343437]
                dark:bg-[#2c2c2e]
                dark:text-[#f5f5f7]
                dark:hover:bg-[#3a3a3c]
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

          <main
            className="
              min-h-full
              bg-[#f5f5f7]
              p-4
              transition-colors
              duration-300

              md:p-8

              dark:bg-[#111113]
            "
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;