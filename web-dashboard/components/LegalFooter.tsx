import Link from "next/link";

interface LegalFooterProps {
  dark?: boolean;
}

export default function LegalFooter({ dark = false }: LegalFooterProps) {
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
        aria-label="Legal information"
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold"
      >
        <Link href="/impressum" className={linkClass}>
          Impressum
        </Link>
        <Link href="/privacy" className={linkClass}>
          Privacy Policy
        </Link>
        <Link href="/terms" className={linkClass}>
          Terms of Service
        </Link>
        <Link href="/manage-subscription" className={linkClass}>
          Manage Subscription
        </Link>
        <Link href="/delete-account" className={linkClass}>
          Delete Account
        </Link>
      </nav>
      <p
        className={
          dark
            ? "mt-3 text-center text-[10px] text-slate-600"
            : "mt-3 text-center text-[10px] text-slate-400"
        }
      >
        © 2026 KidsGuard · Operated by United Foreign Trade, Bangladesh
      </p>
    </footer>
  );
}
