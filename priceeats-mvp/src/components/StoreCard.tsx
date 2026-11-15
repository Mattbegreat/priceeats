'use client';

import { useState } from 'react';
import { formatDistance } from '@/lib/geo/haversine';
import { GROUP_PREVIEW, type StoreGroup } from '@/lib/search/group';
import { isMultiServing } from '@/lib/search/multi-serving';
import type { FoodView } from '@/types';
import { RatingText, TestDataTag, UpdatedText, VerificationBadge } from './Badges';
import { FoodImage } from './FoodImage';

function DishRow({ view, today, onOpen }: { view: FoodView; today: Date; onOpen: (id: string) => void }) {
  const { food, restaurant, verification, freshness } = view;
  return (
    <button
      type="button"
      onClick={() => onOpen(food.id)}
      aria-label={`${food.name} ${food.price} 元，${restaurant.name}，查看詳情`}
      data-testid="food-card"
      data-price={food.price}
      className="flex w-full items-start gap-3 py-2 text-left"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-canvas">
        <FoodImage src={food.image_url} alt={food.name} category={view.categoryName} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="flex flex-wrap items-center gap-1.5 text-base font-semibold leading-snug">
          {food.name}
          {isMultiServing(view) && (
            <span className="rounded-md bg-gray-200 px-1.5 py-0.5 text-[11px] font-medium text-gray-700" data-testid="multi-tag">
              多人份
            </span>
          )}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <VerificationBadge v={verification} freshness={freshness} />
          <UpdatedText v={verification} freshness={freshness} today={today} />
        </p>
      </div>
      <span className="shrink-0 text-2xl font-bold leading-none text-forest tabular-nums" data-testid="card-price">
        ${food.price}
      </span>
    </button>
  );
}

/** 一家店一張卡：顯示最貼近預算的 3 道，可展開看全部 */
export function StoreCard({ group, today, onOpen }: { group: StoreGroup; today: Date; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { restaurant, distanceM, rating } = group.head;
  const shown = open ? group.items : group.items.slice(0, GROUP_PREVIEW);
  const rest = group.items.length - GROUP_PREVIEW;
  return (
    <div className="rounded-card border border-line bg-white p-3" data-testid="store-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-base font-bold leading-snug">{restaurant.name}</h2>
        {restaurant.is_test_data && <TestDataTag />}
      </div>
      <p className="mt-0.5 text-sm text-mute">
        {formatDistance(distanceM)}
        {restaurant.is_test_data && (
          <>
            {' · '}
            <RatingText rating={rating} isTest />
          </>
        )}
        {' · '}共 {group.items.length} 道
      </p>
      <div className="mt-1 divide-y divide-line">
        {shown.map((v) => (
          <DishRow key={v.food.id} view={v} today={today} onOpen={onOpen} />
        ))}
      </div>
      {rest > 0 && (
        <button
          type="button"
          aria-expanded={open}
          data-testid="store-expand"
          onClick={() => setOpen((o) => !o)}
          className="tap mt-1 w-full rounded-lg border border-line text-sm font-semibold text-forest"
        >
          {open ? '收合' : `展開其餘 ${rest} 道`}
        </button>
      )}
    </div>
  );
}
