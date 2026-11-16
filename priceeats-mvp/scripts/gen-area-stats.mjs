// 入口頁的店數與餐點數：用 anon key 讀 Supabase，套用與前端相同的預設 (500m、排除單點小菜與多人份)，
// 直接 import src/lib 的純函式，不重寫規則。寫入 src/data/area-stats.json (要提交)；npm run build:demo 只讀這個 JSON，不連網。
//
// 用法：NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run gen:area-stats
// (只用公開的 anon key；SUPABASE_SERVICE_ROLE_KEY 不會被讀取)
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('請設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY (anon key 為公開金鑰)');
  process.exit(2);
}
// 兩個變數必須在載入 src/ 之前就位：IS_REAL_DATA 在 import 時就決定 (正式模式的預設值)
const { SupabaseRepository } = await import('../src/repositories/supabase.ts');
const { buildIndex, search } = await import('../src/lib/search/filter.ts');
const { DEFAULT_PARAMS } = await import('../src/lib/search/params.ts');
const { AREAS, AREA_BUDGETS, AREA_DIST_M, findArea } = await import('../src/data/areas.ts');

const today = new Date();
const taipeiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
const repo = new SupabaseRepository(url, anon);

const areas = {};
let ok = 0;
for (const a of AREAS) {
  const area = findArea(a.slug);
  try {
    const data = await repo.load(today, { center: { lat: area.lat, lng: area.lng }, radiusM: AREA_DIST_M });
    const index = buildIndex(data, today, true);
    areas[a.slug] = {};
    for (const budget of AREA_BUDGETS) {
      const results = search(index, {
        ...DEFAULT_PARAMS,
        budget,
        cat: '不限',
        dist: AREA_DIST_M,
        sides: false,
        multi: false,
        minRating: 0,
        lat: area.lat,
        lng: area.lng,
      });
      areas[a.slug][String(budget)] = { stores: new Set(results.map((r) => r.restaurant.id)).size, dishes: results.length };
    }
    ok++;
  } catch (e) {
    console.error(`${a.slug} 查詢失敗，該區不寫入數字：${e instanceof Error ? e.message : e}`);
  }
}
if (ok === 0) {
  console.error('全部區域都查不到，不覆蓋 src/data/area-stats.json');
  process.exit(1);
}
const out = { generatedAt: taipeiDate, distM: AREA_DIST_M, areas };
writeFileSync(resolve(import.meta.dirname, '../src/data/area-stats.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`統計日期 ${taipeiDate}（${ok}/${AREAS.length} 區）`);
console.log('區域\t預算\t店數\t餐點數');
for (const a of AREAS) for (const b of AREA_BUDGETS) {
  const s = areas[a.slug]?.[String(b)];
  console.log(`${a.slug}\t${b}\t${s ? s.stores : '-'}\t${s ? s.dishes : '-'}`);
}
