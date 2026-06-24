"use client";

import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import { X, MapPin, Check, Info } from 'lucide-react';
import { getRegionCenter, getRegionZoom } from '@/lib/utils/RegionPresets';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '0.75rem'
};

interface MapLocationPickerProps {
  initialLocation?: { lat: number; lng: number } | null;
  defaultRegion?: string | null;
  radius: number;
  onSelect: (lat: number, lng: number) => void;
  onClose: () => void;
}

const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  initialLocation,
  defaultRegion,
  radius,
  onSelect,
  onClose
}) => {
  const [selectedPos, setSelectedMapPos] = useState<{ lat: number; lng: number } | null>(initialLocation || null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const center = selectedPos || getRegionCenter(defaultRegion);
  const zoom = selectedPos ? 16 : getRegionZoom(defaultRegion);

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setSelectedMapPos({
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      });
    }
  }, []);

  const handleConfirm = () => {
    if (selectedPos) {
      onSelect(selectedPos.lat, selectedPos.lng);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pick Safe Zone Location</h2>
            <p className="text-sm text-slate-500">Click on the map to set the center point</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="relative border-2 border-slate-100 rounded-2xl overflow-hidden mb-4">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={zoom}
                onClick={onMapClick}
                options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                }}
              >
                {selectedPos && (
                  <>
                    <Marker position={selectedPos} />
                    <Circle
                      center={selectedPos}
                      radius={radius}
                      options={{
                        fillColor: "#0ea5e9",
                        fillOpacity: 0.2,
                        strokeColor: "#0ea5e9",
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                      }}
                    />
                  </>
                )}
              </GoogleMap>
            ) : (
              <div className="w-full h-[400px] bg-slate-100 flex items-center justify-center animate-pulse">
                <p className="text-slate-400 font-bold italic">Loading Map Engine...</p>
              </div>
            )}

            {!selectedPos && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
                        <MapPin size={16} />
                        <span className="text-sm font-bold uppercase tracking-wider">Tap to Place</span>
                    </div>
                </div>
            )}
          </div>

          <div className="bg-primary-50 p-4 rounded-xl border border-primary-100 flex items-start gap-3 mb-6">
            <Info size={20} className="text-primary-600 shrink-0 mt-0.5" />
            <p className="text-sm text-primary-800 leading-relaxed font-medium">
                The circle represents the active monitoring area ({radius}m). Your child will be considered &quot;Safe&quot; while inside this boundary.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-100 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!selectedPos}
              onClick={handleConfirm}
              className="flex-1 px-6 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-200"
            >
              <Check size={20} />
              Set This Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapLocationPicker;
