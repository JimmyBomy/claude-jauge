import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** test/fixtures, resolved from dist/test at run time. */
export const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));

export function fixture(...parts: string[]): string {
  return path.join(FIXTURES, ...parts);
}

export function readFixture(...parts: string[]): string {
  return fs.readFileSync(fixture(...parts), 'utf8');
}

/** Fresh temp folder, removed by the caller (t.after). */
export function tmpDir(prefix = 'claude-jauge-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function rm(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** 2026-11-26T06:00:00Z, the "now" used across tests. */
export const NOW = 1795672800;
export const TZ = 'Europe/Paris';
