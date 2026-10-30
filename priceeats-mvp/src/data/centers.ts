import type { LatLng } from '@/types';

export interface CenterPreset extends LatLng {
  name: string;
}

export const DEFAULT_CENTER: CenterPreset = { name: '台北車站', lat: 25.0478, lng: 121.517 };

export const CENTER_PRESETS: CenterPreset[] = [
  DEFAULT_CENTER,
  { name: '西門', lat: 25.0421, lng: 121.5081 },
  { name: '中山', lat: 25.0527, lng: 121.5206 },
  { name: '公館', lat: 25.0148, lng: 121.5342 },
  { name: '桃園車站', lat: 24.9894, lng: 121.3138 },
];

export function centerLabel(p: LatLng): string {
  const hit = CENTER_PRESETS.find((c) => Math.abs(c.lat - p.lat) < 1e-4 && Math.abs(c.lng - p.lng) < 1e-4);
  return hit ? hit.name : '自訂位置';
}
