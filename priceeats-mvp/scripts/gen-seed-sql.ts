import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSeed } from '../src/data/seed';
import { renderSeedSql } from '../src/data/seed/sql';

const seed = buildSeed();
const file = resolve(__dirname, '../supabase/seed.sql');
writeFileSync(file, renderSeedSql(seed));
console.log(`寫入 ${file}：${seed.restaurants.length} 家餐廳、${seed.foods.length} 道餐點、${seed.verifications.length} 筆驗證紀錄`);
