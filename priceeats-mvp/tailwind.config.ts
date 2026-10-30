import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#172C28',
        lime: '#D6F5B5',
        ok: '#16A34A',
        canvas: '#F7F8F5',
        ink: '#202823',
        mute: '#5B6660',
        line: '#E1E5DD',
        warn: '#B45309',
      },
      borderRadius: { card: '12px' },
      fontFamily: {
        sans: ['system-ui', '-apple-system', '"PingFang TC"', '"Noto Sans TC"', '"Microsoft JhengHei"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
