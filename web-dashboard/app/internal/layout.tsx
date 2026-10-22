"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  InternalAdminProvider,
  useInternalAdmin,
} from "@/lib/context/InternalAdminContext";
import {
  canAccessInternalPath,
  defaultInternalPath,
} from "@/lib/platformAccess";

function InternalRouteGuard({ children }: { children: React.ReactNode }) {
  const { admin, loading, isAdmin } = useInternalAdmin();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/internal/login";
  const allowed = Boolean(
    admin && canAccessInternalPath(admin.role, pathname)
  );

  useEffect(() => {
    if (loading || isLogin) return;
    if (!isAdmin || !admin) {
      const returnTo = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`
      );
      router.replace(`/internal/login?returnTo=${returnTo}`);
      return;
    }
    if (!allowed) {
      router.replace(defaultInternalPath(admin.role));
    }
  }, [admin, allowed, isAdmin, isLogin, loading, router]);

  if (isLogin) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-rose-500/20 border-t-rose-500" />
        <p className="animate-pulse text-xs font-black uppercase tracking-[0.3em] text-rose-500">
          Platform security check
        </p>
      </div>
    );
  }
  if (!isAdmin || !admin || !allowed) return null;
  return <>{children}</>;
}

export default function InternalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InternalAdminProvider>
      <InternalRouteGuard>{children}</InternalRouteGuard>
    </InternalAdminProvider>
  );
}
