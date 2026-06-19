import DashboardLayout from '@/components/DashboardLayout';
import { User, Bell, Shield, Smartphone } from 'lucide-react';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <div className="max-w-4xl space-y-8">
        <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-900">
            <User size={20} className="text-primary-500" />
            <h2 className="font-bold text-lg">Parent Profile</h2>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">Full Name</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none" defaultValue="John Doe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">Email Address</label>
              <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 outline-none" defaultValue="parent@example.com" />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 text-slate-900">
            <Bell size={20} className="text-primary-500" />
            <h2 className="font-bold text-lg">Notifications</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
              <span className="font-medium">Browser Push Alerts</span>
              <input type="checkbox" className="w-5 h-5 accent-primary-600" defaultChecked />
            </label>
            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
              <span className="font-medium">Critical SOS Alerts (Sound)</span>
              <input type="checkbox" className="w-5 h-5 accent-primary-600" defaultChecked />
            </label>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
