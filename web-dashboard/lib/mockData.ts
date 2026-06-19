export const MOCK_CHILDREN = [
  {
    id: "child_001",
    name: "Alex",
    battery: 85,
    isCharging: false,
    online: true,
    lastSeen: "2 mins ago",
    currentZone: "Home",
    status: "UNLOCKED",
    lat: 51.5074,
    lng: -0.1278
  },
  {
    id: "child_002",
    name: "Sam",
    battery: 15,
    isCharging: true,
    online: true,
    lastSeen: "Just now",
    currentZone: "School",
    status: "LOCKED",
    lat: 51.5150,
    lng: -0.1300
  }
];

export const MOCK_ACTIVITY = [
  { id: 1, type: "SAFE_ZONE_EXIT", title: "Left Home", time: "08:15 AM", date: "Today" },
  { id: 2, type: "SAFE_ZONE_ENTER", title: "Entered School", time: "08:45 AM", date: "Today" },
  { id: 3, type: "BATTERY_LOW", title: "Battery Low (15%)", time: "10:30 AM", date: "Today" },
  { id: 4, type: "REMOTE_LOCK", title: "Device Locked", time: "10:35 AM", date: "Today" }
];

export const MOCK_SOS = [
  { id: "sos_1", childName: "Alex", time: "Yesterday, 04:20 PM", resolved: true, location: "Grandma's House" }
];

export const MOCK_SUMMARY = {
  score: 92,
  text: "Alex had a safe day. No deviations from known routes were detected. Spent 6 hours at School and 1 hour at the Playground."
};
