import { forecastWindow, type Forecast } from './forecast.js';
import type { Point, WindowKey, WindowSample } from './points.js';
import { t, type Lang } from './i18n.js';
import { bar, duration, levelColor, paint, pct, shortWhen, type Colors } from './format.js';

export interface WindowState {
  key: WindowKey;
  /** Latest sample, or undefined if never seen. */
  sample?: WindowSample;
  /** True when the latest known reset time is already past. */
  hasReset: boolean;
  forecast: Forecast;
}

export interface GaugesState {
  nowSec: number;
  /** Time of the latest point, if any. */
  updatedAt?: number;
  windows: WindowState[];
}

export function computeState(points: Point[], nowSec: number): GaugesState {
  const last = points[points.length - 1];
  const windows: WindowState[] = (['five', 'week'] as const).map((key) => {
    let sample: WindowSample | undefined;
    for (let i = points.length - 1; i >= 0; i--) {
      const s = points[i]![key];
      if (s) { sample = s; break; }
    }
    if (!sample) return { key, hasReset: false, forecast: { kind: 'unknown' } };
    const hasReset = sample.reset <= nowSec;
    const forecast: Forecast = hasReset ? { kind: 'unknown' } : forecastWindow(points, key, sample, nowSec);
    return { key, sample, hasReset, forecast };
  });
  return { nowSec, updatedAt: last?.t, windows };
}

/** Filled part in the level color, empty part dimmed. */
function coloredBar(colors: Colors, color: 'green' | 'yellow' | 'red', used: number): string {
  const b = bar(used);
  const filled = b.replace(/░/g, '');
  return paint(colors, color, filled) + paint(colors, 'dim', b.slice(filled.length));
}

/** Data older than this is flagged as stale. */
const STALE_SEC = 30 * 60;

export function renderGauges(state: GaugesState, lang: Lang, colors: Colors, timeZone?: string): string {
  const fo = { lang, timeZone };
  if (state.updatedAt === undefined) return t(lang, 'noData');
  const lines: string[] = [];
  const ago = state.nowSec - state.updatedAt;
  const header = ago < 60 ? t(lang, 'updatedNow') : t(lang, 'updatedAgo', { ago: duration(ago, lang) });
  lines.push(`${paint(colors, 'bold', 'claude-jauge')} · ${paint(colors, 'dim', header)}`);
  if (ago > STALE_SEC) lines.push(paint(colors, 'yellow', t(lang, 'stale', { ago: duration(ago, lang) })));
  lines.push('');
  const labelWidth = Math.max(t(lang, 'fiveLong').length, t(lang, 'weekLong').length) + 2;
  const indent = ' '.repeat(labelWidth);
  for (const w of state.windows) {
    if (!w.sample) continue;
    const label = t(lang, w.key === 'five' ? 'fiveLong' : 'weekLong').padEnd(labelWidth);
    if (w.hasReset) {
      lines.push(`${label}${coloredBar(colors, 'green', 0)}  ${pct(0, lang)} ${t(lang, 'used')}`);
      lines.push(indent + paint(colors, 'dim', t(lang, 'windowReset', { time: shortWhen(w.sample.reset, state.nowSec, fo) })));
      continue;
    }
    const s = w.sample;
    const color = levelColor(s.pct);
    lines.push(
      `${label}${coloredBar(colors, color, s.pct)}  ${paint(colors, color, pct(s.pct, lang))} ${t(lang, 'used')} · ` +
        `${paint(colors, 'bold', pct(100 - s.pct, lang))} ${t(lang, 'left')}`,
    );
    lines.push(
      indent +
        t(lang, 'resetLong', { time: shortWhen(s.reset, state.nowSec, fo), in: duration(s.reset - state.nowSec, lang) }),
    );
    lines.push(indent + paint(colors, w.forecast.kind === 'hit' || w.forecast.kind === 'reached' ? 'red' : 'dim', forecastText(w.forecast, state.nowSec, lang, timeZone)));
  }
  return lines.join('\n');
}

export function forecastText(f: Forecast, nowSec: number, lang: Lang, timeZone?: string): string {
  switch (f.kind) {
    case 'reached':
      return t(lang, 'forecastReached');
    case 'safe':
      return t(lang, 'forecastSafe');
    case 'unknown':
      return t(lang, 'forecastUnknown');
    case 'hit':
      if (f.at - nowSec < 60) return t(lang, 'forecastSoon');
      return t(lang, 'forecastHit', { time: shortWhen(f.at, nowSec, { lang, timeZone }) });
  }
}
