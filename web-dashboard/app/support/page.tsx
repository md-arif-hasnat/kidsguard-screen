"use client";

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
    MessageSquare,
    Send,
    LifeBuoy,
    Clock,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Loader2,
    Plus
} from 'lucide-react';
import Link from 'next/link';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { SupportRepository, SupportTicket } from '@/lib/repositories/SupportRepository';
import { clsx } from 'clsx';

export default function ParentSupportPage() {
  const { profile, family, loading: profileLoading } = useParentProfile();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [category, setCategory] = useState('Location not updating');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const categories = [
    'Location not updating',
    'Payment issue',
    'App install issue',
    'Child device problem',
    'Account settings',
    'Other'
  ];

  useEffect(() => {
    if (profile?.uid) {
      const unsub = SupportRepository.listenToParentTickets(profile.uid, (data) => {
          setTickets(data);
          setLoading(false);
      });
      return () => unsub();
    }
  }, [profile?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !family) return;
    setSubmitting(true);

    try {
      await SupportRepository.createTicket({
        familyId: family.familyId,
        parentUid: profile.uid,
        parentEmail: profile.email || 'unknown',
        subject,
        message,
        category
      });
      setIsCreating(false);
      setSubject('');
      setMessage('');
    } catch (err) {
      alert("Failed to send ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (profileLoading || loading) {
    return (
        <DashboardLayout>
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-primary-600" size={48} />
            </div>
        </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Support <span className="text-primary-600">Center</span></h1>
          <p className="text-slate-500 font-medium mt-1 italic">We&apos;re here to help you keep your family safe.</p>
        </div>
        <button
            onClick={() => setIsCreating(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-primary-200 transition-all flex items-center gap-2 group active:scale-95"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          New Help Request
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
            {isCreating ? (
                <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 italic uppercase tracking-tighter">
                            <Send size={20} className="text-primary-600" />
                            Submit Help Ticket
                        </h2>
                        <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">Cancel</button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm appearance-none"
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Description</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder="e.g. My child's location hasn't updated in 2 hours"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-bold text-sm"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detailed Message</label>
                            <textarea
                                rows={6}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder="Please provide as much detail as possible..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 focus:ring-2 focus:ring-primary-500 outline-none font-medium text-sm resize-none"
                                required
                            />
                        </div>
                        <button
                            disabled={submitting}
                            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest italic"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                            Send Help Request
                        </button>
                    </form>
                </section>
            ) : (
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Your Support History</p>
                    {tickets.length === 0 ? (
                        <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-16 text-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <LifeBuoy size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">No active tickets</h3>
                            <p className="text-slate-500 max-w-xs mx-auto mt-2 italic font-medium">Need help? Create a new support ticket and our team will get back to you within 24 hours.</p>
                        </div>
                    ) : (
                        tickets.map(ticket => (
                            <div key={ticket.ticketId} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:border-primary-500/30 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className={clsx(
                                                "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                                                ticket.status === 'OPEN' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                ticket.status === 'IN_PROGRESS' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            )}>
                                                {ticket.status}
                                            </span>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{ticket.category}</p>
                                        </div>
                                        <h3 className="text-lg font-black text-slate-900 mt-2">{ticket.subject}</h3>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400">ID: #{ticket.ticketId}</p>
                                </div>
                                <p className="text-sm text-slate-500 line-clamp-2 font-medium leading-relaxed italic">{ticket.message}</p>
                                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                                        <Clock size={14} />
                                        Updated: {new Date(ticket.updatedAt?.seconds * 1000).toLocaleDateString()}
                                    </div>
                                    <Link
                                        href={`/support/${ticket.ticketId}`}
                                        className="text-[10px] font-black text-primary-600 uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all"
                                    >
                                        View Conversation
                                        <ChevronRight size={14} />
                                    </Link>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>

        <div className="space-y-8">
            <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/20 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative z-10">
                    <LifeBuoy className="text-primary-400 mb-4" size={32} />
                    <h3 className="text-xl font-black mb-2 uppercase italic tracking-tight">Need Fast Help?</h3>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed">Check our Knowledge Base for quick answers to common setup questions.</p>
                    <button className="mt-6 w-full bg-white text-slate-900 font-black py-4 rounded-xl text-xs uppercase tracking-widest hover:bg-primary-50 transition-colors">
                        Browse Guides
                    </button>
                </div>
            </section>

            <section className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                <h3 className="font-black text-slate-900 mb-6 uppercase italic tracking-tight text-sm">Common Fixes</h3>
                <div className="space-y-4">
                    <FaqItem q="Location not updating?" a="Ensure 'Background Location' is set to 'Allow all the time' on child device." />
                    <FaqItem q="App keeping closing?" a="Disable 'Battery Optimization' for KidsGuard in Android settings." />
                    <FaItem q="Can't lock device?" a="Verify Accessibility Service is toggled ON." />
                </div>
            </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

function FaqItem({ q, a }: { q: string, a: string }) {
    return (
        <div className="space-y-1">
            <p className="text-xs font-black text-slate-900">{q}</p>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{a}</p>
        </div>
    )
}

function FaItem({ q, a }: { q: string, a: string }) {
    return (
        <div className="space-y-1 pt-4 border-t border-slate-100">
            <p className="text-xs font-black text-slate-900">{q}</p>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{a}</p>
        </div>
    )
}
