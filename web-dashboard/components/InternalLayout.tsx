"use client";

import React, { useState } from 'react';
import InternalSidebar from './InternalSidebar';
import { Menu, Search, User, Bell } from 'lucide-react';
import { useInternalAdmin, InternalAdminProvider } from '@/lib/context/InternalAdminContext';
import { useRouter, usePathname } from 'next/navigation';

interface InternalLayoutProps {
  children: React.ReactNode;
}

const InternalLayoutContent: React.FC<InternalLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { admin, loading, isAdmin } = useInternalAdmin();
  const router = useRouter();
  const pathname = usePathname();

  // Route Guard
  React.useEffect(() => {
    if (!loading && !isAdmin && pathname !== '/internal/login') {
        router.push('/internal/login');
    }
  }, [loading, isAdmin, pathname, router]);

  if (loading) {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
            <div className="w-12 h-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.3em] text-rose-500 animate-pulse">Platform Security Check</p>
        </div>
    );
  }

  if (pathname === '/internal/login') {
    return <>{children}</>;
  }

  if (!isAdmin) {
    return null; // Effect will redirect
  }

  return (
    <div className="flex min-h-screen bg-slate-950 overflow-x-hidden text-slate-200">
      <InternalSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-64 w-full">
        {/* Top Header */}
        <header className="h-20 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
                <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 w-64 lg:w-96">
                <Search size={18} className="text-slate-500" />
                <input
                type="text"
                placeholder="Search resources..."
                className="bg-transparent border-none outline-none text-sm font-medium w-full text-slate-300 placeholder:text-slate-600"
                />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Internal Session</span>
            </div>

            <div className="flex items-center gap-3 p-1.5 md:pr-4 bg-slate-800/50 rounded-xl border border-slate-800">
              <div className="w-9 h-9 rounded-lg bg-rose-500 flex items-center justify-center text-white font-black overflow-hidden shadow-lg shadow-rose-500/20">
                {admin?.email?.[0].toUpperCase() || 'A'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-black text-white leading-none truncate max-w-[120px]">{admin?.email}</p>
                <p className="text-[9px] font-black text-rose-400 mt-1 uppercase tracking-wider">{admin?.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

const InternalLayout: React.FC<InternalLayoutProps> = ({ children }) => {
    return (
        <InternalAdminProvider>
            <InternalLayoutContent>
                {children}
            </InternalLayoutContent>
        </InternalAdminProvider>
    );
};

export default InternalLayout;
