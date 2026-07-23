"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import InstalledAppsPanel from '@/components/panels/InstalledAppsPanel';

export default function InstalledAppsPage() {
  const params = useParams();
  const childId = params.childId as string;

  return (
    <DashboardLayout>
      <InstalledAppsPanel childId={childId} />
    </DashboardLayout>
  );
}
