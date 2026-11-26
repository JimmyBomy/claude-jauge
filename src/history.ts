import fs from 'node:fs';
import path from 'node:path';
import { parseHistory, parsePoint, type Point } from './points.js';

export * from './points.js';

/** At most one point per minute. */
export const MIN_INTERVAL_SEC = 60;
/** History older than this is dropped when the file gets big. */
export const KEEP_DAYS = 60;
const PRUNE_ABOVE_BYTES = 4 * 1024 * 1024;

/** All valid points, oldest first. Broken lines are skipped. */
export function readHistory(file: string): Point[] {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  return parseHistory(text);
}

/** Reads only the end of the file: the status line runs often and must stay fast. */
export function lastPoint(file: string): Point | undefined {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 8192);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const p = parsePoint(lines[i] ?? '');
      if (p) return p;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/**
 * Appends a point unless the last one is less than a minute old.
 * Exception: a window that just changed (new reset time) is always recorded,
 * so the start of a new window is never lost.
 * Returns true if the point was written.
 */
export function appendPoint(file: string, p: Point, minInterval = MIN_INTERVAL_SEC): boolean {
  const last = lastPoint(file);
  if (last) {
    const tooSoon = p.t - last.t < minInterval;
    const windowChanged =
      (p.five && last.five && Math.abs(p.five.reset - last.five.reset) >= 60) ||
      (p.week && last.week && Math.abs(p.week.reset - last.week.reset) >= 60);
    if (tooSoon && !windowChanged) return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(p) + '\n', 'utf8');
  pruneIfLarge(file, p.t);
  return true;
}

export function pruneIfLarge(file: string, nowSec: number, maxBytes = PRUNE_ABOVE_BYTES): void {
  try {
    if (fs.statSync(file).size <= maxBytes) return;
    const cutoff = nowSec - KEEP_DAYS * 86400;
    const kept = readHistory(file).filter((p) => p.t >= cutoff);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, kept.map((p) => JSON.stringify(p)).join('\n') + (kept.length ? '\n' : ''), 'utf8');
    fs.renameSync(tmp, file);
  } catch {
    // Pruning is best effort; never break the status line for it.
  }
}
