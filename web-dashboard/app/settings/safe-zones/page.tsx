"use client";

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Users } from 'lucide-react';
import { useParentProfile } from '@/lib/context/ParentProfileContext';
import ChildSelector from '@/components/ChildSelector';
import SafeZonesPanel from '@/components/panels/SafeZonesPanel';

export default function SafeZonesPage() {
  const { family, profile } = useParentProfile();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Initial child selection
  useEffect(() => {
    const savedChildId = localStorage.getItem("kidsguard_selected_child");
    if (savedChildId) setSelectedChildId(savedChildId);

    if (family && !selectedChildId && (family.childDeviceIds ?? []).length > 0) {
        setSelectedChildId(family.childDeviceIds[0]);
    }
  }, [family, selectedChildId]);

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Safe Zones</h1>
          <p className="text-slate-500 text-sm md:text-base mt-1">Manage safety perimeters for your children.</p>
        </div>

        <ChildSelector
            selectedChildId={selectedChildId}
            onSelect={(id) => {
                setSelectedChildId(id);
                localStorage.setItem("kidsguard_selected_child", id);
            }}
            familyId={family?.familyId}
        />
      </div>

      {selectedChildId ? (
          <SafeZonesPanel childId={selectedChildId} />
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
