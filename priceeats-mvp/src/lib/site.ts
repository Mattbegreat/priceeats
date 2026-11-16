/** 網站 meta description：正式模式不得出現「測試資料示範版」 */
export function siteDescription(real: boolean): string {
  return real
    ? '輸入預算，找附近買得起的餐點與店內價。'
    : '你的預算，決定今天吃什麼。以餐點店內價格為核心的在地美食搜尋 (測試資料示範版)。';
}

/** 網站正式網址 (og:url、og:image 要絕對網址)；由 NEXT_PUBLIC_SITE_URL 提供，必須以完整字面量存取才會在建置時內嵌 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://priceeats.pages.dev').replace(/\/+$/, '');
export const OG_IMAGE_URL = `${SITE_URL}/og.png`;
export const SITE_TITLE = 'PriceEats 以預算找餐點';
