import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ParentProfileProvider } from "@/lib/context/ParentProfileContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KidsGuard Parent Dashboard",
  description: "Monitor and manage your children's safety",
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
