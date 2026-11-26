import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastWindow, linearRegression } from '../src/forecast.js';
import { readHistory } from '../src/history.js';
import { NOW, fixture } from './helpers.js';

test('linearRegression', () => {
  const r = linearRegression([0, 1, 2, 3], [1, 3, 5, 7])!;
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 1);
  assert.equal(linearRegression([1], [1]), null);
  assert.equal(linearRegression([2, 2], [1, 5]), null);
});

test('hit: 30 %/h from 50 % at 6:00 UTC → 100 % at 7:40 UTC, before the 9:00 reset', () => {
  const pts = readHistory(fixture('history-sample.jsonl'));
  const f = forecastWindow(pts, 'five', pts[2]!.five!, NOW);
  assert.deepEqual(f, { kind: 'hit', at: NOW + 100 * 60 });
});

test('safe: the weekly window grows too slowly', () => {
  const pts = readHistory(fixture('history-sample.jsonl'));
  assert.deepEqual(forecastWindow(pts, 'week', pts[2]!.week!, NOW), { kind: 'safe' });
});

test('safe when usage is flat', () => {
  const reset = NOW + 3600;
  const pts = [
    { t: NOW - 1800, five: { pct: 40, reset } },
    { t: NOW, five: { pct: 40, reset } },
  ];
  assert.deepEqual(forecastWindow(pts, 'five', { pct: 40, reset }, NOW), { kind: 'safe' });
});

test('unknown with one point or a too short span', () => {
  const reset = NOW + 3600;
  assert.deepEqual(forecastWindow([], 'five', { pct: 10, reset }, NOW), { kind: 'unknown' });
  const close = [{ t: NOW - 120, five: { pct: 5, reset } }];
  assert.deepEqual(forecastWindow(close, 'five', { pct: 10, reset }, NOW), { kind: 'unknown' });
});

test('points of a previous window are ignored', () => {
  const reset = NOW + 3600;
  const pts = [
    { t: NOW - 4 * 3600, five: { pct: 0, reset: NOW - 3 * 3600 } },
    { t: NOW - 3.5 * 3600, five: { pct: 95, reset: NOW - 3 * 3600 } },
  ];
  assert.deepEqual(forecastWindow(pts, 'five', { pct: 10, reset }, NOW), { kind: 'unknown' });
});

test('reached', () => {
  assert.deepEqual(forecastWindow([], 'five', { pct: 100, reset: NOW + 60 }, NOW), { kind: 'reached' });
});
