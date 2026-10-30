// npm run import:menu -- [--dry-run] <json檔或資料夾> [...]
// 只在本機執行：需要環境變數 SUPABASE_SERVICE_ROLE_KEY 與 SUPABASE_URL（或 NEXT_PUBLIC_SUPABASE_URL）。
// service role key 絕對不要放進前端、NEXT_PUBLIC_ 變數或 Netlify。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { emptyStats, formatReport, validateStore, type SkippedStore, type ValidStore, type WriteStats } from '../src/lib/import/menu';
import { MenuImportWriter } from '../src/lib/import/writer';

const USAGE = `用法：npm run import:menu -- [--dry-run] <json檔或資料夾> [...]
  --dry-run   只驗證並印報告，不連線、不寫入（不需要金鑰）
  一店一檔；資料夾會讀其中所有 .json（不含子資料夾）`;

function tryLoadEnvFile(): void {
  // 方便本機使用：若有 .env.local 就載入（已存在的環境變數不會被覆蓋）。.env.local 已在 .gitignore。
  // 自己解析，相容 Windows 記事本存的 BOM、CRLF、UTF-16 與引號。
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) {
    console.error('提示：目前資料夾沒有 .env.local，只使用現有環境變數。');
    return;
  }
  try {
    const buf = readFileSync(p);
    const text =
      buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
    for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch (e) {
    console.error(`提示：讀取 .env.local 失敗：${(e as Error).message}`);
  }
}

function collectFiles(inputs: string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    const p = resolve(process.cwd(), input);
    if (!existsSync(p)) {
      console.error(`找不到：${input}`);
      process.exit(2);
    }
    if (statSync(p).isDirectory()) {
      const inDir = readdirSync(p)
        .filter((f) => f.toLowerCase().endsWith('.json'))
        .sort()
        .map((f) => join(p, f));
      files.push(...inDir);
    } else {
      files.push(p);
    }
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }
  const dryRun = args.includes('--dry-run');
  const inputs = args.filter((a) => !a.startsWith('--'));
  if (inputs.length === 0) {
    console.error(USAGE);
    process.exit(2);
  }
  tryLoadEnvFile();

  const files = collectFiles(inputs);
  const stores: ValidStore[] = [];
  const skippedStores: SkippedStore[] = [];
  for (const file of files) {
    const label = file.replace(`${process.cwd()}/`, '');
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      skippedStores.push({ file: label, name: null, reason: `JSON 解析失敗：${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const r = validateStore(raw, label);
    if (r.ok) stores.push(r.store);
    else skippedStores.push(r.skipped);
  }

  const failedStores: SkippedStore[] = [];
  let stats: WriteStats | undefined;

  if (!dryRun) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('缺少環境變數：需要 SUPABASE_SERVICE_ROLE_KEY，以及 SUPABASE_URL（或 NEXT_PUBLIC_SUPABASE_URL）。');
      console.error(`目前狀態：SUPABASE_URL ${url ? '有' : '沒有'}，SUPABASE_SERVICE_ROLE_KEY ${key ? '有' : '沒有'}。`);
      console.error('只想驗證檔案請加 --dry-run。');
      process.exit(2);
    }
    if (key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY 與 anon key 相同，請確認填的是 service role key。');
      process.exit(2);
    }
    const writer = new MenuImportWriter(url, key);
    stats = emptyStats();
    for (const store of stores) {
      try {
        const s = await writer.writeStore(store);
        stats.newRestaurants += s.newRestaurants;
        stats.newFoods += s.newFoods;
        stats.updatedFoods += s.updatedFoods;
        stats.newVerifications += s.newVerifications;
        stats.duplicateVerifications += s.duplicateVerifications;
      } catch (e) {
        failedStores.push({ file: store.file, name: store.name, reason: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  console.log(formatReport({ dryRun, fileCount: files.length, stores, skippedStores, failedStores, stats }));
  if (failedStores.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
