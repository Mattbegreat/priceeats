/** 網站 meta description：正式模式不得出現「測試資料示範版」 */
export function siteDescription(real: boolean): string {
  return real
    ? '輸入預算，找附近買得起的餐點與店內價。'
    : '你的預算，決定今天吃什麼。以餐點店內價格為核心的在地美食搜尋 (測試資料示範版)。';
}

/** 網站正式網址 (og:url、og:image 要絕對網址)；由 NEXT_PUBLIC_SITE_URL 提供，必須以完整字面量存取才會在建置時內嵌 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://priceeats.pages.dev').replace(/\/+$/, '');
/** GA4 評估 ID (公開值)。可用 NEXT_PUBLIC_GA_ID 覆寫，設為空字串即停用追蹤；必須以完整字面量存取才會在建置時內嵌。
 *  只有「正式資料模式＋網址主機名等於 SITE_URL 的主機名」才會真的載入 (見 src/lib/analytics.ts)。 */
export const GA_ID: string = process.env.NEXT_PUBLIC_GA_ID ?? 'G-NNCJKE0X94';
export const OG_IMAGE_URL = `${SITE_URL}/og.png`;
export const SITE_TITLE = 'PriceEats 以預算找餐點';

/** 店家要求更正或下架的聯絡 Email：尚未提供，值為空字串時頁面顯示「聯絡方式準備中」。不要編造。 */
export const CONTACT_EMAIL = 'priceeat.tw@gmail.com';

/** 說明頁 (頁尾連結與 sitemap 共用) */
export const ABOUT_PAGES = [
  { path: '/about/source', label: '資料來源', title: '資料來源與價格說明' },
  { path: '/about/privacy', label: '隱私', title: '隱私說明' },
  { path: '/about/report', label: '回報與聯絡', title: '回報價格錯誤與店家聯絡' },
] as const;
