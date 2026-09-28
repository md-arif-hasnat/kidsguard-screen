"use client";

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Battery,
  Loader2,
  Search,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff
} from 'lucide-react';
import InternalLayout from '@/components/InternalLayout';
import {
  AdminDeviceHealth,
  AdminRepository
} from '@/lib/repositories/AdminRepository';

const REQUIRED_PERMISSIONS: Array<keyof AdminDeviceHealth> = [
  'locationPermissionGranted',
  'backgroundLocationPermissionGranted',
  'usageAccessGranted',
  'overlayPermissionGranted',
  'accessibilityPermissionGranted',
  'batteryOptimizationExempt'
];

function permissionSummary(device: AdminDeviceHealth) {
  const reported = REQUIRED_PERMISSIONS.filter(
    permission => typeof device[permission] === 'boolean'
  );
  if (reported.length === 0) return 'Not reported';
  const granted = reported.filter(permission => device[permission] === true);
  return `${granted.length}/${reported.length} healthy`;
}

function lastSeenLabel(lastSeen?: number) {
  if (!lastSeen) return 'Never reported';
  return new Date(lastSeen).toLocaleString();
}

export default function InternalDevicesPage() {
  const [devices, setDevices] = useState<AdminDeviceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;

    AdminRepository.getDeviceHealth()
      .then(data => {
        if (active) setDevices(data);
      })
      .catch(() => {
        if (active) setError('Device health data could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredDevices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return devices;
    return devices.filter(device => [
      device.childName,
      device.childId,
      device.familyId,
      device.deviceName,
      device.appVersion
    ].some(value => value?.toLowerCase().includes(term)));
  }, [devices, search]);

  const onlineCount = devices.filter(device => device.online).length;
  const unhealthyCount = devices.filter(
    device => device.syncHealthy === false
  ).length;

  return (
    <InternalLayout>
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Smartphone className="text-rose-500" size={28} />
          <h1 className="text-3xl font-black uppercase italic text-white">
            Device Health
          </h1>
        </div>
        <p className="text-sm text-slate-500">
          {devices.length} devices · {onlineCount} online · {unhealthyCount} sync warnings
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <Search size={18} className="text-slate-500" />
        <input
          aria-label="Search devices"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search child, device, family or version..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="animate-spin text-rose-500" size={42} />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300">
          {error}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredDevices.map(device => {
            const lowBattery =
              typeof device.batteryPercent === 'number' &&
              device.batteryPercent <= 15;
            return (
              <article
                key={device.childId}
                className="rounded-3xl border border-slate-800 bg-slate-900 p-6"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-black text-white">{device.childName}</h2>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {device.childId} · {device.familyId}
                    </p>
                  </div>
                  <span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
                    device.online
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {device.online ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {device.online ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <HealthItem
                    icon={<Battery size={16} />}
                    label="Battery"
                    value={typeof device.batteryPercent === 'number'
                      ? `${device.batteryPercent}%`
                      : 'Unknown'}
                    warning={lowBattery}
                  />
                  <HealthItem
                    icon={<ShieldCheck size={16} />}
                    label="Permissions"
                    value={permissionSummary(device)}
                    warning={permissionSummary(device).startsWith('0/')}
                  />
                  <HealthItem
                    label="App"
                    value={device.appVersion || 'Unknown'}
                  />
                  <HealthItem
                    label="Android"
                    value={device.androidVersion || 'Unknown'}
                  />
                </div>

                <div className="mt-5 border-t border-slate-800 pt-4 text-xs text-slate-400">
                  <p>Last seen: {lastSeenLabel(device.lastSeen)}</p>
                  <p className={device.syncHealthy === false ? 'mt-2 text-rose-400' : 'mt-2'}>
                    Sync: {device.syncHealthy === false
                      ? `${device.syncFailureSource || 'Unhealthy'} (${device.syncFailureCount || 0} failures)`
                      : device.syncHealthy === true
                        ? 'Healthy'
                        : 'Not reported'}
                  </p>
                  {device.syncErrorMessage && (
                    <p className="mt-2 break-words text-rose-300">
                      {device.syncErrorMessage}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && !error && filteredDevices.length === 0 && (
        <p className="py-16 text-center text-sm text-slate-500">
          No matching devices.
        </p>
      )}
    </InternalLayout>
  );
}

function HealthItem({
  icon,
  label,
  value,
  warning = false
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-slate-950 p-3">
      <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-600">
        {icon}{label}
      </p>
      <p className={`font-bold ${warning ? 'text-rose-400' : 'text-slate-200'}`}>
        {value}
      </p>
    </div>
  );
}
