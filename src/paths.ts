import os from 'node:os';
import path from 'node:path';

export type Env = Record<string, string | undefined>;

/** Claude Code config folder. Honors CLAUDE_CONFIG_DIR like Claude Code does. */
export function claudeDir(env: Env = process.env): string {
  const custom = env.CLAUDE_CONFIG_DIR?.trim();
  return custom ? path.resolve(custom) : path.join(os.homedir(), '.claude');
}

export function settingsFile(env: Env = process.env): string {
  return path.join(claudeDir(env), 'settings.json');
}

export function projectsDir(env: Env = process.env): string {
  return path.join(claudeDir(env), 'projects');
}

/** claude-jauge's own folder. CLAUDE_JAUGE_HOME overrides it (used by tests). */
export function jaugeDir(env: Env = process.env): string {
  const custom = env.CLAUDE_JAUGE_HOME?.trim();
  return custom ? path.resolve(custom) : path.join(os.homedir(), '.claude-jauge');
}

/** Proof of life of the status line, read by the desktop widget. */
export function seenFile(env: Env = process.env): string {
  return path.join(jaugeDir(env), 'statusline-vu.json');
}

export function historyFile(env: Env = process.env): string {
  return path.join(jaugeDir(env), 'historique.jsonl');
}

export function appDir(env: Env = process.env): string {
  return path.join(jaugeDir(env), 'app');
}

export function installStateFile(env: Env = process.env): string {
  return path.join(jaugeDir(env), 'install.json');
}

/** Forward slashes work in Git Bash, PowerShell, cmd and POSIX shells alike. */
export function toShellPath(p: string): string {
  return p.replace(/\\/g, '/');
}
