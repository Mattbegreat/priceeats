import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const sql = (f: string) => readFileSync(resolve(root, 'supabase', f), 'utf8');

let db: PGlite;
let foodId: string;

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
  await db.exec(sql('seed.sql'));
  await db.exec(sql('migrations/0002_production.sql'));
  await db.exec(sql('migrations/0003_pos_source.sql'));
  const r = await db.query<{ id: string }>('select id from public.foods limit 1');
  foodId = r.rows[0]!.id;
});

const insert = (source: string, status: string) =>
  db.query(
    'insert into public.price_verifications (food_id, reported_price, source_type, verification_status) values ($1, 80, $2, $3)',
    [foodId, source, status],
  );

describe('Migration 0003 在 PGlite（0001＋seed＋0002 之後）成功', () => {
  it('接受 pos_online 的 source_type 與 verification_status', async () => {
    await expect(insert('pos_online', 'pos_online')).resolves.toBeDefined();
  });

  it('接受 brand_official', async () => {
    await expect(insert('brand_official', 'brand_official')).resolves.toBeDefined();
  });

  it('既有值仍可用，未知值仍被拒絕', async () => {
    await expect(insert('menu_photo', 'menu_photo')).resolves.toBeDefined();
    await expect(insert('delivery', 'pos_online')).rejects.toThrow();
    await expect(insert('pos_online', 'delivery')).rejects.toThrow();
  });

  it('可重複執行 (idempotent)', async () => {
    await db.exec(sql('migrations/0003_pos_source.sql'));
    await expect(insert('pos_online', 'pos_online')).resolves.toBeDefined();
  });
});
