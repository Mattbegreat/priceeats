'use client';

import { Heart, Navigation, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { creditForImage } from '@/data/photo-credits';
import { formatDistance } from '@/lib/geo/haversine';
import { FRESHNESS_LABEL, formatUpdated } from '@/lib/pricing/freshness';
import { REPORT_LABEL, REPORT_TYPES, validateReport } from '@/lib/pricing/report';
import { STATUS_LABEL } from '@/lib/pricing/verification';
import type { Repository } from '@/repositories/types';
import type { Dataset, FoodView, ReportType } from '@/types';
import { MapsReviewLink, RatingText, TestDataTag, VerificationBadge } from './Badges';
import { FoodImage } from './FoodImage';

export function FoodDetailSheet({
  view,
  data,
  today,
  repo,
  isFav,
  onToggleFav,
  onClose,
  onReported,
  onUploadMenu,
}: {
  view: FoodView;
  data: Dataset;
  today: Date;
  repo: Repository;
  isFav: boolean;
  onToggleFav: () => void;
  onClose: () => void;
  onReported: () => void;
  onUploadMenu: () => void;
}) {
  const { food, restaurant, verification, freshness } = view;
  const closeRef = useRef<HTMLButtonElement>(null);
  const credit = creditForImage(food.image_url);
  const history = useMemo(
    () =>
      data.verifications
        .filter((v) => v.food_id === food.id)
        .sort((a, b) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime()),
    [data.verifications, food.id],
  );
  const menuImages = data.menuImages.filter((m) => m.restaurant_id === restaurant.id);

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

  const navUrl = `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" data-testid="detail-sheet">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${food.name} 餐點詳情`}
        className="relative z-10 flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-canvas md:rounded-card"
      >
        <div className="relative h-44 w-full shrink-0 bg-white md:h-56">
          <FoodImage src={food.image_url} alt={food.name} category={view.categoryName} />
          <button
            ref={closeRef}
            type="button"
            aria-label="關閉詳情"
            onClick={onClose}
            className="tap absolute right-2 top-2 flex items-center justify-center rounded-full bg-white/95 shadow"
          >
            <X aria-hidden />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold">{food.name}</h2>
              <span className="text-3xl font-bold leading-none text-forest tabular-nums" data-testid="detail-price">
                ${food.price}
              </span>
            </div>
            <p className="mt-1 text-xs text-mute">店內價格 (新台幣)</p>
            <p className="mt-2 text-sm text-mute">{food.description}</p>
          </div>

          <div className="rounded-card border border-line bg-white p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {restaurant.name}
              {restaurant.is_test_data && <TestDataTag />}
            </p>
            <p className="mt-1 text-mute">{restaurant.address}</p>
            <p className="mt-1 text-mute">
              距離 {formatDistance(view.distanceM)}
              {' · '}
              {restaurant.is_test_data ? (
                <RatingText rating={view.rating} isTest />
              ) : (
                <MapsReviewLink name={restaurant.name} address={restaurant.address} />
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="用 Google 地圖導航"
                className="tap inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 text-sm font-semibold text-white"
              >
                <Navigation size={16} aria-hidden />
                導航
              </a>
              <button
                type="button"
                aria-label={isFav ? '取消收藏' : '加入收藏'}
                aria-pressed={isFav}
                data-testid="fav-toggle"
                onClick={onToggleFav}
                className={`tap inline-flex items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold ${
                  isFav ? 'border-forest bg-lime text-forest' : 'border-line bg-white'
                }`}
              >
                <Heart size={16} aria-hidden fill={isFav ? 'currentColor' : 'none'} />
                {isFav ? '已收藏' : '收藏'}
              </button>
            </div>
          </div>

          <section aria-label="價格來源與驗證" className="rounded-card border border-line bg-white p-3 text-sm">
            <h3 className="font-semibold">價格資訊</h3>
            {verification && freshness ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-mute">驗證狀態</dt>
                <dd>
                  <VerificationBadge v={verification} freshness={freshness} />
                </dd>
                <dt className="text-mute">資料新鮮度</dt>
                <dd>{FRESHNESS_LABEL[freshness]}</dd>
                <dt className="text-mute">價格更新</dt>
                <dd>{formatUpdated(verification.verified_at, today)}</dd>
                <dt className="text-mute">來源</dt>
                <dd>{STATUS_LABEL[verification.verification_status]}</dd>
              </dl>
            ) : (
              <p className="mt-2 text-mute">尚未驗證</p>
            )}
          </section>

          <section aria-label="價格歷史" className="rounded-card border border-line bg-white p-3 text-sm">
            <h3 className="font-semibold">價格歷史</h3>
            <ul className="mt-2 divide-y divide-line" data-testid="price-history">
              {history.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="text-mute">
                    {new Date(v.verified_at).toISOString().slice(0, 10)} · {STATUS_LABEL[v.verification_status]}
                    {v.report_type ? `（${REPORT_LABEL[v.report_type]}）` : ''}
                  </span>
                  <span className="font-semibold tabular-nums">{v.reported_price !== null ? `$${v.reported_price}` : '—'}</span>
                </li>
              ))}
              {history.length === 0 && <li className="py-1.5 text-mute">尚無價格紀錄</li>}
            </ul>
          </section>

          <section aria-label="菜單照片" className="rounded-card border border-line bg-white p-3 text-sm">
            <h3 className="font-semibold">菜單照片</h3>
            {menuImages.length === 0 ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-mute">尚無菜單照片</p>
                <button
                  type="button"
                  aria-label="上傳菜單照片"
                  onClick={onUploadMenu}
                  className="tap rounded-lg border border-forest px-3 text-sm font-semibold text-forest"
                >
                  上傳菜單
                </button>
              </div>
            ) : (
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {menuImages.map((m) => (
                  <li key={m.id} className="aspect-square overflow-hidden rounded-lg bg-canvas">
                    <FoodImage src={m.image_url} alt="菜單照片" category={view.categoryName} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ReportForm
            foodId={food.id}
            currentPrice={food.price}
            repo={repo}
            today={today}
            onReported={onReported}
          />

          {credit && (
            <p className="text-xs text-mute">
              照片：
              <a className="underline" href={credit.pageUrl} target="_blank" rel="noopener noreferrer">
                {credit.title}
              </a>
              ，作者 {credit.author}，授權{' '}
              <a className="underline" href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
                {credit.license}
              </a>
              ，來源 Wikimedia Commons。
            </p>
          )}
          {!food.image_url && <p className="text-xs text-mute">圖片為示意插圖，非實際餐點照片。</p>}
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
    <section aria-label="價格回報" className="rounded-card border border-line bg-white p-3 text-sm">
      <h3 className="font-semibold">價格回報</h3>
      {sent ? (
        <p role="status" className="mt-2 rounded-lg bg-lime px-3 py-2 font-medium text-forest" data-testid="report-sent">
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
                className={`tap flex cursor-pointer items-center justify-center rounded-lg border px-2 text-center ${
                  type === t ? 'border-forest bg-lime font-semibold text-forest' : 'border-line bg-white'
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
                  className="sr-only"
                  aria-label={REPORT_LABEL[t]}
                />
                {REPORT_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        {needsPrice && (
          <label className="flex items-center gap-2">
            新價格
            <input
              type="text"
              inputMode="numeric"
              aria-label="新價格"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="tap w-28 rounded-lg border border-line px-3 tabular-nums"
            />
            元
          </label>
        )}
        <label className="block">
          <span className="text-mute">{type === 'info_error' ? '說明 (必填)' : '補充說明 (選填)'}</span>
          <textarea
            aria-label="回報說明"
            rows={2}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          aria-label="送出回報"
          disabled={busy}
          className="tap w-full rounded-lg bg-forest font-semibold text-white disabled:opacity-60"
        >
          送出回報
        </button>
        <p className="text-xs text-mute">回報會先標示為「待確認」，不會直接修改餐點價格。</p>
      </form>
    </section>
  );
}
