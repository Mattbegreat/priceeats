import type { Metadata } from 'next';
import { InfoCard, StaticPage } from '@/components/StaticPage';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata(
  '隱私說明',
  'PriceEats 不需要帳號。定位只在瀏覽器內用來計算距離，收藏存在你的裝置，回報內容會送到資料庫待確認。',
  '/about/privacy',
);

export default function Page() {
  return (
    <StaticPage title="隱私">
      <InfoCard heading="帳號">
        <p>不需要註冊或登入。</p>
      </InfoCard>
      <InfoCard heading="定位">
        <p>定位只在瀏覽器內用來計算距離。</p>
        <p>查附近餐點時，只送出概略範圍，不送出帳號或身分資料。</p>
        <p>不想開定位，可以直接選車站或在地圖上點選。</p>
      </InfoCard>
      <InfoCard heading="收藏">
        <p>收藏存在這個瀏覽器，不會上傳。</p>
        <p>清除網站資料後，收藏會消失。</p>
      </InfoCard>
      <InfoCard heading="回報與傳菜單">
        <p>回報與傳菜單的內容（價格、說明、餐點資料）會送到資料庫。</p>
        <p>送出後先標示為「待確認」，不會直接改變店內價格。</p>
      </InfoCard>
      <InfoCard heading="第三方服務">
        <p>地圖圖磚來自 OpenStreetMap，字型來自 Google Fonts。</p>
        <p>載入時，對方可能看到你的 IP 位址。</p>
      </InfoCard>
    </StaticPage>
  );
}
