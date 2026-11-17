'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { walkOrKm } from '@/lib/geo/walk';
import { foodShareText } from '@/lib/share';
import { updatedLabel } from '@/lib/pricing/freshness';
import { REPORT_LABEL, REPORT_TYPES, validateReport } from '@/lib/pricing/report';
import { STATUS_LABEL } from '@/lib/pricing/verification';
import type { FoodBase } from '@/lib/search/filter';
import { sameStoreAlternatives } from '@/lib/search/same-store';
import type { Repository } from '@/repositories/types';
import type { Dataset, FoodView, PriceVerification, ReportType, SearchParams } from '@/types';
import { MapsReviewLink, RatingText, TestDataTag } from './Badges';
import { LeaderRow } from './Receipt';
import { ShareButton } from './ShareButton';

/** 價格來自菜單照片辨識但沒有可顯示的照片：照片未公開；其餘才是尚無照片 */
export function noPhotoText(v: PriceVerification | null): string {
  return v && (v.source_type === 'menu_photo' || v.verification_status === 'menu_photo') ? '菜單照片未公開' : '尚無菜單照片';
}

function AltRows({ items, onSwitch }: { items: FoodBase[]; onSwitch: (id: string) => void }) {
  return (
    <>
      {items.map((b) => (
        <button
          key={b.food.id}
          type="button"
          onClick={() => onSwitch(b.food.id)}
          aria-label={`${b.food.name} ${b.food.price} 元，查看`}
          className="flex min-h-[44px] w-full items-center text-left"
        >
          <LeaderRow left={b.food.name} right={b.food.price} />
        </button>
      ))}
    </>
  );
}

/** 餐點頁：一張長收據；底部固定「導航過去」＋「分享」 */
export function FoodDetailSheet({
  view,
  data,
  index,
  params,
  today,
  repo,
  isFav,
  backLabel,
  onToggleFav,
  onClose,
  onSwitch,
  onReported,
  onNavigate,
  onUploadMenu,
}: {
  view: FoodView;
  data: Dataset;
  index: FoodBase[];
  params: SearchParams;
  today: Date;
  repo: Repository;
  isFav: boolean;
  backLabel: string;
  onToggleFav: () => void;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onReported: () => void;
  /** 按「導航過去」(追蹤用，可省略) */
  onNavigate?: () => void;
  onUploadMenu: () => void;
}) {
  const { food, restaurant, verification, freshness } = view;
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reporting, setReporting] = useState(false);
  const history = useMemo(
    () =>
      data.verifications
        .filter((v) => v.food_id === food.id)
        .sort((a, b) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime()),
    [data.verifications, food.id],
  );
  const menuImages = data.menuImages.filter((m) => m.restaurant_id === restaurant.id);
  const alt = useMemo(() => sameStoreAlternatives(index, view, params), [index, view, params]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // 換到同店另一道時捲回頂端、收起回報表單
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setReporting(false);
  }, [food.id]);

  const navUrl = `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${food.name} 餐點詳情`}
      data-testid="detail-sheet"
      className="fixed inset-0 z-40 bg-ground"
    >
      <div className="mx-auto flex h-full max-w-xl flex-col">
      <div className="flex items-center justify-between px-5 pt-3">
        <button ref={closeRef} type="button" onClick={onClose} className="tap inline-flex items-center text-[15px] font-bold">
          {backLabel}
        </button>
        <button
          type="button"
          aria-pressed={isFav}
          data-testid="fav-toggle"
          onClick={onToggleFav}
          className="link-carbon justify-end text-[15px]"
        >
          {isFav ? '已收藏' : '收藏'}
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
        <div className="receipt !px-[18px] !pb-[18px] !pt-[22px]">
          <div className="flex flex-col gap-1 border-b-2 border-dashed border-ink pb-3.5 text-center">
            <h2 className="text-[20px] font-black">{restaurant.name}</h2>
            {restaurant.is_test_data && (
              <p className="flex flex-wrap items-center justify-center gap-x-2 text-small">
                <TestDataTag />
                <RatingText rating={view.rating} isTest />
              </p>
            )}
            <p className="text-small">{restaurant.address}</p>
            <p className="amount text-small text-carbon">{walkOrKm(view.distanceM)}</p>
          </div>

          <div className="mt-3.5 flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="text-[clamp(24px,8vw,30px)] font-black leading-tight">{food.name}</h3>
              <span className="text-small">店內價，以現場為準</span>
              {food.description && <span className="text-small">{food.description}</span>}
            </div>
            <span className="amount shrink-0 text-[clamp(40px,14vw,56px)] leading-[0.95] tracking-[-2px]" data-testid="detail-price">
              ${food.price}
            </span>
          </div>

          <dl className="mt-3.5 flex flex-col gap-1.5 border-t-2 border-ink pt-3 text-aux">
            <div className="flex items-center justify-between gap-3">
              <dt>價格更新</dt>
              <dd className="amount text-right">{verification && freshness ? updatedLabel(verification.verified_at, freshness) : '尚未驗證'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>來源</dt>
              <dd className="text-right font-bold">{verification ? STATUS_LABEL[verification.verification_status] : '尚未驗證'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>價格不對？</dt>
              <dd>
                <button type="button" aria-expanded={reporting} onClick={() => setReporting((o) => !o)} className="link-carbon text-aux">
                  回報新價格
                </button>
              </dd>
            </div>
          </dl>

          {reporting && (
            <ReportForm foodId={food.id} currentPrice={food.price} repo={repo} today={today} onReported={onReported} />
          )}

          {(alt.within.length > 0 || alt.extra.length > 0) && (
            <div className="mt-3.5 flex flex-col gap-0.5 border-t-2 border-dashed border-ink pt-3.5" data-testid="same-store">
              {alt.within.length > 0 && (
                <>
                  <h3 className="pb-1 text-[15px] font-black">這家店 {params.budget} 元內還有</h3>
                  <AltRows items={alt.within} onSwitch={onSwitch} />
                </>
              )}
              {alt.extra.length > 0 && (
                <>
                  <h3 className="pb-1 pt-2 text-[15px] font-black">多加一點預算</h3>
                  <AltRows items={alt.extra} onSwitch={onSwitch} />
                </>
              )}
            </div>
          )}

          {!restaurant.is_test_data && (
            <div className="mt-2">
              <MapsReviewLink name={restaurant.name} address={restaurant.address} />
            </div>
          )}
        </div>

        <div className="receipt mt-8" aria-label="價格歷史與菜單照片">
          <section aria-label="價格歷史">
            <h3 className="receipt-head text-[15px] font-black">價格歷史</h3>
            <ul className="mt-2 flex flex-col text-aux" data-testid="price-history">
              {history.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 border-b-2 border-dotted border-leader py-1.5 last:border-b-0">
                  <span>
                    <span className="amount">{new Date(v.verified_at).toISOString().slice(0, 10)}</span> · {STATUS_LABEL[v.verification_status]}
                    {v.report_type ? `（${REPORT_LABEL[v.report_type]}）` : ''}
                  </span>
                  <span className="amount shrink-0">{v.reported_price !== null ? `$${v.reported_price}` : '—'}</span>
                </li>
              ))}
              {history.length === 0 && <li className="py-1.5">尚無價格紀錄</li>}
            </ul>
          </section>
          <section aria-label="菜單照片" className="mt-4">
            <h3 className="receipt-head text-[15px] font-black">菜單照片</h3>
            {menuImages.length === 0 ? (
              <div className="mt-2 flex items-center justify-between gap-2 text-aux">
                <p>{noPhotoText(verification)}</p>
                <button type="button" onClick={onUploadMenu} className="link-carbon text-aux">
                  傳菜單
                </button>
              </div>
            ) : (
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {menuImages.map((m) => (
                  <li key={m.id} className="aspect-square overflow-hidden border-2 border-ink bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image_url} alt="菜單照片" loading="lazy" referrerPolicy="no-referrer" className="block h-full w-full object-cover" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-3 bg-ground px-5 pb-5 pt-3.5">
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="導航過去，用 Google 地圖開啟"
          onClick={onNavigate}
          className="btn-ink h-14 text-[18px]"
        >
          導航過去
        </a>
        <ShareButton
          getText={() => foodShareText(restaurant.name, food.name, food.price)}
          location="food"
          className="btn-line h-14 text-[18px]"
        />
      </div>
      </div>
    </div>
  );
}

function ReportForm({
  foodId,
  currentPrice,
  repo,
  today,
  onReported,
}: {
  foodId: string;
  currentPrice: number;
  repo: Repository;
  today: Date;
  onReported: () => void;
}) {
  const [type, setType] = useState<ReportType>('price_up');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsPrice = type === 'price_up' || type === 'price_down';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = needsPrice ? (price.trim() === '' ? null : Number(price)) : null;
    const input = { food_id: foodId, report_type: type, reported_price: priceNum, note: note.trim() ? note.trim() : null };
    const err = needsPrice && priceNum !== null && !Number.isFinite(priceNum) ? '請輸入數字' : validateReport(input, currentPrice);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await repo.submitReport(input, today);
      setSent(true);
      setPrice('');
      setNote('');
      onReported();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : '送出失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="價格回報" className="mt-3.5 border-t-2 border-dashed border-ink pt-3.5 text-aux">
      <h3 className="text-[15px] font-black">價格回報</h3>
      {sent ? (
        <p role="status" className="note-box mt-2 font-bold" data-testid="report-sent">
          已收到，待確認
        </p>
      ) : null}
      <form onSubmit={submit} className="mt-2 space-y-3" noValidate>
        <fieldset>
          <legend className="sr-only">回報類型</legend>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_TYPES.map((t) => (
              <label
                key={t}
                className={`relative flex min-h-[44px] cursor-pointer items-center justify-center border-2 border-ink px-2 text-center font-bold focus-within:outline focus-within:outline-[3px] focus-within:outline-carbon ${
                  type === t ? 'bg-ink text-paper' : 'bg-paper'
                }`}
              >
                <input
                  type="radio"
                  name="report_type"
                  value={t}
                  checked={type === t}
                  onChange={() => {
                    setType(t);
                    setSent(false);
                    setError(null);
                  }}
                  className="absolute -inset-0.5 h-[calc(100%+4px)] w-[calc(100%+4px)] cursor-pointer opacity-0"
                />
                {REPORT_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        {needsPrice && (
          <label className="flex items-center gap-2 font-bold">
            新價格
            <input
              type="text"
              inputMode="numeric"
              aria-label="新價格"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="field amount !w-28"
            />
            元
          </label>
        )}
        <label className="block">
          <span className="font-bold">{type === 'info_error' ? '說明 (必填)' : '補充說明 (選填)'}</span>
          <textarea
            aria-label="回報說明"
            rows={2}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field mt-1"
          />
        </label>
        {error && (
          <p role="alert" className="font-bold text-stamp">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-ink h-12 w-full text-[16px]">
          送出回報
        </button>
        <p className="text-small">回報會先標示為「待確認」，不會直接修改餐點價格。</p>
      </form>
    </section>
  );
}
