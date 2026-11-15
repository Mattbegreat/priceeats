import { describe, expect, it } from 'vitest';
import { boundingBox } from '@/lib/geo/bbox';
import { haversineM, offsetPoint } from '@/lib/geo/haversine';
import { SupabaseRepository } from '@/repositories/supabase';

type Row = Record<string, unknown>;

/** 模擬 PostgREST：真的套用 is_test_data、經緯度範圍、in.(…) 與 limit/offset，並記錄每個請求 */
function makeServer(tables: Record<string, Row[]>) {
  const log: { table: string; url: string; rows: number }[] = [];
  const fetchImpl = (async (input: string) => {
    const u = new URL(input);
    const table = u.pathname.split('/').pop()!;
    let data = tables[table] ?? [];
    for (const [k, v] of u.searchParams) {
      if (['select', 'limit', 'offset'].includes(k)) continue;
      const [op, arg] = [v.slice(0, v.indexOf('.')), v.slice(v.indexOf('.') + 1)];
      if (op === 'eq') data = data.filter((r) => String(r[k]) === arg);
      else if (op === 'gte') data = data.filter((r) => (r[k] as number) >= Number(arg));
      else if (op === 'lte') data = data.filter((r) => (r[k] as number) <= Number(arg));
      else if (op === 'in') {
        const ids = new Set(arg.slice(1, -1).split(','));
        data = data.filter((r) => ids.has(String(r[k])));
      }
    }
    const off = Number(u.searchParams.get('offset') ?? 0);
    const lim = Math.min(Number(u.searchParams.get('limit') ?? 1000), 1000);
    let slice = data.slice(off, off + lim);
    // 資源內嵌：select=*,food_tags(*),price_verifications(*)
    const sel = u.searchParams.get('select') ?? '';
    const embeds = ['food_tags', 'price_verifications'].filter((e) => sel.includes(`${e}(*)`));
    if (embeds.length) {
      slice = slice.map((r) => ({
        ...r,
        ...Object.fromEntries(embeds.map((e) => [e, (tables[e] ?? []).filter((x) => x.food_id === r.id)])),
      }));
    }
    log.push({ table, url: input, rows: slice.length });
    return new Response(JSON.stringify(slice), {
      status: 200,
      headers: { 'content-range': `${off}-${off + slice.length - 1}/${data.length}` },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, log };
}

/** 固定亂數，結果可重現 */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const CENTER = { lat: 25.0522, lng: 121.5933 };

function buildWorld(stores: number, foodsPerStore: number) {
  const rand = rng(7);
  const restaurants: Row[] = [];
  const foods: Row[] = [];
  const foodTags: Row[] = [];
  const verifications: Row[] = [];
  for (let i = 0; i < stores; i++) {
    const r = {
      id: `r${i}`,
      name: `店${i}`,
      address: '',
      // 以中心為準約 ±16 公里的範圍
      latitude: CENTER.lat + (rand() - 0.5) * 0.3,
      longitude: CENTER.lng + (rand() - 0.5) * 0.3,
      is_test_data: false,
    };
    restaurants.push(r);
    for (let j = 0; j < foodsPerStore; j++) {
      const f = `f${i}-${j}`;
      foods.push({ id: f, restaurant_id: r.id, name: `餐${j}`, price: 100 });
      foodTags.push({ food_id: f, category_id: 'c1' });
      verifications.push({ id: `v${f}`, food_id: f, verification_status: 'menu_photo' });
    }
  }
  return {
    categories: [{ id: 'c1', name: '便當', parent_category_id: null }],
    restaurants,
    foods,
    food_tags: foodTags,
    price_verifications: verifications,
    menu_images: [],
  } as Record<string, Row[]>;
}

const repoOf = (f: typeof fetch) => new SupabaseRepository('https://x.supabase.co', 'anon', f);
const today = new Date('2026-11-14T00:00:00Z');

describe('boundingBox', () => {
  it('中心與 2 km：四邊與實際距離誤差 < 1%', () => {
    const b = boundingBox(CENTER, 2);
    const n = haversineM(CENTER, { lat: b.maxLat, lng: CENTER.lng });
    const s = haversineM(CENTER, { lat: b.minLat, lng: CENTER.lng });
    const e = haversineM(CENTER, { lat: CENTER.lat, lng: b.maxLng });
    const w = haversineM(CENTER, { lat: CENTER.lat, lng: b.minLng });
    for (const d of [n, s, e, w]) expect(Math.abs(d - 2000) / 2000).toBeLessThan(0.01);
    // 與球面位移函式交叉驗證
    const north = offsetPoint(CENTER, 0, 2000);
    expect(Math.abs(north.lat - b.maxLat)).toBeLessThan(1e-4);
  });
  it('方框涵蓋圓上每個方向的點', () => {
    const b = boundingBox(CENTER, 5);
    for (let deg = 0; deg < 360; deg += 15) {
      const p = offsetPoint(CENTER, deg, 4999);
      expect(p.lat).toBeGreaterThanOrEqual(b.minLat);
      expect(p.lat).toBeLessThanOrEqual(b.maxLat);
      expect(p.lng).toBeGreaterThanOrEqual(b.minLng);
      expect(p.lng).toBeLessThanOrEqual(b.maxLng);
    }
  });
});

describe('只載入搜尋中心附近', () => {
  const world = buildWorld(300, 5);

  it('restaurants 請求帶四個經緯度條件；foods 等子表不是無條件全表', async () => {
    const { fetchImpl, log } = makeServer(world);
    const data = await repoOf(fetchImpl).load(today, { center: CENTER, radiusM: 1000 });
    const rq = log.filter((l) => l.table === 'restaurants').map((l) => l.url);
    expect(rq.length).toBeGreaterThan(0);
    for (const u of rq) {
      for (const k of ['latitude=gte.', 'latitude=lte.', 'longitude=gte.', 'longitude=lte.', 'is_test_data=eq.false']) expect(u).toContain(k);
    }
    for (const l of log.filter((x) => ['foods', 'food_tags', 'price_verifications', 'menu_images'].includes(x.table))) {
      expect(l.url).toMatch(/(restaurant_id|food_id)=in\.\(/);
    }
    // food_tags、price_verifications 改由 foods 內嵌，不再單獨請求
    expect(log.some((l) => l.table === 'food_tags' || l.table === 'price_verifications')).toBe(false);
    expect(log.some((l) => l.table === 'foods' && /food_tags(%28|\()\*/.test(l.url))).toBe(true);
    expect(data.restaurants.length).toBeGreaterThan(0);
    expect(data.restaurants.length).toBeLessThan(world.restaurants.length);
    for (const r of data.restaurants) {
      expect(haversineM(CENTER, { lat: r.latitude, lng: r.longitude })).toBeLessThanOrEqual(1150);
    }
    const ids = new Set(data.restaurants.map((r) => r.id));
    expect(data.foods.every((f) => ids.has(f.restaurant_id))).toBe(true);
    expect(data.foods).toHaveLength(data.restaurants.length * 5);
    expect(data.foodTags).toHaveLength(data.foods.length);
    expect(data.verifications).toHaveLength(data.foods.length);
  });

  it('in.(…) 每批 id 不超過 100 個', async () => {
    const { fetchImpl, log } = makeServer(world);
    await repoOf(fetchImpl).load(today, { center: CENTER, radiusM: 5000 });
    const sizes = log
      .map((l) => /=in\.\(([^)]*)\)/.exec(l.url)?.[1])
      .filter((x): x is string => !!x)
      .map((x) => x.split(',').length);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(100);
  });

  it('快取：同一中心與半徑呼叫兩次，請求數不增加', async () => {
    const { fetchImpl, log } = makeServer(world);
    const repo = repoOf(fetchImpl);
    const a = await repo.load(today, { center: CENTER, radiusM: 1000 });
    const n = log.length;
    const b = await repo.load(today, { center: { ...CENTER }, radiusM: 1000 });
    expect(log.length).toBe(n);
    expect(b).toBe(a);
  });

  it('放大範圍：1 km → 5 km 再查；5 km → 1 km 不會', async () => {
    const { fetchImpl, log } = makeServer(world);
    const repo = repoOf(fetchImpl);
    await repo.load(today, { center: CENTER, radiusM: 1000 });
    const n1 = log.length;
    await repo.load(today, { center: CENTER, radiusM: 5000 });
    const n2 = log.length;
    expect(n2).toBeGreaterThan(n1);
    await repo.load(today, { center: CENTER, radiusM: 1000 });
    expect(log.length).toBe(n2);
  });

  it('中心移到範圍外會再查；失敗不進快取，重試會重新下載', async () => {
    const { fetchImpl, log } = makeServer(world);
    const repo = repoOf(fetchImpl);
    await repo.load(today, { center: CENTER, radiusM: 1000 });
    const n = log.length;
    await repo.load(today, { center: { lat: CENTER.lat + 0.05, lng: CENTER.lng }, radiusM: 1000 });
    expect(log.length).toBeGreaterThan(n);

    let fail = true;
    const flaky = (async (...a: Parameters<typeof fetch>) => {
      if (fail) return new Response('x', { status: 500 });
      return fetchImpl(...a);
    }) as typeof fetch;
    const r2 = repoOf(flaky);
    await expect(r2.load(today, { center: CENTER, radiusM: 1000 })).rejects.toThrow();
    fail = false;
    await expect(r2.load(today, { center: CENTER, radiusM: 1000 })).resolves.toBeTruthy();
  });

  it('範圍內超過 1000 筆餐點仍分頁抓完', async () => {
    const big = buildWorld(300, 20); // 範圍內店數 × 20 道會超過 1000
    const { fetchImpl, log } = makeServer(big);
    const data = await repoOf(fetchImpl).load(today, { center: CENTER, radiusM: 8000 });
    expect(data.foods.length).toBeGreaterThan(1000);
    expect(data.foods).toHaveLength(data.restaurants.length * 20);
    expect(log.some((l) => l.table === 'foods' && l.url.includes('offset=1000'))).toBe(true);
  });
});

describe('請求數與筆數對照 (3,000 店 × 35 道)', () => {
  it('改版後遠少於全表下載', async () => {
    const world = buildWorld(3000, 35);
    const count = (log: { rows: number }[]) => ({ req: log.length, rows: log.reduce((s, l) => s + l.rows, 0) });

    const before = makeServer(world);
    await repoOf(before.fetchImpl).load(); // 無範圍 = 舊行為：整張表
    const old = count(before.log);

    const rows: string[] = [`改版前(全表)   請求 ${old.req}  筆數 ${old.rows}`];
    let last = old.rows;
    for (const radiusM of [1000, 2000, 5000]) {
      const s = makeServer(world);
      await repoOf(s.fetchImpl).load(today, { center: CENTER, radiusM });
      const c = count(s.log);
      rows.push(`改版後 ${radiusM / 1000} km    請求 ${c.req}  筆數 ${c.rows}`);
      expect(c.rows).toBeLessThan(last === old.rows ? old.rows : Infinity);
      expect(c.rows).toBeLessThan(old.rows);
      last = c.rows;
    }
    console.log(rows.join('\n'));
  });
});
