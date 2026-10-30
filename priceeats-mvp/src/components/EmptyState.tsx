'use client';

import { SearchX } from 'lucide-react';
import { relaxSuggestions } from '@/lib/search/relax';
import type { FoodBase } from '@/lib/search/filter';
import type { SearchParams } from '@/types';

export function EmptyState({
  index,
  params,
  onParams,
}: {
  index: FoodBase[];
  params: SearchParams;
  onParams: (p: Partial<SearchParams>) => void;
}) {
  const suggestions = relaxSuggestions(index, params);
  return (
    <div className="rounded-card border border-line bg-white px-4 py-8 text-center" data-testid="empty-state">
      <SearchX className="mx-auto text-mute" aria-hidden />
      <p className="mt-2 text-base font-semibold">找不到符合條件的餐點</p>
      <p className="mt-1 text-sm text-mute">試著放寬條件：</p>
      <div className="mx-auto mt-4 flex max-w-sm flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s.kind}
            type="button"
            aria-label={`${s.label}，約 ${s.count} 筆`}
            data-testid={`relax-${s.kind}`}
            onClick={() => onParams(s.kind === 'budget' ? { budget: s.params.budget } : { dist: s.params.dist })}
            className="tap rounded-lg border border-forest bg-lime px-4 py-2 text-sm font-semibold text-forest"
          >
            {s.label}
            <span className="ml-2 font-normal">放寬後有 {s.count} 筆</span>
          </button>
        ))}
        {suggestions.length === 0 && <p className="text-sm text-mute">已是最寬鬆的預算與距離，請調整類型或最低評分。</p>}
      </div>
    </div>
  );
}
