'use client';

import { Crosshair, MapPin } from 'lucide-react';
import { CENTER_PRESETS, DEFAULT_CENTER, centerLabel } from '@/data/centers';

export type LocSource = 'default' | 'gps' | 'preset' | 'map';

export function locationText(lat: number, lng: number, source: LocSource): string {
  if (source === 'gps') return '目前位置';
  const label = centerLabel({ lat, lng });
  if (label === DEFAULT_CENTER.name && source === 'default') return `預設：${label}`;
  return label;
}

export function LocationBar({
  lat,
  lng,
  source,
  note,
  locating,
  onUseGps,
  onPickPreset,
}: {
  lat: number;
  lng: number;
  source: LocSource;
  note: string | null;
  locating: boolean;
  onUseGps: () => void;
  onPickPreset: (name: string) => void;
}) {
  const label = centerLabel({ lat, lng });
  return (
    <div className="rounded-card border border-line bg-white p-3" data-testid="location-bar">
      <p className="flex items-center gap-1.5 text-sm font-medium" data-testid="location-text">
        <MapPin size={16} aria-hidden className="text-forest" />
        搜尋中心：{locationText(lat, lng, source)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          aria-label="使用目前位置"
          disabled={locating}
          onClick={onUseGps}
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:border-forest disabled:opacity-60"
        >
          <Crosshair size={16} aria-hidden />
          {locating ? '定位中…' : '使用目前位置'}
        </button>
        <label className="sr-only" htmlFor="center-select">
          切換中心
        </label>
        <select
          id="center-select"
          aria-label="切換中心"
          value={source === 'gps' ? '__gps' : label === '自訂位置' ? '__custom' : label}
          onChange={(e) => {
            if (!e.target.value.startsWith('__')) onPickPreset(e.target.value);
          }}
          className="tap rounded-lg border border-line bg-white px-3 text-sm font-medium"
        >
          {source === 'gps' && <option value="__gps">目前位置</option>}
          {source !== 'gps' && label === '自訂位置' && <option value="__custom">自訂位置</option>}
          {CENTER_PRESETS.map((c) => (
            <option key={c.name} value={c.name}>
              切換中心：{c.name}
            </option>
          ))}
        </select>
      </div>
      {note && (
        <p className="mt-2 text-sm text-amber-900" role="status" data-testid="location-note">
          {note}
        </p>
      )}
    </div>
  );
}
