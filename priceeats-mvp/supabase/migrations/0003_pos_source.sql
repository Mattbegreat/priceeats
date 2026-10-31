-- PriceEats 0003_pos_source：價格來源新增 pos_online（店家 POS 線上點餐頁的店內價）、brand_official（連鎖品牌官網公告價）
-- 不修改 0001、0002；drop 後重建 constraint，可重複執行 (idempotent)。

alter table public.price_verifications drop constraint if exists price_verifications_source_type_check;
alter table public.price_verifications
  add constraint price_verifications_source_type_check
  check (source_type in ('store', 'menu_photo', 'user_report', 'pos_online', 'brand_official'));

alter table public.price_verifications drop constraint if exists price_verifications_verification_status_check;
alter table public.price_verifications
  add constraint price_verifications_verification_status_check
  check (verification_status in ('store_confirmed', 'menu_photo', 'user_report', 'pos_online', 'brand_official', 'pending'));
