import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWidgetView } from '../src/widget-model.js';
import { NOW, TZ, readFixture } from './helpers.js';

const history = readFixture('history-sample.jsonl');

test('widget view: gauges, levels, forecast alert (French)', () => {
  const v = buildWidgetView(history, undefined, NOW + 30, 'fr', TZ);
  assert.equal(v.updatedText, "mis à jour à l'instant");
  assert.equal(v.stale, false);
  assert.equal(v.emptyText, undefined);
  assert.deepEqual(
    v.windows.map((w) => [w.label, w.leftText, w.level, w.levelLabel, w.resetText, w.alertText]),
    [
      ['5 h', '50 %', 'warning', 'Attention', 'reset 10:00', 'limite vers 8:40'],
      ['Semaine', '68 %', 'normal', 'Normal', 'reset ven 1:00', undefined],
    ],
  );
});

test('widget view: today tokens and top model (English)', () => {
  const v = buildWidgetView(history, { day: '2026-11-26', total: 1_250_000, byModel: { 'claude-opus-4-5-20251101': 1_000_000, 'claude-haiku-4-5-20251001': 250_000 } }, NOW, 'en', TZ);
  assert.equal(v.todayText, 'Today: 1.3M tokens');
  assert.equal(v.topModelText, 'opus-4-5 80%');
});

test('widget view: empty history explains the setup, stale data is flagged', () => {
  const empty = buildWidgetView('', undefined, NOW, 'en', TZ);
  assert.equal(empty.windows.length, 0);
  assert.match(empty.emptyText ?? '', /claude-jauge install/);
  const later = buildWidgetView(history, undefined, NOW + 2 * 3600, 'en', TZ);
  assert.equal(later.stale, true);
  assert.equal(later.updatedText, 'updated 2h 00 ago');
});

test('widget view: a window past its reset shows 100 % left', () => {
  const v = buildWidgetView(history, undefined, 1795683600 + 60, 'en', TZ);
  const five = v.windows.find((w) => w.key === 'five')!;
  assert.equal(five.leftText, '100%');
  assert.equal(five.level, 'normal');
  assert.match(five.resetText, /window reset at 10:00/);
});
