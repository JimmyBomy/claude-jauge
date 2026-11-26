/**
 * Pure helpers on history points, shared by the CLI and the desktop widget (no Node API here).
 */

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

/** Parses a whole history file content. Broken lines are skipped, result sorted oldest first. */
export function parseHistory(text: string): Point[] {
  const points: Point[] = [];
  for (const line of text.split('\n')) {
    const p = parsePoint(line);
    if (p) points.push(p);
  }
  return points.sort((a, b) => a.t - b.t);
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
