// build:demo 之後檢查 out/：24 個入口頁＋3 個說明頁存在、各頁 <title> 不重複、sitemap.xml 列出 28 個網址、robots.txt 指向 sitemap
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(import.meta.dirname, '../out');
const slugs = ['nangang', 'neihu', 'xinyi', 'songshan', 'xizhi', 'donghu', 'zhongxiao', 'minsheng'];
const budgets = [50, 100, 150];
const files = ['about/source', 'about/privacy', 'about/report', ...slugs.flatMap((s) => budgets.map((b) => `area/${s}/${b}`))];
const errors = [];
const titles = new Map();
let area = 0;
let about = 0;
for (const f of files) {
  const p = resolve(out, `${f}.html`);
  if (!existsSync(p)) {
    errors.push(`缺 ${f}.html`);
    continue;
  }
  f.startsWith('area/') ? area++ : about++;
  const html = readFileSync(p, 'utf8');
  const t = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!t) errors.push(`${f} 沒有 <title>`);
  else titles.set(t, [...(titles.get(t) ?? []), f]);
  if (!/<h1[ >]/.test(html)) errors.push(`${f} 沒有 h1`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) errors.push(`${f} 沒有 description`);
  if (/src="\.\/_next|href="\.\/_next/.test(html)) errors.push(`${f} 資產路徑是相對路徑`);
}
for (const [t, fs] of titles) if (fs.length > 1) errors.push(`title 重複「${t}」：${fs.join(', ')}`);
const sm = existsSync(resolve(out, 'sitemap.xml')) ? readFileSync(resolve(out, 'sitemap.xml'), 'utf8') : '';
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.length !== 28) errors.push(`sitemap.xml 網址 ${locs.length} 個，應為 28`);
if (new Set(locs).size !== locs.length) errors.push('sitemap.xml 有重複網址');
const robots = existsSync(resolve(out, 'robots.txt')) ? readFileSync(resolve(out, 'robots.txt'), 'utf8') : '';
if (!/Sitemap: \S+\/sitemap\.xml/.test(robots)) errors.push('robots.txt 沒有 Sitemap');
console.log(`入口頁 ${area}/24、說明頁 ${about}/3、不重複 title ${titles.size}/${files.length}、sitemap 網址 ${locs.length}`);
console.log(`sitemap 首尾：${locs[0]} … ${locs[locs.length - 1]}`);
console.log(robots.trim().replace(/\n/g, ' | '));
if (errors.length) {
  console.error('失敗：\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('OK');
