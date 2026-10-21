"use client";

import InternalLayout from '@/components/InternalLayout';
import {
    Activity,
    Zap,
    ArrowUpRight,
    MessageCircle,
    HeartPulse,
    UsersRound,
    WalletCards,
    type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useInternalAdmin } from '@/lib/context/InternalAdminContext';
import {
  isAccountingStaff,
  isFullPlatformAdmin,
  isSupportStaff,
} from '@/lib/platformAccess';

type DashboardCardData = {
  title: string;
  href: string;
  icon: LucideIcon;
  desc: string;
  color: string;
  visible: boolean;
};

export default function InternalDashboard() {
  const { admin } = useInternalAdmin();
  const role = admin?.role;
  const cards: DashboardCardData[] = [
    {
      title: "System Health",
      href: "/internal/health",
      icon: HeartPulse,
      desc: "Automated checks for devices, sync, permissions, alerts and support.",
      color: "text-cyan-500",
      visible: role ? isSupportStaff(role) : false,
    },
    {
      title: "System Analytics",
      href: "/internal/analytics",
      icon: Activity,
      desc: "Network health and family growth metrics.",
      color: "text-rose-500",
      visible: role ? isFullPlatformAdmin(role) : false,
    },
    {
      title: "App Releases",
      href: "/internal/releases",
      icon: Zap,
      desc: "Deploy new OTA updates to Android and Web.",
      color: "text-amber-500",
      visible: role ? isFullPlatformAdmin(role) : false,
    },
    {
      title: "Customer Support",
      href: "/internal/support",
      icon: MessageCircle,
      desc: "View and resolve parent help requests.",
      color: "text-emerald-500",
      visible: role ? isSupportStaff(role) : false,
    },
    {
      title: "Customers & Billing",
      href: "/internal/customers",
      icon: WalletCards,
      desc: "Review customer, subscription, and family information.",
      color: "text-indigo-400",
      visible: role ? isAccountingStaff(role) : false,
    },
    {
      title: "Team Access",
      href: "/internal/team",
      icon: UsersRound,
      desc: "Create employees and request owner-approved access changes.",
      color: "text-fuchsia-400",
      visible: role ? isFullPlatformAdmin(role) : false,
    },
  ];

  return (
    <InternalLayout>
      <header className="mb-12">
        <h1 className="text-4xl font-black text-white tracking-tight uppercase italic">Platform <span className="text-rose-500">Command</span></h1>
        <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Control Center • Internal Operations Only</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {cards.filter((card) => card.visible).map((card) => (
          <DashboardCard key={card.href} {...card} />
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-12 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10">
              <h2 className="text-2xl font-black text-white mb-4 uppercase italic italic">Security Governance</h2>
              <p className="text-slate-400 max-w-xl mb-8 font-medium leading-relaxed">
                  Your session is protected by TOTP and limited to the permissions assigned to your role.
                  Every new account, promotion, and reactivation requires Super Admin owner approval.
              </p>
              <div className="flex flex-wrap gap-4">
                  {role && isFullPlatformAdmin(role) ? (
                    <Link href="/internal/audit" className="bg-white text-slate-950 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                        Audit Logs
                    </Link>
                  ) : null}
                  <Link href="/internal/settings" className="px-8 py-3 border border-slate-700 rounded-2xl font-black text-xs text-slate-400 uppercase tracking-widest hover:text-white transition-all">
                      Internal Settings
                  </Link>
              </div>
          </div>
      </div>
    </InternalLayout>
  );
}

function DashboardCard({ title, href, icon: Icon, desc, color }: DashboardCardData) {
    return (
        <Link href={href} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] hover:border-rose-500/50 transition-all group flex flex-col gap-6 shadow-xl">
            <div className="flex justify-between items-start">
                <div className={`w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center border border-slate-800 group-hover:border-rose-500/20 transition-all ${color}`}>
                    <Icon size={28} />
                </div>
                <ArrowUpRight className="text-slate-700 group-hover:text-rose-500 transition-all" size={24} />
            </div>
            <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">{title}</h3>
                <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">{desc}</p>
            </div>
        </Link>
    )
}
