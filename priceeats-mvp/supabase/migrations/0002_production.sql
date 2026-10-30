-- PriceEats 0002_production：正式資料欄位、正式分類、匯入工具用的唯一鍵
-- 不修改 0001；可重複執行 (idempotent)。

-- 正式資料來源欄位 (google_rating 欄位保留但不使用，正式資料改連 Google Maps 看評價)
alter table public.restaurants add column if not exists google_maps_url text;
alter table public.restaurants add column if not exists source text;

-- 匯入工具以 name + address upsert 店家，需要唯一鍵 (on_conflict=name,address)
create unique index if not exists restaurants_name_address_key on public.restaurants (name, address);

-- 正式分類 (與 src/data/categories.ts 相同；id 固定，與 seed.sql 一致，已存在就略過)
insert into public.categories (id, name, parent_category_id) values
  ('00000000-0000-4000-8000-00000000c001', '便當', null),
  ('00000000-0000-4000-8000-00000000c002', '飯類', null),
  ('00000000-0000-4000-8000-00000000c003', '麵食', null),
  ('00000000-0000-4000-8000-00000000c004', '肉類', null),
  ('00000000-0000-4000-8000-00000000c005', '海鮮', null),
  ('00000000-0000-4000-8000-00000000c006', '早餐', null),
  ('00000000-0000-4000-8000-00000000c007', '小吃', null),
  ('00000000-0000-4000-8000-00000000c008', '自助餐', null)
on conflict do nothing;
