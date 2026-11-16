import type { Metadata } from 'next';
import { InfoCard, StaticPage } from '@/components/StaticPage';
import stats from '@/data/area-stats.json';
import { AREAS, AREA_BUDGETS, AREA_DIST_M, findArea, parseAreaBudget } from '@/data/areas';
import { areaDescription, areaPath, areaTitle, lookupStat, searchHref, statDateLabel, type AreaStats } from '@/lib/area-pages';
import { withinWords } from '@/lib/geo/format';
import { pageMetadata } from '@/lib/page-meta';

type Params = { slug: string; budget: string };

/** 靜態匯出：只產生 8 區 × 3 預算，其他路徑 404 */
export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return AREAS.flatMap((a) => AREA_BUDGETS.map((b) => ({ slug: a.slug, budget: String(b) })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, budget } = await params;
  const area = findArea(slug);
  const b = parseAreaBudget(budget);
  if (!area || !b) return {};
  return pageMetadata(areaTitle(area.name, b), areaDescription(area.name, b), areaPath(slug, b));
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug, budget } = await params;
  const area = findArea(slug);
  const b = parseAreaBudget(budget);
  if (!area || !b) return null;
  const st = stats as AreaStats;
  const stat = lookupStat(st, slug, b);
  const date = statDateLabel(st.generatedAt);
  return (
    <StaticPage title={areaTitle(area.name, b)}>
      <InfoCard heading="這一頁">
        <p>
          以{area.name}為中心，{withinWords(AREA_DIST_M)}，找 {b} 元內的餐點。
        </p>
        <p>只看店內價。預設不含單點小菜與多人份。</p>
        {stat && date && (
          <p data-testid="area-stat">
            <span className="amount">{stat.stores}</span> 家店、<span className="amount">{stat.dishes}</span> 道餐點
            <br />
            <span className="text-small">資料統計至 {date}</span>
          </p>
        )}
        <p className="text-small">價格來自菜單照片的 AI 辨識，請以店內實際價格為準。</p>
        <a href={searchHref(area, b)} data-testid="start-search" className="btn-ink mt-2 h-14 w-full text-[18px]">
          開始搜尋
        </a>
      </InfoCard>
      <InfoCard heading="其他預算">
        <ul className="flex flex-wrap gap-2">
          {AREA_BUDGETS.filter((x) => x !== b).map((x) => (
            <li key={x}>
              <a href={areaPath(slug, x)} className="btn-line px-4 text-[15px]">
                <span className="amount">${x}</span>
              </a>
            </li>
          ))}
        </ul>
      </InfoCard>
      <InfoCard heading="其他區域">
        <ul className="flex flex-wrap gap-2">
          {AREAS.filter((a) => a.slug !== slug).map((a) => (
            <li key={a.slug}>
              <a href={areaPath(a.slug, b)} className="btn-line px-4 text-[15px]">
                {a.center}
              </a>
            </li>
          ))}
        </ul>
      </InfoCard>
    </StaticPage>
  );
}
