'use client';

import { DIST_OPTIONS, RATING_OPTIONS, SORTS, SORT_LABEL, distLabel } from '@/lib/search/params';
import type { SearchParams, SortKey } from '@/types';
import { BudgetControl } from './BudgetControl';
import { CategoryChips } from './Chips';

const sel = 'tap w-full rounded-lg border border-line bg-white px-2 text-sm font-medium';

/** 結果頁與地圖頁共用的篩選列；變動即時更新，不需再按搜尋 */
export function FilterBar({ params, onParams }: { params: SearchParams; onParams: (p: Partial<SearchParams>) => void }) {
  return (
    <section aria-label="篩選條件" className="space-y-3 rounded-card border border-line bg-white p-3">
      <BudgetControl compact value={params.budget} onChange={(budget) => onParams({ budget })} />
      <CategoryChips scroll value={params.cat} onChange={(cat) => onParams({ cat })} />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-mute">
          距離
          <select
            aria-label="距離"
            className={sel}
            value={params.dist}
            onChange={(e) => onParams({ dist: Number(e.target.value) })}
          >
            {DIST_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {distLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-mute">
          最低評分
          <select
            aria-label="最低評分"
            className={sel}
            value={params.minRating}
            onChange={(e) => onParams({ minRating: Number(e.target.value) })}
          >
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? '不限' : r.toFixed(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-mute">
          排序
          <select
            aria-label="排序"
            className={sel}
            value={params.sort}
            onChange={(e) => onParams({ sort: e.target.value as SortKey })}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          aria-label="含單點小菜與湯品"
          className="h-4 w-4"
          checked={params.sides}
          onChange={(e) => onParams({ sides: e.target.checked })}
        />
        含單點小菜、湯品
      </label>
    </section>
  );
}
