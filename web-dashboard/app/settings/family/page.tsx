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
  Camera
} from 'lucide-react';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { FamilyRepository, FamilyData, FamilyRole, FamilyMember, FamilyInvite, EmergencyContact } from '@/lib/repositories/FamilyRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'members' | 'invites' | 'contacts' | 'settings';

export default function FamilyManagementPage() {
  const { profile } = useParentProfile();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [loading, setLoading] = useState(true);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<FamilyRole>(FamilyRole.GUARDIAN);
  const [inviting, setInviting] = useState(false);

  // Emergency Contact Form
  const [contactName, setContactName] = useState('');
  const [contactRel, setContactRelationship] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  useEffect(() => {
    if (!profile?.familyId) {
      setLoading(false);
      return;
    }

    const unsub = FamilyRepository.listenToFamily(profile.familyId, (data) => {
      setFamily(data);
      setLoading(false);
    });

    return () => unsub();
  }, [profile]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !inviteEmail) return;
    setInviting(true);
    try {
      await FamilyRepository.sendInvite(family.familyId, inviteEmail, inviteRole, profile!.uid);
      setInviteEmail('');
      alert("Invite sent successfully!");
    } catch (err) {
      alert("Failed to send invite");
    } finally {
      setInviting(false);
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
      });
      setContactName('');
      setContactRelationship('');
      setContactPhone('');
    } catch (err) {
      alert("Failed to add contact");
    } finally {
      setAddingContact(false);
    }
  };

  const isOwner = family?.ownerId === profile?.uid;

  if (loading) {
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
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Family Management</h1>
        <p className="text-slate-500 mt-1">Manage guardians, permissions, and shared family settings.</p>
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
                  {family?.members.map((member) => (
                    <div key={member.uid} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-black">
                          {member.displayName?.[0] || member.email?.[0] || "?"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{member.displayName || "Family Member"}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                              member.role === FamilyRole.OWNER ? "bg-indigo-100 text-indigo-700" :
                              member.role === FamilyRole.PARENT ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {member.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isOwner && member.uid !== profile?.uid && (
                        <button
                          onClick={() => FamilyRepository.removeMember(family.familyId, member.uid)}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
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
                    Send Invitation
                  </button>
                </form>
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
              {family?.invites && family.invites.length > 0 ? family.invites.map((invite) => (
                <div key={invite.id} className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Mail size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{invite.email}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{invite.role} • {invite.status}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Expires</p>
                    <p className="text-xs font-bold text-slate-600">
                      {invite.expiresAt?.toDate?.() ? invite.expiresAt.toDate().toLocaleDateString() : new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
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
                  {family?.emergencyContacts?.map((contact) => (
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
                      <button
                        onClick={() => FamilyRepository.removeEmergencyContact(family.familyId, contact.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
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
                            <p className="text-sm text-slate-500 font-medium">{family?.settings.name}</p>
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
                                <p className="text-sm text-slate-500 font-medium">{family?.settings.country} • {family?.settings.timezone}</p>
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
