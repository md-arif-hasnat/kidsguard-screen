"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield,
  Users,
  Map as MapIcon,
  Activity,
  AlertTriangle,
  History,
  Settings,
  LogOut,
  LayoutDashboard,
  MapPin,
  Bell
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { signOut, observeAuth } from '@/lib/auth';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubAuth = observeAuth((authUser) => {
      setUser(authUser);
      if (authUser) {
        const unsubCount = NotificationRepository.listenToUnreadCount(authUser.uid, setUnreadCount);
        return () => unsubCount();
      }
    });
    return () => unsubAuth();
  }, []);

  const navItems = [
    { name: 'Family Overview', href: '/', icon: Users },
    { name: 'Notifications', href: '/notifications', icon: Bell, badge: unreadCount },
    { name: 'Live Map', href: '/map', icon: MapIcon },
    { name: 'Safe Zones', href: '/settings/safe-zones', icon: MapPin },
    { name: 'Activity Feed', href: '/activity', icon: Activity },
    { name: 'SOS Center', href: '/sos', icon: AlertTriangle },
    { name: 'History', href: '/history', icon: History },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    localStorage.removeItem("kidsguard_family_id");
    router.push('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white p-4 flex flex-col">
      <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer" onClick={() => router.push('/')}>
        <Shield className="text-primary-500 w-8 h-8" />
        <h1 className="text-xl font-bold tracking-tight">KidsGuard</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} />
                <span className="font-medium">{item.name}</span>
              </div>
              {item.badge && item.badge > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
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
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
