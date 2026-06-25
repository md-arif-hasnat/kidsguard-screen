import React from 'react';
import { Shield, MapPin, Zap, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { DailySummary } from '@/lib/repositories/DailySummaryRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AIReportCardProps {
  summary: DailySummary;
}

export default function AIReportCard({ summary }: AIReportCardProps) {
  const scoreColor = summary.safetyScore >= 90 ? "text-emerald-500" : summary.safetyScore >= 70 ? "text-amber-500" : "text-rose-500";
  const scoreBg = summary.safetyScore >= 90 ? "bg-emerald-50 border-emerald-100" : summary.safetyScore >= 70 ? "bg-amber-50 border-amber-100" : "bg-rose-50 border-rose-100";

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Shield className="text-primary-600" />
              Daily Safety Report
            </h3>
            <p className="text-slate-500 font-medium">AI Analysis for {new Date(summary.date).toLocaleDateString()}</p>
          </div>
          <div className={cn("px-6 py-4 rounded-2xl border flex flex-col items-center", scoreBg)}>
            <span className="text-[10px] font-bold uppercase tracking-widest mb-1">Safety Score</span>
            <span className={cn("text-4xl font-black", scoreColor)}>{summary.safetyScore}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Metric icon={MapPin} label="Zones Visited" value={summary.visitedZones?.join(", ") || "None"} />
          <Metric icon={TrendingUp} label="Total Distance" value={`${summary.totalDistanceKm?.toFixed(1) || 0} km`} />
          <Metric icon={AlertCircle} label="Total Alerts" value={summary.alertCount?.toString() || "0"} />
        </div>

        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={18} className="text-primary-600" />
            <h4 className="font-bold text-slate-700">AI Summary</h4>
          </div>
          <p className="text-slate-600 leading-relaxed italic">&quot;{summary.summaryText}&quot;</p>
        </div>

        <div className={cn(
          "p-6 rounded-2xl border flex gap-4 items-start",
          summary.safetyScore >= 90 ? "bg-emerald-50/50 border-emerald-100" : "bg-amber-50/50 border-amber-100"
        )}>
          <div className={cn(
            "p-2 rounded-xl text-white mt-1",
            summary.safetyScore >= 90 ? "bg-emerald-500" : "bg-amber-500"
          )}>
            <CheckCircle size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800">AI Recommendation</h4>
            <p className="text-sm text-slate-600 mt-1">{summary.recommendation || "Maintain current safety settings. Everything looks normal today."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-slate-400" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-lg font-bold text-slate-700 truncate">{value}</p>
    </div>
  );
}
