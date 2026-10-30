'use client';

import { Heart } from 'lucide-react';
import { type FoodBase, toView } from '@/lib/search/filter';
import type { SearchParams } from '@/types';
import { FoodCard } from './FoodCard';

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
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold text-forest">收藏</h1>
        <p className="text-sm text-mute" data-testid="fav-count">
          共 <span className="font-bold text-ink tabular-nums">{items.length}</span> 道
        </p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-card border border-line bg-white px-4 py-10 text-center text-mute" data-testid="fav-empty">
          <Heart className="mx-auto" aria-hidden />
          <p className="mt-2">還沒有收藏的餐點，在餐點詳情按愛心即可加入。</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="fav-list">
          {items.map((v) => (
            <li key={v.food.id}>
              <FoodCard view={v} today={today} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
