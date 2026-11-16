import { CENTER_PRESETS, type CenterPreset } from './centers';

/** 入口頁的區域：slug 用英文，center 對應 CENTER_PRESETS 的名稱 */
export const AREAS = [
  { slug: 'nangang', center: '南港車站' },
  { slug: 'neihu', center: '內湖科技園區' },
  { slug: 'xinyi', center: '市政府站' },
  { slug: 'songshan', center: '松山車站' },
  { slug: 'xizhi', center: '汐止車站' },
  { slug: 'donghu', center: '東湖站' },
  { slug: 'zhongxiao', center: '忠孝復興站' },
  { slug: 'minsheng', center: '民生社區' },
] as const;

export type AreaSlug = (typeof AREAS)[number]['slug'];

/** 入口頁的預算 */
export const AREA_BUDGETS = [50, 100, 150] as const;
export type AreaBudget = (typeof AREA_BUDGETS)[number];

/** 入口頁與統計腳本共用的搜尋距離 (公尺，同前端預設) */
export const AREA_DIST_M = 500;

export interface AreaInfo extends CenterPreset {
  slug: AreaSlug;
}

export function findArea(slug: string): AreaInfo | null {
  const a = AREAS.find((x) => x.slug === slug);
  if (!a) return null;
  const c = CENTER_PRESETS.find((p) => p.name === a.center);
  return c ? { ...c, slug: a.slug } : null;
}

export function parseAreaBudget(raw: string): AreaBudget | null {
  const n = Number(raw);
  return (AREA_BUDGETS as readonly number[]).includes(n) ? (n as AreaBudget) : null;
}
