import http from 'node:http';
import { computeState, forecastText } from './gauges.js';
import { readHistory } from './history.js';
import { t, type Lang } from './i18n.js';
import { duration, shortWhen } from './format.js';
import { renderPage } from './page.js';
import { aggregate } from './report.js';
import { loadUsage } from './sessions.js';

export interface DashboardOptions {
  lang: Lang;
  historyFile: string;
  projectsDir: string;
  days: number;
  timeZone?: string;
}

export async function buildData(o: DashboardOptions, nowSec = Math.floor(Date.now() / 1000)) {
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
        reset: s.reset,
        resetText: w.hasReset
          ? t(o.lang, 'windowReset', { time: shortWhen(s.reset, nowSec, fo) })
          : t(o.lang, 'resetLong', { time: shortWhen(s.reset, nowSec, fo), in: duration(s.reset - nowSec, o.lang) }),
        forecastKind: w.hasReset ? 'unknown' : w.forecast.kind,
        forecastText: w.hasReset ? '' : forecastText(w.forecast, nowSec, o.lang, o.timeZone),
      };
    });
  const records = await loadUsage(o.projectsDir, sinceSec * 1000);
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
    daily: aggregate(records, 'day', o.timeZone),
    models: aggregate(records, 'model', o.timeZone),
  };
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
  let cache: { at: number; body: string } | undefined;
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
      } else if (url.pathname === '/api/data') {
        // Session files can be large: recompute at most every 20 s.
        if (!cache || Date.now() - cache.at > 20_000) cache = { at: Date.now(), body: JSON.stringify(await buildData(o)) };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS }).end(cache.body);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String((e as Error).message ?? e));
    }
  });
}
