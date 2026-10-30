'use client';

import { Search } from 'lucide-react';
import type { SearchParams } from '@/types';
import { BudgetControl } from './BudgetControl';
import { CategoryChips, DistanceChips } from './Chips';
import { LocationBar, type LocSource } from './LocationBar';

export interface LocProps {
  source: LocSource;
  note: string | null;
  locating: boolean;
  onUseGps: () => void;
  onPickPreset: (name: string) => void;
}

export function HomeView({
  params,
  onParams,
  onSearch,
  isMock,
  loc,
}: {
  params: SearchParams;
  onParams: (p: Partial<SearchParams>) => void;
  onSearch: () => void;
  isMock: boolean;
  loc: LocProps;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-5 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-forest">今天想花多少錢吃飯？</h1>
        <p className="mt-1 text-sm text-mute">Find food within your budget.</p>
      </div>
      {isMock && (
        <p className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-mute" data-testid="mock-banner">
          目前使用測試資料：店家、價格與評分皆為模擬，並非真實店家資料。
        </p>
      )}
      <section className="rounded-card border border-line bg-white p-4" aria-label="預算">
        <BudgetControl value={params.budget} onChange={(budget) => onParams({ budget })} />
      </section>
      <section aria-label="類型" className="space-y-2">
        <h2 className="text-sm font-semibold text-mute">類型</h2>
        <CategoryChips value={params.cat} onChange={(cat) => onParams({ cat })} />
      </section>
      <section aria-label="距離" className="space-y-2">
        <h2 className="text-sm font-semibold text-mute">距離</h2>
        <DistanceChips value={params.dist} onChange={(dist) => onParams({ dist })} />
      </section>
      <LocationBar lat={params.lat} lng={params.lng} {...loc} />
      <div className="sticky bottom-[4.25rem] z-20 -mx-4 bg-canvas/95 px-4 py-2">
        <button
          type="button"
          aria-label="搜尋"
          data-testid="search-button"
          onClick={onSearch}
          className="tap flex h-14 w-full items-center justify-center gap-2 rounded-card bg-forest text-lg font-bold text-white"
        >
          <Search size={20} aria-hidden />
          搜尋
        </button>
      </div>
    </div>
  );
}
