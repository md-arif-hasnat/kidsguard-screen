"use client";

import React, { useState, useEffect } from 'react';
import InternalLayout from '@/components/InternalLayout';
import {
    Users,
    Search,
    Loader2,
    Mail,
    Calendar,
    Shield,
    Smartphone,
    MoreVertical,
    ChevronRight,
    Filter
} from 'lucide-react';
import { ParentRepository, ParentProfile } from '@/lib/repositories/ParentRepository';
import { clsx } from 'clsx';

export default function InternalCustomersPage() {
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
        try {
            const data = await ParentRepository.getAllParents();
            setParents(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    load();
  }, []);

  const filteredParents = parents.filter(p =>
    p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.familyId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
        <InternalLayout>
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-rose-500" size={48} />
            </div>
        </InternalLayout>
    );
  }

  return (
    <InternalLayout>
      <header className="mb-10">
        <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Customer <span className="text-rose-500">Registry</span></h1>
        <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Management Panel • {parents.length} Active Accounts</p>
      </header>

      <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex items-center px-4 py-3 gap-3 focus-within:ring-2 focus-within:ring-rose-500 transition-all">
              <Search size={18} className="text-slate-500" />
              <input
                type="text"
                placeholder="Search by email, name or family ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium w-full text-white"
              />
          </div>
          <button className="bg-slate-900 border border-slate-800 text-slate-400 px-6 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-800 transition-colors text-sm font-bold">
              <Filter size={18} />
              Filter
          </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Parent Account</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Family ID</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Region</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Joined At</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                      {filteredParents.map((parent) => (
                          <tr key={parent.uid} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-5">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 font-black border border-slate-700">
                                          {parent.email?.[0].toUpperCase() || 'U'}
                                      </div>
                                      <div>
                                          <p className="text-sm font-black text-white group-hover:text-rose-400 transition-colors">{parent.displayName || 'Unnamed'}</p>
                                          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5 uppercase tracking-tighter italic">
                                              <Mail size={10} />
                                              {parent.email}
                                          </p>
                                      </div>
                                  </div>
                              </td>
                              <td className="px-6 py-5">
                                  <p className="text-[10px] font-black text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 inline-block">
                                      {parent.familyId || 'NONE'}
                                  </p>
                              </td>
                              <td className="px-6 py-5">
                                  <span className="text-[10px] font-black text-indigo-400 px-2 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20 uppercase tracking-widest">
                                      {parent.region || 'GLOBAL'}
                                  </span>
                              </td>
                              <td className="px-6 py-5">
                                  <div className="flex flex-col">
                                      <p className="text-[10px] font-bold text-slate-300">{parent.createdAt?.seconds ? new Date(parent.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                                      <p className="text-[9px] font-medium text-slate-600 italic">Created</p>
                                  </div>
                              </td>
                              <td className="px-6 py-5 text-right">
                                  <button className="p-2 text-slate-500 hover:text-rose-500 transition-colors">
                                      <ChevronRight size={20} />
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          {filteredParents.length === 0 && (
              <div className="py-20 text-center">
                  <p className="text-slate-500 font-bold italic">No matching customers found.</p>
              </div>
          )}
      </div>
    </InternalLayout>
  );
}
