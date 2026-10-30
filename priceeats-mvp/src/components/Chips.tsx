'use client';

import { CATEGORY_FILTERS } from '@/data/categories';
import { DIST_OPTIONS, distLabel } from '@/lib/search/params';
import type { CategoryFilter } from '@/types';

const chipBase = 'tap shrink-0 rounded-lg border px-3 text-sm font-medium transition';
const on = 'border-forest bg-lime text-forest';
const off = 'border-line bg-white text-ink hover:border-forest';

export function CategoryChips({
  value,
  onChange,
  scroll = false,
}: {
  value: CategoryFilter;
  onChange: (c: CategoryFilter) => void;
  scroll?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="餐點類型"
      className={scroll ? 'chip-scroll -mx-4 flex gap-2 overflow-x-auto px-4' : 'flex flex-wrap gap-2'}
    >
      {CATEGORY_FILTERS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`類型 ${c}`}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={`${chipBase} ${value === c ? on : off}`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function DistanceChips({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div role="group" aria-label="距離" className="flex flex-wrap gap-2">
      {DIST_OPTIONS.map((d) => (
        <button
          key={d}
          type="button"
          aria-label={`距離 ${distLabel(d)}`}
          aria-pressed={value === d}
          onClick={() => onChange(d)}
          className={`${chipBase} ${value === d ? on : off}`}
        >
          {distLabel(d)}
        </button>
      ))}
    </div>
  );
}
