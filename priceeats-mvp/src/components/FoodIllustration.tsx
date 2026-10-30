import type { CategoryName } from '@/types';

const TINT: Record<CategoryName, { bg: string; fg: string }> = {
  便當: { bg: '#E6F2D5', fg: '#2F5D3A' },
  飯類: { bg: '#FBF1D6', fg: '#8A5A12' },
  麵食: { bg: '#FCE7D3', fg: '#9A4A12' },
  肉類: { bg: '#F8DDD6', fg: '#8C2F1F' },
  海鮮: { bg: '#D9EEF5', fg: '#1F5F7A' },
  早餐: { bg: '#FFF3C4', fg: '#8A6A00' },
  小吃: { bg: '#EBE0F0', fg: '#5A3F6B' },
  自助餐: { bg: '#DDEFE6', fg: '#1F6B4E' },
};

function Motif({ cat, fg }: { cat: CategoryName; fg: string }) {
  switch (cat) {
    case '便當':
      return (
        <g>
          <rect x="20" y="30" width="60" height="42" rx="6" fill="#fff" stroke={fg} strokeWidth="3" />
          <path d="M50 30v42M20 51h60" stroke={fg} strokeWidth="3" />
          <circle cx="35" cy="41" r="6" fill={fg} opacity=".5" />
          <rect x="58" y="36" width="16" height="10" rx="3" fill={fg} opacity=".7" />
          <circle cx="35" cy="62" r="5" fill={fg} opacity=".7" />
          <rect x="56" y="57" width="18" height="10" rx="3" fill={fg} opacity=".4" />
        </g>
      );
    case '飯類':
      return (
        <g>
          <path d="M18 50h64a32 28 0 0 1-64 0z" fill="#fff" stroke={fg} strokeWidth="3" />
          <path d="M26 50a24 20 0 0 1 48 0z" fill={fg} opacity=".55" />
          <path d="M60 22l22 22M66 18l22 22" stroke={fg} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case '麵食':
      return (
        <g>
          <path d="M16 50h68a34 30 0 0 1-68 0z" fill="#fff" stroke={fg} strokeWidth="3" />
          <path d="M26 50c4-10 8 10 12 0s8 10 12 0 8 10 12 0 8 10 12 0" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" />
          <path d="M34 36c3-6-3-8 0-14M50 36c3-6-3-8 0-14M66 36c3-6-3-8 0-14" fill="none" stroke={fg} strokeWidth="3" strokeLinecap="round" opacity=".6" />
        </g>
      );
    case '肉類':
      return (
        <g>
          <path d="M30 62c-10-16 2-38 24-36 14 1 22 12 14 26-8 14-28 20-38 10z" fill={fg} opacity=".75" />
          <path d="M62 56l16 16" stroke={fg} strokeWidth="6" strokeLinecap="round" />
          <circle cx="82" cy="76" r="5" fill="#fff" stroke={fg} strokeWidth="3" />
        </g>
      );
    case '海鮮':
      return (
        <g>
          <path d="M16 50c14-22 40-22 54 0-14 22-40 22-54 0z" fill={fg} opacity=".75" />
          <path d="M70 50l16-14v28z" fill={fg} opacity=".75" />
          <circle cx="36" cy="46" r="4" fill="#fff" />
        </g>
      );
    case '早餐':
      return (
        <g>
          <path d="M20 58c-6-18 6-34 28-32 22-2 34 14 28 32-6 14-50 14-56 0z" fill="#fff" stroke={fg} strokeWidth="3" />
          <circle cx="48" cy="48" r="13" fill={fg} opacity=".7" />
        </g>
      );
    case '小吃':
      return (
        <g>
          <path d="M16 62c4-24 24-36 34-36s30 12 34 36c-14 8-54 8-68 0z" fill="#fff" stroke={fg} strokeWidth="3" />
          <path d="M30 56c4-10 6-18 8-24M44 58c2-10 3-20 4-28M58 56c-1-10-3-18-6-24" stroke={fg} strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      );
    case '自助餐':
      return (
        <g>
          <rect x="16" y="28" width="68" height="46" rx="6" fill="#fff" stroke={fg} strokeWidth="3" />
          <path d="M50 28v46M16 51h68" stroke={fg} strokeWidth="3" />
          <circle cx="33" cy="39" r="6" fill={fg} opacity=".6" />
          <circle cx="67" cy="39" r="6" fill={fg} opacity=".8" />
          <circle cx="33" cy="62" r="6" fill={fg} opacity=".8" />
          <circle cx="67" cy="62" r="6" fill={fg} opacity=".5" />
        </g>
      );
  }
}

/** 依分類設計的 SVG 插圖 (沒有照片、或照片載入失敗時使用) */
export function FoodIllustration({ category, className = '' }: { category: CategoryName; className?: string }) {
  const t = TINT[category];
  return (
    <svg
      role="img"
      aria-label={`${category}插圖`}
      viewBox="0 0 100 100"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      data-testid="food-illustration"
    >
      <rect width="100" height="100" fill={t.bg} />
      <Motif cat={category} fg={t.fg} />
    </svg>
  );
}
