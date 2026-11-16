/** 步行速度估計：直線距離每分鐘 70 公尺 (已含繞路折扣) */
export const WALK_M_PER_MIN = 70;
/** 超過這個距離改顯示公里 */
export const WALK_LABEL_MAX_M = 1500;

/** 直線距離 (公尺) → 步行分鐘，至少 1 分 */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALK_M_PER_MIN));
}

/** 店家卡、餐點頁的距離：≤ 1500m 顯示「走路約N分」（數字前後不留空格），超過顯示公里 (例 2.3km) */
export function walkOrKm(meters: number): string {
  if (meters <= WALK_LABEL_MAX_M) return `走路約${walkMinutes(meters)}分`;
  return `${(meters / 1000).toFixed(1)}km`;
}
