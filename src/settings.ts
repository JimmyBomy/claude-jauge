import fs from 'node:fs';
import path from 'node:path';
import { appDir, installStateFile, settingsFile, toShellPath, type Env } from './paths.js';

/** Marker present in every command we install, used to recognise our own status line. */
export const MARKER = 'claude-jauge';

interface StatusLineSetting {
  type?: string;
  command?: string;
  padding?: number;
  [k: string]: unknown;
}

interface InstallState {
  installedAt: string;
  settingsFile: string;
  command: string;
  /** The status line that was there before, restored by uninstall. Null if there was none. */
  previous: StatusLineSetting | null;
}

export type InstallResult =
  | { ok: true; settingsFile: string; backup?: string; command: string }
  | { ok: false; reason: 'bad-json'; settingsFile: string }
  | { ok: false; reason: 'foreign'; settingsFile: string; existing: string };

export type UninstallResult =
  | { ok: true; settingsFile: string; backup: string; restored?: string }
  | { ok: false; reason: 'not-installed' | 'bad-json'; settingsFile: string };

export interface InstallOptions {
  env?: Env;
  /** Folder holding the compiled .js files to copy (defaults to the running package). */
  sourceDir: string;
  force?: boolean;
  remaining?: boolean;
  lang?: string;
  now?: Date;
}

function readJson(file: string): { exists: boolean; data?: Record<string, unknown> } {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { exists: false, data: {} };
  }
  if (!text.trim()) return { exists: true, data: {} };
  try {
    const v = JSON.parse(text.replace(/^﻿/, '')) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { exists: true };
    return { exists: true, data: v as Record<string, unknown> };
  } catch {
    return { exists: true };
  }
}

/** Write to a temp file then rename, so a crash never leaves a half-written settings.json. */
function writeJsonAtomic(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.claude-jauge-${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
}

/** Copies settings.json next to itself: settings.json.claude-jauge-<date>.bak */
export function backupFile(file: string, now: Date): string | undefined {
  if (!fs.existsSync(file)) return undefined;
  const backup = `${file}.claude-jauge-${stamp(now)}.bak`;
  fs.copyFileSync(file, backup);
  return backup;
}

/**
 * Copies the compiled app to ~/.claude-jauge/app so the status line does not depend on
 * the npx cache (which can be wiped) and starts fast (no package resolution on each run).
 */
export function copyApp(sourceDir: string, targetDir: string): void {
  if (path.resolve(sourceDir) === path.resolve(targetDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const name of fs.readdirSync(sourceDir)) {
    if (name.endsWith('.js')) fs.copyFileSync(path.join(sourceDir, name), path.join(targetDir, name));
  }
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({ type: 'module', private: true }, null, 2) + '\n');
}

export function buildCommand(env: Env, opts: { remaining?: boolean; lang?: string }): string {
  const cli = toShellPath(path.join(appDir(env), 'cli.js'));
  const args = ['statusline'];
  if (opts.remaining) args.push('--remaining');
  if (opts.lang) args.push('--lang', opts.lang);
  // `node "<path>" statusline` runs the same in Git Bash, PowerShell, cmd, bash and zsh.
  return `node "${cli}" ${args.join(' ')}`;
}

/** Ours if it is the exact command we wrote last time, or if it points to a claude-jauge install. */
export function isOurs(setting: unknown, installedCommand?: string): boolean {
  const cmd = (setting as StatusLineSetting | undefined)?.command;
  if (typeof cmd !== 'string') return false;
  if (installedCommand && cmd === installedCommand) return true;
  return cmd.includes(MARKER) && /\bstatusline\b/.test(cmd);
}

export function install(o: InstallOptions): InstallResult {
  const env = o.env ?? process.env;
  const file = settingsFile(env);
  const now = o.now ?? new Date();
  const { data } = readJson(file);
  if (!data) return { ok: false, reason: 'bad-json', settingsFile: file };
  const existing = data.statusLine as StatusLineSetting | undefined;
  const stateFile = installStateFile(env);
  const oldState = readJson(stateFile).data as Partial<InstallState> | undefined;
  const ours = isOurs(existing, oldState?.command);
  if (existing && !ours && !o.force) {
    return { ok: false, reason: 'foreign', settingsFile: file, existing: String(existing.command ?? JSON.stringify(existing)) };
  }

  copyApp(o.sourceDir, appDir(env));
  const command = buildCommand(env, o);
  const backup = backupFile(file, now);

  // Keep the original "previous" across re-installs so uninstall restores what the user really had.
  const previous: StatusLineSetting | null = ours ? (oldState?.previous ?? null) : (existing ?? null);

  const next: StatusLineSetting = { type: 'command', command, padding: 0 };
  data.statusLine = next;
  writeJsonAtomic(file, data);
  const state: InstallState = { installedAt: now.toISOString(), settingsFile: file, command, previous };
  writeJsonAtomic(stateFile, state);
  return { ok: true, settingsFile: file, backup, command };
}

export function uninstall(o: { env?: Env; now?: Date } = {}): UninstallResult {
  const env = o.env ?? process.env;
  const file = settingsFile(env);
  const now = o.now ?? new Date();
  const { data } = readJson(file);
  if (!data) return { ok: false, reason: 'bad-json', settingsFile: file };
  const state = readJson(installStateFile(env)).data as Partial<InstallState> | undefined;
  if (!isOurs(data.statusLine, state?.command)) return { ok: false, reason: 'not-installed', settingsFile: file };
  const backup = backupFile(file, now)!;
  let restored: string | undefined;
  if (state?.previous && typeof state.previous === 'object') {
    data.statusLine = state.previous;
    restored = String(state.previous.command ?? '');
  } else {
    delete data.statusLine;
  }
  writeJsonAtomic(file, data);
  fs.rmSync(installStateFile(env), { force: true });
  fs.rmSync(appDir(env), { recursive: true, force: true });
  return { ok: true, settingsFile: file, backup, restored };
}
