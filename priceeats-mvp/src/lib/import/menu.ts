import { z } from 'zod';
import { CATEGORY_NAMES, type CategoryName, type LatLng } from '@/types';

/** 信心低於此值的品項不寫入，只列在報告 */
export const MIN_CONFIDENCE = 0.8;

// ---------------------------------------------------------------
// Google Maps 網址 → 座標
// ---------------------------------------------------------------
const NUM = String.raw`-?\d{1,3}(?:\.\d+)?`;
const RE_PIN = new RegExp(`!3d(${NUM})!4d(${NUM})`); // 地點頁 data 參數：店家標記的精確座標
const RE_QUERY = new RegExp(`[?&](?:q|query|ll)=(${NUM}),\\s*(${NUM})(?:[&#]|$)`); // ?q=lat,lng、?api=1&query=lat,lng
const RE_AT = new RegExp(`@(${NUM}),(${NUM})`); // 地圖視窗中心 (@lat,lng,17z)

function inRange(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * 從 Google Maps 網址解析座標。支援：
 *  1. `!3d{lat}!4d{lng}`（地點頁，最精確，優先）
 *  2. `q=` / `query=` / `ll=` 後接 `lat,lng`
 *  3. `@lat,lng`（視窗中心）
 * 短網址 (maps.app.goo.gl) 與只有店名的搜尋網址無法離線解析，回傳 null。
 */
export function parseMapsCoords(url: string | null | undefined): LatLng | null {
  if (!url) return null;
  let text = url.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    /* 網址含無效的百分比編碼時，用原字串嘗試 */
  }
  for (const re of [RE_PIN, RE_QUERY, RE_AT]) {
    const m = re.exec(text);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }
  return null;
}

// ---------------------------------------------------------------
// 輸入格式與驗證 (一店一檔)
// ---------------------------------------------------------------
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'source_date 需為 YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'source_date 不是有效日期');

const httpUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'google_maps_url 不是有效網址');

/** 匯入來源：menu_photo＝菜單照片辨識（預設）、pos_online＝店家 POS 線上點餐頁、brand_official＝連鎖品牌官網公告價 */
export const IMPORT_SOURCES = ['menu_photo', 'pos_online', 'brand_official'] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

const storeSchema = z.object({
  restaurant: z.object({
    name: z.string().trim().min(1, 'restaurant.name 不可空白').max(60, 'restaurant.name 過長 (上限 60 字)'),
    address: z.string().trim().min(1, 'restaurant.address 不可空白').max(200, 'restaurant.address 過長 (上限 200 字)'),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    google_maps_url: httpUrl,
  }),
  source_date: isoDate,
  source_image: z.string().trim().min(1, 'source_image 不可空白'),
  source: z.enum(IMPORT_SOURCES, '"source" 需為 menu_photo、pos_online 或 brand_official').default('menu_photo'),
  items: z.array(z.unknown(), 'items 需為陣列'),
});

const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().int().min(1).max(5000),
  category: z.enum(CATEGORY_NAMES),
  tags: z.array(z.enum(CATEGORY_NAMES)).default([]),
  confidence: z.number().min(0).max(1),
});

export interface ValidItem {
  name: string;
  price: number;
  category: CategoryName;
  tags: CategoryName[];
  confidence: number;
}

export interface SkippedItem {
  restaurant: string;
  item: string;
  reason: string;
}

export interface ValidStore {
  file: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  google_maps_url: string | null;
  source_date: string;
  source_image: string;
  source: ImportSource;
  items: ValidItem[];
  skippedItems: SkippedItem[];
}

export interface SkippedStore {
  file: string;
  name: string | null;
  reason: string;
}

export type StoreResult = { ok: true; store: ValidStore } | { ok: false; skipped: SkippedStore };

const show = (v: unknown) => (v === undefined ? '（未填）' : JSON.stringify(v));

function itemLabel(raw: unknown, index: number): string {
  const name = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).name : undefined;
  return typeof name === 'string' && name.trim() ? name.trim() : `第 ${index + 1} 項（無品名）`;
}

function itemReason(raw: unknown, issue: z.core.$ZodIssue | undefined): string {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const key = issue?.path[0];
  switch (key) {
    case 'price':
      return `價格需為 1–5000 的整數（收到 ${show(obj.price)}）`;
    case 'category':
      return `分類 ${show(obj.category)} 不在分類表`;
    case 'tags':
      return `tags 含有不在分類表的值（收到 ${show(obj.tags)}）`;
    case 'confidence':
      return `confidence 需為 0–1 的數字（收到 ${show(obj.confidence)}）`;
    case 'name':
      return `品名空白或超過 80 字`;
    default:
      return '品項格式錯誤（需為物件）';
  }
}

/**
 * 驗證單一店家檔。檔案層級的錯誤（格式、日期、座標缺失）整店跳過；
 * 品項層級的錯誤（價格、分類、低信心、重複品名）只跳過該品項。全部列在報告，不靜默丟棄。
 */
export function validateStore(raw: unknown, file: string): StoreResult {
  const nameHint =
    raw && typeof raw === 'object' && 'restaurant' in raw
      ? (() => {
          const r = (raw as { restaurant?: { name?: unknown } }).restaurant;
          return typeof r?.name === 'string' ? r.name : null;
        })()
      : null;
  const fail = (reason: string): StoreResult => ({ ok: false, skipped: { file, name: nameHint, reason } });

  const parsed = storeSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`格式錯誤：${issue?.path.join('.') || '(根)'} — ${issue?.message ?? '未知'}`);
  }
  const { restaurant, source_date, source_image, source, items } = parsed.data;

  let lat = restaurant.lat;
  let lng = restaurant.lng;
  if (lat === undefined || lng === undefined) {
    const c = parseMapsCoords(restaurant.google_maps_url);
    if (!c) return fail('缺座標：沒有 lat/lng，也無法從 google_maps_url 解析（短網址或純店名搜尋網址無法解析）');
    lat = c.lat;
    lng = c.lng;
  }

  const skippedItems: SkippedItem[] = [];
  const skip = (item: string, reason: string) => skippedItems.push({ restaurant: restaurant.name, item, reason });
  const kept = new Map<string, ValidItem>();

  items.forEach((rawItem, i) => {
    const label = itemLabel(rawItem, i);
    const r = itemSchema.safeParse(rawItem);
    if (!r.success) return skip(label, itemReason(rawItem, r.error.issues[0]));
    if (r.data.confidence < MIN_CONFIDENCE) return skip(label, `信心 ${r.data.confidence} < ${MIN_CONFIDENCE}`);
    const prev = kept.get(r.data.name);
    if (prev) skip(prev.name, '品名重複，採用檔案中最後一筆');
    kept.set(r.data.name, r.data);
  });

  if (kept.size === 0) {
    return { ok: false, skipped: { file, name: restaurant.name, reason: `沒有可寫入的品項（共 ${items.length} 項，全部被跳過）` } };
  }

  return {
    ok: true,
    store: {
      file,
      name: restaurant.name,
      address: restaurant.address,
      lat,
      lng,
      google_maps_url: restaurant.google_maps_url ?? null,
      source_date,
      source_image,
      source,
      items: [...kept.values()],
      skippedItems,
    },
  };
}

// ---------------------------------------------------------------
// 報告
// ---------------------------------------------------------------
export interface WriteStats {
  newRestaurants: number;
  newFoods: number;
  updatedFoods: number;
  newVerifications: number;
  duplicateVerifications: number;
}

export const emptyStats = (): WriteStats => ({
  newRestaurants: 0,
  newFoods: 0,
  updatedFoods: 0,
  newVerifications: 0,
  duplicateVerifications: 0,
});

export interface ImportSummary {
  dryRun: boolean;
  fileCount: number;
  stores: ValidStore[];
  skippedStores: SkippedStore[];
  /** 寫入階段失敗的店 (整店未完成) */
  failedStores: SkippedStore[];
  /** 非 dry-run 才有 */
  stats?: WriteStats;
}

/** 所有數字都由資料算出，不經模型 */
export function formatReport(s: ImportSummary): string {
  const skippedItems = s.stores.flatMap((st) => st.skippedItems);
  const writable = s.stores.reduce((n, st) => n + st.items.length, 0);
  const lines: string[] = [s.dryRun ? '== 匯入報告（dry-run，只驗證、未寫入）==' : '== 匯入報告 =='];
  lines.push(`檔案：${s.fileCount} 個`);

  if (s.dryRun || !s.stats) {
    lines.push(`可寫入：店家 ${s.stores.length} 家、餐點 ${writable} 道`);
  } else {
    lines.push(`新增店數：${s.stats.newRestaurants}（既有店更新 ${s.stores.length - s.failedStores.length - s.stats.newRestaurants}）`);
    lines.push(`餐點：新增 ${s.stats.newFoods}、更新 ${s.stats.updatedFoods}`);
    lines.push(`價格紀錄：新增 ${s.stats.newVerifications}（相同日期與價格已存在而略過 ${s.stats.duplicateVerifications}）`);
  }

  lines.push(`跳過店家：${s.skippedStores.length}`);
  for (const k of s.skippedStores) lines.push(`  - ${k.file}${k.name ? ` ／ ${k.name}` : ''}：${k.reason}`);

  lines.push(`跳過品項：${skippedItems.length}`);
  for (const k of skippedItems) lines.push(`  - ${k.restaurant} ／ ${k.item}：${k.reason}`);

  if (s.failedStores.length > 0) {
    lines.push(`寫入失敗：${s.failedStores.length}`);
    for (const k of s.failedStores) lines.push(`  - ${k.file}${k.name ? ` ／ ${k.name}` : ''}：${k.reason}`);
  }
  return lines.join('\n');
}
