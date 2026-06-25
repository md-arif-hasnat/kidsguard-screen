import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { Bell, User, Search, Settings, Menu } from 'lucide-react';
import { observeAuth } from '@/lib/auth';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';
import { useParentProfile, getDisplayName, getAvatarUrl } from '@/lib/context/ParentProfileContext';
import { clsx } from 'clsx';
import Link from 'next/link';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { profile } = useParentProfile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (profile?.uid) {
        const unsubCount = NotificationRepository.listenToUnreadCount(profile.uid, setUnreadCount);
        return () => unsubCount();
    }
  }, [profile?.uid]);

  const displayName = getDisplayName(profile, profile?.email);
  const avatarUrl = getAvatarUrl(profile);

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-64 w-full">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            >
                <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 w-64 lg:w-96">
                <Search size={18} className="text-slate-400" />
                <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border-none outline-none text-sm font-medium w-full"
                />
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <Link href="/notifications" className="relative p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 hover:bg-slate-100 hover:text-primary-600 transition-all group">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in duration-300">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <Link href="/settings" className="flex items-center gap-3 p-1.5 md:pr-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all group">
              <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold overflow-hidden">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                    displayName[0].toUpperCase()
                )}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{displayName}</p>
                <p className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-wider">Parent Account</p>
              </div>
            </Link>
          </div>
        </header>

        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
