/**
 * Design tokens shared by every claude-jauge surface (web dashboard, desktop widget).
 * Inspired by the Liquid Glass style of jimmybomy.fr, tuned for legibility first:
 * cards stay opaque enough for text to keep a WCAG AA contrast on any wallpaper.
 */

export type Level = 'normal' | 'warning' | 'critical';

/** Used percentage thresholds: attention from 50 %, near the limit from 80 %. */
export const THRESHOLDS = { warning: 50, critical: 80 } as const;

export function levelOf(usedPct: number): Level {
  if (usedPct >= THRESHOLDS.critical) return 'critical';
  if (usedPct >= THRESHOLDS.warning) return 'warning';
  return 'normal';
}

export interface Palette {
  /** Card fill, drawn over an unknown background. */
  card: { rgb: [number, number, number]; alpha: number };
  ink: string;
  muted: string;
  track: string;
  levels: Record<Level, string>;
  series: [string, string, string, string, string];
}

export const palettes: Record<'dark' | 'light', Palette> = {
  dark: {
    card: { rgb: [28, 28, 34], alpha: 0.88 },
    ink: '#f5f5f7',
    muted: '#b4b4bc',
    track: 'rgba(255,255,255,.12)',
    levels: { normal: '#30d158', warning: '#ffb340', critical: '#ff7b72' },
    series: ['#64d2ff', '#ff9f0a', '#bf5af2', '#30d158', '#8e8e93'],
  },
  light: {
    card: { rgb: [255, 255, 255], alpha: 0.88 },
    ink: '#1d1d1f',
    muted: '#56565c',
    track: 'rgba(0,0,0,.09)',
    levels: { normal: '#146c2e', warning: '#9a4a00', critical: '#b8102a' },
    series: ['#0a6ed1', '#c45f00', '#8a3fd1', '#146c2e', '#8e8e93'],
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The card as it looks once composited over a given wallpaper color. */
export function cardOver(p: Palette, background: [number, number, number]): [number, number, number] {
  const { rgb, alpha } = p.card;
  return rgb.map((c, i) => Math.round(c * alpha + background[i]! * (1 - alpha))) as [number, number, number];
}

/** Worst contrast of a text color on the card, whatever the wallpaper (black to white). */
export function worstContrast(p: Palette, textHex: string): number {
  const text = hexToRgb(textHex);
  return Math.min(contrast(text, cardOver(p, [0, 0, 0])), contrast(text, cardOver(p, [255, 255, 255])));
}

/** CSS custom properties for a palette. */
export function cssVars(p: Palette): string {
  const [r, g, b] = p.card.rgb;
  return [
    `--card:rgba(${r},${g},${b},${p.card.alpha})`,
    `--ink:${p.ink}`,
    `--muted:${p.muted}`,
    `--track:${p.track}`,
    `--normal:${p.levels.normal}`,
    `--warning:${p.levels.warning}`,
    `--critical:${p.levels.critical}`,
    ...p.series.map((c, i) => `--s${i + 1}:${c}`),
  ].join(';');
}
