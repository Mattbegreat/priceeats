import { describe, expect, it } from 'vitest';
import { googleMapsReviewUrl } from '@/lib/geo/maps-url';
import { SupabaseRepository } from '@/repositories/supabase';

const rows: Record<string, unknown[]> = {
  categories: [{ id: 'c1', name: '便當', parent_category_id: null }],
  restaurants: [
    { id: 'r-real', name: '真實店', address: '台北市中正區某路 1 號', latitude: 25.04, longitude: 121.51, is_test_data: false },
    { id: 'r-test', name: '假店（測試）', address: '', latitude: 25.05, longitude: 121.52, is_test_data: true },
  ],
  foods: [
    { id: 'f-real', restaurant_id: 'r-real', name: '排骨便當', price: 100 },
    { id: 'f-test', restaurant_id: 'r-test', name: '測試便當', price: 90 },
  ],
  food_tags: [
    { food_id: 'f-real', category_id: 'c1' },
    { food_id: 'f-test', category_id: 'c1' },
  ],
  price_verifications: [
    { id: 'v1', food_id: 'f-real', verification_status: 'menu_photo' },
    { id: 'v2', food_id: 'f-test', verification_status: 'store_confirmed' },
  ],
  menu_images: [{ id: 'm1', restaurant_id: 'r-test' }],
};

/** 模擬 PostgREST：restaurants 查詢帶 is_test_data=eq.false 時只回正式店 (其餘表一律全回，驗證 client 端也會過濾) */
function fakeFetch(urls: string[]): typeof fetch {
  return (async (input: string) => {
    urls.push(input);
    const table = new URL(input).pathname.split('/').pop()!;
    let data = rows[table] ?? [];
    if (table === 'restaurants' && input.includes('is_test_data=eq.false')) {
      data = data.filter((r) => (r as { is_test_data: boolean }).is_test_data === false);
    }
    return new Response(JSON.stringify(data), { status: 200 });
  }) as unknown as typeof fetch;
}

describe('正式模式 (Supabase 啟用)', () => {
  it('不載入測試資料：店、餐點、標籤、驗證、菜單圖都只剩正式店', async () => {
    const urls: string[] = [];
    const repo = new SupabaseRepository('https://x.supabase.co', 'anon', fakeFetch(urls));
    const data = await repo.load();
    expect(urls.some((u) => u.includes('/rest/v1/restaurants?') && u.includes('is_test_data=eq.false'))).toBe(true);
    expect(data.restaurants.map((r) => r.id)).toEqual(['r-real']);
    expect(data.foods.map((f) => f.id)).toEqual(['f-real']);
    expect(data.foodTags.map((t) => t.food_id)).toEqual(['f-real']);
    expect(data.verifications.map((v) => v.id)).toEqual(['v1']);
    expect(data.menuImages).toHaveLength(0);
    expect(data.restaurants.some((r) => r.is_test_data)).toBe(false);
  });

});

describe('Google Maps 評價連結', () => {
  it('格式：api=1&query=店名+地址', () => {
    expect(googleMapsReviewUrl('真實店', '台北市中正區某路 1 號')).toBe(
      'https://www.google.com/maps/search/?api=1&query=%E7%9C%9F%E5%AF%A6%E5%BA%97+%E5%8F%B0%E5%8C%97%E5%B8%82%E4%B8%AD%E6%AD%A3%E5%8D%80%E6%9F%90%E8%B7%AF+1+%E8%99%9F',
    );
  });
  it('地址空白時只用店名；特殊字元會被編碼', () => {
    expect(googleMapsReviewUrl('A&B 店', '')).toBe('https://www.google.com/maps/search/?api=1&query=A%26B+%E5%BA%97');
  });
});
