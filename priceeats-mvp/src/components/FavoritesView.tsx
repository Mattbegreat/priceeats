'use client';

import { type FoodBase, toView } from '@/lib/search/filter';
import type { SearchParams } from '@/types';
import { FoodCard } from './FoodCard';
import { PageTitle } from './Receipt';

export function FavoritesView({
  index,
  favs,
  params,
  today,
  onOpen,
}: {
  index: FoodBase[];
  favs: string[];
  params: SearchParams;
  today: Date;
  onOpen: (id: string) => void;
  onToggleFav: (id: string) => void;
}) {
  const items = favs
    .map((id) => index.find((b) => b.food.id === id))
    .filter((b): b is FoodBase => Boolean(b))
    .map((b) => toView(b, params));
  return (
    <div>
      <PageTitle
        title="收藏"
        aside={
          <span data-testid="fav-count" className="text-aux">
            共 <span className="amount">{items.length}</span> 道
          </span>
        }
      />
      {items.length === 0 ? (
        <div className="receipt" data-testid="fav-empty">
          <div className="receipt-head">
            <span className="text-store">查無資料</span>
          </div>
          <p className="mt-3 text-aux">還沒有收藏的餐點，在餐點頁按「收藏」即可加入。</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-6" data-testid="fav-list">
          {items.map((v) => (
            <li key={v.food.id}>
              <FoodCard view={v} budget={params.budget} today={today} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
