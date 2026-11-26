// Runs every compiled test file with node:test. Avoids shell globs so it works the same on Windows.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../dist/test', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).map((f) => join(dir, f));
const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status ?? 1);
