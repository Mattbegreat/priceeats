import { IS_REAL_DATA } from '@/data/centers';
import type { Freshness } from '@/types';

const DAY = 86_400_000;

/** verified_at 與 today 相差的整天數 (today 由參數注入；未來日期視為 0) */
export function daysBetween(verifiedAt: string | Date, today: Date): number {
  const v = typeof verifiedAt === 'string' ? new Date(verifiedAt) : verifiedAt;
  const diff = Math.floor((today.getTime() - v.getTime()) / DAY);
  return diff < 0 ? 0 : diff;
}

/** 測試資料：0–30 天＝近期；31–90 天＝可能需要確認；>90 天＝舊資料 */
export const TEST_RECENT_DAYS = 30;
export const TEST_MAYBE_DAYS = 90;
/** 正式資料（菜單照片辨識，更新頻率低）：≤ 6 個月＝近期；6–18 個月＝可能需要確認；> 18 個月＝舊資料 */
export const REAL_RECENT_DAYS = 183;
export const REAL_MAYBE_DAYS = 548;

/** real 預設依建置模式 (IS_REAL_DATA)；測試可明確傳入 */
export function freshnessFromDays(days: number, real: boolean = IS_REAL_DATA): Freshness {
  const recent = real ? REAL_RECENT_DAYS : TEST_RECENT_DAYS;
  const maybe = real ? REAL_MAYBE_DAYS : TEST_MAYBE_DAYS;
  if (days <= recent) return 'recent';
  if (days <= maybe) return 'maybe';
  return 'old';
}

export function freshnessOf(verifiedAt: string | Date, today: Date, real: boolean = IS_REAL_DATA): Freshness {
  return freshnessFromDays(daysBetween(verifiedAt, today), real);
}

/** 更新年月 (UTC)：2026/03 */
export function formatUpdatedMonth(verifiedAt: string | Date): string {
  const dt = typeof verifiedAt === 'string' ? new Date(verifiedAt) : verifiedAt;
  return `${dt.getUTCFullYear()}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * 新鮮度文案：只顯示更新年月，例「2026/03」；
 * 6 個月內與 6–18 個月都不加字樣，超過 18 個月才標「2025/03（舊資料）」。
 */
export function updatedLabel(verifiedAt: string | Date, freshness: Freshness | null): string {
  const month = formatUpdatedMonth(verifiedAt);
  return freshness === 'old' ? `${month}（舊資料）` : month;
}
