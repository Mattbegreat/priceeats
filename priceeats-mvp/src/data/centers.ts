import type { LatLng } from '@/types';

export interface CenterPreset extends LatLng {
  name: string;
}

const TAIPEI_STATION: CenterPreset = { name: '台北車站', lat: 25.0478, lng: 121.517 };
export const NANGANG_STATION: CenterPreset = { name: '南港車站', lat: 25.0525, lng: 121.6073 };

/** 正式模式 (Supabase 兩個變數都設)：真實資料在南港，預設中心用南港車站；其餘 (Mock 測試資料) 維持台北車站。
 *  必須以完整字面量存取，Next.js 才會在建置時內嵌。 */
export const IS_REAL_DATA = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const DEFAULT_CENTER: CenterPreset = IS_REAL_DATA ? NANGANG_STATION : TAIPEI_STATION;

export const CENTER_PRESETS: CenterPreset[] = [
  // 順序固定：種子資料用索引取台北車站 (0) 與桃園車站 (4)，新增項目只能加在最後
  TAIPEI_STATION,
  { name: '西門', lat: 25.0421, lng: 121.5081 },
  { name: '中山', lat: 25.0527, lng: 121.5206 },
  { name: '公館', lat: 25.0148, lng: 121.5342 },
  { name: '桃園車站', lat: 24.9894, lng: 121.3138 },
  NANGANG_STATION,
  { name: '內湖科技園區', lat: 25.0797, lng: 121.5747 },
  { name: '市政府站', lat: 25.0411, lng: 121.5652 },
  { name: '松山車站', lat: 25.0493, lng: 121.5779 },
];

/** 地點選單顯示的中心：正式模式只列有真實資料的區域；測試資料維持全部。 */
export const VISIBLE_PRESETS: CenterPreset[] = IS_REAL_DATA
  ? CENTER_PRESETS.filter((c) => ['南港車站', '內湖科技園區', '市政府站', '松山車站'].includes(c.name))
  : CENTER_PRESETS;

export function centerLabel(p: LatLng): string {
  const hit = CENTER_PRESETS.find((c) => Math.abs(c.lat - p.lat) < 1e-4 && Math.abs(c.lng - p.lng) < 1e-4);
  return hit ? hit.name : '自訂位置';
}
