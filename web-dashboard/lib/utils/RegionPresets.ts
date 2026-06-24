export type RegionCode = 'DE' | 'BD' | 'US' | 'Global';

export interface MapRegion {
    lat: number;
    lng: number;
    zoom: number;
    name: string;
}

export const REGION_PRESETS: Record<RegionCode, MapRegion> = {
    'DE': {
        lat: 51.1912,
        lng: 6.4422,
        zoom: 13,
        name: 'Germany (Mönchengladbach)'
    },
    'BD': {
        lat: 23.8103,
        lng: 90.4125,
        zoom: 12,
        name: 'Bangladesh (Dhaka)'
    },
    'US': {
        lat: 40.7128,
        lng: -74.0060,
        zoom: 11,
        name: 'United States (New York)'
    },
    'Global': {
        lat: 20,
        lng: 0,
        zoom: 2,
        name: 'Global View'
    }
};

export const DEFAULT_REGION: RegionCode = 'DE';

/**
 * Returns the map center coordinates for a given region code.
 */
export const getRegionCenter = (code?: string | null): { lat: number, lng: number } => {
    const region = REGION_PRESETS[(code as RegionCode) || DEFAULT_REGION] || REGION_PRESETS[DEFAULT_REGION];
    return { lat: region.lat, lng: region.lng };
};

/**
 * Returns the default zoom level for a region.
 */
export const getRegionZoom = (code?: string | null): number => {
    const region = REGION_PRESETS[(code as RegionCode) || DEFAULT_REGION] || REGION_PRESETS[DEFAULT_REGION];
    return region.zoom;
};
