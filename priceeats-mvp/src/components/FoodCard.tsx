'use client';

import { formatDistance } from '@/lib/geo/haversine';
import type { FoodView } from '@/types';
import { RatingText, TestDataTag, UpdatedText, VerificationBadge } from './Badges';
import { FoodImage } from './FoodImage';

export function FoodCard({ view, today, onOpen }: { view: FoodView; today: Date; onOpen: (id: string) => void }) {
  const { food, restaurant, verification, freshness } = view;
  return (
    <button
      type="button"
      onClick={() => onOpen(food.id)}
      aria-label={`${food.name} ${food.price} 元，${restaurant.name}，查看詳情`}
      data-testid="food-card"
      data-price={food.price}
      className="flex w-full gap-3 rounded-card border border-line bg-white p-3 text-left transition hover:border-forest focus-visible:border-forest"
    >
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-canvas">
        <FoodImage src={food.image_url} alt={food.name} category={view.categoryName} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-semibold leading-snug">{food.name}</h3>
          <span className="shrink-0 text-2xl font-bold leading-none text-forest tabular-nums" data-testid="card-price">
            ${food.price}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-mute">
          <span className="truncate">{restaurant.name}</span>
          {restaurant.is_test_data && <TestDataTag />}
        </p>
        <p className="mt-0.5 text-sm text-mute">
          {formatDistance(view.distanceM)}
          {restaurant.is_test_data && (
            <>
              {' · '}
              <RatingText rating={view.rating} isTest />
            </>
          )}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <VerificationBadge v={verification} freshness={freshness} />
          <UpdatedText v={verification} freshness={freshness} today={today} />
        </p>
      </div>
    </button>
  );
}
