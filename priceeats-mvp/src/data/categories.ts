import { CATEGORY_NAMES, type Category, type CategoryFilter, type CategoryName } from '@/types';

/** 固定 id，與 supabase/seed.sql 一致 */
const CATEGORY_IDS: Record<CategoryName, string> = {
  便當: '00000000-0000-4000-8000-00000000c001',
  飯類: '00000000-0000-4000-8000-00000000c002',
  麵食: '00000000-0000-4000-8000-00000000c003',
  肉類: '00000000-0000-4000-8000-00000000c004',
  海鮮: '00000000-0000-4000-8000-00000000c005',
  早餐: '00000000-0000-4000-8000-00000000c006',
  小吃: '00000000-0000-4000-8000-00000000c007',
  自助餐: '00000000-0000-4000-8000-00000000c008',
};

export const CATEGORIES: Category[] = CATEGORY_NAMES.map((name) => ({
  id: CATEGORY_IDS[name],
  name,
  parent_category_id: null,
}));

export const CATEGORY_FILTERS: CategoryFilter[] = ['不限', ...CATEGORY_NAMES];

export function categoryId(name: CategoryName): string {
  return CATEGORY_IDS[name];
}
