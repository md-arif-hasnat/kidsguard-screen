import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { Bell, User, Search, Settings } from 'lucide-react';
import { observeAuth } from '@/lib/auth';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';
import { clsx } from 'clsx';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
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

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-96">
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search activity, children or zones..."
              className="bg-transparent border-none outline-none text-sm font-medium w-full"
            />
          </div>

          <div className="flex items-center gap-6">
            <Link href="/notifications" className="relative p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 hover:bg-slate-100 hover:text-primary-600 transition-all group">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in duration-300">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <Link href="/settings" className="flex items-center gap-3 p-1.5 pr-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                {user?.email?.[0].toUpperCase() || <User size={20} />}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{user?.email?.split('@')[0] || "Account"}</p>
                <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-wider">Parent Account</p>
              </div>
            </Link>
          </div>
        </header>

        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
