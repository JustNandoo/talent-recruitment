import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { createApp } from '../server.js';
import { browserCommand } from '../lib/browser.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="launch-guard">([\s\S]*?)<\/script>/)[1];

test('membuka file HTML mengarahkan ke server dan tidak menunggu modul file lokal', () => {
  let destination = null;
  runInNewContext(script, { window: { location: { protocol: 'file:', replace: url => { destination = url; } } } });
  assert.equal(destination, 'http://localhost:3000/');
});
test('kegagalan memuat modul pada HTTP menampilkan petunjuk setelah 12 detik', () => {
  const loading = { textContent: 'Menyiapkan Talenta…' };
  let callback, delay;
  runInNewContext(script, { window: { location: { protocol: 'http:' }, setTimeout: (fn, ms) => { callback = fn; delay = ms; } }, document: { querySelector: () => loading } });
  assert.equal(delay, 12000);
  callback();
  assert.match(loading.textContent, /npm start/);
  assert.notEqual(loading.textContent, 'Menyiapkan Talenta…');
});
test('skrip pembuka diizinkan CSP berdasarkan hash; nama file HTTP menuju halaman aplikasi', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'talenta-launch-'));
  const { server, store } = createApp({ dataDir: dir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /HRD Division PT Serviam Group Shipyard/);
  const logo = await fetch(base + '/serviam-logo.svg');
  assert.equal(logo.status, 200);
  assert.match(logo.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(await logo.text(), /PT Serviam Group Shipyard/);
  const expected = createHash('sha256').update(script).digest('base64');
  const csp = response.headers.get('content-security-policy');
  assert.ok(csp.includes(`script-src 'self' 'sha256-${expected}'`));
  assert.equal(csp.split(';').find(s => s.trim().startsWith('script-src')).includes("'unsafe-inline'"), false);
  for (const path of ['/index.html', '/public/index.html']) {
    const redirect = await fetch(base + path, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/');
  }
});
test('perintah pembuka browser memakai argumen tanpa shell pada tiga platform', () => {
  const url = 'http://localhost:3456/';
  assert.deepEqual(browserCommand(url, 'win32'), { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] });
  assert.deepEqual(browserCommand(url, 'darwin'), { command: 'open', args: [url] });
  assert.deepEqual(browserCommand(url, 'linux'), { command: 'xdg-open', args: [url] });
});
