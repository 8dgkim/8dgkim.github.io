/* ==========================================================================
   hero.js : the home page's live scene, and a button to switch between scenes
   Each scene (js/scenes/*.js) registers itself with Hero.add(id, def):
     def = { name, icon (inline svg), hint, scale, dpr, create(gl, palette) -> { draw(frame), tint(palette), drag(dx, dy), point(x, y) } }
   Here: one WebGL2 canvas per scene (a new one on every switch, the old context released), the animation
   loop (paused off screen and in hidden tabs, one frame with reduced motion), dragging, the pointer,
   theme colors, and a few GL helpers the scenes share.
   ========================================================================== */
(function () {
'use strict';
const SCENES = {}, ORDER = [];
const Hero = (window.Hero = { SCENES, ORDER });
Hero.add = (id, def) => { SCENES[id] = def; ORDER.push(id); };

/* ---------------- GL helpers ---------------- */
Hero.VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;
// hash without sine (Dave Hoskins), the same on every GPU
Hero.HASH = `
float h1(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
float h3(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y)*p.z); }`;
// the uniforms every scene may use for theme colors
Hero.PAL_UNIFORMS = ['uA', 'uB', 'uC', 'uD', 'uStA', 'uStB', 'uBand', 'uHot'];

Hero.program = function (gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('hero: shader', gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs); if (!v || !f) return null;
  const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('hero: link', gl.getProgramInfoLog(p)); return null; }
  return p;
};
Hero.uniforms = (gl, prog, names) => { const U = {}; names.concat(Hero.PAL_UNIFORMS).forEach((n) => (U[n] = gl.getUniformLocation(prog, n))); return U; };
// a vertex array with one triangle over the whole screen
Hero.fullscreen = function (gl) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null); return vao;
};
// a vertex array from float arrays: [[data, size], ...] at locations 0, 1, ...
Hero.arrays = function (gl, list, usage) {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const bufs = [];
  list.forEach(([data, size], i) => {
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
    gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0); bufs.push(b);
  });
  gl.bindVertexArray(null); return { vao, bufs };
};
Hero.setPal = function (gl, U, pal) {
  const v3 = (k, c) => { if (U[k]) gl.uniform3fv(U[k], c); };
  ['uA', 'uB', 'uC', 'uD'].forEach((k, i) => v3(k, pal.ramp[i]));
  v3('uStA', pal.st[0]); v3('uStB', pal.st[1]); v3('uBand', pal.band); v3('uHot', pal.hot);
};

// 4x4 matrices, column-major as WebGL expects
const M = (Hero.mat = {
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  tr(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
});
// where a scene's object sits on screen (clip space): centered, a little above the middle
Hero.shift = () => [0, 0.04];
// an orbiting camera: distance, elevation above the y = 0 plane, azimuth; then shifted on screen
Hero.orbit = function (o, asp) {
  const [sx, sy] = Hero.shift(asp);
  const view = M.mul(M.tr(0, 0, -o.dist), M.mul(M.rx(o.el), M.ry(o.az)));
  return M.mul(M.tr(sx, sy, 0), M.mul(M.persp(o.fov || 0.7, asp, 0.05, 100), view));
};
// the same camera as basis vectors, for ray-marched scenes: position, forward, right, up
Hero.rays = function (o) {
  const ce = Math.cos(o.el), pos = [o.dist * ce * Math.sin(o.az), o.dist * Math.sin(o.el), o.dist * ce * Math.cos(o.az)];
  const n = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const x = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const fw = n(pos.map((v) => -v)), rt = n(x(fw, [0, 1, 0])), up = n(x(rt, fw));
  return { pos, fw, rt, up };
};

/* ---------------- full-screen sky behind the particle scenes ---------------- */
const SKY = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uStA, uStB, uBand;
out vec4 frag;
${Hero.HASH}
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*uRes)/(0.5*uRes.y);
  float bd = (p.y*0.8 + 0.3*sin(p.x*1.1) + 0.2)*2.2;
  vec3 c = uBand*0.8*exp(-bd*bd) + vec3(0.002, 0.003, 0.006);
  for (int l = 0; l < 2; l++) {
    float sc = l == 0 ? 70.0 : 150.0;
    vec2 g = p*sc, id = floor(g);
    if (h1(id + float(l)*7.0) > (l == 0 ? 0.93 : 0.96)) {
      vec2 f = fract(g) - 0.5 - (vec2(h1(id + 1.3), h1(id + 2.9)) - 0.5)*0.6;
      c += mix(uStA, uStB, h1(id + 4.4))*(0.2 + 1.5*pow(h1(id + 6.6), 6.0))*exp(-dot(f, f)*(l == 0 ? 70.0 : 110.0));
    }
  }
  frag = vec4(c, 1.0);   // linear: the HDR pass tone-maps
}`;
Hero.sky = function (gl) {
  const prog = Hero.program(gl, Hero.VERT, SKY); if (!prog) return null;
  const U = Hero.uniforms(gl, prog, ['uRes']), vao = Hero.fullscreen(gl);
  return {
    draw(w, h, pal) {
      gl.disable(gl.BLEND); gl.useProgram(prog); Hero.setPal(gl, U, pal); gl.uniform2f(U.uRes, w, h);
      gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
};

/* ---------------- HDR render with bloom ----------------
   A scene draws into a half-float target (light adds up without clipping), then: four levels of
   downsample + separable Gaussian blur, added back as glow, and an exponential tone map to the screen. */
const DOWN = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uSrc; uniform vec2 uDst, uTexel;
out vec4 frag;
void main(){
  vec2 uv = gl_FragCoord.xy/uDst, o = uTexel;   // four bilinear taps: a 4x4 box of the source
  vec3 c = texture(uSrc, uv - o).rgb + texture(uSrc, uv + o).rgb + texture(uSrc, uv + vec2(o.x, -o.y)).rgb + texture(uSrc, uv + vec2(-o.x, o.y)).rgb;
  frag = vec4(c*0.25, 1.0);
}`;
const BLUR = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uSrc; uniform vec2 uDst, uDir;
out vec4 frag;
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;   // 9-tap Gaussian in 5 bilinear fetches
  vec3 c = texture(uSrc, uv).rgb*0.2270;
  c += (texture(uSrc, uv + uDir*1.3846).rgb + texture(uSrc, uv - uDir*1.3846).rgb)*0.3162;
  c += (texture(uSrc, uv + uDir*3.2308).rgb + texture(uSrc, uv - uDir*3.2308).rgb)*0.0703;
  frag = vec4(c, 1.0);
}`;
const COMP = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uScene, uB1, uB2, uB3, uB4; uniform vec2 uDst; uniform float uExposure, uBloom;
out vec4 frag;
void main(){
  vec2 uv = gl_FragCoord.xy/uDst;
  vec3 b = texture(uB1, uv).rgb*0.35 + texture(uB2, uv).rgb*0.3 + texture(uB3, uv).rgb*0.2 + texture(uB4, uv).rgb*0.15;
  vec3 c = texture(uScene, uv).rgb + b*uBloom;
  c = vec3(1.0) - exp(-c*uExposure);
  frag = vec4(pow(c, vec3(1.0/1.1)), 1.0);
}`;
Hero.post = function (gl) {
  const half = !!gl.getExtension('EXT_color_buffer_float');
  const pd = Hero.program(gl, Hero.VERT, DOWN), pb = Hero.program(gl, Hero.VERT, BLUR), pc = Hero.program(gl, Hero.VERT, COMP);
  if (!pd || !pb || !pc) return null;
  const Ud = Hero.uniforms(gl, pd, ['uSrc', 'uDst', 'uTexel']), Ub = Hero.uniforms(gl, pb, ['uSrc', 'uDst', 'uDir']);
  const Uc = Hero.uniforms(gl, pc, ['uScene', 'uB1', 'uB2', 'uB3', 'uB4', 'uDst', 'uExposure', 'uBloom']), vao = Hero.fullscreen(gl);
  let W = 0, Ht = 0, scene = null, levels = [];
  function target(w, h) {
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  function resize(w, h) {
    if (w === W && h === Ht) return;
    [scene].concat(...levels.map((l) => [l.a, l.b])).filter(Boolean).forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
    W = w; Ht = h; scene = target(w, h); levels = [];
    for (let i = 0, lw = w, lh = h; i < 4; i++) { lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1); levels.push({ a: target(lw, lh), b: target(lw, lh) }); }
  }
  const bind = (unit, tex, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); };
  function pass(prog, dst, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null); gl.viewport(0, 0, dst ? dst.w : W, dst ? dst.h : Ht);
    gl.useProgram(prog); setup(); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return {
    begin(w, h) {
      resize(w, h); gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb); gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    },
    end(o) {
      gl.disable(gl.BLEND); gl.bindVertexArray(vao);
      let src = scene;
      for (const l of levels) {
        pass(pd, l.a, () => { bind(0, src.tex, Ud.uSrc); gl.uniform2f(Ud.uDst, l.a.w, l.a.h); gl.uniform2f(Ud.uTexel, 1 / src.w, 1 / src.h); });
        pass(pb, l.b, () => { bind(0, l.a.tex, Ub.uSrc); gl.uniform2f(Ub.uDst, l.b.w, l.b.h); gl.uniform2f(Ub.uDir, 1 / l.a.w, 0); });
        pass(pb, l.a, () => { bind(0, l.b.tex, Ub.uSrc); gl.uniform2f(Ub.uDst, l.a.w, l.a.h); gl.uniform2f(Ub.uDir, 0, 1 / l.a.h); });
        src = l.a;
      }
      pass(pc, null, () => {
        bind(0, scene.tex, Uc.uScene); levels.forEach((l, i) => bind(i + 1, l.a.tex, Uc['uB' + (i + 1)]));
        gl.uniform2f(Uc.uDst, W, Ht); gl.uniform1f(Uc.uExposure, o.exposure); gl.uniform1f(Uc.uBloom, o.bloom);
      });
    },
  };
};

/* ---------------- theme colors for the scenes ----------------
   ramp: the theme's black-hole disk ramp (dim to hot), st: star tints, band: sky band, hot: a highlight */
const RAMP0 = [[1, 0.25, 0.04], [1, 0.62, 0.25], [1, 0.93, 0.82], [0.7, 0.82, 1]], ST0 = [[1, 0.75, 0.55], [0.65, 0.8, 1]], BAND0 = [0.03, 0.036, 0.065];
function cssRGB(k) {
  const h = getComputedStyle(document.documentElement).getPropertyValue(k).trim().replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return isNaN(v) ? [1, 1, 1] : [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
Hero.palette = function () {
  const d = (window.Site && window.Site.def) || {}, ramp = d.disk || RAMP0;
  // the hero is always a night sky: a light theme's dark accent would vanish there, so it uses its ramp instead
  return { ramp, st: d.st || ST0, band: d.band || BAND0, hot: d.light ? ramp[1] : cssRGB('--accent') };
};

/* ---------------- the runner ---------------- */
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
function boot() {
  const hero = document.querySelector('.hero'); if (!hero || !ORDER.length) return;
  const btn = hero.querySelector('.scene-btn'), hint = hero.querySelector('.hint');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const asked = new URLSearchParams(location.search).get('hero');
  let id = SCENES[asked] ? asked : SCENES[store.get('hero')] ? store.get('hero') : ORDER[0];
  let cur = null, raf = 0, last = 0, visible = true, pending = false, drag = null;

  function release() {
    if (!cur) return;
    pause(); const { gl, cv } = cur; cur = null;
    const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    cv.remove();
  }
  function paintButton() {
    if (!btn) return;
    const next = SCENES[ORDER[(ORDER.indexOf(id) + 1) % ORDER.length]].name;
    btn.innerHTML = SCENES[id].icon || ''; btn.dataset.label = SCENES[id].name;   // the name is shown on hover (css/base.css)
    btn.setAttribute('aria-label', `Scene: ${SCENES[id].name}. Switch to ${next}`);
    btn.hidden = false;
  }
  function start(next) {
    release();
    id = next; hero.dataset.scene = id; store.set('hero', id); paintButton();
    const def = SCENES[id];
    if (hint) hint.innerHTML = def.hint;
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
    hero.insertBefore(cv, hero.querySelector('.hero-top'));
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) { cv.remove(); return; }
    let inst = null;
    try { inst = def.create(gl, Hero.palette()); } catch (e) { console.warn('hero:', id, e); }
    if (!inst) { cv.remove(); return; }
    cur = { id, def, cv, gl, inst, t: 0 };
    if (hint && inst.hint) hint.innerHTML = inst.hint;   // a scene may say more once it knows the device (e.g. how many particles)
    cv.addEventListener('webglcontextlost', () => { if (cur && cur.cv === cv) { pause(); cur = null; cv.remove(); } });
    render(0); play();
  }
  function render(dt) {
    if (!cur) return;
    const s = Math.min(cur.def.dpr || 1, window.devicePixelRatio || 1) * (cur.def.scale || 1);
    const w = Math.max(1, Math.round(hero.clientWidth * s)), h = Math.max(1, Math.round(hero.clientHeight * s));
    if (cur.cv.width !== w || cur.cv.height !== h) { cur.cv.width = w; cur.cv.height = h; }
    cur.gl.viewport(0, 0, w, h);
    cur.t += dt;
    cur.inst.draw({ gl: cur.gl, w, h, dt, t: cur.t, px: h / 900, dragging: !!drag });
    cur.cv.classList.add('on');
  }
  function frame(ms) {
    raf = 0;
    const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
    render(dt); play();
  }
  function play() { if (cur && !raf && !still && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function pause() { cancelAnimationFrame(raf); raf = 0; last = 0; }
  // one frame on demand (dragging, resizing, a new theme) when the loop is not already running
  function redraw() { if (!cur || raf || pending) return; pending = true; requestAnimationFrame(() => { pending = false; render(0); }); }
  function step(d) { start(ORDER[(ORDER.indexOf(id) + d + ORDER.length) % ORDER.length]); }

  // pointer: x in [-aspect, aspect], y in [-1, 1] (up), the units the scenes use for the screen
  const where = (e) => { const r = hero.getBoundingClientRect(); return [((e.clientX - r.left) / r.height) * 2 - r.width / r.height, 1 - ((e.clientY - r.top) / r.height) * 2]; };
  hero.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('a, button')) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; hero.setPointerCapture(e.pointerId); hero.classList.add('grabbing');
  });
  hero.addEventListener('pointermove', (e) => {
    if (!cur) return;
    if (cur.inst.point) { cur.inst.point(...where(e)); }
    if (drag && e.pointerId === drag.id) {
      if (cur.inst.drag) cur.inst.drag(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY;
    }
    redraw();
  });
  hero.addEventListener('pointerleave', () => { if (cur && cur.inst.point) cur.inst.point(null); });
  const end = () => { drag = null; hero.classList.remove('grabbing'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => hero.addEventListener(t, end));

  if (btn) btn.addEventListener('click', (e) => step(e.shiftKey ? -1 : 1));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 's' || e.key === 'S') step(e.shiftKey ? -1 : 1);
  });
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) play(); else pause(); }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  addEventListener('resize', redraw);
  document.addEventListener('themechange', () => { if (cur && cur.inst.tint) { cur.inst.tint(Hero.palette()); redraw(); } });

  start(id);
}
// start after the page has painted, so the text never waits for the GPU
const go = () => requestAnimationFrame(boot);
if (document.readyState === 'complete') go(); else addEventListener('load', go);
})();
