import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { renderSeedSql } from '@/data/seed/sql';

const root = resolve(__dirname, '..');
const migration = readFileSync(resolve(root, 'supabase/migrations/0001_init.sql'), 'utf8');
const seedSql = readFileSync(resolve(root, 'supabase/seed.sql'), 'utf8');
const seed = buildSeed();

let db: PGlite;

async function count(table: string): Promise<number> {
  const r = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return r.rows[0]!.n;
}

beforeAll(async () => {
  db = new PGlite();
  // Supabase 環境的最小 stub：角色與 auth schema
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.role() returns text language sql as $$ select 'anon'::text $$;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(migration);
  await db.exec(seedSql);
});

describe('12. Migration＋seed 在 PGlite 成功', () => {
  it('seed.sql 與 src/data/seed 產生結果一致', () => {
    expect(seedSql).toBe(renderSeedSql(seed));
  });
  it('筆數正確', async () => {
    expect(await count('categories')).toBe(8);
    expect(await count('restaurants')).toBe(seed.restaurants.length);
    expect(await count('foods')).toBe(seed.foods.length);
    expect(await count('food_tags')).toBe(seed.foodTags.length);
    expect(await count('price_verifications')).toBe(seed.verifications.length);
    expect(seed.restaurants.length).toBeGreaterThanOrEqual(30);
    expect(seed.foods.length).toBeGreaterThanOrEqual(150);
  });
  it('價格範圍與店內價格唯一來源 (foods 無 dine_in_price 欄位)', async () => {
    const r = await db.query<{ lo: number; hi: number }>('select min(price)::int lo, max(price)::int hi from public.foods');
    expect(r.rows[0]!.lo).toBeGreaterThanOrEqual(1);
    expect(r.rows[0]!.hi).toBeLessThanOrEqual(5000);
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='foods'",
    );
    expect(cols.rows.map((c) => c.column_name)).not.toContain('dine_in_price');
  });
  it('索引存在', async () => {
    const r = await db.query<{ indexname: string }>("select indexname from pg_indexes where schemaname='public'");
    const names = r.rows.map((x) => x.indexname);
    for (const n of ['foods_price_idx', 'foods_category_id_idx', 'foods_restaurant_id_idx', 'food_tags_category_id_idx', 'restaurants_lat_lng_idx', 'price_verifications_food_verified_idx']) {
      expect(names).toContain(n);
    }
  });
  it('六張表都啟用 RLS，且 policy 存在', async () => {
    const t = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(t.rows).toHaveLength(6);
    expect(t.rows.every((x) => x.relrowsecurity)).toBe(true);
    const p = await db.query<{ policyname: string }>("select policyname from pg_policies where schemaname='public'");
    const names = p.rows.map((x) => x.policyname);
    for (const n of ['restaurants_select_public', 'categories_select_public', 'foods_select_public', 'food_tags_select_public', 'price_verifications_select_public', 'price_verifications_insert_pending', 'menu_images_insert_pending']) {
      expect(names).toContain(n);
    }
  });
  it('updated_at trigger 會更新時間', async () => {
    const id = seed.foods[0]!.id;
    const before = await db.query<{ t: string }>(`select updated_at::text t from public.foods where id='${id}'`);
    await db.exec(`update public.foods set description = 'x' where id='${id}'`);
    const after = await db.query<{ t: string }>(`select updated_at::text t from public.foods where id='${id}'`);
    expect(after.rows[0]!.t).not.toBe(before.rows[0]!.t);
    await db.exec(`update public.foods set description = '${seed.foods[0]!.description}' where id='${id}'`);
  });
});

describe('RLS 行為 (set role anon)', () => {
  const foodId = seed.foods[0]!.id;
  it('anon 可讀公開資料', async () => {
    await db.exec('set role anon');
    try {
      expect(await count('foods')).toBe(seed.foods.length);
      expect(await count('restaurants')).toBe(seed.restaurants.length);
    } finally {
      await db.exec('reset role');
    }
  });
  it('anon 只能新增 pending 的回報，且 pending 讀不到', async () => {
    const before = (await db.query<{ n: number }>("select count(*)::int n from public.price_verifications where verification_status<>'pending'")).rows[0]!.n;
    await db.exec('set role anon');
    try {
      await db.exec(`insert into public.price_verifications (food_id, reported_price, report_type, source_type, verification_status) values ('${foodId}', 120, 'price_up', 'user_report', 'pending')`);
      await expect(
        db.exec(`insert into public.price_verifications (food_id, reported_price, source_type, verification_status) values ('${foodId}', 120, 'user_report', 'user_report')`),
      ).rejects.toThrow();
      await expect(
        db.exec(`insert into public.price_verifications (food_id, reported_price, source_type, verification_status) values ('${foodId}', 9999, 'user_report', 'pending')`),
      ).rejects.toThrow();
      expect(await count('price_verifications')).toBe(before);
    } finally {
      await db.exec('reset role');
    }
    expect(await count('price_verifications')).toBe(seed.verifications.length + 1);
  });
  it('anon 不可 UPDATE／DELETE', async () => {
    await db.exec('set role anon');
    try {
      await expect(db.exec(`update public.foods set price = 1 where id='${foodId}'`)).rejects.toThrow();
      await expect(db.exec(`delete from public.foods where id='${foodId}'`)).rejects.toThrow();
      await expect(db.exec(`update public.price_verifications set verification_status='store_confirmed'`)).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
  });
  it('anon 可新增 ocr_status=pending 的 menu_images，其他狀態被拒', async () => {
    const rid = seed.restaurants[0]!.id;
    await db.exec('set role anon');
    try {
      await db.exec(`insert into public.menu_images (restaurant_id, image_url, ocr_status) values ('${rid}', 'x.jpg', 'pending')`);
      await expect(db.exec(`insert into public.menu_images (restaurant_id, image_url, ocr_status) values ('${rid}', 'x.jpg', 'ok')`)).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
  });
});
