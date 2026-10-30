/** Google 地圖「看評價」連結：以店名＋地址搜尋 (正式資料不存、不顯示評分數字) */
export function googleMapsReviewUrl(name: string, address: string): string {
  const query = [name, address].map((s) => s.trim()).filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query }).toString()}`;
}
