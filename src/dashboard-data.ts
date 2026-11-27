import { computeState, forecastText } from './gauges.js';
import { t, type Lang } from './i18n.js';
import { duration, shortWhen } from './format.js';
import { levelOf } from './theme.js';
import { shortModel } from './report.js';
import type { Point } from './points.js';
import type { DashboardLimits, DashboardTokens } from './dashboard-client.js';

/**
 * Pure builders of the dashboard data (no Node API), used by `claude-jauge web`
 * and by the Windows app, which reads the same files through Tauri.
 */

export interface LimitsOptions {
  lang: Lang;
  days: number;
  timeZone?: string;
}

/** Gauges, forecast and recent history from the claude-jauge history points. */
export function limitsView(points: Point[], o: LimitsOptions, nowSec: number): DashboardLimits & { now: number; lang: Lang } {
  const sinceSec = nowSec - o.days * 86400;
  const state = computeState(points, nowSec);
  const fo = { lang: o.lang, timeZone: o.timeZone };
  const gauges = state.windows
    .filter((w) => w.sample)
    .map((w) => {
      const s = w.sample!;
      return {
        key: w.key,
        used: w.hasReset ? 0 : s.pct,
        level: levelOf(w.hasReset ? 0 : s.pct),
        reset: s.reset,
        resetText: w.hasReset
          ? t(o.lang, 'windowReset', { time: shortWhen(s.reset, nowSec, fo) })
          : t(o.lang, 'resetLong', { time: shortWhen(s.reset, nowSec, fo), in: duration(s.reset - nowSec, o.lang) }),
        forecastKind: w.hasReset ? 'unknown' : w.forecast.kind,
        forecastText: w.hasReset ? '' : forecastText(w.forecast, nowSec, o.lang, o.timeZone),
      };
    });
  const updatedText =
    state.updatedAt === undefined
      ? ''
      : nowSec - state.updatedAt < 60
        ? t(o.lang, 'updatedNow')
        : t(o.lang, 'updatedAgo', { ago: duration(nowSec - state.updatedAt, o.lang) });
  return {
    now: nowSec,
    lang: o.lang,
    updatedText,
    gauges,
    history: points.filter((p) => p.t >= sinceSec),
  };
}


/** Tokens of one local day for one model, as the Windows app sums them. */
export interface DayModelTokens {
  day: string;
  model: string;
  tokens: number;
}

/** Daily bars and the model table from per-day, per-model totals. */
export function tokensView(rows: DayModelTokens[]): DashboardTokens {
  const days = new Map<string, { key: string; total: number; models: Record<string, number> }>();
  const models = new Map<string, number>();
  for (const r of rows) {
    const model = shortModel(r.model);
    let day = days.get(r.day);
    if (!day) {
      day = { key: r.day, total: 0, models: {} };
      days.set(r.day, day);
    }
    day.total += r.tokens;
    day.models[model] = (day.models[model] ?? 0) + r.tokens;
    models.set(model, (models.get(model) ?? 0) + r.tokens);
  }
  return {
    daily: [...days.values()].sort((a, b) => a.key.localeCompare(b.key)),
    models: [...models.entries()].map(([key, total]) => ({ key, total })).sort((a, b) => b.total - a.total),
  };
}
