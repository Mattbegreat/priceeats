import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';

/** 說明頁與入口頁的外框：第一行 PriceEats (回首頁)、標題、內容、頁尾。沿用收據風格 token。 */
export function StaticPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen pb-10">
      <main className="mx-auto w-full max-w-xl px-5 pb-6 pt-4">
        <div className="space-y-2.5 pb-4">
          <div className="flex items-center justify-between text-small font-bold">
            <Link href="/" prefetch={false} className="link-carbon !text-ink !no-underline">
              PriceEats
            </Link>
          </div>
          <h1 className="text-title text-balance">{title}</h1>
        </div>
        <div className="flex flex-col gap-6">{children}</div>
        <SiteFooter />
      </main>
    </div>
  );
}

/** 一張收據：小標題＋下方 2px 實線＋內容 */
export function InfoCard({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="receipt" aria-label={heading}>
      <div className="receipt-head">
        <h2 className="text-[17px] font-black">{heading}</h2>
      </div>
      <div className="mt-3 space-y-2 text-pretty text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}
