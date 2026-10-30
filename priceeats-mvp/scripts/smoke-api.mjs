// npm run test:api：需先 npm run build。同一個指令內起 next start、打 API、關閉。
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const port = 3456;
const child = spawn('npx', ['next', 'start', '-p', String(port)], { stdio: 'ignore', detached: true });
const base = `http://127.0.0.1:${port}`;
const kill = () => {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    /* 已結束 */
  }
};
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) break;
    } catch {
      /* 等待啟動 */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const post = (path, body) =>
    fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const h = await (await fetch(`${base}/api/health`)).json();
  assert.deepEqual(h, { ok: true, repository: 'mock' });
  console.log('GET  /api/health ->', JSON.stringify(h));
  let r = await post('/api/reports', { food_id: 'x', report_type: 'price_up', reported_price: 120, note: null });
  assert.equal(r.status, 501);
  console.log('POST /api/reports (mock 模式) ->', r.status);
  r = await post('/api/menu-submissions', { restaurant_name: '' });
  assert.equal(r.status, 501);
  console.log('POST /api/menu-submissions (mock 模式) ->', r.status);
  assert.equal((await fetch(base + '/')).status, 200);
  console.log('GET  / ->', 200);
  console.log('API smoke test 通過 (4/4)');
} finally {
  kill();
}
