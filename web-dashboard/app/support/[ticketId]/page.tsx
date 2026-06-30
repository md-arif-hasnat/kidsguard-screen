"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
    MessageSquare,
    Send,
    ArrowLeft,
    Clock,
    User,
    Shield,
    Loader2
} from 'lucide-react';
import { SupportRepository, SupportTicket } from '@/lib/repositories/SupportRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { clsx } from 'clsx';

export default function TicketConversationPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const router = useRouter();
  const { profile, loading: profileLoading } = useParentProfile();

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (ticketId) {
      const unsub = SupportRepository.listenToTicket(ticketId, (data) => {
          setTicket(data);
          setLoading(false);
      });
      return () => unsub();
    }
  }, [ticketId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !profile || !replyText.trim()) return;

    // Security check: ensure this ticket belongs to the user
    if (ticket.parentUid !== profile.uid) return;

    setSending(true);
    try {
      await SupportRepository.replyToTicket(ticketId, {
        authorUid: profile.uid,
        authorEmail: profile.email || 'unknown',
        authorRole: 'PARENT',
        message: replyText
      });
      setReplyText('');
    } catch (err) {
      alert("Failed to send reply");
    } finally {
      setSending(false);
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

  if (!ticket || (profile && ticket.parentUid !== profile.uid)) {
      return (
          <DashboardLayout>
              <div className="text-center py-24">
                  <h2 className="text-2xl font-bold text-slate-900">Ticket not found</h2>
                  <button onClick={() => router.push('/support')} className="mt-4 text-primary-600 font-bold">Return to Support</button>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <button
            onClick={() => router.push('/support')}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm mb-8 transition-colors group"
        >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Support History
        </button>

        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
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
                    <h1 className="text-xl font-black text-slate-900 mt-2">{ticket.subject}</h1>
                </div>
                <p className="text-[10px] font-bold text-slate-400">ID: #{ticket.ticketId}</p>
            </div>

            <div className="flex-1 p-8 space-y-8 overflow-y-auto">
                {/* Initial Message */}
                <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                        <User size={20} />
                    </div>
                    <div className="space-y-2 max-w-[85%]">
                        <div className="bg-slate-100 border border-slate-200 p-5 rounded-3xl rounded-tl-none shadow-sm">
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">{ticket.message}</p>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            You • {new Date(ticket.createdAt?.seconds * 1000).toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Replies */}
                {ticket.replies.map(reply => (
                    <div key={reply.replyId} className={clsx(
                        "flex gap-4",
                        reply.authorRole !== 'PARENT' ? "flex-row" : "flex-row-reverse"
                    )}>
                        <div className={clsx(
                            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                            reply.authorRole !== 'PARENT' ? "bg-primary-600 border-primary-500 text-white" : "bg-slate-100 border-slate-200 text-slate-400"
                        )}>
                            {reply.authorRole !== 'PARENT' ? <Shield size={18}/> : <User size={18} />}
                        </div>
                        <div className={clsx(
                            "space-y-2 max-w-[85%]",
                            reply.authorRole !== 'PARENT' ? "" : "text-right"
                        )}>
                            <div className={clsx(
                                "p-5 rounded-3xl",
                                reply.authorRole !== 'PARENT'
                                    ? "bg-slate-900 text-white rounded-tl-none shadow-lg"
                                    : "bg-slate-100 border border-slate-200 text-slate-700 rounded-tr-none shadow-sm font-medium"
                            )}>
                                <p className="text-sm leading-relaxed">{reply.message}</p>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {reply.authorRole === 'PARENT' ? 'You' : 'KidsGuard Support'} • {reply.createdAt?.seconds ? new Date(reply.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {ticket.status !== 'CLOSED' && (
                <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                    <form onSubmit={handleSendReply} className="relative">
                        <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Type your message here..."
                            className="w-full bg-white border border-slate-200 rounded-[2rem] py-5 pl-8 pr-20 focus:ring-2 focus:ring-primary-500 outline-none text-slate-700 font-medium text-sm resize-none shadow-sm min-h-[120px]"
                            required
                        />
                        <button
                            disabled={sending}
                            className="absolute bottom-5 right-5 bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-2xl shadow-xl shadow-primary-200 transition-all disabled:opacity-50 active:scale-95"
                        >
                            {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                    </form>
                </div>
            )}
        </div>
      </div>
    </DashboardLayout>
  );
}
