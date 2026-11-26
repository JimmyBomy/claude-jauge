import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeState, forecastText, renderGauges } from '../src/gauges.js';
import { readHistory } from '../src/history.js';
import { NOW, TZ, fixture } from './helpers.js';

const off = { enabled: false };

test('no data: explains how to start', () => {
  const out = renderGauges(computeState([], NOW), 'fr', off, TZ);
  assert.match(out, /Aucune donnée/);
  assert.match(out, /npx claude-jauge install/);
});

test('gauges with forecast (French)', () => {
  const state = computeState(readHistory(fixture('history-sample.jsonl')), NOW + 30);
  const out = renderGauges(state, 'fr', off, TZ);
  const expected = [
    "claude-jauge · mis à jour à l'instant",
    '',
    'Fenêtre 5 h  ██████████░░░░░░░░░░  50 % utilisé · 50 % restant',
    '             remise à zéro 10:00 (dans 2 h 59)',
    '             à ce rythme, limite atteinte vers 8:40',
    'Semaine      ██████░░░░░░░░░░░░░░  32 % utilisé · 68 % restant',
    '             remise à zéro ven 1:00 (dans 17 h 59)',
    '             à ce rythme, pas de limite avant la remise à zéro',
  ].join('\n');
  assert.equal(out, expected);
});

test('window already reset and stale data (English)', () => {
  const pts = readHistory(fixture('history-sample.jsonl'));
  const later = 1795683600 + 3600; // one hour after the 5h reset
  const out = renderGauges(computeState(pts, later), 'en', off, TZ);
  assert.match(out, /updated 4h 00 ago/);
  assert.match(out, /latest data is 4h 00 old/);
  assert.match(out, /window reset at 10:00, waiting for new data/);
});

test('forecastText', () => {
  assert.equal(forecastText({ kind: 'hit', at: NOW + 10 }, NOW, 'en', TZ), 'at this pace, limit reached very soon');
  assert.equal(forecastText({ kind: 'reached' }, NOW, 'fr', TZ), 'limite atteinte');
  assert.equal(forecastText({ kind: 'unknown' }, NOW, 'en', TZ), 'forecast: not enough points in this window');
});
