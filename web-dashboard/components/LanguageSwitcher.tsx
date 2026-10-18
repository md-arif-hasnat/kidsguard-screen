"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { LanguagePreference, useLanguage } from "@/lib/i18n/LanguageContext";

type LanguageLabelKey = "auto" | "english" | "german" | "spanish" | "arabic";

const LANGUAGE_OPTIONS: Array<{
  value: LanguagePreference;
  flag: string;
  labelKey: LanguageLabelKey;
}> = [
  { value: "auto", flag: "🌐", labelKey: "auto" },
  { value: "en", flag: "🇬🇧", labelKey: "english" },
  { value: "de", flag: "🇩🇪", labelKey: "german" },
  { value: "es", flag: "🇪🇸", labelKey: "spanish" },
  { value: "ar", flag: "🇸🇦", labelKey: "arabic" },
];

export default function LanguageSwitcher({
  theme = "light",
  menuAlign = "end",
  className = "",
}: {
  theme?: "light" | "dark";
  menuAlign?: "end" | "right";
  className?: string;
}) {
  const { preference, setPreference, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dark = theme === "dark";
  const activeOption = LANGUAGE_OPTIONS.find((option) => option.value === preference) ?? LANGUAGE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const chooseLanguage = (value: LanguagePreference) => {
    setPreference(value);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("language")}: ${t(activeOption.labelKey)}`}
        title={`${t("language")}: ${t(activeOption.labelKey)}`}
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 w-12 items-center justify-center gap-1 rounded-xl border shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
          dark
            ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            : "border-slate-200 bg-white text-slate-700 hover:border-primary-300 hover:bg-primary-50"
        } ${open ? "border-primary-400 ring-2 ring-primary-500/15" : ""}`}
      >
        <span aria-hidden="true" className="text-lg leading-none">{activeOption.flag}</span>
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("language")}
          className={`absolute top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border p-2 shadow-2xl backdrop-blur-xl ${menuAlign === "right" ? "right-0" : "end-0"} ${
            dark
              ? "border-slate-700 bg-slate-950/95 text-slate-100 shadow-black/40"
              : "border-slate-200 bg-white/95 text-slate-900 shadow-slate-900/15"
          }`}
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const selected = option.value === preference;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => chooseLanguage(option.value)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                  selected
                    ? dark
                      ? "bg-primary-500/15 text-primary-300"
                      : "bg-primary-50 text-primary-700"
                    : dark
                      ? "text-slate-300 hover:bg-slate-800 hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-xl shadow-sm">
                  {option.flag}
                </span>
                <span className="min-w-0 flex-1 truncate">{t(option.labelKey)}</span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selected ? "bg-primary-600 text-white" : "text-transparent"}`}>
                  <Check size={12} strokeWidth={3} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
