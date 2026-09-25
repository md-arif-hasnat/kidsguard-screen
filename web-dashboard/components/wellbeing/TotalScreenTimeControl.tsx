"use client";

import React, { useEffect, useState } from "react";
import {
  Clock3,
  Loader2,
  Save,
  ShieldCheck
} from "lucide-react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TotalScreenTimeControlProps {
  childId: string;
  canEdit: boolean;
}

const PRESETS = [
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
  { label: "4 hours", minutes: 240 }
];

export default function TotalScreenTimeControl({
  childId,
  canEdit
}: TotalScreenTimeControlProps) {
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState("120");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!db || !childId) {
      setLoading(false);
      return;
    }

    const ref = doc(db, "children", childId, "settings", "wellbeing");
    return onSnapshot(
      ref,
      snapshot => {
        const data = snapshot.data();
        setEnabled(data?.totalLimitEnabled === true);
        const savedMinutes = Number(data?.dailyTotalLimitMinutes || 0);
        if (savedMinutes > 0) {
          setMinutes(String(savedMinutes));
        }
        setLoading(false);
      },
      error => {
        console.error("Failed to load total screen-time limit", error);
        setLoading(false);
      }
    );
  }, [childId]);

  const save = async () => {
    if (!db || !canEdit) return;

    const parsedMinutes = Number.parseInt(minutes, 10);
    if (enabled && (
      !Number.isFinite(parsedMinutes) ||
      parsedMinutes < 1 ||
      parsedMinutes > 1440
    )) {
      window.alert("Enter a limit between 1 and 1440 minutes.");
      return;
    }

    try {
      setSaving(true);
      setSaved(false);
      await setDoc(
        doc(db, "children", childId, "settings", "wellbeing"),
        {
          totalLimitEnabled: enabled,
          dailyTotalLimitMinutes: enabled ? parsedMinutes : null,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save total screen-time limit", error);
      window.alert("Failed to save the screen-time limit.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 flex items-center justify-center min-h-64">
        <Loader2 className="animate-spin text-primary-600" size={28} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 p-6 md:p-8 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-primary-50 text-primary-600">
          <Clock3 size={26} />
        </div>
        <div className="flex-1">
          <h3 className="font-black text-slate-900 text-lg">
            Daily total screen-time limit
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Block non-essential apps after the child uses the allowed total time.
            Phone, settings, maps and emergency apps remain available.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canEdit || saving}
          onClick={() => setEnabled(value => !value)}
          className={
            "relative w-12 h-7 rounded-full transition-colors " +
            (enabled ? "bg-primary-600" : "bg-slate-200") +
            (!canEdit ? " opacity-50 cursor-not-allowed" : "")
          }
        >
          <span
            className={
              "absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow transition-transform " +
              (enabled ? "translate-x-5" : "translate-x-0")
            }
          />
        </button>
      </div>

      <div className={"mt-7 space-y-5 " + (!enabled ? "opacity-50" : "")}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.minutes}
              type="button"
              disabled={!enabled || !canEdit}
              onClick={() => setMinutes(String(preset.minutes))}
              className={
                "px-3 py-3 rounded-xl border text-sm font-bold transition-colors " +
                (minutes === String(preset.minutes)
                  ? "bg-primary-600 border-primary-600 text-white"
                  : "bg-white border-slate-200 text-slate-600")
              }
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Custom minutes per day
          </span>
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            disabled={!enabled || !canEdit}
            onChange={event => setMinutes(event.target.value)}
            className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-primary-500"
          />
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={!canEdit || saving}
          onClick={save}
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Save size={16} />
          )}
          Save limit
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold">
            <ShieldCheck size={16} />
            Sent to child
          </span>
        )}
      </div>
    </div>
  );
}
