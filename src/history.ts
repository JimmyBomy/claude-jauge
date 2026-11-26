import fs from 'node:fs';
import path from 'node:path';

export interface WindowSample {
  /** Percentage used, 0 to 100, as reported by Claude Code. */
  pct: number;
  /** Unix epoch seconds when the window resets. */
  reset: number;
}

export interface Point {
  /** Unix epoch seconds. */
  t: number;
  five?: WindowSample;
  week?: WindowSample;
}

export type WindowKey = 'five' | 'week';
export const WINDOW_SECONDS: Record<WindowKey, number> = { five: 5 * 3600, week: 7 * 86400 };

/** At most one point per minute. */
export const MIN_INTERVAL_SEC = 60;
/** History older than this is dropped when the file gets big. */
export const KEEP_DAYS = 60;
const PRUNE_ABOVE_BYTES = 4 * 1024 * 1024;

function isSample(v: unknown): v is WindowSample {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return typeof s.pct === 'number' && Number.isFinite(s.pct) && typeof s.reset === 'number' && Number.isFinite(s.reset);
}

export function parsePoint(line: string): Point | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof raw.t !== 'number' || !Number.isFinite(raw.t)) return undefined;
    const p: Point = { t: raw.t };
    if (isSample(raw.five)) p.five = { pct: raw.five.pct, reset: raw.five.reset };
    if (isSample(raw.week)) p.week = { pct: raw.week.pct, reset: raw.week.reset };
    if (!p.five && !p.week) return undefined;
    return p;
  } catch {
    return undefined;
  }
}

/** All valid points, oldest first. Broken lines are skipped. */
export function readHistory(file: string): Point[] {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const points: Point[] = [];
  for (const line of text.split('\n')) {
    const p = parsePoint(line);
    if (p) points.push(p);
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

/** Reads only the end of the file: the status line runs often and must stay fast. */
export function lastPoint(file: string): Point | undefined {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 8192);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const p = parsePoint(lines[i] ?? '');
      if (p) return p;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Appends a point unless the last one is less than a minute old.
 * Exception: a window that just changed (new reset time) is always recorded,
 * so the start of a new window is never lost.
 * Returns true if the point was written.
 */
export function appendPoint(file: string, p: Point, minInterval = MIN_INTERVAL_SEC): boolean {
  const last = lastPoint(file);
  if (last) {
    const tooSoon = p.t - last.t < minInterval;
    const windowChanged =
      (p.five && last.five && Math.abs(p.five.reset - last.five.reset) >= 60) ||
      (p.week && last.week && Math.abs(p.week.reset - last.week.reset) >= 60);
    if (tooSoon && !windowChanged) return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(p) + '\n', 'utf8');
  pruneIfLarge(file, p.t);
  return true;
}

export function pruneIfLarge(file: string, nowSec: number, maxBytes = PRUNE_ABOVE_BYTES): void {
  try {
    if (fs.statSync(file).size <= maxBytes) return;
    const cutoff = nowSec - KEEP_DAYS * 86400;
    const kept = readHistory(file).filter((p) => p.t >= cutoff);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, kept.map((p) => JSON.stringify(p)).join('\n') + (kept.length ? '\n' : ''), 'utf8');
    fs.renameSync(tmp, file);
  } catch {
    // Pruning is best effort; never break the status line for it.
  }
}

/** Points that belong to the window ending at `reset` (same reset time, ±2 min jitter). */
export function windowPoints(points: Point[], key: WindowKey, reset: number): { t: number; pct: number }[] {
  const start = reset - WINDOW_SECONDS[key];
  const out: { t: number; pct: number }[] = [];
  for (const p of points) {
    const s = p[key];
    if (!s) continue;
    if (Math.abs(s.reset - reset) > 120) continue;
    if (p.t < start - 60 || p.t > reset) continue;
    out.push({ t: p.t, pct: s.pct });
  }
  return out;
}
