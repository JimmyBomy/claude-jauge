import { localDay, int } from './format.js';
import { t, type Lang } from './i18n.js';
import type { UsageRecord } from './sessions.js';

export type GroupBy = 'day' | 'week' | 'model';

export interface Row {
  key: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  total: number;
  /** Per-model totals inside this row (used by the dashboard). */
  models: Record<string, number>;
}

/** ISO 8601 week of a local calendar day "YYYY-MM-DD", e.g. "2026-W48". */
export function isoWeek(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** "claude-opus-4-5-20251101" → "opus-4-5". Unknown names are kept as is. */
export function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

export function aggregate(records: UsageRecord[], by: GroupBy, timeZone?: string): Row[] {
  const rows = new Map<string, Row>();
  for (const r of records) {
    const day = localDay(Math.floor(r.ts / 1000), timeZone);
    const model = shortModel(r.model);
    const key = by === 'day' ? day : by === 'week' ? isoWeek(day) : model;
    let row = rows.get(key);
    if (!row) {
      row = { key, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, total: 0, models: {} };
      rows.set(key, row);
    }
    const sum = r.input + r.output + r.cacheWrite + r.cacheRead;
    row.input += r.input;
    row.output += r.output;
    row.cacheWrite += r.cacheWrite;
    row.cacheRead += r.cacheRead;
    row.total += sum;
    row.models[model] = (row.models[model] ?? 0) + sum;
  }
  const list = [...rows.values()];
  if (by === 'model') list.sort((a, b) => b.total - a.total);
  else list.sort((a, b) => a.key.localeCompare(b.key));
  return list;
}

export function totals(rows: Row[]): Row {
  const tot: Row = { key: 'total', input: 0, output: 0, cacheWrite: 0, cacheRead: 0, total: 0, models: {} };
  for (const r of rows) {
    tot.input += r.input;
    tot.output += r.output;
    tot.cacheWrite += r.cacheWrite;
    tot.cacheRead += r.cacheRead;
    tot.total += r.total;
    for (const [m, v] of Object.entries(r.models)) tot.models[m] = (tot.models[m] ?? 0) + v;
  }
  return tot;
}

/** Plain text table, right-aligned numbers. */
export function renderTable(rows: Row[], by: GroupBy, lang: Lang): string {
  const head = [
    t(lang, `colKey_${by}`),
    t(lang, 'colInput'),
    t(lang, 'colOutput'),
    t(lang, 'colCacheW'),
    t(lang, 'colCacheR'),
    t(lang, 'colTotal'),
  ];
  const tot = totals(rows);
  const body = [...rows, { ...tot, key: t(lang, 'total') }].map((r) => [
    r.key,
    int(r.input, lang),
    int(r.output, lang),
    int(r.cacheWrite, lang),
    int(r.cacheRead, lang),
    int(r.total, lang),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i]!.length)));
  const fmt = (cells: string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  const sepLine = widths.map((w) => '─'.repeat(w)).join('  ');
  const lines = [fmt(head), sepLine, ...body.slice(0, -1).map(fmt), sepLine, fmt(body[body.length - 1]!)];
  return lines.join('\n');
}

