// Generates INVENTED demo data (history + fake session files) for screenshots.
// Usage: node scripts/demo-data.mjs <folder>
// Then: CLAUDE_JAUGE_HOME=<folder>/jauge CLAUDE_CONFIG_DIR=<folder>/claude npx claude-jauge web
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'demo');
const jauge = path.join(root, 'jauge');
const projects = path.join(root, 'claude', 'projects', '-demo-project');
fs.mkdirSync(jauge, { recursive: true });
fs.mkdirSync(projects, { recursive: true });

let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const now = Math.floor(Date.now() / 1000);
const start = now - 6 * 86400;
const weekReset = now + 86400 + 9 * 3600;
const lines = [];
let fiveReset = start + 5 * 3600;
let five = 0;
let week = 4;
for (let t = start; t <= now; t += 600) {
  const hour = new Date(t * 1000).getHours();
  const active = (now - t < 2 * 3600) || (hour >= 9 && hour < 19 && rnd() > 0.25);
  if (t >= fiveReset) {
    fiveReset = t + 5 * 3600;
    five = 0;
  }
  if (!active) continue;
  const inc = 1 + rnd() * 3.2;
  five = Math.min(100, five + inc);
  week = Math.min(100, week + inc * 0.09);
  lines.push(JSON.stringify({ t, five: { pct: +five.toFixed(1), reset: fiveReset }, week: { pct: +week.toFixed(1), reset: weekReset } }));
}
fs.writeFileSync(path.join(jauge, 'historique.jsonl'), lines.join('\n') + '\n');

const models = ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-haiku-4-5-20251001'];
const sess = [];
for (let d = 13; d >= 0; d--) {
  const n = 20 + Math.floor(rnd() * 60);
  for (let i = 0; i < n; i++) {
    const ts = new Date((now - d * 86400 - Math.floor(rnd() * 8 * 3600)) * 1000).toISOString();
    const model = models[rnd() < 0.6 ? 0 : rnd() < 0.7 ? 1 : 2];
    sess.push(JSON.stringify({
      type: 'assistant', timestamp: ts, requestId: `req_demo_${d}_${i}`,
      message: { id: `msg_demo_${d}_${i}`, model, usage: {
        input_tokens: Math.floor(rnd() * 3000), output_tokens: Math.floor(rnd() * 2500),
        cache_creation_input_tokens: Math.floor(rnd() * 8000), cache_read_input_tokens: Math.floor(rnd() * 60000) } },
    }));
  }
}
fs.writeFileSync(path.join(projects, 'demo-session.jsonl'), sess.join('\n') + '\n');
console.log(`Demo data written to ${root}`);
