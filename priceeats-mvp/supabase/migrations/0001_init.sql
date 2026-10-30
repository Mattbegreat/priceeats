-- PriceEats 0001_init：資料表、索引、updated_at trigger、RLS
-- 原則：價格只存 foods.price (店內現價)；歷史與回報存在 price_verifications；不存外送平台價格。

-- ---------------------------------------------------------------
-- 資料表
-- ---------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  google_place_id text,
  google_rating numeric(2,1) check (google_rating is null or google_rating between 0 and 5),
  google_review_count integer check (google_review_count is null or google_review_count >= 0),
  phone text,
  is_test_data boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent_category_id uuid references public.categories (id) on delete set null
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  description text not null default '',
  category_id uuid not null references public.categories (id),
  price integer not null check (price between 1 and 5000),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table public.food_tags (
  food_id uuid not null references public.foods (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (food_id, category_id)
);

create table public.price_verifications (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  reported_price integer check (reported_price is null or reported_price between 1 and 5000),
  report_type text check (report_type is null or report_type in ('price_up', 'price_down', 'discontinued', 'info_error')),
  note text,
  source_type text not null check (source_type in ('store', 'menu_photo', 'user_report')),
  source_image_url text,
  verification_status text not null check (verification_status in ('store_confirmed', 'menu_photo', 'user_report', 'pending')),
  verified_at timestamptz not null default now(),
  confidence_score numeric(3,2) not null default 0.5 check (confidence_score between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.menu_images (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  image_url text not null,
  uploaded_by uuid,
  uploaded_at timestamptz not null default now(),
  ocr_status text not null default 'pending' check (ocr_status in ('pending', 'ok', 'not_configured', 'error')),
  source_date date
);

-- ---------------------------------------------------------------
-- 索引
-- ---------------------------------------------------------------
create index foods_price_idx on public.foods (price);
create index foods_category_id_idx on public.foods (category_id);
create index foods_restaurant_id_idx on public.foods (restaurant_id);
create index food_tags_category_id_idx on public.food_tags (category_id);
create index restaurants_lat_lng_idx on public.restaurants (latitude, longitude);
create index price_verifications_food_verified_idx on public.price_verifications (food_id, verified_at desc);

-- ---------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_set_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger foods_set_updated_at before update on public.foods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- 權限與 RLS：anon 只能讀公開資料、只能新增 pending 的回報與待辨識菜單；不能 UPDATE / DELETE
-- ---------------------------------------------------------------
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.foods enable row level security;
alter table public.food_tags enable row level security;
alter table public.price_verifications enable row level security;
alter table public.menu_images enable row level security;

revoke all on public.restaurants, public.categories, public.foods, public.food_tags,
  public.price_verifications, public.menu_images from anon, authenticated;

grant select on public.restaurants, public.categories, public.foods, public.food_tags,
  public.price_verifications to anon, authenticated;
grant insert on public.price_verifications, public.menu_images to anon, authenticated;

create policy restaurants_select_public on public.restaurants
  for select to anon, authenticated using (true);
create policy categories_select_public on public.categories
  for select to anon, authenticated using (true);
create policy foods_select_public on public.foods
  for select to anon, authenticated using (true);
create policy food_tags_select_public on public.food_tags
  for select to anon, authenticated using (true);

-- pending 的回報不公開 (避免被當成正式價格)
create policy price_verifications_select_public on public.price_verifications
  for select to anon, authenticated using (verification_status <> 'pending');

create policy price_verifications_insert_pending on public.price_verifications
  for insert to anon, authenticated
  with check (
    verification_status = 'pending'
    and source_type = 'user_report'
    and (reported_price is null or reported_price between 1 and 5000)
  );

create policy menu_images_insert_pending on public.menu_images
  for insert to anon, authenticated
  with check (ocr_status = 'pending');
