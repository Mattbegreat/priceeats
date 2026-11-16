'use client';

import { useState } from 'react';
import { walkOrKm } from '@/lib/geo/walk';
import { GROUP_PREVIEW, type StoreGroup } from '@/lib/search/group';
import { isMultiServing } from '@/lib/search/multi-serving';
import type { FoodView } from '@/types';
import { RatingText, TestDataTag } from './Badges';
import { LeaderRow, Stamp } from './Receipt';

function DishRow({ view, onOpen }: { view: FoodView; onOpen: (id: string) => void }) {
  const { food, restaurant, freshness } = view;
  return (
    <button
      type="button"
      onClick={() => onOpen(food.id)}
      aria-label={`${food.name} ${food.price} 元，${restaurant.name}，查看詳情`}
      data-testid="food-card"
      data-price={food.price}
      className="flex min-h-[44px] w-full items-center text-left"
    >
      <LeaderRow
        priceTestId="card-price"
        left={
          <>
            {food.name}
            {isMultiServing(view) && (
              <span className="ml-1.5 border-2 border-ink px-1 py-px align-middle text-[11px] font-bold leading-none" data-testid="multi-tag">
                多人份
              </span>
            )}
            {freshness === 'old' && (
              <span className="ml-1.5 text-small font-normal" data-testid="old-tag">
                舊資料
              </span>
            )}
          </>
        }
        right={food.price}
      />
    </button>
  );
}

/** 一家店一張收據：顯示最貼近預算的 3 道，可展開看全部；卡片底左「看這家全部 N 道」、右「預算內」印章 */
export function StoreCard({ group, onOpen }: { group: StoreGroup; today?: Date; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const { restaurant, distanceM, rating } = group.head;
  const shown = open ? group.items : group.items.slice(0, GROUP_PREVIEW);
  const canExpand = group.items.length > GROUP_PREVIEW;
  return (
    <div className="receipt !pb-3 !pt-3.5" data-testid="store-card">
      <div className="receipt-head">
        <h2 className="min-w-0 flex-1 truncate text-store" title={restaurant.name}>
          {restaurant.name}
        </h2>
        <span className="amount shrink-0 text-small text-carbon">{walkOrKm(distanceM)}</span>
      </div>
      {restaurant.is_test_data && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-small leading-tight">
          <TestDataTag />
          <RatingText rating={rating} isTest />
        </p>
      )}
      <div className="mt-1 flex flex-col">
        {shown.map((v) => (
          <DishRow key={v.food.id} view={v} onOpen={onOpen} />
        ))}
      </div>
      <div className="flex min-h-[32px] items-center justify-between">
        {canExpand ? (
          <button type="button" aria-expanded={open} data-testid="store-expand" onClick={() => setOpen((o) => !o)} className="link-carbon text-aux">
            {open ? '收合' : `看這家全部 ${group.items.length} 道`}
          </button>
        ) : (
          <span />
        )}
        <Stamp />
      </div>
    </div>
  );
}
