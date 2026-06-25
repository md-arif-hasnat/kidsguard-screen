/**
 * Haversine formula to calculate distance between two points in meters.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const r = 6371e3; // Earth's radius in meters
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return r * c;
}

export function formatDuration(minutes: number): string {
    if (minutes < 60) return `${Math.round(minutes)} mins`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
}
