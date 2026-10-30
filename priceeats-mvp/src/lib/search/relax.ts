import { search, type FoodBase } from './filter';
import { DIST_OPTIONS } from './params';
import type { SearchParams } from '@/types';

export interface RelaxSuggestion {
  kind: 'budget' | 'dist';
  label: string;
  params: SearchParams;
  count: number;
}

export function nextDist(d: number): number | null {
  const next = DIST_OPTIONS.find((o) => o > d);
  return next ?? null;
}

/** Empty State 的放寬建議：預算 +50、距離擴大一級；同時算出放寬後的筆數 */
export function relaxSuggestions(index: FoodBase[], p: SearchParams): RelaxSuggestion[] {
  const out: RelaxSuggestion[] = [];
  const b = { ...p, budget: Math.min(2000, p.budget + 50) };
  if (b.budget !== p.budget) out.push({ kind: 'budget', label: '預算 +50', params: b, count: search(index, b).length });
  const nd = nextDist(p.dist);
  if (nd !== null) {
    const d = { ...p, dist: nd };
    out.push({ kind: 'dist', label: '距離擴大一級', params: d, count: search(index, d).length });
  }
  return out;
}
