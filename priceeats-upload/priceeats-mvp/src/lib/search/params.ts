import { z } from 'zod';
import { CATEGORY_FILTERS } from '@/data/categories';
import { DEFAULT_CENTER, IS_REAL_DATA } from '@/data/centers';
import type { CategoryFilter, SearchParams, SortKey, ViewKey } from '@/types';

export const DIST_OPTIONS = [500, 1000, 2000, 5000] as const;
export const RATING_OPTIONS = [0, 3.5, 4, 4.5] as const;
export const QUICK_BUDGETS = [50, 100, 150, 200] as const;
export const SLIDER_MIN = 30;
export const SLIDER_MAX = 500;
export const SLIDER_STEP = 10;
export const VIEWS: ViewKey[] = ['home', 'results', 'map', 'upload', 'favorites'];
export const SORTS: SortKey[] = ['price', 'distance', 'rating'];
export const SORT_LABEL: Record<SortKey, string> = { price: '價格最低', distance: '距離最近', rating: '評價最高' };

export const DEFAULT_PARAMS: SearchParams = {
  budget: 100,
  cat: '不限',
  dist: 1000,
  sort: 'price',
  minRating: 0,
  // 正式資料預設只看主餐；Mock 測試資料維持全部顯示
  sides: !IS_REAL_DATA,
  lat: DEFAULT_CENTER.lat,
  lng: DEFAULT_CENTER.lng,
};

/** 預算驗證：1–2000 的整數 */
export const budgetSchema = z
  .number({ error: '請輸入數字' })
  .int({ error: '請輸入整數' })
  .min(1, { error: '預算最少 1 元' })
  .max(2000, { error: '預算最多 2000 元' });

/** 文字輸入 → 預算；失敗回傳錯誤訊息 */
export function parseBudgetInput(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === '') return { ok: false, error: '請輸入預算' };
  const n = Number(t);
  const r = budgetSchema.safeParse(n);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? '預算格式錯誤' };
  return { ok: true, value: r.data };
}

const numStr = (min: number, max: number) =>
  z
    .string()
    .transform((s) => Number(s))
    .pipe(z.number().min(min).max(max));

const querySchema = z.object({
  view: z.enum(['home', 'results', 'map', 'upload', 'favorites']).catch('home'),
  budget: numStr(1, 2000).pipe(z.number().int()).catch(DEFAULT_PARAMS.budget),
  cat: z
    .string()
    .refine((s): s is CategoryFilter => (CATEGORY_FILTERS as string[]).includes(s))
    .catch('不限'),
  dist: numStr(100, 50000).catch(DEFAULT_PARAMS.dist),
  sort: z.enum(['price', 'distance', 'rating']).catch('price'),
  minRating: numStr(0, 5).catch(0),
  sides: z.enum(['0', '1']).transform((v) => v === '1').catch(DEFAULT_PARAMS.sides),
  lat: numStr(-90, 90).catch(DEFAULT_PARAMS.lat),
  lng: numStr(-180, 180).catch(DEFAULT_PARAMS.lng),
  food: z.string().max(64).optional().catch(undefined),
});

export interface UrlState {
  view: ViewKey;
  params: SearchParams;
  food: string | null;
}

/** 從 URL query 還原狀態；任何非法值都退回預設 */
export function parseQuery(search: string): UrlState {
  const sp = new URLSearchParams(search);
  const raw: Record<string, string | undefined> = {};
  for (const k of ['view', 'budget', 'cat', 'dist', 'sort', 'minRating', 'sides', 'lat', 'lng', 'food']) {
    const v = sp.get(k);
    if (v !== null) raw[k] = v;
  }
  const q = querySchema.parse(raw);
  return {
    view: q.view,
    params: {
      budget: q.budget,
      cat: q.cat as CategoryFilter,
      dist: q.dist,
      sort: q.sort,
      minRating: q.minRating,
      sides: q.sides,
      lat: q.lat,
      lng: q.lng,
    },
    food: q.food ?? null,
  };
}

/** 狀態 → query string (預設值省略，網址保持簡短) */
export function buildQuery(state: UrlState): string {
  const sp = new URLSearchParams();
  const p = state.params;
  const d = DEFAULT_PARAMS;
  if (state.view !== 'home') sp.set('view', state.view);
  if (p.budget !== d.budget) sp.set('budget', String(p.budget));
  if (p.cat !== d.cat) sp.set('cat', p.cat);
  if (p.dist !== d.dist) sp.set('dist', String(p.dist));
  if (p.sort !== d.sort) sp.set('sort', p.sort);
  if (p.minRating !== d.minRating) sp.set('minRating', String(p.minRating));
  if (p.sides !== d.sides) sp.set('sides', p.sides ? '1' : '0');
  if (Math.abs(p.lat - d.lat) > 1e-6 || Math.abs(p.lng - d.lng) > 1e-6) {
    sp.set('lat', p.lat.toFixed(5));
    sp.set('lng', p.lng.toFixed(5));
  }
  if (state.food) sp.set('food', state.food);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function distLabel(m: number): string {
  return m < 1000 ? `${m}m` : `${m / 1000}km`;
}
