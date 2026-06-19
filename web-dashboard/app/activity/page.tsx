import DashboardLayout from '@/components/DashboardLayout';
import { MOCK_ACTIVITY } from '@/lib/mockData';
import { Activity as ActivityIcon } from 'lucide-react';

export default function ActivityPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8">Activity Feed</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2">
          <ActivityIcon size={20} className="text-primary-500" />
          <h2 className="font-bold">Recent Safety Events</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {MOCK_ACTIVITY.map((item) => (
            <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-primary-500" />
                <div>
                  <p className="font-bold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.date} • {item.time}</p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full uppercase">
                {item.type.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
