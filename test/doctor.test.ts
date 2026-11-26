import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { diagnose } from '../src/doctor.js';
import { NOW, rm, tmpDir } from './helpers.js';

function setup(t: { after: (fn: () => void) => void }) {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const env = { CLAUDE_CONFIG_DIR: path.join(dir, 'claude'), CLAUDE_JAUGE_HOME: path.join(dir, 'jauge') };
  fs.mkdirSync(env.CLAUDE_CONFIG_DIR, { recursive: true });
  fs.mkdirSync(env.CLAUDE_JAUGE_HOME, { recursive: true });
  const write = (rel: string, text: string) => fs.writeFileSync(path.join(dir, rel), text);
  return { env, write };
}

test('doctor: nothing installed tells to install', (t) => {
  const { env } = setup(t);
  const out = diagnose('en', NOW, env);
  assert.match(out.join('\n'), /✗ status line: not in/);
  assert.equal(out.at(-1), '→ Run "claude-jauge install" (or open the widget), then restart Claude Code.');
});

test('doctor: status line runs but Claude Code sends no limits points to the plan', (t) => {
  const { env, write } = setup(t);
  write('claude/settings.json', JSON.stringify({ statusLine: { type: 'command', command: 'C:/x/claude-jauge.exe statusline' } }));
  write('jauge/statusline-vu.json', JSON.stringify({ t: NOW - 120, limits: false }));
  const out = diagnose('fr', NOW, env).join('\n');
  assert.match(out, /✓ statusLine : C:\/x\/claude-jauge\.exe statusline/);
  assert.match(out, /SANS limites/);
  assert.match(out, /Pro ou Max/);
});

test('doctor: everything works', (t) => {
  const { env, write } = setup(t);
  write('claude/settings.json', JSON.stringify({ statusLine: { type: 'command', command: 'node "/h/.claude-jauge/app/cli.js" statusline' } }));
  write('jauge/statusline-vu.json', JSON.stringify({ t: NOW - 30, limits: true }));
  write('jauge/historique.jsonl', JSON.stringify({ t: NOW - 30, five: { pct: 10, reset: NOW + 3600 } }) + '\n');
  const out = diagnose('en', NOW, env);
  assert.equal(out.at(-1), '→ Everything works.');
  assert.equal(out.filter((l) => l.startsWith('✓')).length, 3);
});

test('doctor: a foreign status line and broken JSON are reported', (t) => {
  const { env, write } = setup(t);
  write('claude/settings.json', JSON.stringify({ statusLine: { type: 'command', command: '~/my-line.sh' } }));
  assert.match(diagnose('en', NOW, env).join('\n'), /another command is set \(~\/my-line\.sh\)[\s\S]*--force/);
  write('claude/settings.json', '{ oops');
  assert.match(diagnose('en', NOW, env).join('\n'), /invalid JSON/);
});
