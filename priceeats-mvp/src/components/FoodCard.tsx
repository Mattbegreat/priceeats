'use client';

import { distShort } from '@/lib/geo/format';
import type { SearchParams } from '@/types';
import type { FoodView } from '@/types';
import { RatingText, TestDataTag } from './Badges';
import { LeaderRow, Stamp } from './Receipt';

/** 收藏頁的餐點：一張小收據 (店名＋距離、一道餐點)；超出目前預算就不蓋「預算內」章 */
export function FoodCard({ view, budget, onOpen }: { view: FoodView; budget: SearchParams['budget']; today?: Date; onOpen: (id: string) => void }) {
  const { food, restaurant } = view;
  return (
    <div className="receipt" data-testid="fav-card">
      <div className="receipt-head">
        <h2 className="min-w-0 flex-1 truncate text-store" title={restaurant.name}>
          {restaurant.name}
        </h2>
        <span className="amount shrink-0 text-small text-carbon">{distShort(view.distanceM)}</span>
      </div>
      {restaurant.is_test_data && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small leading-tight">
          <TestDataTag />
          <RatingText rating={view.rating} isTest />
        </p>
      )}
      <button
        type="button"
        onClick={() => onOpen(food.id)}
        aria-label={`${food.name} ${food.price} 元，${restaurant.name}，查看詳情`}
        data-testid="food-card"
        data-price={food.price}
        className="mt-1.5 flex min-h-[44px] w-full items-center text-left"
      >
        <LeaderRow left={food.name} right={food.price} priceTestId="card-price" />
      </button>
      <div className="flex justify-end pt-1">{food.price <= budget ? <Stamp /> : <span className="text-small">超出目前預算</span>}</div>
    </div>
  );
}
