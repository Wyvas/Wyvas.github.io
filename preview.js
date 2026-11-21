/* NebulaFX — aperçu animé de l'interface du plugin, recréée à partir de son code source.
   Six vues qui défilent : éditeur Système, Scratch Pad, Timeline, Courbes, mode Simple, « Create a system ». */
(() => {
  const N = window.NFX;
  const host = document.getElementById("pvHost");
  if (!N || !host) return;
  const { icon: I, reduce, t } = N;
  const DUR = 4; // durée de boucle du système (s), comme dans le plugin

  /* =====================================================================
     Moteur de particules 3D (canvas 2D, projection perspective)
     ===================================================================== */
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const lerp = (a, b, k) => a + (b - a) * k;
  const mix = (c0, c1, k) => [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // Sprites lumineux mis en cache par couleur (quantifiée)
  const spriteCache = new Map();
  const glowSprite = (c) => {
    const q = (v) => Math.max(0, Math.min(255, Math.round(v / 16) * 16));
    const key = q(c[0]) + "," + q(c[1]) + "," + q(c[2]);
    let s = spriteCache.get(key);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d");
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(255,255,255,1)`);
      gr.addColorStop(0.18, `rgba(${key},0.95)`);
      gr.addColorStop(0.5, `rgba(${key},0.28)`);
      gr.addColorStop(1, `rgba(${key},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      spriteCache.set(key, s);
    }
    return s;
  };

  const CONF = ["#ff4d6d", "#ffd23f", "#3ddc97", "#4cc9f0", "#b9a6ff", "#ff8c42"].map(hex);

  // Préréglages d'effets : emit() fait naître, update() (optionnel) anime
  const P = {
    confetti: {
      cam: { D: 15, H: 5.5, look: 3, pitch: 0.2, spin: 0.1 },
      emit(s, dt) {
        s.ev -= dt;
        if (s.ev <= 0) {
          s.ev = 2.4;
          for (let i = 0; i < 110; i++) {
            const a = R(0, Math.PI * 2), sp = R(2, 6);
            s.add({ x: R(-.3, .3), y: .6, z: R(-.3, .3), vx: Math.cos(a) * sp, vy: R(9, 15), vz: Math.sin(a) * sp, g: -9, drag: 1.3, life: R(2.6, 3.8), size: R(.2, .32), rect: true, col: pick(CONF), rot: R(0, 6), vr: R(-9, 9), fl: R(0, 6), vf: R(5, 11), bounce: .15 });
          }
        }
      },
    },
    sparks: {
      cam: { D: 9.5, H: 3, look: 2.8, pitch: 0.1, spin: 0.08 },
      emit(s, dt) {
        const c = s.cfg;
        s.acc += dt * (c.rate || 110);
        while (s.acc >= 1) {
          s.acc--;
          let x = 0, z = 0;
          if (c.shape === "ring") { const a = R(0, 6.283); x = Math.cos(a) * 1.4; z = Math.sin(a) * 1.4; }
          else if (c.shape === "ball") { x = R(-.4, .4); z = R(-.4, .4); }
          const th = R(0, c.spread || .45), ph = R(0, 6.283), sp = R(8, 13) * (c.speed || 1);
          s.add({ x, y: .2, z, vx: Math.sin(th) * Math.cos(ph) * sp, vy: Math.cos(th) * sp, vz: Math.sin(th) * Math.sin(ph) * sp, g: -14, drag: .25, life: R(1.1, 1.9), size: R(.05, .09) * (c.size || 1), streak: true, add: true, c0: c.c0 || [255, 240, 200], c1: c.c1 || [255, 90, 20], bounce: .38 });
        }
      },
      pre(s, ctx) { const p = s.proj(0, .3, 0); if (p) s.sprite(ctx, p, 1.4 + Math.sin(s.t * 20) * .15, s.cfg.c1 || [255, 120, 40], .5); },
    },
    magic: {
      cam: { D: 12, H: 3, look: 2.5, pitch: 0.1, spin: 0.06 },
      emit(s, dt) {
        s.acc += dt * 80;
        while (s.acc >= 1) { s.acc--; const a = s.t * 3 + R(-.3, .3); s.add({ a, r: R(1.4, 1.8), w: R(1.6, 2.4), y: .3, vy: R(1.4, 2.6), life: R(1.6, 2.4), size: R(.22, .32), add: true, c0: [205, 190, 255], c1: [70, 220, 255], orbit: true }); }
      },
      update(q, dt) { q.a += q.w * dt; q.r = Math.max(0, q.r - dt * .35); q.x = Math.cos(q.a) * q.r; q.z = Math.sin(q.a) * q.r; q.y += q.vy * dt; },
    },
    fire: {
      cam: { D: 10, H: 2.6, look: 1.9, pitch: 0.08, spin: 0.05 },
      emit(s, dt) {
        s.acc += dt * 150;
        while (s.acc >= 1) { s.acc--; const a = R(0, 6.283), r = Math.sqrt(Math.random()) * .6; s.add({ x: Math.cos(a) * r, y: .1, z: Math.sin(a) * r, vx: -Math.cos(a) * r * 1.1, vy: R(2.4, 4.4), vz: -Math.sin(a) * r * 1.1, g: 1.5, drag: .5, life: R(.6, 1.15), size: R(.32, .5), grow: -.6, add: true, dim: .55, c0: [255, 200, 110], c1: [230, 40, 5], sway: R(0, 6) }); }
        s.ev -= dt;
        if (s.ev <= 0) { s.ev = .08; s.add({ x: R(-.2, .2), y: 1.6, z: R(-.2, .2), vx: R(-.2, .2), vy: R(1, 1.6), vz: R(-.2, .2), life: R(2, 2.8), size: .6, grow: 1.3, col: [60, 60, 68], alpha: .32, smoke: true, sway: R(0, 6) }); }
      },
      update(q, dt, s) { q.x += Math.sin(s.t * 3 + q.sway) * dt * .35; },
    },
    explosion: {
      cam: { D: 16, H: 4, look: 2.4, pitch: 0.12, spin: 0.05 },
      emit(s, dt) {
        s.ev -= dt;
        if (s.ev > 0) return;
        s.ev = s.cfg.period || 2.8;
        const y = 1.6;
        s.add({ x: 0, y, z: 0, life: .16, size: 4, add: true, dim: .8, col: [255, 245, 225], flash: true });
        s.add({ x: 0, y: .2, z: 0, life: .9, ring: true, col: [255, 200, 140] });
        for (let i = 0; i < 70; i++) { const u = R(-1, 1), a = R(0, 6.283), k = Math.sqrt(1 - u * u), sp = R(10, 22); s.add({ x: 0, y, z: 0, vx: k * Math.cos(a) * sp, vy: u * sp + 3, vz: k * Math.sin(a) * sp, g: -8, drag: 2.4, life: R(.6, 1.4), size: R(.06, .1), streak: true, add: true, c0: [255, 240, 190], c1: [255, 90, 20], bounce: .3 }); }
        for (let i = 0; i < 36; i++) { const u = R(-1, 1), a = R(0, 6.283), k = Math.sqrt(1 - u * u), sp = R(1, 4.5); s.add({ x: 0, y, z: 0, vx: k * Math.cos(a) * sp, vy: u * sp + 1, vz: k * Math.sin(a) * sp, drag: 2, life: R(.5, .95), size: R(.7, 1.2), grow: 1.2, add: true, dim: .5, c0: [255, 190, 100], c1: [200, 45, 10] }); }
        for (let i = 0; i < 18; i++) { const a = R(0, 6.283), sp = R(.6, 1.8); s.add({ x: R(-.5, .5), y: y + R(-.3, .3), z: R(-.5, .5), vx: Math.cos(a) * sp, vy: R(.8, 1.7), vz: Math.sin(a) * sp, drag: .8, life: R(2.2, 3.2), size: 1.1, grow: 1.4, col: [70, 66, 70], alpha: .38, smoke: true }); }
      },
    },
    snow: {
      cam: { D: 14, H: 3.5, look: 3, pitch: 0.1, spin: 0.04 },
      emit(s, dt) { s.acc += dt * 70; while (s.acc >= 1) { s.acc--; s.add({ x: R(-8, 8), y: 9, z: R(-8, 8), vy: R(-1.6, -2.6), life: 6, size: R(.06, .12), col: [235, 242, 255], alpha: .9, sway: R(0, 6), soft: true }); } },
      update(q, dt, s) { q.x += Math.sin(s.t * 1.4 + q.sway) * dt * .6; q.y += q.vy * dt; if (q.y < 0) q.age = q.life; },
    },
    portal: {
      cam: { D: 12, H: 3, look: 3, pitch: 0.05, spin: 0.25 },
      emit(s, dt) {
        s.acc += dt * 160;
        while (s.acc >= 1) { s.acc--; const inner = Math.random() < .3; s.add({ a: R(0, 6.283), r: inner ? R(.3, 2) : R(2.05, 2.35), w: inner ? 3 : 1.3, inner, zz: R(-.12, .12), life: R(1, 1.8), size: R(.12, .2), add: true, c0: inner ? [200, 160, 255] : [110, 255, 190], c1: [120, 80, 255], portal: true }); }
      },
      update(q, dt) { q.a += q.w * dt; if (q.inner) q.r = Math.max(0, q.r - dt * 1.1); q.x = Math.cos(q.a) * q.r; q.y = 3 + Math.sin(q.a) * q.r; q.z = q.zz; },
      pre(s, ctx) { const p = s.proj(0, 3, 0); if (p) s.sprite(ctx, p, 2.6 + Math.sin(s.t * 3) * .2, [150, 100, 255], .35); },
    },
    orb: {
      cam: { D: 10, H: 3, look: 3, pitch: 0.04, spin: 0.3 },
      emit(s, dt) { s.acc += dt * 120; while (s.acc >= 1) { s.acc--; const u = R(-1, 1), a = R(0, 6.283); s.add({ u, a, life: R(.8, 1.6), size: R(.1, .17), add: true, c0: [180, 240, 255], c1: [80, 110, 255], orb: true }); } },
      update(q, dt, s) { q.a += dt * 1.4; const r = 1.6 + Math.sin(s.t * 4 + q.u * 3) * .18, k = Math.sqrt(1 - q.u * q.u); q.x = k * Math.cos(q.a) * r; q.y = 3 + q.u * r; q.z = k * Math.sin(q.a) * r; },
      pre(s, ctx) { const p = s.proj(0, 3, 0); if (p) s.sprite(ctx, p, 2.2 + Math.sin(s.t * 4) * .25, [120, 170, 255], .55); },
    },
    trail: {
      cam: { D: 12, H: 3, look: 3, pitch: 0.08, spin: 0.05 },
      emit(s, dt) {
        const cols = [[185, 166, 255], [90, 220, 255], [255, 140, 200]];
        for (let h = 0; h < 3; h++) {
          const k = s.t * 1.6 + h * 2.1;
          const x = Math.sin(k * 1.3) * 3.2, y = 3 + Math.sin(k * 2.1) * 1.4, z = Math.cos(k * .9) * 2.2;
          for (let j = 0; j < 3; j++) s.add({ x: x + R(-.05, .05), y: y + R(-.05, .05), z, life: .9, size: .32, grow: -1, add: true, c0: [255, 255, 255], c1: cols[h] });
        }
      },
    },
    levelup: {
      cam: { D: 11, H: 2.8, look: 2.6, pitch: 0.08, spin: 0.1 },
      emit(s, dt) {
        s.acc += dt * 110;
        while (s.acc >= 1) { s.acc--; s.add({ a: s.t * 5 + R(0, .4) + (Math.random() < .5 ? 0 : Math.PI), r: 1.3, w: 3, y: .1, vy: R(2.6, 3.4), life: R(1.4, 1.9), size: R(.14, .22), add: true, c0: [255, 245, 200], c1: [255, 170, 40], orbit: true }); }
        s.ev -= dt;
        if (s.ev <= 0) { s.ev = 1.3; s.add({ x: 0, y: .1, z: 0, life: .8, ring: true, col: [255, 210, 110] }); }
      },
      update(q, dt) { q.a += q.w * dt; q.r = Math.max(0, q.r - dt * .25); q.x = Math.cos(q.a) * q.r; q.z = Math.sin(q.a) * q.r; q.y += q.vy * dt; },
    },
    muzzle: {
      cam: { D: 9, H: 2.4, look: 2, pitch: 0.06, spin: 0.04 },
      emit(s, dt) {
        s.ev -= dt;
        if (s.ev > 0) return;
        s.ev = .42;
        s.add({ x: -1.6, y: 2, z: 0, life: .07, size: 2.2, add: true, col: [255, 230, 160], flash: true });
        for (let i = 0; i < 16; i++) { const a = R(-.35, .35), b = R(-.35, .35), sp = R(10, 18); s.add({ x: -1.5, y: 2, z: 0, vx: sp, vy: a * sp, vz: b * sp, g: -4, drag: 3, life: R(.15, .35), size: .06, streak: true, add: true, c0: [255, 250, 210], c1: [255, 140, 40] }); }
        for (let i = 0; i < 3; i++) s.add({ x: -1.2, y: 2, z: 0, vx: R(1, 2), vy: R(.3, .8), vz: R(-.3, .3), drag: 1, life: 1.1, size: .4, grow: 1.4, col: [90, 90, 96], alpha: .3, smoke: true });
      },
    },
  };

  class Sim {
    constructor(cv, preset, opt = {}) {
      this.cv = cv; this.ctx = cv.getContext("2d");
      this.bg = opt.bg || "void";
      this.cfg = opt.cfg || {};
      this.p = []; this.w = 0; this.h = 0;
      this.set(preset);
    }
    set(name) {
      this.name = name; this.pre = P[name]; this.cam = Object.assign({}, this.pre.cam);
      this.p.length = 0; this.t = 0; this.acc = 0; this.ev = 0;
    }
    reset() { this.p.length = 0; this.t = 0; this.acc = 0; this.ev = 0; }
    resize() {
      const r = this.cv.getBoundingClientRect();
      if (r.width < 2) return;
      const d = Math.min(2, window.devicePixelRatio || 1);
      this.w = r.width; this.h = r.height;
      this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
      this.ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    add(q) { if (this.p.length < 700) { q.age = 0; q.x ??= 0; q.y ??= 0; q.z ??= 0; q.vx ??= 0; q.vy ??= 0; q.vz ??= 0; this.p.push(q); } }
    proj(x, y, z) {
      const c = this.cam, a = this.t * c.spin + (c.a0 || .6);
      const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const rx = x * ca - z * sa, rz0 = x * sa + z * ca + c.D, ry = y - c.H;
      const yy = ry * cp + rz0 * sp, zz = -ry * sp + rz0 * cp;
      if (zz < .3) return null;
      const f = this.h * 1.15, ly = c.look - c.H;
      const oy = (ly * cp + c.D * sp) * f / (-ly * sp + c.D * cp); // centre la vue sur la hauteur « look »
      return { x: this.w / 2 + rx * f / zz, y: this.h * .55 - yy * f / zz + oy, k: f / zz };
    }
    sprite(ctx, p, size, col, alpha = 1) {
      const s = size * p.k;
      ctx.globalAlpha = alpha;
      ctx.drawImage(glowSprite(col), p.x - s / 2, p.y - s / 2, s, s);
    }
    step(dt) {
      this.t += dt;
      const pre = this.pre;
      pre.emit(this, dt);
      for (let i = this.p.length - 1; i >= 0; i--) {
        const q = this.p[i];
        q.age += dt;
        if (q.age >= q.life) { this.p.splice(i, 1); continue; }
        if (pre.update && (q.orbit || q.portal || q.orb || q.sway !== undefined || this.name === "snow")) pre.update(q, dt, this);
        if (q.orbit || q.portal || q.orb || this.name === "snow") continue;
        q.vy += (q.g || 0) * dt;
        if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; q.vz *= k; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        if (q.bounce && q.y < 0) { q.y = 0; q.vy *= -q.bounce; q.vx *= .7; q.vz *= .7; }
        if (q.rect) { q.rot += q.vr * dt; q.fl += q.vf * dt; }
      }
    }
    drawBg() {
      const { ctx, w, h } = this;
      if (this.bg === "scene") {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#4a505d"); g.addColorStop(.55, "#33363f"); g.addColorStop(1, "#2a2c33");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = "#0e0f13"; ctx.fillRect(0, 0, w, h);
        const g = ctx.createRadialGradient(w / 2, h * .55, 0, w / 2, h * .55, Math.max(w, h) * .7);
        g.addColorStop(0, "rgba(120,110,170,.10)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
      // sol : grille en perspective
      ctx.lineWidth = 1;
      const S = 1.5, N2 = Math.max(3, Math.min(6, Math.floor((this.cam.D - 1.5) / S)));
      for (let i = -N2; i <= N2; i++) {
        for (const dir of [0, 1]) {
          const a = dir ? this.proj(i * S, 0, -N2 * S) : this.proj(-N2 * S, 0, i * S);
          const b = dir ? this.proj(i * S, 0, N2 * S) : this.proj(N2 * S, 0, i * S);
          if (!a || !b) continue;
          ctx.strokeStyle = this.bg === "scene" ? `rgba(255,255,255,${i % 5 ? .05 : .1})` : `rgba(255,255,255,${i % 5 ? .03 : .06})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    draw() {
      const { ctx } = this;
      if (!this.w) return;
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      this.drawBg();
      // ombres / fumée et confettis (normal), puis particules additives
      for (const q of this.p) {
        if (q.add || q.ring) continue;
        const p = this.proj(q.x, q.y, q.z); if (!p) continue;
        const n = q.age / q.life;
        if (q.rect) {
          const s = q.size * p.k;
          ctx.globalAlpha = n > .8 ? (1 - n) / .2 : 1;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.rot); ctx.scale(1, Math.cos(q.fl));
          ctx.fillStyle = `rgb(${q.col[0]},${q.col[1]},${q.col[2]})`; ctx.fillRect(-s / 2, -s / 3, s, s * .66);
          ctx.restore();
        } else {
          const s = q.size * (1 + (q.grow || 0) * n) * p.k;
          const al = (q.alpha ?? 1) * (q.smoke ? Math.sin(Math.PI * n) : (n > .8 ? (1 - n) / .2 : 1));
          ctx.globalAlpha = Math.max(0, al);
          ctx.fillStyle = `rgb(${q.col[0]},${q.col[1]},${q.col[2]})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.6, s / 2), 0, 6.283); ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "lighter";
      if (this.pre.pre) this.pre.pre(this, ctx);
      for (const q of this.p) {
        const n = q.age / q.life;
        if (q.ring) {
          const r = .3 + n * 5, col = q.col; ctx.globalAlpha = (1 - n) * .8;
          ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`; ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283; const p = this.proj(q.x + Math.cos(a) * r, q.y, q.z + Math.sin(a) * r); if (!p) continue; i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
          ctx.stroke();
          continue;
        }
        if (!q.add) continue;
        const p = this.proj(q.x, q.y, q.z); if (!p) continue;
        const col = q.col || mix(q.c0, q.c1, n);
        const fade = q.flash ? 1 - n : (n < .1 ? n / .1 : 1 - Math.pow(n, 2));
        if (q.streak) {
          const b = this.proj(q.x - q.vx * .035, q.y - q.vy * .035, q.z - q.vz * .035); if (!b) continue;
          ctx.globalAlpha = Math.max(0, fade);
          ctx.strokeStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
          ctx.lineWidth = Math.max(1, q.size * p.k); ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          this.sprite(ctx, p, q.size * 5, col, fade * .5);
        } else {
          this.sprite(ctx, p, q.size * (1 + (q.grow || 0) * n) * 2.2, col, Math.max(0, fade) * (q.dim || 1));
        }
      }
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    }
  }

  /* =====================================================================
     Morceaux d'interface communs
     ===================================================================== */
  const head = (o = {}) => `
    <div class="nx-head">
      <div class="nx-logo"><span class="lg">${N.logo()}</span>NebulaFX</div>
      <div class="nx-name"><span class="ok"></span>${o.name || "Confetti"}${I("chevron-down")}</div>
      <span class="nx-btn ic ghost">${I("undo-2")}</span><span class="nx-btn ic ghost">${I("redo-2")}</span>
      <span class="nx-btn">${I("save")}Save</span>
      <div class="nx-center">
        <span class="nx-btn ic ghost">${I("rotate-ccw")}</span>
        <span class="nx-play">${I("pause")}</span>
        <span class="nx-time"><b class="nx-clock">0.00</b> <span>/ ${DUR.toFixed(2)} s</span></span>
      </div>
      <span class="nx-sp"></span>
      <div class="nx-seg"><b class="${o.simple ? "on" : ""}">${I("sparkles")}Simple</b><b class="${o.simple ? "" : "on"}">Advanced</b></div>
      <span class="nx-btn"><span class="nx-live"></span>Live</span>
      <span class="nx-btn">${I("eye")}Preview</span>
      <span class="nx-btn">${I("upload")}Export</span>
      <span class="nx-btn ic ghost">${I("circle-help")}</span>
      <span class="nx-btn ic ghost">${I("x")}</span>
    </div>`;
  const status = (hint) => `
    <div class="nx-status"><span>${hint}</span>
      <span class="mono"><span class="st-dot"></span><b data-pv="num">0</b> particles &nbsp;•&nbsp; sim <b data-pv="ms">0.05</b> ms &nbsp;•&nbsp; 60 fps</span></div>`;
  const tabs = (list) => `<div class="nx-tabs">${list.map(([ic, name, on]) => `<span class="nx-tab${on ? " on" : ""}">${I(ic)}${name}</span>`).join("")}</div>`;
  const cursor = `<div class="nx-cursor"><svg viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg></div>`;
  const prop = (name, field, mode, i) => `<div class="nx-prop nx-a" style="--i:${i}"><span class="nm">${name}</span>${field}<span class="nx-mode ${mode[0]}">${mode[1]}</span></div>`;
  const F = { fixed: ["m-fixed", "Fixed"], rand: ["m-rand", "Random"], curve: ["m-curve", "Curve"], link: ["m-link", "Link"], expr: ["m-expr", "Expr"] };
  const inp = (v, cls = "") => `<span class="nx-in ${cls}">${v}</span>`;
  const dd = (v) => `<span class="nx-in dd">${v}${I("chevron-down")}</span>`;
  const xyz = (a, b, c) => `<span class="nx-xyz"><span class="nx-in x"><b>X</b>${a}</span><span class="nx-in y"><b>Y</b>${b}</span><span class="nx-in z"><b>Z</b>${c}</span></span>`;
  const spark = (d) => `<span class="nx-spark"><svg viewBox="0 0 100 24" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="${d}"/></svg></span>`;
  const mod = (name, o = {}) => `<div class="nx-mod${o.sel ? " sel" : ""}" ${o.id ? `data-c="${o.id}"` : ""}><span class="nx-tg${o.off ? " off" : ""}"></span>${name}${o.chip ? `<span class="chip">${o.chip}</span>` : ""}<span class="dot3">${I("ellipsis-vertical")}</span></div>`;
  const stage = (name, c, n) => `<div class="nx-stage" style="--c:${c}"><i></i>${name}<small>${n}</small></div>`;
  const ruler = () => `<div class="nx-ruler">${Array.from({ length: 9 }, (_, i) => `<span style="left:${(i * 11) + .6}%">${(i * .5).toFixed(2)}s</span>`).join("")}</div>`;
  const pct = (sec) => (sec / DUR) * 88;
  const STG = { emit: "#e18c37", part: "#55be6e", rend: "#e65a50", sys: "#508ce6" };

  /* ---------- 1. Éditeur (graphe Système) ---------- */
  const viewEditor = () => `
  <div class="nx" data-view="editor">
    ${head({ name: "Confetti" })}
    <div class="nx-body" style="grid-template-columns: 290px 1fr 380px; grid-template-rows: 1fr 250px;">
      <div style="display:flex;flex-direction:column;gap:3px;min-height:0;grid-row:1;grid-column:1">
        <div class="nx-pn nx-a" style="flex:0 0 292px;--i:0">
          ${tabs([["eye", "Preview", 1]])}
          <div class="nx-view"><canvas data-sim="confetti" data-bg="scene"></canvas>
            <div class="nx-view-bar"><span class="nx-btn ic">${I("move")}</span><span class="nx-btn">Perspective</span><span class="nx-btn">${I("sun")}Lit</span><span class="nx-btn">Show</span></div>
            <div class="nx-view-info"><span>60 fps</span><span><b data-pv="num">0</b> particles</span><span>t=<b class="nx-clock">0.00</b></span></div>
          </div>
        </div>
        <div class="nx-pn nx-a" style="flex:1;--i:1">
          ${tabs([["library", "Library"], ["sliders-horizontal", "Parameters", 1]])}
          <div class="nx-search">${I("search")}Search</div>
          <div class="nx-rows">
            <div class="nx-section">${I("chevron-down")}System Attributes</div>
            <div class="nx-row"><span class="nx-ns ns-sys">SYSTEM</span><span class="nm">Age</span>${I("lock")}<span class="vl" data-pv="age">0.00</span></div>
            <div class="nx-row"><span class="nx-ns ns-sys">SYSTEM</span><span class="nm">NormalizedLoopAge</span>${I("lock")}<span class="vl" data-pv="nage">0.000</span></div>
            <div class="nx-row"><span class="nx-ns ns-sys">SYSTEM</span><span class="nm">ExecutionState</span>${I("lock")}<span class="vl">Active</span></div>
            <div class="nx-section">${I("chevron-down")}User Parameters</div>
            <div class="nx-row"><span class="nx-ns ns-usr">USER</span><span class="nm">Force</span><span class="vl" data-pv="force">0.0</span></div>
            <div class="nx-row"><span class="nx-ns ns-usr">USER</span><span class="nm">Tint</span><span class="vl" style="background:linear-gradient(90deg,#b9a6ff,#4cc9f0);color:#111">RGB</span></div>
            <div class="nx-row"><span class="nx-ns ns-emi">EMITTER</span><span class="nm">NumParticles</span>${I("lock")}<span class="vl" data-pv="num">0</span></div>
          </div>
        </div>
      </div>

      <div class="nx-pn nx-a" style="grid-row:1;grid-column:2;--i:2">
        ${tabs([["workflow", "System", 1], ["puzzle", "Scratch Pad"]])}
        <div class="nx-tool"><span class="nx-btn pri">${I("plus")}Emitter</span><span class="nx-btn">${I("maximize-2")}Recenter</span><span class="nx-hint">Right-drag: pan the view • Wheel: zoom</span></div>
        <div class="nx-graph">
          <span class="nx-zoom">Zoom −1</span>
          <div class="nx-watermark">SYSTEM</div>
          <div class="nx-node nx-pop" style="left:26px;top:22px;width:222px;--i:3">
            <div class="nx-nh" style="background:linear-gradient(90deg,#3f6fc4,#355ea6)">${I("boxes")}<div><b>System</b><small>Confetti</small></div></div>
            <div class="nx-mod">${I("settings-2")}System properties</div>
            <div class="nx-mod">${I("sliders-horizontal")}User parameters<span class="chip">2</span></div>
            ${stage("System Update", STG.sys, 1)}
            ${mod("System State")}
            <div class="nx-add">${I("plus")}Add a module</div>
          </div>
          <div class="nx-node sel nx-pop" style="left:282px;top:22px;--i:4">
            <div class="nx-nh" style="background:linear-gradient(90deg,#c8692a,#a5541f)"><span class="nx-tg"></span><div><b>Sparks</b><small>248 particles • active</small></div><span class="pill">CPU</span></div>
            <div class="nx-nsub"><span>${I("settings-2")}Properties</span><span class="on">${I("list")}Show all</span></div>
            <div class="nx-visuals"><span class="img"></span><span class="img2"></span><span>${I("plus")}</span><small>Particles (images / meshes) 2/8</small></div>
            ${stage("Emitter Update", STG.emit, 2)}
            ${mod("Emitter State")}${mod("Spawn Rate", { chip: "120/s" })}
            ${stage("Particle Spawn", STG.part, 3)}
            ${mod("Initialize Particle")}${mod("Shape Location", { chip: "Sphere" })}${mod("Add Velocity", { chip: "InCone", sel: true, id: "m-vel" })}
            ${stage("Particle Update", STG.part, 4)}
            ${mod("Particle State")}${mod("Gravity Force")}${mod("Curl Noise Force", { id: "m-curl" })}${mod("Solve Forces and Velocity")}
            ${stage("Render", STG.rend, 1)}
            ${mod("Sprite Renderer", { chip: "Beam" })}
          </div>
          <div class="nx-node nx-pop" style="left:582px;top:22px;width:250px;--i:5">
            <div class="nx-nh" style="background:linear-gradient(90deg,#3a5fa8,#2c4a86)"><span class="nx-tg"></span><div><b>Smoke</b><small>GPU • ParticleEmitter</small></div><span class="pill">GPU</span></div>
            <div class="nx-nsub"><span>${I("settings-2")}Properties</span><span>${I("list")}Show all</span></div>
            ${stage("Emitter Update", STG.emit, 1)}
            ${mod("Spawn Rate", { chip: "18/s" })}
            ${stage("Particle Spawn", STG.part, 2)}
            ${mod("Initialize Particle")}${mod("Shape Location", { chip: "Cylinder" })}
            ${stage("Particle Update", STG.part, 2)}
            ${mod("Scale Sprite Size")}${mod("Scale Color")}
            ${stage("Render", STG.rend, 1)}
            ${mod("Sprite Renderer", { chip: "Billboard" })}
          </div>
        </div>
      </div>

      <div class="nx-pn nx-a" style="grid-row:1 / span 2;grid-column:3;--i:3">
        ${tabs([["sparkles", "Inspector", 1]])}
        <div class="nx-insp">
          <div class="nx-crumb">Confetti › Sparks › <span data-insp="stage">Particle Spawn</span></div>
          <div class="nx-ititle"><b data-insp="title">Add Velocity</b><small>248 particles • 0.05 ms</small></div>
          <p class="nx-idesc" data-insp="desc">Gives a velocity: fixed direction, from a point, in a cone, in orbit.</p>
        </div>
        <div class="nx-search" style="margin-top:4px">${I("search")}Filter settings</div>
        <div class="nx-props"><div class="nx-props-in" style="transition:transform .9s var(--ease)">
          <div class="nx-modhdr" data-sec="vel" style="--c:#55be6e">${I("chevron-down")}Add Velocity<span class="nx-tg"></span></div>
          ${prop("Mode", dd("InCone"), F.fixed, 4)}
          ${prop("Velocity", xyz(0, 10, 0), F.fixed, 5)}
          <div class="nx-prop nx-a" style="--i:6"><span class="nm">Speed</span><span class="nx-minmax"><span class="nx-in"><small>Min</small>8</span><span class="nx-in" data-c="speed"><small>Max</small>13</span></span><span class="nx-mode m-rand">Random</span></div>
          ${prop("Axis", xyz(0, 1, 0), F.fixed, 7)}
          ${prop("ConeAngle", inp("20 + User.Force * 0.2"), F.expr, 8)}
          ${prop("Space", dd("Local"), F.fixed, 9)}
          <div class="nx-modhdr" data-sec="curl" style="--c:#55be6e">${I("chevron-down")}Curl Noise Force<span class="nx-tg"></span></div>
          ${prop("NoiseStrength", inp("User.Force"), F.link, 10)}
          ${prop("NoiseFrequency", inp("0.15"), F.fixed, 11)}
          ${prop("PanNoiseField", xyz(0, .3, 0), F.fixed, 12)}
          ${prop("Quality", dd("Every Frame"), F.fixed, 13)}
          <div class="nx-modhdr" style="--c:#55be6e">${I("chevron-down")}Scale Color<span class="nx-tg"></span></div>
          ${prop("Scale", spark("M0 4 C30 2 60 8 100 20"), F.curve, 14)}
          ${prop("Alpha", spark("M0 22 L8 3 C50 2 80 6 100 22"), F.curve, 15)}
          <div class="nx-modhdr" style="--c:#e65a50">${I("chevron-down")}Sprite Renderer<span class="nx-tg"></span></div>
          ${prop("Backend", dd("Beam"), F.fixed, 16)}
          ${prop("Facing", dd("VelocityAligned"), F.fixed, 17)}
        </div></div>
      </div>

      <div class="nx-pn nx-a" style="grid-row:2;grid-column:1 / span 2;--i:4">
        ${tabs([["play", "Timeline", 1], ["spline", "Curves"], ["terminal", "Console"], ["table", "Debug"], ["gauge", "Performance"]])}
        <div class="nx-tool"><span class="nx-btn ic">${I("skip-back")}</span><span class="nx-btn ic">${I("repeat")}</span><span class="nx-btn ic">${I("skip-forward")}</span><span class="nx-btn sm">×1</span><span class="nx-btn sm">60 fps</span><span class="nx-btn sm">${I("magnet")}Snapping</span><span class="nx-btn sm">Fit</span><span class="nx-btn pri sm">${I("diamond")}Add a key</span><span class="nx-btn sm">${I("plus")}Track</span><span class="nx-readout" data-pv="ro">0.00 s · f0</span></div>
        <div class="nx-tl">
          <div class="nx-tl-names">
            <div class="nx-tl-grp">EMITTERS</div>
            <div class="nx-tl-name sel" style="--c:#e18c37"><i></i>Sparks<span class="nx-tg"></span></div>
            <div class="nx-tl-name" style="--c:#3a6fd0"><i></i>Smoke<span class="nx-tg"></span></div>
            <div class="nx-tl-grp">ANIMATION (KEYFRAMES)${I("plus")}</div>
            <div class="nx-tl-name" style="--c:#a05fcd"><i></i>User.Force<span class="nx-tg"></span></div>
          </div>
          <div class="nx-tl-lanes">
            ${ruler()}
            <div class="nx-lane g"></div>
            <div class="nx-lane sel"><span class="nx-bar" style="left:0;width:${pct(4)}%;background:linear-gradient(90deg,#c8692a,#a5541f);--i:0">Sparks ∞</span></div>
            <div class="nx-lane"><span class="nx-bar" style="left:${pct(.6)}%;width:${pct(2.8)}%;background:linear-gradient(90deg,#3a5fa8,#2c4a86);--i:1">Smoke</span></div>
            <div class="nx-lane g"></div>
            <div class="nx-lane">${keys([[0, .2], [1, .9], [2.2, .35], [3.4, .8]])}</div>
            <div class="nx-outloop" style="left:88%"></div>
            <div class="nx-loopend" style="left:88%"></div>
            <div class="nx-head-line" data-ph><b data-pv="phl">0.00</b></div>
          </div>
        </div>
      </div>
    </div>
    ${status("Tip: click an item in the graph to tweak it in the Inspector • “+ Add a module” under each stage")}
    ${cursor}
  </div>`;

  // keyframes d'une piste (temps en s, valeur 0..1), avec la courbe entre les clés
  function keys(list, color) {
    const pts = list.map(([s, v]) => [pct(s), 1 - v]);
    let d = `M${pts[0][0]} ${pts[0][1] * 100}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
      d += ` C${mx} ${y0 * 100} ${mx} ${y1 * 100} ${x1} ${y1 * 100}`;
    }
    return `<svg class="nx-keyline" viewBox="0 0 100 100" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="${d}" ${color ? `style="stroke:${color}"` : ""}/></svg>` +
      list.map(([s], i) => `<span class="nx-key" data-t="${s}" style="left:${pct(s)}%;${color ? `background:${color}` : ""}" ${i === 2 ? 'data-c="key"' : ""}></span>`).join("");
  }

  /* ---------- 2. Scratch Pad ---------- */
  const spNode = (id, x, y, title, c, body, o = {}) => `
    <div class="nx-sp-node nx-pop${o.out ? " out" : ""}" data-n="${id}" style="left:${x}px;top:${y}px;--c:${c};--i:${o.i || 0}">
      <div class="h">${o.icon ? I(o.icon) : ""}${title}${o.sub ? `<small>${o.sub}</small>` : ""}</div><div class="b">${body}</div></div>`;
  const pin = (side, type, label, id, field) => `<div class="nx-pin ${side} p-${type}" data-pin="${id}">${side === "r" ? "" : label}${field || ""}${side === "r" ? label : ""}</div>`;
  const viewScratch = () => `
  <div class="nx" data-view="scratch">
    ${head({ name: "Energy Orb" })}
    <div class="nx-body" style="grid-template-columns: 250px 1fr 340px;">
      <div class="nx-pn nx-a" style="--i:0">
        ${tabs([["puzzle", "Scratch modules", 1]])}
        <div class="nx-tool"><span class="nx-btn pri sm">${I("plus")}New</span><span class="nx-btn sm">${I("copy")}Duplicate</span></div>
        <div class="nx-sp-list">
          <div class="nx-row sel">${I("puzzle")}<span class="nm">Turbulence</span><span class="chip mono" style="font-size:10px">9 nodes</span></div>
          <div class="nx-row">${I("puzzle")}<span class="nm">Orbit Swirl</span></div>
          <div class="nx-row">${I("puzzle")}<span class="nm">Pulse Color</span></div>
          <div class="nx-row">${I("puzzle")}<span class="nm">Size by Speed</span></div>
        </div>
        <div class="nx-card nx-a" style="--i:3"><h4>${I("lightbulb")}Tip</h4><p>Right-click the background to add a node. Drag from an output to an input to connect. Unconnected inputs are typed directly in the node.</p></div>
      </div>
      <div class="nx-pn nx-a" style="--i:1">
        ${tabs([["workflow", "System"], ["puzzle", "Scratch Pad", 1]])}
        <div class="nx-tool"><span class="nx-btn pri" data-c="compile">${I("settings")}Compile</span><span class="nx-compile">${I("check")}Compiled — 14 ops</span><span class="nx-hint">Only nodes linked to an output are computed</span></div>
        <div class="nx-graph" data-graph>
          <div class="nx-watermark">SCRATCH</div>
          <svg class="nx-wires"></svg>
          ${spNode("A", 30, 34, "Get Particle Attribute", "#3f8a52", pin("l", "v", "", "", `<span class="nx-in dd" style="margin:0;width:120px">Position${I("chevron-down")}</span>`) + pin("r", "v", "Value", "A.o"), { i: 2 })}
          ${spNode("B", 30, 206, "Get Parameter", "#55585f", pin("l", "f", "", "", `<span class="nx-in dd" style="margin:0;width:120px">Engine.Time${I("chevron-down")}</span>`) + pin("r", "f", "Value", "B.o"), { i: 3 })}
          ${spNode("C", 30, 378, "Module Input", "#8452b4", pin("l", "f", "", "", `<span class="nx-in" style="margin:0;width:120px">Strength</span>`) + pin("r", "f", "Value", "C.o"), { i: 4 })}
          ${spNode("H", 30, 520, "Sample Curve", "#3f9c5a", pin("l", "f", "Time", "H.i0", inp("NormAge")) + `<div style="padding:4px 12px">${spark("M0 22 C20 2 60 2 100 14")}</div>` + pin("r", "f", "Value", "H.o"), { i: 5, icon: "spline" })}
          ${spNode("D", 285, 206, "Multiply", "#33353e", pin("l", "a", "A", "D.i0") + pin("l", "a", "B", "D.i1", inp("0.8")) + pin("r", "a", "Out", "D.o"), { i: 6, sub: "Math" })}
          ${spNode("E", 520, 60, "Curl Noise", "#2f6c8c", pin("l", "v", "Position", "E.i0") + pin("l", "f", "Time", "E.i1") + pin("l", "f", "Scale", "E.i2", inp("0.35")) + pin("r", "v", "Value", "E.o"), { i: 7, sub: "Noise" })}
          ${spNode("F", 520, 300, "Multiply", "#33353e", pin("l", "a", "A", "F.i0") + pin("l", "a", "B", "F.i1") + pin("r", "a", "Out", "F.o"), { i: 8, sub: "Math" })}
          ${spNode("G", 760, 170, "Add Force", "#6a4fc4", pin("l", "v", "Force", "G.i0"), { i: 9, out: true, sub: "Output", icon: "zap" })}
          ${spNode("J", 520, 520, "Set Particle Attribute", "#6a4fc4", pin("l", "f", "Value", "J.i0") + `<div style="padding:2px 12px 4px"><span class="nx-in dd">SpriteSize${I("chevron-down")}</span></div>`, { i: 10, out: true, sub: "Output" })}
        </div>
      </div>
      <div class="nx-pn nx-a" style="--i:2">
        ${tabs([["sparkles", "Inspector", 1]])}
        <div class="nx-insp"><div class="nx-crumb">Scratch Pad › Turbulence</div><div class="nx-ititle"><b>Turbulence</b><small>14 ops</small></div><p class="nx-idesc">Custom module compiled into a vectorized program: each node processes every particle at once.</p></div>
        <div class="nx-modhdr" style="--c:#8452b4">${I("chevron-down")}Module Inputs</div>
        ${prop("Strength", inp("22"), F.fixed, 3)}
        ${prop("Scale", inp("0.35"), F.fixed, 4)}
        ${prop("Speed", spark("M0 18 C30 18 50 4 100 6"), F.curve, 5)}
        <div class="nx-modhdr" style="--c:#2f6c8c">${I("terminal")}Compiled program</div>
        <div class="mono" style="padding:8px 14px;font-size:11.5px;line-height:1.75;color:#aeb2c0">
          ${["r0 = attr Position", "r1 = param Engine.Time", "r2 = mul r1, 0.8", "r3 = curl r0, r2, 0.35", "r4 = input Strength", "r5 = mul r3, r4", "force += r5", "r6 = curve NormAge", "SpriteSize = r6"].map((l, i) => `<div class="nx-a" style="--i:${6 + i}"><span style="color:#5d6070">${String(i).padStart(2, "0")}</span>&nbsp; ${l.replace(/(r\d)/g, '<span style="color:#b9a6ff">$1</span>')}</div>`).join("")}
        </div>
        <div class="nx-view nx-a" style="--i:14;flex:1;margin:8px;border-radius:6px"><canvas data-sim="orb"></canvas><div class="nx-view-info"><span>Energy Orb</span><span><b data-pv="num">0</b> particles</span></div></div>
      </div>
    </div>
    ${status("Drag from an output (right dot) to an input (left dot) to connect • ⚙ Compile shows the op count or errors")}
    <div class="nx-toast">${I("check")}Compiled — 14 ops, 0 errors</div>
    ${cursor}
  </div>`;
  const WIRES = [["A.o", "E.i0"], ["B.o", "D.i0"], ["D.o", "E.i1"], ["E.o", "F.i0"], ["C.o", "F.i1"], ["F.o", "G.i0"], ["H.o", "J.i0"]];

  /* ---------- 3. Timeline ---------- */
  const CHARGE = [[0, 0], [.8, 1], [1.6, .4], [3, 0]];
  const evalKeys = (k, x) => {
    if (x <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (x <= k[i][0]) { const u = (x - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); const s = u * u * (3 - 2 * u); return lerp(k[i - 1][1], k[i][1], s); }
    return k[k.length - 1][1];
  };
  const viewTimeline = () => {
    const tracks = [
      ["Flash", "#e8e1c8", 0, .25], ["Fireball", "#d9622a", .05, 1.2], ["Sparks", "#c8692a", .05, 1.6],
      ["Shockwave", "#c9a35b", .1, .9], ["Smoke", "#3a5fa8", .3, 3.6], ["Light", "#e0b13a", 0, .6],
    ];
    return `
  <div class="nx" data-view="timeline">
    ${head({ name: "Explosion" })}
    <div class="nx-body" style="grid-template-columns: 1fr 380px; grid-template-rows: 1fr 452px;">
      <div class="nx-pn nx-a" style="--i:0">
        ${tabs([["eye", "Preview", 1]])}
        <div class="nx-view"><canvas data-sim="explosion" data-period="4"></canvas>
          <div class="nx-view-bar"><span class="nx-btn ic">${I("move")}</span><span class="nx-btn">Perspective</span><span class="nx-btn">${I("sun")}Lit</span></div>
          <div class="nx-view-info"><span>60 fps</span><span><b data-pv="num">0</b> particles</span><span>t=<b class="nx-clock">0.00</b></span></div></div>
      </div>
      <div class="nx-pn nx-a" style="--i:1">
        ${tabs([["library", "Library"], ["sliders-horizontal", "Parameters", 1]])}
        <div class="nx-rows">
          <div class="nx-section">${I("chevron-down")}User Parameters</div>
          <div class="nx-row"><span class="nx-ns ns-usr">USER</span><span class="nm">Charge</span><span style="flex:0 0 90px;height:5px;border-radius:5px;background:#33353e;overflow:hidden"><i data-pv="chargebar" style="display:block;height:100%;width:0;background:#a05fcd"></i></span><span class="vl" data-pv="charge">0.00</span></div>
          <div class="nx-row"><span class="nx-ns ns-usr">USER</span><span class="nm">Tint</span><span class="vl" data-pv="tint" style="color:#111">RGB</span></div>
          <div class="nx-row"><span class="nx-ns ns-usr">USER</span><span class="nm">Size</span><span class="vl">1.50</span></div>
          <div class="nx-section">${I("chevron-down")}System Attributes</div>
          <div class="nx-row"><span class="nx-ns ns-sys">SYSTEM</span><span class="nm">LoopedAge</span>${I("lock")}<span class="vl" data-pv="age">0.00</span></div>
          <div class="nx-row"><span class="nx-ns ns-sys">SYSTEM</span><span class="nm">NormalizedLoopAge</span>${I("lock")}<span class="vl" data-pv="nage">0.000</span></div>
          <div class="nx-row"><span class="nx-ns ns-eng">ENGINE</span><span class="nm">DeltaTime</span>${I("lock")}<span class="vl">0.0167</span></div>
          <div class="nx-row"><span class="nx-ns ns-emi">EMITTER</span><span class="nm">Sparks.NumParticles</span>${I("lock")}<span class="vl" data-pv="num">0</span></div>
        </div>
      </div>
      <div class="nx-pn nx-a" style="grid-column:1 / span 2;--i:2">
        ${tabs([["play", "Timeline", 1], ["spline", "Curves"], ["terminal", "Console"], ["table", "Debug"], ["gauge", "Performance"]])}
        <div class="nx-tool"><span class="nx-btn ic">${I("skip-back")}</span><span class="nx-btn ic">${I("repeat")}</span><span class="nx-btn ic">${I("skip-forward")}</span><span class="nx-btn sm">×1</span><span class="nx-btn sm">60 fps</span><span class="nx-btn sm">${I("magnet")}Snapping</span><span class="nx-btn sm">Fit</span><span class="nx-btn pri sm" data-c="addkey">${I("diamond")}Add a key</span><span class="nx-btn sm">${I("plus")}Track</span><span class="nx-readout" data-pv="ro">0.00 s · f0</span></div>
        <div class="nx-tl">
          <div class="nx-tl-names">
            <div class="nx-tl-grp">EMITTERS</div>
            ${tracks.map(([n, c]) => `<div class="nx-tl-name" style="--c:${c}"><i></i>${n}<span class="nx-tg"></span></div>`).join("")}
            <div class="nx-tl-grp">ANIMATION (KEYFRAMES)${I("plus")}</div>
            <div class="nx-tl-name sel" style="--c:#a05fcd"><i></i>User.Charge<span class="nx-tg"></span></div>
            <div class="nx-tl-name" style="--c:#4cc9f0"><i></i>User.Tint<span class="nx-tg"></span></div>
          </div>
          <div class="nx-tl-lanes">
            ${ruler()}
            <div class="nx-lane g"></div>
            ${tracks.map(([n, c, a, b], i) => `<div class="nx-lane"><span class="nx-bar" style="left:${pct(a)}%;width:${pct(b - a)}%;background:linear-gradient(90deg,${c},${c}cc);--i:${i};${n === "Flash" ? "color:#222" : ""}">${n}</span></div>`).join("")}
            <div class="nx-lane g"></div>
            <div class="nx-lane sel" data-lane="charge">${keys(CHARGE)}</div>
            <div class="nx-lane">${[[0, "#ffd9a0"], [.9, "#ff7a3a"], [2.4, "#b9a6ff"], [3.6, "#4cc9f0"]].map(([s, c]) => `<span class="nx-key" data-t="${s}" style="left:${pct(s)}%;background:${c}"></span>`).join("")}</div>
            <div class="nx-outloop" style="left:88%"></div><div class="nx-loopend" style="left:88%"></div>
            <div class="nx-head-line" data-ph><b data-pv="phl">0.00</b></div>
          </div>
        </div>
        <div class="nx-keybar">${I("diamond")}<b style="color:#f0f1f5;font-weight:500">User.Charge</b> Time <span class="nx-in" data-pv="ktime">1.60 s</span> Value <span class="nx-in" data-pv="kval">0.40</span> Interpolation <span class="nx-seg"><b class="on">Smooth</b><b>Linear</b><b>Step</b></span><span class="nx-sp"></span><span class="nx-btn sm">${I("trash-2")}Delete</span></div>
      </div>
    </div>
    ${status("Double-click an animation track to create a key • Drag a key to move it • Right-click for interpolation")}
    ${cursor}
  </div>`;
  };

  /* ---------- 4. Courbes ---------- */
  const cubicPath = (k, linear) => {
    // échantillonne une courbe (Hermite à tangentes automatiques) en coordonnées 0..1000 × 0..300
    const pts = [];
    const f = (x) => {
      if (linear) { for (let i = 1; i < k.length; i++) if (x <= k[i][0]) { const u = (x - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return lerp(k[i - 1][1], k[i][1], u); } return k[k.length - 1][1]; }
      for (let i = 1; i < k.length; i++) if (x <= k[i][0]) {
        const p0 = k[i - 1], p1 = k[i], pm = k[i - 2] || p0, pn = k[i + 1] || p1;
        const m0 = (p1[1] - pm[1]) / (p1[0] - pm[0] || 1) * (p1[0] - p0[0]) * .9;
        const m1 = (pn[1] - p0[1]) / (pn[0] - p0[0] || 1) * (p1[0] - p0[0]) * .9;
        const u = (x - p0[0]) / (p1[0] - p0[0]), u2 = u * u, u3 = u2 * u;
        return (2 * u3 - 3 * u2 + 1) * p0[1] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1[1] + (u3 - u2) * m1;
      }
      return k[k.length - 1][1];
    };
    for (let i = 0; i <= 120; i++) { const x = i / 120; pts.push([x, f(x)]); }
    return { d: "M" + pts.map(([x, y]) => `${(x * 1000).toFixed(1)} ${(300 - y * 270 - 15).toFixed(1)}`).join(" L"), f };
  };
  const CRGBA = {
    R: [[0, 1], [.45, 1], [1, .55]], G: [[0, .95], [.35, .55], [1, .12]],
    B: [[0, .75], [.3, .2], [1, .05]], A: [[0, 0], [.08, 1], [.7, .78], [1, 0]],
  };
  const CSIZE = [[0, .15], [.22, 1], [.62, .82], [1, 0]];
  const gridSvg = () => `<g class="grid">${Array.from({ length: 11 }, (_, i) => `<line vector-effect="non-scaling-stroke" class="${i % 5 ? "" : "mj"}" x1="${i * 100}" y1="0" x2="${i * 100}" y2="300"/>`).join("")}${Array.from({ length: 7 }, (_, i) => `<line vector-effect="non-scaling-stroke" class="${i % 3 ? "" : "mj"}" x1="0" y1="${15 + i * 45}" x2="1000" y2="${15 + i * 45}"/>`).join("")}</g>`;
  const curveBox = (curves, keysList, id) => `
    <div class="nx-curve" data-curve="${id}">
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none">${gridSvg()}
        ${curves.map(([d, c], i) => `<path class="crv" vector-effect="non-scaling-stroke" d="${d}" style="stroke:${c};--i:${i}" ${i === 0 ? `data-main="${id}"` : ""}/>`).join("")}
        <line class="probe" vector-effect="non-scaling-stroke" x1="0" y1="0" x2="0" y2="300" data-probe="${id}"/>
      </svg>
      ${keysList.map(([x, y], i) => `<span class="nx-kpt" data-k="${id}${i}" style="left:${x * 100}%;top:${(300 - y * 270 - 15) / 3}%;--i:${i}"></span>`).join("")}
      <span class="nx-pdot" data-pdot="${id}"></span>
      ${["0", ".25", ".5", ".75", "1"].map((l, i) => `<span class="nx-clbl" style="left:${i * 25}%">${l}</span>`).join("")}
    </div>`;
  const viewCurves = () => {
    const c = Object.entries(CRGBA).map(([k, v]) => [cubicPath(v).d, { R: "#eb5555", G: "#50c878", B: "#408cff", A: "#e8e8ee" }[k]]);
    const sz = cubicPath(CSIZE).d;
    const g = [0, .2, .4, .6, .8, 1].map((x) => { const col = ["R", "G", "B"].map((k) => Math.round(Math.min(1, Math.max(0, evalKeys(CRGBA[k], x))) * 255)); const a = Math.max(0, Math.min(1, evalKeys(CRGBA.A, x))); return `rgba(${col.join(",")},${a.toFixed(2)}) ${x * 100}%`; }).join(",");
    return `
  <div class="nx" data-view="curves">
    ${head({ name: "Fire" })}
    <div class="nx-body" style="grid-template-columns: 330px 1fr;">
      <div class="nx-pn nx-a" style="--i:0">
        ${tabs([["eye", "Preview", 1]])}
        <div class="nx-view" style="flex:0 0 230px"><canvas data-sim="fire"></canvas><div class="nx-view-info"><span><b data-pv="num">0</b> particles</span></div></div>
        <div class="nx-tabs" style="margin-top:0">${`<span class="nx-tab on">${I("sparkles")}Inspector</span>`}</div>
        <div class="nx-insp"><div class="nx-crumb">Fire › Flames › Particle Update</div><div class="nx-ititle"><b>Scale Color</b></div><p class="nx-idesc">Multiplies the birth color over the particle's life.</p></div>
        <div class="nx-modhdr" style="--c:#55be6e">${I("chevron-down")}Scale Color<span class="nx-tg"></span></div>
        ${prop("Scale", spark("M0 4 C30 2 60 10 100 18"), F.curve, 2)}
        ${prop("Alpha", spark("M0 22 L8 3 C50 2 80 6 100 22"), F.curve, 3)}
        ${prop("Source", dd("Normalized Age"), F.fixed, 4)}
        <div style="padding:8px 12px"><span class="nx-btn pri" style="width:100%;justify-content:center">Edit curve${I("chevron-right")}</span></div>
        <div class="nx-modhdr" style="--c:#55be6e">${I("chevron-down")}Scale Sprite Size<span class="nx-tg"></span></div>
        ${prop("Scale", spark("M0 20 C10 0 40 2 60 6 S90 12 100 22"), F.curve, 5)}
        ${prop("Multiplier", inp("1.4"), F.fixed, 6)}
      </div>
      <div class="nx-pn nx-a" style="--i:1">
        ${tabs([["play", "Timeline"], ["spline", "Curves", 1], ["terminal", "Console"], ["table", "Debug"], ["gauge", "Performance"]])}
        <div class="nx-tool"><b style="color:#f0f1f5;font-weight:500;margin-right:8px">Scale Color › Scale</b><span class="nx-chans"><b style="background:#c94646">R</b><b style="background:#3f9c5a">G</b><b style="background:#3a6fd0">B</b><b style="background:#6b6e7a">A</b></span><span class="nx-sp"></span><span class="nx-btn sm">Preset…${I("chevron-down")}</span><span class="nx-btn sm">${I("maximize-2")}Fit</span><span class="nx-btn sm">Source: Normalized Age${I("chevron-down")}</span></div>
        <div class="nx-grad nx-a" style="--i:2;background:linear-gradient(90deg,${g})">
          ${[0, .35, .7, 1].map((x, i) => `<span class="nx-gm${i === 1 ? " sel" : ""}" style="left:${x * 100}%;--c:${["#ffe8b0", "#ff9a3c", "#c8401a", "#3a1a10"][i]}"></span>`).join("")}
        </div>
        ${curveBox(c, CRGBA.A, "a")}
        <div class="nx-section">${I("chevron-down")}Scale Sprite Size › Scale <span class="nx-chans" style="margin-left:10px"><b style="background:#c94646">X</b><b style="background:#3f9c5a;opacity:.35">Y</b></span><span class="nx-sp"></span><span style="font-weight:400;color:#7d818c">Double-click: add a key • Right-click: interpolation</span></div>
        ${curveBox([[sz, "#eb5555"]], CSIZE, "b")}
        <div class="nx-ctx" data-ctx><div class="on">${I("spline")}Cubic</div><div data-c="linear">${I("arrow-up-right")}Linear</div><div>${I("square")}Constant</div><hr><div>${I("settings-2")}Set value…</div><div>${I("trash-2")}Delete</div></div>
      </div>
    </div>
    ${status("Curve source: Particles.NormalizedAge (0 = birth, 1 = death) • × multiplier applied to the result")}
    ${cursor}
  </div>`;
  };

  /* ---------- 5. Mode Simple ---------- */
  const sl = (name, v, val, id, i) => `<div class="nx-sl nx-a" style="--i:${i}" ${id ? `data-sl="${id}"` : ""}><span>${name}</span><span class="tr"><i class="fi" style="--v:${v}%"></i></span><span class="val">${val}</span></div>`;
  const chips = (list, on, id, i) => `<div class="nx-chips nx-a" style="--i:${i}" ${id ? `data-chips="${id}"` : ""}>${list.map(([ic, n], k) => `<span class="${k === on ? "on" : ""}" data-v="${n.toLowerCase()}">${ic ? I(ic) : ""}${n}</span>`).join("")}</div>`;
  const viewSimple = () => `
  <div class="nx" data-view="simple">
    ${head({ name: "Magic Sparks", simple: true })}
    <div class="nx-body" style="grid-template-columns: 300px 1fr 410px;">
      <div class="nx-pn nx-a" style="--i:0">
        ${tabs([["layers", "Layers", 1]])}
        <div class="nx-card" style="margin-bottom:0"><p>An effect is built by stacking layers: for example a flash, sparks and a bit of smoke.</p></div>
        <div class="nx-layers">
          ${[["Flash", "radial-gradient(circle,#fff,#ffe9a8 40%,#3a3220)", "Burst • 1"], ["Sparks", "radial-gradient(circle,#fff2cc,#ff8a2a 45%,#3b1a08)", "Continuous • 120/s", 1], ["Smoke", "radial-gradient(circle,#8a8a92,#3a3a40 60%,#1c1c20)", "Continuous • 18/s"], ["Embers", "radial-gradient(circle,#ffcf8a,#e0401a 50%,#2a0e06)", "Trail • 2/stud"]]
            .map(([n, g, s, sel], i) => `<div class="nx-layer nx-a${sel ? " sel" : ""}" style="--g:${g};--i:${i + 1}" ${sel ? "data-layer" : ""}><span class="sw"></span><div><b>${n}</b><small>${s}</small></div><span class="nx-tg"></span></div>`).join("")}
          <span class="nx-btn pri nx-a" style="--i:5;justify-content:center">${I("plus")}Add a layer</span>
        </div>
        <div class="nx-card nx-a" style="--i:6;margin-top:auto"><h4>${I("gamepad-2")}Play it in your game</h4><p>Saves the effect, installs the engine and shows the code to copy.</p><span class="nx-btn pri" style="margin-top:10px;width:100%;justify-content:center">${I("gamepad-2")}Use in my game</span></div>
      </div>
      <div class="nx-pn nx-a" style="--i:1">
        ${tabs([["eye", "Preview", 1]])}
        <div class="nx-view"><canvas data-sim="sparks" data-key="simple"></canvas>
          <div class="nx-view-info"><span>60 fps</span><span><b data-pv="num">0</b> particles</span></div>
        </div>
        <div class="nx-tool" style="flex-wrap:wrap;background:#1d1e23;border-top:1px solid var(--border)">
          <span class="nx-hint" style="margin:0 6px 0 2px">One-click touches</span>
          ${["Bigger", "Smaller", "Faster", "Slower", "More", "Calmer"].map((n) => `<span class="nx-btn sm" ${n === "Bigger" ? 'data-c="bigger"' : ""}>${n}</span>`).join("")}
          <span class="nx-sp"></span>
          <span class="nx-btn pri sm" data-c="surprise">${I("dices")}Surprise</span>
        </div>
      </div>
      <div class="nx-pn nx-a" style="--i:2">
        ${tabs([["sliders-horizontal", "Sparks — settings", 1]])}
        <div style="overflow:hidden">
          <div class="nx-lbl">Moods</div>
          <div class="nx-swatches nx-a" style="--i:3" data-moods>
            ${[["fire", "linear-gradient(90deg,#fff2cc,#ff8a2a,#c8401a)", [255, 240, 200], [255, 90, 20]], ["ice", "linear-gradient(90deg,#fff,#9ad0ff,#3a6fd0)", [235, 250, 255], [70, 140, 255]], ["arcane", "linear-gradient(90deg,#fff,#c9b6ff,#7a4fe0)", [240, 230, 255], [150, 90, 255]], ["toxic", "linear-gradient(90deg,#f2ffd0,#8ef05a,#2f8a2a)", [240, 255, 200], [60, 200, 60]], ["gold", "linear-gradient(90deg,#fff8dc,#ffd56a,#c8901a)", [255, 250, 220], [255, 170, 30]]]
              .map(([n, g, a, b], i) => `<span class="${i ? "" : "on"}" style="--g:${g}" data-mood="${n}" data-a="${a}" data-b="${b}"></span>`).join("")}
          </div>
          <div class="nx-lbl">Rhythm</div>
          ${chips([["repeat", "Continuous"], ["zap", "Burst"], ["wind", "Trail"]], 0, "", 4)}
          ${sl("Amount", 55, "120 /s", "amount", 5)}
          <div class="nx-lbl">Shape</div>
          ${chips([["circle-dot", "Point"], ["circle", "Ball"], ["orbit", "Ring"], ["box", "Box"], ["square", "Ground"]], 1, "shape", 6)}
          ${sl("Extent", 35, "1.5 studs", "", 7)}
          <div class="nx-lbl">Direction</div>
          ${chips([["arrow-up-right", "Up"], ["sparkles", "Fan"], ["target", "Everywhere"]], 1, "", 8)}
          ${sl("Speed", 62, "11", "", 9)}
          ${sl("Gravity", 30, "−14", "", 10)}
          ${sl("Swirl", 12, "0.2", "", 11)}
          ${sl("Size", 40, "0.35", "", 12)}
          ${sl("Lifetime", 48, "1.6 s", "", 13)}
          <div class="nx-lbl">Colors</div>
          <div class="nx-colors nx-a" style="--i:14" data-colors><i style="--c:#fff2cc" data-ca></i><span class="arr" style="--a:#fff2cc;--b:#ff5a14" data-cg></span><i style="--c:#ff5a14" data-cb></i></div>
          ${sl("Glow", 80, "×3", "", 15)}
        </div>
      </div>
    </div>
    ${status("Each slider edits the real modules (Spawn Rate, Initialize Particle, Add Velocity…) • Switch to Advanced at any time")}
    <div class="nx-toast">${I("check")}<span data-toast>Bigger ✓</span></div>
    ${cursor}
  </div>`;

  /* ---------- 6. Create a system ---------- */
  const TPL = [
    ["Explosion", "explosion", "Full explosion: flash, fireball, shockwave, debris, smoke, light.", [["Flash", "#f5efe0"], ["Fireball", "#e0662a"], ["Shockwave", "#c9a35b"], ["Debris", "#8a8a92"], ["Smoke", "#4a4a52"], ["Light", "#e8b931"]]],
    ["Alien Portal", "portal", "Swirling ring, spiral and runic disc (mesh), with a light.", [["Ring", "#6effbe"], ["Spiral", "#a064e6"], ["Rune Disc", "#7a5ad6"], ["Light", "#8a6bff"]]],
    ["Magic Trails", "trail", "Ribbon trails following moving heads (Location events).", [["Heads", "#b9a6ff"], ["Ribbons", "#5ad6ff"]]],
    ["Fire", "fire", "Flames, embers and smoke rising with turbulence.", [["Flames", "#ff8a2a"], ["Embers", "#ffcf8a"], ["Smoke", "#4a4a52"]]],
    ["Snow Area", "snow", "Snowfall over an area, simulated on the GPU (ParticleEmitter).", [["Snow (GPU)", "#e8f0ff"]]],
    ["Energy Orb", "orb", "Pulsing energy shell built with a Scratch Pad module.", [["Shell", "#5ad6ff"], ["Core", "#408cff"]]],
    ["Muzzle Flash", "muzzle", "Muzzle flash: brief flash, cone sparks, a little smoke.", [["Flash", "#ffe6a0"], ["Sparks", "#ff8c42"], ["Smoke", "#5a5a60"]]],
    ["Level Up", "levelup", "Golden spiral rising around the character, with a ring.", [["Spiral", "#ffd56a"], ["Ring", "#ffc24a"], ["Glow", "#fff2cc"]]],
    ["Confetti", "confetti", "Colorful confetti burst that falls and bounces.", [["Confetti", "#ff4d6d"]]],
  ];
  const CATS = [["layout-grid", "All"], ["clock", "Recent"], ["folder", "My effects"], ["swords", "Combat"], ["wand-sparkles", "Magic"], ["flame", "Fire & smoke"], ["leaf", "Nature & weather"], ["atom", "Sci-fi"], ["star", "UI & bonus"], ["graduation-cap", "Learning"], ["feather", "Lightweight (GPU)"]];
  const viewTemplates = () => {
    const D = window.NEBULA_DOCS && (window.NEBULA_DOCS[N.lang] || window.NEBULA_DOCS.fr);
    const cnt = {};
    if (D) D.templates.forEach((x) => { cnt[x.cat] = (cnt[x.cat] || 0) + 1; });
    const keyOf = { Combat: "Combat", Magic: "Magic", "Fire & smoke": "Fire", "Nature & weather": "Nature", "Sci-fi": "SciFi", "UI & bonus": "UI", Learning: "Learning", "Lightweight (GPU)": "Lightweight" };
    const total = D ? D.templates.length : 76;
    return `
  <div class="nx tb" data-view="templates" style="grid-template-rows:46px 1fr 56px">
    <div class="nx-head">
      <div class="nx-logo"><span class="lg">${N.logo()}</span>NebulaFX</div>
      <b style="color:#f0f1f5;font-size:14px;font-weight:600;margin-left:4px">Create a system</b>
      <span class="nx-sp"></span>
      <div class="nx-search" style="width:380px;margin:0">${I("search")}Search templates…</div>
      <span class="nx-sp"></span>
      <span class="nx-btn ic ghost">${I("x")}</span>
    </div>
    <div class="nx-body" style="grid-template-columns: 240px 1fr 400px;">
      <div class="nx-pn nx-a" style="--i:0"><div class="nx-cats">
        ${CATS.map(([ic, n], i) => `<div class="nx-cat${i === 0 ? " on" : ""}">${I(ic)}${n}<small>${i === 0 ? total : keyOf[n] ? cnt[keyOf[n]] || "" : ""}</small></div>`).join("")}
      </div></div>
      <div class="nx-pn nx-a" style="--i:1">
        <div class="nx-tool"><b style="color:#f0f1f5;font-weight:500">All templates</b><span class="nx-hint">${total} templates • Hover a card to see it animated</span></div>
        <div class="nx-tgrid">
          ${TPL.map(([n, p], i) => `<div class="nx-tcard nx-pop${i === 0 ? " sel" : ""}" style="--i:${i + 2}" data-t="${i}"><div class="cv"><canvas data-sim="${p}"></canvas></div><div class="nm">${I(["swords", "wand-sparkles", "wand-sparkles", "flame", "feather", "graduation-cap", "swords", "wand-sparkles", "star"][i])}${n}</div></div>`).join("")}
        </div>
      </div>
      <div class="nx-pn nx-a" style="--i:2"><div class="nx-detail">
        <div class="nx-big"><canvas data-sim="explosion" data-big></canvas></div>
        <h3 data-d="name">Explosion</h3>
        <p data-d="desc">${TPL[0][2]}</p>
        <div class="nx-emits" data-d="emits"></div>
      </div></div>
    </div>
    <div class="nx-foot">
      <span class="nx-btn">${I("plus")}Create an empty system</span>
      <span class="nx-check" style="margin-left:12px"><i>${I("check")}</i>Show at plugin launch</span>
      <span class="nx-sp"></span>
      <span class="nx-btn">Cancel</span><span class="nx-btn pri" data-c="create">${I("sparkles")}Create</span>
    </div>
    ${cursor}
  </div>`;
  };

  /* =====================================================================
     Carrousel
     ===================================================================== */
  const VIEWS = [
    { id: "editor", key: "pv.editor", icon: "workflow", html: viewEditor },
    { id: "scratch", key: "pv.scratch", icon: "puzzle", html: viewScratch },
    { id: "timeline", key: "pv.timeline", icon: "clock", html: viewTimeline },
    { id: "curves", key: "pv.curves", icon: "spline", html: viewCurves },
    { id: "simple", key: "pv.simple", icon: "wand-sparkles", html: viewSimple },
    { id: "templates", key: "pv.templates", icon: "layout-grid", html: viewTemplates },
  ];
  const SLIDE_MS = 9000;

  host.innerHTML = `
    <div class="pv" id="pv">
      <div class="pv-track">${VIEWS.map((v) => `<div class="pv-slide" data-id="${v.id}"><div class="pv-scale">${v.html()}</div></div>`).join("")}</div>
      <button class="pv-arrow prev" aria-label="‹">${I("arrow-left")}</button>
      <button class="pv-arrow next" aria-label="›">${I("arrow-right")}</button>
    </div>`;
  const pv = host.querySelector(".pv");
  const track = pv.querySelector(".pv-track");
  const slides = [...pv.querySelectorAll(".pv-slide")];
  const bar = document.getElementById("pvBar");
  const renderBar = () => {
    bar.innerHTML = VIEWS.map((v, i) => `<button class="pv-tab${i === cur ? " on" : ""}" data-i="${i}" style="--dur:${SLIDE_MS}ms">${I(v.icon)}<span>${t(v.key)}</span><i class="fill"></i></button>`).join("");
  };

  // Mise à l'échelle 1600×900 → largeur réelle
  const fit = () => {
    const w = pv.clientWidth;
    pv.style.setProperty("--s", (w / 1600).toFixed(5));
    sims[cur] && sims[cur].forEach((s) => s.resize());
  };

  // Simulations par vue
  const sims = slides.map((sl) => [...sl.querySelectorAll("canvas[data-sim]")].map((cv) => {
    const s = new Sim(cv, cv.dataset.sim, { bg: cv.dataset.bg || "void" });
    if (cv.dataset.period) s.cfg.period = +cv.dataset.period;
    s.big = cv.hasAttribute("data-big");
    s.cv = cv;
    return s;
  }));

  // Fils du Scratch Pad : tracés depuis la position réelle des pins
  const drawWires = () => {
    const g = pv.querySelector("[data-graph]");
    if (!g) return;
    const svg = g.querySelector(".nx-wires");
    const pos = (id, side) => {
      const el = g.querySelector(`[data-pin="${id}"]`);
      if (!el) return null;
      let x = 0, y = 0, n = el;
      while (n && n !== g) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return [side === "r" ? x + el.offsetWidth + 1 : x - 1, y + el.offsetHeight / 2];
    };
    let html = "", fl = "";
    WIRES.forEach(([a, b], i) => {
      const p = pos(a, "r"), q = pos(b, "l");
      if (!p || !q) return;
      const dx = Math.max(40, (q[0] - p[0]) * .5);
      const d = `M${p[0]} ${p[1]} C${p[0] + dx} ${p[1]} ${q[0] - dx} ${q[1]} ${q[0]} ${q[1]}`;
      html += `<path class="w" pathLength="1" d="${d}" style="--i:${i}"/>`;
      fl += `<path class="fl" d="${d}" style="animation-delay:${(i * .15).toFixed(2)}s, 2.2s"/>`;
    });
    svg.innerHTML = html + fl;
  };

  /* ---------- Horloge partagée + mises à jour en direct ---------- */
  let T = 0;
  const q = (sel, root) => root.querySelectorAll(sel);
  const updateLive = (root, simList) => {
    const n = simList.reduce((a, s) => a + s.p.length, 0);
    q(".nx-clock", root).forEach((e) => { e.textContent = T.toFixed(2); });
    q('[data-pv="num"]', root).forEach((e) => { e.textContent = n; });
    q('[data-pv="ms"]', root).forEach((e) => { e.textContent = (0.02 + n * 0.00018).toFixed(2); });
    q('[data-pv="age"]', root).forEach((e) => { e.textContent = T.toFixed(2); });
    q('[data-pv="nage"]', root).forEach((e) => { e.textContent = (T / DUR).toFixed(3); });
    q('[data-pv="force"]', root).forEach((e) => { e.textContent = (evalKeys([[0, .2], [1, .9], [2.2, .35], [3.4, .8], [4, .2]], T) * 100).toFixed(1); });
    q('[data-pv="ro"]', root).forEach((e) => { e.textContent = `${T.toFixed(2)} s · f${Math.floor(T * 60)}`; });
    q('[data-pv="phl"]', root).forEach((e) => { e.textContent = T.toFixed(2); });
    q("[data-ph]", root).forEach((e) => { e.style.left = pct(T) + "%"; });
    const ch = evalKeys(CHARGE, T);
    q('[data-pv="charge"]', root).forEach((e) => { e.textContent = ch.toFixed(2); });
    q('[data-pv="chargebar"]', root).forEach((e) => { e.style.width = ch * 100 + "%"; });
    q('[data-pv="tint"]', root).forEach((e) => { const k = T / DUR; e.style.background = `hsl(${30 + k * 200},90%,${65 - k * 10}%)`; });
    q(".nx-key[data-t]", root).forEach((e) => { e.classList.toggle("hit", Math.abs(T - +e.dataset.t) < .09); });
    // Courbes : sonde qui parcourt l'âge normalisé
    q("[data-curve]", root).forEach((box) => {
      const id = box.dataset.curve, x = (T / DUR);
      const line = box.querySelector(`[data-probe="${id}"]`);
      line.setAttribute("x1", x * 1000); line.setAttribute("x2", x * 1000);
      const k = id === "a" ? CRGBA.A : box._keys || CSIZE;
      const y = box._f ? box._f(x) : evalKeys(k, x);
      const dot = box.querySelector(`[data-pdot="${id}"]`);
      dot.style.left = x * 100 + "%"; dot.style.top = (300 - y * 270 - 15) / 3 + "%";
    });
  };

  /* ---------- Curseur simulé ---------- */
  let token = { dead: true };
  const sleep = (ms, tk) => new Promise((r) => setTimeout(() => r(!tk.dead), ms));
  const posIn = (el, root) => {
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return [x + el.offsetWidth * .5, y + el.offsetHeight * .55];
  };
  const SCRIPTS = {
    async editor(root, tk, c) {
      const props = root.querySelector(".nx-props-in");
      const sel = (id) => q(".nx-mod", root).forEach((m) => m.classList.toggle("sel", m.dataset.c === id));
      const setInsp = (title, desc, stage) => {
        const tt = root.querySelector('[data-insp="title"]');
        tt.style.opacity = 0;
        setTimeout(() => { tt.textContent = title; root.querySelector('[data-insp="desc"]').textContent = desc; root.querySelector('[data-insp="stage"]').textContent = stage; tt.style.opacity = 1; }, 250);
      };
      for (;;) {
        if (!(await c.move('[data-c="m-curl"]', 1400))) return;
        await c.click(); sel("m-curl");
        setInsp("Curl Noise Force", "Fluid, organic turbulence (smoke, magic, fire).", "Particle Update");
        props.style.transform = `translateY(-${root.querySelector('[data-sec="curl"]').offsetTop}px)`;
        if (!(await sleep(2200, tk))) return;
        if (!(await c.move('[data-c="m-vel"]', 900))) return;
        await c.click(); sel("m-vel");
        setInsp("Add Velocity", "Gives a velocity: fixed direction, from a point, in a cone, in orbit.", "Particle Spawn");
        props.style.transform = "";
        if (!(await sleep(900, tk))) return;
        if (!(await c.move('[data-c="speed"]', 900))) return;
        await c.click();
        const sp = root.querySelector('[data-c="speed"]'); sp.classList.add("focus");
        if (!(await sleep(1600, tk))) return;
        sp.classList.remove("focus");
      }
    },
    async scratch(root, tk, c) {
      const toast = root.querySelector(".nx-toast");
      for (;;) {
        if (!(await sleep(1200, tk))) return;
        if (!(await c.move('[data-n="E"] .h', 1200))) return;
        root.querySelector('[data-n="E"]').classList.add("hvn");
        if (!(await sleep(900, tk))) return;
        if (!(await c.move('[data-c="compile"]', 1000))) return;
        await c.click();
        toast.classList.add("show");
        if (!(await sleep(2400, tk))) return;
        toast.classList.remove("show");
        if (!(await c.move('[data-n="G"] .h', 1200))) return;
        if (!(await sleep(1600, tk))) return;
      }
    },
    async timeline(root, tk, c) {
      for (;;) {
        if (!(await c.move('[data-lane="charge"] [data-c="key"]', 1300))) return;
        await c.click();
        const k = root.querySelector('[data-lane="charge"] [data-c="key"]');
        k.classList.add("sel");
        root.querySelector('[data-pv="ktime"]').textContent = "1.60 s"; root.querySelector('[data-pv="kval"]').textContent = "0.40";
        if (!(await sleep(1800, tk))) return;
        if (!(await c.move('[data-c="addkey"]', 1100))) return;
        await c.click();
        if (!(await sleep(2200, tk))) return;
        k.classList.remove("sel");
      }
    },
    async curves(root, tk, c) {
      const ctx = root.querySelector("[data-ctx]");
      const boxB = root.querySelector('[data-curve="b"]');
      const path = boxB.querySelector("path.crv");
      const morph = (from, to, ms) => new Promise((res) => {
        const t0 = performance.now();
        const step = (now) => {
          const u = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - u, 3);
          const f = (x) => lerp(from(x), to(x), e);
          boxB._f = f;
          let d = "";
          for (let i = 0; i <= 120; i++) { const x = i / 120; d += (i ? " L" : "M") + `${x * 1000} ${300 - f(x) * 270 - 15}`; }
          path.setAttribute("d", d);
          if (u < 1 && !tk.dead) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      const cub = cubicPath(CSIZE).f, lin = cubicPath(CSIZE, true).f;
      for (;;) {
        if (!(await c.move('[data-k="b1"]', 1300))) return;
        await c.click();
        root.querySelector('[data-k="b1"]').classList.add("sel");
        const k = root.querySelector('[data-k="b1"]');
        ctx.style.left = (k.offsetLeft + k.parentElement.offsetLeft + 14) + "px";
        ctx.style.top = (k.offsetTop + k.parentElement.offsetTop + 10) + "px";
        ctx.classList.add("show");
        if (!(await sleep(900, tk))) return;
        if (!(await c.move('[data-c="linear"]', 700))) return;
        await c.click();
        ctx.classList.remove("show");
        await morph(cub, lin, 700);
        if (!(await sleep(2200, tk))) return;
        await morph(lin, cub, 900);
        root.querySelector('[data-k="b1"]').classList.remove("sel");
        if (!(await sleep(1200, tk))) return;
      }
    },
    async simple(root, tk, c, simList) {
      const s = simList[0];
      const toast = root.querySelector(".nx-toast"), toastT = root.querySelector("[data-toast]");
      const amount = root.querySelector('[data-sl="amount"]');
      const setMood = (el) => {
        q("[data-mood]", root).forEach((m) => m.classList.toggle("on", m === el));
        const a = el.dataset.a.split(",").map(Number), b = el.dataset.b.split(",").map(Number);
        s.cfg.c0 = a; s.cfg.c1 = b;
        const ca = `rgb(${a})`, cb = `rgb(${b})`;
        root.querySelector("[data-ca]").style.setProperty("--c", ca);
        root.querySelector("[data-cb]").style.setProperty("--c", cb);
        root.querySelector("[data-cg]").style.cssText = `--a:${ca};--b:${cb}`;
        root.querySelector("[data-layer]").style.setProperty("--g", `radial-gradient(circle,#fff,${cb} 50%,#111)`);
      };
      const setShape = (v) => { q('[data-chips="shape"] span', root).forEach((e) => e.classList.toggle("on", e.dataset.v === v)); s.cfg.shape = v; };
      const toastShow = async (txt) => { toastT.textContent = txt; toast.classList.add("show"); await sleep(1300, tk); toast.classList.remove("show"); };
      for (;;) {
        s.cfg = { rate: 120, shape: "ball", c0: [255, 240, 200], c1: [255, 90, 20] };
        setMood(root.querySelector('[data-mood="fire"]'));
        amount.querySelector(".fi").style.setProperty("--v", "55%"); amount.querySelector(".val").textContent = "120 /s";
        if (!(await sleep(900, tk))) return;
        const knob = amount.querySelector(".tr");
        const [kx, ky] = posIn(knob, root);
        if (!(await c.moveTo(kx - knob.offsetWidth * .5 + knob.offsetWidth * .55, ky - 2, 1200))) return;
        amount.classList.add("drag");
        c.el.classList.add("drag");
        c.go(kx - knob.offsetWidth * .5 + knob.offsetWidth * .9, ky - 2);
        amount.querySelector(".fi").style.setProperty("--v", "90%");
        const t0 = performance.now();
        while (performance.now() - t0 < 1500) { const u = (performance.now() - t0) / 1500; const v = Math.round(lerp(120, 260, u)); amount.querySelector(".val").textContent = v + " /s"; s.cfg.rate = v; if (!(await sleep(50, tk))) return; }
        amount.classList.remove("drag"); c.el.classList.remove("drag");
        if (!(await c.move('[data-chips="shape"] [data-v="ring"]', 1000))) return;
        await c.click(); setShape("ring");
        if (!(await sleep(1300, tk))) return;
        if (!(await c.move('[data-mood="arcane"]', 1000))) return;
        await c.click(); setMood(root.querySelector('[data-mood="arcane"]'));
        if (!(await sleep(1400, tk))) return;
        if (!(await c.move('[data-c="bigger"]', 1000))) return;
        await c.click(); s.cfg.size = 1.5; toastShow("Bigger ✓");
        if (!(await sleep(1500, tk))) return;
        if (!(await c.move('[data-mood="ice"]', 900))) return;
        await c.click(); setMood(root.querySelector('[data-mood="ice"]')); setShape("ball"); s.cfg.size = 1;
        if (!(await sleep(1800, tk))) return;
      }
    },
    async templates(root, tk, c, simList) {
      const big = simList.find((s) => s.big);
      const cards = q(".nx-tcard", root);
      const show = (i) => {
        cards.forEach((e, j) => e.classList.toggle("sel", j === i));
        const [n, p, d, em] = TPL[i];
        const h = root.querySelector('[data-d="name"]');
        h.style.opacity = 0;
        setTimeout(() => {
          h.textContent = n; root.querySelector('[data-d="desc"]').textContent = d; h.style.opacity = 1;
          root.querySelector('[data-d="emits"]').innerHTML = em.map(([e, col], k) => `<div class="nx-pop" style="--c:${col};--i:${k};animation:nxPop .6s var(--ease) both ${k * 60}ms;opacity:1;transform:none"><i></i>${e}<small>CPU</small></div>`).join("");
        }, 200);
        big.set(p); big.cfg.period = p === "explosion" ? 2.8 : undefined;
      };
      show(0);
      for (const i of [1, 4, 7, 3, 5]) {
        const sel = `[data-t="${i}"]`;
        if (!(await c.move(sel, 1100))) return;
        cards.forEach((e) => e.classList.remove("hv"));
        root.querySelector(sel).classList.add("hv");
        if (!(await sleep(500, tk))) return;
        await c.click(); show(i);
        if (!(await sleep(1500, tk))) return;
      }
      cards.forEach((e) => e.classList.remove("hv"));
    },
  };

  const runCursor = (i) => {
    token.dead = true;
    const tk = (token = { dead: false });
    const root = slides[i].querySelector(".nx");
    const el = root.querySelector(".nx-cursor");
    if (!el || reduce) return;
    const c = {
      el,
      go(x, y) { el.style.transform = `translate(${x}px, ${y}px)`; },
      async moveTo(x, y, ms) { el.style.transitionDuration = ms + "ms"; c.go(x, y); el.classList.add("show"); return sleep(ms + 80, tk); },
      async move(sel, ms) { const target = root.querySelector(sel); if (!target) return !tk.dead; const [x, y] = posIn(target, root); return c.moveTo(x, y, ms); },
      async click() { el.classList.remove("click"); void el.offsetWidth; el.classList.add("click"); return sleep(220, tk); },
    };
    el.style.transitionDuration = "0ms";
    c.go(1080, 640);
    const fn = SCRIPTS[slides[i].dataset.id];
    if (fn) setTimeout(() => !tk.dead && fn(root, tk, c, sims[i]), 1400);
  };

  /* ---------- Navigation ---------- */
  let cur = 0, timer = 0, paused = false, startedAt = 0, remain = SLIDE_MS;
  const go = (i, user) => {
    cur = (i + slides.length) % slides.length;
    track.style.transform = `translateX(${-cur * 100}%)`;
    slides.forEach((s, j) => s.classList.toggle("cur", j === cur));
    T = 0;
    sims[cur].forEach((s) => { s.reset(); });
    requestAnimationFrame(() => sims[cur].forEach((s) => s.resize()));
    setTimeout(() => sims[cur].forEach((s) => s.resize()), 1200);
    renderBar();
    runCursor(cur);
    schedule(SLIDE_MS);
    if (user) bar.classList.toggle("paused", paused);
  };
  const schedule = (ms) => {
    clearTimeout(timer);
    remain = ms; startedAt = performance.now();
    if (!paused && !reduce) timer = setTimeout(() => go(cur + 1), ms);
  };
  pv.addEventListener("pointerenter", () => { paused = true; clearTimeout(timer); remain -= performance.now() - startedAt; bar.classList.add("paused"); });
  pv.addEventListener("pointerleave", () => { paused = false; bar.classList.remove("paused"); schedule(Math.max(1500, remain)); });
  bar.addEventListener("click", (e) => { const b = e.target.closest(".pv-tab"); if (b) go(+b.dataset.i, true); });
  pv.querySelector(".pv-arrow.prev").addEventListener("click", () => go(cur - 1, true));
  pv.querySelector(".pv-arrow.next").addEventListener("click", () => go(cur + 1, true));

  // Glisser (souris / tactile)
  let dragX = null, dragDX = 0;
  pv.addEventListener("pointerdown", (e) => { if (e.target.closest(".pv-arrow")) return; dragX = e.clientX; dragDX = 0; });
  addEventListener("pointermove", (e) => {
    if (dragX === null) return;
    dragDX = e.clientX - dragX;
    if (Math.abs(dragDX) > 6) { pv.classList.add("dragging"); track.style.transform = `translateX(calc(${-cur * 100}% + ${dragDX}px))`; }
  });
  addEventListener("pointerup", () => {
    if (dragX === null) return;
    pv.classList.remove("dragging");
    if (dragDX < -60) go(cur + 1, true); else if (dragDX > 60) go(cur - 1, true); else track.style.transform = `translateX(${-cur * 100}%)`;
    dragX = null;
  });

  /* ---------- Boucle d'animation ---------- */
  let visible = true, last = performance.now();
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: .05 }).observe(pv);
  const frame = (now) => {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden) {
      T = (T + dt) % DUR;
      const list = sims[cur];
      for (const s of list) { if (!s.w) s.resize(); s.step(dt); s.draw(); }
      updateLive(slides[cur], list);
    }
    requestAnimationFrame(frame);
  };

  new ResizeObserver(fit).observe(pv);
  fit();
  renderBar();
  const qs = new URLSearchParams(location.search);
  const boot = () => {
    drawWires();
    if (qs.has("pv")) paused = true; // ?pv=N : ouvre la vue N sans défilement automatique (tests)
    go(+qs.get("pv") || 0);
    requestAnimationFrame(frame);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(boot);
  N.onLang(() => renderBar());
})();
