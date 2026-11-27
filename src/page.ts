import type { Lang } from './i18n.js';
import { startDashboard } from './dashboard-client.js';
import { cssVars, palettes, THRESHOLDS } from './theme.js';

export const pageStrings = {
  fr: {
    subtitle: 'Tes limites Claude, en local',
    five: 'Fenêtre 5 h',
    week: 'Semaine',
    left: 'restant',
    used: 'utilisé',
    levels: { normal: 'Normal', warning: 'Attention', critical: 'Limite proche' },
    noData: "Pas encore de limites. Elles arrivent après une réponse de Claude Code dans un terminal (commande claude), avec un abonnement Pro ou Max. Sans le widget, branche d'abord la statusLine avec claude-jauge install.",
    noHistory: "L'historique se remplit à chaque réponse de Claude Code, au plus un point par minute.",
    readingSessions: 'Lecture des sessions Claude Code…',
    usageChart: 'Utilisation des limites',
    tokensChart: 'Jetons par jour',
    byModel: 'Jetons par modèle',
    model: 'Modèle',
    tokens: 'Jetons',
    share: 'Part',
    theme: 'Changer de thème',
    privacy: "Tout est lu sur ta machine (historique claude-jauge et fichiers de session Claude Code, en lecture seule). Rien n'est envoyé sur Internet.",
    empty: 'Aucune session sur la période.',
    other: 'autres',
    loading: 'chargement',
  },
  en: {
    subtitle: 'Your Claude limits, locally',
    five: '5-hour window',
    week: 'Week',
    left: 'left',
    used: 'used',
    levels: { normal: 'Normal', warning: 'Watch out', critical: 'Near limit' },
    noData: 'No limits yet. They arrive after a Claude Code reply in a terminal (the claude command), with a Pro or Max plan. Without the widget, plug in the status line first with claude-jauge install.',
    noHistory: 'History fills up with every Claude Code reply, at most one point per minute.',
    readingSessions: 'Reading Claude Code sessions…',
    usageChart: 'Limit usage',
    tokensChart: 'Tokens per day',
    byModel: 'Tokens by model',
    model: 'Model',
    tokens: 'Tokens',
    share: 'Share',
    theme: 'Switch theme',
    privacy: 'Everything is read on your machine (claude-jauge history and Claude Code session files, read only). Nothing is sent over the Internet.',
    empty: 'No session in this period.',
    other: 'other',
    loading: 'loading',
  },
};

const DARK = cssVars(palettes.dark);
const LIGHT = cssVars(palettes.light);

/** Styles of the dashboard, shared with the Windows app. */
export function dashboardCss(): string {
  return `:root{${DARK};--edge:rgba(255,255,255,.10);--grid:rgba(255,255,255,.08);--hi:rgba(255,255,255,.09);
--rim:linear-gradient(150deg,rgba(255,255,255,.55),rgba(255,255,255,.12) 22%,rgba(255,255,255,0) 48%,rgba(255,255,255,.05) 72%,rgba(255,255,255,.30));
--wall:radial-gradient(1100px 760px at 15% 8%,rgba(100,210,255,.22),transparent 60%),radial-gradient(900px 800px at 88% 18%,rgba(191,90,242,.20),transparent 60%),radial-gradient(1000px 800px at 70% 100%,rgba(255,159,10,.14),transparent 60%),linear-gradient(160deg,#0b0d16,#07080e 70%);
color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme=dark]){${LIGHT};--edge:rgba(0,0,0,.08);--grid:rgba(0,0,0,.08);--hi:rgba(255,255,255,.6);
--rim:linear-gradient(150deg,rgba(255,255,255,.95),rgba(255,255,255,.5) 30%,rgba(255,255,255,.1) 60%,rgba(255,255,255,.7));
--wall:radial-gradient(1100px 760px at 15% 8%,rgba(100,210,255,.35),transparent 60%),radial-gradient(900px 800px at 88% 18%,rgba(191,90,242,.22),transparent 60%),radial-gradient(1000px 800px at 70% 100%,rgba(255,159,10,.20),transparent 60%),linear-gradient(160deg,#eef1f8,#e6e8f0 70%);
color-scheme:light}}
:root[data-theme=light]{${LIGHT};--edge:rgba(0,0,0,.08);--grid:rgba(0,0,0,.08);--hi:rgba(255,255,255,.6);
--rim:linear-gradient(150deg,rgba(255,255,255,.95),rgba(255,255,255,.5) 30%,rgba(255,255,255,.1) 60%,rgba(255,255,255,.7));
--wall:radial-gradient(1100px 760px at 15% 8%,rgba(100,210,255,.35),transparent 60%),radial-gradient(900px 800px at 88% 18%,rgba(191,90,242,.22),transparent 60%),radial-gradient(1000px 800px at 70% 100%,rgba(255,159,10,.20),transparent 60%),linear-gradient(160deg,#eef1f8,#e6e8f0 70%);
color-scheme:light}
*{box-sizing:border-box}
html{min-height:100%;background:var(--wall)}
body{margin:0;min-height:100vh;color:var(--ink);
font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI Variable Text","Segoe UI","Inter",system-ui,sans-serif;
letter-spacing:-.005em;-webkit-font-smoothing:antialiased}
main{max-width:1000px;margin:0 auto;padding:28px 16px 56px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:12px}
.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#c6ff4e,#7cc4ff);display:grid;place-items:center;box-shadow:0 6px 18px -6px rgba(124,196,255,.6)}
.mark span{width:18px;height:6px;border-radius:3px;background:#0d0f14;position:relative;overflow:hidden}
.mark span::after{content:"";position:absolute;inset:0 40% 0 0;background:#30d158}
h1{font:650 21px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI Variable Display","Segoe UI","Inter",system-ui,sans-serif;margin:0;letter-spacing:-.02em}
h1 small{display:block;font-size:13px;font-weight:450;color:var(--muted);letter-spacing:0;margin-top:2px}
h2{font-size:14px;margin:0 0 14px;font-weight:600;color:var(--muted);letter-spacing:.01em}
.tools{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px}
.glass{position:relative;background:linear-gradient(180deg,var(--hi),transparent 45%),var(--card);
-webkit-backdrop-filter:blur(28px) saturate(170%);backdrop-filter:blur(28px) saturate(170%);
border:1px solid var(--edge);border-radius:24px;
box-shadow:0 1px 1px rgba(0,0,0,.10),0 12px 28px -12px rgba(0,0,0,.35),0 40px 80px -36px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.16)}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;background:var(--rim);
-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
@media (prefers-reduced-transparency:reduce){.glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--card)}}
button.icon{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--edge);border-radius:12px;width:36px;height:36px;display:grid;place-items:center;cursor:pointer}
button.icon:focus-visible{outline:2px solid #7cc4ff;outline-offset:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;margin-bottom:16px}
.card{padding:20px 22px}
.gauge-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.gauge-top h2{margin:0}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:650;padding:3px 10px 3px 8px;border-radius:999px;color:var(--lv);background:color-mix(in srgb,var(--lv) 14%,transparent);border:1px solid color-mix(in srgb,var(--lv) 35%,transparent)}
.badge svg{width:14px;height:14px}
.big{display:flex;align-items:baseline;gap:8px;font:700 52px/1.05 -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI Variable Display","Segoe UI","Inter",system-ui,sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.big span{font-size:16px;font-weight:500;letter-spacing:0;color:var(--muted)}
.track{height:14px;border-radius:7px;background:var(--track);overflow:hidden;margin:14px 0 12px;box-shadow:inset 0 1px 2px rgba(0,0,0,.18)}
.fill{height:100%;border-radius:7px;background:var(--lv);box-shadow:0 0 14px color-mix(in srgb,var(--lv) 55%,transparent);transition:width .6s cubic-bezier(.2,.9,.3,1)}
@media (prefers-reduced-motion:reduce){.fill{transition:none}}
.meta{color:var(--muted);font-size:14px;font-variant-numeric:tabular-nums}
.meta b{color:var(--ink);font-weight:600}
.fc{margin-top:6px;font-size:14px;color:var(--muted)}
.fc.alert{color:var(--critical);font-weight:600}
section.card{margin-bottom:16px}
svg.chart{display:block;width:100%;height:auto}
svg.chart text{fill:var(--muted);font-size:11px}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin-top:10px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{padding:8px 4px;border-bottom:1px solid var(--grid);text-align:right}
th:first-child,td:first-child{text-align:left;font-variant-numeric:normal}
tr:last-child td{border-bottom:0}
th{font-weight:600;color:var(--muted);font-size:13px}
footer{margin-top:22px;font-size:13px;color:var(--muted);text-align:center}
.tip{position:fixed;pointer-events:none;padding:6px 10px;font-size:12px;display:none;border-radius:12px;z-index:10}
`;
}

/** Markup of the dashboard (filled by startDashboard), shared with the Windows app. */
export function dashboardMarkup(lang: Lang): string {
  const s = pageStrings[lang];
  return `<main>
<header>
  <div class="brand"><div class="mark" aria-hidden="true"><span></span></div><h1>claude-jauge<small>${s.subtitle}</small></h1></div>
  <div class="tools"><span id="upd">${s.loading}</span>
    <button class="icon glass" id="theme" type="button" aria-label="${s.theme}" title="${s.theme}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/></svg>
    </button></div>
</header>
<section class="grid" id="gauges" aria-live="polite"></section>
<section class="card glass"><h2>${s.usageChart}</h2><div id="usage"></div></section>
<section class="card glass"><h2>${s.tokensChart}</h2><div id="tokens"></div></section>
<section class="card glass"><h2>${s.byModel}</h2><div id="models"></div></section>
<footer>${s.privacy}</footer>
</main>
<div class="tip glass" id="tip"></div>`;
}

/** One self-contained HTML page: inline CSS and JS, hand-made SVG charts, no external request. */
export function renderPage(lang: Lang): string {
  const config = `{S:${JSON.stringify(pageStrings[lang])},locale:${JSON.stringify(lang === 'fr' ? 'fr-FR' : 'en-US')},th:${JSON.stringify(THRESHOLDS)},` +
    `limits:()=>fetch('/api/limits',{cache:'no-store'}).then(r=>r.json()),tokens:()=>fetch('/api/tokens',{cache:'no-store'}).then(r=>r.json())}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>claude-jauge</title>
<style>
${dashboardCss()}</style>
</head>
<body>
${dashboardMarkup(lang)}
<script>
(${startDashboard.toString()})(${config});
</script>
</body>
</html>`;
}
