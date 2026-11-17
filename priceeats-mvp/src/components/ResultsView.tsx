'use client';

import { useMemo, useState } from 'react';
import { centerLabel } from '@/data/centers';
import { distLabel } from '@/lib/search/params';
import type { FoodBase } from '@/lib/search/filter';
import { groupByStore } from '@/lib/search/group';
import type { FoodView, SearchParams, SortKey } from '@/types';
import { EmptyState } from './EmptyState';
import { FilterDrawer } from './FilterDrawer';
import { LocationNote } from './LocationPanel';
import { ShareButton } from './ShareButton';
import { resultsShareText } from '@/lib/share';
import { StoreCard } from './StoreCard';
import type { LocProps } from './HomeView';

const SORT_PHRASE: Record<SortKey, string> = {
  budget: '最貼近預算',
  price: '最便宜',
  distance: '最近',
  rating: '評價最高',
};

export function ResultsView({
  index,
  params,
  results,
  today,
  onParams,
  onOpen,
  onUpload,
  loc,
}: {
  index: FoodBase[];
  params: SearchParams;
  results: FoodView[];
  today: Date;
  onParams: (p: Partial<SearchParams>) => void;
  onOpen: (id: string) => void;
  onUpload: () => void;
  loc: LocProps;
}) {
  const groups = useMemo(() => groupByStore(results), [results]);
  const [drawer, setDrawer] = useState(false);
  const where = loc.source === 'gps' ? '目前位置' : centerLabel(params);
  return (
    <div>
      <header className="space-y-2 pb-2.5">
        <div className="flex items-center justify-between text-small font-bold">
          <span>PriceEats</span>
          <span className="amount text-carbon" data-testid="center-text">
            {where} {distLabel(params.dist)}
          </span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <h1 className="text-title">
            今天的{params.cat === '不限' ? '餐點' : params.cat}
            <br />
            不超過
          </h1>
          <span className="amount text-[clamp(48px,17vw,64px)] leading-[0.95] tracking-[-2px]" data-testid="budget-value">
            ${params.budget}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-aux" data-testid="result-summary" aria-live="polite">
            <span data-testid="result-count">
              <span className="amount">{results.length}</span>
            </span>{' '}
            道{results.length > 0 && `，先列${SORT_PHRASE[params.sort]}的`}
            {results.length > 0 && <span className="sr-only" data-testid="store-count">{` · ${groups.length} 家店`}</span>}
          </p>
          <button type="button" data-testid="open-filter" onClick={() => setDrawer(true)} className="btn-ink h-11 shrink-0 px-4 text-[15px] font-bold">
            改條件
          </button>
          <ShareButton
            getText={() => resultsShareText(where, params.budget, results.length)}
            className="btn-line h-11 shrink-0 px-4 text-[15px] font-bold"
            location="results"
            testId="share-results"
          />
        </div>
      </header>
      <div className="mb-3">
        <LocationNote note={loc.note} />
      </div>
      {results.length === 0 ? (
        <EmptyState index={index} params={params} onParams={onParams} onPickArea={loc.onPickPreset} onUpload={onUpload} />
      ) : (
        <ul className="flex flex-col gap-6 pb-2" data-testid="result-list">
          {groups.map((g) => (
            <li key={g.restaurantId}>
              <StoreCard group={g} today={today} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
      {drawer && (
        <FilterDrawer
          params={params}
          onParams={onParams}
          count={results.length}
          loc={{ source: loc.source, locating: loc.locating, onUseGps: loc.onUseGps, onPickPreset: loc.onPickPreset }}
          onClose={() => setDrawer(false)}
        />
      )}
    </div>
  );
}
