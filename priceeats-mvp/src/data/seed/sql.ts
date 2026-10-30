import type { SeedData } from './index';

const q = (s: string | null): string => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`);
const n = (v: number | null): string => (v === null ? 'null' : String(v));

/** 由 src/data/seed 產生 supabase/seed.sql，確保與 mock 資料一致 */
export function renderSeedSql(seed: SeedData): string {
  const out: string[] = [];
  out.push('-- 由 scripts/gen-seed-sql.ts 產生，請勿手動編輯 (npm run gen:seed)');
  out.push('-- 全部為「測試資料」：虛構店家與評分，非 Google Maps 資料。');
  out.push('begin;', '');

  out.push('insert into public.categories (id, name, parent_category_id) values');
  out.push(seed.categories.map((c) => `  (${q(c.id)}, ${q(c.name)}, ${q(c.parent_category_id)})`).join(',\n') + ';', '');

  out.push(
    'insert into public.restaurants (id, name, address, latitude, longitude, google_place_id, google_rating, google_review_count, phone, is_test_data, created_at, updated_at) values',
  );
  out.push(
    seed.restaurants
      .map(
        (r) =>
          `  (${q(r.id)}, ${q(r.name)}, ${q(r.address)}, ${r.latitude}, ${r.longitude}, ${q(r.google_place_id)}, ${n(r.google_rating)}, ${n(r.google_review_count)}, ${q(r.phone)}, ${r.is_test_data}, ${q(r.created_at)}, ${q(r.updated_at)})`,
      )
      .join(',\n') + ';',
    '',
  );

  out.push('insert into public.foods (id, restaurant_id, name, description, category_id, price, image_url, is_available, created_at, updated_at) values');
  out.push(
    seed.foods
      .map(
        (f) =>
          `  (${q(f.id)}, ${q(f.restaurant_id)}, ${q(f.name)}, ${q(f.description)}, ${q(f.category_id)}, ${f.price}, ${q(f.image_url)}, ${f.is_available}, ${q(f.created_at)}, ${q(f.updated_at)})`,
      )
      .join(',\n') + ';',
    '',
  );

  out.push('insert into public.food_tags (food_id, category_id) values');
  out.push(seed.foodTags.map((t) => `  (${q(t.food_id)}, ${q(t.category_id)})`).join(',\n') + ';', '');

  out.push(
    'insert into public.price_verifications (id, food_id, reported_price, report_type, note, source_type, source_image_url, verification_status, verified_at, confidence_score, created_at) values',
  );
  out.push(
    seed.verifications
      .map((v) => {
        const at = `now() - interval '${v.days_ago} days'`;
        return `  (${q(v.id)}, ${q(v.food_id)}, ${n(v.reported_price)}, ${q(v.report_type)}, ${q(v.note)}, ${q(v.source_type)}, ${q(v.source_image_url)}, ${q(v.verification_status)}, ${at}, ${v.confidence_score.toFixed(2)}, ${at})`;
      })
      .join(',\n') + ';',
    '',
  );
  out.push('commit;', '');
  return out.join('\n');
}
