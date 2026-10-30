'use client';

import { useState } from 'react';
import { FoodIllustration } from './FoodIllustration';
import type { CategoryName } from '@/types';

/** 照片載入失敗 (或根本沒有照片) 時一律退回 SVG 插圖，不出現破圖 */
export function FoodImage({
  src,
  alt,
  category,
  className = '',
}: {
  src: string | null;
  alt: string;
  category: CategoryName;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <FoodIllustration category={category} className={`block h-full w-full ${className}`} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`block h-full w-full object-cover ${className}`}
    />
  );
}
