// npm run test:e2e：需先 npm run build:demo，對 out/ 起靜態伺服器後以 node:test 執行
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve(import.meta.dirname, '../out/index.html');
if (!existsSync(out)) {
  console.error('找不到 out/index.html，請先執行 npm run build:demo');
  process.exit(2);
}
const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', resolve(import.meta.dirname, 'app.e2e.mjs')], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
