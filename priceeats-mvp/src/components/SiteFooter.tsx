import { ABOUT_PAGES } from '@/lib/site';

/** 頁尾：三個說明頁連結 (首頁與說明頁共用)。連結用一般 <a>，靜態匯出後不需要 router。 */
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t-2 border-ink pt-2" data-testid="site-footer">
      <nav aria-label="說明頁">
        <ul className="flex flex-wrap gap-x-5">
          {ABOUT_PAGES.map((p) => (
            <li key={p.path}>
              <a href={p.path} className="link-carbon text-[14px]">
                {p.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
