import { haversineM } from './haversine';
import type { LatLng } from '@/types';

/** 有資料的區域中心離使用者超過這個距離，就視為「不在涵蓋範圍」(公尺) */
export const COVERAGE_RADIUS_M = 3000;

export interface NearestArea<T extends LatLng> {
  area: T;
  distanceM: number;
}

/** 最近的區域中心 (haversine)；沒有區域時回傳 null */
export function nearestArea<T extends LatLng>(pos: LatLng, areas: readonly T[]): NearestArea<T> | null {
  let best: NearestArea<T> | null = null;
  for (const a of areas) {
    const d = haversineM(pos, a);
    if (best === null || d < best.distanceM) best = { area: a, distanceM: d };
  }
  return best;
}

/** 中心距所有區域中心都 > 3 公里時回傳最近一區，否則 null (在涵蓋範圍內，不需引導) */
export function outsideCoverage<T extends LatLng>(pos: LatLng, areas: readonly T[], limitM: number = COVERAGE_RADIUS_M): NearestArea<T> | null {
  const n = nearestArea(pos, areas);
  return n && n.distanceM > limitM ? n : null;
}
