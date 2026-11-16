import type { Metadata } from 'next';
import { ContactInfo } from '@/components/ContactInfo';
import { InfoCard, StaticPage } from '@/components/StaticPage';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata(
  '回報價格錯誤與店家聯絡',
  '發現價格錯誤，可以在餐點頁回報。店家要求更正或下架，請看聯絡方式。',
  '/about/report',
);

export default function Page() {
  return (
    <StaticPage title="回報與聯絡">
      <InfoCard heading="價格有誤">
        <ol className="list-decimal space-y-1 pl-5">
          <li>打開那道餐點的頁面。</li>
          <li>按「回報新價格」。</li>
          <li>選調漲、調降、停售或資訊錯誤，填新價格。</li>
          <li>按「送出回報」。</li>
        </ol>
        <p>回報會先標示為「待確認」，不會直接修改價格。</p>
      </InfoCard>
      <InfoCard heading="店家要求更正或下架">
        <p>請提供店名、地址與要更正或下架的餐點。</p>
        <ContactInfo />
      </InfoCard>
    </StaticPage>
  );
}
