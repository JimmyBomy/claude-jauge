import http from 'node:http';
import { computeState, forecastText } from './gauges.js';
import { readHistory } from './history.js';
import { t, type Lang } from './i18n.js';
import { duration, shortWhen } from './format.js';
import { renderPage } from './page.js';
import { levelOf } from './theme.js';
import { aggregate } from './report.js';
import { loadUsage } from './sessions.js';

export interface DashboardOptions {
  lang: Lang;
  historyFile: string;
  projectsDir: string;
  days: number;
  timeZone?: string;
}

/** Limits and their history: only reads the small claude-jauge history file, so it is instant. */
export function buildLimits(o: DashboardOptions, nowSec = Math.floor(Date.now() / 1000)) {
  const sinceSec = nowSec - o.days * 86400;
  const points = readHistory(o.historyFile);
  const state = computeState(points, nowSec);
  const fo = { lang: o.lang, timeZone: o.timeZone };
  const gauges = state.windows
    .filter((w) => w.sample)
    .map((w) => {
      const s = w.sample!;
      return {
        key: w.key,
        used: w.hasReset ? 0 : s.pct,
        level: levelOf(w.hasReset ? 0 : s.pct),
        reset: s.reset,
        resetText: w.hasReset
          ? t(o.lang, 'windowReset', { time: shortWhen(s.reset, nowSec, fo) })
          : t(o.lang, 'resetLong', { time: shortWhen(s.reset, nowSec, fo), in: duration(s.reset - nowSec, o.lang) }),
        forecastKind: w.hasReset ? 'unknown' : w.forecast.kind,
        forecastText: w.hasReset ? '' : forecastText(w.forecast, nowSec, o.lang, o.timeZone),
      };
    });
  const updatedText =
    state.updatedAt === undefined
      ? ''
      : nowSec - state.updatedAt < 60
        ? t(o.lang, 'updatedNow')
        : t(o.lang, 'updatedAgo', { ago: duration(nowSec - state.updatedAt, o.lang) });
  return {
    now: nowSec,
    lang: o.lang,
    updatedText,
    gauges,
    history: points.filter((p) => p.t >= sinceSec),
  };
}

/** Token totals from the Claude Code session files: can take a few seconds on a large history. */
export async function buildTokens(o: DashboardOptions, nowSec = Math.floor(Date.now() / 1000)) {
  const records = await loadUsage(o.projectsDir, (nowSec - o.days * 86400) * 1000);
  return {
    daily: aggregate(records, 'day', o.timeZone),
    models: aggregate(records, 'model', o.timeZone),
  };
}

/**
 * Keeps the token report in memory. The first computation starts with the server,
 * later requests get the cached value at once while a refresh runs in the background.
 */
export class TokenCache {
  private value?: string;
  private at = 0;
  private running?: Promise<string>;

  constructor(
    private readonly compute: () => Promise<unknown>,
    private readonly maxAgeMs = 30_000,
  ) {}

  refresh(): Promise<string> {
    this.running ??= this.compute()
      .then((v) => {
        this.value = JSON.stringify(v);
        this.at = Date.now();
        return this.value;
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }

  async get(): Promise<string> {
    if (this.value === undefined) return this.refresh();
    if (Date.now() - this.at > this.maxAgeMs) this.refresh().catch(() => undefined);
    return this.value;
  }
}

/** Only answer requests addressed to the loopback name we serve (blocks DNS rebinding). */
export function allowedHost(host: string | undefined, port: number): boolean {
  if (!host) return false;
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  // Page is fully inline; no network access except our own API.
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'",
};

export function createServer(o: DashboardOptions, port: number): http.Server {
  const tokens = new TokenCache(() => buildTokens(o));
  // Start reading the session files right away, before the browser asks for them.
  tokens.refresh().catch(() => undefined);
  const json = (res: http.ServerResponse, body: string) =>
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS }).end(body);
  return http.createServer(async (req, res) => {
    if (!allowedHost(req.headers.host, port)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' }).end();
      return;
    }
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    try {
      if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS }).end(renderPage(o.lang));
      } else if (url.pathname === '/api/limits') {
        json(res, JSON.stringify(buildLimits(o)));
      } else if (url.pathname === '/api/tokens') {
        json(res, await tokens.get());
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String((e as Error).message ?? e));
    }
  });
}
