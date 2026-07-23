"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import AppActivityPanel from '@/components/panels/AppActivityPanel';

export default function AppActivityPage() {
  const params = useParams();
  const childId = params.childId as string;

  return (
    <DashboardLayout>
      <AppActivityPanel childId={childId} />
    </DashboardLayout>
  );
}
