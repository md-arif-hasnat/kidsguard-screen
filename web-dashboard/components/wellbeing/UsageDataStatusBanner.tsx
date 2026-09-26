"use client";

import React from "react";
import { AlertTriangle, Clock3, Info } from "lucide-react";
import { ChildStatus } from "@/lib/repositories/ChildRepository";

interface UsageDataStatusBannerProps {
  status: ChildStatus | null;
}

const STALE_AFTER_MS = 20 * 60 * 1000;

export default function UsageDataStatusBanner({
  status
}: UsageDataStatusBannerProps) {
  if (!status || typeof status.usageAccessGranted !== "boolean") {
    return (
      <StatusBanner
        icon={Info}
        tone="slate"
        title="Waiting for usage permission status"
        message="Install KidsGuard v1.0.50 or later on the child phone, then open the app once. Until then, zero usage may mean that status has not been reported."
      />
    );
  }

  if (!status.usageAccessGranted) {
    return (
      <StatusBanner
        icon={AlertTriangle}
        tone="rose"
        title="Usage Access is turned off"
        message="Screen-time and per-app figures are unavailable. Open KidsGuard on the child phone and restore Usage Access."
      />
    );
  }

  const lastSeen = Number(status.lastSeen || 0);
  if (lastSeen > 0 && Date.now() - lastSeen > STALE_AFTER_MS) {
    return (
      <StatusBanner
        icon={Clock3}
        tone="amber"
        title="Usage data may be out of date"
        message={`The child phone last reported at ${new Date(lastSeen).toLocaleString()}. Figures below show the most recently synced data.`}
      />
    );
  }

  return null;
}

function StatusBanner({
  icon: Icon,
  tone,
  title,
  message
}: {
  icon: React.ElementType;
  tone: "slate" | "rose" | "amber";
  title: string;
  message: string;
}) {
  const colors = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800"
  }[tone];

  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-5 ${colors}`}>
      <Icon className="mt-0.5 shrink-0" size={21} />
      <div>
        <h3 className="font-black">{title}</h3>
        <p className="mt-1 text-sm font-medium opacity-90">{message}</p>
      </div>
    </div>
  );
}
