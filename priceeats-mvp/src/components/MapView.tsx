'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { List, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { formatDistance } from '@/lib/geo/haversine';
import { type FoodBase, groupByRestaurant } from '@/lib/search/filter';
import type { FoodView, SearchParams } from '@/types';
import { TestDataTag } from './Badges';
import { FilterBar } from './FilterBar';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function priceIcon(price: number, selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="price-marker${selected ? ' sel' : ''}">$${price}</div>`,
    iconSize: [54, 28],
    iconAnchor: [27, 14],
  });
}

const centerIcon = L.divIcon({ className: '', html: '<div class="center-marker"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });

function Fit({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ animate: false });
      map.fitBounds(L.latLng(lat, lng).toBounds(radius * 2), { animate: false, padding: [12, 12] });
    };
    fit();
    // 容器尺寸在版面完成後才確定，延後再校正一次
    const t = setTimeout(fit, 60);
    return () => clearTimeout(t);
  }, [map, lat, lng, radius]);
  return null;
}

function ClickToCenter({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function MapView({
  results,
  params,
  today,
  onParams,
  onPickCenter,
  onOpen,
}: {
  index: FoodBase[];
  params: SearchParams;
  results: FoodView[];
  today: Date;
  onParams: (p: Partial<SearchParams>) => void;
  onPickCenter: (lat: number, lng: number) => void;
  onOpen: (id: string) => void;
}) {
  void today;
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const groups = useMemo(() => groupByRestaurant(results), [results]);
  const rows = useMemo(
    () =>
      [...groups.values()]
        .map((list) => ({
          restaurant: list[0]!.restaurant,
          foods: [...list].sort((a, b) => a.food.price - b.food.price),
          min: Math.min(...list.map((v) => v.food.price)),
          dist: list[0]!.distanceM,
        }))
        .sort((a, b) => a.min - b.min || a.dist - b.dist),
    [groups],
  );
  const selRow = rows.find((r) => r.restaurant.id === selected) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <h1 className="text-xl font-bold text-forest">價格地圖</h1>
        <p className="text-sm text-mute" data-testid="map-count">
          {rows.length} 間店 · {results.length} 道餐點
        </p>
      </div>
      <FilterBar params={params} onParams={onParams} />
      <div className="flex gap-2" role="group" aria-label="顯示模式">
        <button
          type="button"
          aria-label="地圖模式"
          aria-pressed={mode === 'map'}
          onClick={() => setMode('map')}
          className={`tap inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${mode === 'map' ? 'border-forest bg-lime text-forest' : 'border-line bg-white'}`}
        >
          <MapIcon size={16} aria-hidden /> 地圖
        </button>
        <button
          type="button"
          aria-label="清單模式"
          aria-pressed={mode === 'list'}
          onClick={() => setMode('list')}
          className={`tap inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${mode === 'list' ? 'border-forest bg-lime text-forest' : 'border-line bg-white'}`}
        >
          <List size={16} aria-hidden /> 清單
        </button>
      </div>

      {mode === 'map' && (
        <div>
          <div className="relative h-[52vh] min-h-[320px] overflow-hidden rounded-card border border-line" data-testid="map-box">
            <MapContainer
              center={[params.lat, params.lng]}
              zoom={14}
              scrollWheelZoom
              className="h-full w-full"
              attributionControl
            >
              <TileLayer
                url={TILE_URL}
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者'
                eventHandlers={{
                  tileerror: () => setTileError(true),
                  tileload: () => setTileError(false),
                }}
              />
              <Fit lat={params.lat} lng={params.lng} radius={params.dist} />
              <ClickToCenter onPick={onPickCenter} />
              <Circle
                center={[params.lat, params.lng]}
                radius={params.dist}
                pathOptions={{ color: '#172C28', weight: 2, fillColor: '#D6F5B5', fillOpacity: 0.2 }}
              />
              <Marker position={[params.lat, params.lng]} icon={centerIcon} interactive={false} keyboard={false} />
              {rows.map((r) => (
                <Marker
                  key={r.restaurant.id}
                  position={[r.restaurant.latitude, r.restaurant.longitude]}
                  icon={priceIcon(r.min, r.restaurant.id === selected)}
                  title={`${r.restaurant.name} 最低 ${r.min} 元`}
                  eventHandlers={{ click: () => setSelected(r.restaurant.id) }}
                />
              ))}
            </MapContainer>
          </div>
          {tileError && (
            <p role="status" data-testid="tile-error" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              地圖圖磚暫時無法載入，標記與清單仍可使用，也可切換到「清單模式」。
            </p>
          )}
          <p className="mt-2 text-xs text-mute">點地圖空白處可設定搜尋中心，點價格標記可看該店符合條件的餐點。</p>
          {selRow && (
            <div className="mt-3" data-testid="map-selected">
              <RestaurantBlock row={selRow} onOpen={onOpen} />
            </div>
          )}
        </div>
      )}

      {mode === 'list' && (
        <ul className="space-y-3" data-testid="map-list">
          {rows.map((r) => (
            <li key={r.restaurant.id}>
              <RestaurantBlock row={r} onOpen={onOpen} />
            </li>
          ))}
          {rows.length === 0 && <li className="rounded-card border border-line bg-white p-6 text-center text-mute">沒有符合條件的店家，請放寬篩選。</li>}
        </ul>
      )}
    </div>
  );
}

function RestaurantBlock({
  row,
  onOpen,
}: {
  row: { restaurant: FoodView['restaurant']; foods: FoodView[]; min: number; dist: number };
  onOpen: (id: string) => void;
}) {
  return (
    <section className="rounded-card border border-line bg-white p-3" aria-label={row.restaurant.name}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex flex-wrap items-center gap-1.5 text-base font-semibold">
          {row.restaurant.name}
          {row.restaurant.is_test_data && <TestDataTag />}
        </h2>
        <span className="text-sm text-mute">{formatDistance(row.dist)}</span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {row.foods.map((v) => (
          <li key={v.food.id}>
            <button
              type="button"
              aria-label={`${v.food.name} ${v.food.price} 元，查看詳情`}
              onClick={() => onOpen(v.food.id)}
              className="tap flex w-full items-center justify-between gap-2 py-2 text-left"
            >
              <span>{v.food.name}</span>
              <span className="text-lg font-bold text-forest tabular-nums">${v.food.price}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
