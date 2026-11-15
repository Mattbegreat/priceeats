'use client';

import { useEffect, useRef } from 'react';
import { CATEGORY_FILTERS } from '@/data/categories';
import { DIST_OPTIONS, distLabel } from '@/lib/search/params';
import type { CategoryFilter } from '@/types';

/** 選中的類型自動捲到可見位置 (只捲容器，不動頁面) */
function useScrollSelectedIntoView(value: unknown, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!enabled || !box) return;
    const el = box.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el) return;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollLeft = Math.max(0, left);
  }, [value, enabled]);
  return ref;
}

/** 顯示順序 (畫面稿)：不限、便當、飯類、麵食、早餐、小吃、肉類、海鮮、自助餐 */
const SHOW_ORDER: CategoryFilter[] = ['不限', '便當', '飯類', '麵食', '早餐', '小吃', '肉類', '海鮮', '自助餐'];
const ORDERED = [...SHOW_ORDER.filter((c) => CATEGORY_FILTERS.includes(c)), ...CATEGORY_FILTERS.filter((c) => !SHOW_ORDER.includes(c))];

export function CategoryChips({
  value,
  onChange,
  scroll = false,
  bleed = '-mx-5 px-5',
}: {
  value: CategoryFilter;
  onChange: (c: CategoryFilter) => void;
  scroll?: boolean;
  /** 橫向捲動時讓列表延伸到版面邊緣 (抵銷頁面左右內距) */
  bleed?: string;
}) {
  const ref = useScrollSelectedIntoView(value, scroll);
  return (
    <div
      ref={ref}
      role="group"
      aria-label="餐點類型"
      data-testid="category-chips"
      className={scroll ? `chip-scroll relative flex gap-2 overflow-x-auto ${bleed}` : 'flex flex-wrap gap-2'}
    >
      {ORDERED.map((c) => (
        <button key={c} type="button" aria-label={`類型 ${c}`} aria-pressed={value === c} onClick={() => onChange(c)} className="opt opt-pill">
          {c}
        </button>
      ))}
    </div>
  );
}

/** 走多遠：500m／1km／2km／5km (mono 方角) */
export function DistanceChips({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div role="group" aria-label="走多遠" className="flex flex-wrap gap-2">
      {DIST_OPTIONS.map((d) => (
        <button key={d} type="button" aria-label={`距離 ${distLabel(d)}`} aria-pressed={value === d} onClick={() => onChange(d)} className="opt opt-mono">
          {distLabel(d)}
        </button>
      ))}
    </div>
  );
}
