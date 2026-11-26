import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

/**
 * One assistant reply from a Claude Code session file (~/.claude/projects/<project>/<session>.jsonl).
 * Only the token counters, the model and the date are kept: never the content of messages.
 */
export interface UsageRecord {
  /** Epoch milliseconds. */
  ts: number;
  model: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Returns the record and a de-duplication key (the same reply can be logged several times while streaming). */
export function parseSessionLine(line: string): { key?: string; rec: UsageRecord } | undefined {
  // Cheap pre-filter: most lines are user messages or tool results.
  if (!line.includes('"usage"')) return undefined;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const msg = raw.message as Record<string, unknown> | undefined;
  if (!msg || typeof msg !== 'object') return undefined;
  const usage = msg.usage as Record<string, unknown> | undefined;
  if (!usage || typeof usage !== 'object') return undefined;
  const ts = Date.parse(String(raw.timestamp ?? ''));
  if (!Number.isFinite(ts)) return undefined;
  const model = typeof msg.model === 'string' && msg.model ? msg.model : 'unknown';
  if (model === '<synthetic>') return undefined;
  const rec: UsageRecord = {
    ts,
    model,
    input: num(usage.input_tokens),
    output: num(usage.output_tokens),
    cacheWrite: num(usage.cache_creation_input_tokens),
    cacheRead: num(usage.cache_read_input_tokens),
  };
  if (rec.input + rec.output + rec.cacheWrite + rec.cacheRead === 0) return undefined;
  const id = typeof msg.id === 'string' ? msg.id : '';
  const req = typeof raw.requestId === 'string' ? raw.requestId : '';
  return { key: id || req ? `${id}:${req}` : undefined, rec };
}

/** Recursively lists *.jsonl files. Symlinks are not followed. */
export function listJsonl(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
    }
  }
  return out.sort();
}

/** Reads all session files (read only, streamed line by line). `sinceMs` skips older records and files. */
export async function loadUsage(projectsDir: string, sinceMs = 0): Promise<UsageRecord[]> {
  const seen = new Set<string>();
  const records: UsageRecord[] = [];
  for (const file of listJsonl(projectsDir)) {
    try {
      if (sinceMs && fs.statSync(file).mtimeMs < sinceMs) continue;
    } catch {
      continue;
    }
    const stream = fs.createReadStream(file, { encoding: 'utf8', flags: 'r' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        const parsed = parseSessionLine(line);
        if (!parsed || parsed.rec.ts < sinceMs) continue;
        if (parsed.key) {
          if (seen.has(parsed.key)) continue;
          seen.add(parsed.key);
        }
        records.push(parsed.rec);
      }
    } catch {
      // Unreadable file (locked, deleted while reading): skip it.
    } finally {
      rl.close();
      stream.destroy();
    }
  }
  records.sort((a, b) => a.ts - b.ts);
  return records;
}
