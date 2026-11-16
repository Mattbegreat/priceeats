import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContactInfo } from '@/components/ContactInfo';
import { EmptyState } from '@/components/EmptyState';
import { SiteFooter } from '@/components/SiteFooter';
import stats from '@/data/area-stats.json';
import { AREAS, AREA_BUDGETS, findArea, parseAreaBudget } from '@/data/areas';
import { CENTER_PRESETS } from '@/data/centers';
import { allPaths, areaDescription, areaPath, areaTitle, lookupStat, searchHref, statDateLabel, type AreaStats } from '@/lib/area-pages';
import { DEFAULT_PARAMS } from '@/lib/search/params';
import { ABOUT_PAGES, CONTACT_EMAIL, SITE_URL } from '@/lib/site';
import Privacy from '@/app/about/privacy/page';
import Report from '@/app/about/report/page';
import Source from '@/app/about/source/page';
import AreaPage, { generateStaticParams } from '@/app/area/[slug]/[budget]/page';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';

const html = (node: ReactNode) => renderToStaticMarkup(node as ReactElement);
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

describe('M6 入口頁資料', () => {
  it('8 區 × 3 預算 = 24 個靜態路徑；slug 都是英文且不重複；每區對得到中心', () => {
    expect(AREAS).toHaveLength(8);
    expect(AREA_BUDGETS).toEqual([50, 100, 150]);
    expect(generateStaticParams()).toHaveLength(24);
    expect(new Set(AREAS.map((a) => a.slug)).size).toBe(8);
    for (const a of AREAS) {
      expect(a.slug).toMatch(/^[a-z]+$/);
      expect(findArea(a.slug)).not.toBeNull();
      expect(CENTER_PRESETS.some((c) => c.name === a.center)).toBe(true);
    }
    expect(findArea('nope')).toBeNull();
    expect(parseAreaBudget('100')).toBe(100);
    expect(parseAreaBudget('200')).toBeNull();
    expect(parseAreaBudget('abc')).toBeNull();
  });
  it('每頁 title、description 獨立 (24 組不重複)', () => {
    const titles = new Set<string>();
    const descs = new Set<string>();
    for (const a of AREAS) for (const b of AREA_BUDGETS) {
      titles.add(areaTitle(a.center, b));
      descs.add(areaDescription(a.center, b));
    }
    expect(titles.size).toBe(24);
    expect(descs.size).toBe(24);
  });
  it('「開始搜尋」連結帶 view、budget、lat、lng', () => {
    const area = findArea('nangang')!;
    const u = new URL(searchHref(area, 100), 'https://x.test');
    expect(u.pathname).toBe('/');
    expect(u.searchParams.get('view')).toBe('results');
    expect(u.searchParams.get('budget')).toBe('100');
    expect(Number(u.searchParams.get('lat'))).toBeCloseTo(area.lat, 4);
    expect(Number(u.searchParams.get('lng'))).toBeCloseTo(area.lng, 4);
  });
  it('統計：查不到就回 null；日期轉 YYYY/MM/DD', () => {
    const s: AreaStats = { generatedAt: '2026-11-16', areas: { nangang: { '100': { stores: 3, dishes: 9 } } } };
    expect(lookupStat(s, 'nangang', 100)).toEqual({ stores: 3, dishes: 9 });
    expect(lookupStat(s, 'nangang', 50)).toBeNull();
    expect(lookupStat(s, 'neihu', 100)).toBeNull();
    expect(statDateLabel('2026-11-16')).toBe('2026/11/16');
    expect(statDateLabel(null)).toBeNull();
    expect(statDateLabel('11/16')).toBeNull();
  });
  it('已提交的 area-stats.json：有日期、24 組都有數字、餐點數 ≥ 店數 ≥ 1', () => {
    const s = stats as AreaStats;
    expect(statDateLabel(s.generatedAt)).not.toBeNull();
    for (const a of AREAS) for (const b of AREA_BUDGETS) {
      const x = lookupStat(s, a.slug, b);
      expect(x, `${a.slug}/${b}`).not.toBeNull();
      expect(x!.stores).toBeGreaterThanOrEqual(1);
      expect(x!.dishes).toBeGreaterThanOrEqual(x!.stores);
    }
  });
});

describe('M6 入口頁內容', () => {
  const render = async (slug: string, budget: string) => html(await AreaPage({ params: Promise.resolve({ slug, budget }) }));
  it('顯示 H1、店數、餐點數、統計日期與開始搜尋按鈕', async () => {
    const out = await render('nangang', '100');
    const st = lookupStat(stats as AreaStats, 'nangang', 100)!;
    expect(out).toContain('<h1');
    expect(out).toContain('南港車站 100 元內吃什麼');
    expect(out).toContain(`>${st.stores}</span> 家店`);
    expect(out).toContain(`>${st.dishes}</span> 道餐點`);
    expect(out).toMatch(/資料統計至 \d{4}\/\d{2}\/\d{2}/);
    expect(out).toContain('開始搜尋');
    expect(out).toContain('href="/?view=results&amp;budget=100&amp;lat=');
    expect(out).toContain('footer');
  });
  it('統計是空的時候不顯示數字與日期', async () => {
    vi.resetModules();
    vi.doMock('@/data/area-stats.json', () => ({ default: { generatedAt: null, areas: {} } }));
    const mod = await import('@/app/area/[slug]/[budget]/page');
    const out = html(await mod.default({ params: Promise.resolve({ slug: 'neihu', budget: '50' }) }));
    expect(out).toContain('內湖科技園區 50 元內吃什麼');
    expect(out).not.toContain('家店');
    expect(out).not.toContain('資料統計至');
    vi.doUnmock('@/data/area-stats.json');
    vi.resetModules();
  });
});

describe('M6 說明頁', () => {
  it('資料來源：AI 辨識、可能有誤差或已調漲、以店內實際價格為準、更新年月、如何回報', () => {
    const out = html(createElement(Source));
    for (const t of ['菜單照片', 'AI 辨識', '誤差', '調漲', '店內實際價格為準', '更新年月', '回報新價格']) expect(out).toContain(t);
  });
  it('隱私：不需帳號、定位只在瀏覽器內計算距離、收藏存本機、回報送到資料庫待確認', () => {
    const out = html(createElement(Privacy));
    for (const t of ['不需要註冊或登入', '定位只在瀏覽器內用來計算距離', '收藏存在這個瀏覽器', '送到資料庫', '待確認']) expect(out).toContain(t);
  });
  it('回報：步驟與店家聯絡；顯示 CONTACT_EMAIL 的 mailto 連結', () => {
    expect(CONTACT_EMAIL).toBe('priceeat.tw@gmail.com');
    const out = html(createElement(Report));
    expect(out).toContain('回報新價格');
    expect(out).toContain('店家要求更正或下架');
    expect(out).toContain('href="mailto:priceeat.tw@gmail.com"');
    expect(out).not.toContain('聯絡方式準備中');
  });
  it('ContactInfo：有值才顯示 mailto 連結', () => {
    expect(html(createElement(ContactInfo, { email: '' }))).toContain('聯絡方式準備中');
    expect(html(createElement(ContactInfo, { email: '  ' }))).toContain('聯絡方式準備中');
    const withMail = html(createElement(ContactInfo, { email: 'a@example.com' }));
    expect(withMail).toContain('href="mailto:a@example.com"');
    expect(withMail).not.toContain('聯絡方式準備中');
  });
  it('頁尾有三個說明頁連結', () => {
    const out = html(createElement(SiteFooter));
    for (const p of ABOUT_PAGES) expect(out).toContain(`href="${p.path}"`);
    expect(ABOUT_PAGES).toHaveLength(3);
  });
});

describe('M6 sitemap／robots', () => {
  it('sitemap 28 個網址 (首頁＋3 說明頁＋24 入口頁)，不重複，用 SITE_URL', () => {
    const urls = sitemap().map((x) => x.url);
    expect(urls).toHaveLength(28);
    expect(new Set(urls).size).toBe(28);
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/about/source`);
    expect(urls).toContain(`${SITE_URL}${areaPath('nangang', 100)}`);
    expect(allPaths()).toHaveLength(28);
    for (const u of urls) expect(u.startsWith(SITE_URL)).toBe(true);
  });
  it('robots：允許全站並指向 sitemap.xml', () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(r.rules).toMatchObject({ userAgent: '*', allow: '/' });
  });
});

/** 在元件回傳的元素樹裡找 data-testid，不需要瀏覽器 */
function findByTestId(node: ReactNode, id: string): ReactElement<{ onClick?: () => void }> | null {
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<{ 'data-testid'?: string; children?: ReactNode; onClick?: () => void }>;
  if (el.props['data-testid'] === id) return el;
  const kids = Array.isArray(el.props.children) ? el.props.children : [el.props.children];
  for (const k of kids as ReactNode[]) {
    const f = findByTestId(k, id);
    if (f) return f;
  }
  return null;
}

describe('M5 追加：無資料區跳轉', () => {
  it('按「看最近的某區」：切到該區並把距離設為 1km (dist=1000)', () => {
    const areas = CENTER_PRESETS.filter((c) => AREAS.some((a) => a.center === c.name));
    const onPickArea = vi.fn();
    const onParams = vi.fn();
    const tree = EmptyState({
      index: [],
      params: { ...DEFAULT_PARAMS, lat: 25.0143, lng: 121.4627 },
      onParams,
      onPickArea,
      onUpload: () => {},
      real: true,
      areas,
    });
    const btn = findByTestId(tree, 'nearest-area');
    expect(btn).not.toBeNull();
    btn!.props.onClick!();
    expect(onPickArea).toHaveBeenCalledWith('忠孝復興站');
    expect(onParams).toHaveBeenCalledWith({ dist: 1000 });
  });
});
