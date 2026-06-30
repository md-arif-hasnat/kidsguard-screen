"use client";

import React from 'react';
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
  ClipboardList,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { signOut } from '@/lib/auth';

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

  const internalItems = [
    { name: 'System Analytics', href: '/internal/analytics', icon: BarChart3 },
    { name: 'App Releases', href: '/internal/releases', icon: Zap },
    { name: 'Customers', href: '/internal/customers', icon: Users },
    { name: 'Families', href: '/internal/families', icon: Home },
    { name: 'Devices', href: '/internal/devices', icon: Smartphone },
    { name: 'Support Inbox', href: '/internal/support', icon: MessageSquare },
    { name: 'Issues', href: '/internal/issues', icon: AlertCircle },
    { name: 'Audit Logs', href: '/internal/audit', icon: ClipboardList },
    { name: 'Settings', href: '/internal/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push('/internal/login');
    if (onClose) onClose();
  };

  const SidebarContent = (
    <div className="h-full flex flex-col">
      <div className="flex flex-col mb-10 px-2">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { router.push('/internal'); if (onClose) onClose(); }}>
          <img src="/sidebar-logo.png" alt="KidsGuard" className="h-10 w-auto brightness-0 invert" />
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white uppercase">Internal</h1>
            <p className="text-[7px] font-black text-rose-400 uppercase tracking-[0.2em] -mt-0.5">Platform Admin</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors absolute top-4 right-4">
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {internalItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => { if (onClose) onClose(); }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <item.icon size={20} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:text-white transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium text-sm">Admin Exit</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-950 text-white p-4 hidden lg:flex flex-col z-50 border-r border-slate-900">
        {SidebarContent}
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-screen w-72 bg-slate-950 text-white p-6 flex flex-col z-[70] lg:hidden transition-transform duration-300 ease-in-out shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {SidebarContent}
      </aside>
    </>
  );
};

export default InternalSidebar;
