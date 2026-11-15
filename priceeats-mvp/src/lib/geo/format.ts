/** 收據上的距離：390m、1.2km (mono 字型、單位小寫) */
export function distShort(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10 || Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

/** 「500 公尺內」「1 公里內」 */
export function withinWords(m: number): string {
  return m < 1000 ? `${m} 公尺內` : `${m / 1000} 公里內`;
}
