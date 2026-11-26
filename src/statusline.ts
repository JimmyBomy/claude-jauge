import fs from 'node:fs';
import path from 'node:path';
import { appendPoint, type Point, type WindowSample } from './history.js';
import { t, type Lang } from './i18n.js';
import { colorsFor, levelColor, paint, pct, shortWhen, type Colors } from './format.js';

/** Subset of the JSON Claude Code sends on stdin. See https://code.claude.com/docs/en/statusline */
export interface StatusInput {
  model?: { id?: string; display_name?: string };
  rate_limits?: {
    five_hour?: { used_percentage?: unknown; resets_at?: unknown };
    seven_day?: { used_percentage?: unknown; resets_at?: unknown };
  };
}

export function parseInput(raw: string): StatusInput | undefined {
  if (!raw.trim()) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' ? (v as StatusInput) : undefined;
  } catch {
    return undefined;
  }
}

function toSample(w: { used_percentage?: unknown; resets_at?: unknown } | undefined, nowSec: number): WindowSample | undefined {
  if (!w || typeof w !== 'object') return undefined;
  const used = Number(w.used_percentage);
  let reset = Number(w.resets_at);
  if (w.used_percentage === null || w.used_percentage === undefined || !Number.isFinite(used)) return undefined;
  if (w.resets_at === null || w.resets_at === undefined || !Number.isFinite(reset)) return undefined;
  // The docs say epoch seconds. Be lenient if a future version ever sends milliseconds.
  if (reset > 1e12) reset = Math.round(reset / 1000);
  if (reset <= nowSec) return undefined; // Claude Code drops a window once it has reset.
  return { pct: Math.min(100, Math.max(0, used)), reset };
}

/** Each window can be missing on its own (not Pro/Max, before the first reply, after a reset). */
export function extractLimits(input: StatusInput | undefined, nowSec: number): { five?: WindowSample; week?: WindowSample } {
  const rl = input?.rate_limits;
  if (!rl || typeof rl !== 'object') return {};
  const out: { five?: WindowSample; week?: WindowSample } = {};
  const five = toSample(rl.five_hour, nowSec);
  const week = toSample(rl.seven_day, nowSec);
  if (five) out.five = five;
  if (week) out.week = week;
  return out;
}

export interface RenderOptions {
  lang: Lang;
  nowSec: number;
  colors: Colors;
  /** Show what is left instead of what is used. */
  remaining?: boolean;
  timeZone?: string;
}

function segment(label: string, s: WindowSample, o: RenderOptions): string {
  const value = o.remaining ? 100 - s.pct : s.pct;
  const sep = o.lang === 'fr' ? ' : ' : ': ';
  const suffix = o.remaining ? ` ${t(o.lang, 'left')}` : '';
  const when = shortWhen(s.reset, o.nowSec, { lang: o.lang, timeZone: o.timeZone });
  return `${label}${sep}${paint(o.colors, levelColor(s.pct), pct(value, o.lang) + suffix)} (${t(o.lang, 'reset')} ${when})`;
}

/** « 5 h : 62 % (reset 18:00) · semaine : 38 % (reset jeu 9:00) » */
export function renderLine(limits: { five?: WindowSample; week?: WindowSample }, o: RenderOptions): string {
  const parts: string[] = [];
  if (limits.five) parts.push(segment(t(o.lang, 'five'), limits.five, o));
  if (limits.week) parts.push(segment(t(o.lang, 'week'), limits.week, o));
  if (parts.length === 0) return paint(o.colors, 'dim', `claude-jauge · ${t(o.lang, 'noLimits')}`);
  return parts.join(' · ');
}

export interface StatuslineRun {
  stdin: string;
  historyFile: string;
  /** Where to note that the status line ran and whether limits came with it. */
  seenFile?: string;
  lang: Lang;
  nowSec: number;
  remaining?: boolean;
  env?: Record<string, string | undefined>;
  timeZone?: string;
}

/** Records a point (at most one per minute) and returns the line to print. Never throws. */
export function runStatusline(r: StatuslineRun): string {
  const input = parseInput(r.stdin);
  const limits = extractLimits(input, r.nowSec);
  if (limits.five || limits.week) {
    const point: Point = { t: r.nowSec, ...limits };
    try {
      appendPoint(r.historyFile, point);
    } catch {
      // Read-only home, full disk…: still show the line.
    }
  }
  if (r.seenFile) writeSeen(r.seenFile, { t: r.nowSec, limits: Boolean(limits.five || limits.week) });
  // Claude Code renders ANSI colors even though stdout is a pipe.
  const colors = colorsFor(true, r.env ?? process.env);
  return renderLine(limits, {
    lang: r.lang,
    nowSec: r.nowSec,
    colors,
    remaining: r.remaining,
    timeZone: r.timeZone,
  });
}

export interface Seen {
  t: number;
  limits: boolean;
}

/**
 * Lets the widget tell "status line not running" from "running, but Claude Code sends no limits".
 * Written at most once a minute unless the answer changes. Best effort.
 */
export function writeSeen(file: string, seen: Seen): void {
  try {
    try {
      const old = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Seen>;
      if (old.limits === seen.limits && typeof old.t === 'number' && seen.t - old.t < 60) return;
    } catch {
      // no previous file
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(seen), 'utf8');
  } catch {
    // never break the status line for this
  }
}
