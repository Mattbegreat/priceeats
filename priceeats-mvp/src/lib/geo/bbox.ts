import type { LatLng } from '@/types';

const EARTH_RADIUS_KM = 6371.0088;
const DEG = 180 / Math.PI;

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** 由中心與半徑 (公里) 換算經緯度方框；經度跨度依緯度放大，涵蓋整個圓 */
export function boundingBox(center: LatLng, radiusKm: number): BoundingBox {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * DEG;
  const cos = Math.max(Math.cos((center.lat * Math.PI) / 180), 1e-6);
  const dLng = Math.min(dLat / cos, 180);
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}
