import type { LatLng } from '@/types';

const R = 6371008.8; // 地球平均半徑 (公尺)
const rad = (d: number) => (d * Math.PI) / 180;

/** Haversine 大圓距離，回傳公尺 */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10 || Math.round(m)} 公尺`;
  return `${(m / 1000).toFixed(1)} 公里`;
}

/** 由中心往 bearing(度) 方向移動 distM 公尺 (球面近似) */
export function offsetPoint(origin: LatLng, bearingDeg: number, distM: number): LatLng {
  const δ = distM / R;
  const θ = rad(bearingDeg);
  const φ1 = rad(origin.lat);
  const λ1 = rad(origin.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
}
