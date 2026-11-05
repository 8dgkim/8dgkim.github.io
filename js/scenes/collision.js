/* ==========================================================================
   scenes/collision.js : two spiral galaxies colliding and merging, simulated live (v2)
   Each galaxy is a dark-matter halo with a flat rotation curve (pull v0^2 d/(d^2 + rc^2) out to rt, then 1/d^2)
   carrying a bulge, an old disk, young stars, star-forming regions, and dust: 75,000 test stars on circular orbits.
   The halos' centers attract each other, and dynamical friction (a drag on their relative motion where the halos
   overlap) takes orbital energy away, so after the first passage they swing out, fall back, pass again, and merge
   (in simulation units: first pericenter 1.0 at t = 4.6, apocenter 2.7 at t = 7.5, merged near t = 26).
   The tides throw out tails and bridges, which keep raining back onto the remnant. It does not loop.
   Leapfrog (drift-kick-drift) on the CPU; the camera follows the pair and pulls back when they are apart.
   ========================================================================== */
(function () {
'use strict';
const H = window.Hero; if (!H) return;
const RC2 = 0.12 * 0.12, RT = 2.5, MT = RT ** 3 / (RT * RT + RC2), KDF = 0.45, DT = 0.005, SPEED = 0.45;
const PER = { bulge: 5000, old: 18000, young: 9000, dust: 5000, hii: 500 };
const PITCH = 18 * Math.PI / 180;

const VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aK;   // kind (0 old disk, 1 young, 2 bulge, 3 star-forming, 4 dust), tone, galaxy
uniform mat4 uMVP; uniform float uPx;
uniform vec3 uB, uC, uD, uStB, uHot;
out vec3 vCol;
void main(){
  gl_Position = uMVP*vec4(aPos.xzy, 1.0);   // the orbit is in the x-y plane; the camera's up is y
  float kind = aK.x, tone = aK.y; vec3 col; float I, s;
  if (kind == 0.0) { col = mix(uC, uB, 0.3); I = 1.0; s = 1.3; }
  else if (kind == 1.0) { col = mix(uD, uStB, 0.5); I = 1.6 + 8.0*pow(tone, 10.0); s = 1.5; }
  else if (kind == 2.0) { col = mix(uB, uC, 0.5); I = 1.6; s = 1.8; }
  else if (kind == 3.0) { col = mix(uHot, vec3(1.0, 0.45, 0.7), 0.6); I = 6.0; s = 4.5; }
  else { col = vec3(0.13); I = 1.0; s = 14.0; }   // dust: drawn with a darkening blend
  col = mix(col, aK.z < 0.5 ? uStB : uC, 0.15);   // the two galaxies differ a little in color
  gl_PointSize = clamp(s*uPx*8.0/gl_Position.w, 1.0, 48.0);
  vCol = col*I;
}`;
const FS = `#version 300 es
precision mediump float;
in vec3 vCol; out vec4 frag;
void main(){ vec2 d = gl_PointCoord - 0.5; frag = vec4(vCol*exp(-dot(d, d)*16.0), 1.0); }`;

// pull toward a halo center: acceleration = f (dx, dy, dz)
const pull = (d2) => (d2 < RT * RT ? 1 / (d2 + RC2) : MT / (d2 * Math.sqrt(d2)));
const vcirc = (r) => r / Math.sqrt(r * r + RC2);

function sim() {
  const R = Math.random, gauss = () => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());
  const n1 = PER.bulge + PER.old + PER.young, N = 2 * (n1 + PER.dust + PER.hii);
  const x = new Float32Array(N * 3), v = new Float32Array(N * 3), K = new Float32Array(N * 3);
  // the pair: separation 4.5 along x, relative velocity (-0.3, 0.55) (bound; tuned so friction merges them)
  const core = [{ p: [-2.25, 0, 0], v: [0.15, -0.275, 0] }, { p: [2.25, 0, 0], v: [-0.15, 0.275, 0] }];
  const DISK = [[0.35, 0.0], [1.0, 1.2]];   // inclination and node of each disk (both turn with the orbit)
  const orient = (p, inc, node) => { const y = p[1] * Math.cos(inc) - p[2] * Math.sin(inc), z = p[1] * Math.sin(inc) + p[2] * Math.cos(inc);
    return [p[0] * Math.cos(node) - y * Math.sin(node), p[0] * Math.sin(node) + y * Math.cos(node), z]; };
  let i = 0;
  function put(g, kind, lp, lv, local) {
    const c = core[g], [inc, node] = DISK[g];
    const P = local ? lp : orient(lp, inc, node), V = local ? lv : orient(lv, inc, node);
    for (let d = 0; d < 3; d++) { x[i * 3 + d] = c.p[d] + P[d]; v[i * 3 + d] = c.v[d] + V[d]; }
    K[i * 3] = kind; K[i * 3 + 1] = R(); K[i * 3 + 2] = g; i++;
  }
  // a star on a circular orbit in the disk plane, at radius r and angle th
  const disk = (g, kind, r, th, h) => { const vc = vcirc(r); put(g, kind, [r * Math.cos(th), r * Math.sin(th), gauss() * h], [-vc * Math.sin(th), vc * Math.cos(th), 0]); };
  const armTh = (g, r) => (R() < 0.5 ? 0 : Math.PI) + g * 1.3 - Math.log(r / 0.15) / Math.tan(PITCH);   // two trailing arms
  const armR = () => 0.15 + 0.95 * Math.sqrt(R());
  for (let g = 0; g < 2; g++) {
    for (let k = 0; k < PER.bulge; k++) {   // bulge: circular orbits in random planes
      const r = Math.min(0.3, 0.02 - 0.06 * Math.log(1 - 0.99 * R())), n = [gauss(), gauss(), gauss()], ln = Math.hypot(...n) || 1;
      const nn = n.map((c) => c / ln), a = Math.abs(nn[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      let u = [nn[1] * a[2] - nn[2] * a[1], nn[2] * a[0] - nn[0] * a[2], nn[0] * a[1] - nn[1] * a[0]]; const lu = Math.hypot(...u); u = u.map((c) => c / lu);
      const w = [nn[1] * u[2] - nn[2] * u[1], nn[2] * u[0] - nn[0] * u[2], nn[0] * u[1] - nn[1] * u[0]];
      const ph = 2 * Math.PI * R(), vc = vcirc(r);
      put(g, 2, [0, 1, 2].map((d) => r * (u[d] * Math.cos(ph) + w[d] * Math.sin(ph))), [0, 1, 2].map((d) => vc * (-u[d] * Math.sin(ph) + w[d] * Math.cos(ph))), true);
    }
    for (let k = 0; k < PER.old; k++) disk(g, 0, Math.min(1.4, 0.08 - 0.3 * Math.log(1 - 0.98 * R())), 2 * Math.PI * R(), 0.02);
    for (let k = 0; k < PER.young; k++) { const r = armR(); disk(g, 1, r, armTh(g, r) + gauss() * 0.12 / (0.5 + r), 0.008); }
  }
  const nLight = i;
  for (let g = 0; g < 2; g++) for (let k = 0; k < PER.dust; k++) { const r = armR(); disk(g, 4, r, armTh(g, r) - 0.1 + gauss() * 0.08 / (0.5 + r), 0.005); }
  const nDust = i - nLight;
  for (let g = 0; g < 2; g++) for (let k = 0; k < PER.hii; k++) { const r = armR(); disk(g, 3, r, armTh(g, r) + 0.04 + gauss() * 0.06 / (0.5 + r), 0.004); }

  function step(dt) {
    const h = dt / 2, [a, b] = core;
    for (let d = 0; d < 3; d++) { a.p[d] += a.v[d] * h; b.p[d] += b.v[d] * h; }
    for (let j = 0; j < N * 3; j++) x[j] += v[j] * h;
    // the halos pull on each other; dynamical friction drags on their relative motion where they overlap
    const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2], d2 = dx * dx + dy * dy + dz * dz, f = pull(d2) * dt;
    const fr = 0.5 * KDF * Math.pow(1 + d2 / 0.64, -1.5) * dt;
    for (let d = 0; d < 3; d++) {
      const rel = [dx, dy, dz][d], vr = b.v[d] - a.v[d];
      a.v[d] += rel * f + fr * vr; b.v[d] += -rel * f - fr * vr;
    }
    // every star feels both halos
    const ax0 = a.p[0], ay0 = a.p[1], az0 = a.p[2], bx0 = b.p[0], by0 = b.p[1], bz0 = b.p[2];
    for (let j = 0; j < N * 3; j += 3) {
      const ax = ax0 - x[j], ay = ay0 - x[j + 1], az = az0 - x[j + 2], fa = pull(ax * ax + ay * ay + az * az) * dt;
      const bx = bx0 - x[j], by = by0 - x[j + 1], bz = bz0 - x[j + 2], fb = pull(bx * bx + by * by + bz * bz) * dt;
      v[j] += ax * fa + bx * fb; v[j + 1] += ay * fa + by * fb; v[j + 2] += az * fa + bz * fb;
    }
    for (let d = 0; d < 3; d++) { a.p[d] += a.v[d] * h; b.p[d] += b.v[d] * h; }
    for (let j = 0; j < N * 3; j++) x[j] += v[j] * h;
  }
  return {
    x, K, N, nLight, nDust, core,
    advance(simDt) { for (let n = Math.ceil(simDt / DT), k = 0; k < n; k++) step(simDt / n); },
    sep() { const [a, b] = core; return Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]); },
  };
}

H.add('collision', {
  name: 'Galaxy Collision',
  icon: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><ellipse cx="6" cy="8.5" rx="4.8" ry="2.1" transform="rotate(-28 6 8.5)"/><ellipse cx="10.4" cy="7.5" rx="4.4" ry="1.9" transform="rotate(32 10.4 7.5)"/><circle cx="6" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="10.4" cy="7.5" r="0.9" fill="currentColor" stroke="none"/></svg>', scale: 1, dpr: 1.5,
  hint: 'Two spiral galaxies colliding, simulated live: their tides pull out long tails of stars, and they fall back together and merge into one. Drag to change the view.',
  create(gl, pal) {
    const prog = H.program(gl, VS, FS), post = H.post(gl), sky = H.sky(gl); if (!prog || !post) return null;
    const U = H.uniforms(gl, prog, ['uMVP', 'uPx']);
    const S = sim(), { vao, bufs } = H.arrays(gl, [[S.x, 3], [S.K, 3]], gl.DYNAMIC_DRAW);
    const cam = { dist: 9, el: 0.7, az: 0.4, fov: 0.7 };
    let p = pal;
    return {
      tint(q) { p = q; },
      drag(dx, dy) { cam.az += dx * 0.005; cam.el = Math.min(1.5, Math.max(-1.5, cam.el + dy * 0.004)); },
      draw({ w, h, dt, px, dragging }) {
        if (!dragging) cam.az += dt * 0.015;
        S.advance(Math.min(dt, 0.05) * SPEED);
        // frame the pair: closer when they are close, back when they swing apart
        const goal = 3.6 + 1.2 * Math.max(S.sep(), 1.8);
        cam.dist += (goal - cam.dist) * (1 - Math.exp(-dt / 3));
        const [a, b] = S.core, mid = [(a.p[0] + b.p[0]) / 2, (a.p[2] + b.p[2]) / 2, (a.p[1] + b.p[1]) / 2];
        const mvp = H.mat.mul(H.orbit(cam, w / h), H.mat.tr(-mid[0], -mid[1], -mid[2]));
        post.begin(w, h);
        if (sky) sky.draw(w, h, p);
        gl.useProgram(prog); H.setPal(gl, U, p); gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufs[0]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, S.x);
        gl.uniformMatrix4fv(U.uMVP, false, mvp); gl.uniform1f(U.uPx, px);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, 0, S.nLight);
        gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR); gl.drawArrays(gl.POINTS, S.nLight, S.nDust);
        gl.blendFunc(gl.ONE, gl.ONE); gl.drawArrays(gl.POINTS, S.nLight + S.nDust, S.N - S.nLight - S.nDust);
        post.end({ exposure: 1.2, bloom: 0.8 });
      },
    };
  },
});
})();
