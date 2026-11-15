import { googleMapsReviewUrl } from '@/lib/geo/maps-url';
import { updatedLabel } from '@/lib/pricing/freshness';
import type { Freshness, PriceVerification } from '@/types';

/** 價格更新文案：只顯示更新年月；超過 18 個月 (測試資料 90 天) 才標「舊資料」 */
export function UpdatedText({ v, freshness }: { v: PriceVerification | null; freshness: Freshness | null }) {
  if (!v || !freshness) return <span className="text-small">無更新紀錄</span>;
  return <span className="amount text-small">{updatedLabel(v.verified_at, freshness)}</span>;
}

export function TestDataTag() {
  return <span className="inline-block border-2 border-ink px-1.5 py-px text-[12px] font-bold leading-tight">測試資料</span>;
}

/** 只用於測試資料 (mock)；正式資料不顯示評分數字，改用 MapsReviewLink */
export function RatingText({ rating, isTest }: { rating: number | null; isTest: boolean }) {
  if (rating === null) return <span>尚無評分</span>;
  return <span>{isTest ? `評分 ${rating.toFixed(1)}（測試資料）` : `Google 評分 ${rating.toFixed(1)}`}</span>;
}

export function MapsReviewLink({ name, address }: { name: string; address: string }) {
  return (
    <a
      href={googleMapsReviewUrl(name, address)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="maps-review-link"
      className="link-carbon text-aux"
    >
      在 Google Maps 看評價
    </a>
  );
}
