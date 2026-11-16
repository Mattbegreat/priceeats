'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CENTER_PRESETS, DEFAULT_CENTER } from '@/data/centers';
import { LOCATE_MESSAGE, locate } from '@/lib/geo/location';
import { buildIndex, search, toView, type FoodBase } from '@/lib/search/filter';
import { DEFAULT_PARAMS, buildQuery, parseQuery, type UrlState } from '@/lib/search/params';
import { KEYS, readJson, writeJson } from '@/lib/storage/safe';
import { createRepository } from '@/repositories';
import type { Dataset, SearchParams, ViewKey } from '@/types';
import { BottomNav } from './BottomNav';
import { FavoritesView } from './FavoritesView';
import { FoodDetailSheet } from './FoodDetailSheet';
import { HomeView } from './HomeView';
import type { LocSource } from './LocationPanel';
import { ResultsView } from './ResultsView';
import { SiteFooter } from './SiteFooter';
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
  const loadSeq = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

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
    const { lat, lng, dist } = cur.current.params;
    const seq = ++loadSeq.current;
    setLoadError(null);
    if (!keepOld) setData(null);
    setRefreshing(true);
    repo
      .load(new Date(), { center: { lat, lng }, radiusM: dist })
      .then((d) => seq === loadSeq.current && setData(d))
      .catch((e: unknown) => seq === loadSeq.current && setLoadError(e instanceof Error ? e.message : '資料載入失敗'))
      .finally(() => seq === loadSeq.current && setRefreshing(false));
  }, [repo]);

  useEffect(() => {
    const s = parseQuery(window.location.search);
    cur.current = s;
    setView(s.view);
    setParams(s.params);
    setFoodId(s.food);
    setFavs(readJson<string[]>(KEYS.favorites, []));
    setReady(true);
    const onPop = () => {
      const p = parseQuery(window.location.search);
      cur.current = p;
      setView(p.view);
      setParams(p.params);
      setFoodId(p.food);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /** 搜尋中心或距離改變時載入對應範圍：Mock 一次載完不重載；Supabase 由 repo 快取判斷是否真的要下載 (縮小距離不會) */
  useEffect(() => {
    if (!ready) return;
    if (repo.kind === 'mock' && loadSeq.current > 0) return;
    fetchData(true);
  }, [ready, repo, params.lat, params.lng, params.dist, fetchData]);

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
  const ready2 = ready && !loadError && data && index;

  let body: React.ReactNode;
  if (!ready) body = <StateMessage kind="loading" text="載入中…" />;
  else if (view === 'home')
    // 首頁不等資料：表單立即可操作，範例收據在資料載入後才出現
    body = (
      <>
        {loadError && (
          <div className="mb-4">
            <StateMessage kind="error" text={`資料載入失敗：${loadError}`} actionLabel="重試" onAction={() => fetchData()} />
          </div>
        )}
        <HomeView
          params={params}
          onParams={setSearchParams}
          onSearch={() => go('results')}
          isMock={repo.kind === 'mock'}
          loc={loc}
          results={ready2 ? results : null}
        />
        <SiteFooter />
      </>
    );
  else if (loadError)
    body = <StateMessage kind="error" text={`資料載入失敗：${loadError}`} actionLabel="重試" onAction={() => fetchData()} />;
  else if (!data || !index) body = <StateMessage kind="loading" text="載入餐點資料中…" />;
  else if (view === 'results')
    body = (
      <ResultsView
        index={index}
        params={params}
        results={results}
        today={today}
        onParams={setSearchParams}
        onOpen={openFood}
        onUpload={() => go('upload')}
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
        loc={loc}
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
      {refreshing && data && !loadError && (
        <div role="status" className="bg-paper px-5 py-1 text-center text-small font-bold">
          更新附近餐點中…
        </div>
      )}
      <main className="mx-auto w-full max-w-xl px-5 pb-6 pt-4">{body}</main>
      {detail && (
        <FoodDetailSheet
          view={detail}
          data={data as Dataset}
          index={index as FoodBase[]}
          params={params}
          today={today}
          repo={repo}
          isFav={favs.includes(detail.food.id)}
          backLabel={view === 'results' || view === 'home' ? '回結果' : '返回'}
          onToggleFav={() => toggleFav(detail.food.id)}
          onClose={closeFood}
          onSwitch={(id) => commit({ food: id }, 'replace')}
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
