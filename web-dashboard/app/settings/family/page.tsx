"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Users,
  UserPlus,
  Shield,
  PhoneCall,
  Settings,
  Mail,
  Trash2,
  UserCheck,
  Clock,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Camera,
  Copy,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { FamilyRepository, FamilyRole, FamilyInvite, EmergencyContact } from '@/lib/repositories/FamilyRepository';
import { RoleHelper } from '@/lib/utils/RoleHelper';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'members' | 'invites' | 'contacts' | 'settings';

export default function FamilyManagementPage() {
  const { profile, family, role, loading: profileLoading } = useParentProfile();
  const [activeTab, setActiveTab] = useState<Tab>('members');

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<FamilyRole>(FamilyRole.GUARDIAN);
  const [inviting, setInviting] = useState(false);

  // Emergency Contact Form
  const [contactName, setContactName] = useState('');
  const [contactRel, setContactRelationship] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  // Invite Result
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  // Debug Logging in Development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && profile && family) {
        console.log("RBAC DEBUG [FamilyPage]:", {
            uid: profile.uid,
            familyId: family.familyId,
            ownerId: family.ownerId,
            resolvedRole: role,
            canInvite: RoleHelper.canInviteMembers(role)
        });
    }
  }, [profile, family, role]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !inviteEmail) return;
    setInviting(true);
    setLastInviteLink(null);
    try {
      const token = await FamilyRepository.sendInvite(
        family.familyId,
        family.settings.name,
        inviteEmail,
        inviteRole,
        profile!.uid,
        profile?.displayName || "Family Owner",
        role
      );

      const inviteId = (family?.invites ?? []).find(i => i.email === inviteEmail.toLowerCase())?.id || "latest";
      const link = `${window.location.origin}/invite/${inviteId}?token=${token}`;
      setLastInviteLink(link);
      setInviteEmail('');
    } catch (err) {
      alert("Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!family || !confirm("Revoke this invitation?")) return;
    try {
      await FamilyRepository.revokeInvite(family.familyId, inviteId, role);
    } catch (err) {
      alert("Failed to revoke invite");
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !contactName || !contactPhone) return;
    setAddingContact(true);
    try {
      await FamilyRepository.addEmergencyContact(family.familyId, {
        name: contactName,
        relationship: contactRel,
        phone: contactPhone,
        priority: (family.emergencyContacts?.length || 0) + 1
      }, role);
      setContactName('');
      setContactRelationship('');
      setContactPhone('');
    } catch (err) {
      alert("Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  };

  const isOwner = role === FamilyRole.OWNER;
  const canInvite = RoleHelper.canInviteMembers(role);

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={48} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Family Management</h1>
            <p className="text-slate-500 mt-1">Manage guardians, permissions, and shared family settings.</p>
        </div>
        <div className="flex items-center gap-2">
            <span className="bg-primary-50 text-primary-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-primary-100">
                {role.replace('_', ' ')} ACCESS
            </span>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl mb-8 w-fit overflow-x-auto no-scrollbar">
          <TabButton active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={Users} label="Members" />
          <TabButton active={activeTab === 'invites'} onClick={() => setActiveTab('invites')} icon={Mail} label="Invitations" />
          <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} icon={PhoneCall} label="Emergency Contacts" />
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} label="Settings" />
      </div>

      <div className="space-y-8">
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <UserCheck className="text-primary-600" />
                    Active Family Members
                  </h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {(family?.members ?? []).map((member) => (
                    <div key={member.uid} className="p-6 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-black overflow-hidden border-2 border-primary-200">
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} alt="avatar" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{member.displayName || "Family Member"}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                              member.role === FamilyRole.OWNER ? "bg-indigo-100 text-indigo-700" :
                              member.role === FamilyRole.PARENT ? "bg-emerald-100 text-emerald-700" :
                              member.role === FamilyRole.GUARDIAN ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {member.role}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">Joined {member.joinedAt?.toDate ? member.joinedAt.toDate().toLocaleDateString() : 'recently'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isOwner && member.uid !== profile?.uid && family?.familyId && (
                            <button
                            onClick={() => FamilyRepository.removeMember(family.familyId, member.uid, role)}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove Member"
                            >
                            <Trash2 size={18} />
                            </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div>
              <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                  <UserPlus className="text-primary-600" />
                  Invite Member
                </h3>
                {canInvite ? (
                    <form onSubmit={handleSendInvite} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Email Address</label>
                        <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="guardian@example.com"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Assigned Role</label>
                        <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as FamilyRole)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        >
                        <option value={FamilyRole.PARENT}>Parent (Full Access)</option>
                        <option value={FamilyRole.GUARDIAN}>Guardian (Limited)</option>
                        <option value={FamilyRole.VIEWER}>Viewer (Read-only)</option>
                        </select>
                    </div>
                    <button
                        disabled={inviting}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-100 transition-all flex items-center justify-center gap-2"
                    >
                        {inviting ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                        Generate Invitation
                    </button>
                    </form>
                ) : (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                        <Shield className="mx-auto text-slate-300 mb-4" size={32} />
                        <p className="text-sm font-medium text-slate-500 italic">Only Owners and Parents can invite new members.</p>
                    </div>
                )}

                {lastInviteLink && (
                    <div className="mt-8 bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-6 animate-in zoom-in-95 duration-200">
                        <p className="text-xs font-black text-emerald-600 uppercase mb-3 flex items-center gap-2">
                            <CheckCircle2 size={14} />
                            Invitation Created!
                        </p>
                        <p className="text-[10px] text-emerald-500 font-medium leading-relaxed mb-4">
                            Send this secure link to the invited member. They must sign in with the email you provided.
                        </p>
                        <div className="flex gap-2">
                            <input
                                readOnly
                                value={lastInviteLink}
                                className="flex-1 bg-white border border-emerald-100 rounded-xl px-4 py-2 text-xs font-mono text-slate-600 outline-none"
                            />
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(lastInviteLink);
                                    alert("Copied to clipboard!");
                                }}
                                className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                            >
                                <Copy size={18} />
                            </button>
                        </div>
                    </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Clock className="text-primary-600" />
                Pending Invitations
              </h3>
            </div>
            <div className="divide-y divide-slate-50">
              {(family?.invites ?? []).length > 0 ? (family?.invites ?? []).map((invite) => (
                <div key={invite.id} className="p-6 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{invite.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                            invite.status === 'PENDING' ? "bg-amber-100 text-amber-600" :
                            invite.status === 'ACCEPTED' ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"
                        )}>
                            {invite.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{invite.role}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Expires</p>
                        <p className="text-xs font-bold text-slate-600">
                        {invite.expiresAt?.toDate ? invite.expiresAt.toDate().toLocaleDateString() : invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'N/A'}
                        </p>
                    </div>
                    {invite.status === 'PENDING' && canInvite && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => {
                                    // In real app, re-fetch token or re-generate
                                    alert("In production, this would re-generate the token and send the email.");
                                }}
                                className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                                title="Resend Email"
                            >
                                <RefreshCw size={18} />
                            </button>
                            <button
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                title="Revoke Invite"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center text-slate-400 italic font-medium">
                  No pending invitations.
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'contacts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Shield className="text-rose-600" />
                    Emergency Contacts
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">Shared contacts reachable from the child&apos;s device SOS menu.</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {(family?.emergencyContacts ?? []).map((contact) => (
                    <div key={contact.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 font-black">
                          {contact.priority}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{contact.name}</p>
                          <p className="text-xs text-slate-500">{contact.relationship} • {contact.phone}</p>
                        </div>
                      </div>
                      {family?.familyId && (
                        <button
                          onClick={() => FamilyRepository.removeEmergencyContact(family.familyId, contact.id, role)}
                          className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  {(!family?.emergencyContacts || family.emergencyContacts.length === 0) && (
                    <div className="py-20 text-center text-slate-400 italic">No emergency contacts listed.</div>
                  )}
                </div>
              </section>
            </div>

            <div>
              <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                  <Plus className="text-emerald-600" />
                  Add Contact
                </h3>
                <form onSubmit={handleAddContact} className="space-y-4">
                  <Input label="Full Name" value={contactName} onChange={setContactName} placeholder="Dr. Smith" />
                  <Input label="Relationship" value={contactRel} onChange={setContactRelationship} placeholder="Pediatrician" />
                  <Input label="Phone Number" value={contactPhone} onChange={setContactPhone} placeholder="+1 555-0123" />
                  <button
                    disabled={addingContact}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {addingContact ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    Save Shared Contact
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-8">
            <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
                <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-2">
                    <Settings className="text-primary-600" />
                    Family Preferences
                </h3>
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                            <p className="font-bold text-slate-800">Family Name</p>
                            <p className="text-sm text-slate-500 font-medium">{family?.settings?.name ?? 'Not set'}</p>
                        </div>
                        <button className="text-xs font-black text-primary-600 hover:underline uppercase">Change</button>
                    </div>
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200">
                                <Globe size={24} className="text-slate-400" />
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">Region \u0026 Timezone</p>
                                <p className="text-sm text-slate-500 font-medium">{family?.settings?.country ?? 'N/A'} • {family?.settings?.timezone ?? 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {isOwner && (
                <section className="bg-rose-50 border-2 border-rose-100 rounded-[2rem] p-8">
                    <h3 className="text-lg font-black text-rose-800 mb-2">Danger Zone</h3>
                    <p className="text-sm text-rose-600 font-medium mb-6">Once deleted, all family data, child history, and member access will be permanently removed.</p>
                    <button className="bg-rose-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all">
                        Delete Family Vault
                    </button>
                </section>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
                active ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
        >
            <Icon size={18} />
            {label}
        </button>
    )
}

function Input({ label, value, onChange, placeholder }: any) {
    return (
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
            />
        </div>
    )
}
