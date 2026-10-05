'use strict';
// ---------- math ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const deg = (d) => (d * Math.PI) / 180;
const angNorm = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const angDiff = (from, to) => angNorm(to - from);
const hypot = Math.hypot;
const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

// rotate a local offset (lx, ly) by angle r
function rotXY(lx, ly, r) {
  const c = Math.cos(r), s = Math.sin(r);
  return [lx * c - ly * s, lx * s + ly * c];
}

// ---------- storage (per-viewer conveniences only) ----------
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('tanksim.' + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('tanksim.' + k, JSON.stringify(v));
    } catch (e) {}
  },
};

// ---------- assets ----------
// ASSETS.t = top-down tanks (retina PNG), ASSETS.u = UI pack adventure (double PNG); both inlined by tools/build.py
const IMG = {}; // tank sprites
const UIIMG = {}; // UI sprites drawn on canvas
const USED = new Set(); // which sprites the game has touched (debug: window.tankAssetReport())
function img(name) {
  USED.add('t:' + name);
  const im = IMG[name];
  if (!im) console.warn('missing sprite', name);
  return im;
}
function uimg(name) {
  USED.add('u:' + name);
  return UIIMG[name];
}
function uiSrc(name) {
  USED.add('u:' + name);
  return ASSETS.u[name];
}
function tSrc(name) {
  USED.add('t:' + name);
  return ASSETS.t[name];
}

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(im);
    im.src = src;
  });
}

async function loadAssets() {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(ASSETS.u)) root.setProperty('--u-' + k, 'url("' + v + '")');
  const jobs = [];
  for (const [k, v] of Object.entries(ASSETS.t)) jobs.push(loadImage(v).then((im) => (IMG[k] = im)));
  for (const [k, v] of Object.entries(ASSETS.u)) jobs.push(loadImage(v).then((im) => (UIIMG[k] = im)));
  await Promise.all(jobs);
  document.querySelectorAll('img[data-ui]').forEach((el) => (el.src = uiSrc(el.dataset.ui)));
}

// debug only (open with #debug): mark UI sprites that CSS classes put on screen
const DEBUG = location.hash === '#debug';
let uriTail = null;
function noteCssSprites(rootEl) {
  if (!uriTail) uriTail = new Map(Object.entries(ASSETS.u).map(([k, v]) => [v.slice(-48), k]));
  const els = [rootEl, ...rootEl.querySelectorAll('*')];
  for (const el of els) {
    if (el.closest('[hidden]')) continue;
    const cs = getComputedStyle(el);
    for (const v of [cs.borderImageSource, cs.backgroundImage]) {
      if (!v || v === 'none') continue;
      for (const m of v.matchAll(/url\("?([^")]+)"?\)/g)) {
        const k = uriTail.get(m[1].slice(-48));
        if (k) USED.add('u:' + k);
      }
    }
  }
}

window.tankAssetReport = function () {
  noteCssSprites(document.body);
  const missT = Object.keys(ASSETS.t).filter((k) => !USED.has('t:' + k));
  const missU = Object.keys(ASSETS.u).filter((k) => !USED.has('u:' + k));
  return { tanksUsed: Object.keys(ASSETS.t).length - missT.length, tanksTotal: Object.keys(ASSETS.t).length, uiUsed: Object.keys(ASSETS.u).length - missU.length, uiTotal: Object.keys(ASSETS.u).length, missingTanks: missT, missingUi: missU };
};

// ---------- drawing helpers ----------
function drawSprite(ctx, name, x, y, rot = 0, scale = 1, alpha = 1, ox = 0.5, oy = 0.5) {
  const im = img(name);
  if (!im || !im.width) return;
  const c = Math.cos(rot) * scale, s = Math.sin(rot) * scale;
  ctx.save();
  ctx.transform(c, s, -s, c, x, y);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(im, -im.width * ox, -im.height * oy);
  ctx.restore();
}

// 3-slice a pill-shaped UI bar sprite horizontally (cap = half of the sprite width)
function drawPill(ctx, name, x, y, w, h) {
  const im = uimg(name);
  if (!im || w <= 0) return;
  const iw = im.width, ih = im.height;
  const cap = Math.min(h / 2, w / 2);
  const sc = iw / 2; // source cap width
  // sprites are vertical pills; draw rotated so caps sit left/right
  ctx.save();
  ctx.translate(x, y + h);
  ctx.rotate(-Math.PI / 2);
  // now drawing along +y for "w" and +x for "h"
  const midY = ih - 2 * sc > 0 ? sc : ih / 2 - 0.5;
  const midH = ih - 2 * sc > 0 ? ih - 2 * sc : 1;
  ctx.drawImage(im, 0, 0, iw, sc, 0, 0, h, cap);
  if (w > 2 * cap) ctx.drawImage(im, 0, midY, iw, midH, 0, cap, h, w - 2 * cap);
  ctx.drawImage(im, 0, ih - sc, iw, sc, 0, w - cap, h, cap);
  ctx.restore();
}

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function show(id, on = true) {
  const e = typeof id === 'string' ? $(id) : id;
  e.hidden = !on;
  if (on && DEBUG) setTimeout(() => noteCssSprites(e), 300);
}
function setBar(id, frac) {
  const b = typeof id === 'string' ? $(id) : id;
  const w = b.clientWidth + 16;
  b.firstElementChild.style.width = Math.max(16, Math.round(clamp(frac, 0, 1) * w)) + 'px';
  b.firstElementChild.style.opacity = frac <= 0.001 ? 0 : 1;
}
function fmtTime(t) {
  t = Math.max(0, Math.floor(t));
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

// ---------- input ----------
const Input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, down: false, inside: false },
  touchMove: { x: 0, y: 0, active: false },
  touchAim: { x: 0, y: 0, active: false, fire: false },
  isTouch: false,
  init(canvas) {
    try {
      this.isTouch = matchMedia('(pointer: coarse)').matches;
    } catch (e) {}
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && Game.mode) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Escape') App.onEscape();
      else if (e.code === 'KeyP') Game.togglePause();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.inside = true;
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this.setTouch(true);
        if (Game.mode) {
          this.touchAim.x = e.clientX;
          this.touchAim.y = e.clientY;
          this.touchAim.active = true;
          this.touchAim.fire = true;
          this.touchAim.id = e.pointerId;
        }
      } else {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        if (e.button === 0) this.mouse.down = true;
      }
      App.onPointerDown(e);
    });
    canvas.addEventListener('pointerleave', () => (this.mouse.inside = false));
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && this.touchAim.active && e.pointerId === this.touchAim.id) {
        this.touchAim.x = e.clientX;
        this.touchAim.y = e.clientY;
      }
    });
    addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') {
        if (e.pointerId === this.touchAim.id) {
          this.touchAim.fire = false;
          this.touchAim.active = false;
        }
      } else if (e.button === 0) this.mouse.down = false;
    });
    addEventListener('pointercancel', (e) => {
      if (e.pointerId === this.touchAim.id) {
        this.touchAim.fire = false;
        this.touchAim.active = false;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },
  setTouch(on) {
    if (this.isTouch === on) return;
    this.isTouch = on;
    if (Game.mode) show('touch', on);
    $('hintBar').hidden = on || $('hintBar').hidden;
  },
  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  },
};
