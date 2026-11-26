import fs from 'node:fs';
import { duration } from './format.js';
import { lastPoint } from './history.js';
import { historyFile, installStateFile, seenFile, settingsFile, type Env } from './paths.js';
import { isOurs } from './settings.js';
import type { Lang } from './i18n.js';

const M = {
  fr: {
    title: 'claude-jauge doctor : pourquoi les limites arrivent (ou pas)',
    settingsMissing: '✗ statusLine : absente de {file}',
    settingsBad: '✗ statusLine : {file} est illisible (JSON invalide)',
    settingsForeign: '✗ statusLine : une autre commande est en place ({cmd})',
    settingsOurs: '✓ statusLine : {cmd}',
    seenNever: '✗ Claude Code n\'a encore jamais lancé la statusLine (ou une version trop ancienne : relance « claude-jauge install »)',
    seenLimits: '✓ dernier passage il y a {ago}, avec les limites',
    seenNoLimits: '✗ dernier passage il y a {ago}, mais SANS limites',
    historyNone: '✗ historique : aucun relevé dans {file}',
    historyLast: '✓ historique : dernier relevé il y a {ago}',
    fixInstall: '→ Lance « claude-jauge install » (ou ouvre le widget), puis redémarre Claude Code.',
    fixForeign: '→ « claude-jauge install --force » la remplace (une sauvegarde est gardée).',
    fixBad: '→ Corrige le JSON de settings.json, puis relance « claude-jauge install ».',
    fixRestart: '→ Redémarre Claude Code et envoie-lui un message.',
    fixPlan: '→ Les limites n\'existent qu\'avec un abonnement Pro ou Max. Vérifie avec /status dans Claude Code : connecte-toi avec /login plutôt qu\'avec une clé API.',
    allGood: '→ Tout fonctionne.',
  },
  en: {
    title: 'claude-jauge doctor: why limits arrive (or not)',
    settingsMissing: '✗ status line: not in {file}',
    settingsBad: '✗ status line: {file} cannot be read (invalid JSON)',
    settingsForeign: '✗ status line: another command is set ({cmd})',
    settingsOurs: '✓ status line: {cmd}',
    seenNever: '✗ Claude Code never ran the status line yet (or an older version: run "claude-jauge install" again)',
    seenLimits: '✓ last run {ago} ago, with limits',
    seenNoLimits: '✗ last run {ago} ago, but WITHOUT limits',
    historyNone: '✗ history: no point in {file}',
    historyLast: '✓ history: last point {ago} ago',
    fixInstall: '→ Run "claude-jauge install" (or open the widget), then restart Claude Code.',
    fixForeign: '→ "claude-jauge install --force" replaces it (a backup is kept).',
    fixBad: '→ Fix the JSON in settings.json, then run "claude-jauge install" again.',
    fixRestart: '→ Restart Claude Code and send it a message.',
    fixPlan: '→ Limits only exist with a Pro or Max plan. Check /status in Claude Code: sign in with /login rather than an API key.',
    allGood: '→ Everything works.',
  },
} as const;

type Key = keyof (typeof M)['fr'];

function readJson(file: string): { exists: boolean; data?: Record<string, unknown> } {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { exists: false };
  }
  try {
    const v = JSON.parse(text.replace(/^﻿/, '') || '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? { exists: true, data: v as Record<string, unknown> } : { exists: true };
  } catch {
    return { exists: true };
  }
}

/** Checks the whole chain, from settings.json to the history file, and says what to do. */
export function diagnose(lang: Lang, nowSec: number, env: Env = process.env): string[] {
  const m = (k: Key, vars: Record<string, string> = {}) => M[lang][k].replace(/\{(\w+)\}/g, (_, v: string) => vars[v] ?? '');
  const ago = (t: number) => duration(Math.max(0, nowSec - t), lang);
  const lines: string[] = [m('title'), ''];

  const file = settingsFile(env);
  const settings = readJson(file);
  const statusLine = settings.data?.statusLine as { command?: unknown } | undefined;
  const command = typeof statusLine?.command === 'string' ? statusLine.command : undefined;
  const installed = readJson(installStateFile(env)).data?.command;
  let fix: Key | undefined;
  if (settings.exists && !settings.data) {
    lines.push(m('settingsBad', { file }));
    fix = 'fixBad';
  } else if (!statusLine) {
    lines.push(m('settingsMissing', { file }));
    fix = 'fixInstall';
  } else if (!isOurs(statusLine, typeof installed === 'string' ? installed : undefined)) {
    lines.push(m('settingsForeign', { cmd: command ?? JSON.stringify(statusLine) }));
    fix = 'fixForeign';
  } else {
    lines.push(m('settingsOurs', { cmd: command ?? '' }));
  }

  const seen = readJson(seenFile(env)).data as { t?: unknown; limits?: unknown } | undefined;
  if (typeof seen?.t !== 'number') {
    lines.push(m('seenNever'));
    fix ??= 'fixRestart';
  } else if (seen.limits === true) {
    lines.push(m('seenLimits', { ago: ago(seen.t) }));
  } else {
    lines.push(m('seenNoLimits', { ago: ago(seen.t) }));
    fix ??= 'fixPlan';
  }

  const last = lastPoint(historyFile(env));
  lines.push(last ? m('historyLast', { ago: ago(last.t) }) : m('historyNone', { file: historyFile(env) }));

  lines.push('', m(fix ?? 'allGood'));
  return lines;
}
