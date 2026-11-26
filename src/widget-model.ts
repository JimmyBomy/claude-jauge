import { compact, duration, pct, shortWhen } from './format.js';
import { computeState } from './gauges.js';
import { t, type Lang } from './i18n.js';
import { parseHistory, type WindowKey } from './points.js';
import { levelOf, type Level } from './theme.js';

/** Token totals for the current local day, computed by the desktop app from the session files. */
export interface DailyUsage {
  /** Local calendar day "YYYY-MM-DD" the totals belong to. */
  day: string;
  total: number;
  byModel: Record<string, number>;
}

export interface WidgetWindow {
  key: WindowKey;
  label: string;
  usedPct: number;
  leftText: string;
  level: Level;
  levelLabel: string;
  resetText: string;
  /** Only set when the limit is expected before the reset, or already reached. */
  alertText?: string;
}

export interface WidgetView {
  lang: Lang;
  updatedText: string;
  stale: boolean;
  windows: WidgetWindow[];
  /** Shown instead of the gauges when no limit was ever recorded. */
  emptyText?: string;
  /** A button under emptyText, when one click can fix it. */
  action?: { kind: 'link' | 'replace'; label: string };
  todayText?: string;
  topModelText?: string;
}

/** What the desktop app knows about its link with Claude Code. */
export interface SetupInfo {
  link: { state: 'linked' | 'notLinked' | 'badJson' } | { state: 'foreign'; command: string };
  /** Last run of the status line, and whether limits came with it. */
  seen?: { t: number; limits: boolean } | null;
}

function emptyState(lang: Lang, setup: SetupInfo | undefined): Pick<WidgetView, 'emptyText' | 'action'> {
  if (!setup) return { emptyText: t(lang, 'widgetEmpty') };
  switch (setup.link.state) {
    case 'notLinked':
      return { emptyText: t(lang, 'widgetNotLinked'), action: { kind: 'link', label: t(lang, 'widgetLinkAction') } };
    case 'foreign': {
      const command = setup.link.command.length > 48 ? `${setup.link.command.slice(0, 47)}…` : setup.link.command;
      return { emptyText: t(lang, 'widgetForeign', { command }), action: { kind: 'replace', label: t(lang, 'widgetReplaceAction') } };
    }
    case 'badJson':
      return { emptyText: t(lang, 'widgetBadJson') };
    case 'linked':
      return { emptyText: t(lang, setup.seen && !setup.seen.limits ? 'widgetNoLimitsSent' : 'widgetLinked') };
  }
}

const LEVEL_KEY = { normal: 'levelNormal', warning: 'levelWarning', critical: 'levelCritical' } as const;
const STALE_SEC = 30 * 60;

function shortModel(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d{8}$/, '');
}

/**
 * Everything the widget displays, computed from raw inputs. Pure and synchronous,
 * so the same code is unit tested here and runs inside the desktop webview.
 */
export function buildWidgetView(historyText: string, usage: DailyUsage | undefined, nowSec: number, lang: Lang, timeZone?: string, setup?: SetupInfo): WidgetView {
  const state = computeState(parseHistory(historyText), nowSec);
  const fo = { lang, timeZone };
  const windows: WidgetWindow[] = [];
  for (const w of state.windows) {
    if (!w.sample) continue;
    const used = w.hasReset ? 0 : w.sample.pct;
    const level = levelOf(used);
    let alertText: string | undefined;
    if (w.forecast.kind === 'reached') alertText = t(lang, 'widgetLimitNow');
    if (w.forecast.kind === 'hit') alertText = t(lang, 'widgetLimitAt', { time: shortWhen(w.forecast.at, nowSec, fo) });
    windows.push({
      key: w.key,
      label: t(lang, w.key === 'five' ? 'five' : 'weekLong'),
      usedPct: used,
      leftText: pct(100 - used, lang),
      level,
      levelLabel: t(lang, LEVEL_KEY[level]),
      resetText: w.hasReset
        ? t(lang, 'windowReset', { time: shortWhen(w.sample.reset, nowSec, fo) })
        : t(lang, 'widgetResetAt', { time: shortWhen(w.sample.reset, nowSec, fo) }),
      alertText,
    });
  }

  const ago = state.updatedAt === undefined ? undefined : nowSec - state.updatedAt;
  const view: WidgetView = {
    lang,
    updatedText: ago === undefined ? '' : ago < 60 ? t(lang, 'updatedNow') : t(lang, 'updatedAgo', { ago: duration(ago, lang) }),
    stale: ago !== undefined && ago > STALE_SEC,
    windows,
  };
  if (windows.length === 0) Object.assign(view, emptyState(lang, setup));

  if (usage && usage.total > 0) {
    view.todayText = t(lang, 'widgetToday', { tokens: compact(usage.total, lang) });
    const top = Object.entries(usage.byModel).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      view.topModelText = t(lang, 'widgetTopModel', { model: shortModel(top[0]), share: pct((top[1] / usage.total) * 100, lang) });
    }
  }
  return view;
}
