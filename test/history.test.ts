import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { appendPoint, lastPoint, parsePoint, pruneIfLarge, readHistory, windowPoints } from '../src/history.js';
import { NOW, fixture, rm, tmpDir } from './helpers.js';

test('readHistory skips broken lines and sorts', () => {
  const pts = readHistory(fixture('history-sample.jsonl'));
  assert.equal(pts.length, 3);
  assert.deepEqual(pts.map((p) => p.five?.pct), [20, 35, 50]);
  assert.deepEqual(readHistory(fixture('does-not-exist.jsonl')), []);
});

test('parsePoint rejects points without any window', () => {
  assert.equal(parsePoint('{"t":1}'), undefined);
  assert.equal(parsePoint('{"five":{"pct":1,"reset":2}}'), undefined);
  assert.deepEqual(parsePoint('{"t":1,"week":{"pct":1,"reset":2},"extra":true}'), { t: 1, week: { pct: 1, reset: 2 } });
});

test('lastPoint reads the end of the file', () => {
  assert.equal(lastPoint(fixture('history-sample.jsonl'))?.t, NOW);
  assert.equal(lastPoint(fixture('nope.jsonl')), undefined);
});

test('appendPoint: one per minute, except when a window changes', (t) => {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const file = path.join(dir, 'h.jsonl');
  const five = { pct: 10, reset: NOW + 3600 };
  assert.equal(appendPoint(file, { t: NOW, five }), true);
  assert.equal(appendPoint(file, { t: NOW + 30, five: { pct: 11, reset: five.reset } }), false);
  // New window (reset moved): recorded right away.
  assert.equal(appendPoint(file, { t: NOW + 40, five: { pct: 0, reset: NOW + 40 + 5 * 3600 } }), true);
  assert.equal(appendPoint(file, { t: NOW + 100, five: { pct: 1, reset: NOW + 40 + 5 * 3600 } }), true);
  assert.equal(readHistory(file).length, 3);
});

test('pruneIfLarge keeps recent points only', (t) => {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const file = path.join(dir, 'h.jsonl');
  const old = { t: NOW - 90 * 86400, five: { pct: 1, reset: NOW - 90 * 86400 + 100 } };
  const recent = { t: NOW, five: { pct: 2, reset: NOW + 100 } };
  fs.writeFileSync(file, JSON.stringify(old) + '\n' + JSON.stringify(recent) + '\n');
  pruneIfLarge(file, NOW, 10);
  assert.deepEqual(readHistory(file), [recent]);
});

test('windowPoints selects the current window only', () => {
  const reset = NOW + 3600;
  const pts = [
    { t: NOW - 7200, five: { pct: 80, reset: NOW - 100 } }, // previous window
    { t: NOW - 600, five: { pct: 5, reset: reset + 30 } }, // same window, small jitter
    { t: NOW, five: { pct: 9, reset } },
    { t: NOW, week: { pct: 9, reset: NOW + 86400 } },
  ];
  assert.deepEqual(windowPoints(pts, 'five', reset), [
    { t: NOW - 600, pct: 5 },
    { t: NOW, pct: 9 },
  ]);
});
