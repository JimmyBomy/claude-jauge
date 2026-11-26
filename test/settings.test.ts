import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommand, install, isOurs, uninstall } from '../src/settings.js';
import { fixture, rm, tmpDir } from './helpers.js';

const SOURCE = path.dirname(fileURLToPath(new URL('../src/cli.js', import.meta.url)));

function setup(t: { after: (fn: () => void) => void }, settings?: string) {
  const root = tmpDir();
  t.after(() => rm(root));
  const claude = path.join(root, 'claude');
  fs.mkdirSync(claude, { recursive: true });
  if (settings !== undefined) fs.writeFileSync(path.join(claude, 'settings.json'), settings);
  const env = { CLAUDE_CONFIG_DIR: claude, CLAUDE_JAUGE_HOME: path.join(root, 'jauge') };
  const read = () => JSON.parse(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8')) as Record<string, any>;
  return { root, claude, env, read };
}

const now = new Date('2026-11-26T06:00:00Z');

test('install keeps other settings, makes a backup and copies the app', (t) => {
  const { env, read, claude } = setup(t, fs.readFileSync(fixture('claude', 'settings.json'), 'utf8'));
  const res = install({ env, sourceDir: SOURCE, now });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const s = read();
  assert.equal(s.model, 'sonnet');
  assert.deepEqual(s.permissions, { allow: ['Bash(npm test)'] });
  assert.equal(s.statusLine.type, 'command');
  assert.equal(s.statusLine.command, buildCommand(env, {}));
  assert.ok(!s.statusLine.command.includes('\\'), 'forward slashes only (Git Bash on Windows)');
  assert.match(s.statusLine.command, /^node ".+\/app\/cli\.js" statusline$/);
  assert.ok(res.backup && fs.existsSync(res.backup));
  assert.equal(path.dirname(res.backup), claude);
  assert.ok(fs.existsSync(path.join(env.CLAUDE_JAUGE_HOME, 'app', 'cli.js')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(env.CLAUDE_JAUGE_HOME, 'app', 'package.json'), 'utf8')).type, 'module');
});

test('install works without any settings.json', (t) => {
  const { env, read } = setup(t);
  const res = install({ env, sourceDir: SOURCE, now, remaining: true, lang: 'fr' });
  assert.equal(res.ok, true);
  assert.equal(res.ok && res.backup, undefined);
  assert.match(read().statusLine.command, /statusline --remaining --lang fr$/);
});

test('install refuses invalid JSON and leaves the file untouched', (t) => {
  const { env, claude } = setup(t, '{ "model": "sonnet", }');
  const res = install({ env, sourceDir: SOURCE, now });
  assert.deepEqual(res, { ok: false, reason: 'bad-json', settingsFile: path.join(claude, 'settings.json') });
  assert.equal(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8'), '{ "model": "sonnet", }');
});

test('an existing status line needs --force and comes back on uninstall', (t) => {
  const mine = { type: 'command', command: '~/.claude/my-line.sh', padding: 1 };
  const { env, read } = setup(t, JSON.stringify({ statusLine: mine }));
  const refused = install({ env, sourceDir: SOURCE, now });
  assert.equal(refused.ok, false);
  assert.equal(!refused.ok && refused.reason, 'foreign');
  assert.deepEqual(read().statusLine, mine);

  assert.equal(install({ env, sourceDir: SOURCE, now, force: true }).ok, true);
  // Re-installing must not forget the original line.
  assert.equal(install({ env, sourceDir: SOURCE, now: new Date(now.getTime() + 1000) }).ok, true);
  assert.ok(isOurs(read().statusLine));

  const res = uninstall({ env, now: new Date(now.getTime() + 2000) });
  assert.equal(res.ok, true);
  assert.equal(res.ok && res.restored, mine.command);
  assert.deepEqual(read().statusLine, mine);
  assert.equal(fs.existsSync(path.join(env.CLAUDE_JAUGE_HOME, 'app')), false);
});

test('uninstall removes the key when there was nothing before', (t) => {
  const { env, read } = setup(t, '{"model":"opus"}');
  install({ env, sourceDir: SOURCE, now });
  const res = uninstall({ env, now: new Date(now.getTime() + 1000) });
  assert.equal(res.ok, true);
  assert.deepEqual(read(), { model: 'opus' });
});

test('uninstall does nothing when not installed', (t) => {
  const { env, read } = setup(t, '{"statusLine":{"type":"command","command":"echo hi"}}');
  const res = uninstall({ env, now });
  assert.equal(res.ok, false);
  assert.equal(read().statusLine.command, 'echo hi');
});

test('isOurs', () => {
  assert.equal(isOurs({ command: 'node "C:/Users/demo/.claude-jauge/app/cli.js" statusline' }), true);
  assert.equal(isOurs({ command: 'npx -y claude-jauge statusline' }), true);
  assert.equal(isOurs({ command: 'npx ccusage statusline' }), false);
  assert.equal(isOurs({ command: 'node /x/y.js statusline' }, 'node /x/y.js statusline'), true);
  assert.equal(isOurs(undefined), false);
});
