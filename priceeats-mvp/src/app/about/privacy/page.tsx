import type { Metadata } from 'next';
import { InfoCard, StaticPage } from '@/components/StaticPage';
import { pageMetadata } from '@/lib/page-meta';

export const metadata: Metadata = pageMetadata(
  '隱私說明',
  'PriceEats 不需要帳號。定位只在瀏覽器內用來計算距離，收藏存在你的裝置，回報內容會送到資料庫待確認。使用 Google Analytics 做使用統計。',
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
      <InfoCard heading="使用統計">
        <p>正式網站使用 Google Analytics 4，了解哪些功能有人用，用來改善服務。</p>
        <p>收集的項目：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>瀏覽的頁面</li>
          <li>搜尋的預算、餐點類型、距離與區域名稱（例如「南港車站」）</li>
          <li>是否點開餐點或按導航</li>
          <li>是否按分享、是否送出價格回報</li>
          <li>來源參數（網址中的 ref）</li>
        </ul>
        <p>不收集精確座標，也不收集姓名、帳號等個人身分資料；統計資料不含餐點與店家名稱。</p>
        <p>Google 會使用 cookie 辨識瀏覽器，並可能看到你的 IP 位址。</p>
      </InfoCard>
      <InfoCard heading="第三方服務">
        <p>地圖圖磚來自 OpenStreetMap，字型來自 Google Fonts，使用統計來自 Google Analytics。</p>
        <p>載入時，對方可能看到你的 IP 位址。</p>
      </InfoCard>
    </StaticPage>
  );
}
