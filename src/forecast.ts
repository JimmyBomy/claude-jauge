import { windowPoints, type Point, type WindowKey, type WindowSample } from './history.js';

export type Forecast =
  | { kind: 'reached' }
  /** Limit expected at `at` (epoch seconds), before the reset. */
  | { kind: 'hit'; at: number }
  /** At this pace the window resets before reaching 100 %. */
  | { kind: 'safe' }
  /** Not enough data in the current window. */
  | { kind: 'unknown' };

/** Ordinary least squares. Returns null when x has no spread. */
export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    sxx += dx * dx;
    sxy += dx * (ys[i]! - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/** Minimum time span covered by the points before we dare a forecast. */
export const MIN_SPAN_SEC = 10 * 60;

/**
 * Simple linear regression on the points of the current window
 * (percentage used as a function of time), extrapolated to 100 %.
 */
export function forecastWindow(points: Point[], key: WindowKey, current: WindowSample, nowSec: number): Forecast {
  if (current.pct >= 100) return { kind: 'reached' };
  const pts = windowPoints(points, key, current.reset).sort((a, b) => a.t - b.t);
  // Add the current value unless it is already the latest recorded point.
  const latest = pts[pts.length - 1];
  if (!latest || latest.pct !== current.pct) pts.push({ t: Math.max(nowSec, latest?.t ?? nowSec), pct: current.pct });
  if (pts.length < 2) return { kind: 'unknown' };
  const t0 = pts[0]!.t;
  const span = pts[pts.length - 1]!.t - t0;
  if (span < MIN_SPAN_SEC) return { kind: 'unknown' };
  const reg = linearRegression(pts.map((p) => p.t - t0), pts.map((p) => p.pct));
  if (!reg) return { kind: 'unknown' };
  if (reg.slope <= 0) return { kind: 'safe' };
  // Extrapolate from now and the latest real value, at the window's average pace.
  const remaining = 100 - current.pct;
  const at = nowSec + remaining / reg.slope;
  if (at >= current.reset) return { kind: 'safe' };
  return { kind: 'hit', at: Math.round(at) };
}
