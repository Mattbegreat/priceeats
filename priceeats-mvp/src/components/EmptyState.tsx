'use client';

import { relaxSuggestions } from '@/lib/search/relax';
import type { FoodBase } from '@/lib/search/filter';
import type { SearchParams } from '@/types';

/** 空狀態：收據上印「查無資料」＋下一步按鈕 */
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
    <div className="receipt" data-testid="empty-state">
      <div className="receipt-head">
        <span className="text-store">查無資料</span>
      </div>
      <p className="mt-3 text-[16px] font-bold">找不到符合條件的餐點</p>
      <p className="mt-1 text-aux">試著放寬條件：</p>
      <div className="mt-3 flex flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s.kind}
            type="button"
            data-testid={`relax-${s.kind}`}
            onClick={() => onParams(s.kind === 'budget' ? { budget: s.params.budget } : { dist: s.params.dist })}
            className="btn-line min-h-[48px] justify-between px-5 text-[15px]"
          >
            <span>{s.label}</span>
            <span className="amount text-small">放寬後有 {s.count} 筆</span>
          </button>
        ))}
        {suggestions.length === 0 && <p className="text-aux">已是最寬鬆的預算與距離，請調整類型或最低評分。</p>}
      </div>
    </div>
  );
}
