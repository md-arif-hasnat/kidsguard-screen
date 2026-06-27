"use client";

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  LifeBuoy,
  Mail,
  MessageSquare,
  Bug,
  Send,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Book,
  ShieldQuestion
} from 'lucide-react';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { AuditRepository, AuditAction, AuditSeverity } from '@/lib/repositories/AuditRepository';

export default function SupportPage() {
  const { profile, family } = useParentProfile();
  const [subject, setSubject] = useState('Bug Report');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !profile || !family) return;

    // Log the support request as an audit event
    await AuditRepository.log({
      actorUid: profile.uid,
      actorEmail: profile.email || "user",
      familyId: family.familyId,
      action: AuditAction.SUPPORT_REQUEST_SUBMITTED,
      targetType: 'SYSTEM',
      targetId: 'SUPPORT_REQUEST',
      severity: AuditSeverity.INFO,
      metadata: { subject, message: message.substring(0, 100) }
    });

    setSubmitted(true);
  };

  return (
    <DashboardLayout>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Support \u0026 Feedback</h1>
        <p className="text-slate-500 mt-1">Help us improve KidsGuard during our Beta phase.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {submitted ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-12 text-center shadow-xl animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                    <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Message Received</h2>
                <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium">Thank you for your feedback! Our team will review your report and get back to you if needed.</p>
                <button
                    onClick={() => { setSubmitted(false); setMessage(''); }}
                    className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                    Send Another
                </button>
            </div>
          ) : (
            <section className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                    <MessageSquare className="text-primary-600" />
                    <h3 className="text-lg font-black text-slate-800">Submit a Report</h3>
                </div>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Topic</label>
                            <select
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                className="w-full mt-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                            >
                                <option>Bug Report</option>
                                <option>Feature Request</option>
                                <option>Account Issue</option>
                                <option>General Feedback</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-4 bg-primary-50 border border-primary-100 p-4 rounded-2xl h-[fit-content] mt-auto">
                            <Bug className="text-primary-600 shrink-0" size={24} />
                            <p className="text-[10px] font-bold text-primary-700 leading-relaxed italic">
                                Found something broken? Detailed reports help us fix it faster for everyone.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Details</label>
                        <textarea
                            required
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Please describe the issue or your suggestion..."
                            className="w-full mt-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all min-h-[200px] resize-none"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            className="bg-primary-600 hover:bg-primary-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-primary-100 transition-all flex items-center gap-2 group"
                        >
                            <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            Submit Feedback
                        </button>
                    </div>
                </form>
            </section>
          )}
        </div>

        <div className="space-y-8">
            {/* Quick Links */}
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                    <LifeBuoy size={20} className="text-primary-600" />
                    Resources
                </h3>
                <div className="space-y-4">
                    <ResourceLink icon={Book} title="Setup Guide" href="/download" />
                    <ResourceLink icon={ShieldQuestion} title="Privacy FAQ" href="/settings/security" />
                    <ResourceLink icon={Mail} title="Email Support" href="mailto:support@kidsguard.example" />
                </div>
            </section>

            {/* Beta Disclaimer */}
            <section className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/20 rounded-full -mr-16 -mt-16 blur-2xl" />
                <h3 className="text-lg font-black mb-4">Beta Program</h3>
                <p className="text-slate-400 text-xs leading-relaxed font-medium">
                    You are currently using KidsGuard v1.0-beta. Some features may be experimental. Your feedback is crucial for our public launch.
                </p>
                <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest">Program Status</p>
                    <p className="text-sm font-bold mt-1 text-emerald-400">Active Development</p>
                </div>
            </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ResourceLink({ icon: Icon, title, href }: { icon: any, title: string, href: string }) {
    return (
        <a
            href={href}
            className="flex items-center justify-between p-4 rounded-xl border border-slate-50 bg-slate-50/50 hover:bg-white hover:border-primary-100 hover:shadow-sm transition-all group"
        >
            <div className="flex items-center gap-3">
                <Icon size={18} className="text-slate-400 group-hover:text-primary-600" />
                <span className="text-sm font-bold text-slate-700">{title}</span>
            </div>
            <ExternalLink size={14} className="text-slate-300" />
        </a>
    );
}
