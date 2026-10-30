import type { Archetype } from './dishes';

export interface RestaurantDef {
  name: string;
  arch: Archetype;
  /** 距離中心 (公里) 與方位 (度) */
  km: number;
  bearing: number;
  rating: number;
  area: string;
  hub: 'taipei' | 'taoyuan';
  /** 指定價格，確保特定情境 (例如剛好 100 元) 一定有資料 */
  fixed?: Record<string, number>;
}

const t = (name: string, arch: Archetype, km: number, bearing: number, rating: number, area: string, fixed?: Record<string, number>): RestaurantDef => ({
  name: `${name}（測試）`, arch, km, bearing, rating, area, hub: 'taipei', ...(fixed ? { fixed } : {}),
});
const y = (name: string, arch: Archetype, km: number, bearing: number, rating: number, area: string): RestaurantDef => ({
  name: `${name}（測試）`, arch, km, bearing, rating, area, hub: 'taoyuan',
});

export const RESTAURANT_DEFS: RestaurantDef[] = [
  // 0–0.5 km
  t('阿財滷肉飯', 'rice', 0.15, 20, 4.6, '中正區', { 滷肉飯: 45 }),
  t('車站前便當', 'bento', 0.25, 200, 4.2, '中正區', { 排骨便當: 100 }),
  t('老陳麵店', 'noodle', 0.35, 90, 4.5, '中正區'),
  t('北門早點', 'breakfast', 0.4, 300, 4.1, '大同區'),
  t('小林自助餐', 'buffet', 0.45, 150, 4.0, '中正區'),
  t('鼎香小吃', 'snack', 0.3, 250, 4.4, '中正區'),
  // 0.5–1 km
  t('阿煌鹽酥雞', 'fried', 0.6, 60, 4.3, '中山區'),
  t('林記牛肉麵', 'beef', 0.7, 280, 4.7, '中正區'),
  t('海味鮮', 'seafood', 0.8, 130, 4.4, '中正區'),
  t('大同便當', 'bento', 0.85, 330, 3.9, '大同區'),
  t('圓環蚵仔煎', 'snack', 0.9, 20, 4.5, '大同區'),
  t('巷口飯糰', 'breakfast', 0.95, 200, 4.2, '中正區'),
  t('咖哩屋', 'curry', 0.75, 110, 4.1, '中山區'),
  // 1–2 km
  t('西門餃子館', 'dumpling', 1.1, 240, 4.3, '萬華區'),
  t('老街滷肉飯', 'rice', 1.3, 255, 4.4, '萬華區'),
  t('南昌路便當', 'bento', 1.4, 190, 4.0, '中正區'),
  t('中山站麵館', 'noodle', 1.2, 15, 4.2, '中山區'),
  t('雙連早餐', 'breakfast', 1.5, 350, 3.8, '大同區'),
  t('新光小吃', 'snack', 1.7, 80, 4.1, '中山區'),
  t('金華自助餐', 'buffet', 1.9, 170, 3.9, '大安區'),
  t('光華牛肉麵', 'beef', 1.8, 140, 4.6, '中正區'),
  // 2–5 km
  t('公館海鮮坊', 'seafood', 3.4, 165, 4.3, '大安區'),
  t('台大旁咖哩', 'curry', 3.6, 175, 4.0, '大安區'),
  t('師大夜市鹽酥雞', 'fried', 2.6, 185, 4.2, '大安區'),
  t('永康街水餃', 'dumpling', 2.4, 150, 4.4, '大安區'),
  t('松山早餐店', 'breakfast', 3.8, 80, 3.7, '松山區'),
  t('士林小吃', 'snack', 5.0, 15, 4.5, '士林區'),
  t('信義便當', 'bento', 4.6, 105, 4.1, '信義區'),
  t('萬華飯桌', 'rice', 2.8, 235, 4.3, '萬華區'),
  t('大橋頭麵店', 'noodle', 3.0, 330, 3.9, '大同區'),
  t('民生社區自助餐', 'buffet', 4.2, 55, 4.0, '松山區'),
  t('東區牛肉麵', 'beef', 3.2, 100, 4.8, '大安區'),
  t('南港便當', 'bento', 4.9, 95, 3.6, '南港區'),
  t('天母炸物', 'fried', 4.8, 10, 4.4, '士林區'),
  t('板橋方向海鮮', 'seafood', 4.5, 235, 4.2, '板橋區'),
  // 桃園車站周邊
  y('桃園站前便當', 'bento', 0.3, 40, 4.1, '桃園區'),
  y('中正路滷肉飯', 'rice', 0.7, 160, 4.5, '桃園區'),
  y('桃園老麵館', 'noodle', 1.1, 270, 4.0, '桃園區'),
  y('藝文早點', 'breakfast', 1.6, 320, 4.2, '桃園區'),
];
