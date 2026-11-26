import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { detectLang } from '../../src/i18n.js';
import { cssVars, palettes } from '../../src/theme.js';
import { buildWidgetView, type DailyUsage, type SetupInfo, type WidgetView } from '../../src/widget-model.js';
import { renderWidget } from './render.js';

type Glass = 'none' | 'mica' | 'acrylic';
interface Prefs {
  glass: Glass;
  alwaysOnTop: boolean;
}

const WIDTH = 320;
const app = document.getElementById('app')!;
const win = getCurrentWindow();
const lang = detectLang(undefined, {}, navigator.language);
document.documentElement.lang = lang;

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(): void {
  document.documentElement.setAttribute('style', cssVars(darkQuery.matches ? palettes.dark : palettes.light));
  document.documentElement.dataset.theme = darkQuery.matches ? 'dark' : 'light';
}
applyTheme();
darkQuery.addEventListener('change', applyTheme);

function applyPrefs(p: Prefs): void {
  document.documentElement.dataset.glass = p.glass;
}

let lastHeight = 0;
async function fitWindow(): Promise<void> {
  const height = Math.ceil(app.getBoundingClientRect().height);
  if (height > 0 && height !== lastHeight) {
    lastHeight = height;
    await win.setSize(new LogicalSize(WIDTH, height));
  }
}

let shown = false;
async function refresh(): Promise<void> {
  const [history, usage, link, seen] = await Promise.all([
    invoke<string>('read_history').catch(() => ''),
    invoke<DailyUsage>('daily_usage').catch(() => undefined),
    invoke<SetupInfo['link']>('link_status').catch(() => undefined),
    invoke<SetupInfo['seen']>('statusline_seen').catch(() => null),
  ]);
  const setup: SetupInfo | undefined = link ? { link, seen } : undefined;
  const view: WidgetView = buildWidgetView(history, usage, Math.floor(Date.now() / 1000), lang, undefined, setup);
  app.innerHTML = renderWidget(view);
  app.querySelector<HTMLButtonElement>('[data-action="hide"]')?.addEventListener('click', () => void win.hide());
  app.querySelector<HTMLButtonElement>('[data-action="link"], [data-action="replace"]')?.addEventListener('click', (e) => {
    const force = (e.currentTarget as HTMLElement).dataset.action === 'replace';
    void invoke('link_claude', { force }).finally(() => void refresh());
  });
  await fitWindow();
  if (!shown) {
    shown = true;
    await win.show();
  }
}

app.addEventListener('mousedown', (e) => {
  const target = e.target as HTMLElement;
  if (e.button === 0 && !target.closest('button')) void win.startDragging();
});

applyPrefs(await invoke<Prefs>('get_prefs').catch(() => ({ glass: 'none', alwaysOnTop: true }) as Prefs));
await listen<Prefs>('prefs-changed', (e) => applyPrefs(e.payload));
await listen('data-changed', () => void refresh());
// Relative times ("updated 3 min ago") and day changes still need a slow tick.
setInterval(() => void refresh(), 30_000);
await refresh();
