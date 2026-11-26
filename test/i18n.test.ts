import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLang, messages, normalizeLang, t } from '../src/i18n.js';

test('normalizeLang', () => {
  assert.equal(normalizeLang('fr_FR.UTF-8'), 'fr');
  assert.equal(normalizeLang('FR'), 'fr');
  assert.equal(normalizeLang('en-GB'), 'en');
  assert.equal(normalizeLang('de_DE'), undefined);
  assert.equal(normalizeLang(undefined), undefined);
});

test('detectLang: flag wins, then env, then OS locale, then English', () => {
  assert.equal(detectLang('en', { LANG: 'fr_FR.UTF-8' }, 'fr-FR'), 'en');
  assert.equal(detectLang(undefined, { CLAUDE_JAUGE_LANG: 'fr', LANG: 'en_US' }, 'en-US'), 'fr');
  assert.equal(detectLang(undefined, { LANG: 'fr_CA.UTF-8' }, 'en-US'), 'fr');
  assert.equal(detectLang(undefined, { LC_ALL: 'C.UTF-8', LANG: 'C' }, 'fr-FR'), 'fr');
  assert.equal(detectLang(undefined, {}, 'fr-BE'), 'fr'); // Windows: no LANG, Intl gives the OS locale
  assert.equal(detectLang(undefined, {}, 'ja-JP'), 'en');
  assert.equal(detectLang('xx', {}, 'de-DE'), 'en');
});

test('both languages define the same keys', () => {
  assert.deepEqual(Object.keys(messages.fr).sort(), Object.keys(messages.en).sort());
});

test('t interpolates and keeps unknown placeholders', () => {
  assert.equal(t('fr', 'forecastHit', { time: '16:00' }), 'à ce rythme, limite atteinte vers 16:00');
  assert.equal(t('en', 'forecastHit'), 'at this pace, limit reached around {time}');
});
