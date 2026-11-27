import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limitsView, tokensView } from '../src/dashboard-data.js';
import { readHistory } from '../src/history.js';
import { renderPage } from '../src/page.js';
import { NOW, TZ, fixture } from './helpers.js';

test('limitsView: same gauges as the web API, without touching the disk', () => {
  const v = limitsView(readHistory(fixture('history-sample.jsonl')), { lang: 'fr', days: 3650, timeZone: TZ }, NOW + 30);
  assert.equal(v.gauges.length, 2);
  assert.equal(v.gauges[0]!.forecastText, 'à ce rythme, limite atteinte vers 8:40');
  assert.equal(v.history.length, 3);
  assert.equal(limitsView([], { lang: 'en', days: 14 }, NOW).gauges.length, 0);
});

test('tokensView: daily bars and model table from per-day totals', () => {
  const v = tokensView([
    { day: '2026-11-26', model: 'claude-opus-4-5-20251101', tokens: 300 },
    { day: '2026-11-25', model: 'claude-sonnet-4-5', tokens: 500 },
    { day: '2026-11-26', model: 'claude-sonnet-4-5', tokens: 100 },
  ]);
  assert.deepEqual(v.daily, [
    { key: '2026-11-25', total: 500, models: { 'sonnet-4-5': 500 } },
    { key: '2026-11-26', total: 400, models: { 'opus-4-5': 300, 'sonnet-4-5': 100 } },
  ]);
  assert.deepEqual(v.models, [
    { key: 'sonnet-4-5', total: 600 },
    { key: 'opus-4-5', total: 300 },
  ]);
});

test('the web page inlines the shared dashboard code and its local API', () => {
  const html = renderPage('en');
  assert.match(html, /\(function startDashboard\(cfg\)/);
  assert.match(html, /fetch\('\/api\/limits'/);
  assert.doesNotMatch(html, /\bimport\b/);
});
