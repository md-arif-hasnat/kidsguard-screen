"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, CloudOff } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { MOCK_CHILDREN } from '@/lib/mockData';
import { FamilyRepository, FamilyData } from '@/lib/repositories/FamilyRepository';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import ChildSelector from '@/components/ChildSelector';
import ChildLocationPanel from '@/components/panels/ChildLocationPanel';

export default function MapPage() {
  const { profile } = useParentProfile();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [family, setFamily] = useState<any | null>(null);

  // Initialize selected child
  useEffect(() => {
    const savedChildId = localStorage.getItem("kidsguard_selected_child");
    if (savedChildId) {
        setSelectedChildId(savedChildId);
    } else if (MOCK_CHILDREN.length > 0) {
        setSelectedChildId(MOCK_CHILDREN[0].id);
    }
  }, []);

  // Fetch Family and Children if Firebase is configured
  useEffect(() => {
    if (!isFirebaseConfigured || !profile) return;

    const familyId = profile.familyId || localStorage.getItem("kidsguard_family_id") || "mock_family_123";

    const unsubFamily = FamilyRepository.listenToFamily(familyId, (data) => {
    if (data) {
        setFamily(data);
        if (!selectedChildId && data.childDeviceIds.length > 0) {
        setSelectedChildId(data.childDeviceIds[0]);
        }
    }
    });
    return () => unsubFamily();
  }, [selectedChildId, profile]);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Live Map Center</h1>
        <div className="flex items-center gap-3">
            {!isFirebaseConfigured && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 px-4 flex items-center gap-2">
                <CloudOff size={16} className="text-yellow-600" />
                <span className="text-yellow-700 text-[10px] font-bold uppercase tracking-wide">Mock Mode</span>
            </div>
            )}
            <ChildSelector
                selectedChildId={selectedChildId}
                onSelect={(id) => {
                    setSelectedChildId(id);
                    localStorage.setItem("kidsguard_selected_child", id);
                }}
                familyId={profile?.familyId}
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
