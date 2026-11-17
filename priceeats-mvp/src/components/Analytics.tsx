'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getTracker, trackPageView } from '@/lib/analytics';

/** 全站載入 gtag (只在正式資料＋正式主機名)；非首頁 (/about/*、/area/*) 在這裡送 page_view，
 *  首頁 (單頁 App) 的 view 切換由 App 送，page_path 含 view。 */
export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    getTracker().init();
    if (pathname && pathname !== '/') trackPageView(pathname);
  }, [pathname]);
  return null;
}
