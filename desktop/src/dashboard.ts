// The dashboard window of the Windows app: the same page as `claude-jauge web`,
// fed through Tauri commands instead of a local server, so neither Node nor a port is needed.
import { invoke } from '@tauri-apps/api/core';
import { startDashboard } from '../../src/dashboard-client.js';
import { limitsView, tokensView, type DayModelTokens } from '../../src/dashboard-data.js';
import { detectLang } from '../../src/i18n.js';
import { dashboardCss, dashboardMarkup, pageStrings } from '../../src/page.js';
import { parseHistory } from '../../src/points.js';
import { THRESHOLDS } from '../../src/theme.js';

const DAYS = 14;
const lang = detectLang(undefined, {}, navigator.language);
document.documentElement.lang = lang;
document.title = lang === 'fr' ? 'claude-jauge, tableau de bord' : 'claude-jauge, dashboard';

const style = document.createElement('style');
style.textContent = dashboardCss();
document.head.append(style);
document.body.innerHTML = dashboardMarkup(lang);

startDashboard({
  S: pageStrings[lang],
  locale: lang === 'fr' ? 'fr-FR' : 'en-US',
  th: THRESHOLDS,
  limits: async () => {
    const text = await invoke<string>('read_history_all');
    return limitsView(parseHistory(text), { lang, days: DAYS }, Math.floor(Date.now() / 1000));
  },
  tokens: async () => tokensView(await invoke<DayModelTokens[]>('usage_by_day', { days: DAYS })),
});
