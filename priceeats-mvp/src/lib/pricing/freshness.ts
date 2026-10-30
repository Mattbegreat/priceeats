import type { Freshness } from '@/types';

const DAY = 86_400_000;

/** verified_at 與 today 相差的整天數 (today 由參數注入；未來日期視為 0) */
export function daysBetween(verifiedAt: string | Date, today: Date): number {
  const v = typeof verifiedAt === 'string' ? new Date(verifiedAt) : verifiedAt;
  const diff = Math.floor((today.getTime() - v.getTime()) / DAY);
  return diff < 0 ? 0 : diff;
}

/** 0–30 天＝近期資料；31–90 天＝可能需要確認；>90 天＝舊資料 */
export function freshnessFromDays(days: number): Freshness {
  if (days <= 30) return 'recent';
  if (days <= 90) return 'maybe';
  return 'old';
}

export function freshnessOf(verifiedAt: string | Date, today: Date): Freshness {
  return freshnessFromDays(daysBetween(verifiedAt, today));
}

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  recent: '近期資料',
  maybe: '可能需要確認',
  old: '舊資料',
};

/** 文字 / 背景色 class (綠 / 黃 / 灰)，對比皆達 WCAG AA */
export const FRESHNESS_CLASS: Record<Freshness, string> = {
  recent: 'bg-green-100 text-green-800',
  maybe: 'bg-amber-100 text-amber-900',
  old: 'bg-gray-200 text-gray-700',
};

export function formatUpdated(verifiedAt: string, today: Date): string {
  const d = daysBetween(verifiedAt, today);
  if (d === 0) return '今天更新';
  if (d < 31) return `${d} 天前更新`;
  const dt = new Date(verifiedAt);
  return `${dt.getUTCFullYear()}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${String(dt.getUTCDate()).padStart(2, '0')} 更新`;
}
