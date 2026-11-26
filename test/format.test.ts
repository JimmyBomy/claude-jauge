import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bar, clock, colorsFor, compact, duration, int, levelColor, paint, pct, shortWhen, localDay, visibleLength } from '../src/format.js';
import { NOW, TZ } from './helpers.js';

test('clock and shortWhen use the given time zone', () => {
  const fr = { lang: 'fr' as const, timeZone: TZ };
  assert.equal(clock(1795683600, fr), '10:00');
  assert.equal(shortWhen(1795683600, NOW, fr), '10:00'); // same day
  assert.equal(shortWhen(1795737600, NOW, fr), 'ven 1:00'); // next day
  assert.equal(shortWhen(1795737600, NOW, { lang: 'en', timeZone: TZ }), 'Fri 1:00');
});

test('localDay', () => {
  assert.equal(localDay(1795737600, 'UTC'), '2026-11-27');
  assert.equal(localDay(1795737600 - 1, 'UTC'), '2026-11-26');
});

test('duration', () => {
  assert.equal(duration(30, 'fr'), '0 min');
  assert.equal(duration(12 * 60, 'fr'), '12 min');
  assert.equal(duration(2 * 3600 + 14 * 60, 'fr'), '2 h 14');
  assert.equal(duration(2 * 3600 + 4 * 60, 'en'), '2h 04');
  assert.equal(duration(3 * 86400 + 11 * 3600, 'fr'), '3 j 11 h');
  assert.equal(duration(-5, 'en'), '0min');
});

test('numbers', () => {
  assert.equal(pct(62.4, 'fr'), '62 %');
  assert.equal(pct(62.6, 'en'), '63%');
  assert.equal(int(1234567, 'fr'), '1 234 567');
  assert.equal(int(1234567, 'en'), '1,234,567');
  assert.equal(compact(1_250_000, 'fr'), '1,3 M');
  assert.equal(compact(845_000, 'en'), '845k');
});

test('bar', () => {
  assert.equal(bar(0, 10), '░'.repeat(10));
  assert.equal(bar(50, 10), '█████░░░░░');
  assert.equal(bar(140, 10), '█'.repeat(10));
});

test('colors respect NO_COLOR and FORCE_COLOR', () => {
  assert.equal(colorsFor(true, { NO_COLOR: '1' }).enabled, false);
  assert.equal(colorsFor(false, { FORCE_COLOR: '1' }).enabled, true);
  assert.equal(colorsFor(true, {}).enabled, true);
  assert.equal(paint({ enabled: false }, 'red', 'x'), 'x');
  assert.equal(visibleLength(paint({ enabled: true }, 'red', 'abc')), 3);
  assert.equal(levelColor(10), 'green');
  assert.equal(levelColor(50), 'yellow');
  assert.equal(levelColor(80), 'red');
});
