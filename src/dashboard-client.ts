/// <reference lib="dom" />
/**
 * The dashboard's browser code, shared by the two ways to open it:
 * - `claude-jauge web` inlines this function in its page (see page.ts) and feeds it from its local API;
 * - the Windows app imports it and feeds it through Tauri commands, so no Node and no server are needed.
 * It must stay self-contained (no import used inside), because page.ts serialises it with toString().
 */

export interface DashboardGauge {
  key: 'five' | 'week';
  used: number;
  level: 'normal' | 'warning' | 'critical';
  resetText: string;
  forecastKind: string;
  forecastText: string;
}

export interface DashboardLimits {
  updatedText: string;
  gauges: DashboardGauge[];
  history: { t: number; five?: { pct: number; reset: number }; week?: { pct: number; reset: number } }[];
}

export interface DashboardTokens {
  daily: { key: string; total: number; models: Record<string, number> }[];
  models: { key: string; total: number }[];
}

export interface DashboardTexts {
  five: string;
  week: string;
  left: string;
  used: string;
  levels: Record<'normal' | 'warning' | 'critical', string>;
  noData: string;
  noHistory: string;
  readingSessions: string;
  usageChart: string;
  tokensChart: string;
  model: string;
  tokens: string;
  share: string;
  empty: string;
  other: string;
}

export interface DashboardConfig {
  /** Texts of the page, in the user's language (pageStrings in page.ts). */
  S: DashboardTexts;
  locale: string;
  th: { warning: number; critical: number };
  limits: () => Promise<DashboardLimits>;
  tokens: () => Promise<DashboardTokens>;
}

export function startDashboard(cfg: DashboardConfig): void {
  const S = cfg.S;
  const LOCALE = cfg.locale;
  const TH = cfg.th;
  const ICONS: Record<string, string> = {
    normal:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 10"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/></svg>',
    critical:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16.5h.01"/></svg>',
  };
  const byId = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
  const root = document.documentElement;
  try {
    const th = localStorage.getItem('claude-jauge-theme');
    if (th) root.dataset.theme = th;
  } catch {
    // storage can be unavailable: keep the system theme
  }
  byId('theme').onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try {
      localStorage.setItem('claude-jauge-theme', root.dataset.theme);
    } catch {
      // the choice simply is not remembered
    }
  };
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }
  const esc = (x: unknown): string =>
    String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  const nf = new Intl.NumberFormat(LOCALE);
  const cf = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
  const pctTxt = (v: number): string => (LOCALE === 'fr-FR' ? Math.round(v) + ' %' : Math.round(v) + '%');
  const shareTxt = (v: number): string => (v > 0 && v < 1 ? (LOCALE === 'fr-FR' ? '<1 %' : '<1%') : pctTxt(v));
  const tip = byId('tip');
  function showTip(ev: MouseEvent, html: string): void {
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.left = ev.clientX + 14 + 'px';
    tip.style.top = ev.clientY + 14 + 'px';
  }
  function hideTip(): void {
    tip.style.display = 'none';
  }

  function gauges(d: DashboardLimits): void {
    const box = byId('gauges');
    box.innerHTML = '';
    if (!d.gauges.length) {
      box.innerHTML = '<div class="card glass">' + esc(S.noData) + '</div>';
      return;
    }
    for (const g of d.gauges) {
      const used = g.used;
      const left = 100 - used;
      const lv = g.level;
      box.insertAdjacentHTML(
        'beforeend',
        '<article class="card glass" style="--lv:var(--' + lv + ')">' +
          '<div class="gauge-top"><h2>' + esc(g.key === 'five' ? S.five : S.week) + '</h2><span class="badge">' + ICONS[lv] + esc(S.levels[lv]) + '</span></div>' +
          '<div class="big">' + pctTxt(left) + '<span>' + esc(S.left) + '</span></div>' +
          '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(left) + '"><div class="fill" style="width:' + Math.max(0, Math.min(100, left)) + '%"></div></div>' +
          '<div class="meta"><b>' + pctTxt(used) + '</b> ' + esc(S.used) + ' · ' + esc(g.resetText) + '</div>' +
          (g.forecastText ? '<div class="fc' + (g.forecastKind === 'hit' || g.forecastKind === 'reached' ? ' alert' : '') + '">' + esc(g.forecastText) + '</div>' : '') +
          '</article>',
      );
    }
  }

  function usageChart(d: DashboardLimits): void {
    const box = byId('usage');
    box.innerHTML = '';
    const pts = d.history;
    if (pts.length < 2) {
      box.innerHTML = '<p class="meta">' + esc(S.noHistory) + '</p>';
      return;
    }
    const W = 900, H = 260, L = 40, R = 12, T = 12, B = 28;
    const svg = el('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': S.usageChart }, box);
    const t0 = pts[0]!.t;
    const t1 = Math.max(pts[pts.length - 1]!.t, t0 + 1);
    const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
    const y = (v: number) => T + (1 - v / 100) * (H - T - B);
    el('rect', { x: L, y: y(100), width: W - L - R, height: y(TH.critical) - y(100), fill: 'var(--critical)', opacity: 0.07 }, svg);
    el('rect', { x: L, y: y(TH.critical), width: W - L - R, height: y(TH.warning) - y(TH.critical), fill: 'var(--warning)', opacity: 0.06 }, svg);
    for (const v of [0, 25, 50, 75, 100]) {
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: 'var(--grid)', 'stroke-width': 1 }, svg);
      el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v + '%';
    }
    const span = t1 - t0;
    const fmt = new Intl.DateTimeFormat(LOCALE, span > 2 * 86400 ? { weekday: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' });
    for (let i = 0; i <= 5; i++) {
      const t = t0 + (span * i) / 5;
      el('text', { x: x(t), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === 5 ? 'end' : 'middle' }, svg).textContent = fmt.format(new Date(t * 1000));
    }
    const series: ['five' | 'week', string, string][] = [
      ['five', 'var(--s1)', S.five],
      ['week', 'var(--s2)', S.week],
    ];
    for (const [k, color] of series) {
      let dPath = '';
      let prevReset: number | null = null;
      for (const p of pts) {
        const s = p[k];
        if (!s) {
          prevReset = null;
          continue;
        }
        const cmd = prevReset === null || Math.abs(s.reset - prevReset) > 120 ? 'M' : 'L';
        dPath += cmd + x(p.t).toFixed(1) + ' ' + y(s.pct).toFixed(1) + ' ';
        prevReset = s.reset;
      }
      if (dPath) el('path', { d: dPath, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    }
    const hover = el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' }, svg);
    const guide = el('line', { y1: T, y2: H - B, stroke: 'var(--muted)', 'stroke-dasharray': '3 3', visibility: 'hidden' }, svg);
    const df = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    hover.addEventListener('mousemove', (ev) => {
      const e = ev as MouseEvent;
      const r = svg.getBoundingClientRect();
      const tx = t0 + (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * (t1 - t0);
      let best = pts[0]!;
      for (const p of pts) if (Math.abs(p.t - tx) < Math.abs(best.t - tx)) best = p;
      guide.setAttribute('x1', String(x(best.t)));
      guide.setAttribute('x2', String(x(best.t)));
      guide.setAttribute('visibility', 'visible');
      showTip(
        e,
        esc(df.format(new Date(best.t * 1000))) + '<br>' +
          (best.five ? esc(S.five) + ' : ' + pctTxt(best.five.pct) + '<br>' : '') +
          (best.week ? esc(S.week) + ' : ' + pctTxt(best.week.pct) : ''),
      );
    });
    hover.addEventListener('mouseleave', () => {
      guide.setAttribute('visibility', 'hidden');
      hideTip();
    });
    box.insertAdjacentHTML('beforeend', '<div class="legend">' + series.map((s) => '<span><i style="background:' + s[1] + '"></i>' + esc(s[2]) + '</span>').join('') + '</div>');
  }

  function tokenChart(d: DashboardTokens): void {
    const box = byId('tokens');
    box.innerHTML = '';
    const rows = d.daily;
    if (!rows.length) {
      box.innerHTML = '<p class="meta">' + esc(S.empty) + '</p>';
      return;
    }
    const top = d.models.slice(0, 4).map((m) => m.key);
    const colors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
    const hasOther = d.models.length > top.length;
    const keys = hasOther ? [...top, S.other] : top;
    const W = 900, H = 240, L = 48, R = 8, T = 10, B = 28;
    const svg = el('svg', { class: 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': S.tokensChart }, box);
    const max = Math.max(...rows.map((r) => r.total), 1);
    const y = (v: number) => T + (1 - v / max) * (H - T - B);
    for (const f of [0, 0.5, 1]) {
      el('line', { x1: L, x2: W - R, y1: y(max * f), y2: y(max * f), stroke: 'var(--grid)' }, svg);
      el('text', { x: L - 6, y: y(max * f) + 4, 'text-anchor': 'end' }, svg).textContent = cf.format(max * f);
    }
    const bw = (W - L - R) / rows.length;
    const gap = Math.min(8, bw * 0.25);
    const dfmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    rows.forEach((r, i) => {
      let acc = 0;
      const x0 = L + i * bw + gap / 2;
      const parts: [string, number, string][] = keys.map((k, j) => {
        const v = j < top.length ? r.models[k] || 0 : Object.entries(r.models).filter(([m]) => !top.includes(m)).reduce((a, [, n]) => a + n, 0);
        return [k, v, colors[j]!];
      });
      const visible = parts.filter((p) => p[1]);
      visible.forEach(([, v, c], j) => {
        const h = ((H - T - B) * v) / max;
        el('rect', { x: x0, y: y(acc) - h, width: Math.max(1, bw - gap), height: h, fill: c, rx: j === visible.length - 1 ? 4 : 0 }, svg);
        acc += v;
      });
      const hit = el('rect', { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: 'transparent' }, svg);
      const [yy, mm, dd] = r.key.split('-').map(Number) as [number, number, number];
      const label = dfmt.format(new Date(Date.UTC(yy, mm - 1, dd)));
      hit.addEventListener('mousemove', (ev) =>
        showTip(ev as MouseEvent, '<b>' + esc(label) + '</b> · ' + nf.format(r.total) + '<br>' + visible.map((p) => esc(p[0]) + ' : ' + cf.format(p[1])).join('<br>')),
      );
      hit.addEventListener('mouseleave', hideTip);
      if (rows.length <= 16 || i % Math.ceil(rows.length / 12) === 0) {
        el('text', { x: L + i * bw + bw / 2, y: H - 8, 'text-anchor': 'middle' }, svg).textContent = label;
      }
    });
    box.insertAdjacentHTML('beforeend', '<div class="legend">' + keys.map((k, j) => '<span><i style="background:' + colors[j] + '"></i>' + esc(k) + '</span>').join('') + '</div>');
  }

  function modelTable(d: DashboardTokens): void {
    const box = byId('models');
    if (!d.models.length) {
      box.innerHTML = '<p class="meta">' + esc(S.empty) + '</p>';
      return;
    }
    const total = d.models.reduce((a, m) => a + m.total, 0) || 1;
    box.innerHTML =
      '<table><thead><tr><th>' + esc(S.model) + '</th><th>' + esc(S.tokens) + '</th><th>' + esc(S.share) + '</th></tr></thead><tbody>' +
      d.models.map((m) => '<tr><td>' + esc(m.key) + '</td><td>' + nf.format(m.total) + '</td><td>' + shareTxt((m.total / total) * 100) + '</td></tr>').join('') +
      '</tbody></table>';
  }

  for (const id of ['tokens', 'models']) {
    const b = byId(id);
    if (!b.firstChild) b.innerHTML = '<p class="meta">' + esc(S.readingSessions) + '</p>';
  }
  async function loadLimits(): Promise<void> {
    try {
      const d = await cfg.limits();
      gauges(d);
      usageChart(d);
      byId('upd').textContent = d.updatedText || '';
    } catch {
      byId('upd').textContent = '';
    }
  }
  async function loadTokens(): Promise<void> {
    try {
      const d = await cfg.tokens();
      tokenChart(d);
      modelTable(d);
    } catch {
      // keep the previous charts
    }
  }
  void loadLimits();
  void loadTokens();
  setInterval(() => void loadLimits(), 30000);
  setInterval(() => void loadTokens(), 60000);
}
