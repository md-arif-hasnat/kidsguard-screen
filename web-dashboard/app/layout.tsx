import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ParentProfileProvider } from "@/lib/context/ParentProfileContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "KidsGuard - Protect • Guide • Grow",
    template: "%s | KidsGuard"
  },
  description: "Enterprise-grade family safety and child protection dashboard.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "KidsGuard",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "KidsGuard",
    title: "KidsGuard - Family Safety Platform",
    description: "Protect • Guide • Grow. The complete family safety platform.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KidsGuard - Family Safety Platform",
    description: "Protect • Guide • Grow. The complete family safety platform.",
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
