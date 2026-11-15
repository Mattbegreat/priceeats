'use client';

import { useState } from 'react';
import { centerLabel } from '@/data/centers';
import { withinWords } from '@/lib/geo/format';
import { distLabel } from '@/lib/search/params';
import type { FoodView, SearchParams } from '@/types';
import { BudgetControl } from './BudgetControl';
import { CategoryChips, DistanceChips } from './Chips';
import { CenterSelect, GpsLink, LocationNote, type LocSource } from './LocationPanel';
import { LeaderRow, Stamp } from './Receipt';
import { TestDataTag } from './Badges';

export interface LocProps {
  source: LocSource;
  note: string | null;
  locating: boolean;
  onUseGps: () => void;
  onPickPreset: (name: string) => void;
}

export function HomeView({
  params,
  onParams,
  onSearch,
  isMock,
  loc,
  results,
}: {
  params: SearchParams;
  onParams: (p: Partial<SearchParams>) => void;
  onSearch: () => void;
  isMock: boolean;
  loc: LocProps;
  /** 資料載入前為 null：範例收據不出現，也不擋操作 */
  results: FoodView[] | null;
}) {
  const [panel, setPanel] = useState(false);
  const where = loc.source === 'gps' ? '目前位置' : centerLabel(params);
  const sample = results ? results.slice(0, 3) : [];
  return (
    <div className="flex flex-col gap-[18px]" data-testid="home-view">
      <div className="flex items-center justify-between text-small font-bold">
        <span>PriceEats</span>
        <button
          type="button"
          aria-expanded={panel}
          aria-controls="home-location"
          data-testid="center-button"
          onClick={() => setPanel((o) => !o)}
          className="link-carbon amount text-small !justify-end"
        >
          {where} {distLabel(params.dist)}
        </button>
      </div>
      {panel && (
        <div id="home-location" className="receipt" data-testid="location-panel">
          <p className="mb-2 text-[15px] font-black">出發點</p>
          <CenterSelect lat={params.lat} lng={params.lng} source={loc.source} onPickPreset={loc.onPickPreset} />
          <p className="mb-2 mt-3 text-[15px] font-black">走多遠</p>
          <DistanceChips value={params.dist} onChange={(dist) => onParams({ dist })} />
        </div>
      )}
      <h1 className="text-[clamp(30px,10.2vw,38px)] font-black leading-[1.2]">
        今天這餐，
        <br />
        最多花多少？
      </h1>
      {isMock && (
        <p className="note-box" data-testid="mock-banner">
          目前使用測試資料：店家、價格與評分皆為模擬，並非真實店家資料。
        </p>
      )}
      <section aria-label="預算">
        <BudgetControl value={params.budget} onChange={(budget) => onParams({ budget })} />
      </section>
      <section aria-label="類型">
        <CategoryChips scroll value={params.cat} onChange={(cat) => onParams({ cat })} />
      </section>
      <button type="button" data-testid="search-button" onClick={onSearch} className="btn-ink h-14 text-[18px]">
        找 {params.budget} 元內的餐點
      </button>
      <div className="flex flex-col items-start">
        <GpsLink locating={loc.locating} onUseGps={loc.onUseGps} />
        <LocationNote note={loc.note} />
      </div>
      {results && (
        <div className="receipt mt-1 -rotate-1" data-testid="sample-receipt">
          <div className="receipt-head">
            <h2 className="min-w-0 flex-1 text-[16px] font-black">{loc.source === 'gps' ? '目前位置' : where}附近，今天查得到</h2>
            <Stamp>預算內</Stamp>
          </div>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {sample.length === 0 && <p className="text-aux">這個範圍內沒有 {params.budget} 元內的餐點。</p>}
            {sample.map((v) => (
              <div key={v.food.id} className="flex items-baseline">
                <LeaderRow left={v.food.name} right={v.food.price} />
              </div>
            ))}
            <p className="text-small font-bold text-carbon">
              {withinWords(params.dist)}共 <span className="amount" data-testid="sample-count">{results.length}</span> 道
              {isMock && (
                <>
                  {' '}
                  <TestDataTag />
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
