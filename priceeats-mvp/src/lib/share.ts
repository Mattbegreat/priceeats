/** 分享：連結與文字組成 (純函式) 與分享動作 (navigator.share，不支援時複製連結) */

export const SHARE_REF = 'share';

/** 保留目前網址的所有條件，加上 ref=share (已有 ref 則覆蓋) */
export function buildShareUrl(href: string): string {
  const u = new URL(href);
  u.searchParams.set('ref', SHARE_REF);
  return u.toString();
}

/** 結果頁分享文字：「南港車站 100 元內有 23 道，看看今天吃什麼」 */
export function resultsShareText(center: string, budget: number, count: number): string {
  return `${center} ${budget} 元內有 ${count} 道，看看今天吃什麼`;
}

/** 餐點頁分享文字：「店名 餐點 85 元」 */
export function foodShareText(restaurant: string, food: string, price: number): string {
  return `${restaurant} ${food} ${price} 元`;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 退回舊作法 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 有 navigator.share 就叫出系統分享；沒有或失敗就複製連結 */
export async function shareOrCopy(payload: { text: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'PriceEats', text: payload.text, url: payload.url });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(payload.url)) ? 'copied' : 'failed';
}
