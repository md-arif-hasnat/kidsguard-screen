"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Zap,
  Users,
  Home,
  Smartphone,
  MessageSquare,
  AlertCircle,
  HeartPulse,
  ClipboardList,
  TicketPercent,
  ReceiptText,
  Settings,
  UserRoundCog,
  ShieldAlert,
  LogOut,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { signOutInternalSession } from '@/lib/internalSessionSecurity';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useInternalAdmin } from '@/lib/context/InternalAdminContext';
import {
  isAccountingStaff,
  isFullPlatformAdmin,
  isSupportStaff,
} from '@/lib/platformAccess';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface InternalSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const InternalSidebar: React.FC<InternalSidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { direction, t } = useLanguage();
  const { admin } = useInternalAdmin();
  const [notificationCounts, setNotificationCounts] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    const updateCounts = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, number>>).detail || {};
      setNotificationCounts(detail);
    };
    window.addEventListener('admin-notification-counts', updateCounts);
    return () => window.removeEventListener('admin-notification-counts', updateCounts);
  }, []);

  const role = admin?.role;
  const internalItems = [
    { name: t('systemHealth'), href: '/internal/health', icon: HeartPulse, visible: role ? isSupportStaff(role) : false },
    { name: t('systemAnalytics'), href: '/internal/analytics', icon: BarChart3, visible: role ? isFullPlatformAdmin(role) : false },
    { name: t('appReleases'), href: '/internal/releases', icon: Zap, notificationType: 'RELEASE', visible: role ? isFullPlatformAdmin(role) : false },
    { name: t('customers'), href: '/internal/customers', icon: Users, notificationType: 'CUSTOMER', visible: role ? isAccountingStaff(role) : false },
    { name: t('promotions'), href: '/internal/promotions', icon: TicketPercent, visible: role ? isFullPlatformAdmin(role) : false },
    { name: 'Billing & Tax', href: '/internal/billing', icon: ReceiptText, visible: role === 'SUPER_ADMIN' },
    { name: 'Login Defense', href: '/internal/security/login-blocks', icon: ShieldAlert, notificationType: 'SECURITY', visible: role === 'SUPER_ADMIN' },
    { name: t('families'), href: '/internal/families', icon: Home, visible: role ? isAccountingStaff(role) : false },
    { name: t('devices'), href: '/internal/devices', icon: Smartphone, notificationType: 'DEVICE', visible: role ? isSupportStaff(role) : false },
    { name: t('supportInbox'), href: '/internal/support', icon: MessageSquare, notificationType: 'SUPPORT', visible: role ? isSupportStaff(role) : false },
    { name: t('issues'), href: '/internal/issues', icon: AlertCircle, notificationType: 'ISSUE', visible: role ? isSupportStaff(role) : false },
    { name: t('auditLogs'), href: '/internal/audit', icon: ClipboardList, visible: role ? isFullPlatformAdmin(role) : false },
    { name: 'Team Access', href: '/internal/team', icon: UserRoundCog, visible: role ? isFullPlatformAdmin(role) : false },
    { name: t('settings'), href: '/internal/settings', icon: Settings, visible: Boolean(role) },
  ].filter((item) => item.visible);

  const highestUnread = Math.max(0, ...Object.values(notificationCounts));

  const handleSignOut = async () => {
    if (onClose) onClose();
    await signOutInternalSession();
  };

  const SidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6 flex shrink-0 flex-col px-2">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { router.push('/internal'); if (onClose) onClose(); }}>
          <Image src="/sidebar-logo.png" alt="KidsGuard" width={94} height={40} className="h-10 w-auto brightness-0 invert" priority />
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase">Internal</h1>
            <p className="text-[7px] font-black text-rose-400 uppercase tracking-[0.2em] -mt-0.5">Platform Admin</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors absolute top-4 right-4">
          <X size={24} />
        </button>
      </div>

      <nav
        aria-label="Internal administration"
        className="admin-sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-2"
      >
        {internalItems.map((item) => {
          const isActive = pathname === item.href;
          const unreadCount = item.notificationType
            ? notificationCounts[item.notificationType] || 0
            : 0;
          const isPriority = unreadCount > 0 && unreadCount === highestUnread;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => { if (onClose) onClose(); }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/20"
                  : isPriority
                    ? "bg-rose-500/10 text-rose-200 ring-1 ring-rose-500/20 hover:bg-rose-500/20"
                    : unreadCount > 0
                      ? "bg-amber-500/5 text-slate-200 hover:bg-slate-800 hover:text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon size={20} />
              <span className="min-w-0 flex-1 font-medium text-sm">{item.name}</span>
              {unreadCount > 0 && (
                <span
                  title={isPriority ? 'Highest unread priority' : 'Unread notifications'}
                  className={cn(
                    "flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black",
                    isPriority
                      ? "bg-rose-500 text-white"
                      : "bg-amber-500/20 text-amber-300"
                  )}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-800 pt-4">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:text-white transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium text-sm">{t('adminExit')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className={`fixed top-0 h-screen w-64 bg-slate-950 text-white p-4 hidden lg:flex flex-col z-50 border-slate-900 ${direction === 'rtl' ? 'right-0 border-l' : 'left-0 border-r'}`}>
        {SidebarContent}
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed top-0 h-screen w-72 bg-slate-950 text-white p-6 flex flex-col z-[70] lg:hidden transition-transform duration-300 ease-in-out shadow-2xl",
        direction === 'rtl' ? 'right-0' : 'left-0',
        isOpen ? "translate-x-0" : direction === 'rtl' ? "translate-x-full" : "-translate-x-full"
      )}>
        {SidebarContent}
      </aside>
    </>
  );
};

export default InternalSidebar;
