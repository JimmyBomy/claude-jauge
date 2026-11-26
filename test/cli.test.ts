import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../src/cli.js';
import { VERSION } from '../src/version.js';
import { readFixture, fixture, rm, tmpDir } from './helpers.js';

const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const PKG = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as { version: string };

function run(args: string[], env: Record<string, string>, input?: string) {
  return spawnSync(process.execPath, [CLI, ...args], {
    input,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', LANG: 'en_US.UTF-8', CLAUDE_JAUGE_LANG: '', LC_ALL: '', ...env },
  });
}

test('version matches package.json', () => {
  assert.equal(VERSION, PKG.version);
});

test('parseArgs', () => {
  assert.deepEqual(parseArgs([]), { command: 'gauges', flags: {} });
  assert.deepEqual(parseArgs(['rapport', '--jours', '7', '--json']), { command: 'rapport', flags: { jours: '7', json: true } });
  assert.deepEqual(parseArgs(['web', '--port=5000', '--lang', 'fr', '--open']), { command: 'web', flags: { port: '5000', lang: 'fr', open: true } });
  assert.deepEqual(parseArgs(['-h']), { command: 'gauges', flags: { help: true } });
});

test('cli: help, version, unknown command', () => {
  const help = run(['--help', '--lang', 'fr'], {});
  assert.equal(help.status, 0);
  assert.match(help.stdout, /npx claude-jauge install/);
  assert.match(help.stdout, /Rien n'est envoyé sur Internet/);
  assert.equal(run(['--version'], {}).stdout.trim(), VERSION);
  const bad = run(['nope'], {});
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Unknown command: nope/);
});

test('cli: statusline end to end, then gauges and report', (t) => {
  const dir = tmpDir();
  t.after(() => rm(dir));
  const env = { CLAUDE_JAUGE_HOME: dir, CLAUDE_CONFIG_DIR: fixture('claude') };
  // Fixture resets are in the past for the real clock, so build a live input.
  const now = Math.floor(Date.now() / 1000);
  const input = JSON.parse(readFixture('statusline', 'full.json'));
  input.rate_limits.five_hour.resets_at = now + 3600;
  input.rate_limits.seven_day.resets_at = now + 3 * 86400;
  const sl = run(['statusline'], env, JSON.stringify(input));
  assert.equal(sl.status, 0);
  assert.match(sl.stdout, /^5h: 62% \(reset .+\) · week: 38% \(reset .+\)\n$/);
  assert.equal(fs.readFileSync(path.join(dir, 'historique.jsonl'), 'utf8').trim().split('\n').length, 1);

  const empty = run(['statusline'], env, 'garbage');
  assert.equal(empty.status, 0);
  assert.match(empty.stdout, /limits: not received yet/);

  const g = run(['--lang', 'fr'], env);
  assert.equal(g.status, 0);
  assert.match(g.stdout, /62 % utilisé · 38 % restant/);

  const json = JSON.parse(run(['--json'], env).stdout);
  assert.equal(json.windows[0].sample.pct, 62.4);

  const rep = run(['report', '--days', '3650', '--by', 'model'], env);
  assert.equal(rep.status, 0);
  assert.match(rep.stdout, /Tokens by model/);
  assert.match(rep.stdout, /sonnet-4-5/);
  const repJson = JSON.parse(run(['rapport', '--jours', '3650', '--json'], env).stdout);
  assert.equal(repJson.total.total, 45400);
});
