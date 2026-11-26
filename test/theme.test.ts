import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, cssVars, levelOf, palettes, worstContrast } from '../src/theme.js';
import { levelColor } from '../src/format.js';

test('levels: normal under 50 %, warning from 50 %, critical from 80 %', () => {
  assert.equal(levelOf(0), 'normal');
  assert.equal(levelOf(49.9), 'normal');
  assert.equal(levelOf(50), 'warning');
  assert.equal(levelOf(79.9), 'warning');
  assert.equal(levelOf(80), 'critical');
  assert.equal(levelColor(85), 'red');
});

test('contrast helper matches known WCAG values', () => {
  assert.equal(Math.round(contrast([0, 0, 0], [255, 255, 255])), 21);
  assert.equal(contrast([10, 10, 10], [10, 10, 10]), 1);
});

for (const [name, p] of Object.entries(palettes)) {
  test(`${name} theme: text stays readable (WCAG AA 4.5:1) on any wallpaper`, () => {
    for (const [label, color] of [
      ['ink', p.ink],
      ['muted', p.muted],
      ['normal', p.levels.normal],
      ['warning', p.levels.warning],
      ['critical', p.levels.critical],
    ] as const) {
      const ratio = worstContrast(p, color);
      assert.ok(ratio >= 4.5, `${name}/${label} ${color}: ${ratio.toFixed(2)}`);
    }
  });
}

test('cssVars exposes every token', () => {
  const css = cssVars(palettes.dark);
  for (const v of ['--card', '--ink', '--muted', '--track', '--normal', '--warning', '--critical', '--s1', '--s5']) {
    assert.ok(css.includes(v + ':'), v);
  }
});
