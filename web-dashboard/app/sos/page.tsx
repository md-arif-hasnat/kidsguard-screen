import DashboardLayout from '@/components/DashboardLayout';
import { AlertTriangle, MapPin } from 'lucide-react';
import { MOCK_SOS } from '@/lib/mockData';

export default function SosPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8 text-red-600 flex items-center gap-3">
        <AlertTriangle size={32} />
        SOS Alert Center
      </h1>

      <div className="grid grid-cols-1 gap-6">
        {MOCK_SOS.map((sos) => (
          <div key={sos.id} className="bg-white rounded-2xl border-2 border-slate-200 p-8 flex items-center justify-between shadow-sm">
            <div className="flex gap-6 items-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">{sos.childName}&apos;s Emergency Trigger</h3>
                <p className="text-slate-500 font-medium">{sos.time}</p>
                <div className="flex items-center gap-1 mt-2 text-primary-600 font-bold">
                  <MapPin size={16} />
                  {sos.location}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full font-bold text-sm uppercase">Resolved</span>
              <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold">View Incident Report</button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
