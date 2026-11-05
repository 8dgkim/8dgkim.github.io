/* ==========================================================================
   lang.js : English / Korean on the home page
   Both languages are written in index.html, side by side: elements with class "i18n" and lang="en" or lang="ko";
   css/base.css shows the ones of the current language (html[data-lang]). An inline script in <head> picks the
   language before the first paint: the saved choice, else Korean for browsers set to Korean, else English.
   The button shows the other language's letter (가 / A); its name appears on hover.
   ========================================================================== */
(function () {
'use strict';
const root = document.documentElement, KEY = 'lang', NAMES = { en: 'English', ko: '한국어' };
const store = { set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } } };
const btn = document.querySelector('.lang-btn');
let lang = root.dataset.lang === 'ko' ? 'ko' : 'en';

function apply(l) {
  lang = l; root.dataset.lang = l; root.lang = l;
  const title = root.dataset[l === 'ko' ? 'titleKo' : 'titleEn']; if (title) document.title = title;
  if (!btn) return;
  const other = l === 'ko' ? 'en' : 'ko';
  btn.textContent = other === 'ko' ? '가' : 'A';
  btn.dataset.label = NAMES[other];
  btn.setAttribute('aria-label', l === 'ko' ? 'View in English' : '한국어로 보기');
  btn.hidden = false;
}
const flip = () => { const l = lang === 'ko' ? 'en' : 'ko'; store.set(l); apply(l); };

apply(lang);
if (btn) btn.addEventListener('click', flip);
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && !e.altKey) flip();
});
})();
