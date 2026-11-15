'use client';

import { useEffect, useRef, useState } from 'react';
import { IS_REAL_DATA } from '@/data/centers';
import { RATING_OPTIONS, availableSorts } from '@/lib/search/params';
import type { SearchParams, SortKey } from '@/types';
import { BudgetControl } from './BudgetControl';
import { CategoryChips, DistanceChips } from './Chips';
import { CenterSelect, GpsLink, type LocSource } from './LocationPanel';

const SORT_TEXT: Record<SortKey, string> = {
  budget: '最貼近預算',
  price: '最便宜',
  distance: '最近',
  rating: '評價最高',
};

export interface DrawerLoc {
  source: LocSource;
  locating: boolean;
  onUseGps: () => void;
  onPickPreset: (name: string) => void;
}

const sec = 'flex flex-col gap-2 border-b-2 border-dotted border-leader pb-3.5';
const secTitle = 'text-[15px] font-black';

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative flex min-h-[44px] items-center gap-2.5 text-[16px] font-bold focus-within:outline focus-within:outline-[3px] focus-within:outline-carbon">
      <input type="checkbox" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center border-2 border-ink bg-paper">
        {checked && <span className="h-2.5 w-2.5 bg-ink" />}
      </span>
      {label}
    </label>
  );
}

/** 改條件：從底部滑出的紙色抽屜，樣式同收據 (欄位名左、選項右)。變動即時更新，按「看 N 道」關閉。 */
export function FilterDrawer({
  params,
  onParams,
  count,
  loc,
  onClose,
  real = IS_REAL_DATA,
}: {
  params: SearchParams;
  onParams: (p: Partial<SearchParams>) => void;
  count: number;
  loc: DrawerLoc;
  onClose: () => void;
  real?: boolean;
}) {
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  const requestClose = () => setClosing(true);
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(onClose, 160);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  useEffect(() => {
    opener.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClosing(true);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const o = opener.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (o instanceof HTMLElement) o.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="filter-drawer">
      <div className={`absolute inset-0 bg-ink/45 ${closing ? 'drawer-fade-out' : 'drawer-fade-in'}`} onClick={requestClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="改條件"
        className={`relative flex max-h-[94dvh] w-full max-w-xl flex-col border-t-2 border-ink bg-paper ${closing ? 'drawer-out' : 'drawer-in'}`}
      >
        <div className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-[22px] font-black">改條件</h2>
          <button ref={closeRef} type="button" onClick={requestClose} className="link-carbon text-[15px]">
            關閉
          </button>
        </div>
        <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pb-3 pt-2">
          <section className={sec} aria-label="預算上限">
            <h3 className={secTitle}>預算上限</h3>
            <BudgetControl value={params.budget} onChange={(budget) => onParams({ budget })} />
          </section>
          <section className={sec} aria-label="類型">
            <h3 className={secTitle}>類型</h3>
            <CategoryChips value={params.cat} onChange={(cat) => onParams({ cat })} />
          </section>
          <section className={sec} aria-label="走多遠">
            <h3 className={secTitle}>走多遠</h3>
            <DistanceChips value={params.dist} onChange={(dist) => onParams({ dist })} />
          </section>
          <section className={sec} aria-label="先看">
            <h3 className={secTitle}>先看</h3>
            <div className="flex flex-wrap gap-2" role="group" aria-label="排序">
              {availableSorts(real).map((s) => (
                <button key={s} type="button" aria-pressed={params.sort === s} onClick={() => onParams({ sort: s })} className="opt opt-pill">
                  {SORT_TEXT[s]}
                </button>
              ))}
            </div>
          </section>
          <div className="flex flex-col">
            <Check label="也顯示單點小菜、湯品" checked={params.sides} onChange={(sides) => onParams({ sides })} />
            <Check label="也顯示多人份" checked={params.multi} onChange={(multi) => onParams({ multi })} />
          </div>
          <section className={`${sec} border-b-0 border-t-2 border-dotted border-leader pb-0 pt-3.5`} aria-label="出發點">
            <h3 className={secTitle}>出發點</h3>
            <div className="flex flex-wrap items-center gap-x-4">
              <div className="min-w-[150px] flex-1">
                <CenterSelect lat={params.lat} lng={params.lng} source={loc.source} onPickPreset={loc.onPickPreset} />
              </div>
              <GpsLink locating={loc.locating} onUseGps={loc.onUseGps} />
            </div>
          </section>
          {!real && (
            <section className={`${sec} border-b-0 border-t-2 border-dotted border-leader pb-0 pt-3.5`} aria-label="最低評分 (測試資料)">
              <h3 className={secTitle}>最低評分 (測試資料)</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="最低評分">
                {RATING_OPTIONS.map((r) => (
                  <button key={r} type="button" aria-pressed={params.minRating === r} onClick={() => onParams({ minRating: r })} className="opt opt-mono">
                    {r === 0 ? '不限' : r.toFixed(1)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
        <div className="px-5 pb-5 pt-2">
          <button type="button" onClick={requestClose} data-testid="drawer-apply" className="btn-ink h-14 w-full text-[18px]" aria-live="polite">
            看 {count} 道
          </button>
        </div>
      </div>
    </div>
  );
}
