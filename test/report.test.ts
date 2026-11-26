import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, isoWeek, renderTable, shortModel, totals } from '../src/report.js';
import { listJsonl, loadUsage, parseSessionLine } from '../src/sessions.js';
import { fixture } from './helpers.js';

const projects = fixture('claude', 'projects');

test('listJsonl finds nested session files only', () => {
  const files = listJsonl(projects).map((f) => f.replace(/\\/g, '/'));
  assert.equal(files.length, 2);
  assert.ok(files.every((f) => f.endsWith('.jsonl')));
});

test('loadUsage: de-duplicates streamed replies, skips synthetic and broken lines', async () => {
  const recs = await loadUsage(projects);
  assert.equal(recs.length, 4);
  assert.deepEqual(
    recs.map((r) => r.model),
    ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
  );
  assert.equal(recs[0]!.input + recs[0]!.output + recs[0]!.cacheWrite + recs[0]!.cacheRead, 14200);
});

test('loadUsage: since filter and missing folder', async () => {
  const recs = await loadUsage(projects, Date.parse('2026-11-24T00:00:00Z'));
  assert.equal(recs.length, 2);
  assert.deepEqual(await loadUsage(fixture('nowhere')), []);
});

test('parseSessionLine ignores lines without usage', () => {
  assert.equal(parseSessionLine('{"type":"user","message":{"content":"hi"}}'), undefined);
  assert.equal(parseSessionLine('{"usage": broken'), undefined);
});

test('isoWeek and shortModel', () => {
  assert.equal(isoWeek('2026-11-23'), '2026-W48'); // Monday
  assert.equal(isoWeek('2026-11-29'), '2026-W48'); // Sunday
  assert.equal(isoWeek('2026-11-30'), '2026-W49');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');
  assert.equal(shortModel('claude-opus-4-5-20251101'), 'opus-4-5');
  assert.equal(shortModel('custom-model'), 'custom-model');
});

test('aggregate by day, week and model', async () => {
  const recs = await loadUsage(projects);
  const days = aggregate(recs, 'day', 'UTC');
  assert.deepEqual(days.map((d) => [d.key, d.total]), [
    ['2026-11-23', 14200 + 22000],
    ['2026-11-24', 8800],
    ['2026-11-30', 400],
  ]);
  assert.deepEqual(days[0]!.models, { 'sonnet-4-5': 14200, 'opus-4-5': 22000 });
  const weeks = aggregate(recs, 'week', 'UTC');
  assert.deepEqual(weeks.map((w) => [w.key, w.total]), [
    ['2026-W48', 45000],
    ['2026-W49', 400],
  ]);
  const models = aggregate(recs, 'model', 'UTC');
  assert.deepEqual(models.map((m) => [m.key, m.total]), [
    ['sonnet-4-5', 23000],
    ['opus-4-5', 22000],
    ['haiku-4-5', 400],
  ]);
  assert.equal(totals(models).total, 45400);
  assert.equal(totals(models).output, 200 + 1500 + 800 + 100);
});

test('renderTable aligns columns and adds a total', async () => {
  const recs = await loadUsage(projects);
  const table = renderTable(aggregate(recs, 'model', 'UTC'), 'model', 'fr');
  const lines = table.split('\n');
  assert.match(lines[0]!, /^Modèle\s+Entrée\s+Sortie\s+Cache écrit\s+Cache lu\s+Total$/);
  assert.match(lines[lines.length - 1]!, /^Total\s+.*45 400$/);
  const widths = new Set(lines.map((l) => l.length));
  assert.equal(widths.size, 1);
});
