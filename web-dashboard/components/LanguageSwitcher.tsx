"use client";

import { useId } from "react";
import { Languages } from "lucide-react";
import { LanguagePreference, useLanguage } from "@/lib/i18n/LanguageContext";

export default function LanguageSwitcher({ theme = "light", showLabel = false, className = "" }: { theme?: "light" | "dark"; showLabel?: boolean; className?: string }) {
  const id = useId();
  const { preference, setPreference, t } = useLanguage();
  const dark = theme === "dark";
  return (
    <div className={`flex min-h-11 items-center gap-2 rounded-2xl border px-3 ${dark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f]"} ${className}`}>
      <Languages size={17} aria-hidden="true" className={dark ? "text-slate-400" : "text-[#6e6e73]"} />
      {showLabel ? <span className="hidden text-xs font-bold sm:inline">{t("language")}</span> : null}
      <label htmlFor={id} className="sr-only">{t("language")}</label>
      <select id={id} value={preference} onChange={(event) => setPreference(event.target.value as LanguagePreference)} className={`min-w-0 cursor-pointer border-none bg-transparent text-xs font-bold outline-none ${dark ? "text-slate-200" : "text-[#1d1d1f]"}`}>
        <option value="auto">🌐 {t("auto")}</option>
        <option value="en">🇬🇧 English</option>
        <option value="de">🇩🇪 Deutsch</option>
        <option value="es">🇪🇸 Español</option>
        <option value="ar">🇸🇦 العربية</option>
      </select>
    </div>
  );
}
