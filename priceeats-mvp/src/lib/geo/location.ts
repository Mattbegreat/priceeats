import { DEFAULT_CENTER } from '@/data/centers';
import type { LatLng } from '@/types';

export type LocateResult =
  | { ok: true; pos: LatLng }
  | { ok: false; reason: 'unsupported' | 'denied' | 'timeout' | 'error' };

export const LOCATE_TIMEOUT_MS = 8000;

export const LOCATE_MESSAGE: Record<'unsupported' | 'denied' | 'timeout' | 'error', string> = {
  unsupported: `此裝置不支援定位，已使用預設位置：${DEFAULT_CENTER.name}`,
  denied: `無法取得定位權限，已使用預設位置：${DEFAULT_CENTER.name}`,
  timeout: `定位逾時 (8 秒)，已使用預設位置：${DEFAULT_CENTER.name}`,
  error: `定位失敗，已使用預設位置：${DEFAULT_CENTER.name}`,
};

/** 取得目前位置；8 秒逾時，拒絕/不支援/逾時都回傳失敗原因讓 UI fallback */
export function locate(timeoutMs = LOCATE_TIMEOUT_MS): Promise<LocateResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve({ ok: false, reason: 'unsupported' });
      return;
    }
    let done = false;
    const finish = (r: LocateResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => finish({ ok: true, pos: { lat: p.coords.latitude, lng: p.coords.longitude } }),
        (e) => finish({ ok: false, reason: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'error' }),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
      );
    } catch {
      finish({ ok: false, reason: 'error' });
    }
  });
}
