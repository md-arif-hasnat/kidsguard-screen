import DashboardLayout from '@/components/DashboardLayout';
import { History, Calendar, Search } from 'lucide-react';

export default function HistoryPage() {
  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Route History</h1>
        <div className="flex gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input type="date" className="bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button className="bg-primary-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2">
            <Search size={18} />
            Filter
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-12 border-2 border-dashed border-slate-200 text-center flex flex-col items-center">
        <History size={64} className="text-slate-300 mb-4" />
        <p className="text-slate-500 font-bold text-xl">Historical Route Replay Placeholder</p>
        <p className="text-slate-400 mt-1 max-w-md mx-auto">Select a date and child above to replay movements and view safety events from the past.</p>
      </div>
    </DashboardLayout>
  );
}
