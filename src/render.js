// ---------- canvas + camera ----------
// The camera looks at (x, y) and puts that point at (W/2, H*ay) on screen, scaled by s and turned by rot.
// In battle rot = -90deg - heading, so the player's tank always points to the top of the screen.
const R = {
  cv: null, ctx: null, dpr: 1, W: 0, H: 0,
  cam: { x: 918, y: 515, s: 1, rot: 0, ay: 0.5 },
  init() {
    this.cv = $('stage');
    this.ctx = this.cv.getContext('2d');
    addEventListener('resize', () => this.resize());
    this.resize();
  },
  dirty: true,
  resize() {
    this.W = innerWidth;
    this.H = innerHeight;
    // big Retina screens would otherwise ask for 10+ megapixels every frame and load the whole machine
    const budget = Math.sqrt(4.2e6 / Math.max(1, this.W * this.H));
    this.dpr = Math.max(0.75, Math.min(this.cap, window.devicePixelRatio || 1, budget));
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.dirty = true;
    if (typeof Home !== 'undefined') Home.tipsDirty = true;
  },
  // fit a world rect inside the window (contain) or over it (cover), unrotated
  frame(x, y, w, h, cover) {
    const sx = this.W / w, sy = this.H / h;
    Object.assign(this.cam, { s: cover ? Math.max(sx, sy) : Math.min(sx, sy), x: x + w / 2, y: y + h / 2, rot: 0, ay: 0.5 });
  },
  apply(shakeX = 0, shakeY = 0) {
    const { s, x, y, rot, ay } = this.cam, d = this.dpr;
    const k = d * s, c = Math.cos(rot) * k, n = Math.sin(rot) * k;
    this.ctx.setTransform(c, n, -n, c, d * (this.W / 2 + shakeX) - (c * x - n * y), d * (this.H * ay + shakeY) - (n * x + c * y));
  },
  toWorld(px, py) {
    const { s, x, y, rot, ay } = this.cam;
    const u = (px - this.W / 2) / s, v = (py - this.H * ay) / s, c = Math.cos(rot), n = Math.sin(rot);
    return [x + c * u + n * v, y - n * u + c * v];
  },
  toScreen(wx, wy) {
    const { s, x, y, rot, ay } = this.cam;
    const dx = wx - x, dy = wy - y, c = Math.cos(rot), n = Math.sin(rot);
    return [this.W / 2 + s * (c * dx - n * dy), this.H * ay + s * (n * dx + c * dy)];
  },
  // world-space bounding box of what is on screen (plus a margin)
  viewBox(m = 0) {
    const pts = [this.toWorld(0, 0), this.toWorld(this.W, 0), this.toWorld(0, this.H), this.toWorld(this.W, this.H)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x0: Math.min(...xs) - m, y0: Math.min(...ys) - m, x1: Math.max(...xs) + m, y1: Math.max(...ys) + m };
  },
  clear() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#3b3125';
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'low';
  },
  // drop the backing-store resolution step by step when frames keep running long on this machine
  ft: 16, slowFor: 0, cap: 2,
  fastFor: 0,
  watch(frameMs) {
    // gaps this long mean the browser is throttling a covered or unfocused window, not that drawing is slow
    if (frameMs > 70) return;
    this.ft += (frameMs - this.ft) * 0.05;
    this.slowFor = this.ft > 24 ? this.slowFor + frameMs : 0;
    this.fastFor = this.ft < 18 ? this.fastFor + frameMs : 0;
    if (this.slowFor > 1500 && this.cap > 1) {
      this.cap = Math.max(1, this.cap - 0.5);
      this.slowFor = this.fastFor = 0;
      this.ft = 16;
      this.resize();
    } else if (this.fastFor > 8000 && this.cap < 2) {
      this.cap = Math.min(2, this.cap + 0.5);
      this.slowFor = this.fastFor = 0;
      this.resize();
    }
  },
};

// ---------- tank drawing ----------
function drawTank(ctx, t, scale = 1, glow = null) {
  ctx.save();
  if (scale !== 1) {
    ctx.translate(t.x, t.y);
    ctx.scale(scale, scale);
    ctx.translate(-t.x, -t.y);
  }
  const body = t.H.body + (t.outline ? '_outline' : '');
  drawSprite(ctx, body, t.x, t.y, t.a - Math.PI / 2);
  if (t.flash > 0 || glow === 'body') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawSprite(ctx, body, t.x, t.y, t.a - Math.PI / 2, 1, glow === 'body' ? 0.22 : 0.55);
    ctx.restore();
  }
  if (glow === 'tracks') {
    // light up just the two track strips
    const im = img(body);
    const hw = im.width / 2, hh = im.height / 2, tw = t.H.trackW + (t.outline ? 4 : 0);
    ctx.save();
    const c = Math.cos(t.a - Math.PI / 2), s = Math.sin(t.a - Math.PI / 2);
    ctx.transform(c, s, -s, c, t.x, t.y);
    ctx.beginPath();
    ctx.rect(-hw, -hh, tw, hh * 2);
    ctx.rect(hw - tw, -hh, tw, hh * 2);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(im, -hw, -hh);
    ctx.restore();
  }
  t.guns.forEach((g, i) => drawBarrel(ctx, t, i));
  ctx.restore();
}

function drawBarrel(ctx, t, i) {
  const b = BARRELS[t.guns[i]];
  const name = barrelSprite(t, i);
  const im = img(name);
  if (!im) return;
  const [mx, my] = mountPos(t, i);
  const ang = barrelAngle(t, i);
  const kick = (t.recoil[i] || 0) * 7;
  const px = b.pivot[0] + (t.outline ? 4 : 0), py = b.pivot[1] + (t.outline ? 4 : 0);
  const flip = t.H.mounts[i][2] ? -1 : 1;
  const r = ang - Math.PI / 2;
  const c = Math.cos(r), s = Math.sin(r);
  ctx.save();
  ctx.transform(c * flip, s * flip, -s, c, mx - Math.cos(ang) * kick, my - Math.sin(ang) * kick);
  ctx.drawImage(im, -px, -py);
  ctx.restore();
}

function drawTurretGun(ctx, tu) {
  const b = BARRELS[tu.gun];
  const im = img(b.sprite + (tu.outline ? '_outline' : ''));
  const px = b.pivot[0] + (tu.outline ? 4 : 0), py = b.pivot[1] + (tu.outline ? 4 : 0);
  const r = tu.a - Math.PI / 2, c = Math.cos(r), s = Math.sin(r);
  ctx.save();
  ctx.transform(c, s, -s, c, tu.gx, tu.gy);
  ctx.drawImage(im, -px, -py);
  if (tu.hitT < 0.1) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(im, -px, -py);
  }
  ctx.restore();
}

function drawProp(ctx, o) {
  drawSprite(ctx, o.sprite, o.x, o.y, o.rot);
}

function drawBar(ctx, x, y, w, h, frac, fill) {
  drawPill(ctx, 'progress_transparent_small', x, y, w, h);
  if (frac > 0) drawPill(ctx, fill, x, y, Math.max(h, w * frac), h);
}

// tiles are drawn one by one (only the ones on screen) so the map can be any size and the view can turn;
// past the map edge the outermost row/column repeats, so turning near the border never shows a hole
const TILE_CACHE = {};
function tileImg(name) {
  if (TILE_CACHE[name]) return TILE_CACHE[name];
  const [n, rot] = name.split('@');
  const im = img('tile' + n);
  if (!rot) return (TILE_CACHE[name] = im);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.translate(64, 64);
  c.rotate(deg(+rot));
  c.drawImage(im, -64, -64);
  return (TILE_CACHE[name] = cv);
}
function drawTiles(ctx, map, box) {
  const { tiles, ox, oy } = map;
  const rows = tiles.length, cols = tiles[0].length;
  const c0 = Math.floor((box.x0 - ox) / 128), c1 = Math.floor((box.x1 - ox) / 128);
  const r0 = Math.floor((box.y0 - oy) / 128), r1 = Math.floor((box.y1 - oy) / 128);
  for (let r = r0; r <= r1; r++) {
    const row = tiles[clamp(r, 0, rows - 1)];
    for (let c = c0; c <= c1; c++) ctx.drawImage(tileImg(row[clamp(c, 0, cols - 1)]), ox + c * 128 - 1, oy + r * 128 - 1, 130, 130);
  }
}
const inBox = (b, x, y, m = 90) => x > b.x0 - m && x < b.x1 + m && y > b.y0 - m && y < b.y1 + m;

function drawWorld(ctx) {
  const box = R.viewBox(8);
  drawTiles(ctx, W.map, box);
  for (const d of W.decals) {
    if (!inBox(box, d.x, d.y)) continue;
    const fade = Math.min(1, (d.life - d.t) / 1.5);
    drawSprite(ctx, d.sprite, d.x, d.y, d.rot, 1, d.alpha * fade);
  }
  for (const o of W.props) if (o.alive && o.layer === 'ground' && inBox(box, o.x, o.y)) drawProp(ctx, o);
  for (const o of W.props) if (o.alive && o.layer === 'low' && inBox(box, o.x, o.y)) drawProp(ctx, o);
  for (const o of W.perimeter || []) if (inBox(box, o.x, o.y)) drawSprite(ctx, o.sprite, o.x, o.y, o.rot);
  for (const tu of W.turrets) if (tu.alive) drawTurretGun(ctx, tu);
  for (const t of W.tanks) if (t.alive && t !== W.player && inBox(box, t.x, t.y, 160)) drawTank(ctx, t);
  if (W.player && W.player.alive) drawTank(ctx, W.player);
  for (const b of W.bullets) if (inBox(box, b.x, b.y)) drawSprite(ctx, b.sprite, b.x, b.y, b.a - Math.PI / 2);
  for (const o of W.props) if (o.alive && o.layer === 'high' && inBox(box, o.x, o.y)) drawProp(ctx, o);
  for (const e of W.effects) {
    if (!inBox(box, e.x, e.y, 140)) continue;
    if (e.kind === 'anim') {
      if (e.t < 0) continue;
      const f = Math.min(5, Math.floor(e.t / e.fd) + 1);
      drawSprite(ctx, e.seq + f, e.x, e.y, e.rot, e.scale);
    } else if (e.kind === 'flash') drawSprite(ctx, e.sprite, e.x, e.y, e.rot, 1, 1 - e.t / e.life);
    else if (e.kind === 'leaf') drawSprite(ctx, e.sprite, e.x, e.y, e.rot, 1, 1 - e.t / e.life);
  }
}

// health bars stay level on screen whichever way the world is turned
function drawOverlays(ctx) {
  if (!Settings.bars) return;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  const s = R.cam.s;
  const above = (x, y, lift) => {
    const [sx, sy] = R.toScreen(x, y);
    return [sx, sy - lift];
  };
  for (const t of W.tanks) {
    if (!t.alive) continue;
    const fr = t.hp / t.maxHp;
    const [x, y] = above(t.x, t.y, t.r * s + 18);
    if (x < -60 || y < -40 || x > R.W + 60 || y > R.H + 40) continue;
    if (t === W.player) drawBar(ctx, x - 30, y - 5, 60, 10, fr, t.regen ? 'progress_green_small_border' : 'progress_green_small');
    else if (t.team === 'player') drawBar(ctx, x - 27, y - 5, 54, 10, fr, 'progress_blue_small'); // friendly: always shown, in blue
    else if (fr < 1 || t.hitT < 2) drawBar(ctx, x - 27, y - 5, 54, 10, fr, t.isLarge ? 'progress_red_small_border' : 'progress_red_small');
  }
  for (const tu of W.turrets) {
    if (!tu.alive || tu.hp >= tu.maxHp) continue;
    const [x, y] = above(tu.gx, tu.gy, 30 * s + 16);
    drawBar(ctx, x - 24, y - 4, 48, 8, tu.hp / tu.maxHp, tu.team === 'player' ? 'progress_blue_small' : 'progress_white_small');
  }
  for (const o of W.props) {
    if (!o.alive || o.hurtT == null || o.hp === Infinity || o.hp >= o.maxHp) continue;
    o.hurtT += 1 / 60;
    if (o.hurtT >= 1.6) continue;
    const [x, y] = above(o.x, o.y, 30 * s + 12);
    drawBar(ctx, x - 19, y - 4, 38, 8, Math.max(0, o.hp / o.maxHp), 'progress_white_small_border');
  }
}

// ---------- radar ----------
const COMPASS = {
  toon: { n: 'minimap_compass_toon_n', e: 'minimap_compass_toon_e', s: 'minimap_compass_toon_s', w: 'minimap_compass_toon_w' },
  future: { n: 'minimap_compass_future_n', e: 'minimap_compass_future_e', s: 'minimap_compass_future_s', w: 'minimap_compass_future_w' },
};
const Radar = {
  cv: null, ctx: null,
  init() {
    this.cv = $('radar');
    this.ctx = this.cv.getContext('2d');
  },
  draw() {
    const c = this.ctx, S = 300, C = 150, inner = 124;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, S, S);
    const p = W.player;
    const cx = p ? p.x : W.view.x + W.view.w / 2, cy = p ? p.y : W.view.y + W.view.h / 2;
    const range = 1200, k = inner / range;
    // the radar turns with the camera: straight up is where the tank is heading
    const rot = R.cam.rot, rc = Math.cos(rot), rs = Math.sin(rot);
    c.save();
    c.beginPath();
    c.arc(C, C, inner, 0, TAU);
    c.fillStyle = W.mode.key === 'defense' ? 'rgba(24,32,40,.62)' : 'rgba(34,40,22,.6)';
    c.fill();
    c.clip();
    const icon = (name, x, y, sc = 0.62, spin = 0) => {
      const wx = (x - cx) * k, wy = (y - cy) * k;
      const dx = rc * wx - rs * wy, dy = rs * wx + rc * wy;
      if (dx * dx + dy * dy > inner * inner) return;
      const im = uimg(name);
      c.save();
      c.translate(C + dx, C + dy);
      if (spin) c.rotate(spin);
      c.drawImage(im, (-im.width * sc) / 2, (-im.height * sc) / 2, im.width * sc, im.height * sc);
      c.restore();
    };
    for (const o of W.props) {
      if (!o.alive) continue;
      if (o.kind === 'barrel') icon('minimap_icon_jewel_yellow', o.x, o.y, 0.42);
      else if (o.kind === 'crate') icon('minimap_icon_jewel_white', o.x, o.y, 0.38);
    }
    if (W.mode.key === 'defense') {
      for (let y = 40; y < W.view.h; y += 160) icon('minimap_icon_star_white', W.map.lineX, y, 0.42);
    } else if (W.spawnPoint) icon('minimap_icon_star_yellow', W.spawnPoint[0], W.spawnPoint[1], 0.5);
    for (const tu of W.turrets) icon(!tu.alive ? 'minimap_icon_exclamation_white' : tu.team === 'player' ? 'minimap_icon_star_white' : 'minimap_icon_exclamation_red', tu.gx, tu.gy, 0.62);
    for (const t of W.tanks) {
      if (t.team === 'player' && t !== p) {
        // friendly tank: its own arrow; a white mark where it will come back
        if (t.alive) icon('minimap_arrow_b', t.x, t.y, 0.62, t.a + Math.PI / 2 + rot);
        else if (t.respawnT > 0) icon('minimap_icon_exclamation_white', t.spawn.x, t.spawn.y, 0.5);
        continue;
      }
      if (t.team !== 'enemy') continue;
      if (!t.alive) {
        if (t.respawnT > 0 && t.spawn) icon('minimap_icon_exclamation_white', t.spawn.x, t.spawn.y, 0.5);
        continue;
      }
      if (W.mode.key === 'defense' && t.x - W.map.lineX < 280) icon('minimap_icon_exclamation_yellow', t.x, t.y, 0.75);
      else icon(t.isLarge ? 'minimap_icon_star_red' : 'minimap_icon_jewel_red', t.x, t.y, t.isLarge ? 0.62 : 0.5);
    }
    if (p && p.alive) icon('minimap_arrow_a', p.x, p.y, 0.75, p.a + Math.PI / 2 + rot);
    c.restore();
    const ring = W.mode.key === 'defense' ? 'minimap_ring_grey_detail' : W.mode.key === 'fun' ? 'minimap_ring_brown' : 'minimap_ring_brown_detail';
    c.save();
    c.translate(C, C);
    c.rotate(rot);
    c.drawImage(uimg(ring), -C, -C, S, S);
    c.restore();
    const set = W.mode.key === 'defense' ? COMPASS.future : COMPASS.toon;
    // compass letters ride around the ring so N always points at true north
    const letter = (d, wx, wy) => {
      const im = uimg(set[d]);
      const sc = 0.62, rr = C - 15;
      const x = C + (rc * wx - rs * wy) * rr, y = C + (rs * wx + rc * wy) * rr;
      c.drawImage(im, x - (im.width * sc) / 2, y - (im.height * sc) / 2, im.width * sc, im.height * sc);
    };
    letter('n', 0, -1);
    letter('s', 0, 1);
    letter('e', 1, 0);
    letter('w', -1, 0);
  },
};

// ---------- small canvases: loadout thumbnails & garage blueprint ----------
function previewTank(lo, x, y, a = -Math.PI / 2) {
  const t = makeTank({ team: 'player', hull: lo.hull, guns: lo.guns, x, y, a: (a * 180) / Math.PI });
  t.turret = a;
  t.aimX = x + Math.cos(a) * 2000;
  t.aimY = y + Math.sin(a) * 2000;
  return t;
}
function drawThumb(cv, lo) {
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  const t = previewTank(lo, cv.width / 2, cv.height / 2 + 6);
  const size = Math.max(img(t.H.body).width, img(t.H.body).height) + 50;
  const s = (cv.width * 0.9) / size;
  drawTank(c, t, s);
}
