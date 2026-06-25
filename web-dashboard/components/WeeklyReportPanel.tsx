import React from 'react';
import { TrendingUp, TrendingDown, Minus, MapPin, AlertCircle, Calendar, ShieldCheck } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface WeeklyReport {
  weekStartDate: string;
  averageSafetyScore: number;
  totalDistanceKm: number;
  totalAlerts: number;
  topVisitedZones: string[];
  safetyTrend: 'Improving' | 'Stable' | 'Declining';
  recommendations: string[];
}

interface WeeklyReportPanelProps {
  report: WeeklyReport;
}

export default function WeeklyReportPanel({ report }: WeeklyReportPanelProps) {
  const trendColor = report.safetyTrend === 'Improving' ? "text-emerald-500" : report.safetyTrend === 'Declining' ? "text-rose-500" : "text-slate-500";
  const TrendIcon = report.safetyTrend === 'Improving' ? TrendingUp : report.safetyTrend === 'Declining' ? TrendingDown : Minus;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in duration-300">
      <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/20 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Calendar size={20} className="text-primary-400" />
            <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Weekly Insight</span>
          </div>
          <h2 className="text-3xl font-black mb-1">Safety Trend Analysis</h2>
          <p className="text-slate-400 font-medium">Report started {report.weekStartDate}</p>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <MetricCard label="Avg. Score" value={report.averageSafetyScore} subValue="/ 100" />
          <MetricCard label="Weekly Dist." value={`${report.totalDistanceKm.toFixed(1)}`} subValue="km" />
          <MetricCard label="Total Alerts" value={report.totalAlerts} subValue="events" />
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-center justify-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Trend</p>
            <div className={cn("flex items-center gap-2 font-black text-lg", trendColor)}>
              <TrendIcon size={20} />
              {report.safetyTrend}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <MapPin size={18} className="text-primary-600" />
              Top Active Zones
            </h3>
            <div className="space-y-3">
              {(report?.topVisitedZones ?? []).map((zone, i) => (
                <div key={zone} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-700">{zone}</span>
                  <span className="text-[10px] font-bold text-slate-400">#{i + 1} Most Visited</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-primary-600" />
              Strategic Recommendations
            </h3>
            <div className="space-y-3">
              {(report?.recommendations ?? []).map((rec, i) => (
                <div key={i} className="flex gap-3 p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <AlertCircle size={18} className="text-primary-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700 font-medium">{rec}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subValue }: any) {
  return (
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline justify-center gap-1">
        <span className="text-3xl font-black text-slate-800">{value}</span>
        <span className="text-xs font-bold text-slate-400">{subValue}</span>
      </div>
    </div>
  );
}
