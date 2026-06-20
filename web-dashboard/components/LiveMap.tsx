"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle, Polyline, InfoWindow } from '@react-google-maps/api';
import { MapPin, AlertTriangle, Info } from 'lucide-react';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1rem'
};

const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278
};

const options = {
  disableDefaultUI: false,
  zoomControl: true,
};

interface LiveMapProps {
  childLocation: { lat: number; lng: number; accuracy: number; timestamp?: number } | null;
  safeZones: Array<{ id: string; name: string; lat: number; lng: number; radius: number }>;
  routeHistory: Array<{ lat: number; lng: number }>;
  deviations: Array<{ id: string; lat: number; lng: number; message: string; time: string; severity: string }>;
  followChild: boolean;
}

const LiveMap: React.FC<LiveMapProps> = ({
  childLocation,
  safeZones,
  routeHistory,
  deviations,
  followChild
}) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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

  useEffect(() => {
    if (map && followChild && childLocation) {
      map.panTo({ lat: childLocation.lat, lng: childLocation.lng });
    }
  }, [map, followChild, childLocation]);

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
      <div className="w-full h-full flex items-center justify-center bg-red-50 rounded-2xl text-red-600 border border-red-200">
        Error loading Google Maps
      </div>
    );
  }

  return isLoaded ? (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={childLocation ? { lat: childLocation.lat, lng: childLocation.lng } : defaultCenter}
      zoom={15}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={options}
    >
      {/* Route History Polyline */}
      {routeHistory.length > 0 && (
        <Polyline
          path={routeHistory}
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
      )}

      {/* Safe Zones */}
      {safeZones.map(zone => (
        <React.Fragment key={zone.id}>
          <Circle
            center={{ lat: zone.lat, lng: zone.lng }}
            radius={zone.radius}
            onClick={() => setSelectedZone(zone)}
            options={{
              fillColor: "#22c55e",
              fillOpacity: 0.1,
              strokeColor: "#22c55e",
              strokeOpacity: 0.8,
              strokeWeight: 2,
            }}
          />
          {selectedZone?.id === zone.id && (
            <InfoWindow
                position={{ lat: zone.lat, lng: zone.lng }}
                onCloseClick={() => setSelectedZone(null)}
            >
                <div className="p-1">
                    <p className="font-bold text-slate-900">{zone.name}</p>
                    <p className="text-xs text-slate-500">Radius: {zone.radius}m</p>
                </div>
            </InfoWindow>
          )}
        </React.Fragment>
      ))}

      {/* Deviations */}
      {deviations.map(dev => (
        <Marker
            key={dev.id}
            position={{ lat: dev.lat, lng: dev.lng }}
            icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png"
            }}
            title={`Deviation: ${dev.message}`}
        />
      ))}

      {/* Child Current Location Marker */}
      {childLocation && (
        <>
            <Marker
                position={{ lat: childLocation.lat, lng: childLocation.lng }}
                title="Current Location"
                icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: "#0ea5e9",
                    fillOpacity: 1,
                    strokeColor: "#ffffff",
                    strokeWeight: 2,
                    scale: 10
                }}
            />
            <Circle
                center={{ lat: childLocation.lat, lng: childLocation.lng }}
                radius={childLocation.accuracy}
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
