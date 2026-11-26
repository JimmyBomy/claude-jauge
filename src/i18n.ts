import type { Env } from './paths.js';

export type Lang = 'fr' | 'en';

const fr = {
  five: '5 h',
  week: 'semaine',
  fiveLong: 'Fenêtre 5 h',
  weekLong: 'Semaine',
  reset: 'reset',
  resetLong: 'remise à zéro {time} (dans {in})',
  used: 'utilisé',
  left: 'restant',
  noLimits: 'limites : pas encore reçues',
  updatedAgo: 'mis à jour il y a {ago}',
  updatedNow: "mis à jour à l'instant",
  stale: 'attention : dernières données vieilles de {ago}, lance Claude Code pour les rafraîchir',
  windowReset: 'fenêtre remise à zéro à {time}, en attente de nouvelles données',
  noData:
    "Aucune donnée pour l'instant.\nInstalle la statusLine avec « claude-jauge install », redémarre Claude Code et envoie-lui un message (abonnement Pro ou Max).",
  forecastHit: 'à ce rythme, limite atteinte vers {time}',
  forecastSafe: 'à ce rythme, pas de limite avant la remise à zéro',
  forecastUnknown: 'prévision : pas assez de points dans cette fenêtre',
  forecastReached: 'limite atteinte',
  forecastSoon: 'à ce rythme, limite atteinte très bientôt',
  reportTitle: 'Jetons par {by} ({range})',
  reportBy_day: 'jour',
  reportBy_week: 'semaine',
  reportBy_model: 'modèle',
  reportRange: '{n} derniers jours',
  reportEmpty: 'Aucune session Claude Code trouvée dans {dir}.',
  colKey_day: 'Jour',
  colKey_week: 'Semaine',
  colKey_model: 'Modèle',
  colInput: 'Entrée',
  colOutput: 'Sortie',
  colCacheW: 'Cache écrit',
  colCacheR: 'Cache lu',
  colTotal: 'Total',
  total: 'Total',
  reportHint: 'Pour les coûts en dollars, voir ccusage (npx ccusage).',
  installDone: 'statusLine installée dans {file}',
  installBackup: 'sauvegarde : {file}',
  installCommand: 'commande : {cmd}',
  installNext: 'Redémarre Claude Code. Les jauges apparaissent après la première réponse (Pro/Max uniquement).',
  installForeign:
    'Une statusLine existe déjà ({cmd}).\nRelance avec --force pour la remplacer (elle sera restaurée par « uninstall »).',
  installBadJson: "Impossible de lire {file} : JSON invalide. Rien n'a été modifié.",
  uninstallDone: 'statusLine retirée de {file}',
  uninstallRestored: 'ancienne statusLine restaurée : {cmd}',
  uninstallNothing: "claude-jauge n'est pas installé dans {file}. Rien à faire.",
  uninstallKept: "Ton historique est conservé dans {dir} (supprime ce dossier si tu n'en veux plus).",
  webListening: 'Tableau de bord : {url}  (Ctrl+C pour arrêter)',
  webPortBusy: 'Le port {port} est déjà utilisé. Essaie --port 4270.',
  unknownCommand: 'Commande inconnue : {cmd}',
  help: `claude-jauge {version} : combien il te reste de tes limites Claude (Pro/Max)

Utilisation :
  npx claude-jauge              jauges 5 h et semaine + prévision
  npx claude-jauge install      ajoute la statusLine à ~/.claude/settings.json
  npx claude-jauge uninstall    la retire (et restaure l'ancienne)
  npx claude-jauge rapport      jetons par jour, semaine et modèle
  npx claude-jauge web          tableau de bord local sur http://127.0.0.1:4269
  npx claude-jauge doctor       vérifie pourquoi les limites arrivent ou pas

Options :
  --lang fr|en       langue (sinon détection automatique)
  --jours N          rapport/web : nombre de jours (défaut 14)
  --par jour|semaine|modele   rapport : un seul regroupement
  --json             sortie JSON (jauges, rapport)
  --port N           web : port (défaut 4269)
  --open             web : ouvre le navigateur
  --restant          install : la statusLine affiche le restant au lieu de l'utilisé
  --force            install : remplace une statusLine existante
  -h, --help / -v, --version

Tout reste sur ta machine. Rien n'est envoyé sur Internet.`,
  levelNormal: 'Normal',
  levelWarning: 'Attention',
  levelCritical: 'Limite proche',
  widgetToday: "Aujourd'hui : {tokens} jetons",
  widgetTopModel: '{model} {share}',
  widgetEmpty: 'Pas encore de limites. Installe la statusLine (claude-jauge install), redémarre Claude Code et envoie-lui un message.',
  widgetLinked: 'Branché. Les limites arrivent quand tu utilises Claude Code dans un terminal (commande claude) : l\'appli Claude ne les transmet pas. Envoie-lui un message et elles s\'afficheront ici.',
  widgetNotLinked: 'Pas encore branché à Claude Code.',
  widgetLinkAction: 'Brancher à Claude Code',
  widgetForeign: 'Claude Code a déjà une autre statusLine ({command}). claude-jauge en a besoin pour recevoir tes limites.',
  widgetReplaceAction: 'La remplacer (sauvegarde gardée)',
  widgetBadJson: 'Le fichier de réglages de Claude Code (settings.json) est illisible. Corrige-le, puis relance claude-jauge.',
  widgetNoLimitsSent: 'Claude Code ne transmet pas de limites. Elles n\'existent qu\'avec un abonnement Pro ou Max (connexion avec /login), pas avec une clé API.',
  widgetResetAt: 'reset {time}',
  widgetLimitAt: 'limite vers {time}',
  widgetLimitNow: 'limite atteinte',
  units: { d: 'j', h: 'h', m: 'min' },
};

const en: typeof fr = {
  five: '5h',
  week: 'week',
  fiveLong: '5-hour window',
  weekLong: 'Week',
  reset: 'reset',
  resetLong: 'resets {time} (in {in})',
  used: 'used',
  left: 'left',
  noLimits: 'limits: not received yet',
  updatedAgo: 'updated {ago} ago',
  updatedNow: 'updated just now',
  stale: 'note: latest data is {ago} old, use Claude Code to refresh it',
  windowReset: 'window reset at {time}, waiting for new data',
  noData:
    'No data yet.\nInstall the status line with "claude-jauge install", restart Claude Code and send it a message (Pro or Max plan).',
  forecastHit: 'at this pace, limit reached around {time}',
  forecastSafe: 'at this pace, no limit before the reset',
  forecastUnknown: 'forecast: not enough points in this window',
  forecastReached: 'limit reached',
  forecastSoon: 'at this pace, limit reached very soon',
  reportTitle: 'Tokens by {by} ({range})',
  reportBy_day: 'day',
  reportBy_week: 'week',
  reportBy_model: 'model',
  reportRange: 'last {n} days',
  reportEmpty: 'No Claude Code session found in {dir}.',
  colKey_day: 'Day',
  colKey_week: 'Week',
  colKey_model: 'Model',
  colInput: 'Input',
  colOutput: 'Output',
  colCacheW: 'Cache write',
  colCacheR: 'Cache read',
  colTotal: 'Total',
  total: 'Total',
  reportHint: 'For dollar costs, see ccusage (npx ccusage).',
  installDone: 'status line installed in {file}',
  installBackup: 'backup: {file}',
  installCommand: 'command: {cmd}',
  installNext: 'Restart Claude Code. Gauges show up after the first reply (Pro/Max only).',
  installForeign:
    'A status line already exists ({cmd}).\nRun again with --force to replace it ("uninstall" will restore it).',
  installBadJson: 'Cannot read {file}: invalid JSON. Nothing was changed.',
  uninstallDone: 'status line removed from {file}',
  uninstallRestored: 'previous status line restored: {cmd}',
  uninstallNothing: 'claude-jauge is not installed in {file}. Nothing to do.',
  uninstallKept: 'Your history is kept in {dir} (delete that folder if you do not want it).',
  webListening: 'Dashboard: {url}  (Ctrl+C to stop)',
  webPortBusy: 'Port {port} is already in use. Try --port 4270.',
  unknownCommand: 'Unknown command: {cmd}',
  help: `claude-jauge {version}: how much of your Claude limits (Pro/Max) is left

Usage:
  npx claude-jauge              5-hour and weekly gauges + forecast
  npx claude-jauge install      add the status line to ~/.claude/settings.json
  npx claude-jauge uninstall    remove it (and restore the previous one)
  npx claude-jauge report       tokens by day, week and model  (alias: rapport)
  npx claude-jauge web          local dashboard on http://127.0.0.1:4269
  npx claude-jauge doctor       checks why limits arrive or not

Options:
  --lang fr|en       language (auto-detected otherwise)
  --days N           report/web: number of days (default 14)  (alias: --jours)
  --by day|week|model   report: a single grouping  (alias: --par)
  --json             JSON output (gauges, report)
  --port N           web: port (default 4269)
  --open             web: open the browser
  --remaining        install: status line shows what is left instead of used
  --force            install: replace an existing status line
  -h, --help / -v, --version

Everything stays on your machine. Nothing is sent over the Internet.`,
  levelNormal: 'Normal',
  levelWarning: 'Watch out',
  levelCritical: 'Near limit',
  widgetToday: 'Today: {tokens} tokens',
  widgetTopModel: '{model} {share}',
  widgetLinked: 'Plugged in. Limits arrive when you use Claude Code in a terminal (the claude command): the Claude app does not send them. Send it a message and they will show up here.',
  widgetNotLinked: 'Not plugged into Claude Code yet.',
  widgetLinkAction: 'Plug into Claude Code',
  widgetForeign: 'Claude Code already has another status line ({command}). claude-jauge needs it to receive your limits.',
  widgetReplaceAction: 'Replace it (a backup is kept)',
  widgetBadJson: 'The Claude Code settings file (settings.json) cannot be read. Fix it, then restart claude-jauge.',
  widgetNoLimitsSent: 'Claude Code sends no limits. They only exist with a Pro or Max plan (signed in with /login), not with an API key.',
  widgetEmpty: 'No limits yet. Install the status line (claude-jauge install), restart Claude Code and send it a message.',
  widgetResetAt: 'reset {time}',
  widgetLimitAt: 'limit around {time}',
  widgetLimitNow: 'limit reached',
  units: { d: 'd', h: 'h', m: 'min' },
};

export const messages = { fr, en };
export type Messages = typeof fr;
type StringKey = { [K in keyof Messages]: Messages[K] extends string ? K : never }[keyof Messages];

export function normalizeLang(value: string | undefined): Lang | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (v.startsWith('fr')) return 'fr';
  if (v.startsWith('en')) return 'en';
  return undefined;
}

/**
 * Order: --lang flag, CLAUDE_JAUGE_LANG, LC_ALL / LC_MESSAGES / LANG (POSIX),
 * then the OS locale through Intl (this is what works on Windows). Default: English.
 */
export function detectLang(flag: string | undefined, env: Env = process.env, intlLocale?: string): Lang {
  const candidates = [flag, env.CLAUDE_JAUGE_LANG, env.LC_ALL, env.LC_MESSAGES, env.LANG];
  for (const c of candidates) {
    if (!c || c === 'C' || c === 'POSIX' || c.startsWith('C.')) continue;
    const l = normalizeLang(c);
    if (l) return l;
  }
  let loc = intlLocale;
  if (loc === undefined) {
    try {
      loc = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      loc = undefined;
    }
  }
  return normalizeLang(loc) ?? 'en';
}

export function t(lang: Lang, key: StringKey, vars: Record<string, string | number> = {}): string {
  const template = messages[lang][key] as string;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
