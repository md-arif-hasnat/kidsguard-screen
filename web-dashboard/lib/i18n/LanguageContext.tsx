"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import { ParentRepository } from "@/lib/repositories/ParentRepository";
import { ar, de, en, es, MessageKey } from "./messages";

export type Locale = "en" | "de" | "es" | "ar";
export type LanguagePreference = "auto" | Locale;

const STORAGE_KEY = "kidsguard-language-preference";
const LEGACY_KEY = "kidsguard-dashboard-language";
const dictionaries = { en, de, es, ar };

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === "auto" || value === "en" || value === "de" || value === "es" || value === "ar";

const detectLocale = (): Locale => {
  if (typeof navigator === "undefined") return "en";
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const language = candidate?.toLowerCase().split("-")[0];
    if (language === "de" || language === "es" || language === "ar" || language === "en") return language;
  }
  return "en";
};

interface LanguageValue {
  preference: LanguagePreference;
  locale: Locale;
  direction: "ltr" | "rtl";
  setPreference: (value: LanguagePreference) => void;
  t: (key: MessageKey, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useParentProfile();
  const [preference, setPreferenceState] = useState<LanguagePreference>("auto");
  const [deviceLocale, setDeviceLocale] = useState<Locale>("en");
  const [ready, setReady] = useState(false);
  const syncedUid = useRef<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    setPreferenceState(isLanguagePreference(stored) ? stored : "auto");
    setDeviceLocale(detectLocale());
    setReady(true);
  }, []);

  const setPreference = useCallback((value: LanguagePreference) => {
    setPreferenceState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    window.localStorage.removeItem(LEGACY_KEY);
    if (profile?.uid) {
      void ParentRepository.updateProfile(profile.uid, { preferredLanguage: value }).catch((error) =>
        console.warn("Could not sync language preference:", error)
      );
    }
  }, [profile?.uid]);

  useEffect(() => {
    if (!ready || !profile?.uid || syncedUid.current === profile.uid) return;
    syncedUid.current = profile.uid;
    if (isLanguagePreference(profile.preferredLanguage)) {
      setPreferenceState(profile.preferredLanguage);
      window.localStorage.setItem(STORAGE_KEY, profile.preferredLanguage);
    } else {
      void ParentRepository.updateProfile(profile.uid, { preferredLanguage: preference }).catch((error) =>
        console.warn("Could not initialize language preference:", error)
      );
    }
  }, [preference, profile?.preferredLanguage, profile?.uid, ready]);

  const locale = preference === "auto" ? deviceLocale : preference;
  const direction: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    document.documentElement.dataset.languagePreference = preference;
  }, [direction, locale, preference, ready]);

  const t = useCallback((key: MessageKey, variables: Record<string, string | number> = {}) => {
    const template = dictionaries[locale][key] ?? en[key] ?? key;
    return Object.entries(variables).reduce(
      (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
      template
    );
  }, [locale]);

  const value = useMemo(() => ({ preference, locale, direction, setPreference, t }), [direction, locale, preference, setPreference, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used within LanguageProvider");
  return value;
}
