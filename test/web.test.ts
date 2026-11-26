import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { allowedHost, buildLimits, buildTokens, createServer, TokenCache } from '../src/web.js';
import { renderPage } from '../src/page.js';
import { NOW, TZ, fixture } from './helpers.js';

const opts = { lang: 'fr' as const, historyFile: fixture('history-sample.jsonl'), projectsDir: fixture('claude', 'projects'), days: 3650, timeZone: TZ };

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = http.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

function get(port: number, pathname: string, host = `127.0.0.1:${port}`): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, headers: { Host: host } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('allowedHost blocks other hosts (DNS rebinding)', () => {
  assert.equal(allowedHost('127.0.0.1:4269', 4269), true);
  assert.equal(allowedHost('localhost:4269', 4269), true);
  assert.equal(allowedHost('evil.example:4269', 4269), false);
  assert.equal(allowedHost(undefined, 4269), false);
});

test('buildLimits and buildTokens', async () => {
  const d = buildLimits(opts, NOW + 30);
  assert.equal(d.gauges.length, 2);
  assert.equal(d.gauges[0]!.forecastText, 'à ce rythme, limite atteinte vers 8:40');
  assert.equal(d.history.length, 3);
  const tk = await buildTokens(opts, NOW + 30);
  assert.equal(tk.daily.length, 3);
  assert.equal(tk.models[0]!.key, 'sonnet-4-5');
});

test('TokenCache computes once, then serves the cached value', async () => {
  let calls = 0;
  const cache = new TokenCache(async () => ({ n: ++calls }), 60_000);
  const [a, b] = await Promise.all([cache.refresh(), cache.get()]);
  assert.equal(a, '{"n":1}');
  assert.equal(b, '{"n":1}');
  assert.equal(await cache.get(), '{"n":1}');
  assert.equal(calls, 1);
});

test('page is self-contained (no external URL) and has both themes', () => {
  const html = renderPage('en');
  assert.doesNotMatch(html, /(src|href)=["']https?:/);
  assert.match(html, /prefers-color-scheme:light/);
  assert.match(html, /data-theme=light/);
});

test('server serves the page and the API on loopback', async (t) => {
  const port = await freePort();
  const server = createServer(opts, port);
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  t.after(() => server.close());
  const page = await get(port, '/');
  assert.equal(page.status, 200);
  assert.match(page.body, /<html lang="fr">/);
  assert.match(String(page.headers['content-security-policy']), /default-src 'none'/);
  const limits = await get(port, '/api/limits');
  assert.equal(limits.status, 200);
  assert.equal(JSON.parse(limits.body).lang, 'fr');
  const tokens = await get(port, '/api/tokens');
  assert.equal(JSON.parse(tokens.body).models[0].key, 'sonnet-4-5');
  assert.equal((await get(port, '/nope')).status, 404);
  assert.equal((await get(port, '/', 'evil.example')).status, 403);
});

test('page uses the shared theme tokens for both themes', () => {
  const html = renderPage('fr');
  assert.match(html, /--normal:#30d158/);
  assert.match(html, /--normal:#146c2e/);
  assert.match(html, /prefers-reduced-transparency/);
  assert.match(html, /prefers-reduced-motion/);
});
