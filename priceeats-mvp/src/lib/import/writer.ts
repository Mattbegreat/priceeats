import { categoryId } from '@/data/categories';
import type { ValidStore, WriteStats } from './menu';
import { emptyStats } from './menu';

/**
 * 以 service role key 透過 PostgREST 寫入 Supabase (不引入 supabase-js，與 SupabaseRepository 一致)。
 * 只在本機由 scripts/import-menu.ts 使用；金鑰只出現在請求標頭，不寫進程式、網址或輸出。
 */
export class MenuImportWriter {
  private readonly base: string;

  constructor(
    url: string,
    private readonly serviceKey: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {
    this.base = `${url.replace(/\/$/, '')}/rest/v1`;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, prefer?: string): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/${path}`, {
      method,
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      const table = path.split('?')[0];
      throw new Error(`${method} ${table} 失敗 (${res.status})：${text.slice(0, 200)}`);
    }
    return (text ? JSON.parse(text) : []) as T;
  }

  /** 寫入一家店；回傳這家店造成的筆數變化 (新增／更新由寫入前的查詢判斷，不是模型自報) */
  async writeStore(store: ValidStore): Promise<WriteStats> {
    const stats = emptyStats();
    const enc = encodeURIComponent;

    // 1. 店家：name + address upsert；is_test_data 明確設為 false (0001 預設是 true)
    const existing = await this.call<{ id: string }[]>(
      'GET',
      `restaurants?select=id&name=eq.${enc(store.name)}&address=eq.${enc(store.address)}`,
    );
    const [restaurant] = await this.call<{ id: string }[]>(
      'POST',
      'restaurants?on_conflict=name,address',
      [
        {
          name: store.name,
          address: store.address,
          latitude: store.lat,
          longitude: store.lng,
          ...(store.google_maps_url ? { google_maps_url: store.google_maps_url } : {}),
          source: store.source,
          is_test_data: false,
        },
      ],
      'resolution=merge-duplicates,return=representation',
    );
    if (!restaurant) throw new Error('寫入店家後沒有回傳 id');
    if (existing.length === 0) stats.newRestaurants = 1;

    // 2. 餐點：restaurant_id + name upsert
    const existingFoods = await this.call<{ id: string; name: string }[]>(
      'GET',
      `foods?select=id,name&restaurant_id=eq.${restaurant.id}`,
    );
    const known = new Set(existingFoods.map((f) => f.name));
    const foods = await this.call<{ id: string; name: string }[]>(
      'POST',
      'foods?on_conflict=restaurant_id,name',
      store.items.map((it) => ({
        restaurant_id: restaurant.id,
        name: it.name,
        category_id: categoryId(it.category),
        price: it.price,
        is_available: true,
      })),
      'resolution=merge-duplicates,return=representation',
    );
    const foodId = new Map(foods.map((f) => [f.name, f.id]));
    for (const it of store.items) {
      if (known.has(it.name)) stats.updatedFoods += 1;
      else stats.newFoods += 1;
    }

    // 3. 標籤
    const tags = store.items.flatMap((it) =>
      it.tags.map((t) => ({ food_id: foodId.get(it.name), category_id: categoryId(t) })),
    );
    if (tags.length > 0) {
      await this.call('POST', 'food_tags?on_conflict=food_id,category_id', tags, 'resolution=ignore-duplicates,return=minimal');
    }

    // 4. 價格驗證：每筆價格新增一筆（來源 menu_photo／pos_online）；同餐點、同日、同價已存在則略過，重跑同一檔不會重複堆疊
    const ids = [...foodId.values()];
    const seen = new Set<string>();
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const rows = await this.call<{ food_id: string; reported_price: number | null; verified_at: string }[]>(
        'GET',
        `price_verifications?select=food_id,reported_price,verified_at&source_type=eq.${store.source}&food_id=in.(${chunk.join(',')})`,
      );
      for (const r of rows) seen.add(`${r.food_id}|${r.verified_at.slice(0, 10)}|${r.reported_price}`);
    }
    const fresh = [];
    for (const it of store.items) {
      const id = foodId.get(it.name);
      if (!id) continue;
      if (seen.has(`${id}|${store.source_date}|${it.price}`)) {
        stats.duplicateVerifications += 1;
        continue;
      }
      fresh.push({
        food_id: id,
        reported_price: it.price,
        report_type: null,
        note: null,
        source_type: store.source,
        source_image_url: store.source_image,
        verification_status: store.source,
        verified_at: store.source_date,
        confidence_score: Math.round(it.confidence * 100) / 100,
      });
    }
    if (fresh.length > 0) {
      await this.call('POST', 'price_verifications', fresh, 'return=minimal');
      stats.newVerifications = fresh.length;
    }
    return stats;
  }
}
