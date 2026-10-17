"use client";

import Link from "next/link";
import { useParentProfile } from "@/lib/context/ParentProfileContext";
import { FamilyRole } from "@/lib/repositories/FamilyRepository";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface LegalFooterProps {
  dark?: boolean;
}

export default function LegalFooter({ dark = false }: LegalFooterProps) {
  const { role } = useParentProfile();
  const { t } = useLanguage();
  const canManageSubscription = role === FamilyRole.OWNER;
  const linkClass = dark
    ? "text-slate-400 transition-colors hover:text-white hover:underline"
    : "text-slate-500 transition-colors hover:text-blue-600 hover:underline";

  return (
    <footer
      className={
        dark
          ? "border-t border-slate-800 bg-slate-950 px-4 py-6"
          : "border-t border-slate-200 bg-white px-4 py-5"
      }
    >
      <nav
        aria-label={t("legalInformation")}
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold"
      >
        <Link href="/impressum" className={linkClass}>
          {t("impressum")}
        </Link>
        <Link href="/privacy" className={linkClass}>
          {t("privacyPolicy")}
        </Link>
        <Link href="/child-privacy" className={linkClass}>
          {t("childPrivacy")}
        </Link>
        <Link href="/terms" className={linkClass}>
          {t("terms")}
        </Link>
        {canManageSubscription && (
          <Link href="/manage-subscription" className={linkClass}>
            {t("manageSubscription")}
          </Link>
        )}
        <Link href="/delete-account" className={linkClass}>
          {t("deleteAccount")}
        </Link>
      </nav>
      <p
        className={
          dark
            ? "mt-3 text-center text-[10px] text-slate-600"
            : "mt-3 text-center text-[10px] text-slate-400"
        }
      >
        {t("operator")}
      </p>
    </footer>
  );
}
