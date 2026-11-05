/* ==========================================================================
   stars.js : twinkling stars and drifting particles on one canvas behind the home page
   Rebuilt from the first version of this site, where every star was a DOM node with a CSS animation:
   a 2px core whose opacity goes 0.3 -> 1 -> 0.3 over 2-5 s while its glow swings from one theme color
   to two others, and 20 soft particles in a theme color that float 20px up and back over 4-8 s.
   Colors come from the theme (--star-core, --star-g1..3, --particle in css/themes.css).
   About 30 frames per second, stopped in a hidden tab, drawn once with reduced motion.
   Behind the text column the stars fade, so they never compete with the words.
   ========================================================================== */
(function () {
'use strict';
const root = document.documentElement;
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cv = document.createElement('canvas'); cv.id = 'stars'; cv.setAttribute('aria-hidden', 'true');
const ctx = cv.getContext('2d'); if (!ctx) return;
document.body.prepend(cv);

const rnd = Math.random, TAU = 2 * Math.PI;
// 150 stars on a 1440x900 screen, as before; more or fewer with the screen's area
const n = Math.round(150 * Math.min(1.8, Math.max(0.5, innerWidth * innerHeight / (1440 * 900))));
const stars = Array.from({ length: n }, () => ({ x: rnd(), y: rnd(), delay: rnd() * 3, dur: rnd() * 3 + 2 }));
const parts = Array.from({ length: 20 }, () => ({ x: rnd(), y: rnd(), delay: rnd() * 6, dur: rnd() * 4 + 4 }));
let W = 0, H = 0, dpr = 1, col = null, look = null, raf = 0, last = 0;

const css = (k) => getComputedStyle(root).getPropertyValue(k).trim();
function rgba(c, a) {
  let h = c.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const v = parseInt(h, 16); if (h.length !== 6 || isNaN(v)) return c;
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
// a soft disc of light, the canvas stand-in for box-shadow: 0 0 <radius> <color>
function glow(color, radius, peak) {
  const c = Math.ceil(radius * dpr), s = document.createElement('canvas'); s.width = s.height = 2 * c;
  const g = s.getContext('2d'), gr = g.createRadialGradient(c, c, 0, c, c, c);
  [[0, 1], [0.15, 0.8], [0.35, 0.45], [0.6, 0.15], [1, 0]].forEach(([o, k]) => gr.addColorStop(o, rgba(color, peak * k)));
  g.fillStyle = gr; g.fillRect(0, 0, s.width, s.height); return s;
}
function readTheme() {
  look = { core: css('--star-core') || '#fff', g1: glow(css('--star-g1'), 7, 0.45), g2: glow(css('--star-g2'), 12, 0.32),
    g3: glow(css('--star-g3'), 24, 0.14), p: glow(css('--particle'), 2.5, 1) };
}
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const c = document.querySelector('.col');
  if (c) { const r = c.getBoundingClientRect(), pad = parseFloat(getComputedStyle(c).paddingLeft) || 0; col = [r.left + pad, r.right - pad]; } else col = null;
  readTheme();   // the glow sprites depend on the pixel ratio
}
// behind the text column the stars drop to a third, with soft 48px edges
function shade(x) {
  if (!col) return 1;
  const e = 48, inL = Math.min(1, Math.max(0, (x - col[0] + e) / e)), inR = Math.min(1, Math.max(0, (col[1] + e - x) / e));
  return 1 - 0.65 * Math.min(inL, inR);
}
function blit(img, x, y, a) {
  if (a < 0.004) return;
  const s = img.width / dpr; ctx.globalAlpha = a; ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
}
// u: 0 at the dim end of a twinkle, 1 at the bright middle (the old 0% / 50% keyframes)
const swing = (t, o) => (still ? 0.5 : (1 - Math.cos(TAU * (t + o.delay) / o.dur)) / 2);
function draw(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = look.core;
  for (const s of stars) {
    const x = s.x * W, y = s.y * H, u = swing(t, s), op = (0.3 + 0.7 * u) * shade(x);
    blit(look.g1, x, y, op * (1 - u)); blit(look.g2, x, y, op * u); blit(look.g3, x, y, op * u);
    ctx.globalAlpha = op; ctx.beginPath(); ctx.arc(x, y, 1, 0, TAU); ctx.fill();
  }
  for (const p of parts) { const x = p.x * W; blit(look.p, x, p.y * H - 20 * swing(t, p), 0.4 * shade(x)); }
  ctx.globalAlpha = 1;
}
function frame(ms) { raf = requestAnimationFrame(frame); if (ms - last < 33) return; last = ms; draw(ms / 1000); }
function start() { if (!raf && !still && !document.hidden) raf = requestAnimationFrame(frame); }
function stop() { cancelAnimationFrame(raf); raf = 0; }

resize(); draw(performance.now() / 1000); start();
let rt = 0;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); draw(performance.now() / 1000); }, 120); });
document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
document.addEventListener('themechange', () => { readTheme(); draw(performance.now() / 1000); });
})();
