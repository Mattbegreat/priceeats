'use client';

import { useEffect, useRef, useState } from 'react';
import { trackShare } from '@/lib/analytics';
import { buildShareUrl, shareOrCopy } from '@/lib/share';

/** 分享：有系統分享就叫出來，否則複製連結 (按鈕上短暫顯示「已複製連結」)。連結保留目前網址條件並加 ref=share。 */
export function ShareButton({
  getText,
  className,
  location,
  testId = 'share-button',
}: {
  getText: () => string;
  className: string;
  location: 'results' | 'food';
  testId?: string;
}) {
  const [msg, setMsg] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function onClick() {
    trackShare(location);
    const r = await shareOrCopy({ text: getText(), url: buildShareUrl(window.location.href) });
    if (r === 'copied' || r === 'failed') {
      setMsg(r === 'copied' ? '已複製連結' : '無法分享，請手動複製網址');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(''), 2200);
    }
  }

  return (
    <>
      <button type="button" data-testid={testId} onClick={onClick} className={className}>
        {msg || '分享'}
      </button>
      <span role="status" className="sr-only">
        {msg}
      </span>
    </>
  );
}
