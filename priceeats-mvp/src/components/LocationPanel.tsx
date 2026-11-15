'use client';

import { VISIBLE_PRESETS, DEFAULT_CENTER, centerLabel } from '@/data/centers';

export type LocSource = 'default' | 'gps' | 'preset' | 'map';

export function locationText(lat: number, lng: number, source: LocSource): string {
  if (source === 'gps') return '目前位置';
  const label = centerLabel({ lat, lng });
  if (label === DEFAULT_CENTER.name && source === 'default') return `預設：${label}`;
  return label;
}

/** 搜尋中心切換：下拉選單 (固定預設地點) */
export function CenterSelect({
  lat,
  lng,
  source,
  onPickPreset,
}: {
  lat: number;
  lng: number;
  source: LocSource;
  onPickPreset: (name: string) => void;
}) {
  const label = centerLabel({ lat, lng });
  return (
    <select
      aria-label="切換中心"
      value={source === 'gps' ? '__gps' : label === '自訂位置' ? '__custom' : label}
      onChange={(e) => {
        if (!e.target.value.startsWith('__')) onPickPreset(e.target.value);
      }}
      className="field font-bold"
    >
      {source === 'gps' && <option value="__gps">目前位置</option>}
      {source !== 'gps' && label === '自訂位置' && <option value="__custom">自訂位置</option>}
      {VISIBLE_PRESETS.map((c) => (
        <option key={c.name} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/** 「改用我現在的位置」：被拒絕時由 note 顯示說明並保留預設中心 */
export function GpsLink({ locating, onUseGps }: { locating: boolean; onUseGps: () => void }) {
  return (
    <button type="button" disabled={locating} onClick={onUseGps} className="link-carbon text-aux disabled:opacity-60">
      {locating ? '定位中…' : '改用我現在的位置'}
    </button>
  );
}

export function LocationNote({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <p className="note-box" role="status" data-testid="location-note">
      {note}
    </p>
  );
}
