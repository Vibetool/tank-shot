// ---------- obstacle catalogue: every map prop sprite and how it behaves ----------
const PROP = {
  treeGreen_large: { kind: 'tree', shape: 'circle', r: 32, hp: 6, layer: 'high', twigs: 'treeGreen_twigs', leaf: 'treeGreen_leaf' },
  treeBrown_large: { kind: 'tree', shape: 'circle', r: 32, hp: 6, layer: 'high', twigs: 'treeBrown_twigs', leaf: 'treeBrown_leaf' },
  treeGreen_small: { kind: 'tree', shape: 'circle', r: 17, hp: 3, layer: 'high', twigs: 'treeGreen_twigs', leaf: 'treeGreen_leaf' },
  treeBrown_small: { kind: 'tree', shape: 'circle', r: 17, hp: 3, layer: 'high', twigs: 'treeBrown_twigs', leaf: 'treeBrown_leaf' },
  treeGreen_twigs: { kind: 'deco', layer: 'ground' },
  treeBrown_twigs: { kind: 'deco', layer: 'ground' },
  treeGreen_leaf: { kind: 'deco', layer: 'ground' },
  treeBrown_leaf: { kind: 'deco', layer: 'ground' },
  wireCrooked: { kind: 'deco', layer: 'ground' },
  wireStraight: { kind: 'deco', layer: 'ground' },
  oilSpill_large: { kind: 'oil', layer: 'ground', r: 40 },
  oilSpill_small: { kind: 'oil', layer: 'ground', r: 12 },
  sandbagBeige: { kind: 'sandbag', shape: 'box', hw: 30, hh: 19, hp: 8, open: 'sandbagBeige_open' },
  sandbagBrown: { kind: 'sandbag', shape: 'box', hw: 30, hh: 19, hp: 8, open: 'sandbagBrown_open' },
  sandbagBeige_open: { kind: 'sandbag', shape: 'box', hw: 38, hh: 22, hp: 4, opened: true },
  sandbagBrown_open: { kind: 'sandbag', shape: 'box', hw: 38, hh: 22, hp: 4, opened: true },
  crateWood: { kind: 'crate', shape: 'box', hw: 26, hh: 26, hp: 4, damaged: 'crateWood_side' },
  crateMetal: { kind: 'crate', shape: 'box', hw: 26, hh: 26, hp: 10, damaged: 'crateMetal_side' },
  crateWood_side: { kind: 'crate', shape: 'box', hw: 26, hh: 26, hp: 2, isDamaged: true },
  crateMetal_side: { kind: 'crate', shape: 'box', hw: 26, hh: 26, hp: 5, isDamaged: true },
  barrelRed_top: { kind: 'barrel', shape: 'circle', r: 22, side: 'barrelRed_side' },
  barrelGreen_top: { kind: 'barrel', shape: 'circle', r: 22, side: 'barrelGreen_side' },
  barrelBlack_top: { kind: 'barrel', shape: 'circle', r: 22, side: 'barrelBlack_side' },
  barrelRust_top: { kind: 'barrel', shape: 'circle', r: 22, side: 'barrelRust_side' },
  barrelRed_side: { kind: 'barrel', shape: 'box', hw: 18, hh: 26, knocked: true },
  barrelGreen_side: { kind: 'barrel', shape: 'box', hw: 18, hh: 26, knocked: true },
  barrelBlack_side: { kind: 'barrel', shape: 'box', hw: 18, hh: 26, knocked: true },
  barrelRust_side: { kind: 'barrel', shape: 'box', hw: 18, hh: 26, knocked: true },
  fenceRed: { kind: 'fence', shape: 'box', hw: 46, hh: 9, hp: 3 },
  fenceYellow: { kind: 'fence', shape: 'box', hw: 50, hh: 9, hp: 3 },
  barricadeWood: { kind: 'barricade', shape: 'circle', r: 23, hp: 6, passBullets: true },
  barricadeMetal: { kind: 'barricade', shape: 'circle', r: 23, hp: Infinity, passBullets: true },
};

function makeProp(name, x, y, rotDeg) {
  const d = PROP[name];
  if (!d) throw new Error('unknown prop ' + name);
  const o = { name, sprite: name, x, y, rot: deg(rotDeg || 0), kind: d.kind, layer: d.layer || 'low', shape: d.shape, r: d.r || 0, hw: d.hw || 0, hh: d.hh || 0, hp: d.hp == null ? 1 : d.hp, alive: true, def: d };
  o.maxHp = o.hp;
  o.solid = !!d.shape; // tanks collide
  o.blocksBullets = !!d.shape && !d.passBullets;
  if (d.kind === 'barrel') o.knocked = !!d.knocked;
  if (d.kind === 'crate') o.isDamaged = !!d.isDamaged;
  if (d.kind === 'sandbag') o.opened = !!d.opened;
  return o;
}

// signed-ish distance from point to obstacle surface (negative inside)
function obstDist(o, px, py) {
  if (o.shape === 'circle') return hypot(px - o.x, py - o.y) - o.r;
  const c = Math.cos(-o.rot), s = Math.sin(-o.rot);
  const lx = (px - o.x) * c - (py - o.y) * s, ly = (px - o.x) * s + (py - o.y) * c;
  const dx = Math.abs(lx) - o.hw, dy = Math.abs(ly) - o.hh;
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
  return hypot(ox, oy) + Math.min(Math.max(dx, dy), 0);
}
// push a circle out of an obstacle; returns true when they touched
function pushOut(t, o, r) {
  if (o.shape === 'circle') {
    const dx = t.x - o.x, dy = t.y - o.y, d = hypot(dx, dy), min = r + o.r;
    if (d >= min) return false;
    const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0;
    t.x = o.x + nx * min;
    t.y = o.y + ny * min;
    return true;
  }
  const c = Math.cos(-o.rot), s = Math.sin(-o.rot);
  const lx = (t.x - o.x) * c - (t.y - o.y) * s, ly = (t.x - o.x) * s + (t.y - o.y) * c;
  const cx = clamp(lx, -o.hw, o.hw), cy = clamp(ly, -o.hh, o.hh);
  let dx = lx - cx, dy = ly - cy, d = hypot(dx, dy);
  if (d >= r) return false;
  let nlx, nly;
  if (d > 0.001) {
    nlx = cx + (dx / d) * r;
    nly = cy + (dy / d) * r;
  } else {
    // centre inside the box: leave by the nearest face
    const px = o.hw - Math.abs(lx), py = o.hh - Math.abs(ly);
    if (px < py) {
      nlx = Math.sign(lx || 1) * (o.hw + r);
      nly = ly;
    } else {
      nlx = lx;
      nly = Math.sign(ly || 1) * (o.hh + r);
    }
  }
  const [wx, wy] = rotXY(nlx, nly, o.rot);
  t.x = o.x + wx;
  t.y = o.y + wy;
  return true;
}

// ---------- world state ----------
const W = {
  map: null, mode: null, view: { x: 0, y: 0, w: 1836, h: 1030 },
  tanks: [], bullets: [], props: [], turrets: [], decals: [], effects: [], perimeter: [],
  player: null, time: 0, shake: 0, kills: 0, over: false,
  flow: null, flowT: 0,
};

function loadMap(key) {
  const M = MAPS[key];
  const [bx, by, bw, bh] = M.bounds;
  W.map = { key, tiles: M.tiles, ox: M.origin[0], oy: M.origin[1], lineX: M.lineX, frame: M.frame };
  W.view = { x: bx, y: by, w: bw, h: bh };
  W.props = M.props.map(([n, x, y, r]) => makeProp(n, x, y, r));
  W.decals = [];
  W.turrets = [];
  W.perimeter = [];
  // ground oil spills behave as decals with slippery zones
  for (const p of W.props) if (p.kind === 'oil') p.slick = true;
}

// a ring of steel hedgehogs marks where the (larger) battlefield ends
function buildPerimeter() {
  const v = W.view, out = [], step = 92;
  const edge = (x0, y0, x1, y1) => {
    const len = hypot(x1 - x0, y1 - y0), n = Math.round(len / step);
    for (let i = 0; i < n; i++) {
      const f = i / n;
      out.push({ sprite: 'barricadeMetal', x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, rot: deg((i * 37) % 30 - 15) });
    }
  };
  const x0 = v.x + 14, y0 = v.y + 14, x1 = v.x + v.w - 14, y1 = v.y + v.h - 14;
  edge(x0, y0, x1, y0);
  edge(x1, y0, x1, y1);
  edge(x1, y1, x0, y1);
  edge(x0, y1, x0, y0);
  W.perimeter = out;
}

// ---------- tanks ----------
function makeTank(o) {
  const H = HULLS[o.hull];
  const t = {
    team: o.team, hull: o.hull, H, guns: o.guns.slice(), outline: o.outline != null ? o.outline : o.team === 'player',
    ally: !!o.ally, hpMul: o.hpMul || 1,
    x: o.x, y: o.y, a: deg(o.a || 0), vx: 0, vy: 0, speed: 0, turret: deg(o.a || 0),
    r: H.r, hp: Math.round(H.hp * (o.hpMul || 1)), alive: true,
    cd: o.guns.map(() => 0), burst: [], recoil: o.guns.map(() => 0), heat: 0,
    trackAcc: 0, hitT: 9, flash: 0, spawn: { x: o.x, y: o.y, a: o.a || 0 },
    ai: { cd: rand(2.5, 4.5), think: 0, stuck: 0, rev: 0, wp: null, strafe: Math.random() < 0.5 ? 1 : -1 },
    aimX: o.x, aimY: o.y, throttle: 0, steer: 0, speedMul: o.speedMul || 1, isLarge: !!H.large,
  };
  t.maxHp = t.hp;
  return t;
}

function mountPos(t, i) {
  const m = t.H.mounts[i];
  const [dx, dy] = rotXY(m[0], m[1], t.a - Math.PI / 2);
  return [t.x + dx, t.y + dy];
}
function barrelAngle(t, i) {
  const [mx, my] = mountPos(t, i);
  // barrels converge on the aim point
  const d = Math.max(140, hypot(t.aimX - t.x, t.aimY - t.y));
  const ax = t.x + Math.cos(t.turret) * d, ay = t.y + Math.sin(t.turret) * d;
  return Math.atan2(ay - my, ax - mx);
}
function barrelSprite(t, i) {
  return BARRELS[t.guns[i]].sprite + (t.outline ? '_outline' : '');
}

function fireMount(t, i) {
  const b = BARRELS[t.guns[i]];
  const [mx, my] = mountPos(t, i);
  const ang = barrelAngle(t, i);
  const reach = b.len - b.pivot[1];
  const ex = mx + Math.cos(ang) * reach, ey = my + Math.sin(ang) * reach;
  const dmgMul = t.team === 'player' ? 1 : W.mode.enemyDmg;
  for (let p = 0; p < b.pellets; p++) {
    const spread = b.pellets > 1 ? (p / (b.pellets - 1) - 0.5) * b.spread * 2 + rand(-0.02, 0.02) : rand(-b.spread, b.spread);
    const a = ang + spread + (t.team === 'player' ? 0 : rand(-0.05, 0.05));
    W.bullets.push({
      x: ex, y: ey, vx: Math.cos(a) * b.speed, vy: Math.sin(a) * b.speed, a,
      sprite: b.bullet + (t.outline ? '_outline' : ''), dmg: b.dmg * dmgMul, team: t.team, owner: t,
      life: b.range / b.speed, splash: b.splash, pierce: b.pierce, hit: new Set(), heavy: b.dmg >= 30,
    });
  }
  const fl = img(b.flash);
  W.effects.push({ kind: 'flash', sprite: b.flash, x: ex + Math.cos(ang) * (fl.height / 2 + 6), y: ey + Math.sin(ang) * (fl.height / 2 + 6), rot: ang - Math.PI / 2, t: 0, life: 0.075, owner: t, mount: i });
  t.recoil[i] = 1;
  t.heat = Math.min(1, t.heat + 0.12 * b.pellets);
}

function tryFirePlayer(t) {
  t.guns.forEach((g, i) => {
    if (t.cd[i] > 0) return;
    const b = BARRELS[g];
    t.cd[i] = b.reload;
    fireMount(t, i);
    for (let k = 1; k < b.burst; k++) t.burst.push({ i, at: k * 0.075 });
  });
}

function enemyVolley(t) {
  t.guns.forEach((g, i) => {
    const b = BARRELS[g];
    fireMount(t, i);
    for (let k = 1; k < b.burst; k++) t.burst.push({ i, at: k * 0.075 });
  });
}

// `by` is whatever fired the shot (a tank or a turret), null for exploding barrels
function damageTank(t, dmg, srcTeam, by) {
  if (!t.alive) return;
  if (t.team === 'player' && W.mode.godMode) dmg = 0;
  t.hp -= dmg;
  t.hitT = 0;
  t.flash = 0.12;
  if (t.hp <= 0) killTank(t, srcTeam, by);
}

function killTank(t, srcTeam, by) {
  t.alive = false;
  t.hp = 0;
  anim('explosion', t.x, t.y, 1.25 + (t.isLarge ? 0.5 : 0), rand(0, TAU));
  setTimeout(() => anim('explosionSmoke', t.x + rand(-20, 20), t.y + rand(-20, 20), 1.1, rand(0, TAU)), 160);
  addDecal('oilSpill_large', t.x, t.y, rand(0, TAU), 26, 0.85);
  addShake(t.isLarge ? 16 : 11);
  if (t === W.player) {
    App.onPlayerKilled();
    return;
  }
  t.respawnT = W.mode.respawn;
  if (t.team === 'enemy') {
    if (by === W.player) W.kills++; // the score counts the player's own kills, not the ally's or the turret's
    App.onEnemyKilled(t, by);
  } else App.onAllyKilled(t);
}

// ---------- effects ----------
function anim(seq, x, y, scale = 1, rot = 0, delay = 0) {
  W.effects.push({ kind: 'anim', seq, x, y, scale, rot, t: -delay, fd: 0.06 });
}
function addDecal(sprite, x, y, rot, life, alpha = 1, grow = 0) {
  W.decals.push({ sprite, x, y, rot, t: 0, life, alpha, grow, slick: sprite === 'oilSpill_large' });
  if (W.decals.length > 260) W.decals.splice(0, W.decals.length - 260);
}
function addShake(v) {
  W.shake = Math.min(26, W.shake + v * Settings.shake);
}
function leaves(o, n) {
  const leaf = o.def.leaf;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(30, 120);
    W.effects.push({ kind: 'leaf', sprite: leaf, x: o.x + rand(-o.r, o.r), y: o.y + rand(-o.r, o.r), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rand(0, TAU), vr: rand(-6, 6), t: 0, life: rand(0.8, 1.6) });
  }
}

// ---------- obstacle damage ----------
function hurtProp(o, dmg, dirA) {
  if (!o.alive) return;
  if (o.lineBag) {
    o.hits = (o.hits || 0) + 1;
    if (o.hits >= 5 && !o.opened) {
      o.opened = true;
      o.sprite = o.def.open;
    }
    return;
  }
  if (o.hp === Infinity) return;
  o.hp -= dmg;
  o.hurtT = 0;
  switch (o.kind) {
    case 'tree':
      leaves(o, 3);
      if (o.hp <= 0) {
        leaves(o, 10);
        o.kind = 'deco';
        o.layer = 'ground';
        o.sprite = o.def.twigs;
        o.solid = o.blocksBullets = false;
        anim('explosionSmoke', o.x, o.y, 0.8);
        Flow.dirty = true;
      }
      break;
    case 'sandbag':
      if (!o.opened && o.hp <= o.maxHp / 2) {
        o.opened = true;
        o.sprite = o.def.open;
        o.hw = 38;
        o.hh = 22;
      }
      if (o.hp <= 0) removeProp(o, 0.9);
      break;
    case 'crate':
      if (!o.isDamaged && o.hp <= o.maxHp / 2) {
        o.isDamaged = true;
        o.sprite = o.def.damaged;
      }
      if (o.hp <= 0) removeProp(o, 1);
      break;
    case 'barrel':
      if (!o.knocked) {
        o.knocked = true;
        o.sprite = o.def.side;
        o.shape = 'box';
        o.hw = 18;
        o.hh = 26;
        o.rot = dirA - Math.PI / 2 + rand(-0.4, 0.4);
        o.x += Math.cos(dirA) * 10;
        o.y += Math.sin(dirA) * 10;
        o.hp = 1;
        addDecal('oilSpill_small', o.x + Math.cos(dirA) * 24, o.y + Math.sin(dirA) * 24, rand(0, TAU), 40, 1, 1);
      } else if (o.hp <= 0) {
        removeProp(o, 0);
        explode(o.x, o.y, 120, 42, null);
        addDecal('oilSpill_large', o.x, o.y, rand(0, TAU), 40, 0.9);
      }
      break;
    case 'fence':
    case 'barricade':
      if (o.hp <= 0) removeProp(o, 0.8);
      break;
  }
}
function removeProp(o, smoke) {
  o.alive = false;
  if (smoke) anim('explosionSmoke', o.x, o.y, smoke, rand(0, TAU));
  Flow.dirty = true;
}

function explode(x, y, radius, dmg, team, by = null) {
  anim('explosion', x, y, radius / 70, rand(0, TAU));
  addShake(radius / 9);
  for (const t of W.tanks) {
    if (!t.alive || t.team === team) continue;
    const d = hypot(t.x - x, t.y - y) - t.r;
    if (d < radius) damageTank(t, dmg * (1 - Math.max(0, d) / radius * 0.6), team || 'env', by);
  }
  for (const tu of W.turrets) {
    if (!tu.alive || tu.team === team) continue;
    if (hypot(tu.gx - x, tu.gy - y) < radius + 20) damageTurret(tu, dmg * 0.8, team, by);
  }
  for (const o of W.props) {
    if (!o.alive || !o.solid || o.kind === 'oil') continue;
    if (obstDist(o, x, y) < radius * 0.6) hurtProp(o, dmg * 0.5, Math.atan2(o.y - y, o.x - x));
  }
}

// ---------- turrets (barricadeMetal + specialBarrel1, as placed in the sample) ----------
function makeTurret(d, team = 'enemy') {
  const base = makeProp('barricadeMetal', d.x, d.y, d.rot);
  W.props.push(base);
  // the sandbags of its own emplacement: the turret fires over them
  const cover = new Set(W.props.filter((o) => o.kind === 'sandbag' && hypot(o.x - d.gx, o.y - d.gy) < 150));
  return { team, outline: team === 'player', gx: d.gx, gy: d.gy, a: deg(d.a), gun: d.gun, hp: 80, maxHp: 80, alive: true, cd: rand(1, 3), respawnT: 0, home: deg(d.a), hitT: 9, cover, think: 0, tgt: null, seen: false };
}
function damageTurret(tu, dmg, srcTeam, by) {
  if (!tu.alive || srcTeam === tu.team) return;
  tu.hp -= dmg;
  tu.hitT = 0;
  if (tu.hp <= 0) {
    tu.alive = false;
    tu.respawnT = W.mode.respawn || 20; // rebuilt like any NPC
    anim('explosion', tu.gx, tu.gy, 1, rand(0, TAU));
    addShake(9);
    if (tu.team === 'enemy') {
      if (by === W.player) W.kills++;
      App.onEnemyKilled(null, by);
    } else App.onAllyTurretLost();
  }
}
function turretFire(tu) {
  const b = BARRELS[tu.gun];
  const ex = tu.gx + Math.cos(tu.a) * (b.len - b.pivot[1]), ey = tu.gy + Math.sin(tu.a) * (b.len - b.pivot[1]);
  const a = tu.a + rand(-0.05, 0.05);
  const ours = tu.team === 'player';
  W.bullets.push({ x: ex, y: ey, vx: Math.cos(a) * b.speed, vy: Math.sin(a) * b.speed, a, sprite: b.bullet + (ours ? '_outline' : ''), dmg: b.dmg * (ours ? 1 : W.mode.enemyDmg), team: tu.team, owner: tu, cover: tu.cover, life: b.range / b.speed, splash: b.splash, pierce: 0, hit: new Set(), heavy: true });
  const fl = img(b.flash);
  W.effects.push({ kind: 'flash', sprite: b.flash, x: ex + Math.cos(tu.a) * (fl.height / 2 + 6), y: ey + Math.sin(tu.a) * (fl.height / 2 + 6), rot: tu.a - Math.PI / 2, t: 0, life: 0.075 });
}

// ---------- line of sight & flow field ----------
function lineClear(ax, ay, bx, by, ignoreLine, skip) {
  const d = hypot(bx - ax, by - ay), n = Math.ceil(d / 18);
  for (let i = 1; i < n; i++) {
    const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
    for (const o of W.props) {
      if (!o.alive || !o.blocksBullets || (ignoreLine && o.lineBag) || (skip && skip.has(o))) continue;
      if (Math.abs(o.x - x) > 70 || Math.abs(o.y - y) > 70) continue;
      if (obstDist(o, x, y) < 0) return false;
    }
  }
  return true;
}

const Flow = {
  cell: 32, cols: 0, rows: 0, ox: 0, oy: 0, block: null, dist: null, dirty: true,
  setup(x, y, w, h) {
    this.ox = x;
    this.oy = y;
    this.cols = Math.ceil(w / this.cell);
    this.rows = Math.ceil(h / this.cell);
    this.block = new Uint8Array(this.cols * this.rows);
    this.dist = new Float32Array(this.cols * this.rows);
    this.dirty = true;
  },
  rebuildBlock(inflate = 30) {
    const { cell, cols, rows } = this;
    this.block.fill(0);
    for (const o of W.props) {
      if (!o.alive || !o.solid) continue;
      const ext = (o.shape === 'circle' ? o.r : Math.max(o.hw, o.hh)) + inflate;
      const c0 = Math.max(0, Math.floor((o.x - ext - this.ox) / cell)), c1 = Math.min(cols - 1, Math.floor((o.x + ext - this.ox) / cell));
      const r0 = Math.max(0, Math.floor((o.y - ext - this.oy) / cell)), r1 = Math.min(rows - 1, Math.floor((o.y + ext - this.oy) / cell));
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const px = this.ox + (c + 0.5) * cell, py = this.oy + (r + 0.5) * cell;
          if (obstDist(o, px, py) < inflate) this.block[r * cols + c] = 1;
        }
    }
    this.dirty = false;
  },
  // Dijkstra from every target cell; cost 1 straight, 1.414 diagonal
  compute(targets) {
    if (this.dirty) this.rebuildBlock();
    const { cols, rows, dist, block } = this;
    dist.fill(Infinity);
    // binary heap on typed arrays: no garbage per node, so a recompute costs a couple of ms
    const cap = cols * rows * 8;
    if (!this.hi || this.hi.length < cap) {
      this.hi = new Int32Array(cap);
      this.hd = new Float32Array(cap);
    }
    const HI = this.hi, HD = this.hd;
    let size = 0;
    const push = (i, d) => {
      let k = size++;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (HD[p] <= d) break;
        HI[k] = HI[p];
        HD[k] = HD[p];
        k = p;
      }
      HI[k] = i;
      HD[k] = d;
    };
    for (const [x, y] of targets) {
      const c = clamp(Math.floor((x - this.ox) / this.cell), 0, cols - 1), r = clamp(Math.floor((y - this.oy) / this.cell), 0, rows - 1);
      dist[r * cols + c] = 0;
      push(r * cols + c, 0);
    }
    while (size > 0) {
      const i = HI[0], d = HD[0];
      size--;
      if (size > 0) {
        const li = HI[size], ld = HD[size];
        let k = 0;
        for (;;) {
          let ch = 2 * k + 1;
          if (ch >= size) break;
          if (ch + 1 < size && HD[ch + 1] < HD[ch]) ch++;
          if (HD[ch] >= ld) break;
          HI[k] = HI[ch];
          HD[k] = HD[ch];
          k = ch;
        }
        HI[k] = li;
        HD[k] = ld;
      }
      if (d > dist[i]) continue;
      const c = i % cols, r = (i / cols) | 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const j = nr * cols + nc;
          if (block[j]) continue;
          if (dr && dc && (block[r * cols + nc] || block[nr * cols + c])) continue;
          const nd = d + (dr && dc ? 1.414 : 1);
          if (nd < dist[j]) {
            dist[j] = nd;
            push(j, nd);
          }
        }
    }
  },
  // direction of steepest descent from a world point
  dir(x, y) {
    const { cols, rows, dist } = this;
    const c = clamp(Math.floor((x - this.ox) / this.cell), 0, cols - 1), r = clamp(Math.floor((y - this.oy) / this.cell), 0, rows - 1);
    let best = dist[r * cols + c], bi = -1;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const v = dist[nr * cols + nc] + (dr && dc ? 0.01 : 0);
        if (v < best) {
          best = v;
          bi = nr * cols + nc;
        }
      }
    if (bi < 0) return null;
    const tx = this.ox + ((bi % cols) + 0.5) * this.cell, ty = this.oy + (((bi / cols) | 0) + 0.5) * this.cell;
    return Math.atan2(ty - y, tx - x);
  },
  at(x, y) {
    const c = clamp(Math.floor((x - this.ox) / this.cell), 0, this.cols - 1), r = clamp(Math.floor((y - this.oy) / this.cell), 0, this.rows - 1);
    return this.dist[r * this.cols + c];
  },
};

// ---------- simulation ----------
function onOil(t) {
  for (const o of W.props) if (o.alive && o.kind === 'oil' && hypot(o.x - t.x, o.y - t.y) < o.r + t.r * 0.3) return true;
  for (const d of W.decals) if (d.slick && hypot(d.x - t.x, d.y - t.y) < 40) return true;
  return false;
}

function driveTank(t, dt) {
  const H = t.H;
  const slick = onOil(t);
  const maxV = H.speed * t.speedMul;
  const target = t.throttle >= 0 ? t.throttle * maxV : t.throttle * maxV * 0.6;
  const fx = Math.cos(t.a), fy = Math.sin(t.a);
  let vf = t.vx * fx + t.vy * fy, vl = -t.vx * fy + t.vy * fx;
  vf = approach(vf, target, (slick ? 160 : 520) * dt);
  vl *= Math.exp(-(slick ? 0.8 : 14) * dt);
  t.a = angNorm(t.a + t.steer * H.turn * dt * (slick ? 0.75 : 1));
  const nfx = Math.cos(t.a), nfy = Math.sin(t.a);
  t.vx = vf * nfx - vl * nfy;
  t.vy = vf * nfy + vl * nfx;
  const ox = t.x, oy = t.y;
  t.x += t.vx * dt;
  t.y += t.vy * dt;
  // collisions
  for (const o of W.props) {
    if (!o.alive || !o.solid) continue;
    if (Math.abs(o.x - t.x) > 110 || Math.abs(o.y - t.y) > 110) continue;
    if (o.lineBag && t.team === 'enemy' && obstDist(o, t.x, t.y) < t.r + 1) App.onLineTouched(t, o);
    pushOut(t, o, t.r);
  }
  for (const tu of W.turrets) if (tu.alive) pushOut(t, { shape: 'circle', x: tu.gx, y: tu.gy, r: 18 }, t.r);
  const v = W.view;
  if (!t.entering) {
    const m = W.perimeter.length ? t.r + 34 : t.r * 0.8; // stop in front of the hedgehog ring
    t.x = clamp(t.x, v.x + m, v.x + v.w - m);
    t.y = clamp(t.y, v.y + m, v.y + v.h - m);
  } else if (t.x < v.x + v.w - 12 && t.x > v.x + 12 && t.y > v.y + 12 && t.y < v.y + v.h - 12) t.entering = false;
  const moved = hypot(t.x - ox, t.y - oy);
  t.speed = moved / Math.max(dt, 1e-4);
  // track marks every ~44px travelled
  t.trackAcc += moved;
  if (t.trackAcc > 44 && Settings.tracks) {
    t.trackAcc = 0;
    addDecal(H.tracks, t.x - Math.cos(t.a) * 6, t.y - Math.sin(t.a) * 6, t.a - Math.PI / 2, 6, 0.55);
  }
}

function separateTanks() {
  const ts = W.tanks;
  for (let i = 0; i < ts.length; i++) {
    const a = ts[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < ts.length; j++) {
      const b = ts[j];
      if (!b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = hypot(dx, dy), min = a.r + b.r;
      if (d >= min || d < 0.001) continue;
      const push = (min - d) / 2, nx = dx / d, ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
  }
}

function updateBullets(dt) {
  const out = [];
  for (const b of W.bullets) {
    b.life -= dt;
    const dist = hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(dist / 10));
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      // tanks
      for (const t of W.tanks) {
        if (!t.alive || t.team === b.team || b.hit.has(t)) continue;
        if (hypot(t.x - b.x, t.y - b.y) > t.r) continue;
        b.hit.add(t);
        damageTank(t, b.dmg, b.team, b.owner);
        if (b.splash) {
          explode(b.x, b.y, b.splash, b.dmg * 0.6, b.team, b.owner);
          dead = true;
        } else {
          anim('explosion', b.x, b.y, b.heavy ? 0.6 : 0.42, rand(0, TAU));
          if (b.pierce && b.hit.size <= b.pierce) continue;
          dead = true;
        }
        break;
      }
      if (dead) break;
      // enemy turrets
      for (const tu of W.turrets) {
          if (!tu.alive || tu.team === b.team || hypot(tu.gx - b.x, tu.gy - b.y) > 24) continue;
          damageTurret(tu, b.dmg, b.team, b.owner);
          if (b.splash) explode(b.x, b.y, b.splash, b.dmg * 0.6, b.team, b.owner);
          else anim('explosion', b.x, b.y, 0.5, rand(0, TAU));
          dead = true;
          break;
        }
      if (dead) break;
      // props
      for (const o of W.props) {
        if (!o.alive || !o.blocksBullets) continue;
        if (o.lineBag && b.team === 'player') continue; // our own sandbag line: we fire over it
        if (b.cover && b.cover.has(o)) continue; // a turret's shell clears its own emplacement
        if (Math.abs(o.x - b.x) > 80 || Math.abs(o.y - b.y) > 80) continue;
        if (obstDist(o, b.x, b.y) > 0) continue;
        hurtProp(o, b.dmg, Math.atan2(b.vy, b.vx));
        if (b.splash) explode(b.x, b.y, b.splash, b.dmg * 0.6, b.team, b.owner);
        else anim('explosionSmoke', b.x, b.y, b.heavy ? 0.55 : 0.4, rand(0, TAU));
        dead = true;
        break;
      }
    }
    const v = W.view;
    if (!dead && (b.x < v.x - 60 || b.y < v.y - 60 || b.x > v.x + v.w + 60 || b.y > v.y + v.h + 60)) dead = true;
    if (!dead && b.life <= 0) {
      dead = true;
      if (b.splash) explode(b.x, b.y, b.splash * 0.8, b.dmg * 0.5, b.team, b.owner);
      else anim('explosionSmoke', b.x, b.y, 0.3, rand(0, TAU));
    }
    if (!dead) out.push(b);
  }
  W.bullets = out;
}

function updateEffects(dt) {
  const keep = [];
  for (const e of W.effects) {
    e.t += dt;
    if (e.kind === 'anim') {
      if (e.t < 5 * e.fd) keep.push(e);
    } else if (e.kind === 'flash') {
      if (e.t < e.life) keep.push(e);
    } else if (e.kind === 'leaf') {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= Math.exp(-2 * dt);
      e.vy *= Math.exp(-2 * dt);
      e.rot += e.vr * dt;
      if (e.t < e.life) keep.push(e);
    }
  }
  W.effects = keep;
  W.decals = W.decals.filter((d) => {
    d.t += dt;
    if (d.grow && d.t > 1.2 && !d.grown) {
      // a knocked barrel keeps leaking until the small spill becomes a large one
      d.grown = true;
      d.sprite = 'oilSpill_large';
      d.slick = true;
    }
    return d.t < d.life;
  });
  W.shake = Math.max(0, W.shake - dt * 40);
}

// ---------- enemy brains ----------
function aiAimAt(t, tx, ty, dt, rate = 2.4) {
  const want = Math.atan2(ty - t.y, tx - t.x);
  t.turret = angNorm(t.turret + clamp(angDiff(t.turret, want), -rate * dt, rate * dt));
  t.aimX = tx;
  t.aimY = ty;
  return Math.abs(angDiff(t.turret, want));
}
function steerTo(t, ang, throttle) {
  const d = angDiff(t.a, ang);
  t.steer = clamp(d * 2.2, -1, 1);
  t.throttle = Math.abs(d) < 1.0 ? throttle : Math.abs(d) < 1.9 ? throttle * 0.25 : -0.2;
}
function unstick(t, dt) {
  const ai = t.ai;
  if (ai.rev > 0) {
    ai.rev -= dt;
    t.throttle = -0.7;
    t.steer = ai.strafe;
    return true;
  }
  if (Math.abs(t.throttle) > 0.3 && t.speed < 14) ai.stuck += dt;
  else ai.stuck = Math.max(0, ai.stuck - dt);
  if (ai.stuck > 1.1) {
    ai.stuck = 0;
    ai.rev = 0.7;
    ai.strafe *= -1;
  }
  return false;
}

// nearest tank of the other side that can actually be seen
function nearestFoe(t, range) {
  let best = null, bd = range;
  for (const o of W.tanks) {
    if (!o.alive || o.team === t.team) continue;
    const d = hypot(o.x - t.x, o.y - t.y);
    if (d < bd && lineClear(t.x, t.y, o.x, o.y)) {
      bd = d;
      best = o;
    }
  }
  return best;
}

function aiBattle(t, dt) {
  const ai = t.ai, p = W.player;
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 0.25;
    ai.target = nearestFoe(t, 900);
  }
  const tgt = ai.target && ai.target.alive ? ai.target : null;
  const goal = tgt || (p && p.alive ? p : null); // nobody in sight: go and find the player
  if (!goal) {
    t.throttle = 0;
    t.steer = 0;
    return;
  }
  const d = hypot(goal.x - t.x, goal.y - t.y);
  const err = aiAimAt(t, goal.x + goal.vx * 0.25, goal.y + goal.vy * 0.25, dt);
  if (!unstick(t, dt)) {
    if (!tgt || d > 520) {
      const fa = Flow.dir(t.x, t.y);
      if (fa != null) steerTo(t, fa, 0.9);
      else steerTo(t, Math.atan2(goal.y - t.y, goal.x - t.x), 0.7);
    } else if (d < 260) {
      steerTo(t, Math.atan2(t.y - goal.y, t.x - goal.x), 0.6);
    } else {
      // circle-strafe around whoever it is fighting
      steerTo(t, Math.atan2(goal.y - t.y, goal.x - t.x) + (ai.strafe * Math.PI) / 2, 0.45);
    }
  }
  ai.cd -= dt;
  if (W.mode.enemyFire && ai.cd <= 0 && tgt && d < 750 && err < 0.08) {
    enemyVolley(t);
    ai.cd = W.mode.cooldown;
  }
}

// the friendly tank: sticks with the player and fights whatever enemy it can see, on the same 3 s cooldown
function aiAlly(t, dt) {
  const ai = t.ai, p = W.player;
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 0.3;
    ai.target = nearestFoe(t, 850);
  }
  const tgt = ai.target && ai.target.alive ? ai.target : null;
  let err = 9, d = 0;
  if (tgt) {
    d = hypot(tgt.x - t.x, tgt.y - t.y);
    err = aiAimAt(t, tgt.x + tgt.vx * 0.25, tgt.y + tgt.vy * 0.25, dt);
  } else aiAimAt(t, t.x + Math.cos(t.a) * 300, t.y + Math.sin(t.a) * 300, dt, 1.5);
  if (!unstick(t, dt)) {
    const dp = p && p.alive ? hypot(p.x - t.x, p.y - t.y) : 0;
    if (p && p.alive && dp > (tgt ? 560 : 260)) {
      // the path field leads to the player, so the ally uses it to catch up
      const fa = Flow.dir(t.x, t.y);
      steerTo(t, fa != null ? fa : Math.atan2(p.y - t.y, p.x - t.x), dp > 600 ? 1 : 0.7);
    } else if (tgt && d < 300) steerTo(t, Math.atan2(t.y - tgt.y, t.x - tgt.x), 0.5);
    else if (tgt) steerTo(t, Math.atan2(tgt.y - t.y, tgt.x - t.x) - (ai.strafe * Math.PI) / 2, 0.4);
    else {
      t.throttle = 0;
      t.steer = 0;
    }
  }
  ai.cd -= dt;
  if (W.mode.enemyFire && ai.cd <= 0 && tgt && d < 750 && err < 0.1) {
    enemyVolley(t);
    ai.cd = W.mode.cooldown;
  }
}

function aiWander(t, dt) {
  const ai = t.ai;
  const v = W.view;
  if (!ai.wp || hypot(ai.wp[0] - t.x, ai.wp[1] - t.y) < 70 || (ai.wpT -= dt) <= 0) {
    ai.wp = [rand(v.x + 120, v.x + v.w - 120), rand(v.y + 120, v.y + v.h - 120)];
    ai.wpT = rand(5, 9);
  }
  const p = W.player;
  if (p && p.alive) aiAimAt(t, p.x, p.y, dt, 1.4);
  if (unstick(t, dt)) return;
  let ang = Math.atan2(ai.wp[1] - t.y, ai.wp[0] - t.x);
  // feelers: veer away from whatever is just ahead
  for (const side of [0, 0.5, -0.5]) {
    const fx = t.x + Math.cos(t.a + side) * (t.r + 50), fy = t.y + Math.sin(t.a + side) * (t.r + 50);
    for (const o of W.props) {
      if (!o.alive || !o.solid || Math.abs(o.x - fx) > 90 || Math.abs(o.y - fy) > 90) continue;
      if (obstDist(o, fx, fy) < 12) {
        ang = t.a + (side >= 0 ? -1.2 : 1.2);
        break;
      }
    }
  }
  steerTo(t, ang, 0.65);
}

function aiDefense(t, dt) {
  const ai = t.ai;
  const p = W.player;
  ai.halt = Math.max(0, (ai.halt || 0) - dt);
  if (ai.halt > 0) {
    t.throttle = 0;
    t.steer = 0;
  } else if (!unstick(t, dt)) {
    const fa = Flow.dir(t.x, t.y);
    if (fa != null) steerTo(t, fa, 1);
    else steerTo(t, Math.PI, 1);
  }
  if (p && p.alive) {
    const err = aiAimAt(t, p.x, p.y, dt);
    ai.cd -= dt;
    if (ai.cd <= 0 && err < 0.15 && hypot(p.x - t.x, p.y - t.y) < 1000 && !t.entering) {
      enemyVolley(t);
      ai.cd = W.mode.cooldown;
      ai.halt = 0.5;
    }
  }
}

function updateTurrets(dt) {
  for (const tu of W.turrets) {
    tu.hitT += dt;
    if (!tu.alive) {
      tu.respawnT -= dt;
      if (tu.respawnT <= 0) {
        tu.alive = true;
        tu.hp = tu.maxHp;
        anim('explosionSmoke', tu.gx, tu.gy, 0.7);
      }
      continue;
    }
    let want = tu.home + Math.sin(W.time * 0.6) * 0.6;
    const armed = W.mode.enemyFire && W.mode.turretFire !== false;
    tu.think -= dt;
    if (tu.think <= 0) {
      // nearest tank of the other side within range; one it can actually hit beats a nearer one behind cover
      tu.think = 0.25;
      tu.tgt = null;
      tu.seen = false;
      let d = 760;
      if (armed)
        for (const o of W.tanks) {
          if (!o.alive || o.team === tu.team) continue;
          const od = hypot(o.x - tu.gx, o.y - tu.gy);
          if (od > 760) continue;
          const vis = lineClear(tu.gx, tu.gy, o.x, o.y, false, tu.cover);
          if ((vis && !tu.seen) || (vis === tu.seen && od < d)) {
            d = od;
            tu.tgt = o;
            tu.seen = vis;
          }
        }
    }
    const tgt = armed && tu.tgt && tu.tgt.alive ? tu.tgt : null;
    if (tgt) want = Math.atan2(tgt.y - tu.gy, tgt.x - tu.gx);
    tu.a = angNorm(tu.a + clamp(angDiff(tu.a, want), -1.8 * dt, 1.8 * dt));
    tu.cd -= dt;
    if (tgt && tu.seen && tu.cd <= 0 && Math.abs(angDiff(tu.a, want)) < 0.1 && lineClear(tu.gx, tu.gy, tgt.x, tgt.y, false, tu.cover)) {
      turretFire(tu);
      tu.cd = W.mode.cooldown;
    }
  }
}
