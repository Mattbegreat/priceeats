// 靜態匯出示範版：暫時排除 src/app/api (route handler 不能 output: 'export')，建置後一定還原
import { spawnSync } from 'node:child_process';
import { existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const api = resolve(root, 'src/app/api');
const stash = resolve(root, '.demo-api-stash');

let moved = false;
try {
  if (existsSync(stash)) throw new Error('.demo-api-stash 已存在，請先手動處理 (上次建置可能被中斷)');
  if (existsSync(api)) {
    renameSync(api, stash);
    moved = true;
  }
  rmSync(resolve(root, 'out'), { recursive: true, force: true });
  rmSync(resolve(root, '.next'), { recursive: true, force: true });
  const r = spawnSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BUILD_DEMO: '1', NEXT_PUBLIC_DEMO: '1', NEXT_TELEMETRY_DISABLED: '1' },
  });
  if (r.status !== 0) process.exitCode = r.status ?? 1;
} finally {
  if (moved) renameSync(stash, api);
}
