/** 網站 meta description：正式模式不得出現「測試資料示範版」 */
export function siteDescription(real: boolean): string {
  return real
    ? '輸入預算，找附近買得起的餐點與店內價。'
    : '你的預算，決定今天吃什麼。以餐點店內價格為核心的在地美食搜尋 (測試資料示範版)。';
}
