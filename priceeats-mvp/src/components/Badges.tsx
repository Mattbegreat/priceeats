import { googleMapsReviewUrl } from '@/lib/geo/maps-url';
import { FRESHNESS_CLASS, FRESHNESS_LABEL, formatUpdated } from '@/lib/pricing/freshness';
import { STATUS_LABEL } from '@/lib/pricing/verification';
import type { Freshness, PriceVerification } from '@/types';

export function VerificationBadge({ v, freshness }: { v: PriceVerification | null; freshness: Freshness | null }) {
  if (!v || !freshness) {
    return <span className="rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">尚未驗證</span>;
  }
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${FRESHNESS_CLASS[freshness]}`} data-freshness={freshness}>
      {STATUS_LABEL[v.verification_status]}
    </span>
  );
}

export function UpdatedText({ v, freshness, today }: { v: PriceVerification | null; freshness: Freshness | null; today: Date }) {
  if (!v || !freshness) return <span className="text-xs text-mute">無更新紀錄</span>;
  return (
    <span className="text-xs text-mute">
      {FRESHNESS_LABEL[freshness]} · {formatUpdated(v.verified_at, today)}
    </span>
  );
}

export function TestDataTag() {
  return <span className="rounded-md border border-line bg-white px-1.5 py-0.5 text-[11px] font-medium text-mute">測試資料</span>;
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
      className="font-medium text-forest underline underline-offset-2"
    >
      在 Google Maps 看評價
    </a>
  );
}
