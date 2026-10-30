import { CATEGORIES, categoryId } from '../categories';
import { offsetPoint } from '@/lib/geo/haversine';
import { CENTER_PRESETS } from '../centers';
import { PHOTO_CREDITS } from '../photo-credits';
import { ARCHETYPES } from './dishes';
import { mulberry32, pick, randInt, shuffle, detUuid } from './random';
import { RESTAURANT_DEFS } from './restaurants';
import type { Dataset, Food, FoodTag, PriceVerification, Restaurant, SourceType, VerificationStatus } from '@/types';

export const SEED_VALUE = 20261030;
export const SEED_BASE_ISO = '2026-10-01T00:00:00.000Z';

export type SeedVerification = Omit<PriceVerification, 'verified_at' | 'created_at'> & { days_ago: number };

export interface SeedData extends Omit<Dataset, 'verifications' | 'menuImages'> {
  verifications: SeedVerification[];
}

const HUB = {
  taipei: CENTER_PRESETS[0]!,
  taoyuan: CENTER_PRESETS[4]!,
};

const STATUS_BY_RANDOM: [VerificationStatus, SourceType][] = [
  ['store_confirmed', 'store'],
  ['store_confirmed', 'store'],
  ['menu_photo', 'menu_photo'],
  ['menu_photo', 'menu_photo'],
  ['user_report', 'user_report'],
];

const round5 = (n: number) => Math.round(n / 5) * 5;

let cached: SeedData | null = null;

/** 產生固定的模擬資料 (固定亂數種子，每次載入相同) */
export function buildSeed(): SeedData {
  if (cached) return cached;
  const rng = mulberry32(SEED_VALUE);
  const restaurants: Restaurant[] = [];
  const foods: Food[] = [];
  const foodTags: FoodTag[] = [];
  const verifications: SeedVerification[] = [];
  let fId = 0;
  let vId = 0;

  RESTAURANT_DEFS.forEach((def, i) => {
    const hub = HUB[def.hub];
    const pos = offsetPoint(hub, def.bearing, def.km * 1000);
    const rid = detUuid(1, i + 1);
    restaurants.push({
      id: rid,
      name: def.name,
      address: `${def.hub === 'taipei' ? '台北市' : '桃園市'}${def.area} 示範路段附近（測試地址）`,
      latitude: Number(pos.lat.toFixed(6)),
      longitude: Number(pos.lng.toFixed(6)),
      google_place_id: null,
      google_rating: def.rating,
      google_review_count: null,
      phone: null,
      is_test_data: true,
      created_at: SEED_BASE_ISO,
      updated_at: SEED_BASE_ISO,
    });

    const pool = ARCHETYPES[def.arch];
    const fixedNames = Object.keys(def.fixed ?? {});
    const count = Math.min(pool.length, randInt(rng, 3, 8));
    const chosen = shuffle(rng, pool).slice(0, count);
    // 指定價格的餐點一定要入選
    for (const fn of fixedNames) {
      if (!chosen.some((c) => c.name === fn)) {
        const hit = pool.find((p) => p.name === fn);
        if (hit) chosen[chosen.length - 1] = hit;
      }
    }
    const factor = 0.93 + rng() * 0.17;
    const seen = new Set<string>();
    for (const dish of chosen) {
      if (seen.has(dish.name)) continue;
      seen.add(dish.name);
      const fixed = def.fixed?.[dish.name];
      const raw = dish.min + (dish.max - dish.min) * rng();
      let price = fixed ?? round5(raw * factor);
      price = Math.max(35, Math.min(price, 5000)); // 最低 35 元：預算 30 時一定查無結果 (Empty State 情境)
      fId += 1;
      const food: Food = {
        id: detUuid(2, fId),
        restaurant_id: rid,
        name: dish.name,
        description: dish.desc,
        category_id: categoryId(dish.cat),
        price,
        image_url: PHOTO_CREDITS[dish.name]?.imageUrl ?? null,
        is_available: true,
        created_at: SEED_BASE_ISO,
        updated_at: SEED_BASE_ISO,
      };
      foods.push(food);
      for (const tag of dish.tags ?? []) {
        if (tag !== dish.cat) foodTags.push({ food_id: food.id, category_id: categoryId(tag) });
      }

      // 價格驗證紀錄：最新一筆決定新鮮度 (30 天內 50%、31–90 天 30%、90 天以上 20%)
      const roll = rng();
      const latestAgo = roll < 0.5 ? randInt(rng, 0, 30) : roll < 0.8 ? randInt(rng, 31, 90) : randInt(rng, 91, 400);
      const nVer = randInt(rng, 1, 3);
      let ago = latestAgo;
      let p = price;
      for (let k = 0; k < nVer; k++) {
        vId += 1;
        const [status, source] = pick(rng, STATUS_BY_RANDOM);
        const conf =
          source === 'store' ? 0.9 + rng() * 0.09 : source === 'menu_photo' ? 0.6 + rng() * 0.3 : 0.4 + rng() * 0.3;
        verifications.push({
          id: detUuid(3, vId),
          food_id: food.id,
          reported_price: p,
          report_type: null,
          note: null,
          source_type: source,
          source_image_url: null,
          verification_status: status,
          confidence_score: Math.round(conf * 100) / 100,
          days_ago: ago,
        });
        ago += randInt(rng, 40, 150);
        p = Math.max(10, round5(p * (0.88 + rng() * 0.08)));
      }
    }
  });

  cached = { categories: CATEGORIES, restaurants, foods, foodTags, verifications };
  return cached;
}

const DAY = 86_400_000;

/** 把 days_ago 換算成實際日期 (today 注入) */
export function seedToDataset(seed: SeedData, today: Date): Dataset {
  return {
    categories: seed.categories,
    restaurants: seed.restaurants,
    foods: seed.foods,
    foodTags: seed.foodTags,
    verifications: seed.verifications.map(({ days_ago, ...v }) => {
      const iso = new Date(today.getTime() - days_ago * DAY).toISOString();
      return { ...v, verified_at: iso, created_at: iso };
    }),
    menuImages: [],
  };
}
