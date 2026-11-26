// Renders the widget in a normal browser with invented data, for screenshots and design checks.
import { cssVars, palettes } from '../../src/theme.js';
import { buildWidgetView } from '../../src/widget-model.js';
import { renderWidget } from './render.js';

const now = Math.floor(Date.now() / 1000);
const five = now + 2 * 3600 + 14 * 60;
const week = now + 3 * 86400;
const line = (t: number, p5: number, pw: number) => JSON.stringify({ t, five: { pct: p5, reset: five }, week: { pct: pw, reset: week } });
const states = {
  normal: [line(now - 3000, 20, 30), line(now - 1500, 26, 31), line(now - 60, 31, 32)].join('\n'),
  busy: [line(now - 3000, 30, 55), line(now - 1500, 52, 58), line(now - 60, 71, 62)].join('\n'),
  critical: [line(now - 3000, 60, 80), line(now - 1500, 75, 83), line(now - 60, 88, 86)].join('\n'),
};
const usage = { day: '', total: 1_284_000, byModel: { 'claude-opus-4-5': 1_030_000, 'claude-haiku-4-5': 254_000 } };
const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en' ? 'en' : 'fr';
const theme = params.get('theme') === 'light' ? 'light' : 'dark';
document.documentElement.setAttribute('style', cssVars(palettes[theme]));
document.documentElement.dataset.theme = theme;

const root = document.getElementById('previews')!;
const walls = ['aurora', 'white', 'busy', 'black'];
const shots: [string, string][] = [
  ['normal', states.normal],
  ['busy', states.busy],
  ['critical', states.critical],
  ['empty', ''],
];
root.innerHTML = shots
  .map(([name, text], i) => {
    const view = buildWidgetView(text, name === 'empty' ? undefined : usage, now, lang);
    return `<div class="wall ${walls[i % walls.length]}" data-state="${name}"><div class="widget">${renderWidget(view)}</div></div>`;
  })
  .join('');
