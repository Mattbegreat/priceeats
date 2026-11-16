import type { Metadata } from 'next';
import { InfoCard, StaticPage } from '@/components/StaticPage';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata(
  '資料來源與價格說明',
  'PriceEats 的價格來自店家菜單照片的 AI 辨識，可能有誤差或已調漲，請以店內實際價格為準。每道餐點標示更新年月。',
  '/about/source',
);

export default function Page() {
  return (
    <StaticPage title="資料來源">
      <InfoCard heading="價格從哪來">
        <p>價格來自店家的菜單照片，由 AI 辨識成文字。</p>
        <p>只收店內價，不含外送平台的價格。</p>
      </InfoCard>
      <InfoCard heading="可能有誤">
        <p>AI 辨識可能有誤差。</p>
        <p>店家也可能已經調漲。</p>
        <p className="font-bold">請以店內實際價格為準。</p>
      </InfoCard>
      <InfoCard heading="更新時間">
        <p>每道餐點標示價格的更新年月，例如 2026/03。</p>
        <p>超過 18 個月的資料會標「舊資料」。</p>
      </InfoCard>
      <InfoCard heading="距離與評價">
        <p>走路時間依直線距離估算，不是導航路線。</p>
        <p>不收錄評分，請到 Google Maps 查看評價。</p>
      </InfoCard>
      <InfoCard heading="發現錯誤">
        <p>
          在餐點頁按「回報新價格」，或看
          <a href="/about/report" className="link-carbon">
            回報與聯絡
          </a>
          。
        </p>
      </InfoCard>
    </StaticPage>
  );
}
