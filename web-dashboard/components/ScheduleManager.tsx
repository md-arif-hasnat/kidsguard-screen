import React, { useState } from 'react';
import { Clock, Plus, Trash2, Calendar, Check, AlertCircle } from 'lucide-react';
import { SafeZone } from '@/lib/repositories/SafeZoneRepository';

export interface Schedule {
  id: string;
  zoneId: string;
  dayOfWeek: number;
  arrivalTime: string;
  enabled: boolean;
}

interface ScheduleManagerProps {
  safeZones: SafeZone[];
  onAdd: (s: Omit<Schedule, 'id'>) => void;
  onDelete: (id: string) => void;
  schedules: Schedule[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ScheduleManager({ safeZones, onAdd, onDelete, schedules }: ScheduleManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    zoneId: safeZones[0]?.id || '',
    dayOfWeek: 1,
    arrivalTime: '08:00',
    enabled: true
  });

  const handleAdd = () => {
    onAdd(newSchedule);
    setShowAdd(false);
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Clock className="text-primary-600" />
            Arrival Schedules
          </h2>
          <p className="text-slate-500 font-medium mt-1">Configure expected arrival times for each safe zone.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-primary-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-primary-700 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Add Requirement
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 animate-in slide-in-from-top duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Safe Zone</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none"
                value={newSchedule.zoneId}
                onChange={e => setNewSchedule({...newSchedule, zoneId: e.target.value})}
              >
                {safeZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Day</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none"
                value={newSchedule.dayOfWeek}
                onChange={e => setNewSchedule({...newSchedule, dayOfWeek: parseInt(e.target.value)})}
              >
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Arrival Time</label>
              <input
                type="time"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none"
                value={newSchedule.arrivalTime}
                onChange={e => setNewSchedule({...newSchedule, arrivalTime: e.target.value})}
              />
            </div>
            <button
              onClick={handleAdd}
              className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all"
            >
              Save Schedule
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {schedules.length > 0 ? schedules.map(s => (
          <div key={s.id} className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-2xl hover:border-primary-200 transition-all group">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                <Calendar size={24} />
              </div>
              <div>
                <p className="font-black text-slate-800 text-lg">
                  {safeZones.find(z => z.id === s.zoneId)?.name || 'Unknown Zone'}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-lg">{DAYS[s.dayOfWeek]}</span>
                  <span className="text-xs font-bold px-2 py-1 bg-primary-100 text-primary-600 rounded-lg flex items-center gap-1">
                    <Clock size={12} />
                    Expected by {s.arrivalTime}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => onDelete(s.id)}
              className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={20} />
            </button>
          </div>
        )) : (
          <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <AlertCircle size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium italic">No arrival schedules configured. Late arrival detection is disabled.</p>
          </div>
        )}
      </div>
    </div>
  );
}
