'use client';

import type { ViewKey } from '@/types';

/** 四項文字導覽：找餐點／地圖／傳菜單／收藏；目前頁用 stamp 色。「找餐點」涵蓋首頁與結果頁。 */
const ITEMS: { testId: string; label: string; target: ViewKey; match: ViewKey[] }[] = [
  { testId: 'nav-find', label: '找餐點', target: 'results', match: ['home', 'results'] },
  { testId: 'nav-map', label: '地圖', target: 'map', match: ['map'] },
  { testId: 'nav-upload', label: '傳菜單', target: 'upload', match: ['upload'] },
  { testId: 'nav-favorites', label: '收藏', target: 'favorites', match: ['favorites'] },
];

export function BottomNav({ view, onGo, favCount }: { view: ViewKey; onGo: (v: ViewKey) => void; favCount: number }) {
  return (
    <nav aria-label="主要導覽" className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {ITEMS.map(({ testId, label, target, match }) => {
          const active = match.includes(view);
          return (
            <li key={testId}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                data-testid={testId}
                onClick={() => {
                  if (!active) onGo(target);
                }}
                className={`flex h-16 w-full items-center justify-center text-[14px] font-bold ${active ? 'text-stamp' : 'text-ink'}`}
              >
                {label}
                {target === 'favorites' && favCount > 0 && <span className="sr-only">，{favCount} 道</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
