import DashboardLayout from '@/components/DashboardLayout';
import { MapPin } from 'lucide-react';

export default function MapPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8">Live Map Center</h1>
      <div className="bg-slate-100 rounded-2xl h-[calc(100vh-200px)] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500">
        <MapPin size={48} className="mb-4 text-primary-500" />
        <p className="font-bold text-xl">Global Family Map Placeholder</p>
        <p>Integrate Google Maps JS API here</p>
      </div>
    </DashboardLayout>
  );
}
