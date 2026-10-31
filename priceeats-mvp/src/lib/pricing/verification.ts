import type { PriceVerification, VerificationStatus } from '@/types';

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  store_confirmed: '店家確認',
  menu_photo: '近期菜單照片辨識',
  user_report: '使用者回報',
  pos_online: '線上點餐價',
  brand_official: '品牌官網價',
  pending: '待確認',
};

/** foods 顯示的驗證狀態＝該餐點最新一筆非 pending 的 verification */
export function latestVerification(list: PriceVerification[]): PriceVerification | null {
  let best: PriceVerification | null = null;
  for (const v of list) {
    if (v.verification_status === 'pending') continue;
    if (!best || new Date(v.verified_at).getTime() > new Date(best.verified_at).getTime()) best = v;
  }
  return best;
}

/** 依 food_id 分組 */
export function groupByFood(list: PriceVerification[]): Map<string, PriceVerification[]> {
  const m = new Map<string, PriceVerification[]>();
  for (const v of list) {
    const arr = m.get(v.food_id);
    if (arr) arr.push(v);
    else m.set(v.food_id, [v]);
  }
  return m;
}
