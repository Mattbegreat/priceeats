import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/data/categories';

const root = resolve(__dirname, '..');
const sql = (f: string) => readFileSync(resolve(root, 'supabase', f), 'utf8');

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function auth.role() returns text language sql as $$ select 'anon'::text $$;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(sql('migrations/0001_init.sql'));
  await db.exec(sql('seed.sql')); // 已載入測試資料的專案也要能套用 0002
  await db.exec(sql('migrations/0002_production.sql'));
});

describe('Migration 0002 在 PGlite（0001＋seed 之後）成功', () => {
  it('restaurants 新增 google_maps_url、source；google_rating 欄位保留', async () => {
    const r = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='restaurants'",
    );
    const cols = r.rows.map((c) => c.column_name);
    expect(cols).toEqual(expect.arrayContaining(['google_maps_url', 'source', 'google_rating']));
  });

  it('分類與 src/data/categories.ts 相同（id、名稱），且不會與 seed 重複', async () => {
    const r = await db.query<{ id: string; name: string }>('select id, name from public.categories order by id');
    expect(r.rows).toEqual([...CATEGORIES].map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.id.localeCompare(b.id)));
  });

  it('可重複執行 (idempotent)', async () => {
    await db.exec(sql('migrations/0002_production.sql'));
    const r = await db.query<{ n: number }>('select count(*)::int n from public.categories');
    expect(r.rows[0]!.n).toBe(8);
  });

  it('name + address 唯一，upsert (on conflict) 只會更新、不會新增第二筆', async () => {
    const upsert = `
      insert into public.restaurants (name, address, latitude, longitude, google_maps_url, source, is_test_data)
      values ('匯入測試店', '台北市某路 1 號', $1, 121.5, 'https://maps.example/x', 'menu_photo', false)
      on conflict (name, address) do update set latitude = excluded.latitude, google_maps_url = excluded.google_maps_url
      returning id`;
    const a = await db.query<{ id: string }>(upsert, [25.0]);
    const b = await db.query<{ id: string }>(upsert, [25.1]);
    expect(b.rows[0]!.id).toBe(a.rows[0]!.id);
    const r = await db.query<{ n: number; lat: number; test: boolean }>(
      "select count(*)::int n, max(latitude) lat, bool_or(is_test_data) test from public.restaurants where name = '匯入測試店'",
    );
    expect(r.rows[0]).toEqual({ n: 1, lat: 25.1, test: false });
    await expect(
      db.query("insert into public.restaurants (name, address, latitude, longitude) values ('匯入測試店', '台北市某路 1 號', 1, 1)"),
    ).rejects.toThrow();
  });

  it('0002 以 foods 的 (restaurant_id, name) 唯一鍵 upsert 餐點與驗證紀錄', async () => {
    const rid = (await db.query<{ id: string }>("select id from public.restaurants where name = '匯入測試店'")).rows[0]!.id;
    const catId = CATEGORIES[0]!.id;
    const up = `insert into public.foods (restaurant_id, name, category_id, price) values ($1, '排骨便當', $2, $3)
      on conflict (restaurant_id, name) do update set price = excluded.price returning id`;
    const f1 = await db.query<{ id: string }>(up, [rid, catId, 95]);
    const f2 = await db.query<{ id: string }>(up, [rid, catId, 100]);
    expect(f2.rows[0]!.id).toBe(f1.rows[0]!.id);
    await db.query(
      "insert into public.price_verifications (food_id, reported_price, source_type, verification_status, verified_at, confidence_score) values ($1, 100, 'menu_photo', 'menu_photo', '2026-10-30', 0.95)",
      [f1.rows[0]!.id],
    );
    const v = await db.query<{ n: number }>("select count(*)::int n from public.price_verifications where food_id = $1 and verification_status = 'menu_photo'", [f1.rows[0]!.id]);
    expect(v.rows[0]!.n).toBe(1);
  });
});
