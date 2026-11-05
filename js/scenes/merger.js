/* ==========================================================================
   scenes/merger.js : black holes merging one after another, the waves they send out, and the light they bend (v3)
   The loop: two holes of equal mass spiral in from a separation of 1.1, the orbit shrinking as gravitational waves
   carry energy away (da/dt = -beta/a^3 with Kepler omega^2 a^3 = const: the leading-order chirp, 4.5 orbits in 14 s),
   touch, fall together into one hole of 1.9 masses, and ring down. Then nothing happens until the waves have left
   the sheet (checked on the recorded history). Then the view zooms out slowly by 1.9 (an equal merger is self-similar:
   the remnant becomes the size of one hole again) while a new hole of the same mass falls in from beyond an edge of
   the screen (a different one each time); its waves build up only as it comes close; it curves into orbit, and the camera's focus shifts slowly from the remnant to the
   pair's center, arriving exactly as they reach a separation of 1.1: the first scene of the loop. Real time throughout;
   no phase has a fixed length.
   Waves: a sheet of space is displaced by the wave at the retarded time t - r/c, read from a recorded history of
   the source (A cos 2 phase, A sin 2 phase; 512 samples at 60 per second), so waves of one merger are still
   crossing the sheet while the next pair starts:  h(r, phi, t) ~ A(t_ret) cos(2 phase(t_ret) - 2 phi) / sqrt(r).
   Light: the sky behind is lensed by both holes (thin lens, two point masses: beta = theta - sum theta_E^2 d/|d|^2);
   the shadows are one smooth shape, so they merge through a peanut, and the new hole's shadow wobbles while it
   rings down. A photon ring lines the shadow's edge. Sizes, amplitudes, and the wave speed are chosen to be seen.
   ========================================================================== */
(function () {
'use strict';
const H = window.Hero; if (!H) return;
const MV = 2.25, A0 = 1.1, AM = 0.3;                            // Kepler constant (omega^2 a^3); separation where the loop starts; at contact
const BETA = A0 ** 4 / (4 * 14);                                 // chirp da/dt = -beta/a^3: from a0 to contact in about 14 s, 4.5 orbits
const AFOCUS = 4, AWAVE = 5, KIN = 0.3, CAP = 1.4;              // the camera turns to the pair inside AFOCUS, its waves build up inside AWAVE; fall-in rate
// where newcomers come from, relative to the screen (degrees from screen right, counterclockwise as seen from above):
// right, left, upper right, upper left, lower right, lower left
const DIRS = [0, 180, 35, 145, -30, -150];
const SC = 0.5, ZOOM_T = 9, GROW = 1.9;                         // fall-together time, slow zoom-out, mass of the remnant
const WM = Math.sqrt(MV / AM ** 3);                              // orbital angular frequency at contact
const CV = 1.4, RG = 8, G = 161, NH = 512, HS = 1 / 60;          // wave speed, sheet radius and lines, history length and step
const KE = 1.56, KS = 0.54;                                       // Einstein radius and shadow radius on screen, times depth
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const f = (x) => x.toFixed(6);

const VS = `#version 300 es
precision highp sampler2D;
layout(location = 0) in vec2 aXZ;
uniform mat4 uMVP; uniform float uFade; uniform vec3 uP1, uP2; uniform vec2 uM, uSrc;
uniform sampler2D uHist; uniform int uHead;
uniform vec3 uD, uStB, uHot;
out vec3 vCol;
const float CV = ${f(CV)}, RG = ${f(RG)}, HS = ${f(HS)};
const int NH = ${NH};
// the source's (A cos 2 phase, A sin 2 phase), 'back' seconds ago
vec2 hist(float back){
  float k = back/HS; int i = int(floor(k)); float u = k - float(i);
  if (i >= NH - 1) return vec2(0.0);
  vec2 a = texelFetch(uHist, ivec2((uHead - i + NH) % NH, 0), 0).xy, b = texelFetch(uHist, ivec2((uHead - i - 1 + NH) % NH, 0), 0).xy;
  return mix(a, b, u);
}
void main(){
  vec2 x = aXZ, d = x - uSrc; float r = length(d), ph = atan(d.y, d.x);
  vec2 h = hist(r/CV);
  float wave = 0.32*(h.x*cos(2.0*ph) + h.y*sin(2.0*ph))*smoothstep(0.3, 1.2, r)/sqrt(r + 0.6);
  // a well under each hole, in proportion to its mass (two holes on one spot make the same well as one of both masses)
  vec2 e1 = x - uP1.xz, e2 = x - uP2.xz;
  float well = -0.15*uM.x/sqrt(dot(e1, e1) + 0.04) - 0.15*uM.y/sqrt(dot(e2, e2) + 0.04);
  gl_Position = uMVP*vec4(x.x, wave + well, x.y, 1.0);
  float edge = 1.0 - smoothstep(0.55*RG, RG, length(x));
  vec3 base = mix(uD, uStB, 0.5)*0.35, crest = mix(uHot, vec3(1.0), 0.3);
  vCol = (base + crest*max(0.0, wave)*1.5)*edge*uFade;
}`;
const FS = `#version 300 es
precision mediump float;
in vec3 vCol; out vec4 frag;
void main(){ frag = vec4(vCol, 1.0); }`;

// the lensed sky and the shadows, over the sheet: out = color + below * (1 - shadow)
const LENS = `#version 300 es
precision highp float;
uniform vec2 uRes, uSkyOff; uniform vec4 uBH1, uBH2; uniform vec2 uWob; uniform float uFade;
uniform vec3 uA, uB, uC, uD, uStA, uStB, uBand, uHot;
out vec4 frag;
${H.HASH}
float vnoise(vec2 p){ vec2 i = floor(p), u = fract(p); u = u*u*(3.0 - 2.0*u);
  return mix(mix(h1(i), h1(i + vec2(1.0, 0.0)), u.x), mix(h1(i + vec2(0.0, 1.0)), h1(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += a*vnoise(p); p = p*2.03 + 1.7; a *= 0.5; } return s; }
// a band of the galaxy with dust lanes, and three layers of stars (denser in the band)
vec3 sky(vec2 b){
  vec2 s = b + uSkyOff;
  float y = s.y*0.9 + 0.25*sin(s.x*0.8), band = exp(-4.0*y*y);
  float dust = smoothstep(0.45, 0.7, fbm(s*3.0));
  vec3 c = (uBand*2.0 + mix(uC, uStB, 0.5)*0.08)*band*(0.4 + 0.9*fbm(s*1.5 + 7.0))*(1.0 - 0.75*dust);
  for (int l = 0; l < 3; l++) {
    float sc = l == 0 ? 40.0 : (l == 1 ? 90.0 : 200.0);
    vec2 g = s*sc, id = floor(g);
    if (h1(id + float(l)*11.0) > (l == 2 ? 0.86 - 0.1*band : 0.93 - 0.05*band)) {
      vec2 q = fract(g) - 0.5 - (vec2(h1(id + 1.3), h1(id + 2.9)) - 0.5)*0.6;
      c += mix(uStA, uStB, h1(id + 4.4))*(0.15 + 2.0*pow(h1(id + 6.6), 8.0))*exp(-dot(q, q)*(l == 0 ? 50.0 : 90.0));
    }
  }
  return c;
}
void main(){
  vec3 col = vec3(0.0); float shadow = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = (vec2(float(k % 2), float(k / 2)) - 0.5)*0.5;
    vec2 th = (gl_FragCoord.xy + o - 0.5*uRes)/(0.5*uRes.y);
    vec2 d1 = th - uBH1.xy, d2 = th - uBH2.xy;
    vec2 b = th - uBH1.z*uBH1.z*d1/(dot(d1, d1) + 1e-6) - uBH2.z*uBH2.z*d2/(dot(d2, d2) + 1e-6);
    // shadows: one smooth shape; after a merger it is squeezed along a turning axis as the new hole rings down
    float ca = cos(uWob.y), sa = sin(uWob.y);
    vec2 e1 = vec2(ca*d1.x + sa*d1.y, -sa*d1.x + ca*d1.y), e2 = vec2(ca*d2.x + sa*d2.y, -sa*d2.x + ca*d2.y);
    float k1 = e1.x*e1.x*(1.0 + uWob.x) + e1.y*e1.y*(1.0 - uWob.x), k2 = e2.x*e2.x*(1.0 + uWob.x) + e2.y*e2.y*(1.0 - uWob.x);
    float m = uBH1.w*uBH1.w/max(k1, 1e-8) + uBH2.w*uBH2.w/max(k2, 1e-8);
    float sh = smoothstep(0.85, 1.05, m), rg = (m - 0.75)/0.12;
    vec3 ring = mix(vec3(1.0, 0.9, 0.75), uHot, 0.3)*exp(-rg*rg)*0.8;
    col += (sky(b) + ring)*(1.0 - sh); shadow += sh;
  }
  frag = vec4(col*0.25*uFade, shadow*0.25);
}`;

function grid() {
  const V = new Float32Array(G * G * 2), I = new Uint32Array(2 * 2 * (G - 1) * G);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { V[(j * G + i) * 2] = (i / (G - 1) * 2 - 1) * RG; V[(j * G + i) * 2 + 1] = (j / (G - 1) * 2 - 1) * RG; }
  let k = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G - 1; i++) { I[k++] = j * G + i; I[k++] = j * G + i + 1; }
  for (let i = 0; i < G; i++) for (let j = 0; j < G - 1; j++) { I[k++] = j * G + i; I[k++] = (j + 1) * G + i; }
  return { V, I };
}

// the approach and inspiral, shared by the chain and by the choice of where a newcomer starts
const zoomAt = (tz) => 1 + (GROW - 1) * (1 - smooth(tz / ZOOM_T));   // during an approach: from the remnant's scale to one hole's
const focusAt = (a) => smooth((AFOCUS - a) / (AFOCUS - A0));          // 0: camera on hole A, 1: on the pair's center
const fall = (a, h) => a - h * (BETA / a ** 3 + KIN * Math.min(CAP, Math.max(0, a - A0)));   // falling in beyond a0, then the chirp
// holes A and B on the sheet, and the center of mass, in render coordinates: zoom * (position - camera target)
function pose(a, ph, z, f) {
  const c = (a / 2) * Math.cos(ph), s = (a / 2) * Math.sin(ph), T = [-c * (1 - f), -s * (1 - f)];
  return { P: [[z * (-c - T[0]), z * (-s - T[1])], [z * (c - T[0]), z * (s - T[1])]], src: [-z * T[0], -z * T[1]] };
}

// the chain of mergers, stepped at a fixed rate; positions in the current pair's units (center of mass at 0)
function chain(pickStart) {
  const hist = new Float32Array(NH * 4); let head = 0;
  // phases: 'inspiral', 'merge' (touch, fall together, ring down), 'calm' (the waves leave the sheet), 'approach' (a newcomer falls in)
  const S = { phase: 'inspiral', a: 1.25, ph: Math.random() * 2 * Math.PI, s: 0, tz: 0 };
  const zoomOf = () => (S.phase === 'approach' ? zoomAt(S.tz) : 1);
  const focusOf = () => (S.phase === 'approach' ? focusAt(S.a) : 1);
  // is the part of the history still crossing the sheet quiet?
  function quiet() {
    const n = Math.min(NH - 1, Math.ceil(RG * 1.1 / CV / HS));
    for (let k = 0; k < n; k++) { const i = (((head - k) % NH) + NH) % NH; if (Math.hypot(hist[i * 4], hist[i * 4 + 1]) > 0.02) return false; }
    return true;
  }
  function step(h) {
    let amp;
    if (S.phase === 'approach' || S.phase === 'inspiral') {
      if (S.phase === 'approach') S.tz += h;
      S.a = fall(S.a, h);
      if (S.phase === 'approach' && S.a <= A0) S.phase = 'inspiral';
      if (S.a <= AM) { S.a = AM; S.phase = 'merge'; S.s = 0; }
      S.ph += h * Math.sqrt(MV / S.a ** 3);
      amp = Math.min(3.5, Math.pow(1.1 / S.a, 0.9));
      // a newcomer's waves start from nothing and build up as the pair closes in (no front sweeping in from off screen)
      if (S.phase === 'approach') amp *= smooth(S.tz / 3) * smooth((AWAVE - S.a) / (AWAVE - A0));
    } else {
      S.s += h; S.ph += h * WM * (S.s < SC ? 1 : 1.3);   // after contact: ringdown near the last frequency
      amp = Math.pow(1.1 / AM, 0.9) * Math.exp(-S.s / 0.5);
      if (S.phase === 'merge' && S.s > SC + 1.5) S.phase = 'calm';
      // the remnant becomes hole A of the next pair, in units of its mass; the newcomer B starts just beyond an edge of the screen
      // The waves are read from the history around the current source, the pair's center, which now jumps off screen
      // (between the remnant and the newcomer). Seen from there, older parts of the history (the merger, still recorded)
      // would land on the sheet and replay as a ripple coming in from outside; what is still on the sheet is quiet, so clear it.
      if (S.phase === 'calm' && quiet()) { const st = pickStart(); S.phase = 'approach'; S.a = st.a; S.tz = 0; S.ph = st.ph; hist.fill(0); }
    }
    amp *= zoomOf();
    head = (head + 1) % NH;
    hist[head * 4] = amp * Math.cos(2 * S.ph); hist[head * 4 + 1] = amp * Math.sin(2 * S.ph);
  }
  // what to draw: render coordinates = zoom * (position - camera target)
  function view() {
    const z = zoomOf(), f = focusOf(), appear = S.phase === 'approach' ? smooth(S.tz / 3) : 1;   // the newcomer's lensing and well fade in off screen
    let a = S.a, lm = 1, shade = 1, wob = [0, 0];
    if (S.phase === 'merge' || S.phase === 'calm') {
      const u = Math.min(1, S.s / SC);
      a = AM * (1 - u); lm = 1 - 0.05 * u; shade = 1 + (GROW / Math.SQRT2 - 1) * u;
      if (S.s > SC) wob = [0.2 * Math.exp(-(S.s - SC) / 0.6) * Math.cos(2.6 * WM * (S.s - SC)), S.ph];
    }
    const { P, src } = pose(a, S.ph, z, f);
    return { P, src, m: [z * lm, z * lm * appear], shade: [z * shade, z * shade * appear], wob };
  }
  return { S, hist, step, view, get head() { return head; } };
}
const project = (m, p) => { const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [x / w, y / w, w]; };
// depth of the sheet at p (the same wells as the shader, without the wave)
const depth = (p, P, m) => P.reduce((y, q, i) => y - 0.15 * m[i] / Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + 0.04), 0);

H.add('merger', {
  name: 'Black Hole Merger',
  icon: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><ellipse cx="8" cy="8" rx="6.6" ry="3.4" stroke-dasharray="1.6 1.6"/><circle cx="4.9" cy="8" r="2" fill="currentColor"/><circle cx="11.1" cy="8" r="2" fill="currentColor"/></svg>', scale: 1, dpr: 1,
  hint: 'Black holes merging, one after another, computed live: each pair spirals in, sends out gravitational waves and bends the light of the stars behind it, merges, and rings down, and the new hole is joined by the next. Drag to look around.',
  create(gl, pal) {
    const prog = H.program(gl, VS, FS), lens = H.program(gl, H.VERT, LENS), post = H.post(gl); if (!prog || !lens || !post) return null;
    const U = H.uniforms(gl, prog, ['uMVP', 'uFade', 'uP1', 'uP2', 'uM', 'uSrc', 'uHist', 'uHead']);
    const L = H.uniforms(gl, lens, ['uRes', 'uSkyOff', 'uBH1', 'uBH2', 'uWob', 'uFade']), fvao = H.fullscreen(gl);
    const g = grid(), { vao } = H.arrays(gl, [[g.V, 2]]);
    gl.bindVertexArray(vao); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.I, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const cam = { dist: 12, el: 0.45, az: 0.3, fov: 0.7 };
    let mvp = H.orbit(cam, 16 / 9);
    // where the next newcomer starts: the remnant is at the origin of the sheet; screen right on the sheet is (cos az, sin az),
    // screen up (away from the camera) is (sin az, -cos az). For a direction (in random order), the nearest separation from
    // which the newcomer, flying the approach ahead of time, stays out of the frame for most of the zoom and never
    // comes near the camera. Directions that cannot do that from this view are skipped.
    function clears(a, ph) {
      for (let tz = 0; a > A0; tz += HS) {
        const B = pose(a, ph, zoomAt(tz), focusAt(a)).P[1], q = project(mvp, [B[0], 0, B[1]]);
        if (q[2] < 1.5) return false;
        if (tz < 0.7 * ZOOM_T && Math.abs(q[0]) < 1.12 && Math.abs(q[1]) < 1.12) return false;
        a = fall(a, HS); ph += HS * Math.sqrt(MV / a ** 3);
      }
      return true;
    }
    function pickStart() {
      const R = [Math.cos(cam.az), Math.sin(cam.az)], F = [Math.sin(cam.az), -Math.cos(cam.az)];
      for (const deg of DIRS.slice().sort(() => Math.random() - 0.5)) {
        const th = deg * Math.PI / 180, ph = Math.atan2(Math.cos(th) * R[1] + Math.sin(th) * F[1], Math.cos(th) * R[0] + Math.sin(th) * F[0]);
        for (let a = 3; a <= 20; a += 0.5) if (clears(a, ph)) return { a, ph };
      }
      return { a: 12, ph: cam.az };   // from the right
    }
    const C = chain(pickStart);
    for (let k = 0; k < 7 / HS; k++) C.step(HS);   // settle into the first inspiral, with its waves already out on the sheet
    const htex = gl.createTexture(); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, htex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, NH, 1, 0, gl.RGBA, gl.FLOAT, C.hist);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST));
    let p = pal, acc = 0, age = 0;
    return {
      tint(q) { p = q; },
      drag(dx, dy) { cam.az += dx * 0.005; cam.el = Math.min(1.5, Math.max(0.05, cam.el + dy * 0.004)); },
      draw({ w, h, dt, dragging }) {
        if (!dragging) cam.az += dt * 0.015;
        const asp = w / h; mvp = H.orbit(cam, asp);
        for (acc += Math.min(dt, 0.1); acc >= HS; acc -= HS) C.step(HS);
        age += dt;
        const fade = Math.min(1, age / 1.2), v = C.view();
        const P3 = v.P.map((q) => [q[0], depth(q, v.P, v.m), q[1]]);
        post.begin(w, h);
        // the sheet of space and its waves
        gl.useProgram(prog); H.setPal(gl, U, p); gl.bindVertexArray(vao);
        gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, htex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, NH, 1, gl.RGBA, gl.FLOAT, C.hist);
        gl.uniform1i(U.uHist, 5); gl.uniform1i(U.uHead, C.head);
        gl.uniformMatrix4fv(U.uMVP, false, mvp); gl.uniform1f(U.uFade, fade);
        gl.uniform3fv(U.uP1, P3[0]); gl.uniform3fv(U.uP2, P3[1]); gl.uniform2fv(U.uM, v.m); gl.uniform2fv(U.uSrc, v.src);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawElements(gl.LINES, g.I.length, gl.UNSIGNED_INT, 0);
        // the lensed sky and the shadows, on top
        const bh = (i) => { const q = project(mvp, P3[i]); return [q[0] * asp, q[1], KE * Math.sqrt(v.m[i]) / q[2], KS * v.shade[i] / q[2]]; };
        gl.useProgram(lens); H.setPal(gl, L, p); gl.bindVertexArray(fvao);
        gl.uniform2f(L.uRes, w, h); gl.uniform2f(L.uSkyOff, cam.az * 0.6, cam.el * 0.6);
        gl.uniform4fv(L.uBH1, bh(0)); gl.uniform4fv(L.uBH2, bh(1)); gl.uniform2fv(L.uWob, v.wob); gl.uniform1f(L.uFade, fade);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        post.end({ exposure: 1.3, bloom: 0.8 });
      },
    };
  },
});
})();
