"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle, Polyline, InfoWindow } from '@react-google-maps/api';
import { MapPin, AlertTriangle, Info } from 'lucide-react';
import { getRegionCenter, getRegionZoom } from '@/lib/utils/RegionPresets';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1rem'
};

const options = {
  disableDefaultUI: false,
  zoomControl: true,
};

/**
 * Normalizes various coordinate formats into { lat, lng }
 */
export const normalizeMapPoint = (point: any): { lat: number; lng: number } | null => {
  if (!point) return null;

  let lat: any, lng: any;

  if (typeof point.lat === 'number' && typeof point.lng === 'number') {
    lat = point.lat;
    lng = point.lng;
  } else if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
    lat = point.latitude;
    lng = point.longitude;
  } else if (typeof point._lat === 'number' && typeof point._long === 'number') {
    // Firestore GeoPoint-like
    lat = point._lat;
    lng = point._long;
  }

  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return { lat, lng };
  }

  return null;
};

/**
 * Normalizes an array of points for use with Polyline
 */
export const normalizeMapPath = (points: any[]): { lat: number; lng: number }[] => {
  if (!Array.isArray(points)) return [];
  return points
    .map(normalizeMapPoint)
    .filter((p): p is { lat: number; lng: number } => p !== null);
};

interface LiveMapProps {
  childLocation: { lat: number; lng: number; accuracy: number; timestamp?: number } | null;
  defaultRegion?: string | null;
  avatarId?: string | null;
  safeZones: Array<{ id: string; name: string; lat: number; lng: number; radius: number, type?: string }>;
  routeHistory: Array<{ lat: number; lng: number }>;
  deviations: Array<{ id: string; lat: number; lng: number; message: string; time: string; severity: string }>;
  followChild: boolean;
}

const LiveMap: React.FC<LiveMapProps> = ({
  childLocation,
  defaultRegion,
  avatarId,
  safeZones,
  routeHistory,
  deviations,
  followChild
}) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    console.log("LiveMap props:", { childLocation, hasSafeZones: safeZones.length, routePoints: routeHistory.length, followChild });
  }, [childLocation, safeZones, routeHistory, followChild]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || "",
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedZone, setSelectedZone] = useState<any>(null);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  const normalizedRoute = normalizeMapPath(routeHistory);
  const normalizedChildLoc = normalizeMapPoint(childLocation);

  const center = normalizedChildLoc || getRegionCenter(defaultRegion);
  const zoom = normalizedChildLoc ? 15 : getRegionZoom(defaultRegion);

  useEffect(() => {
    if (map && followChild && normalizedChildLoc) {
      map.panTo(normalizedChildLoc);
    }
  }, [map, followChild, normalizedChildLoc]);

  if (!apiKey) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 rounded-2xl text-slate-500 p-8 text-center border-2 border-dashed border-slate-300">
        <AlertTriangle size={48} className="mb-4 text-red-500" />
        <h3 className="text-xl font-bold text-slate-800">Google Maps API Key Missing</h3>
        <p className="mt-2">Please set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your <code>.env.local</code> file.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 rounded-2xl text-red-600 border border-red-200 p-6 text-center">
        <div className="flex flex-col items-center gap-2">
            <AlertTriangle size={32} />
            <p className="font-bold">Error loading Google Maps</p>
            <p className="text-xs">{loadError.message}</p>
        </div>
      </div>
    );
  }

  const hasLocation = normalizedChildLoc && !isNaN(normalizedChildLoc.lat) && !isNaN(normalizedChildLoc.lng);
  const hasHistory = normalizedRoute.length > 0;

  if (isLoaded && !hasLocation && !hasHistory && childLocation !== null) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-2xl text-slate-400 p-8 text-center">
              <MapPin size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-bold text-slate-600">No Location Available Yet</h3>
              <p className="text-sm max-w-xs mx-auto mt-2">We haven&apos;t received any GPS data from this device. Ensure tracking is enabled on the child&apos;s phone.</p>
          </div>
      )
  }

  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={zoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={options}
    >
      {/* Route History Polyline */}
      {normalizedRoute.length >= 2 ? (
        <Polyline
          path={normalizedRoute}
          options={{
            strokeColor: "#0ea5e9",
            strokeOpacity: 0.5,
            strokeWeight: 4,
            icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                offset: '100%',
                repeat: '100px'
            }]
          }}
        />
      ) : (
        normalizedRoute.length === 1 && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white/80 px-4 py-2 rounded-full shadow-sm text-xs font-bold text-slate-500 z-10">
                Not enough points for route line
            </div>
        )
      )}

      {normalizedRoute.length === 0 && routeHistory.length > 0 && (
         <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white/80 px-4 py-2 rounded-full shadow-sm text-xs font-bold text-slate-500 z-10">
            No valid route points available
         </div>
      )}

      {/* Safe Zones */}
      {safeZones.map(zone => {
        const center = normalizeMapPoint(zone);
        if (!center) return null;

        const iconUrl = zone.type === 'Home'
            ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
            : zone.type === 'School'
            ? "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
            : "https://maps.google.com/mapfiles/ms/icons/green-dot.png";

        return (
          <React.Fragment key={zone.id}>
            <Marker
              position={center}
              icon={{
                url: iconUrl,
                scaledSize: new google.maps.Size(32, 32)
              }}
              title={zone.name}
              onClick={() => setSelectedZone(zone)}
            />
            <Circle
              center={center}
              radius={zone.radius || 100}
              onClick={() => setSelectedZone(zone)}
              options={{
                fillColor: zone.type === 'Home' ? "#3b82f6" : zone.type === 'School' ? "#f59e0b" : "#22c55e",
                fillOpacity: 0.1,
                strokeColor: zone.type === 'Home' ? "#3b82f6" : zone.type === 'School' ? "#f59e0b" : "#22c55e",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
            {selectedZone?.id === zone.id && (
              <InfoWindow
                  position={center}
                  onCloseClick={() => setSelectedZone(null)}
              >
                  <div className="p-1">
                      <p className="font-bold text-slate-900">{zone.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{zone.type}</p>
                      <p className="text-xs text-slate-500 mt-1">Radius: {zone.radius}m</p>
                  </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}

      {/* Deviations */}
      {deviations.map(dev => {
        const pos = normalizeMapPoint(dev);
        if (!pos) return null;
        return (
          <Marker
              key={dev.id}
              position={pos}
              icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png"
              }}
              title={`Deviation: ${dev.message}`}
          />
        );
      })}

      {/* Child Current Location Marker */}
      {normalizedChildLoc && (
        <>
            <Marker
                position={normalizedChildLoc}
                title="Current Location"
                icon={avatarId ? {
                    url: `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarId}`,
                    scaledSize: new google.maps.Size(40, 40),
                    anchor: new google.maps.Point(20, 20)
                } : {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: "#0ea5e9",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                    scale: 10
                }}
            />
            <Circle
                center={normalizedChildLoc}
                radius={childLocation?.accuracy || 20}
                options={{
                    fillColor: "#0ea5e9",
                    fillOpacity: 0.1,
                    strokeColor: "#0ea5e9",
                    strokeOpacity: 0.3,
                    strokeWeight: 1,
                }}
            />
        </>
      )}
    </GoogleMap>
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-2xl animate-pulse">
      <p className="text-slate-400 font-medium">Loading Map...</p>
    </div>
  );
};

export default LiveMap;
