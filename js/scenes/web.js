/* ==========================================================================
   scenes/web.js : a flight through the cosmic web, in the Zel'dovich approximation (v2)
   A Gaussian random density field delta(k) with power P(k) ~ k^-1 exp(-(k/kc)^2) on a 64^3 periodic grid
   (white noise, FFT, filtered); its displacement field psi(k) = i k delta(k) / k^2 moves each particle from
   its starting point q:  x(q, t) = q + D(t) psi(q)  (Zel'dovich 1970). As the growth factor D rises, matter
   streams out of voids into sheets, filaments, and knots.
   Each particle also carries the density it will end up in (counted on a 32^3 grid at the final D), which sets
   its color and brightness: faint blue in sheets, gold in filaments, white in the knots where clusters form.
   The camera flies slowly through the periodic box, which is re-centered on it every frame, so the flight never
   ends; far particles fade before the box repeats. 262,144 particles; the FFTs run once, on load.
   ========================================================================== */
(function () {
'use strict';
const H = window.Hero; if (!H) return;
const n = 64, N = n * n * n, DMAX = 2.7, NG = 32;

// in-place radix-2 complex FFT of one line
function fft1(re, im, inv) {
  const m = re.length;
  for (let i = 1, j = 0; i < m; i++) {
    let bit = m >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= m; len <<= 1) {
    const ang = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < m; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
// 3-D FFT: one line at a time along each axis (index = (z n + y) n + x)
function fft3(re, im, inv) {
  const lr = new Float64Array(n), li = new Float64Array(n), strides = [1, n, n * n];
  for (let ax = 0; ax < 3; ax++) {
    const s = strides[ax], o1 = strides[(ax + 1) % 3], o2 = strides[(ax + 2) % 3];
    for (let u = 0; u < n; u++) for (let w = 0; w < n; w++) {
      const base = u * o1 + w * o2;
      for (let k = 0; k < n; k++) { lr[k] = re[base + k * s]; li[k] = im[base + k * s]; }
      fft1(lr, li, inv);
      for (let k = 0; k < n; k++) { re[base + k * s] = lr[k]; im[base + k * s] = li[k]; }
    }
  }
}
function build() {
  const R = Math.random, gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());
  const dr = new Float64Array(N), di = new Float64Array(N);
  for (let i = 0; i < N; i++) dr[i] = gauss();
  fft3(dr, di, false);
  const kc = 11, kf = (i) => (i <= n / 2 ? i : i - n);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (z * n + y) * n + x, k2 = kf(x) ** 2 + kf(y) ** 2 + kf(z) ** 2;
    const amp = k2 === 0 ? 0 : Math.sqrt(Math.pow(k2, -0.5) * Math.exp(-k2 / (kc * kc)));
    dr[i] *= amp; di[i] *= amp;
  }
  // psi_j(k) = i k_j delta(k) / k^2, one inverse FFT per component
  const psi = [0, 1, 2].map((ax) => {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (z * n + y) * n + x, k2 = kf(x) ** 2 + kf(y) ** 2 + kf(z) ** 2; if (k2 === 0) continue;
      const kj = (ax === 0 ? kf(x) : ax === 1 ? kf(y) : kf(z)) / k2;
      re[i] = -kj * di[i]; im[i] = kj * dr[i];
    }
    fft3(re, im, true); return re;
  });
  // scale so the rms displacement is one grid cell at D = 1
  let ss = 0; for (let i = 0; i < N; i++) ss += psi[0][i] ** 2 + psi[1][i] ** 2 + psi[2][i] ** 2;
  const sc = 1 / (n * Math.sqrt(ss / N));
  const Q = new Float32Array(N * 3), S = new Float32Array(N * 4), cell = new Int32Array(N), count = new Float32Array(NG * NG * NG);
  const wrap = (u) => u - Math.floor(u);
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (z * n + y) * n + x, q = [(x + 0.5 + (R() - 0.5) * 0.6) / n, (y + 0.5 + (R() - 0.5) * 0.6) / n, (z + 0.5 + (R() - 0.5) * 0.6) / n];
    const d = [psi[0][i] * sc, psi[1][i] * sc, psi[2][i] * sc];
    Q.set(q, i * 3); S.set(d, i * 4);
    // where it ends up at the final growth factor, on the coarse grid
    const g = q.map((c, k) => Math.min(NG - 1, Math.floor(wrap(c + DMAX * d[k]) * NG)));
    cell[i] = (g[2] * NG + g[1]) * NG + g[0]; count[cell[i]] += 1;
  }
  const mean = N / count.length;
  for (let i = 0; i < N; i++) S[i * 4 + 3] = count[cell[i]] / mean;   // final density, in units of the mean
  return { Q, S };
}

const VS = `#version 300 es
layout(location = 0) in vec3 aQ;
layout(location = 1) in vec4 aS;   // displacement psi (box units at D = 1), final density / mean
uniform mat4 uVP; uniform vec3 uCam; uniform float uGrow, uRipe, uFocal;
uniform vec3 uB, uC, uD, uStB, uHot;
out vec3 vCol;
void main(){
  vec3 p = fract(aQ + uGrow*aS.xyz - uCam) - 0.5;   // periodic box, centered on the camera
  float dist = length(p);
  float fade = (1.0 - smoothstep(0.28, 0.5, dist))*smoothstep(0.004, 0.03, dist);
  gl_Position = uVP*vec4(p, 1.0);
  // color by the density the particle is heading for, faded in as the structure grows
  float t = clamp(log(max(aS.w, 0.05))/log(30.0), 0.0, 1.0)*uRipe;
  vec3 cool = mix(uD, uStB, 0.5), warm = mix(uC, uB, 0.4), hot = mix(vec3(1.0), uHot, 0.15);
  vec3 col = t < 0.5 ? mix(cool, warm, 2.0*t) : mix(warm, hot, 2.0*t - 1.0);
  float I = 0.35 + 3.0*t*t;
  gl_PointSize = clamp(0.0012*uFocal/max(gl_Position.w, 0.001), 1.0, 24.0);   // 0.0012 box units across, in perspective
  vCol = col*I*fade;
}`;
const FS = `#version 300 es
precision mediump float;
in vec3 vCol; out vec4 frag;
void main(){ vec2 d = gl_PointCoord - 0.5; frag = vec4(vCol*exp(-dot(d, d)*12.0), 1.0); }`;

H.add('web', {
  name: 'Cosmic Web',
  icon: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M3 4.5 L8 8 L13 3.5 M8 8 L4 12.5 M8 8 L12.5 12 M3 4.5 L4 12.5 M13 3.5 L12.5 12"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="4.5" r="1" fill="currentColor" stroke="none"/><circle cx="13" cy="3.5" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12.5" r="1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="12" r="1" fill="currentColor" stroke="none"/></svg>', scale: 1, dpr: 1.5,
  hint: 'Flying through the cosmic web, computed live: small ripples in a nearly uniform universe grow into sheets, filaments, and the knots where galaxy clusters form (Zel\'dovich approximation). Drag to look around.',
  create(gl, pal) {
    const prog = H.program(gl, VS, FS), post = H.post(gl), sky = H.sky(gl); if (!prog || !post) return null;
    const U = H.uniforms(gl, prog, ['uVP', 'uCam', 'uGrow', 'uRipe', 'uFocal']);
    const g = build(), { vao } = H.arrays(gl, [[g.Q, 3], [g.S, 4]]);
    const look = { el: 0.15, az: 0.4 }, pos = [0.5, 0.5, 0.5];
    let p = pal, age = 0;
    return {
      tint(q) { p = q; },
      drag(dx, dy) { look.az += dx * 0.004; look.el = Math.min(1.3, Math.max(-1.3, look.el + dy * 0.003)); },
      draw({ w, h, dt }) {
        age += dt;
        // growth factor: from almost uniform to a well-developed web over about 20 s, then it holds
        const ripe = Math.pow(1 - Math.exp(-age / 7), 1.5), D = 0.25 + (DMAX - 0.25) * ripe;
        // fly forward along the view, with a slow turn
        look.az += dt * 0.012;
        const fwd = [Math.cos(look.el) * Math.sin(look.az), Math.sin(look.el), -Math.cos(look.el) * Math.cos(look.az)];
        for (let k = 0; k < 3; k++) pos[k] = (pos[k] + fwd[k] * dt * 0.012) % 1;
        const view = H.mat.mul(H.mat.rx(-look.el), H.mat.ry(look.az)), fov = 1.0;
        const vp = H.mat.mul(H.mat.persp(fov, w / h, 0.002, 2), view);
        post.begin(w, h);
        if (sky) sky.draw(w, h, p);
        gl.useProgram(prog); H.setPal(gl, U, p); gl.bindVertexArray(vao);
        gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniform3fv(U.uCam, pos);
        gl.uniform1f(U.uGrow, D); gl.uniform1f(U.uRipe, ripe); gl.uniform1f(U.uFocal, (h / 2) / Math.tan(fov / 2));
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.drawArrays(gl.POINTS, 0, N);
        post.end({ exposure: 1.4, bloom: 1.0 });
      },
    };
  },
});
})();
