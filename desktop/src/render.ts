import type { WidgetView, WidgetWindow } from '../../src/widget-model.js';

const ICONS = {
  normal:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 10"/></svg>',
  warning:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/></svg>',
  critical:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16.5h.01"/></svg>',
} as const;

const HIDE = { fr: 'Masquer', en: 'Hide' } as const;
const LEFT = { fr: 'restant', en: 'left' } as const;

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function gauge(w: WidgetWindow, lang: 'fr' | 'en'): string {
  const used = Math.min(100, Math.max(0, w.usedPct));
  return `<section class="gauge" style="--lv:var(--${w.level})">
  <div class="row">
    <span class="label">${esc(w.label)}</span>
    <span class="badge">${ICONS[w.level]}${esc(w.levelLabel)}</span>
  </div>
  <div class="row value">
    <span class="big">${esc(w.leftText)}</span><span class="left">${LEFT[lang]}</span>
    <span class="reset">${esc(w.resetText)}</span>
  </div>
  <div class="track" role="progressbar" aria-label="${esc(w.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(used)}">
    <div class="fill" style="width:${used}%"></div>
  </div>
  ${w.alertText ? `<div class="alert">${esc(w.alertText)}</div>` : ''}
</section>`;
}

/** The widget markup. Every text comes from the pure view model and is escaped. */
export function renderWidget(v: WidgetView): string {
  const body = v.emptyText ? `<p class="empty">${esc(v.emptyText)}</p>` : v.windows.map((w) => gauge(w, v.lang)).join('');
  const footer =
    v.todayText !== undefined
      ? `<footer><span>${esc(v.todayText)}</span>${v.topModelText ? `<span class="muted">${esc(v.topModelText)}</span>` : ''}</footer>`
      : '';
  return `<div class="glass">
  <header>
    <span class="mark" aria-hidden="true"><i></i></span>
    <span class="title">claude-jauge</span>
    <span class="updated${v.stale ? ' stale' : ''}">${esc(v.updatedText)}</span>
    <button type="button" data-action="hide" aria-label="${HIDE[v.lang]}" title="${HIDE[v.lang]}">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
  </header>
  ${body}
  ${footer}
</div>`;
}
