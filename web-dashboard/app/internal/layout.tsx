"use client";

import { InternalAdminProvider } from "@/lib/context/InternalAdminContext";

export default function InternalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InternalAdminProvider>
      {children}
    </InternalAdminProvider>
  );
}
