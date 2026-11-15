'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { distShort } from '@/lib/geo/format';
import { type FoodBase, groupByRestaurant } from '@/lib/search/filter';
import { distLabel } from '@/lib/search/params';
import type { FoodView, SearchParams } from '@/types';
import { TestDataTag } from './Badges';
import { FilterDrawer } from './FilterDrawer';
import type { LocProps } from './HomeView';
import { LeaderRow, PageTitle } from './Receipt';

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
  loc,
}: {
  index: FoodBase[];
  params: SearchParams;
  results: FoodView[];
  today: Date;
  onParams: (p: Partial<SearchParams>) => void;
  onPickCenter: (lat: number, lng: number) => void;
  onOpen: (id: string) => void;
  loc: LocProps;
}) {
  void today;
  const [drawer, setDrawer] = useState(false);
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
      <PageTitle
        title="價格地圖"
        aside={
          <span className="text-aux" data-testid="map-count">
            <span className="amount">{rows.length}</span> 間店 · <span className="amount">{results.length}</span> 道餐點
          </span>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" data-testid="open-filter" onClick={() => setDrawer(true)} className="btn-ink h-11 px-4 text-[15px] font-bold">
          改條件
        </button>
        <span className="amount text-small">
          ${params.budget}・{distLabel(params.dist)}・{params.cat}
        </span>
        <div className="ml-auto flex gap-2" role="group" aria-label="顯示模式">
          <button type="button" aria-label="地圖模式" aria-pressed={mode === 'map'} onClick={() => setMode('map')} className="opt opt-pill">
            地圖
          </button>
          <button type="button" aria-label="清單模式" aria-pressed={mode === 'list'} onClick={() => setMode('list')} className="opt opt-pill">
            清單
          </button>
        </div>
      </div>
      {drawer && (
        <FilterDrawer
          params={params}
          onParams={onParams}
          count={results.length}
          loc={{ source: loc.source, locating: loc.locating, onUseGps: loc.onUseGps, onPickPreset: loc.onPickPreset }}
          onClose={() => setDrawer(false)}
        />
      )}

      {mode === 'map' && (
        <div>
          <div className="relative h-[52vh] min-h-[320px] overflow-hidden border-2 border-ink" data-testid="map-box">
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
                pathOptions={{ color: '#2B4C9B', weight: 2, fillColor: '#2B4C9B', fillOpacity: 0.08 }}
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
            <p role="status" data-testid="tile-error" className="note-box mt-2">
              地圖圖磚暫時無法載入，標記與清單仍可使用，也可切換到「清單模式」。
            </p>
          )}
          <p className="mt-2 text-small">點地圖空白處可設定搜尋中心，點價格標記可看該店符合條件的餐點。</p>
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
          {rows.length === 0 && <li className="receipt text-aux">沒有符合條件的店家，請放寬篩選。</li>}
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
    <section className="receipt" aria-label={row.restaurant.name}>
      <div className="receipt-head">
        <h2 className="min-w-0 flex-1 text-store">
          {row.restaurant.name}
          {row.restaurant.is_test_data && (
            <span className="ml-2 align-middle">
              <TestDataTag />
            </span>
          )}
        </h2>
        <span className="amount shrink-0 text-small text-carbon">{distShort(row.dist)}</span>
      </div>
      <ul className="mt-1.5">
        {row.foods.map((v) => (
          <li key={v.food.id}>
            <button
              type="button"
              aria-label={`${v.food.name} ${v.food.price} 元，查看詳情`}
              onClick={() => onOpen(v.food.id)}
              className="flex min-h-[44px] w-full items-center text-left"
            >
              <LeaderRow left={v.food.name} right={v.food.price} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
