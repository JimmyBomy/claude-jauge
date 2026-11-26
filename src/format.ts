import { messages, type Lang } from './i18n.js';
import { levelOf } from './theme.js';

export interface FormatOptions {
  lang: Lang;
  /** IANA time zone. Undefined = the machine's zone. Tests pass one for stable output. */
  timeZone?: string;
}

function parts(epochSec: number, opts: FormatOptions) {
  const fmt = new Intl.DateTimeFormat(opts.lang === 'fr' ? 'fr-FR' : 'en-US', {
    timeZone: opts.timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(epochSec * 1000))) out[p.type] = p.value;
  return {
    weekday: (out.weekday ?? '').replace(/\.$/, ''),
    day: `${out.year}-${out.month}-${out.day}`,
    hour: Number(out.hour ?? 0) % 24,
    minute: out.minute ?? '00',
  };
}

/** "9:05" style clock (24 h, no leading zero on the hour, like the spec examples). */
export function clock(epochSec: number, opts: FormatOptions): string {
  const p = parts(epochSec, opts);
  return `${p.hour}:${p.minute}`;
}

/** "18:00" if the same day as now, otherwise "jeu 9:00" / "Thu 9:00". */
export function shortWhen(epochSec: number, nowSec: number, opts: FormatOptions): string {
  const p = parts(epochSec, opts);
  const n = parts(nowSec, opts);
  const time = `${p.hour}:${p.minute}`;
  return p.day === n.day ? time : `${p.weekday} ${time}`;
}

/** Local calendar day "YYYY-MM-DD". */
export function localDay(epochSec: number, timeZone?: string): string {
  return parts(epochSec, { lang: 'en', timeZone }).day;
}

/** "2 h 14", "3 j 11 h", "12 min". */
export function duration(seconds: number, lang: Lang): string {
  const u = messages[lang].units;
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sep = lang === 'fr' ? ' ' : '';
  if (d > 0) return `${d}${sep}${u.d} ${h}${sep}${u.h}`;
  if (h > 0) return `${h}${sep}${u.h} ${String(m).padStart(2, '0')}`;
  return `${m}${sep}${u.m}`;
}

export function pct(value: number, lang: Lang): string {
  const rounded = Math.round(value);
  return lang === 'fr' ? `${rounded} %` : `${rounded}%`;
}

export function int(n: number, lang: Lang): string {
  // Narrow no-break space in FR becomes a plain space to keep terminals and alignment happy.
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(Math.round(n)).replace(/ | /g, ' ');
}

/** Compact token count: 1.2 M, 845 k. */
export function compact(n: number, lang: Lang): string {
  const abs = Math.abs(n);
  const dec = lang === 'fr' ? ',' : '.';
  const f = (v: number, unit: string) => `${v.toFixed(v < 10 ? 1 : 0).replace('.', dec)}${lang === 'fr' ? ' ' : ''}${unit}`;
  if (abs >= 1e9) return f(n / 1e9, 'G');
  if (abs >= 1e6) return f(n / 1e6, 'M');
  if (abs >= 1e3) return f(n / 1e3, 'k');
  return String(Math.round(n));
}

export function bar(usedPct: number, width = 20): string {
  const clamped = Math.min(100, Math.max(0, usedPct));
  const filled = Math.round((clamped / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

export interface Colors {
  enabled: boolean;
}

const codes = { green: 32, yellow: 33, red: 31, dim: 2, bold: 1 } as const;

export function paint(c: Colors, color: keyof typeof codes, text: string): string {
  return c.enabled ? `\x1b[${codes[color]}m${text}\x1b[0m` : text;
}

export function levelColor(usedPct: number): 'green' | 'yellow' | 'red' {
  return ({ normal: 'green', warning: 'yellow', critical: 'red' } as const)[levelOf(usedPct)];
}

/** Respects NO_COLOR (https://no-color.org) and FORCE_COLOR. */
export function colorsFor(isTTY: boolean, env: Record<string, string | undefined> = process.env): Colors {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return { enabled: false };
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return { enabled: true };
  return { enabled: isTTY };
}

/** Visible width, ignoring ANSI codes. */
export function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}
