import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ParentProfileProvider } from "@/lib/context/ParentProfileContext";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://kidsguard-screen.vercel.app"
  ),
  title: {
    default: "KidsGuard - Protect • Guide • Grow",
    template: "%s | KidsGuard"
  },
  description: "Enterprise-grade family safety and child protection dashboard.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "KidsGuard",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    type: "website",
    siteName: "KidsGuard",
    title: "KidsGuard - Family Safety Platform",
    description: "Protect • Guide • Grow. The complete family safety platform.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "KidsGuard - Protect • Guide • Grow",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KidsGuard - Family Safety Platform",
    description: "Protect • Guide • Grow. The complete family safety platform.",
    images: ["/og-image.png"],
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
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ParentProfileProvider>
      </body>
    </html>
  );
}
