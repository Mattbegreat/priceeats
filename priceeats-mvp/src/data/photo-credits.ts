/**
 * 照片授權登錄表。
 *
 * 規格偏好使用 Wikimedia Commons 可熱連結照片，但必須先確認「網址可用、授權、作者」。
 * 本次開發環境無法連到 commons.wikimedia.org (WebFetch 皆回傳 url_not_found)，
 * 無法驗證，因此依規格「不要自創或猜圖片網址」，目前 0 張 Commons 照片，全部使用 SVG 插圖。
 *
 * 要新增照片時，在此登錄 (dishName 對應餐點名稱)，seed 會自動帶入 image_url，詳情頁會標示授權：
 *   '牛肉麵': {
 *     imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/...',
 *     title: 'File:xxx.jpg',
 *     pageUrl: 'https://commons.wikimedia.org/wiki/File:xxx.jpg',
 *     author: '作者名',
 *     license: 'CC BY-SA 4.0',
 *     licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
 *   },
 */
export interface PhotoCredit {
  imageUrl: string;
  title: string;
  pageUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
}

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {};

export function creditForImage(imageUrl: string | null): PhotoCredit | null {
  if (!imageUrl) return null;
  return Object.values(PHOTO_CREDITS).find((c) => c.imageUrl === imageUrl) ?? null;
}
