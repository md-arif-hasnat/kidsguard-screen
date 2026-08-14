"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { FamilyRepository, DetailedInvite } from '@/lib/repositories/FamilyRepository';
import {
    Shield,
    UserPlus,
    CheckCircle2,
    XCircle,
    Loader2,
    Mail,
    Home,
    Users
} from 'lucide-react';
import { clsx } from 'clsx';

export default function InviteAcceptancePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { profile, loading: profileLoading } = useParentProfile();

    const inviteId = params.inviteId as string;
    const token = searchParams.get('token');

    const [invite, setInvite] = useState<DetailedInvite | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const loadInvite = async () => {
            try {
                const data = await FamilyRepository.getInvite(inviteId);
                if (!data) {
                    setError("Invitation not found.");
                } else if (data.tokenHash !== token) {
                    setError("Invalid security token.");
                } else if (data.status !== 'PENDING') {
                    setError(`This invitation has already been ${data.status.toLowerCase()}.`);
                } else if (data.expiresAt.toDate() < new Date()) {
                    setError("This invitation has expired.");
                } else {
                    setInvite(data);
                }
            } catch (err: any) {
                setError(err.message || "Failed to load invitation.");
            } finally {
                setLoading(false);
            }
        };

        if (inviteId) loadInvite();
    }, [inviteId, token]);

    const handleAccept = async () => {
        if (!invite || !profile || !token) {
            setError("Invitation link is missing its security token");
            return;
            }


        if (profile.email !== invite.email) {
            setError("This invitation was sent to another email address.");
            return;
        }

        setProcessing(true);
        try {
            await FamilyRepository.acceptInvite(
                inviteId,
                token,
                profile.uid,
                profile.email!,
                profile.displayName || "Family Member"
            );
            setSuccess(true);
            setTimeout(() => {
                router.push('/');
            }, 2000);
        } catch (err: any) {
            setError(err.message || "Failed to accept invitation.");
        } finally {
            setProcessing(false);
        }
    };

    if (loading || profileLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-primary-600" size={48} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
                    <Shield className="mx-auto text-primary-600 mb-6" size={64} />
                    <h1 className="text-2xl font-black text-slate-900 mb-4">Secure Family Invitation</h1>
                    <p className="text-slate-500 mb-8">Please sign in to your KidsGuard account to view and accept this invitation.</p>
                    <button
                        onClick={() => router.push(`/login?redirect=/invite/${inviteId}?token=${token}`)}
                        className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all"
                    >
                        Sign In to Continue
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-lg w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                <div className="bg-primary-600 p-12 text-white text-center relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                    <div className="relative z-10">
                        <Users className="mx-auto mb-6" size={56} />
                        <h1 className="text-3xl font-black">Family Invitation</h1>
                    </div>
                </div>

                <div className="p-10 text-center">
                    {error ? (
                        <div className="space-y-6">
                            <XCircle className="mx-auto text-rose-500" size={64} />
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Unable to Proceed</h2>
                                <p className="text-slate-500 mt-2">{error}</p>
                            </div>
                            <button
                                onClick={() => router.push('/')}
                                className="w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-200 transition-all"
                            >
                                Back to Home
                            </button>
                        </div>
                    ) : success ? (
                        <div className="space-y-6 py-4">
                            <CheckCircle2 className="mx-auto text-emerald-500" size={80} />
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Welcome to the Family!</h2>
                                <p className="text-slate-500 mt-2 italic">Redirecting to your dashboard...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <p className="text-slate-500 font-medium">
                                    <span className="font-black text-slate-900">{invite?.invitedByName || "A member"}</span> has invited you to join the
                                </p>
                                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                                    <h2 className="text-3xl font-black text-primary-600">{invite?.familyName}</h2>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mt-2 tracking-widest">Safe Vault</p>
                                </div>
                                <div className="flex items-center justify-center gap-2 py-2">
                                    <span className="text-sm font-bold text-slate-400">Assigned Role:</span>
                                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">{invite?.role}</span>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-start gap-4 text-left">
                                <Mail className="text-blue-600 shrink-0" size={20} />
                                <div>
                                    <p className="text-xs font-black text-blue-400 uppercase mb-1">Confirm Identity</p>
                                    <p className="text-sm font-bold text-blue-900">{profile.email}</p>
                                    <p className="text-[10px] text-blue-500 mt-1">This invitation is strictly for this email address.</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleAccept}
                                    disabled={processing}
                                    className="flex-1 bg-primary-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-primary-100 hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                                >
                                    {processing ? <Loader2 className="animate-spin" size={20} /> : "ACCEPT INVITATION"}
                                </button>
                                <button
                                    disabled={processing}
                                    className="bg-slate-100 text-slate-400 font-bold px-8 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                                >
                                    Decline
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
