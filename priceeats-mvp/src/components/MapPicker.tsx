'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@/types';

const pin = L.divIcon({ className: '', html: '<div class="center-marker"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function Click({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** 上傳頁用的小地圖：點一下設定新店位置 */
export function MapPicker({ center, value, onPick }: { center: LatLng; value: LatLng | null; onPick: (p: LatLng) => void }) {
  return (
    <div className="h-56 overflow-hidden rounded-card border border-line" data-testid="map-picker">
      <MapContainer center={[value?.lat ?? center.lat, value?.lng ?? center.lng]} zoom={15} className="h-full w-full">
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者' />
        <Click onPick={onPick} />
        {value && <Marker position={[value.lat, value.lng]} icon={pin} />}
      </MapContainer>
    </div>
  );
}
