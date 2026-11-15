import type { Config } from 'tailwindcss';

/** 收據風格色票：實際色值在 globals.css 的 CSS 變數 (RGB 三元組)，這裡只引用，不散落 hex */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: token('ground'), // 灰藍桌面 (頁面底色)
        paper: token('paper'), // 紙 (卡片、導覽列)
        ink: token('ink'), // 墨 (文字、分隔線、主要按鈕底)
        carbon: token('carbon'), // 複寫藍 (距離、次要連結)
        stamp: token('stamp'), // 印章紅 (預算內印章、目前分頁、錯誤)
        leader: token('leader'), // 點線 (只用於裝飾線)
        edge: token('edge'), // 紙邊陰影
      },
      borderRadius: { pill: '9999px' },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', '-apple-system', '"PingFang TC"', '"Microsoft JhengHei"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        title: ['30px', { lineHeight: '1.15', fontWeight: '900' }],
        store: ['18px', { lineHeight: '1.3', fontWeight: '900' }],
        dish: ['17px', { lineHeight: '1.35', fontWeight: '700' }],
        amount: ['20px', { lineHeight: '1', fontWeight: '600' }],
        aux: ['14px', { lineHeight: '1.4' }],
        small: ['13px', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
};
export default config;
