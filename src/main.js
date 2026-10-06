// ---------- home scene: the player's tank, top-down, parked on the parade ground ----------
const Home = {
  tank: null, hover: null, scale: 2, ready: false, tipsDirty: true,
  setup() {
    loadMap('home');
    W.mode = { key: 'home' };
    W.tanks = [];
    W.bullets = [];
    W.effects = [];
    W.player = null;
    this.tank = makeTank({ team: 'player', hull: Loadout.hull, guns: Loadout.guns, x: 576, y: 320, a: -90 });
    // big hulls get a smaller showcase scale so every tank fills about the same space
    const im = img(this.tank.H.body + '_outline');
    this.scale = 2 * clamp(84 / Math.max(im.width, im.height), 0.62, 1);
    this.ready = true;
    this.tipsDirty = true;
    if (Input.isTouch) $('ctrlHelp').textContent = '左下摇杆驾驶 · 点战场瞄准并开火 · 右下按钮连发';
    $('homeLoadout').innerHTML = `<b>当前坦克</b>　${loadoutLabel(Loadout)}<br><span class="muted">美术素材：Kenney Top-down Tanks Remastered · UI Pack Adventure（CC0）</span>`;
  },
  // which part of the hero tank is under a screen point: 'tracks' | 'body' | null
  hit(px, py) {
    if (!this.tank) return null;
    const t = this.tank;
    const [wx, wy] = R.toWorld(px, py);
    const dx = (wx - t.x) / this.scale, dy = (wy - t.y) / this.scale;
    const [lx, ly] = rotXY(dx, dy, -(t.a - Math.PI / 2));
    const im = img(t.H.body + '_outline');
    const hw = im.width / 2, hh = im.height / 2, tw = t.H.trackW + 4;
    if (Math.abs(ly) > hh + 10) {
      // the barrels stick out past the nose
      return Math.abs(lx) < 30 && ly < hh + 70 && ly > 0 ? 'body' : null;
    }
    if (Math.abs(lx) > hw + 16) return null;
    if (Math.abs(lx) >= hw - tw - 5) return 'tracks';
    return 'body';
  },
  draw(dt) {
    const ctx = R.ctx;
    R.frame(0, 0, 1152, 640, true);
    R.apply();
    drawTiles(ctx, W.map, R.viewBox(8));
    for (const o of W.props) if (o.layer === 'ground') drawProp(ctx, o);
    for (const o of W.props) if (o.layer === 'low') drawProp(ctx, o);
    const t = this.tank;
    // aim at the pointer
    if (Input.mouse.inside) {
      const [mx, my] = R.toWorld(Input.mouse.x, Input.mouse.y);
      const want = Math.atan2(my - t.y, mx - t.x);
      t.turret = angNorm(t.turret + clamp(angDiff(t.turret, want), -4 * dt, 4 * dt));
      t.aimX = mx;
      t.aimY = my;
    }
    const ring = uimg('minimap_ring_white');
    const pulse = 0.55 + Math.sin(performance.now() / 420) * 0.15 + (this.hover ? 0.25 : 0);
    const rr = (Math.max(img(t.H.body).width, img(t.H.body).height) * 0.5 + 34) * this.scale;
    ctx.globalAlpha = pulse;
    ctx.drawImage(ring, t.x - rr, t.y - rr, rr * 2, rr * 2);
    ctx.globalAlpha = 1;
    drawTank(ctx, t, this.scale, this.hover);
    for (const o of W.props) if (o.layer === 'high') drawProp(ctx, o);
    if (this.tipsDirty) {
      this.tipsDirty = false;
      this.placeTips();
    }
  },
  placeTips() {
    const t = this.tank, im = img(t.H.body + '_outline');
    const [bx, by] = R.toScreen(t.x, t.y - (im.height / 2) * this.scale - 18);
    const [rx, ry] = R.toScreen(t.x + (im.width / 2) * this.scale + 10, t.y);
    const tb = $('tipBody'), tt = $('tipTracks');
    tb.style.left = clamp(bx - tb.offsetWidth / 2, 8, R.W - tb.offsetWidth - 8) + 'px';
    tb.style.top = Math.max(96, by - tb.offsetHeight) + 'px';
    const [, belowY] = R.toScreen(t.x, t.y + (im.height / 2) * this.scale + 12);
    const roomRight = rx + tt.offsetWidth + 8 <= R.W;
    tt.style.left = (roomRight ? rx : clamp(R.W / 2 - tt.offsetWidth / 2, 8, R.W - tt.offsetWidth - 8)) + 'px';
    tt.style.top = (roomRight ? ry - tt.offsetHeight / 2 : belowY) + 'px';
    tb.querySelector('img').style.transform = 'rotate(180deg)';
    tt.querySelector('img').style.transform = roomRight ? 'rotate(-90deg)' : 'rotate(0deg)';
    tb.classList.toggle('hot', this.hover === 'body');
    tt.classList.toggle('hot', this.hover === 'tracks');
  },
};

// ---------- the sample battlefield, frozen, behind the mode cards ----------
function setupShowcase() {
  loadMap('main');
  W.mode = { key: 'showcase', enemyDmg: 0.5 };
  W.tanks = MAPS.main.tanks.map((d) => makeTank({ team: 'enemy', hull: d.hull, guns: d.guns, x: d.x, y: d.y, a: d.a }));
  W.player = null;
  W.turrets = MAPS.main.turrets.map((d) => makeTurret(d));
  W.bullets = [];
  W.effects = [];
  introEffects(true);
}
function introEffects(frozen) {
  for (const [name, x, y, rot] of MAPS.main.intro) {
    const m = name.match(/^(explosionSmoke|explosion)(\d)$/);
    if (m) W.effects.push({ kind: 'anim', seq: m[1], x, y, scale: 1, rot: deg(rot), t: (+m[2] - 1) * 0.06 + 0.001, fd: frozen ? 1e9 : 0.06 });
    else if (W.tanks.some((t) => hypot(t.x - x, t.y - y) < 140)) W.effects.push({ kind: 'flash', sprite: name, x, y, rot: deg(rot), t: 0, life: frozen ? 1e9 : 0.5 });
  }
  // track marks behind the three tanks that were rolling in the sample
  for (const t of W.tanks) {
    if (!['blue', 'red', 'sand'].includes(t.hull)) continue;
    for (const k of [58, 110, 162]) addDecal(t.H.tracks, t.x - Math.cos(t.a) * k, t.y - Math.sin(t.a) * k, t.a - Math.PI / 2, frozen ? 1e9 : 7, 0.5);
  }
}

// ---------- battle camera ----------
const Cam = {
  t: 0, last: null,
  start() {
    this.t = 0;
    this.last = null;
  },
  overview() {
    const [x, y, w, h] = W.map.frame;
    return { x: x + w / 2, y: y + h / 2, s: Math.min(R.W / w, R.H / h), rot: 0, ay: 0.5 };
  },
  chase() {
    const p = W.player;
    if (!p || !p.alive) return this.last || this.overview();
    const def = W.mode.key === 'defense';
    // zoomed in so the tank reads clearly (about 1.5x the old view); the tank sits low to keep room ahead
    const viewH = def ? 933 : 667;
    const s = clamp(Math.min(R.W / 427, R.H / viewH), def ? 0.4 : 0.45, def ? 1.6 : 1.8);
    const portrait = R.H > R.W;
    const ay = portrait ? (def ? 0.66 : 0.6) : def ? 0.8 : 0.7;
    return (this.last = { x: p.x, y: p.y, s, rot: -Math.PI / 2 - p.a, ay });
  },
  update(dt) {
    const a = this.overview(), b = this.chase();
    if (Game.hold > 0) return Object.assign(R.cam, a);
    this.t += dt;
    const k = this.t >= 0.9 ? 1 : (1 - Math.cos((Math.PI * this.t) / 0.9)) / 2;
    if (k >= 1) return Object.assign(R.cam, b);
    Object.assign(R.cam, {
      x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k),
      rot: a.rot + angDiff(a.rot, b.rot) * k, ay: lerp(a.ay, b.ay, k),
    });
  },
};

// ---------- game ----------
const Game = {
  mode: null, modeKey: null, paused: false, hold: 0,
  start(key) {
    const M = MODES[key];
    this.modeKey = key;
    this.mode = key;
    this.paused = false;
    W.over = false;
    W.kills = 0;
    W.time = 0;
    W.shake = 0;
    W.bullets = [];
    W.effects = [];
    W.turrets = [];
    W.tanks = [];
    W.wave = null;
    W.flowAt = null;
    W.mode = Object.assign({ key }, M, {
      enemyDmg: key === 'battle' ? 0.35 : 0.3,
      respawn: 4,
      godMode: key === 'fun',
    });
    loadMap(M.map);
    if (M.map === 'main') buildPerimeter();
    Flow.setup(W.view.x, W.view.y, W.view.w, W.view.h);
    const lo = Loadout;
    if (M.map === 'main') {
      const hpMul = key === 'fun' ? 0.5 : 0.6;
      const roster = M.enemies; // undefined = every tank from the sample image
      for (const d of MAPS.main.tanks) {
        if (d.hull === 'green') {
          W.player = makeTank({ team: 'player', hull: lo.hull, guns: lo.guns, x: d.x, y: d.y, a: d.a, hpMul: key === 'battle' ? 1.6 : 1 });
          W.spawnPoint = [d.x, d.y];
          W.tanks.push(W.player);
          if (M.ally) {
            // the friendly tank rolls in just behind the player
            const a = deg(d.a);
            W.tanks.push(makeTank({ team: 'player', ally: true, hull: M.ally.hull, guns: M.ally.guns, x: d.x - Math.cos(a) * 125, y: d.y - Math.sin(a) * 125, a: d.a }));
          }
        } else if (!roster || roster.includes(d.hull)) W.tanks.push(makeTank({ team: 'enemy', hull: d.hull, guns: d.guns, x: d.x, y: d.y, a: d.a, hpMul }));
      }
      W.turrets = MAPS.main.turrets.map((d, i) => makeTurret(d, (M.turretTeams && M.turretTeams[i]) || 'enemy'));
      introEffects(false);
      this.hold = 0.7;
    } else {
      buildDefenseLine();
      W.player = makeTank({ team: 'player', hull: lo.hull, guns: lo.guns, x: 300, y: 515, a: 0 });
      W.spawnPoint = [300, 515];
      W.tanks.push(W.player);
      W.wave = { n: 0, toSpawn: 0, spawnT: 0, breakT: 2.2, total: 0, killed: 0, lastSpawn: -1 };
      Flow.compute(defenseTargets());
      this.hold = 0.8;
    }
    Cam.start();
    App.go('play');
    HUD.setup(key);
    HUD.toast(key === 'defense' ? '守住沙袋防线' : key === 'fun' ? '超爽模式 · 尽情开炮' : '开战！', 1.6);
    setTimeout(() => ($('hintBar').style.opacity = 0), 7000);
  },
  togglePause(force) {
    if (App.screen !== 'play' || W.over) return;
    this.paused = force == null ? !this.paused : force;
    show('pause', this.paused);
    if (this.paused) {
      syncPauseUi();
      const regen = $('optRegen');
      if (regen) {
        regen.firstElementChild.className = 'chk ' + (this.modeKey === 'battle' ? 'chk-grey-on' : 'chk-grey-x');
        regen.setAttribute('aria-disabled', this.modeKey !== 'battle');
      }
      $('pResume').focus();
    }
    Input.mouse.down = false;
  },
  update(dt) {
    if (this.hold > 0) {
      this.hold -= dt;
      return;
    }
    if (W.over) {
      updateBullets(dt);
      updateEffects(dt);
      return;
    }
    W.time += dt;
    const p = W.player;
    if (p && p.alive) this.controlPlayer(p, dt);
    for (const t of W.tanks) {
      if (!t.alive) continue;
      t.hitT += dt;
      t.flash = Math.max(0, t.flash - dt);
      t.heat = Math.max(0, t.heat - dt * 0.35);
      for (let i = 0; i < t.cd.length; i++) {
        t.cd[i] = Math.max(0, t.cd[i] - dt);
        t.recoil[i] = Math.max(0, t.recoil[i] - dt * 6);
      }
      if (t.burst.length) {
        for (const b of t.burst) b.at -= dt;
        t.burst = t.burst.filter((b) => {
          if (b.at > 0) return true;
          fireMount(t, b.i);
          return false;
        });
      }
      if (t.ally) aiAlly(t, dt);
      else if (t.team === 'enemy') {
        if (this.modeKey === 'battle') aiBattle(t, dt);
        else if (this.modeKey === 'fun') aiWander(t, dt);
        else aiDefense(t, dt);
      }
    }
    // pathfinding refresh
    if (this.modeKey === 'battle') {
      W.flowT -= dt;
      const moved = p && W.flowAt ? hypot(p.x - W.flowAt[0], p.y - W.flowAt[1]) : 1e9;
      if (((W.flowT <= 0 && moved > 24) || Flow.dirty) && p && p.alive) {
        W.flowT = 0.5;
        W.flowAt = [p.x, p.y];
        Flow.compute([[p.x, p.y]]);
      }
    } else if (this.modeKey === 'defense' && Flow.dirty) Flow.compute(defenseTargets());
    for (const t of W.tanks) if (t.alive) driveTank(t, dt);
    separateTanks();
    updateTurrets(dt);
    updateBullets(dt);
    updateEffects(dt);
    if (this.modeKey === 'defense') this.updateWaves(dt);
    else this.updateRespawns(dt);
  },
  controlPlayer(p, dt) {
    let thr = 0, st = 0;
    if (Input.down('KeyW', 'ArrowUp')) thr += 1;
    if (Input.down('KeyS', 'ArrowDown')) thr -= 1;
    if (Input.down('KeyA', 'ArrowLeft')) st -= 1;
    if (Input.down('KeyD', 'ArrowRight')) st += 1;
    const tm = Input.touchMove;
    if (tm.active && hypot(tm.x, tm.y) > 0.15) {
      // the camera keeps the tank pointing up, so the stick works like the keys: up = forward, sideways = turn
      thr = Math.abs(tm.y) > 0.2 ? clamp(-tm.y * 1.25, -1, 1) : 0;
      st = Math.abs(tm.x) > 0.2 ? clamp(tm.x * 1.25, -1, 1) : 0;
    }
    p.throttle = thr;
    p.steer = clamp(st + Wheel.steer(), -1, 1);
    let ax = null, ay = null;
    if (Input.touchAim.active) [ax, ay] = R.toWorld(Input.touchAim.x, Input.touchAim.y);
    else if (Wheel.dragging && Wheel.front) [ax, ay] = [p.x + Math.cos(p.a) * 600, p.y + Math.sin(p.a) * 600]; // steering from the wheel ahead of the tank: the gun looks straight ahead, ready for Space
    else if (Input.mouse.inside || Input.mouse.down) [ax, ay] = R.toWorld(Input.mouse.x, Input.mouse.y);
    if (ax != null) {
      const want = Math.atan2(ay - p.y, ax - p.x);
      p.turret = angNorm(p.turret + clamp(angDiff(p.turret, want), -6 * dt, 6 * dt));
      p.aimX = ax;
      p.aimY = ay;
    } else if (tm.active) {
      p.turret = angNorm(p.turret + clamp(angDiff(p.turret, p.a), -4 * dt, 4 * dt));
      p.aimX = p.x + Math.cos(p.a) * 400;
      p.aimY = p.y + Math.sin(p.a) * 400;
    }
    if (Input.mouse.down || Input.down('Space') || Input.touchAim.fire || Input.fireBtn) tryFirePlayer(p);
    // battle: armour regenerates 5 points a second at all times, under fire or not
    p.regen = this.modeKey === 'battle' && p.hp < p.maxHp;
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + 5 * dt);
  },
  updateRespawns(dt) {
    const p = W.player;
    for (const t of W.tanks) {
      if (t === p || t.alive) continue;
      t.respawnT -= dt;
      if (t.respawnT > 0) continue;
      const home = t.spawn, at = this.respawnPoint(t);
      if (!at) continue; // every spot is taken: try again next frame
      const lo = this.modeKey === 'fun' && t.team === 'enemy' ? randomEnemyLoadout(HULLS[t.hull].large) : { hull: t.hull, guns: t.guns };
      Object.assign(t, makeTank({ team: t.team, ally: t.ally, outline: t.outline, hull: lo.hull, guns: lo.guns, x: at.x, y: at.y, a: at.a, hpMul: t.hpMul }));
      t.spawn = home;
      anim('explosionSmoke', t.x, t.y, 1.1);
    }
  },
  // A destroyed NPC comes back on its own spot, unless the other side is parked on it; then on the nearest
  // other tank spot of the sample map that is well clear of them, so camping a spawn can't stop the respawns.
  respawnPoint(t) {
    const clear = (s, gap) => W.tanks.every((o) => !o.alive || hypot(o.x - s.x, o.y - s.y) >= (o.team === t.team ? 80 : gap));
    if (clear(t.spawn, 220)) return t.spawn;
    const spots = MAPS.main.tanks.filter((d) => (d.hull === 'green') === (t.team === 'player'));
    spots.sort((a, b) => hypot(a.x - t.spawn.x, a.y - t.spawn.y) - hypot(b.x - t.spawn.x, b.y - t.spawn.y));
    return spots.find((s) => clear(s, 450)) || null;
  },
  updateWaves(dt) {
    const w = W.wave;
    if (W.over) return;
    const alive = W.tanks.filter((t) => t.team === 'enemy' && t.alive);
    if (w.breakT > 0) {
      w.breakT -= dt;
      if (w.breakT <= 0) {
        w.n++;
        const cfg = waveConfig(w.n);
        w.toSpawn = cfg.count;
        w.total = cfg.count;
        w.killed = 0;
        w.spawnT = 0.3;
        w.cfg = cfg;
        HUD.toast(`第 ${w.n} 波来袭`, 1.8);
      }
    } else if (w.toSpawn > 0) {
      w.spawnT -= dt;
      if (w.spawnT <= 0 && spawnWaveEnemy(w)) {
        w.toSpawn--;
        w.spawnT = w.cfg.interval;
      }
    } else if (!alive.length) {
      if (w.n >= MODES.defense.waves) this.finish('win');
      else {
        w.breakT = 3.5;
        HUD.toast(`第 ${w.n} 波已击退`, 1.6);
      }
    }
    // HUD: how close is the nearest enemy to the sandbags
    let near = 9999;
    for (const t of alive) near = Math.min(near, t.x - t.r - W.map.lineX);
    const danger = near < 260;
    if (w._danger !== danger) {
      w._danger = danger;
      $('alert').hidden = !danger;
      $('danger').classList.toggle('on', danger);
      $('waveBox').classList.toggle('pz-grey-bolts-blue', !danger);
      $('waveBox').classList.toggle('pz-grey-red', danger);
    }
    setTop($('gLine').firstElementChild, clamp(near / 1200, 0, 1) * 100);
    setText('waveNum', w.n);
    setText('waveText', `第 ${w.n} / ${MODES.defense.waves} 波`);
    setText('leftText', `剩余 ${alive.length + w.toSpawn}`);
    setBar('waveBar', w.total ? w.killed / w.total : 0);
  },
  finish(kind) {
    if (W.over) return;
    W.over = true;
    const key = this.modeKey;
    setTimeout(() => {
      if (App.screen !== 'play') return;
      let stats, msg;
      if (key === 'defense') {
        const reached = kind === 'win' ? MODES.defense.waves : W.wave.n;
        Best.defense = Math.max(Best.defense, reached);
        stats = [['到达波次', reached], ['击毁坦克', W.kills], ['用时', fmtTime(W.time)]];
        msg = kind === 'win' ? '十波敌军全部被挡在沙袋线外，防线完好无损。' : `一辆敌方坦克在第 ${W.wave.n} 波碰到了沙袋。试试射程更远或火力更猛的炮管，在敌人接近前把它们打掉。`;
      } else {
        Best.battle = Math.max(Best.battle, W.kills);
        stats = [['击毁', W.kills], ['坚持', fmtTime(W.time)], ['最高纪录', Best.battle]];
        msg = '你的坦克被击毁了。敌方开火后要冷却 3 秒，抓住它们装填的空当绕到侧面开火。';
      }
      store.set('best', Best);
      showResult(kind, stats, msg);
    }, kind === 'win' ? 900 : 1500);
  },
};

function randomEnemyLoadout(large) {
  if (large) {
    const hull = pick(['bigRed', 'darkLarge', 'huge']);
    return { hull, guns: HULLS[hull].mounts.map(() => 'x' + (1 + ((Math.random() * 7) | 0))) };
  }
  const hull = pick(SMALL_ORDER);
  return { hull, guns: [COLOR_KEYS[HULLS[hull].color] + (1 + ((Math.random() * 3) | 0))] };
}

function waveConfig(n) {
  // tank armour doubled across the game, so waves arrive slower and further apart to keep the same difficulty curve
  const count = 3 + n * 2;
  return { count, interval: Math.max(1.5, 4.4 - n * 0.29), hpMul: 0.28 + n * 0.036, speedMul: 0.26 + n * 0.02, largeChance: n >= 7 ? 0.3 : n >= 5 ? 0.22 : n >= 3 ? 0.14 : 0 };
}
const DEF_SPAWNS = [
  [1900, 131, 180], [1900, 515, 180], [1900, 899, 180], [1686, -90, 90], [1686, 1120, -90],
];
const SMALL_ORDER = ['green', 'sand', 'red', 'blue', 'dark'];
function spawnWaveEnemy(w) {
  const cfg = w.cfg;
  const k = w.total - w.toSpawn;
  for (let tries = 0; tries < DEF_SPAWNS.length; tries++) {
    const si = (w.n * 3 + k + tries) % DEF_SPAWNS.length;
    const [x, y, a] = DEF_SPAWNS[si];
    if (W.tanks.some((t) => t.alive && hypot(t.x - x, t.y - y) < 120)) continue;
    let hull, guns;
    if (Math.random() < cfg.largeChance) {
      hull = pick(w.n >= 7 ? ['bigRed', 'darkLarge', 'huge'] : w.n >= 5 ? ['bigRed', 'darkLarge'] : ['bigRed']);
      guns = HULLS[hull].mounts.map((_, i) => 'x' + (((w.n + k + i) % 7) + 1));
    } else {
      hull = SMALL_ORDER[(w.n + k) % 5];
      guns = [COLOR_KEYS[HULLS[hull].color] + (((w.n * 2 + k) % 3) + 1)];
    }
    const t = makeTank({ team: 'enemy', hull, guns, x, y, a, hpMul: cfg.hpMul, speedMul: cfg.speedMul });
    t.entering = true;
    t.ai.cd = rand(1.5, 3);
    W.tanks.push(t);
    return true;
  }
  return false;
}
function buildDefenseLine() {
  const x = W.map.lineX;
  let i = 0;
  for (let y = -26; y < W.view.h + 40; y += 48, i++) {
    const name = i % 4 === 3 ? 'sandbagBrown' : 'sandbagBeige';
    const o = makeProp(name, x + (i % 2 ? 3 : -3), y, 90 + rand(-6, 6));
    o.lineBag = true;
    o.hp = o.maxHp = Infinity;
    W.props.push(o);
  }
}
function defenseTargets() {
  const out = [];
  for (let y = 16; y < W.view.h; y += 32) out.push([W.map.lineX + 70, y]);
  return out;
}

// ---------- app: which screen is up ----------
const App = {
  screen: null,
  go(screen) {
    this.screen = screen;
    R.dirty = true;
    show('home', screen === 'home');
    show('tipBody', screen === 'home');
    show('tipTracks', screen === 'home');
    show('modes', screen === 'modes');
    show('garage', screen === 'garage');
    show('hud', screen === 'play');
    show('touch', screen === 'play' && Input.isTouch);
    if (screen !== 'play') {
      show('pause', false);
      Game.paused = false;
      Game.mode = null;
    }
    R.cv.style.cursor = screen === 'play' ? 'crosshair' : 'default';
    if (screen === 'home') Home.setup();
    if (screen === 'modes') {
      setupShowcase();
      buildModes();
    }
    if (screen === 'garage') Garage.open();
  },
  onPointerDown(e) {
    if (this.screen !== 'home') return;
    const part = Home.hit(e.clientX, e.clientY);
    if (part === 'tracks') this.go('garage');
    else if (part === 'body') this.go('modes');
  },
  startMode(key) {
    const bad = loadoutProblems(Loadout).length > 0;
    if (key !== 'fun' && bad) {
      dialog('装备不符合规则', `${MODES[key].name}里，红黑两色的特殊炮管只能装在大型坦克（红魔重坦、钢铁堡垒、巨像）上。你现在的「${loadoutLabel(Loadout)}」需要调整后才能出击。`, [
        ['换成常规炮管并出击', 'btn-red', () => {
          Loadout = fixLoadout(Loadout);
          saveLoadout();
          Game.start(key);
        }],
        ['去装备库', 'btn-brown', () => this.go('garage')],
        ['改玩超爽模式', 'btn-grey', () => Game.start('fun')],
      ]);
      return;
    }
    Game.start(key);
  },
  onEnemyKilled(t, by) {
    if (W.wave) W.wave.killed++;
    const name = t ? t.H.name : '敌方炮台';
    if (Game.modeKey !== 'defense' && by) {
      if (by === W.player) {
        if (!t || t.isLarge) HUD.toast(`击毁 ${name}`, 1.2);
      } else if (by.team === 'player') HUD.toast(`${by.H ? '友方' + by.H.name : '友方炮台'}击毁 ${name}`, 1.2);
    }
    if (Game.modeKey === 'fun') {
      Best.fun++;
      store.set('best', Best);
    }
  },
  onAllyKilled(t) {
    HUD.toast(`友方${t.H.name}被击毁，${W.mode.respawn} 秒后重生`, 1.6);
  },
  onAllyTurretLost() {
    HUD.toast(`友方炮台被摧毁，${W.mode.respawn} 秒后重建`, 1.6);
  },
  onPlayerKilled() {
    if (Game.modeKey === 'battle') Game.finish('dead');
  },
  onLineTouched(t, o) {
    if (W.mode.key !== 'defense' || W.over) return;
    anim('explosionSmoke', o.x + 20, o.y, 0.9);
    o.opened = true;
    o.sprite = o.def.open || o.sprite;
    addShake(14);
    Game.finish('line');
  },
  onEscape() {
    if (!$('dialog').hidden) return show('dialog', false);
    if (this.screen === 'play') return Game.togglePause();
    if (this.screen === 'garage') {
      Garage.save();
      return this.go('home');
    }
    if (this.screen === 'modes') return this.go('home');
  },
};

$('modesBack').onclick = () => App.go('home');
$('modesGarage').onclick = () => App.go('garage');
$('garageClose').onclick = () => {
  Garage.save();
  App.go('home');
};
$('garageHome').onclick = () => {
  Garage.save();
  App.go('home');
};
$('garageGo').onclick = () => {
  Garage.save();
  App.go('modes');
};

// ---------- main loop ----------
// Each screen asks for only as many frames as it needs: battle ~60 fps (also on 120 Hz displays),
// the home showcase 30 fps, paused/finished rounds ~11 fps, and the still screens (modes, garage) one frame.
let lastT = performance.now(), frameNo = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const scr = App.screen;
  const gap = now - lastT;
  if (scr === 'play') {
    if (gap < (Game.paused || !$('result').hidden ? 90 : 12.5)) return;
  } else if (scr === 'home') {
    if (gap < 30) return;
  } else if (!R.dirty) return;
  R.dirty = false;
  const dt = Math.min(0.033, gap / 1000);
  lastT = now;
  frameNo++;
  if (scr === 'garage') return; // the garage covers the whole canvas
  if (scr === 'play' && !Game.paused && !W.over) R.watch(gap);
  R.clear();
  const ctx = R.ctx;
  if (scr === 'home') {
    const part = Input.mouse.inside ? Home.hit(Input.mouse.x, Input.mouse.y) : null;
    if (part !== Home.hover) {
      Home.hover = part;
      Home.tipsDirty = true;
      R.cv.style.cursor = part ? 'pointer' : 'default';
    }
    Home.draw(dt);
  } else if (scr === 'modes') {
    const [fx, fy, fw, fh] = W.map.frame;
    R.frame(fx, fy, fw, fh, false);
    R.apply();
    drawWorld(ctx);
  } else if (App.screen === 'play') {
    if (!Game.paused) {
      Wheel.update(dt);
      Game.update(dt);
    }
    Cam.update(Game.paused ? 0 : dt);
    Wheel.place();
    const sh = W.shake;
    R.apply(sh ? rand(-sh, sh) * 0.5 : 0, sh ? rand(-sh, sh) * 0.5 : 0);
    drawWorld(ctx);
    drawOverlays(ctx);
    if (Settings.radar && frameNo % 2 === 0) Radar.draw();
    HUD.update();
  }
}

// ---------- updates ----------
// GitHub Pages lets browsers cache the page for 10 minutes, and the game hall's iframe never revalidates it.
// So the page asks for version.json past every cache and moves itself to the newest build.
function checkForUpdate() {
  if (!/^https?:$/.test(location.protocol) || typeof BUILD === 'undefined') return;
  fetch('version.json?ts=' + Date.now(), { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((v) => {
      if (!v || !v.build || v.build === BUILD) return;
      const u = new URL(location.href);
      if (u.searchParams.get('v') === v.build) return; // already asked for it; the CDN is still catching up
      u.searchParams.set('v', v.build);
      location.replace(u.toString());
    })
    .catch(() => {});
}

// ---------- boot ----------
async function boot() {
  checkForUpdate();
  R.init();
  Radar.init();
  Input.init(R.cv);
  await loadAssets();
  $('boot').hidden = true;
  App.go('home');
  requestAnimationFrame(frame);
  window.claude?.hot?.snapshot?.(() => ({ loadout: Loadout, settings: Settings }));
}
if (window.claude?.hot?.ready) window.claude.hot.ready(() => boot());
else boot();
