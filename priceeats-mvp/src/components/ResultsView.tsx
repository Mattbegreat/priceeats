'use client';

import type { FoodBase } from '@/lib/search/filter';
import { centerLabel } from '@/data/centers';
import type { FoodView, SearchParams } from '@/types';
import { EmptyState } from './EmptyState';
import { FilterBar } from './FilterBar';
import { FoodCard } from './FoodCard';
import type { LocProps } from './HomeView';

export function ResultsView({
  index,
  params,
  results,
  today,
  onParams,
  onOpen,
  loc,
}: {
  index: FoodBase[];
  params: SearchParams;
  results: FoodView[];
  today: Date;
  onParams: (p: Partial<SearchParams>) => void;
  onOpen: (id: string) => void;
  loc: LocProps;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <h1 className="text-xl font-bold text-forest">符合預算的餐點</h1>
        <p className="text-sm text-mute" data-testid="result-count" aria-live="polite">
          共 <span className="font-bold text-ink tabular-nums">{results.length}</span> 筆
        </p>
      </div>
      <p className="text-sm text-mute">
        搜尋中心：{loc.source === 'gps' ? '目前位置' : centerLabel(params)}
      </p>
      {loc.note && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" data-testid="location-note">
          {loc.note}
        </p>
      )}
      <FilterBar params={params} onParams={onParams} />
      {results.length === 0 ? (
        <EmptyState index={index} params={params} onParams={onParams} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="result-list">
          {results.map((v) => (
            <li key={v.food.id}>
              <FoodCard view={v} today={today} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
