import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ParentProfileProvider } from "@/lib/context/ParentProfileContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KidsGuard Parent Dashboard",
  description: "Enterprise-grade family safety and child protection dashboard.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "KidsGuard",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-900`}>
        <ParentProfileProvider>
            {children}
        </ParentProfileProvider>
      </body>
    </html>
  );
}
