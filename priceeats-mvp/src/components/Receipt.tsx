import type { ReactNode } from 'react';

/** 「預算內」紅框印章 */
export function Stamp({ children = '預算內' }: { children?: ReactNode }) {
  return <span className="stamp">{children}</span>;
}

/** 餐點列：左名稱、中間點線填滿、右金額 (mono)。不放餐點示意圖。 */
export function LeaderRow({ left, right, size = 'list', priceTestId }: { left: ReactNode; right: ReactNode; size?: 'list' | 'big'; priceTestId?: string }) {
  return (
    <span className="flex w-full items-baseline gap-1.5">
      <span className={`min-w-0 font-bold leading-snug ${size === 'big' ? 'text-dish' : 'text-[16px]'}`}>{left}</span>
      <span aria-hidden className="leader-dots" />
      <span className={`amount shrink-0 ${size === 'big' ? 'text-amount' : 'text-[19px]'}`} data-testid={priceTestId}>
        {right}
      </span>
    </span>
  );
}

/** 頁面標題：第一行 PriceEats，第二行 30px/900 標題 */
export function PageTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="space-y-2.5 pb-4">
      <div className="flex items-center justify-between text-small font-bold">
        <span>PriceEats</span>
        {aside}
      </div>
      <h1 className="text-title">{title}</h1>
    </div>
  );
}
