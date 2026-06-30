"use client";

import React, { useState, useEffect } from 'react';
import InternalLayout from '@/components/InternalLayout';
import {
    MessageSquare,
    Send,
    Clock,
    CheckCircle2,
    AlertCircle,
    Search,
    Loader2,
    User,
    Filter,
    ArrowLeft
} from 'lucide-react';
import { SupportRepository, SupportTicket, TicketReply, TicketStatus } from '@/lib/repositories/SupportRepository';
import { useInternalAdmin } from '@/lib/context/InternalAdminContext';
import { clsx } from 'clsx';

export default function InternalSupportPage() {
  const { admin, loading: adminLoading } = useInternalAdmin();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<TicketStatus | 'ALL'>('ALL');

  useEffect(() => {
    const unsub = SupportRepository.listenToAllTickets((data) => {
        setTickets(data);
        setLoading(false);
        if (selectedTicket) {
            const updated = data.find(t => t.ticketId === selectedTicket.ticketId);
            if (updated) setSelectedTicket(updated);
        }
    });
    return () => unsub();
  }, [selectedTicket?.ticketId]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !admin || !replyText.trim()) return;
    setSending(true);

    try {
      await SupportRepository.replyToTicket(selectedTicket.ticketId, {
        authorUid: admin.uid,
        authorEmail: admin.email,
        authorRole: 'ADMIN',
        message: replyText
      });
      setReplyText('');
    } catch (err) {
      alert("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: TicketStatus) => {
      if (!selectedTicket) return;
      try {
          await SupportRepository.updateTicketStatus(selectedTicket.ticketId, status);
      } catch (err) {
          alert("Failed to update status");
      }
  };

  const filteredTickets = filter === 'ALL' ? tickets : tickets.filter(t => t.status === filter);

  if (adminLoading || loading) {
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">Support <span className="text-rose-500">Inbox</span></h1>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Customer Help Desk • Active Requests</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
            {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map(f => (
                <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={clsx(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        filter === f ? "bg-rose-500 text-white" : "text-slate-500 hover:text-slate-300"
                    )}
                >
                    {f}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-250px)]">
        {/* Ticket List */}
        <div className={clsx(
            "lg:col-span-4 space-y-4 overflow-y-auto pr-2 custom-scrollbar",
            selectedTicket && "hidden lg:block"
        )}>
            {filteredTickets.map(ticket => (
                <div
                    key={ticket.ticketId}
                    onClick={() => setSelectedTicket(ticket)}
                    className={clsx(
                        "bg-slate-900 border p-5 rounded-3xl cursor-pointer transition-all hover:translate-x-1 group",
                        selectedTicket?.ticketId === ticket.ticketId ? "border-rose-500" : "border-slate-800 hover:border-slate-700"
                    )}
                >
                    <div className="flex justify-between items-start mb-3">
                        <span className={clsx(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border",
                            ticket.status === 'OPEN' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            ticket.status === 'IN_PROGRESS' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}>
                            {ticket.status}
                        </span>
                        <p className="text-[9px] font-bold text-slate-600 tracking-tighter">#{ticket.ticketId}</p>
                    </div>
                    <h3 className="text-sm font-black text-white truncate group-hover:text-rose-400 transition-colors">{ticket.subject}</h3>
                    <p className="text-[10px] text-slate-500 mt-1 truncate">{ticket.parentEmail}</p>
                    <div className="mt-4 flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase">
                        <span>{ticket.category}</span>
                        <span>{new Date(ticket.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                </div>
            ))}
        </div>

        {/* Conversation View */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl">
            {selectedTicket ? (
                <>
                    <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedTicket(null)} className="lg:hidden p-2 text-slate-400 hover:text-white"><ArrowLeft size={20}/></button>
                            <div>
                                <h2 className="text-sm font-black text-white">{selectedTicket.subject}</h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedTicket.parentEmail}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedTicket.status}
                                onChange={(e) => updateStatus(e.target.value as any)}
                                className="bg-slate-950 border border-slate-800 text-[10px] font-black text-white px-3 py-1.5 rounded-lg outline-none uppercase tracking-widest"
                            >
                                <option value="OPEN">Open</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="RESOLVED">Resolved</option>
                                <option value="CLOSED">Closed</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                        {/* Initial Message */}
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 border border-slate-700">
                                <User size={20} />
                            </div>
                            <div className="space-y-2 max-w-[85%]">
                                <div className="bg-slate-800/50 border border-slate-700/50 p-5 rounded-3xl rounded-tl-none">
                                    <p className="text-sm text-slate-200 leading-relaxed">{selectedTicket.message}</p>
                                </div>
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                    Customer • {new Date(selectedTicket.createdAt?.seconds * 1000).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Replies */}
                        {selectedTicket.replies.map(reply => (
                            <div key={reply.replyId} className={clsx(
                                "flex gap-4",
                                reply.authorRole !== 'PARENT' ? "flex-row-reverse" : ""
                            )}>
                                <div className={clsx(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                                    reply.authorRole !== 'PARENT' ? "bg-rose-500 border-rose-400 text-white" : "bg-slate-800 border-slate-700 text-slate-500"
                                )}>
                                    {reply.authorRole !== 'PARENT' ? <Shield size={18}/> : <User size={18} />}
                                </div>
                                <div className={clsx(
                                    "space-y-2 max-w-[85%]",
                                    reply.authorRole !== 'PARENT' ? "text-right" : ""
                                )}>
                                    <div className={clsx(
                                        "p-5 rounded-3xl",
                                        reply.authorRole !== 'PARENT'
                                            ? "bg-rose-600 text-white rounded-tr-none shadow-lg shadow-rose-900/20"
                                            : "bg-slate-800/50 border border-slate-700/50 text-slate-200 rounded-tl-none"
                                    )}>
                                        <p className="text-sm leading-relaxed">{reply.message}</p>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                        {reply.authorRole} • {reply.createdAt?.seconds ? new Date(reply.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-slate-900 border-t border-slate-800">
                        <form onSubmit={handleSendReply} className="relative">
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Type your internal reply to customer..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-[2rem] py-4 pl-6 pr-20 focus:ring-2 focus:ring-rose-500 outline-none text-white font-medium text-sm resize-none min-h-[100px]"
                                required
                            />
                            <button
                                disabled={sending}
                                className="absolute bottom-4 right-4 bg-rose-600 hover:bg-rose-700 text-white p-3 rounded-2xl shadow-xl shadow-rose-900/20 transition-all disabled:opacity-50"
                            >
                                {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                            </button>
                        </form>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 text-slate-600 border border-slate-800">
                        <MessageSquare size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 italic">Select a ticket to view conversation</h3>
                    <p className="text-slate-600 max-w-xs mx-auto mt-2 text-sm">Real-time support requests from parents will appear here.</p>
                </div>
            )}
        </div>
      </div>
    </InternalLayout>
  );
}

function Shield({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
    )
}
