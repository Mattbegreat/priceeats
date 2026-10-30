/** localStorage 讀寫全部包 try/catch：不可用時回傳預設值並降級，頁面照常運作 */
export function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 回傳是否寫入成功 */
export function writeJson(key: string, value: unknown): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

export const KEYS = {
  favorites: 'priceeats:favorites',
  reports: 'priceeats:reports',
  submissions: 'priceeats:menu-submissions',
  draft: 'priceeats:upload-draft',
} as const;
