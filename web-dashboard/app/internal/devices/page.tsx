"use client";

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wifi,
  WifiOff
} from 'lucide-react';
import InternalLayout from '@/components/InternalLayout';
import {
  AdminDeviceHealth,
  AdminRepository
} from '@/lib/repositories/AdminRepository';
import {
  ConfigRepository,
  UpdateConfig
} from '@/lib/repositories/ConfigRepository';

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

function normalizedVersion(version?: string) {
  return (version || '').trim().replace(/^v/i, '');
}

function isLatestVersion(deviceVersion: string | undefined, latestVersion: string) {
  return normalizedVersion(deviceVersion) === normalizedVersion(latestVersion);
}

export default function InternalDevicesPage() {
  const [devices, setDevices] = useState<AdminDeviceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [updateConfig, setUpdateConfig] = useState<UpdateConfig | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      AdminRepository.getDeviceHealth(),
      ConfigRepository.getUpdateConfig()
    ])
      .then(([deviceData, config]) => {
        if (active) {
          setDevices(deviceData);
          setUpdateConfig(config);
        }
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
  const latestVersion = updateConfig?.latestVersionName || '';
  const reportingDevices = devices.filter(device => Boolean(device.appVersion));
  const currentVersionCount = latestVersion
    ? reportingDevices.filter(device =>
        isLatestVersion(device.appVersion, latestVersion)
      ).length
    : 0;
  const updatePendingCount = latestVersion
    ? reportingDevices.length - currentVersionCount
    : 0;
  const unknownVersionCount = devices.length - reportingDevices.length;
  const adoptionPercentage = reportingDevices.length > 0 && latestVersion
    ? Math.round((currentVersionCount / reportingDevices.length) * 100)
    : 0;
  const versionDistribution = Array.from(
    reportingDevices.reduce((counts, device) => {
      const version = normalizedVersion(device.appVersion) || 'Unknown';
      counts.set(version, (counts.get(version) || 0) + 1);
      return counts;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

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

      {!loading && !error && (
        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="text-rose-500" size={20} />
                <h2 className="font-black uppercase tracking-wider text-white">
                  App Version Adoption
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Latest published release: {latestVersion ? `v${latestVersion}` : 'Not configured'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-400">
              {adoptionPercentage}% adopted
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <RolloutMetric
              icon={<CheckCircle2 size={17} />}
              label="Latest version"
              value={String(currentVersionCount)}
              tone="healthy"
            />
            <RolloutMetric
              icon={<AlertTriangle size={17} />}
              label="Update pending"
              value={String(updatePendingCount)}
              tone={updatePendingCount > 0 ? 'warning' : 'normal'}
            />
            <RolloutMetric
              icon={<Smartphone size={17} />}
              label="Version reported"
              value={String(reportingDevices.length)}
            />
            <RolloutMetric
              label="Unknown version"
              value={String(unknownVersionCount)}
              tone={unknownVersionCount > 0 ? 'warning' : 'normal'}
            />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400">Rollout progress</span>
              <span className="text-slate-500">
                {currentVersionCount}/{reportingDevices.length} reporting devices
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-950">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${adoptionPercentage}%` }}
              />
            </div>
          </div>

          {versionDistribution.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {versionDistribution.map(([version, count]) => (
                <span
                  key={version}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    isLatestVersion(version, latestVersion)
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  v{version}: {count}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

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
                    warning={Boolean(
                      latestVersion &&
                      device.appVersion &&
                      !isLatestVersion(device.appVersion, latestVersion)
                    )}
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

function RolloutMetric({
  icon,
  label,
  value,
  tone = 'normal'
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  tone?: 'normal' | 'healthy' | 'warning';
}) {
  const toneClass = tone === 'healthy'
    ? 'text-emerald-400'
    : tone === 'warning'
      ? 'text-amber-400'
      : 'text-white';

  return (
    <div className="rounded-2xl bg-slate-950 p-4">
      <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
        {icon}{label}
      </p>
      <p className={`text-2xl font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
