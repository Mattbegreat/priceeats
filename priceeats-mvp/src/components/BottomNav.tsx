'use client';

import { Heart, Home, ListFilter, Map as MapIcon, Upload } from 'lucide-react';
import type { ViewKey } from '@/types';

const ITEMS: { key: ViewKey; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: '首頁', Icon: Home },
  { key: 'results', label: '結果', Icon: ListFilter },
  { key: 'map', label: '地圖', Icon: MapIcon },
  { key: 'upload', label: '上傳', Icon: Upload },
  { key: 'favorites', label: '收藏', Icon: Heart },
];

export function BottomNav({ view, onGo, favCount }: { view: ViewKey; onGo: (v: ViewKey) => void; favCount: number }) {
  return (
    <nav aria-label="主要導覽" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white">
      <ul className="mx-auto flex max-w-5xl">
        {ITEMS.map(({ key, label, Icon }) => {
          const active = view === key;
          return (
            <li key={key} className="flex-1">
              <button
                type="button"
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                data-testid={`nav-${key}`}
                onClick={() => onGo(key)}
                className={`tap flex h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  active ? 'text-forest' : 'text-mute'
                }`}
              >
                <span className={`rounded-full px-4 py-0.5 ${active ? 'bg-lime' : ''}`}>
                  <Icon size={20} aria-hidden />
                </span>
                {label}
                {key === 'favorites' && favCount > 0 && <span className="sr-only">，{favCount} 道</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
