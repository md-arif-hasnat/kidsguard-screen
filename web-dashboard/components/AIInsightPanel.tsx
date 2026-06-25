import React from 'react';
import { Brain, Battery, AlertTriangle, MapPin, Clock, ShieldCheck, Info, Map as MapIcon } from 'lucide-react';
import { ChildStatus } from '@/lib/repositories/ChildRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AIInsightPanelProps {
  status: ChildStatus;
}

export default function AIInsightPanel({ status }: AIInsightPanelProps) {
  const { predictions } = status;

  if (!predictions) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
        <Brain className="mx-auto text-slate-300 mb-4" size={40} />
        <p className="text-slate-500 font-medium italic">Waiting for AI engine to process live data...</p>
      </div>
    );
  }

  const batteryHours = predictions.batteryRemainingMinutes ? Math.floor(predictions.batteryRemainingMinutes / 60) : 0;
  const batteryMins = predictions.batteryRemainingMinutes ? predictions.batteryRemainingMinutes % 60 : 0;

  return (
    <div className="space-y-6">
      {/* Primary Battery Prediction Card */}
      <div className={cn(
        "p-6 rounded-2xl border transition-all shadow-sm",
        status.batteryPercent < 20 ? "bg-red-50 border-red-100" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              status.batteryPercent < 20 ? "bg-red-500 text-white" : "bg-primary-500 text-white"
            )}>
              <Battery size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Battery Prediction</h3>
              <p className="text-xs text-slate-500 font-medium">Estimated Remaining</p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn(
              "text-2xl font-black",
              status.batteryPercent < 20 ? "text-red-600" : "text-slate-800"
            )}>
              {batteryHours > 0 && `${batteryHours}h `}{batteryMins}m
            </p>
          </div>
        </div>

        {status.batteryPercent < 20 && !status.charging && (
          <div className="flex items-center gap-2 text-red-700 bg-red-100/50 p-3 rounded-xl border border-red-100 mt-2">
            <AlertTriangle size={16} />
            <p className="text-xs font-bold">Battery may run out before reaching Home.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unusual Route Detection */}
        <InsightCard
          icon={MapIcon}
          label="Movement Pattern"
          value={predictions.unusualRouteDetected ? "Unusual Route Detected" : "Normal Route"}
          status={predictions.unusualRouteDetected ? "danger" : "safe"}
          description={predictions.unusualRouteDetected ? "Deviation from learned patterns detected." : "Movement is consistent with history."}
        />

        {/* Late Arrival Detection */}
        <InsightCard
          icon={Clock}
          label="Schedule Adherence"
          value={predictions.lateArrivalDetected ? "Late Arrival" : "On Schedule"}
          status={predictions.lateArrivalDetected ? "warning" : "safe"}
          description={predictions.lateArrivalDetected ? "Has not reached expected destination." : "Arriving at zones as expected."}
        />

        {/* Long Stop Detection */}
        <InsightCard
          icon={MapPin}
          label="Stay Duration"
          value={predictions.longStopDetected ? "Stationary Period" : "Moving Normal"}
          status={predictions.longStopDetected ? "warning" : "safe"}
          description={predictions.longStopDetected ? `Static at ${predictions.stopLocation} for > 30m` : "No unusual long stops detected."}
        />

        {/* Offline Risk Prediction */}
        <InsightCard
          icon={ShieldCheck}
          label="Connectivity Risk"
          value={`${predictions.offlineRisk} Risk`}
          status={predictions.offlineRisk === 'High' ? "danger" : predictions.offlineRisk === 'Medium' ? "warning" : "safe"}
          description={predictions.offlineRisk === 'High' ? "Connection loss imminent (Low battery + Weak signal)" : "Secure connection predicted."}
        />
      </div>

      {/* Proximity Warning */}
      {predictions.approachingZoneId && (
        <div className="bg-primary-50 border border-primary-100 p-4 rounded-2xl flex items-center gap-4">
          <div className="bg-primary-600 text-white p-2 rounded-xl">
            <MapPin size={20} />
          </div>
          <div>
            <p className="text-xs font-bold text-primary-600 uppercase">Proximity Alert</p>
            <p className="text-sm font-bold text-slate-800">
              Child is approaching <span className="text-primary-700">Safe Zone Boundary</span>
            </p>
            <p className="text-[10px] text-slate-500 font-medium">Approx. {predictions.distanceToApproachingZone?.toFixed(0)}m remaining</p>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, status, description }: any) {
  const statusColors = {
    safe: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-rose-50 text-rose-700 border-rose-100"
  };

  const iconColors = {
    safe: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500"
  };

  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("p-2 rounded-lg text-white", iconColors[status as keyof typeof iconColors])}>
          <Icon size={18} />
        </div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-black text-slate-800 mb-1">{value}</p>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{description}</p>
    </div>
  );
}
