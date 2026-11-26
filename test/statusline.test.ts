import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { extractLimits, parseInput, renderLine, runStatusline } from '../src/statusline.js';
import { readHistory } from '../src/history.js';
import { NOW, TZ, readFixture, rm, tmpDir } from './helpers.js';

const plain = { nowSec: NOW, colors: { enabled: false }, timeZone: TZ };

test('reads the documented rate_limits format', () => {
  const limits = extractLimits(parseInput(readFixture('statusline', 'full.json')), NOW);
  assert.deepEqual(limits, { five: { pct: 62.4, reset: 1795683600 }, week: { pct: 38, reset: 1795737600 } });
});

test('renders the short line in French and English', () => {
  const limits = extractLimits(parseInput(readFixture('statusline', 'full.json')), NOW);
  assert.equal(renderLine(limits, { ...plain, lang: 'fr' }), '5 h : 62 % (reset 10:00) · semaine : 38 % (reset ven 1:00)');
  assert.equal(renderLine(limits, { ...plain, lang: 'en' }), '5h: 62% (reset 10:00) · week: 38% (reset Fri 1:00)');
  assert.equal(
    renderLine(limits, { ...plain, lang: 'fr', remaining: true }),
    '5 h : 38 % restant (reset 10:00) · semaine : 62 % restant (reset ven 1:00)',
  );
});

test('each window can be missing on its own', () => {
  const limits = extractLimits(parseInput(readFixture('statusline', 'five-only.json')), NOW);
  assert.deepEqual(Object.keys(limits), ['five']);
  assert.equal(renderLine(limits, { ...plain, lang: 'en' }), '5h: 91% (reset 10:00)');
});

test('no rate_limits (API key, free plan, before first reply)', () => {
  const limits = extractLimits(parseInput(readFixture('statusline', 'no-limits.json')), NOW);
  assert.deepEqual(limits, {});
  assert.equal(renderLine(limits, { ...plain, lang: 'fr' }), 'claude-jauge · limites : pas encore reçues');
});

test('invalid or odd values are ignored, never crash', () => {
  assert.equal(parseInput(''), undefined);
  assert.equal(parseInput('not json'), undefined);
  assert.equal(parseInput('42'), undefined);
  assert.deepEqual(extractLimits(parseInput('{"rate_limits":null}'), NOW), {});
  assert.deepEqual(extractLimits(parseInput('{"rate_limits":{"five_hour":{"used_percentage":null,"resets_at":1795683600}}}'), NOW), {});
  assert.deepEqual(extractLimits(parseInput('{"rate_limits":{"five_hour":{"used_percentage":"abc","resets_at":1795683600}}}'), NOW), {});
  // Window already reset: dropped, like Claude Code does.
  assert.deepEqual(extractLimits(parseInput(`{"rate_limits":{"five_hour":{"used_percentage":5,"resets_at":${NOW - 1}}}}`), NOW), {});
  // Out of range values are clamped.
  assert.deepEqual(extractLimits(parseInput('{"rate_limits":{"five_hour":{"used_percentage":130,"resets_at":1795683600}}}'), NOW), {
    five: { pct: 100, reset: 1795683600 },
  });
  // Milliseconds tolerated.
  assert.deepEqual(extractLimits(parseInput('{"rate_limits":{"seven_day":{"used_percentage":1,"resets_at":1795737600000}}}'), NOW), {
    week: { pct: 1, reset: 1795737600 },
  });
});

test('runStatusline records at most one point per minute', (t) => {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const file = path.join(dir, 'nested', 'historique.jsonl');
  const stdin = readFixture('statusline', 'full.json');
  const env = { NO_COLOR: '1' };
  const run = (nowSec: number) => runStatusline({ stdin, historyFile: file, lang: 'fr', nowSec, env, timeZone: TZ });
  assert.equal(run(NOW), '5 h : 62 % (reset 10:00) · semaine : 38 % (reset ven 1:00)');
  run(NOW + 20);
  run(NOW + 59);
  run(NOW + 60);
  assert.deepEqual(readHistory(file).map((p) => p.t), [NOW, NOW + 60]);
});

test('runStatusline without limits writes nothing', (t) => {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const file = path.join(dir, 'historique.jsonl');
  runStatusline({ stdin: readFixture('statusline', 'no-limits.json'), historyFile: file, lang: 'en', nowSec: NOW, env: {} });
  assert.equal(fs.existsSync(file), false);
});

test('runStatusline still prints when the history cannot be written', (t) => {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const blocker = path.join(dir, 'file');
  fs.writeFileSync(blocker, 'x');
  const line = runStatusline({
    stdin: readFixture('statusline', 'full.json'),
    historyFile: path.join(blocker, 'historique.jsonl'), // parent is a file: write fails
    lang: 'en',
    nowSec: NOW,
    env: { NO_COLOR: '1' },
    timeZone: TZ,
  });
  assert.match(line, /^5h: 62%/);
});
