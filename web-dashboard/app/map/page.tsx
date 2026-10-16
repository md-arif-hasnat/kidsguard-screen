"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Loader2, Users } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import ChildSelector from '@/components/ChildSelector';
import ChildLocationPanel from '@/components/panels/ChildLocationPanel';
import FirebaseConfigurationError from '@/components/FirebaseConfigurationError';

export default function MapPage() {
  const { profile, family, loading } = useParentProfile();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const childIdsKey = (family?.childDeviceIds ?? []).join("\u0000");

  useEffect(() => {
    if (loading) return;

    const childIds = childIdsKey ? childIdsKey.split("\u0000") : [];
    const savedChildId = localStorage.getItem("kidsguard_selected_child");
    setSelectedChildId(
      savedChildId && childIds.includes(savedChildId)
        ? savedChildId
        : childIds[0] ?? null
    );
  }, [childIdsKey, loading]);

  if (!isFirebaseConfigured) {
    return (
      <DashboardLayout>
        <FirebaseConfigurationError />
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary-600" size={40} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Live Map Center</h1>
        <div className="flex items-center gap-3">
            <ChildSelector
                selectedChildId={selectedChildId}
                onSelect={(id) => {
                    setSelectedChildId(id);
                    localStorage.setItem("kidsguard_selected_child", id);
                }}
                familyId={family?.familyId || profile?.familyId}
            />
        </div>
      </div>

      {selectedChildId ? (
          <ChildLocationPanel childId={selectedChildId} />
      ) : (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                  <Users size={40} className="text-primary-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Please select your child first.</h2>
          </div>
      )}
    </DashboardLayout>
  );
}
