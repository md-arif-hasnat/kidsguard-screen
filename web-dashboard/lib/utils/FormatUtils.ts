/**
 * Formats duration from milliseconds into human readable string
 * under 1 minute: “28 sec”
 * 1–59 minutes: “18 min”
 * 1 hour 20 minutes: “1h 20m”
 * 2 hours: “2h”
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return "0 sec";

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} sec`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Formats duration from seconds into human readable string
 */
export function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 sec";
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m} min ${s} sec`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h} hr ${remM} min`;
}

/**
 * Formats last used timestamp into human readable relative string
 * “Just now”, “8 min ago”, “Today, 14:20”, “Yesterday, 21:10”, or date
 */
export function formatLastUsed(timestamp: number): string {
  if (!timestamp) return "Never";

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";

  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min ago`;
  }

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  return `${date.toLocaleDateString()} ${timeStr}`;
}

/**
 * Formats location address from stored fields
 */
export function formatAddress(point: any): { street: string, area: string } {
  if (!point) return { street: "Address unavailable", area: "" };

  const street = point.fullAddress?.trim() ||
                [point.street, point.postalCode, point.city, point.country].filter(Boolean).join(", ") ||
                point.address?.trim() ||
                "Address unavailable";

  const area = point.fullAddress ? [point.city, point.country].filter(Boolean).join(", ") : "";

  return { street, area };
}
