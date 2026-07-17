"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import LiveMap from '@/components/LiveMap';
import { MOCK_CHILDREN, MOCK_ACTIVITY, MOCK_SUMMARY, MOCK_SAFE_ZONES, MOCK_ROUTE_HISTORY, MOCK_DEVIATIONS } from '@/lib/mockData';
import {
  Battery,
  MapPin,
  Lock,
  Unlock,
  ShieldCheck as ShieldCheckIcon,
  Activity,
  ChevronRight,
  History,
  Zap,
  Play,
  RotateCcw,
  CloudOff,
  CheckCircle2,
  Info,
  Camera,
  LayoutDashboard,
  Brain,
  Smartphone,
  Calendar,
  ArrowRight,
  Loader2,
  Clock as ClockIcon,
  Smartphone as SmartphoneIcon,
  ShieldAlert,
  Shield,
  BarChart3,
  TrendingUp,
  Globe as GlobeIcon
} from 'lucide-react';
import { ChildRepository, ChildStatus } from '@/lib/repositories/ChildRepository';
import { LocationRepository, LocationPoint } from '@/lib/repositories/LocationRepository';
import { ActivityRepository, ActivityEvent } from '@/lib/repositories/ActivityRepository';
import { DailySummaryRepository, DailySummary } from '@/lib/repositories/DailySummaryRepository';
import { CommandRepository, CommandType } from '@/lib/repositories/CommandRepository';
import { SafeZoneRepository, SafeZone } from '@/lib/repositories/SafeZoneRepository';
import { DeviationRepository, RouteDeviation } from '@/lib/repositories/DeviationRepository';
import { AnalyticsRepository, DeviceAnalytics } from '@/lib/repositories/AnalyticsRepository';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AvatarPicker from '@/components/AvatarPicker';
import { isFirebaseConfigured, showMocks } from '@/lib/firebase';

import { useParentProfile } from '@/lib/context/ParentProfileContext';
import { FamilyData, FamilyRole } from '@/lib/repositories/FamilyRepository';
import { RoleHelper } from '@/lib/utils/RoleHelper';

import HealthCard from '@/components/analytics/HealthCard';
import DeviceCharts from '@/components/analytics/DeviceCharts';
import AIInsightPanel from '@/components/AIInsightPanel';
import AIReportCard from '@/components/AIReportCard';
import WeeklyReportPanel, { WeeklyReport } from '@/components/WeeklyReportPanel';
import ScheduleManager, { Schedule } from '@/components/ScheduleManager';
import { Siren } from 'lucide-react';

import ScreenTimeStats from '@/components/wellbeing/ScreenTimeStats';
import AppUsagePanel from '@/components/wellbeing/AppUsagePanel';
import WellbeingControls, { AppLimit, BlockRule } from '@/components/wellbeing/WellbeingControls';

import { WebProtectionRepository, WebRuleSet, WebActivityEvent, WebAccessRequest } from '@/lib/repositories/WebProtectionRepository';
import WebActivityPanel from '@/components/web/WebActivityPanel';
import WebProtectionControls from '@/components/web/WebProtectionControls';
import WebAccessRequestsPanel from '@/components/web/WebAccessRequestsPanel';
import RemoteControlPanel from '@/components/RemoteControlPanel';
import ChildAvatar from '@/components/ChildAvatar';
import ProtectionModePanel from '@/components/modes/ProtectionModePanel';
import RemoveChildDialog from '@/components/RemoveChildDialog';
import { useRouter } from 'next/navigation';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function StatCard({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-[10px] md:text-sm font-bold uppercase tracking-wider mb-1 md:mb-2">{label}</div>
          <div className="flex items-center gap-2 md:gap-3">
            <Icon className={cn("w-5 h-5 md:w-6 md:h-6", color)} />
            <span className="text-lg md:text-2xl font-bold text-slate-700 truncate">{value}</span>
          </div>
        </div>
    )
}

type Tab = 'overview' | 'intelligence' | 'wellbeing' | 'internet' | 'health' | 'modes';

export default function ChildDashboard() {
  const params = useParams();
  const childId = params.childId as string;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { profile, family, role, isChildAccessible, loading: profileLoading } = useParentProfile();
  const [status, setStatus] = useState<ChildStatus | null>(null);
  // ... rest of state
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [analytics, setAnalytics] = useState<DeviceAnalytics | null>(null);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [deviations, setDeviations] = useState<RouteDeviation[]>([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const router = useRouter();

  // Phase AD: Wellbeing State
  const [appUsage, setAppUsage] = useState<any[]>([]);
  const [appLimits, setAppLimits] = useState<AppLimit[]>([
    { packageName: 'com.google.android.youtube', appName: 'YouTube', dailyLimitMs: 60 * 60 * 1000, enabled: true },
    { packageName: 'com.zhiliaoapp.musically', appName: 'TikTok', dailyLimitMs: 30 * 60 * 1000, enabled: true }
  ]);
  const [blockRules, setBlockRules] = useState<BlockRule[]>([
    { packageName: 'com.instagram.android', appName: 'Instagram', isBlocked: false },
    { packageName: 'com.facebook.katana', appName: 'Facebook', isBlocked: true },
    { packageName: 'com.snapchat.android', appName: 'Snapchat', isBlocked: false },
    { packageName: 'com.roblox.client', appName: 'Roblox', isBlocked: false }
  ]);

  // Phase AE: Web Protection State
  const [webRules, setWebRules] = useState<WebRuleSet | null>(null);
  const [webActivity, setWebActivity] = useState<WebActivityEvent[]>([]);
  const [webRequests, setWebRequests] = useState<WebAccessRequest[]>([]);

  // Mock data for Phase AD
  const [mockSchedules, setMockSchedules] = useState<Schedule[]>([
    { id: '1', zoneId: 'zone_school', dayOfWeek: 1, arrivalTime: '08:30', enabled: true },
    { id: '2', zoneId: 'zone_home', dayOfWeek: 1, arrivalTime: '16:00', enabled: true }
  ]);

  const mockWeeklyReport: WeeklyReport = {
    weekStartDate: 'Oct 23, 2023',
    averageSafetyScore: 92,
    totalDistanceKm: 42.5,
    totalAlerts: 3,
    topVisitedZones: ['Home', 'School', 'Central Park'],
    safetyTrend: 'Improving',
    recommendations: [
        'Safe zone compliance is up by 15% this week.',
        'Consider increasing battery alerts as device health fluctuates.'
    ]
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !childId) return;

    // Multi-tenant Guard
    if (!profileLoading && !isChildAccessible(childId)) {
        console.warn(`SECURITY: Blocked access to child ${childId} for family ${family?.familyId}`);
        return;
    }

    const unsubStatus = ChildRepository.listenToChildStatus(childId, setStatus);
    const unsubLocation = LocationRepository.listenToLatestLocation(childId, (loc) => {
        console.log(`WEB DEBUG: Received child location for ${childId}:`, loc);
        setLocation(loc);
    });
    const unsubActivity = ActivityRepository.listenToActivity(childId, setActivities);
    const unsubSummary = DailySummaryRepository.listenToLatestSummary(childId, setSummary);
    const unsubHistory = LocationRepository.listenToLocationHistory(childId, setRouteHistory);
    const unsubDeviations = DeviationRepository.listenToDeviations(childId, setDeviations);
    const unsubAnalytics = AnalyticsRepository.listenToDailyAnalytics(childId, selectedDate, setAnalytics);

    const familyId = family?.familyId;
    if (!familyId) return;

    const unsubZones = SafeZoneRepository.listenToChildSafeZones(childId, familyId, setSafeZones);

    const unsubWebRules = WebProtectionRepository.listenToWebRules(childId, setWebRules);
    const unsubWebActivity = WebProtectionRepository.listenToWebActivity(childId, selectedDate, setWebActivity);
    const unsubWebRequests = WebProtectionRepository.listenToAccessRequests(childId, setWebRequests);

    return () => {
      unsubStatus();
      unsubLocation();
      unsubActivity();
      unsubSummary();
      unsubHistory();
      unsubDeviations();
      unsubZones();
      unsubAnalytics();
      unsubWebRules();
      unsubWebActivity();
      unsubWebRequests();
    };
  }, [childId, selectedDate, family?.familyId]);

  const canControl = RoleHelper.canSendRemoteCommands(role);
  const canManageWellbeing = RoleHelper.canManageChildren(role);
  const canManageWeb = RoleHelper.canManageWebProtection(role);

  const mockChild = MOCK_CHILDREN.find(c => c.id === childId) || MOCK_CHILDREN[0];

  const displayData = isFirebaseConfigured ? {
    name: status?.childName || "Loading...",
    battery: status?.batteryPercent || 0,
    isCharging: status?.charging || false,
    lastSeen: status?.lastSeen ? new Date(status.lastSeen).toLocaleTimeString() : "Updating...",
    currentZone: status?.currentZone || "Updating...",
    status: status?.kidGuardActive ? "LOCKED" : "UNLOCKED",
    lat: location?.latitude || 0,
    lng: location?.longitude || 0,
    accuracy: location?.accuracy || 20,
    activities: activities,
    summary: summary ? { score: summary.safetyScore, text: summary.summaryText } : null,
    avatarId: status?.avatarId,
    isLoading: status === null
  } : showMocks ? {
    ...mockChild,
    accuracy: 20,
    activities: MOCK_ACTIVITY,
    summary: MOCK_SUMMARY,
    avatarId: (mockChild as any).avatarId,
    isLoading: false
  } : {
    name: "Unknown",
    battery: 0,
    isCharging: false,
    lastSeen: "N/A",
    currentZone: "N/A",
    status: "UNLOCKED",
    lat: 0,
    lng: 0,
    accuracy: 0,
    activities: [],
    summary: null,
    avatarId: "child_1",
    isLoading: true
  };

  const handleCommand = async (type: CommandType) => {
    if (!isFirebaseConfigured) {
        alert("Firebase not configured. Commands disabled in mock mode.");
        return;
    }
    if (!profile || !family) return;
    try {
        await CommandRepository.sendCommand(
            childId,
            family.familyId,
            profile.uid,
            profile.displayName || "Parent",
            type
        );
    } catch (e) {
        alert("Failed to send command.");
    }
  };

  const handleAvatarSelect = async (newAvatarId: string) => {
    try {
      await ChildRepository.updateAvatar(childId, newAvatarId);
      setStatus(prev => prev ? { ...prev, avatarId: newAvatarId } : null);
      setShowAvatarPicker(false);
    } catch (err: any) {
      alert("Failed to update child avatar.");
    }
  };

  const displayZones = isFirebaseConfigured ? safeZones.map(z => ({
    id: z.id,
    name: z.name,
    lat: z.latitude,
    lng: z.longitude,
    radius: z.radiusMeters,
    type: z.type
  })) : MOCK_SAFE_ZONES;

  const displayRoute = isFirebaseConfigured ? routeHistory.map(p => ({
    lat: p.latitude,
    lng: p.longitude
  })) : MOCK_ROUTE_HISTORY;

  const displayDeviations = isFirebaseConfigured ? deviations.map(d => ({
    id: d.id,
    lat: d.latitude,
    lng: d.longitude,
    message: d.message,
    time: new Date(d.timestamp).toLocaleTimeString(),
    severity: d.severity
  })) : MOCK_DEVIATIONS;

  if (profileLoading) {
      return (
          <DashboardLayout>
              <div className="flex items-center justify-center py-20">
                  <Loader2 className="animate-spin text-primary-600" size={48} />
              </div>
          </DashboardLayout>
      );
  }

  if (isFirebaseConfigured && !isChildAccessible(childId)) {
      return (
          <DashboardLayout>
              <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 border-2 border-rose-100">
                      <ShieldAlert size={40} className="text-rose-500" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">Access Restricted</h2>
                  <p className="text-slate-500 max-w-md mx-auto mt-2 italic font-medium">
                      You do not have permission to view telemetry or manage data for this device.
                      If this is your child, ensure they are paired with your Family ID.
                  </p>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-all"
                  >
                      Return to Overview
                  </button>
              </div>
          </DashboardLayout>
      );
  }

  return (
    <DashboardLayout>
      {showRemoveDialog && family && (
        <RemoveChildDialog
          familyId={family.familyId}
          childId={childId}
          childName={displayData.name}
          onClose={() => setShowRemoveDialog(false)}
          onSuccess={() => router.push('/')}
        />
      )}
      {showAvatarPicker && (
        <AvatarPicker
          type="child"
          currentAvatarId={displayData.avatarId || "child_1"}
          onSelect={handleAvatarSelect}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            <ChildAvatar
              name={displayData.name}
              avatarId={displayData.avatarId}
              photoUrl={status?.photoUrl}
              size="xl"
              className="rounded-2xl transition-transform group-hover:scale-105"
            />
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="absolute -bottom-1 -right-1 bg-primary-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white hover:bg-primary-700 transition-colors"
            >
              <Camera size={14} />
            </button>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 truncate">{displayData.name}&apos;s Dashboard</h1>
            <p className="text-slate-500 font-medium text-sm truncate">Child Device: {childId}</p>
          </div>
        </div>

        <div className="flex w-full md:w-auto gap-3">
          <button
            onClick={() => handleCommand(CommandType.REFRESH_LOCATION)}
            disabled={!canControl}
            className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 px-4 md:px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <RotateCcw size={18} />
            <span className="hidden sm:inline">Refresh GPS</span>
            <span className="sm:hidden">GPS</span>
          </button>
          <button
            onClick={() => handleCommand(status?.kidGuardActive ? CommandType.UNLOCK_NOW : CommandType.LOCK_NOW)}
            disabled={!canControl}
            className={cn(
                "flex-1 md:flex-none text-white px-4 md:px-5 py-2.5 rounded-lg font-bold shadow-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50",
                status?.kidGuardActive ? 'bg-green-600 shadow-green-100 hover:bg-green-700' : 'bg-red-600 shadow-red-100 hover:bg-red-700'
            )}
          >
            {status?.kidGuardActive ? <Unlock size={18} /> : <Lock size={18} />}
            {status?.kidGuardActive ? 'Unlock' : 'Lock Now'}
          </button>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="max-w-full overflow-x-auto no-scrollbar mb-8 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-fit min-w-full md:min-w-0">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={LayoutDashboard} label="Overview" />
              <TabButton active={activeTab === 'intelligence'} onClick={() => setActiveTab('intelligence')} icon={Brain} label="Intelligence" />
              <TabButton active={activeTab === 'wellbeing'} onClick={() => setActiveTab('wellbeing')} icon={ClockIcon} label="Wellbeing" />
              <TabButton active={activeTab === 'internet'} onClick={() => setActiveTab('internet')} icon={GlobeIcon} label="Internet" />
              <TabButton active={activeTab === 'modes'} onClick={() => setActiveTab('modes')} icon={Shield} label="Modes" />
              <TabButton active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon={Smartphone} label="Device Health" />
          </div>
      </div>

      {activeTab === 'overview' && (
        <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                <StatCard label="Battery" value={`${displayData.battery}%`} icon={Battery} color={displayData.battery < 20 ? "text-red-500" : "text-primary-500"} />
                <StatCard label="Last Seen" value={displayData.lastSeen} icon={Zap} color={status?.online ? "text-yellow-500" : "text-slate-400"} />
                <StatCard label="Current Zone" value={displayData.currentZone} icon={MapPin} color="text-green-500" />
                <StatCard label="Security" value={displayData.status} icon={displayData.status === 'LOCKED' ? Lock : Unlock} color={displayData.status === 'LOCKED' ? "text-red-500" : "text-green-500"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[350px] md:h-[450px] relative">
                    {displayData.isLoading && !showMocks ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50 animate-pulse">
                            <p className="text-slate-400 font-bold italic">Establishing secure connection...</p>
                        </div>
                    ) : (
                        <>
                        <LiveMap
                            childLocation={{ lat: displayData.lat, lng: displayData.lng, accuracy: displayData.accuracy }}
                            defaultRegion={profile?.region}
                            avatarId={displayData.avatarId}
                            currentZoneName={displayData.currentZone}
                            safeZoneStatus={status?.safeZoneStatus}
                            safeZones={displayZones}
                            routeHistory={displayRoute}
                            deviations={displayDeviations}
                            followChild={true}
                        />
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md border border-slate-100 z-10">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Device Status</p>
                        <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full animate-pulse", status?.online ? "bg-green-500" : "bg-red-500")} />
                            <p className="text-sm font-bold text-slate-700">{isFirebaseConfigured ? (status?.online ? 'Connected' : 'Offline') : 'Mock Online'}</p>
                        </div>
                        </div>
                        </>
                    )}
                </section>

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <ShieldCheckIcon className="text-primary-600" />
                        Live Telemetry Panel
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <TelemetryItem label="GPS Accuracy" value={`±${displayData.accuracy.toFixed(1)}m`} status={displayData.accuracy < 30 ? "healthy" : "warning"} />
                        <TelemetryItem label="Move Speed" value={`${(location?.speed || 0).toFixed(1)} m/s`} status="healthy" />
                        <TelemetryItem label="Sync Delay" value={status?.lastSeen ? `${Math.round((Date.now() - status.lastSeen) / 1000)}s` : "N/A"} status={status?.lastSeen && (Date.now() - status.lastSeen < 60000) ? "healthy" : "warning"} />
                        <TelemetryItem label="App Version" value={status?.appVersion || "Unknown"} status="healthy" />
                    </div>
                </section>

                <section className="bg-primary-600 rounded-2xl p-6 md:p-8 text-white shadow-xl shadow-primary-100">
                    <div className="flex items-center gap-2 mb-4">
                    <ShieldCheckIcon size={24} />
                    <h2 className="text-xl font-bold">AI Daily Safety Summary</h2>
                    </div>
                    {displayData.summary ? (
                    <div className="flex flex-col md:flex-row items-start gap-6">
                        <div className="text-4xl font-black bg-white/20 w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center backdrop-blur-md shrink-0">
                        {displayData.summary.score}
                        </div>
                        <div>
                        <p className="text-primary-100 font-medium leading-relaxed italic text-sm md:text-base">
                            &quot;{displayData.summary.text}&quot;
                        </p>
                        <button className="mt-4 text-sm font-bold flex items-center gap-1 hover:text-primary-200 transition-colors">
                            View Full Report
                            <ChevronRight size={16} />
                        </button>
                        </div>
                    </div>
                    ) : (
                    <div className="py-4 text-center">
                        <p className="text-primary-100 italic text-sm">No safety summary generated for today yet. Data is analyzed every evening.</p>
                    </div>
                    )}
                </section>

                <section className="bg-rose-50 rounded-2xl p-6 md:p-8 border border-rose-100">
                    <h2 className="text-xl font-black text-rose-800 mb-2">Danger Zone</h2>
                    <p className="text-rose-600 text-sm font-medium mb-6">
                        Remove this device from your family. Monitoring will stop immediately and the child app will return to setup.
                    </p>
                    <button
                        onClick={() => setShowRemoveDialog(true)}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-rose-100 transition-all flex items-center gap-2 text-sm"
                    >
                        <ShieldAlert size={18} />
                        Remove Device
                    </button>
                </section>
                </div>

                <div className="space-y-8">
                {canControl && <RemoteControlPanel childId={childId} />}

                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Activity className="text-primary-500" size={20} />
                        <h2 className="font-bold">Activity Feed</h2>
                    </div>
                    <button className="text-xs font-bold text-primary-600">View All</button>
                    </div>
                    <div className="space-y-6">
                    {displayData.activities.length > 0 ? displayData.activities.map((item: any) => (
                        <div key={item.id} className="flex gap-4 items-start">
                        <div className="w-1 bg-slate-100 self-stretch rounded-full mt-2 ml-2" />
                        <div className="flex-1">
                            <p className="text-xs font-bold text-slate-400">
                                {typeof item.timestamp === 'number' ? new Date(item.timestamp).toLocaleTimeString() : item.time}
                            </p>
                            <p className="font-bold text-slate-700">{item.title}</p>
                            {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                        </div>
                        </div>
                    )) : (
                        <p className="text-center py-8 text-slate-400 italic text-sm">No activity recorded today.</p>
                    )}
                    </div>
                </section>
                </div>
            </div>
        </>
      )}

      {activeTab === 'intelligence' && (
          <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">Activity Intelligence</h2>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                      <Calendar size={16} className="text-slate-400" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-sm font-bold text-slate-700 outline-none"
                      />
                  </div>
              </div>

              {status && <AIInsightPanel status={status} />}

              {summary && <AIReportCard summary={summary} />}

              <div className="space-y-12">
                    <WeeklyReportPanel report={mockWeeklyReport} />

                    <ScheduleManager
                        safeZones={displayZones as any}
                        schedules={mockSchedules}
                        onAdd={(s) => setMockSchedules([...mockSchedules, { ...s, id: Math.random().toString() }])}
                        onDelete={(id) => setMockSchedules(mockSchedules.filter(s => s.id !== id))}
                    />

                    <div className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-[2.5rem] p-8 md:p-12 text-white shadow-xl shadow-primary-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                            <div>
                                <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                                    <TrendingUp className="text-white" />
                                </div>
                                <h3 className="text-3xl font-black mb-2">Advanced Safety Insights</h3>
                                <p className="text-primary-100 text-lg font-medium opacity-80">Generate a custom AI analysis based on specific dates and event types.</p>
                            </div>
                            <button className="bg-white text-primary-600 px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-primary-50 transition-all flex items-center gap-2">
                                Run Custom Analysis
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>

              {analytics ? (
                  <DeviceCharts data={analytics} />
              ) : (
                  <div className="py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                          <Brain size={40} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">No Intelligence Data Found</h3>
                      <p className="text-slate-500 max-w-xs mx-auto mt-2 italic text-sm">Detailed device analytics are processed nightly. Check back tomorrow for today&apos;s summary.</p>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'wellbeing' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex justify-between items-center">
                  <div>
                      <h2 className="text-2xl font-black text-slate-900">Digital Wellbeing</h2>
                      <p className="text-slate-500 font-medium">Manage screen time and app access for {displayData.name}.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                      <Calendar size={16} className="text-slate-400" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-sm font-bold text-slate-700 outline-none"
                      />
                  </div>
              </div>

              <ScreenTimeStats
                  todayMs={appUsage.reduce((acc, app) => acc + app.totalTimeMs, 0) || 12400000}
                  yesterdayMs={14200000}
                  avg7DayMs={11800000}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <AppUsagePanel usage={appUsage.length > 0 ? appUsage : [
                      { packageName: 'com.google.android.youtube', appName: 'YouTube', category: 'Video', totalTimeMs: 4200000, lastUsed: Date.now() },
                      { packageName: 'com.zhiliaoapp.musically', appName: 'TikTok', category: 'Social', totalTimeMs: 2800000, lastUsed: Date.now() },
                      { packageName: 'com.whatsapp', appName: 'WhatsApp', category: 'Messaging', totalTimeMs: 1500000, lastUsed: Date.now() },
                      { packageName: 'com.android.chrome', appName: 'Chrome', category: 'Browser', totalTimeMs: 900000, lastUsed: Date.now() }
                  ]} />

                  {canManageWellbeing ? (
                    <WellbeingControls
                        limits={appLimits}
                        blocks={blockRules}
                        onUpdateLimit={(l) => setAppLimits(appLimits.map(x => x.packageName === l.packageName ? l : x))}
                        onDeleteLimit={(pkg) => setAppLimits(appLimits.filter(x => x.packageName !== pkg))}
                        onToggleBlock={(pkg, val) => setBlockRules(blockRules.map(x => x.packageName === pkg ? {...x, isBlocked: val} : x))}
                    />
                  ) : (
                    <div className="bg-white rounded-[2rem] border border-slate-200 p-8 flex flex-col items-center justify-center text-center opacity-60">
                        <Shield className="text-slate-300 mb-4" size={48} />
                        <h3 className="font-bold text-slate-800">Managed by Parent</h3>
                        <p className="text-sm text-slate-500 mt-1 italic">You have Guardian access. Wellbeing rules can only be edited by Parents or Owners.</p>
                    </div>
                  )}
              </div>

              <section className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/20 rounded-full -mr-32 -mt-32 blur-3xl" />
                  <div className="relative z-10">
                      <h3 className="text-3xl font-black mb-4">Focus Schedules</h3>
                      <p className="text-slate-400 max-w-xl mb-10 text-lg">Automatically block non-educational apps during school or bedtime to help your child stay focused and rest well.</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <ScheduleCard
                            title="School Focus"
                            time="08:00 - 15:00"
                            days="Mon - Fri"
                            desc="Games and Social apps are blocked."
                            active={true}
                          />
                          <ScheduleCard
                            title="Bedtime"
                            time="21:00 - 07:00"
                            days="Daily"
                            desc="All non-emergency apps are blocked."
                            active={false}
                          />
                      </div>
                  </div>
              </section>
          </div>
      )}

      {activeTab === 'internet' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex justify-between items-center">
                  <div>
                      <h2 className="text-2xl font-black text-slate-900">Internet Protection</h2>
                      <p className="text-slate-500 font-medium">Safe browsing and content filtering for {displayData.name}.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
                      <Calendar size={16} className="text-slate-400" />
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-sm font-bold text-slate-700 outline-none"
                      />
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                  <div className="lg:col-span-2 space-y-12">
                    {canManageWeb ? (
                        <WebProtectionControls
                            rules={webRules || {
                                blockedDomains: [],
                                allowedDomains: [],
                                blockedCategories: [],
                                allowedCategories: [],
                                safeSearchEnabled: true,
                                youtubeRestrictedMode: true,
                                adultContentBlockEnabled: true
                            }}
                            onUpdate={(rules) => WebProtectionRepository.updateWebRules(childId, rules)}
                        />
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 flex flex-col items-center justify-center text-center opacity-60 mb-12">
                            <Shield className="text-slate-300 mb-4" size={48} />
                            <h3 className="font-bold text-slate-800">Managed by Parent</h3>
                            <p className="text-sm text-slate-500 mt-1 italic">Web protection rules can only be edited by Parents or Owners.</p>
                        </div>
                    )}
                    <WebActivityPanel events={webActivity} />
                  </div>
                  <div className="space-y-12">
                    {canManageWeb && (
                        <WebAccessRequestsPanel
                            requests={webRequests}
                            onHandle={(id, status, domain) => WebProtectionRepository.handleAccessRequest(childId, id, status, domain)}
                        />
                    )}
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'health' && (
          <div className="space-y-8 animate-in fade-in duration-500">
              <h2 className="text-xl font-bold text-slate-900">Device Health \u0026 Diagnostics</h2>
              {status ? (
                  <HealthCard status={status} />
              ) : (
                  <p>Loading device details...</p>
              )}
          </div>
      )}

      {activeTab === 'modes' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <ProtectionModePanel
                  childId={childId}
                  familyId={family?.familyId || ''}
                  safeZones={safeZones}
                  role={role}
              />
          </div>
      )}

    </DashboardLayout>
  );
}

function ControlBtn({ icon: Icon, label, onClick, color }: any) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-3 p-3 w-full bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors"
        >
            <Icon size={18} className={color} />
            <span className="text-sm font-bold text-slate-700">{label}</span>
        </button>
    )
}

function ScheduleCard({ title, time, days, desc, active }: any) {
    return (
        <div className={cn(
            "p-6 rounded-[2rem] border transition-all",
            active ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 opacity-50"
        )}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl",
                        active ? "bg-primary-500" : "bg-slate-700"
                    )}>
                        <ClockIcon size={18} />
                    </div>
                    <div>
                        <p className="font-bold">{title}</p>
                        <p className="text-xs text-slate-400 font-medium">{days} • {time}</p>
                    </div>
                </div>
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    active ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
                )} />
            </div>
            <p className="text-sm text-slate-300">{desc}</p>
        </div>
    )
}

function TelemetryItem({ label, value, status }: { label: string, value: string, status: 'healthy' | 'warning' | 'offline' }) {
    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
            <div className="flex items-center gap-2">
                <div className={cn(
                    "w-2 h-2 rounded-full",
                    status === 'healthy' ? "bg-emerald-500" : status === 'warning' ? "bg-orange-500" : "bg-red-500"
                )} />
                <span className="text-sm font-black text-slate-700">{value}</span>
            </div>
        </div>
    )
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap shrink-0",
                active ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
        >
            <Icon size={18} />
            {label}
        </button>
    )
}
