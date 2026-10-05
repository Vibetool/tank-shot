// ---------- canvas + camera ----------
const R = {
  cv: null, ctx: null, dpr: 1, W: 0, H: 0,
  cam: { x: 918, y: 515, s: 1 },
  init() {
    this.cv = $('stage');
    this.ctx = this.cv.getContext('2d');
    addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = innerWidth;
    this.H = innerHeight;
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
  },
  // fit a world rect inside the window (contain) or over it (cover)
  frame(x, y, w, h, cover) {
    const sx = this.W / w, sy = this.H / h;
    this.cam.s = cover ? Math.max(sx, sy) : Math.min(sx, sy);
    this.cam.x = x + w / 2;
    this.cam.y = y + h / 2;
  },
  apply(shakeX = 0, shakeY = 0) {
    const { s, x, y } = this.cam, d = this.dpr;
    this.ctx.setTransform(d * s, 0, 0, d * s, d * (this.W / 2 - (x + shakeX) * s), d * (this.H / 2 - (y + shakeY) * s));
  },
  toWorld(px, py) {
    const { s, x, y } = this.cam;
    return [(px - this.W / 2) / s + x, (py - this.H / 2) / s + y];
  },
  toScreen(wx, wy) {
    const { s, x, y } = this.cam;
    return [(wx - x) * s + this.W / 2, (wy - y) * s + this.H / 2];
  },
  clear() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#3b3125';
    c.fillRect(0, 0, this.cv.width, this.cv.height);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
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
  const im = img(b.sprite);
  const r = tu.a - Math.PI / 2, c = Math.cos(r), s = Math.sin(r);
  ctx.save();
  ctx.transform(c, s, -s, c, tu.gx, tu.gy);
  ctx.drawImage(im, -b.pivot[0], -b.pivot[1]);
  if (tu.hitT < 0.1) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(im, -b.pivot[0], -b.pivot[1]);
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

function drawWorld(ctx) {
  const L = W.map.tiles;
  ctx.drawImage(L.canvas, L.x, L.y);
  for (const d of W.decals) {
    const fade = Math.min(1, (d.life - d.t) / 1.5);
    drawSprite(ctx, d.sprite, d.x, d.y, d.rot, 1, d.alpha * fade);
  }
  for (const o of W.props) if (o.alive && o.layer === 'ground') drawProp(ctx, o);
  for (const o of W.props) if (o.alive && o.layer === 'low') drawProp(ctx, o);
  for (const tu of W.turrets) if (tu.alive) drawTurretGun(ctx, tu);
  for (const t of W.tanks) if (t.alive && t !== W.player) drawTank(ctx, t);
  if (W.player && W.player.alive) drawTank(ctx, W.player);
  for (const b of W.bullets) drawSprite(ctx, b.sprite, b.x, b.y, b.a - Math.PI / 2);
  for (const o of W.props) if (o.alive && o.layer === 'high') drawProp(ctx, o);
  for (const e of W.effects) {
    if (e.kind === 'anim') {
      if (e.t < 0) continue;
      const f = Math.min(5, Math.floor(e.t / e.fd) + 1);
      drawSprite(ctx, e.seq + f, e.x, e.y, e.rot, e.scale);
    } else if (e.kind === 'flash') drawSprite(ctx, e.sprite, e.x, e.y, e.rot, 1, 1 - e.t / e.life);
    else if (e.kind === 'leaf') drawSprite(ctx, e.sprite, e.x, e.y, e.rot, 1, 1 - e.t / e.life);
  }
  if (!Settings.bars) return;
  for (const t of W.tanks) {
    if (!t.alive) continue;
    const fr = t.hp / t.maxHp;
    if (t === W.player) {
      drawBar(ctx, t.x - 34, t.y - t.r - 26, 68, 12, fr, t.regen ? 'progress_green_small_border' : 'progress_green_small');
    } else if (fr < 1 || t.hitT < 2) {
      drawBar(ctx, t.x - 32, t.y - t.r - 24, 64, 12, fr, t.isLarge ? 'progress_red_small_border' : 'progress_red_small');
    }
  }
  for (const tu of W.turrets) if (tu.alive && tu.hp < tu.maxHp) drawBar(ctx, tu.gx - 28, tu.gy - 46, 56, 10, tu.hp / tu.maxHp, 'progress_white_small');
  for (const o of W.props) {
    if (!o.alive || o.hurtT == null || o.hp === Infinity || o.hp >= o.maxHp) continue;
    o.hurtT += 1 / 60;
    if (o.hurtT < 1.6) drawBar(ctx, o.x - 22, o.y - 40, 44, 9, Math.max(0, o.hp / o.maxHp), 'progress_white_small_border');
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
    const cx = p ? p.x : W.view.w / 2, cy = p ? p.y : W.view.h / 2;
    const range = 1000, k = inner / range;
    c.save();
    c.beginPath();
    c.arc(C, C, inner, 0, TAU);
    c.fillStyle = W.mode.key === 'defense' ? 'rgba(24,32,40,.62)' : 'rgba(34,40,22,.6)';
    c.fill();
    c.clip();
    const icon = (name, x, y, sc = 0.62, rot = 0) => {
      const dx = (x - cx) * k, dy = (y - cy) * k;
      if (dx * dx + dy * dy > inner * inner) return;
      const im = uimg(name);
      c.save();
      c.translate(C + dx, C + dy);
      if (rot) c.rotate(rot);
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
    for (const tu of W.turrets) icon(tu.alive ? 'minimap_icon_exclamation_red' : 'minimap_icon_exclamation_white', tu.gx, tu.gy, 0.62);
    for (const t of W.tanks) {
      if (t.team !== 'enemy') continue;
      if (!t.alive) {
        if (t.respawnT > 0 && t.spawn) icon('minimap_icon_exclamation_white', t.spawn.x, t.spawn.y, 0.5);
        continue;
      }
      if (W.mode.key === 'defense' && t.x - W.map.lineX < 280) icon('minimap_icon_exclamation_yellow', t.x, t.y, 0.75);
      else icon(t.isLarge ? 'minimap_icon_star_red' : 'minimap_icon_jewel_red', t.x, t.y, t.isLarge ? 0.62 : 0.5);
    }
    if (p && p.alive) icon('minimap_arrow_a', p.x, p.y, 0.75, p.a + Math.PI / 2);
    c.restore();
    const ring = W.mode.key === 'defense' ? 'minimap_ring_grey_detail' : W.mode.key === 'fun' ? 'minimap_ring_brown' : 'minimap_ring_brown_detail';
    c.drawImage(uimg(ring), 0, 0, S, S);
    const set = W.mode.key === 'defense' ? COMPASS.future : COMPASS.toon;
    const letter = (d, x, y) => {
      const im = uimg(set[d]);
      const sc = 0.62;
      c.drawImage(im, x - (im.width * sc) / 2, y - (im.height * sc) / 2, im.width * sc, im.height * sc);
    };
    letter('n', C, 16);
    letter('s', C, S - 16);
    letter('e', S - 15, C);
    letter('w', 15, C);
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
