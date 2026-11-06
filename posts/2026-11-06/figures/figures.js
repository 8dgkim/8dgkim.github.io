/* ==========================================================================
   figures.js : the three interactive figures of this note
     #t32-config   the 32 points: drag to turn, tap a point to color the others by their inner product with it
     #t32-triples  the solid of all possible (u, v, s) for three points, with the candidate's triangles
     #t32-gap      f - h for the certificate, with a random move of the candidate and what the bound says about it
   data.js (generated from the certificate at 130 digits) holds log10 (f - h). The figures take their colors from
   the site's theme and redraw when it changes.
   ========================================================================== */
(function () {
'use strict';
const D = window.T32;
if (!D) return;
const root = document.documentElement;
const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

document.head.insertAdjacentHTML('beforeend', `<style>
.t32 .t32-stage { position: relative; background: var(--stage); border-radius: var(--r-box); box-shadow: 0 0 0 1px var(--line); overflow: hidden; }
.t32 canvas { display: block; width: 100%; touch-action: pan-y; cursor: grab; user-select: none; -webkit-user-select: none; }
.t32 canvas:active { cursor: grabbing; }
.t32 canvas.plot { cursor: crosshair; }
.t32 .t32-hint { position: absolute; left: 12px; bottom: 9px; font: 12.5px var(--ui); color: var(--dim); pointer-events: none; transition: opacity .5s; }
.t32 .t32-ctrl { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin-top: 10px; font: 14px/1.45 var(--ui); color: var(--ink2); }
.t32 .t32-segs { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--r-btn); overflow: hidden; }
.t32 button { font: inherit; color: var(--ink2); background: none; border: 0; padding: 5px 13px; cursor: pointer; }
.t32 .t32-segs button + button { border-left: 1px solid var(--line); }
.t32 button[aria-pressed="true"] { color: var(--ink); background: color-mix(in srgb, var(--accent) 24%, transparent); }
.t32 button.t32-btn { border: 1px solid var(--line); border-radius: var(--r-btn); }
.t32 button:hover { color: var(--ink); }
.t32 button:focus-visible, .t32 input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.t32 .t32-full { flex-basis: 100%; margin-bottom: -6px; font-variant-numeric: tabular-nums; }
.t32 input[type=range] { -webkit-appearance: none; appearance: none; width: min(280px, 70vw); height: 4px; border-radius: 3px; background: var(--faint); margin: 8px 0; }
.t32 input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 17px; height: 17px; border-radius: 50%; background: var(--accent); border: 2px solid var(--stage); cursor: pointer; }
.t32 input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 2px solid var(--stage); cursor: pointer; }
.t32 .t32-legend { flex-basis: 100%; display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 13.5px; }
.t32 .t32-legend .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
.t32 .t32-legend .lead { flex-basis: 100%; color: var(--ink); }
.t32 .t32-read { flex-basis: 100%; display: grid; grid-template-columns: max-content auto; gap: 3px 16px; font-size: 13.5px; }
.t32 .t32-read b { font: 500 13px var(--mono); color: var(--ink); }
.t32 .t32-msg { flex-basis: 100%; color: var(--ink); font-size: 14.5px; }
@media (max-width: 560px) { .t32 .t32-read { grid-template-columns: 1fr; gap: 0; } .t32 .t32-read b { margin-bottom: 4px; } }
</style>`);

// ---------------- colors from the theme ----------------
const probe = document.createElement('canvas').getContext('2d'), RGB = new Map();
function rgb(c) {
  if (RGB.has(c)) return RGB.get(c);
  probe.fillStyle = '#808080'; probe.fillStyle = c; const s = probe.fillStyle;
  const v = s[0] === '#' ? [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16)) : (s.match(/[\d.]+/g) || [128, 128, 128]).slice(0, 3).map(Number);
  RGB.set(c, v); return v;
}
const rgba = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, x) => { const p = rgb(a), q = rgb(b); return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * x)).join(',')})`; };
let C = {};
function readColors() {
  const cs = getComputedStyle(root), v = (n, d) => cs.getPropertyValue(n).trim() || d;
  C = { ink: v('--ink', '#eee'), ink2: v('--ink2', '#bbb'), dim: v('--dim', '#888'), line: v('--line', '#333'),
        accent: v('--accent', '#e55'), stage: v('--stage', '#000'), ui: v('--ui', 'system-ui, sans-serif'), mono: v('--mono', 'monospace') };
  const [r, g, b] = rgb(C.stage); C.light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
  C.ico = C.light ? '#a8650f' : '#e3a43a';
  C.dod = C.light ? '#2a62a0' : '#5b9bd9';
  const stops = C.light ? ['#2c4fb8', '#1c7f8c', '#3f7f2a', '#93680a', '#b4501f', '#a8284a']
                        : ['#7d9cff', '#5cc8d6', '#8fd17f', '#f0c64e', '#f28a52', '#ec6080'];
  C.ramp = Array.from({ length: 11 }, (_, k) => { const x = k / 10 * (stops.length - 1), i = Math.min(Math.floor(x), stops.length - 2); return mix(stops[i], stops[i + 1], x - i); });
}

// ---------------- the candidate ----------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return [a[0] / n, a[1] / n, a[2] / n]; };
const phi = (1 + Math.sqrt(5)) / 2, raw = [];
for (const a of [1, -1]) for (const b of [1, -1]) raw.push([0, a, b * phi], [b * phi, 0, a], [a, b * phi, 0]);
for (const a of [1, -1]) for (const b of [1, -1]) for (const c of [1, -1]) raw.push([a, b, c]);
for (const a of [1, -1]) for (const b of [1, -1]) raw.push([0, a * phi, b / phi], [b / phi, 0, a * phi], [a * phi, b / phi, 0]);
const N = 32, P = raw.map(unit), KIND = P.map((_, i) => (i < 12 ? 0 : 1));
const CT = D.contacts;                       // the 11 inner products, ascending
const NAME = ['−1', '−0.7947', '−0.7454', '−0.4472', '−1/3', '−0.1876', '0.1876', '1/3', '0.4472', '0.7454', '0.7947'];
const nearestC = (t) => { let k = 0; for (let i = 1; i < CT.length; i++) if (Math.abs(t - CT[i]) < Math.abs(t - CT[k])) k = i; return k; };
const RANK = P.map(() => new Array(N).fill(-1)), PAIRS = [], EDGES = [];
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  const k = nearestC(dot(P[i], P[j])); RANK[i][j] = RANK[j][i] = k; PAIRS.push({ i, j, k });
  if (k >= 9) EDGES.push([i, j]);           // nearest neighbors: t = 0.7947 (icosahedron-dodecahedron), 0.7454 (dodecahedron-dodecahedron)
}
const ADJ = P.map(() => new Set()); for (const [i, j] of EDGES) { ADJ[i].add(j); ADJ[j].add(i); }
const CENTERS = P.map(() => []);             // the corners of each point's cell: centers of the triangles around it
for (let i = 0; i < N; i++) for (const j of ADJ[i]) for (const k of ADJ[i]) if (i < j && j < k && ADJ[j].has(k)) {
  let n = unit(cross(sub(P[j], P[i]), sub(P[k], P[i]))); if (dot(n, P[i]) < 0) n = n.map((x) => -x);
  for (const m of [i, j, k]) CENTERS[m].push(n);
}
const CELLS = P.map((p, i) => {
  const e1 = unit(cross(p, Math.abs(p[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), e2 = cross(p, e1);
  return CENTERS[i].slice().sort((a, b) => Math.atan2(dot(a, e2), dot(a, e1)) - Math.atan2(dot(b, e2), dot(b, e1)));
});

// ---------------- 3-d view ----------------
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const ap = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

function fit(fig) {
  const cv = fig.canvas, w = cv.parentElement.clientWidth || 600, h = Math.round(fig.height(w));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
  fig.ctx = cv.getContext('2d'); fig.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fig.W = w; fig.H = h;
}
const local = (cv, e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

// drag to turn; a tap (no drag) goes to fig.tap
function orbit(fig, M0) {
  fig.M = M0; fig.auto = !REDUCE;
  let last = null, moved = 0;
  const cv = fig.canvas;
  cv.addEventListener('pointerdown', (e) => { last = [e.clientX, e.clientY]; moved = 0; try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
  cv.addEventListener('pointermove', (e) => {
    if (!last) return;
    const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
    if (moved < 4) return;
    stopAuto(fig); fig.M = mul(rx(dy * 0.009), mul(ry(dx * 0.009), fig.M)); draw(fig);
  });
  const end = (e, tap) => { if (last && tap && moved < 4 && fig.tap) fig.tap(...local(cv, e)); last = null; };
  cv.addEventListener('pointerup', (e) => end(e, true));
  cv.addEventListener('pointercancel', (e) => end(e, false));
}
function stopAuto(fig) { fig.auto = false; if (fig.hint) fig.hint.style.opacity = 0; }

// ---------------- animation: only figures on screen, only while they turn by themselves ----------------
const FIGS = []; let running = false, prev = 0;
function draw(fig) { if (fig.ctx) fig.render(); }
function kick() { if (!running && FIGS.some((f) => f.auto && f.visible)) { running = true; prev = 0; requestAnimationFrame(tick); } }
function tick(now) {
  const dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0; prev = now;
  let any = false;
  for (const f of FIGS) if (f.auto && f.visible) { f.M = mul(ry(dt * 0.16), f.M); draw(f); any = true; }
  if (any) requestAnimationFrame(tick); else running = false;
}

function shell(id) {
  const el = document.getElementById(id); if (!el) return null;
  const stage = el.querySelector('.t32-stage'), cap = el.querySelector('figcaption');
  stage.querySelectorAll('noscript').forEach((n) => n.remove());
  const canvas = document.createElement('canvas'); stage.appendChild(canvas);
  const ctrl = document.createElement('div'); ctrl.className = 't32-ctrl'; el.insertBefore(ctrl, cap);
  return { el, stage, canvas, ctrl, visible: false };
}
function segs(ctrl, label, options, value, onPick) {
  const g = document.createElement('div'); g.className = 't32-segs'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
  for (const [v, text] of options) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.v = v;
    b.setAttribute('aria-pressed', String(v === value));
    b.addEventListener('click', () => { g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); onPick(v); });
    g.appendChild(b);
  }
  ctrl.appendChild(g); return g;
}
function hint(fig, text) { const h = document.createElement('div'); h.className = 't32-hint'; h.textContent = text; fig.stage.appendChild(h); fig.hint = h; }
function ball(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill(); }

// ======================= 1. the configuration =======================
function makeConfig() {
  const fig = shell('t32-config'); if (!fig) return;
  fig.height = (w) => (w < 560 ? w * 1.0 : Math.min(w * 0.62, 560));
  fig.mode = 'edges'; fig.sel = null;
  segs(fig.ctrl, 'Show', [['points', 'Points'], ['edges', 'Neighbors'], ['cells', 'Soccer ball']], fig.mode, (v) => { fig.mode = v; draw(fig); });
  const legend = document.createElement('div'); legend.className = 't32-legend'; fig.ctrl.appendChild(legend);
  hint(fig, 'drag to turn · tap a point');

  const project = () => { const R = Math.min(fig.W, fig.H) * 0.44; return { R, cx: fig.W / 2, cy: fig.H / 2, Q: P.map((p) => ap(fig.M, p)) }; };
  const color = (i) => (fig.sel === null ? (KIND[i] ? C.dod : C.ico) : i === fig.sel ? C.ink : C.ramp[RANK[fig.sel][i]]);

  fig.render = () => {
    const { ctx, W, H } = fig, { R, cx, cy, Q } = project(), X = (w) => cx + R * w[0], Y = (w) => cy - R * w[1];
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.strokeStyle = rgba(C.dim, 0.5); ctx.lineWidth = 1; ctx.stroke();
    const order = [...Array(N).keys()].sort((a, b) => Q[a][2] - Q[b][2]);
    if (fig.mode === 'cells') {
      for (const i of order) {
        const z = Q[i][2], vs = CELLS[i].map((c) => ap(fig.M, c));
        ctx.beginPath(); vs.forEach((w, k) => (k ? ctx.lineTo(X(w), Y(w)) : ctx.moveTo(X(w), Y(w)))); ctx.closePath();
        ctx.fillStyle = rgba(color(i), Math.max(0.05, Math.min(0.92, 0.38 + 0.55 * z))); ctx.fill();
        if (z > -0.15) { ctx.strokeStyle = rgba(C.stage, 0.9); ctx.lineWidth = 1.6; ctx.stroke(); }
        if (i === fig.sel && z > -0.15) { ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2; ctx.stroke(); }
      }
      return;
    }
    if (fig.mode === 'edges') {
      for (const [i, j] of EDGES) {
        const front = Q[i][2] + Q[j][2] > 0;
        ctx.setLineDash(front ? [] : [2, 3]); ctx.strokeStyle = rgba(C.ink2, front ? 0.62 : 0.18); ctx.lineWidth = front ? 1.3 : 0.8;
        ctx.beginPath(); ctx.moveTo(X(Q[i]), Y(Q[i])); ctx.lineTo(X(Q[j]), Y(Q[j])); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const s = R / 220;
    for (const i of order) {
      const z = Q[i][2], r = (KIND[i] ? 5.2 : 6.4) * s * (1 + 0.28 * z);
      ball(ctx, X(Q[i]), Y(Q[i]), r, rgba(color(i), z > 0 ? 1 : 0.3));
      if (i === fig.sel) { ctx.beginPath(); ctx.arc(X(Q[i]), Y(Q[i]), r + 4, 0, 2 * Math.PI); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.stroke(); }
    }
  };
  fig.tap = (x, y) => {
    const { R, cx, cy, Q } = project(); let best = -1, bd = Math.max(24, R * 0.16);
    for (let i = 0; i < N; i++) if (Q[i][2] > -0.05) { const d = Math.hypot(cx + R * Q[i][0] - x, cy - R * Q[i][1] - y); if (d < bd) { bd = d; best = i; } }
    stopAuto(fig); fig.sel = best < 0 || best === fig.sel ? null : best; updateLegend(); draw(fig);
  };
  function updateLegend() {
    if (fig.sel === null) {
      legend.innerHTML = `<span><i class="sw" style="background:${C.ico}"></i>icosahedron, 12 points: five neighbors, pentagon cells</span>`
        + `<span><i class="sw" style="background:${C.dod}"></i>dodecahedron, 20 points: six neighbors, hexagon cells</span>`;
      return;
    }
    const count = new Array(11).fill(0); for (let j = 0; j < N; j++) if (j !== fig.sel) count[RANK[fig.sel][j]]++;
    const ks = count.map((c, k) => k).filter((k) => count[k]).reverse();
    legend.innerHTML = `<span class="lead">From this ${KIND[fig.sel] ? 'dodecahedron' : 'icosahedron'} point, the other 31 lie at only ${ks.length} values of the inner product <i>t</i>:</span>`
      + ks.map((k) => `<span><i class="sw" style="background:${C.ramp[k]}"></i><i>t</i> = ${NAME[k]} &nbsp;×${count[k]}</span>`).join('');
  }
  fig.legend = updateLegend; updateLegend();
  orbit(fig, mul(ry(0.42), rx(-0.33)));
  FIGS.push(fig);
}

// ======================= 2. the solid of triples =======================
function makeTriples() {
  const fig = shell('t32-triples'); if (!fig) return;
  fig.height = (w) => (w < 560 ? w * 1.0 : Math.min(w * 0.62, 540));
  fig.show = true;
  const seen = new Map();
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) for (let k = j + 1; k < N; k++) {
    const t = [CT[RANK[i][j]], CT[RANK[i][k]], CT[RANK[j][k]]];
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      const key = [t[a], t[b], t[c]].map((x) => x.toFixed(6)).join(','); if (!seen.has(key)) seen.set(key, [t[a], t[b], t[c]]);
    }
  }
  const TRI = [...seen.values()];
  const shapes = new Set(TRI.map((t) => t.slice().sort((a, b) => a - b).map((x) => x.toFixed(6)).join(','))).size;
  const b = document.createElement('button'); b.type = 'button'; b.className = 't32-btn'; b.setAttribute('aria-pressed', 'true');
  b.textContent = 'The candidate’s triangles';
  b.addEventListener('click', () => { fig.show = !fig.show; b.setAttribute('aria-pressed', String(fig.show)); draw(fig); });
  fig.ctrl.appendChild(b);
  const note = document.createElement('span'); note.textContent = `${shapes} different triangles, ${TRI.length} points counting the order of u, v, s`; fig.ctrl.appendChild(note);
  hint(fig, 'drag to turn');

  // lines on the surface 1 + 2uvs − u² − v² − s² = 0: s = uv ± √((1 − u²)(1 − v²)), along u = const and v = const
  const LINES = [], K = 12, S = 44;
  for (const sg of [1, -1]) for (let k = 0; k <= K; k++) {
    const a = -1 + 2 * k / K, L1 = [], L2 = [];
    for (let m = 0; m <= S; m++) {
      const v = -Math.cos(Math.PI * m / S), r = sg * Math.sqrt(Math.max(0, (1 - a * a) * (1 - v * v)));
      L1.push([a, v, a * v + r]); L2.push([v, a, a * v + r]);
    }
    LINES.push({ pts: L1, edge: k === 0 || k === K }, { pts: L2, edge: k === 0 || k === K });
  }
  const CUBE = []; for (const a of [-1, 1]) for (const b2 of [-1, 1]) CUBE.push([[-1, a, b2], [1, a, b2]], [[a, -1, b2], [a, 1, b2]], [[a, b2, -1], [a, b2, 1]]);
  const world = (p) => [p[0], p[2], -p[1]];   // s points up

  fig.render = () => {
    const { ctx, W, H } = fig, R = Math.min(W, H) * 0.29, cx = W / 2, cy = H / 2 + 4;
    const V = (p) => ap(fig.M, world(p)), X = (w) => cx + R * w[0], Y = (w) => cy - R * w[1], A = (z) => Math.max(0, Math.min(1, (z + 1.75) / 3.5));
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    for (const [p, q] of CUBE) { const a = V(p), c = V(q); ctx.strokeStyle = rgba(C.dim, 0.12 + 0.25 * A((a[2] + c[2]) / 2)); ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(c), Y(c)); ctx.stroke(); }
    for (const L of LINES) {
      const w = L.pts.map(V);
      for (let m = 1; m < w.length; m++) {
        const al = A((w[m][2] + w[m - 1][2]) / 2);
        ctx.strokeStyle = rgba(C.ink2, (L.edge ? 0.3 : 0.08) + (L.edge ? 0.55 : 0.42) * al); ctx.lineWidth = L.edge ? 1.6 : 1;
        ctx.beginPath(); ctx.moveTo(X(w[m - 1]), Y(w[m - 1])); ctx.lineTo(X(w[m]), Y(w[m])); ctx.stroke();
      }
    }
    ctx.font = `italic 15px ${C.ui}`; ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [p, t] of [[[1.22, -1, -1], 'u'], [[-1, 1.22, -1], 'v'], [[-1, -1, 1.22], 's']]) { const w = V(p); ctx.fillText(t, X(w), Y(w)); }
    if (!fig.show) return;
    const pts = TRI.map((t) => V(t)).sort((a, b) => a[2] - b[2]), s = R / 160;
    for (const w of pts) ball(ctx, X(w), Y(w), 3.4 * s * (1 + 0.18 * w[2]), rgba(C.ico, 0.3 + 0.7 * A(w[2])));
  };
  orbit(fig, mul(rx(0.42), ry(-0.68)));
  FIGS.push(fig);
}

// ======================= 3. the gap, and a random move of the candidate =======================
const NE = D.near[0].right.length, E0 = D.e0, DE = D.de, BUDGET = 3.95e-42;
function gridAt(t) {
  const g = D.grid, x = Math.max(0, Math.min(g.y.length - 1.0001, (t - g.t0) / g.dt)), i = Math.floor(x), f = x - i;
  return g.y[i] * (1 - f) + g.y[i + 1] * f;
}
function logGap(k, d) {            // log10 (f − h) at t = contacts[k] + d
  const n = D.near[k], ad = Math.abs(d);
  if (ad === 0) return n.at;
  const arr = d < 0 ? n.left : n.right; if (!arr) return n.at;
  const x = (Math.log10(ad) - E0) / DE;
  if (x >= NE - 1) return gridAt(CT[k] + d);
  if (x <= 0) return Math.max(n.at, arr[0] + (arr[1] - arr[0]) * x);
  const i = Math.floor(x), f = x - i; return arr[i] * (1 - f) + arr[i + 1] * f;
}
const FP = CT.map((c) => Math.pow(2 - 2 * c, -1.5));      // f′ at each contact value
const LAMBDA = P.map((_, i) => { let s = 0; for (let j = 0; j < N; j++) if (j !== i) s += FP[RANK[i][j]] * CT[RANK[i][j]]; return s; });
function rest(c, dt) {             // f(c + dt) − f(c) − f′(c) dt, without cancellation
  const a0 = 2 - 2 * c;
  if (Math.abs(dt) < 1e-4) return dt * dt * (1.5 * Math.pow(a0, -2.5) + dt * (2.5 * Math.pow(a0, -3.5) + dt * 4.375 * Math.pow(a0, -4.5)));
  const a = a0 - 2 * dt, r = Math.sqrt(a), r0 = Math.sqrt(a0);
  return 2 * dt / (r * r0 * (r + r0)) - Math.pow(a0, -1.5) * dt;
}
function mulberry(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function directions(seed) {        // a random tangent direction at each point, mean square length 1
  const r = mulberry(seed), g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()) / Math.SQRT2;
  return P.map((p) => { const v = [g(), g(), g()], q = dot(v, p), t = [v[0] - q * p[0], v[1] - q * p[1], v[2] - q * p[2]], m = Math.hypot(...t); return { u: t.map((x) => x / m), m }; });
}
// Move point i by the angle eps·m_i along u_i. With e_i = x_i − p_i, the change in each inner product is
// p_i·e_j + e_i·p_j + e_i·e_j, and since the candidate is a critical point (the force on p_i is λ_i p_i),
// E(x) − E = Σ λ_i (p_i·e_i) + Σ f′ (e_i·e_j) + Σ rest: every term is second order, so no digits are lost.
function moved(eps, dirs) {
  const e = P.map((p, i) => {
    const a = eps * dirs[i].m, s = Math.sin(a), h = Math.sin(a / 2), c2 = 2 * h * h, u = dirs[i].u;
    return { v: [u[0] * s - c2 * p[0], u[1] * s - c2 * p[1], u[2] * s - c2 * p[2]], pe: -c2 };
  });
  let dE = 0; for (let i = 0; i < N; i++) dE += LAMBDA[i] * e[i].pe;
  let sum = 0, out = 0; const pts = [];
  for (const { i, j, k } of PAIRS) {
    // antipodal pairs (p_j = −p_i): the change is second order, p_i·e_j = −p_j·e_j, so write it that way
    const ee = dot(e[i].v, e[j].v), dt = k === 0 ? ee - e[i].pe - e[j].pe : dot(P[i], e[j].v) + dot(e[i].v, P[j]) + ee;
    dE += FP[k] * ee + rest(CT[k], dt);
    const t = CT[k] + dt, kk = Math.abs(dt) < 0.02 ? k : nearestC(t), d = kk === k ? dt : t - CT[kk], lg = logGap(kk, d);
    sum += Math.pow(10, lg); if (Math.abs(d) > 1e-10) out++;
    pts.push({ t, d, lg });
  }
  return { dE, sum, out, pts };
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const pow10 = (e) => '10' + String(e).split('').map((ch) => SUP[ch]).join('');
function sci(x) {
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x))), m = Math.abs(x) / Math.pow(10, e);
  if (m >= 9.95) { m = 1; e++; }
  return (x < 0 ? '−' : '') + m.toFixed(1) + ' × ' + pow10(e);
}

function makeGap() {
  const fig = shell('t32-gap'); if (!fig) return;
  fig.canvas.className = 'plot';
  fig.height = (w) => (w < 640 ? w * 1.3 : w * 0.44);
  fig.le = -3; fig.seed = 7; fig.dirs = directions(fig.seed); fig.hover = null;

  // the curve over all t: the uniform grid plus the dips, sampled finely near each contact value
  const CURVE = [];
  D.grid.y.forEach((y, i) => CURVE.push([D.grid.t0 + i * D.grid.dt, y]));
  D.near.forEach((n, k) => {
    CURVE.push([CT[k], n.at]);
    for (let m = 0; m < NE; m++) { const d = Math.pow(10, E0 + m * DE); if (n.left) CURVE.push([CT[k] - d, n.left[m]]); CURVE.push([CT[k] + d, n.right[m]]); }
  });
  CURVE.sort((a, b) => a[0] - b[0]);

  const range = document.createElement('input'); range.type = 'range'; range.min = -24; range.max = -1; range.step = 0.25; range.value = fig.le;
  range.setAttribute('aria-label', 'Size of the move, as a power of ten');
  // the changing text gets a line of its own, so the slider and the button never move
  const lt = document.createElement('span'); lt.className = 't32-full'; lt.id = 't32-eps'; range.setAttribute('aria-describedby', 't32-eps');
  fig.ctrl.append(lt, range);
  const again = document.createElement('button'); again.type = 'button'; again.className = 't32-btn'; again.textContent = 'Another random move';
  fig.ctrl.appendChild(again);
  const read = document.createElement('div'); read.className = 't32-read'; fig.ctrl.appendChild(read);
  const msg = document.createElement('div'); msg.className = 't32-msg'; msg.setAttribute('aria-live', 'polite'); fig.ctrl.appendChild(msg);

  function update() {
    fig.res = moved(Math.pow(10, fig.le), fig.dirs);
    const { dE, sum, out } = fig.res, bound = sum - BUDGET, e = Math.round(fig.le * 4) / 4;
    lt.textContent = `Each point moves by an angle of about ${Number.isInteger(e) ? pow10(e) : Math.pow(10, e - Math.floor(e)).toFixed(1) + ' × ' + pow10(Math.floor(e))} radians`;
    read.innerHTML = `<span>pairs outside their windows</span><b>${out} of 496</b>`
      + `<span>sum of f − h over the 496 pairs</span><b>${sci(sum)}</b>`
      + `<span>what the bound guarantees for E(x) − E</span><b>${bound > 0 ? 'at least ' + sci(bound) : 'nothing: the sum is under 4.0 × 10⁻⁴²'}</b>`
      + `<span>actual E(x) − E</span><b>${sci(dE)}</b>`;
    msg.textContent = out > 0
      ? `${out === 496 ? 'Every pair has left its window' : out === 1 ? 'One pair has left its window' : out + ' pairs have left their windows'}. Outside the windows f − h is at least 10⁻²⁵, far more than the budget of 4 × 10⁻⁴², so step 2 already rules this configuration out.`
      : bound > 0
        ? 'Every pair is still inside its window, but the gaps add up to more than the budget of 4 × 10⁻⁴²: the bound alone puts this configuration above the candidate.'
        : 'Here the gaps add up to less than the budget, so the bound alone cannot tell this configuration from the candidate. Every pair is inside its window, though, and step 3 takes it from there.';
    draw(fig);
  }
  range.addEventListener('input', () => { fig.le = Number(range.value); update(); });
  again.addEventListener('click', () => { fig.seed++; fig.dirs = directions(fig.seed); update(); });
  fig.canvas.addEventListener('pointermove', (e) => { const [x, y] = local(fig.canvas, e); fig.hover = { x, y }; draw(fig); });
  fig.canvas.addEventListener('pointerleave', () => { fig.hover = null; draw(fig); });

  fig.render = () => {
    const { ctx, W, H } = fig, side = W >= 640, gapX = 26;
    const pw = side ? (W - gapX) / 2 : W, ph = side ? H : (H - 10) / 2;
    const panels = [{ x: 0, y: 0 }, side ? { x: pw + gapX, y: 0 } : { x: 0, y: ph + 10 }];
    const Y0 = -47, Y1 = 1, ml = 56, mr = 14, mt = 34, mb = 40;
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'middle';
    const res = fig.res;
    panels.forEach((pn, which) => {
      const x0 = pn.x + ml, x1 = pn.x + pw - mr, y0 = pn.y + mt, y1 = pn.y + ph - mb;
      const [a, b] = which === 0 ? [-1.02, 0.88] : [-24, -0.6];
      const X = (v) => x0 + (v - a) / (b - a) * (x1 - x0), Y = (v) => y1 - (v - Y0) / (Y1 - Y0) * (y1 - y0);
      // title
      ctx.font = `600 13.5px ${C.ui}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left';
      ctx.fillText(which === 0 ? 'f − h over all t' : 'f − h near each contact value c, against |t − c|', pn.x + 4, pn.y + 14);
      // axes and ticks
      ctx.font = `12px ${C.ui}`; ctx.fillStyle = C.dim; ctx.strokeStyle = rgba(C.dim, 0.18); ctx.lineWidth = 1;
      for (const v of [0, -10, -20, -30, -40]) {
        ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke();
        ctx.textAlign = 'right'; ctx.fillText(v === 0 ? '1' : pow10(v), x0 - 7, Y(v));
      }
      const xt = which === 0 ? [-1, -0.5, 0, 0.5] : [-20, -15, -10, -5];
      ctx.textAlign = 'center';
      for (const v of xt) ctx.fillText(which === 0 ? String(v).replace('-', '−') : pow10(v), X(v), y1 + 15);
      ctx.fillText(which === 0 ? 't' : '|t − c|', (x0 + x1) / 2, y1 + 32);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 - 6, x1 - x0, y1 - y0 + 6); ctx.clip();
      if (which === 1) {           // the windows
        ctx.fillStyle = rgba(C.ink, C.light ? 0.06 : 0.05); ctx.fillRect(x0, y0 - 6, X(-10) - x0, y1 - y0 + 6);
        ctx.setLineDash([4, 3]); ctx.strokeStyle = rgba(C.ink, 0.6); ctx.beginPath(); ctx.moveTo(X(-10), y0); ctx.lineTo(X(-10), y1); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.ink2; ctx.textAlign = 'left'; ctx.font = `12px ${C.ui}`;
        ctx.fillText('inside the windows', x0 + 6, y0 + 8); ctx.fillText('window edge, ' + pow10(-10), X(-10) + 6, y0 + 8);
        const yb = Y(Math.log10(BUDGET));
        ctx.setLineDash([1.5, 3]); ctx.strokeStyle = rgba(C.ink2, 0.8); ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.stroke(); ctx.setLineDash([]);
        ctx.textAlign = 'right'; ctx.fillText('budget for the whole sum, 4 × 10⁻⁴²', x1 - 4, yb - 9);
      }
      // the threshold 10^-25
      ctx.setLineDash([5, 4]); ctx.strokeStyle = rgba(C.ink, 0.65); ctx.beginPath(); ctx.moveTo(x0, Y(-25)); ctx.lineTo(x1, Y(-25)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.ink2; ctx.textAlign = 'right'; ctx.font = `12px ${C.ui}`; ctx.fillText(pow10(-25), x1 - 4, Y(-25) - 9);
      // the curves
      ctx.strokeStyle = which === 0 ? C.ink2 : rgba(C.ink2, 0.55); ctx.lineWidth = 1.3;
      if (which === 0) { ctx.beginPath(); CURVE.forEach(([t, y], m) => (m ? ctx.lineTo(X(t), Y(y)) : ctx.moveTo(X(t), Y(y)))); ctx.stroke(); }
      else D.near.forEach((n) => [n.left, n.right].forEach((arr) => { if (!arr) return; ctx.beginPath(); arr.forEach((y, m) => { const e = E0 + m * DE; m ? ctx.lineTo(X(e), Y(y)) : ctx.moveTo(X(e), Y(y)); }); ctx.stroke(); }));
      // the 496 pairs of the moved configuration
      if (res) for (const p of res.pts) {
        const xv = which === 0 ? p.t : Math.max(-24, p.d === 0 ? -24 : Math.log10(Math.abs(p.d)));
        ball(ctx, X(xv), Y(p.lg), 2.6, rgba(C.ico, 0.75));
      }
      ctx.restore();
      // readout under the pointer, on the left panel
      const hv = fig.hover;
      if (which === 0 && hv && hv.x >= x0 && hv.x <= x1 && hv.y >= pn.y && hv.y <= pn.y + ph) {
        const t = a + (hv.x - x0) / (x1 - x0) * (b - a), k = nearestC(t), lg = logGap(k, t - CT[k]);
        ctx.strokeStyle = rgba(C.ink, 0.35); ctx.beginPath(); ctx.moveTo(hv.x, y0); ctx.lineTo(hv.x, y1); ctx.stroke();
        ctx.font = `12.5px ${C.mono}`; ctx.fillStyle = C.ink; ctx.textAlign = hv.x > (x0 + x1) / 2 ? 'right' : 'left';
        ctx.fillText(`t = ${t.toFixed(4).replace('-', '−')}   f − h ≈ ${pow10(Math.round(lg))}`, hv.x + (ctx.textAlign === 'left' ? 8 : -8), y0 + 26);
      }
    });
  };
  update();
  FIGS.push(fig);
}

// ---------------- start ----------------
readColors();
makeConfig(); makeTriples(); makeGap();
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { for (const en of es) { const f = FIGS.find((g) => g.stage === en.target); if (f) f.visible = en.isIntersecting; } kick(); }) : null;
for (const f of FIGS) { fit(f); draw(f); if (io) io.observe(f.stage); else f.visible = true; }
kick();
let rt = 0;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => FIGS.forEach((f) => { fit(f); draw(f); }), 120); });
document.addEventListener('themechange', () => { readColors(); FIGS.forEach((f) => { if (f.legend) f.legend(); draw(f); }); });
})();
