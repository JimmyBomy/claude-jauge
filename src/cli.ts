#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { colorsFor } from './format.js';
import { computeState, renderGauges } from './gauges.js';
import { historyFile, jaugeDir, projectsDir } from './paths.js';
import { readHistory } from './history.js';
import { detectLang, t, type Lang } from './i18n.js';
import { aggregate, renderTable, totals, type GroupBy } from './report.js';
import { loadUsage } from './sessions.js';
import { install, uninstall } from './settings.js';
import { runStatusline } from './statusline.js';
import { VERSION } from './version.js';
import { createServer } from './web.js';

export interface Args {
  command: string;
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS = new Set(['lang', 'port', 'days', 'jours', 'by', 'par']);

export function parseArgs(argv: string[]): Args {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-h') flags.help = true;
    else if (a === '-v') flags.version = true;
    else if (a.startsWith('--')) {
      const [name, inline] = a.slice(2).split('=', 2) as [string, string | undefined];
      if (inline !== undefined) flags[name] = inline;
      else if (VALUE_FLAGS.has(name) && argv[i + 1] !== undefined && !argv[i + 1]!.startsWith('-')) flags[name] = argv[++i]!;
      else flags[name] = true;
    } else positional.push(a);
  }
  return { command: positional[0] ?? 'gauges', flags };
}

const COMMANDS: Record<string, string> = {
  gauges: 'gauges',
  jauges: 'gauges',
  install: 'install',
  installer: 'install',
  uninstall: 'uninstall',
  desinstaller: 'uninstall',
  statusline: 'statusline',
  rapport: 'report',
  report: 'report',
  web: 'web',
  help: 'help',
  aide: 'help',
};

const GROUPS: Record<string, GroupBy> = { day: 'day', jour: 'day', week: 'week', semaine: 'week', model: 'model', modele: 'model', 'modèle': 'model' };

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function positiveInt(v: string | boolean | undefined, fallback: number): number {
  const n = Number(str(v));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(cmd, args as string[], { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' }).unref();
  } catch {
    // The URL is printed anyway.
  }
}

export async function main(argv: string[]): Promise<number> {
  const { command: raw, flags } = parseArgs(argv);
  const lang: Lang = detectLang(str(flags.lang));
  const out = (s: string) => process.stdout.write(s + '\n');
  const err = (s: string) => process.stderr.write(s + '\n');

  if (flags.version) {
    out(VERSION);
    return 0;
  }
  const command = flags.help ? 'help' : COMMANDS[raw];
  if (!command) {
    err(t(lang, 'unknownCommand', { cmd: raw }));
    err('');
    err(t(lang, 'help', { version: VERSION }));
    return 1;
  }
  const nowSec = Math.floor(Date.now() / 1000);

  switch (command) {
    case 'help':
      out(t(lang, 'help', { version: VERSION }));
      return 0;

    case 'statusline': {
      // Must never fail: an error or empty output blanks the status line.
      let line = 'claude-jauge';
      try {
        line = runStatusline({
          stdin: await readStdin(),
          historyFile: historyFile(),
          lang,
          nowSec,
          remaining: Boolean(flags.remaining || flags.restant),
        });
      } catch {
        // keep the fallback text
      }
      out(line);
      return 0;
    }

    case 'gauges': {
      const state = computeState(readHistory(historyFile()), nowSec);
      if (flags.json) out(JSON.stringify(state, null, 2));
      else out(renderGauges(state, lang, colorsFor(Boolean(process.stdout.isTTY))));
      return 0;
    }

    case 'install': {
      const sourceDir = path.dirname(fileURLToPath(import.meta.url));
      const res = install({
        sourceDir,
        force: Boolean(flags.force),
        remaining: Boolean(flags.remaining || flags.restant),
        lang: str(flags.lang),
      });
      if (!res.ok) {
        err(res.reason === 'bad-json' ? t(lang, 'installBadJson', { file: res.settingsFile }) : t(lang, 'installForeign', { cmd: res.existing }));
        return 1;
      }
      out(t(lang, 'installDone', { file: res.settingsFile }));
      if (res.backup) out(t(lang, 'installBackup', { file: res.backup }));
      out(t(lang, 'installCommand', { cmd: res.command }));
      out('');
      out(t(lang, 'installNext'));
      return 0;
    }

    case 'uninstall': {
      const res = uninstall();
      if (!res.ok) {
        if (res.reason === 'bad-json') {
          err(t(lang, 'installBadJson', { file: res.settingsFile }));
          return 1;
        }
        out(t(lang, 'uninstallNothing', { file: res.settingsFile }));
        return 0;
      }
      out(t(lang, 'uninstallDone', { file: res.settingsFile }));
      out(t(lang, 'installBackup', { file: res.backup }));
      if (res.restored) out(t(lang, 'uninstallRestored', { cmd: res.restored }));
      out(t(lang, 'uninstallKept', { dir: jaugeDir() }));
      return 0;
    }

    case 'report': {
      const days = positiveInt(flags.days ?? flags.jours, 14);
      const dir = projectsDir();
      const records = await loadUsage(dir, (nowSec - days * 86400) * 1000);
      const only = GROUPS[(str(flags.by ?? flags.par) ?? '').toLowerCase()];
      const groups: GroupBy[] = only ? [only] : ['day', 'week', 'model'];
      if (flags.json) {
        const data = Object.fromEntries(groups.map((g) => [g, aggregate(records, g)]));
        out(JSON.stringify({ days, total: totals(aggregate(records, 'model')), ...data }, null, 2));
        return 0;
      }
      if (records.length === 0) {
        out(t(lang, 'reportEmpty', { dir }));
        return 0;
      }
      const range = t(lang, 'reportRange', { n: days });
      for (const g of groups) {
        out(t(lang, 'reportTitle', { by: t(lang, `reportBy_${g}`), range }));
        out(renderTable(aggregate(records, g), g, lang));
        out('');
      }
      out(t(lang, 'reportHint'));
      return 0;
    }

    case 'web': {
      const port = positiveInt(flags.port, 4269);
      const days = positiveInt(flags.days ?? flags.jours, 14);
      const server = createServer({ lang, historyFile: historyFile(), projectsDir: projectsDir(), days }, port);
      return await new Promise<number>((resolve) => {
        server.once('error', (e: NodeJS.ErrnoException) => {
          err(e.code === 'EADDRINUSE' ? t(lang, 'webPortBusy', { port }) : String(e.message));
          resolve(1);
        });
        // Loopback only: the dashboard is never reachable from the network.
        server.listen(port, '127.0.0.1', () => {
          const url = `http://127.0.0.1:${port}/`;
          out(t(lang, 'webListening', { url }));
          if (flags.open) openBrowser(url);
        });
      });
    }
  }
  return 0;
}

// Run only when executed directly (not when imported by tests).
const isMain = (() => {
  try {
    // realpath: npm links the bin through a symlink on macOS/Linux.
    return process.argv[1] !== undefined && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => {
      if (code !== 0) process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(String(e instanceof Error ? e.stack : e) + '\n');
      process.exitCode = 1;
    },
  );
}
