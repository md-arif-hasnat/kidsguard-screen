"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Home,
  School,
  Trees,
  Users,
  Settings,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { observeAuth } from '@/lib/auth';
import { ParentRepository, ParentProfile } from '@/lib/repositories/ParentRepository';
import { SafeZoneRepository, SafeZone, SafeZoneType } from '@/lib/repositories/SafeZoneRepository';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { FamilyRepository, FamilyData, FamilyRole } from '@/lib/repositories/FamilyRepository';
import { RoleHelper } from '@/lib/utils/RoleHelper';
import { GeocodingService } from '@/lib/services/GeocodingService';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { User } from 'firebase/auth';
import { clsx } from 'clsx';
import MapLocationPicker from '@/components/MapLocationPicker';
import ChildSelector from '@/components/ChildSelector';

export default function SafeZonesPage() {
  const { profile, loading: profileLoading } = useParentProfile();
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [childrenStatus, setChildrenStatus] = useState<Record<string, ChildStatus>>({});

  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<SafeZoneType>('Home');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(200);
  const [manualCoords, setManualCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [editingZone, setEditingZone] = useState<SafeZone | null>(null);

  useEffect(() => {
    const savedChildId = localStorage.getItem("kidsguard_selected_child");
    if (savedChildId) setSelectedChildId(savedChildId);

    if (profile) {
      if (profile.familyId) {
        const unsubFamily = FamilyRepository.listenToFamily(profile.familyId, (data) => {
            if (data) {
                setFamily(data);
                if (!selectedChildId && data.childDeviceIds.length > 0) {
                    setSelectedChildId(data.childDeviceIds[0]);
                }
            }
        });
        return () => unsubFamily();
      }
    } else if (!profileLoading) {
      setLoading(false);
    }
  }, [profile, profileLoading]);

  // Listen to status of all children in family to get names
  useEffect(() => {
    if (!family) return;
    const unsubscribes = family.childDeviceIds.map(id =>
      ChildRepository.listenToChildStatus(id, (s) => {
        if (s) setChildrenStatus(prev => ({ ...prev, [id]: s }));
      })
    );
    return () => unsubscribes.forEach(u => u());
  }, [family]);

  // Listen to safe zones for selected child
  useEffect(() => {
    if (!selectedChildId || !family?.familyId) {
      setSafeZones([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubZones = SafeZoneRepository.listenToChildSafeZones(
      selectedChildId,
      family.familyId,
      (zones) => {
        setSafeZones(zones);
        setLoading(false);
      }
    );
    return () => unsubZones();
  }, [selectedChildId, family]);

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId) return;

    setSaving(true);
    setStatus(null);

    try {
      let lat = manualCoords?.lat;
      let lng = manualCoords?.lng;
      let finalAddress = address.trim();

      if (!lat || !lng) {
        if (!finalAddress) {
            throw new Error("Please provide an address or pick a location on the map.");
        }

        const geoResult = await GeocodingService.geocode(finalAddress);
        if (!geoResult) {
            throw new Error("Address lookup requires Google billing. Please pick location on map instead.");
        }
        lat = geoResult.latitude;
        lng = geoResult.longitude;
        finalAddress = geoResult.formattedAddress;
      }

      const zoneData = {
        name: name.trim() || type,
        type,
        address: finalAddress || "Manual Location",
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
        enabled: true,
        notifyOnEnter: true,
        notifyOnExit: true
      };

      if (editingZone) {
        await SafeZoneRepository.updateSafeZone(selectedChildId, editingZone.id, zoneData);
        setStatus({ type: 'success', message: 'Safe zone updated!' });
      } else {
        await SafeZoneRepository.addSafeZone(selectedChildId, zoneData);
        setStatus({ type: 'success', message: 'Safe zone added!' });
      }

      resetForm();
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Action failed' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setType('Home');
    setAddress('');
    setRadius(200);
    setManualCoords(null);
    setShowAddForm(false);
    setShowMapPicker(false);
    setEditingZone(null);
  };

  const handleEdit = (zone: SafeZone) => {
    setEditingZone(zone);
    setName(zone.name);
    setType(zone.type);
    setAddress(zone.address || '');
    setRadius(zone.radiusMeters);
    setManualCoords({ lat: zone.latitude, lng: zone.longitude });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!selectedChildId || !confirm("Delete this safe zone?")) return;
    try {
      await SafeZoneRepository.deleteSafeZone(selectedChildId, id);
      setStatus({ type: 'success', message: 'Safe zone deleted.' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to delete.' });
    }
  };

  const getIcon = (type: SafeZoneType) => {
    switch (type) {
      case 'Home': return <Home className="text-blue-500" />;
      case 'School': return <School className="text-orange-500" />;
      case 'Playground': return <Trees className="text-green-500" />;
      case 'Relative House': return <Users className="text-purple-500" />;
      default: return <MapPin className="text-slate-500" />;
    }
  };

  const currentUserMember = (family?.members ?? []).find(m => m.uid === profile?.uid) ||
                            (profile?.uid && family?.ownerId === profile.uid ? { uid: profile.uid, role: FamilyRole.OWNER } : null);
  const currentRole = (currentUserMember as any)?.role || FamilyRole.VIEWER;
  const canManageZones = RoleHelper.canManageSafeZones(currentRole);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Safe Zones</h1>
          <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-500 text-sm md:text-base">Manage safety perimeters for your children.</p>
              <span className="bg-slate-100 text-slate-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">{currentRole} ACCESS</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            {/* Unified Child Selector */}
            <ChildSelector
                selectedChildId={selectedChildId}
                onSelect={(id) => {
                    setSelectedChildId(id);
                    localStorage.setItem("kidsguard_selected_child", id);
                }}
                familyId={profile?.familyId}
                className="flex-1 sm:flex-none"
            />

            {!showAddForm && selectedChildId && canManageZones && (
            <button
                onClick={() => setShowAddForm(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                Add Zone
            </button>
            )}
        </div>
      </div>

      {loading ? (
          <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary-600" size={48} />
          </div>
      ) : (
        <>
        {status && (
            <div className={clsx(
            "mb-6 p-4 rounded-xl flex items-center gap-3 border animate-in slide-in-from-top-2 duration-300",
            status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
            )}>
            {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <p className="font-medium text-sm">{status.message}</p>
            </div>
        )}

        {showAddForm && (
            <div className="bg-white rounded-2xl border-2 border-primary-100 shadow-xl overflow-hidden mb-8 animate-in zoom-in-95 duration-200">
            <div className="p-4 md:p-6 border-b border-slate-100 bg-primary-50/30 flex items-center justify-between">
                <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm md:text-base">
                    <Settings size={18} className="text-primary-600" />
                    {editingZone ? `Edit Zone` : `New Zone`}
                </h2>
                <button onClick={resetForm} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
            <form onSubmit={handleAddOrUpdate} className="p-4 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1">Zone Type</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as SafeZoneType)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm"
                    >
                        <option value="Home">Home</option>
                        <option value="School">School</option>
                        <option value="Playground">Playground</option>
                        <option value="Relative House">Relative House</option>
                        <option value="Custom">Custom Location</option>
                    </select>
                    </div>
                    <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 ml-1">Custom Name (Optional)</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={type}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm"
                    />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Address or Landmark</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                            type="text"
                            value={address}
                            onChange={(e) => {
                                setAddress(e.target.value);
                                setManualCoords(null); // Clear manual if address is being typed
                            }}
                            placeholder="e.g. 123 Main St, New York"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMapPicker(true)}
                            className={clsx(
                                "px-6 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border-2 text-sm",
                                manualCoords ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            )}
                        >
                            <MapPin size={18} className={manualCoords ? "text-emerald-500" : "text-primary-500"} />
                            {manualCoords ? "Location Set" : "Pick on Map"}
                        </button>
                    </div>
                    {manualCoords && (
                        <p className="text-[10px] text-emerald-600 font-bold ml-1 flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Coordinates locked: {manualCoords.lat.toFixed(4)}, {manualCoords.lng.toFixed(4)}
                        </p>
                    )}
                    </div>
                    <div className="space-y-3 md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 ml-1">Radius (meters)</label>
                    <div className="flex flex-wrap gap-2">
                        {[100, 200, 300, 500, 750, 1000].map((r) => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => setRadius(r)}
                            className={clsx(
                            "px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all",
                            radius === r ? "border-primary-500 bg-primary-50 text-primary-600" : "border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200"
                            )}
                        >
                            {r}m
                        </button>
                        ))}
                        <div className={clsx(
                            "flex items-center gap-2 px-4 py-1.5 rounded-lg border-2 transition-all",
                            ![100, 200, 300, 500, 750, 1000].includes(radius) ? "border-primary-500 bg-primary-50" : "border-slate-100 bg-slate-50"
                        )}>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Custom:</span>
                            <input
                                type="number"
                                value={radius}
                                onChange={(e) => setRadius(parseInt(e.target.value) || 100)}
                                className="w-16 bg-transparent outline-none font-bold text-xs text-slate-700"
                            />
                        </div>
                    </div>
                    </div>
                </div>
                <div className="flex justify-end pt-4">
                    <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-10 rounded-xl shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
                    {editingZone ? 'Save Changes' : 'Create Safe Zone'}
                    </button>
                </div>
            </form>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {!selectedChildId ? (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                      <Users size={40} className="text-primary-500" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">Please select your child first.</h2>
                  <p className="text-slate-500 max-w-sm mx-auto mt-2">Use the dropdown at the top right to choose which child&apos;s safe zones you want to manage.</p>
              </div>
            ) : safeZones.map((zone) => (
            <div key={zone.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-all group">
                <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-sm">
                    {getIcon(zone.type)}
                    </div>
                    {canManageZones && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => handleEdit(zone)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary-600 transition-colors"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button
                            onClick={() => handleDelete(zone.id)}
                            className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
                    )}
                </div>
                <h3 className="font-bold text-slate-900 text-lg">{zone.name}</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">{zone.type}</p>
                <div className="mt-4 flex items-start gap-2 text-sm text-slate-600">
                    <MapPin size={16} className="shrink-0 mt-0.5 text-slate-400" />
                    <span className="line-clamp-2 leading-relaxed">{zone.address}</span>
                </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-400 uppercase">Radius: {zone.radiusMeters}m</span>
                </div>
                <div className={clsx(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    zone.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                )}>
                    {zone.enabled ? "Active" : "Disabled"}
                </div>
                </div>
            </div>
            ))}

            {selectedChildId && safeZones.length === 0 && !showAddForm && (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                <MapPin size={40} className="text-slate-300" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">No safe zones configured yet.</h2>
                <p className="text-slate-500 max-w-sm mx-auto mt-2">Create safety zones around Home, School, or other frequent locations to receive automatic alerts.</p>
                <button
                onClick={() => setShowAddForm(true)}
                className="mt-8 text-primary-600 font-bold hover:underline"
                >
                Add first zone for {selectedChildId ? (childrenStatus[selectedChildId]?.childName || "Child") : "Child"}
                </button>
            </div>
            )}
        </div>
        </>
      )}

      {showMapPicker && (
          <MapLocationPicker
            initialLocation={manualCoords}
            defaultRegion={profile?.region}
            radius={radius}
            onSelect={(lat, lng) => setManualCoords({ lat, lng })}
            onClose={() => setShowMapPicker(false)}
          />
      )}
    </DashboardLayout>
  );
}
