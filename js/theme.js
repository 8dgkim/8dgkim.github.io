/* ==========================================================================
   theme.js : theme registry, theme button, persistence
   Colors and typefaces are in css/themes.css under [data-theme]. This file holds what CSS cannot:
   the names and the order of the cycle, and the black hole's disk ramp, sky band, and star tints
   (disk, band, st; absent: the shader's first ramp). A 'themechange' event tells the rest of the page.
   An inline script in each page's <head> sets data-theme before the first paint, so there is no flash.
   ========================================================================== */
(function () {
'use strict';
const THEMES = {
  singularity: { name: 'Singularity', light: false, disk: [[0.7, 0.06, 0.06], [1.0, 0.28, 0.16], [1.0, 0.7, 0.58], [0.86, 0.91, 1.0]], band: [0.04, 0.05, 0.075], st: [[0.85, 0.9, 1.0], [1.0, 0.8, 0.75]] },
  starlight: { name: 'Starlight', light: true, disk: [[0.55, 0.4, 0.22], [0.93, 0.8, 0.55], [1.0, 0.96, 0.87], [0.92, 0.95, 1.0]], band: [0.026, 0.028, 0.04], st: [[1.0, 0.93, 0.8], [0.85, 0.9, 1.0]] },
  deepfield: { name: 'Deep Field', light: false },
  deathstar: { name: 'Death Star', light: false, disk: [[0.3, 0.31, 0.33], [0.62, 0.64, 0.67], [0.92, 0.93, 0.95], [1.0, 1.0, 1.0]], band: [0.02, 0.02, 0.022], st: [[1, 1, 1], [0.85, 0.87, 0.9]] },
  steel: { name: 'Cold Steel', light: false, disk: [[0.25, 0.3, 0.36], [0.52, 0.6, 0.68], [0.84, 0.89, 0.95], [0.97, 0.99, 1.0]], band: [0.026, 0.03, 0.036], st: [[0.9, 0.93, 1.0], [1, 0.95, 0.9]] },
};
const ORDER = Object.keys(THEMES), DEFAULT = 'singularity', KEY = 'theme';
const root = document.documentElement;
const store = { get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } } };

let theme = THEMES[root.dataset.theme] ? root.dataset.theme : DEFAULT;
let turn = null;   // the half-disk keeps turning the same way round, a fifth of a circle per step

function paintButton() {
  const b = document.querySelector('.theme-btn:not(.scene-btn):not(.lang-btn)'); if (!b) return;
  const i = ORDER.indexOf(theme), next = THEMES[ORDER[(i + 1) % ORDER.length]].name;
  if (turn === null) turn = i * 72;
  b.querySelector('.ti').style.transform = `rotate(${turn}deg)`;
  b.dataset.label = THEMES[theme].name;   // shown on hover (css/base.css)
  b.setAttribute('aria-label', `Theme: ${THEMES[theme].name}. Switch to ${next}`);
  b.hidden = false;
}
function apply(t) {
  theme = t; root.dataset.theme = t;
  paintButton();
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t, def: THEMES[t] } }));
}
function step(d) {
  if (turn !== null) turn += 72 * d;
  const t = ORDER[(ORDER.indexOf(theme) + d + ORDER.length) % ORDER.length];
  store.set(t); apply(t);
}

window.Site = { THEMES, ORDER, step, get theme() { return theme; }, get def() { return THEMES[theme]; } };

apply(theme);
const btn = document.querySelector('.theme-btn:not(.scene-btn):not(.lang-btn)');
if (btn) btn.addEventListener('click', (e) => step(e.shiftKey ? -1 : 1));
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey) step(e.shiftKey ? -1 : 1);
});
})();
