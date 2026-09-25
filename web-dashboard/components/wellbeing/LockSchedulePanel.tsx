import React, {
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Calendar,
  Clock,
  Loader2,
  Save,
  ShieldCheck
} from "lucide-react";
import {
  ChildRepository,
  LockScheduleWindow
} from "@/lib/repositories/ChildRepository";

interface LockSchedulePanelProps {
  childId: string;
  canEdit: boolean;
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [6, 7];

const DEFAULT_WINDOWS: LockScheduleWindow[] = [
  {
    id: "weekdays",
    name: "Weekdays",
    enabled: true,
    startMinutes: 21 * 60,
    endMinutes: 7 * 60,
    days: WEEKDAYS
  },
  {
    id: "weekends",
    name: "Weekend",
    enabled: true,
    startMinutes: 23 * 60,
    endMinutes: 9 * 60,
    days: WEEKENDS
  }
];

function minutesToTime(minutes: number) {
  const safe = Math.max(0, Math.min(1439, minutes));
  const hours = Math.floor(safe / 60).toString().padStart(2, "0");
  const mins = (safe % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function mondayFirstDay(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function isWindowActive(
  window: LockScheduleWindow,
  now: Date
) {
  if (!window.enabled || window.startMinutes === window.endMinutes) {
    return false;
  }

  const currentDay = mondayFirstDay(now);
  const yesterday = currentDay === 1 ? 7 : currentDay - 1;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (window.startMinutes < window.endMinutes) {
    return window.days.includes(currentDay) &&
      currentMinutes >= window.startMinutes &&
      currentMinutes < window.endMinutes;
  }

  return (
    window.days.includes(currentDay) &&
    currentMinutes >= window.startMinutes
  ) || (
    window.days.includes(yesterday) &&
    currentMinutes < window.endMinutes
  );
}

export default function LockSchedulePanel({
  childId,
  canEdit
}: LockSchedulePanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [windows, setWindows] =
    useState<LockScheduleWindow[]>(DEFAULT_WINDOWS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!childId) return;

    setLoading(true);
    return ChildRepository.listenToLockSchedule(childId, schedule => {
      if (schedule) {
        setEnabled(schedule.enabled);

        if (schedule.windows?.length) {
          setWindows(schedule.windows);
        } else if (schedule.days?.length) {
          setWindows([
            {
              id: "legacy",
              name: "Every selected day",
              enabled: true,
              startMinutes: schedule.startMinutes,
              endMinutes: schedule.endMinutes,
              days: schedule.days
            },
            DEFAULT_WINDOWS[1]
          ]);
        }
      }
      setLoading(false);
    });
  }, [childId]);

  const currentStatus = useMemo(() => {
    if (!enabled) return "Disabled";
    return windows.some(window => isWindowActive(window, new Date()))
      ? "Schedule Active"
      : "Outside Schedule";
  }, [enabled, windows]);

  const updateWindow = (
    id: string,
    updates: Partial<LockScheduleWindow>
  ) => {
    if (!canEdit) return;
    setWindows(current =>
      current.map(window =>
        window.id === id ? { ...window, ...updates } : window
      )
    );
  };

  const save = async () => {
    if (!childId || !canEdit) return;

    const activeWindows = windows.filter(window => window.enabled);
    if (enabled && activeWindows.length === 0) {
      setSaveError("Enable at least one schedule.");
      return;
    }

    if (
      activeWindows.some(
        window => window.startMinutes === window.endMinutes
      )
    ) {
      setSaveError("Start and end times cannot be the same.");
      return;
    }

    const first = activeWindows[0] || windows[0];

    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      await ChildRepository.setLockSchedule(childId, {
        enabled,
        startMinutes: first?.startMinutes || 0,
        endMinutes: first?.endMinutes || 0,
        days: first?.days || [],
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "Europe/Berlin",
        windows
      });

      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error("LOCK_SCHEDULE_SAVE_FAILED", error);
      setSaveError(error?.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <section className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Clock className="text-primary-600" />
            Bedtime & Lock Schedule
          </h3>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Set different overnight lock times for school days and weekends.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={
            "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest " +
            (currentStatus === "Schedule Active"
              ? "bg-rose-100 text-rose-700"
              : currentStatus === "Disabled"
              ? "bg-slate-100 text-slate-400"
              : "bg-emerald-100 text-emerald-700")
          }>
            {currentStatus}
          </span>
          <Switch
            enabled={enabled}
            disabled={!canEdit}
            onChange={() => setEnabled(value => !value)}
          />
        </div>
      </div>

      <div className={"grid grid-cols-1 xl:grid-cols-2 gap-5 " + (!enabled ? "opacity-60" : "")}>
        {windows.slice(0, 2).map(window => (
          <ScheduleWindowEditor
            key={window.id}
            window={window}
            disabled={!enabled || !canEdit}
            onChange={updates => updateWindow(window.id, updates)}
          />
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-5">
        <div className="flex items-center gap-2 text-slate-700 font-bold">
          <ShieldCheck size={18} className="text-primary-600" />
          Schedule protection
        </div>
        <ul className="text-xs text-slate-500 mt-3 space-y-2">
          <li>• Overnight windows continue correctly after midnight.</li>
          <li>• Parent remote unlock pauses the lock until that window ends.</li>
          <li>• Manual parent lock always takes priority.</li>
          <li>• Phone, emergency access and KidsGuard remain available.</li>
        </ul>
      </div>

      <button
        type="button"
        disabled={!canEdit || saving}
        onClick={save}
        className={
          "mt-6 w-full font-black py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50 " +
          (saveSuccess
            ? "bg-emerald-600 text-white"
            : "bg-slate-900 hover:bg-slate-800 text-white")
        }
      >
        {saving ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Saving...
          </>
        ) : saveSuccess ? (
          <>
            <ShieldCheck size={16} />
            Saved
          </>
        ) : (
          <>
            <Save size={16} />
            Save Schedule
          </>
        )}
      </button>

      {saveError && (
        <p className="mt-4 text-center text-xs font-bold text-rose-500">
          {saveError}
        </p>
      )}
    </section>
  );
}

function ScheduleWindowEditor({
  window,
  disabled,
  onChange
}: {
  window: LockScheduleWindow;
  disabled: boolean;
  onChange: (updates: Partial<LockScheduleWindow>) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h4 className="font-black text-slate-800 flex items-center gap-2">
            <Calendar size={17} className="text-primary-600" />
            {window.name}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            {window.days.join(", ") === WEEKDAYS.join(", ")
              ? "Monday to Friday"
              : "Saturday and Sunday"}
          </p>
        </div>
        <Switch
          enabled={window.enabled}
          disabled={disabled}
          onChange={() => onChange({ enabled: !window.enabled })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Lock at
          </span>
          <input
            type="time"
            disabled={disabled || !window.enabled}
            value={minutesToTime(window.startMinutes)}
            onChange={event =>
              onChange({
                startMinutes: timeToMinutes(event.target.value)
              })
            }
            className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 font-black text-slate-700"
          />
        </label>
        <label>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Unlock at
          </span>
          <input
            type="time"
            disabled={disabled || !window.enabled}
            value={minutesToTime(window.endMinutes)}
            onChange={event =>
              onChange({
                endMinutes: timeToMinutes(event.target.value)
              })
            }
            className="mt-2 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 font-black text-slate-700"
          />
        </label>
      </div>
    </div>
  );
}

function Switch({
  enabled,
  disabled,
  onChange
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      role="switch"
      aria-checked={enabled}
      className={
        "w-12 h-6 rounded-full relative transition-colors disabled:opacity-50 " +
        (enabled ? "bg-primary-600" : "bg-slate-200")
      }
    >
      <span className={
        "w-4 h-4 bg-white rounded-full absolute top-1 transition-all " +
        (enabled ? "left-7" : "left-1")
      } />
    </button>
  );
}
