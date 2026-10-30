'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CENTER_PRESETS, DEFAULT_CENTER } from '@/data/centers';
import { LOCATE_MESSAGE, locate } from '@/lib/geo/location';
import { buildIndex, search, toView } from '@/lib/search/filter';
import { DEFAULT_PARAMS, buildQuery, parseQuery, type UrlState } from '@/lib/search/params';
import { KEYS, readJson, writeJson } from '@/lib/storage/safe';
import { createRepository } from '@/repositories';
import type { Dataset, SearchParams, ViewKey } from '@/types';
import { BottomNav } from './BottomNav';
import { FavoritesView } from './FavoritesView';
import { FoodDetailSheet } from './FoodDetailSheet';
import { HomeView } from './HomeView';
import type { LocSource } from './LocationBar';
import { ResultsView } from './ResultsView';
import { StateMessage } from './StateMessage';
import { UploadView } from './UploadView';

const MapView = dynamic(() => import('./MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => <StateMessage kind="loading" text="地圖載入中…" />,
});

export function App() {
  const repo = useMemo(() => createRepository(), []);
  const [today] = useState(() => new Date());
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewKey>('home');
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS);
  const [foodId, setFoodId] = useState<string | null>(null);
  const [data, setData] = useState<Dataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favs, setFavs] = useState<string[]>([]);
  const [locSource, setLocSource] = useState<LocSource>('default');
  const [locNote, setLocNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const cur = useRef<UrlState>({ view: 'home', params: DEFAULT_PARAMS, food: null });
  const openedByPush = useRef(false);

  /** 更新狀態並同步到網址 (push 會多一筆歷史、replace 不會) */
  const commit = useCallback((next: Partial<UrlState>, mode: 'push' | 'replace' = 'replace') => {
    const merged: UrlState = { ...cur.current, ...next };
    cur.current = merged;
    setView(merged.view);
    setParams(merged.params);
    setFoodId(merged.food);
    try {
      const url = window.location.pathname + buildQuery(merged);
      if (mode === 'push') window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    } catch {
      /* 網址不可寫入時仍可使用 */
    }
  }, []);

  /** keepOld：重新載入時保留舊資料 (例如送出回報後更新價格歷史，不要讓詳情面板消失) */
  const fetchData = useCallback((keepOld = false) => {
    setLoadError(null);
    if (!keepOld) setData(null);
    repo
      .load(new Date())
      .then(setData)
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : '資料載入失敗'));
  }, [repo]);

  useEffect(() => {
    const s = parseQuery(window.location.search);
    cur.current = s;
    setView(s.view);
    setParams(s.params);
    setFoodId(s.food);
    setFavs(readJson<string[]>(KEYS.favorites, []));
    setReady(true);
    fetchData();
    const onPop = () => {
      const p = parseQuery(window.location.search);
      cur.current = p;
      setView(p.view);
      setParams(p.params);
      setFoodId(p.food);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [fetchData]);

  const index = useMemo(() => (data ? buildIndex(data, today) : null), [data, today]);
  const results = useMemo(() => (index ? search(index, params) : []), [index, params]);

  const setSearchParams = useCallback((p: Partial<SearchParams>) => commit({ params: { ...cur.current.params, ...p } }), [commit]);
  const go = useCallback((v: ViewKey) => commit({ view: v, food: null }, 'push'), [commit]);
  const openFood = useCallback(
    (id: string) => {
      openedByPush.current = true;
      commit({ food: id }, 'push');
    },
    [commit],
  );
  const closeFood = useCallback(() => {
    if (openedByPush.current) {
      openedByPush.current = false;
      window.history.back();
    } else commit({ food: null }, 'replace');
  }, [commit]);

  const toggleFav = useCallback((id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeJson(KEYS.favorites, next);
      return next;
    });
  }, []);

  const useGps = useCallback(async () => {
    setLocating(true);
    const r = await locate();
    setLocating(false);
    if (r.ok) {
      setLocSource('gps');
      setLocNote(null);
      setSearchParams({ lat: r.pos.lat, lng: r.pos.lng });
    } else {
      setLocSource('default');
      setLocNote(LOCATE_MESSAGE[r.reason]);
      setSearchParams({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng });
    }
  }, [setSearchParams]);

  const pickPreset = useCallback(
    (name: string) => {
      const c = CENTER_PRESETS.find((x) => x.name === name);
      if (!c) return;
      setLocSource(c.name === DEFAULT_CENTER.name ? 'default' : 'preset');
      setLocNote(null);
      setSearchParams({ lat: c.lat, lng: c.lng });
    },
    [setSearchParams],
  );

  const pickOnMap = useCallback(
    (lat: number, lng: number) => {
      setLocSource('map');
      setLocNote(null);
      setSearchParams({ lat, lng });
    },
    [setSearchParams],
  );

  const detail = useMemo(() => {
    if (!foodId || !index) return null;
    const base = index.find((b) => b.food.id === foodId);
    return base ? toView(base, params) : null;
  }, [foodId, index, params]);

  const loc = { source: locSource, note: locNote, locating, onUseGps: useGps, onPickPreset: pickPreset };

  let body: React.ReactNode;
  if (!ready) body = <StateMessage kind="loading" text="載入中…" />;
  else if (loadError)
    body = <StateMessage kind="error" text={`資料載入失敗：${loadError}`} actionLabel="重試" onAction={() => fetchData()} />;
  else if (!data || !index) body = <StateMessage kind="loading" text="載入餐點資料中…" />;
  else if (view === 'home')
    body = (
      <HomeView
        params={params}
        onParams={setSearchParams}
        onSearch={() => go('results')}
        isMock={repo.kind === 'mock'}
        loc={loc}
      />
    );
  else if (view === 'results')
    body = (
      <ResultsView
        index={index}
        params={params}
        results={results}
        today={today}
        onParams={setSearchParams}
        onOpen={openFood}
        loc={loc}
      />
    );
  else if (view === 'map')
    body = (
      <MapView
        index={index}
        params={params}
        results={results}
        today={today}
        onParams={setSearchParams}
        onPickCenter={pickOnMap}
        onOpen={openFood}
      />
    );
  else if (view === 'upload')
    body = <UploadView repo={repo} data={data} today={today} presetRestaurantId={uploadTarget} />;
  else
    body = (
      <FavoritesView index={index} favs={favs} params={params} today={today} onOpen={openFood} onToggleFav={toggleFav} />
    );

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-line bg-forest text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-bold tracking-wide">PriceEats</span>
          <span className="text-xs text-lime">你的預算，決定今天吃什麼</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-4">{body}</main>
      {detail && (
        <FoodDetailSheet
          view={detail}
          data={data as Dataset}
          today={today}
          repo={repo}
          isFav={favs.includes(detail.food.id)}
          onToggleFav={() => toggleFav(detail.food.id)}
          onClose={closeFood}
          onReported={() => fetchData(true)}
          onUploadMenu={() => {
            setUploadTarget(detail.restaurant.id);
            openedByPush.current = false;
            commit({ view: 'upload', food: null }, 'push');
          }}
        />
      )}
      <BottomNav view={view} onGo={go} favCount={favs.length} />
    </div>
  );
}
