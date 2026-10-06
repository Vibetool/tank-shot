// ---------- settings & loadout (per-viewer, kept in localStorage when available) ----------
const Settings = Object.assign({ radar: true, tracks: true, bars: true, shake: 0.6, wheelFront: true }, store.get('settings', {}));
let Loadout = normLoadout(store.get('loadout', DEFAULT_LOADOUT));
const Best = Object.assign({ fun: 0, battle: 0, defense: 0 }, store.get('best', {}));
function saveLoadout() {
  store.set('loadout', Loadout);
}

function loadoutLabel(lo) {
  const names = lo.guns.map((g) => BARRELS[g].name);
  const uniq = [...new Set(names)];
  return HULLS[lo.hull].name + ' · ' + uniq.map((n) => n + (names.filter((x) => x === n).length > 1 ? ' ×' + names.filter((x) => x === n).length : '')).join(' + ');
}

// ---------- custom scrollbars built from the UI pack ----------
function attachScroller(box) {
  const view = box.querySelector('.sc-view'), track = box.querySelector('.sc-track'), thumb = track.firstElementChild;
  const sync = () => {
    const max = view.scrollHeight - view.clientHeight;
    track.style.visibility = max > 2 ? 'visible' : 'hidden';
    const h = track.clientHeight - thumb.offsetHeight;
    thumb.style.top = (max > 0 ? (view.scrollTop / max) * h : 0) + 'px';
  };
  view.addEventListener('scroll', sync);
  addEventListener('resize', sync);
  let drag = null;
  thumb.addEventListener('pointerdown', (e) => {
    drag = { y: e.clientY, top: view.scrollTop };
    thumb.setPointerCapture(e.pointerId);
  });
  thumb.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const max = view.scrollHeight - view.clientHeight, h = track.clientHeight - thumb.offsetHeight;
    view.scrollTop = drag.top + ((e.clientY - drag.y) / Math.max(1, h)) * max;
  });
  thumb.addEventListener('pointerup', () => (drag = null));
  track.addEventListener('pointerdown', (e) => {
    if (e.target !== track) return;
    const r = track.getBoundingClientRect();
    view.scrollTop = ((e.clientY - r.top) / r.height) * (view.scrollHeight - view.clientHeight);
  });
  return sync;
}

// ---------- dialog ----------
function dialog(title, text, buttons) {
  $('dlgTitle').textContent = title;
  $('dlgText').textContent = text;
  const box = $('dlgBtns');
  box.innerHTML = '';
  for (const [label, cls, fn] of buttons) {
    const b = el('button', 'btn nine ' + cls, label);
    b.onclick = () => {
      show('dialog', false);
      fn && fn();
    };
    box.appendChild(b);
  }
  show('dialog');
  box.firstElementChild && box.firstElementChild.focus();
}
$('dlgClose').onclick = () => show('dialog', false);

// ---------- mode select ----------
const CARDS = [
  {
    key: 'fun', panel: 'pz-brown-corners-a', medal: 'medal-1', icon: 'tank_huge', title: '超爽模式',
    desc: '敌方坦克只会到处跑，不会开火。车体和炮管随便组合，红黑炮管也能装在小坦克上。',
    rules: [['on', '敌方坦克不攻击'], ['on', '装备组合不受限制'], ['on', '被击毁的敌人 4 秒后重生'], ['na', '没有失败条件，随时可以退出']],
    best: (v) => `累计击毁 ${v}`,
  },
  {
    key: 'battle', panel: 'pz-brown-corners-b', medal: 'medal-2', icon: 'explosion3', title: '普通战场',
    desc: '你和友方「暗影」坦克，对阵敌方「红魔重坦」和「钢铁堡垒」。地图两座炮台一座帮你、一座帮敌人。',
    rules: [['on', '友方暗影坦克、友方炮台并肩作战'], ['off', '敌方坦克和炮台开火冷却 3 秒'], ['on', '耐久每秒持续回复 5 点'], ['na', '双方被击毁后都 4 秒重生']],
    best: (v) => `最高击毁 ${v}`,
  },
  {
    key: 'defense', panel: 'pz-brown-dark-corners-a', medal: 'medal-3', icon: 'sandbagBeige', title: '防守',
    desc: '守住一条沙袋防线。防线后方挡住敌方所有炮弹，但只要有一辆敌方坦克碰到沙袋，你就输了。',
    rules: [['on', '沙袋挡住敌方全部炮弹'], ['off', '敌方坦克碰到沙袋即失败'], ['on', '撑过 10 波即胜利'], ['na', '红黑炮管只能装在大型坦克上']],
    best: (v) => `最佳纪录：第 ${v} 波`,
  },
];

function buildModes() {
  const box = $('modeCards');
  box.innerHTML = '';
  for (const c of CARDS) {
    const card = el('div', 'nine card ' + c.panel);
    card.innerHTML = `
      <div class="medal ${c.medal}"><img alt=""></div>
      <h2>${c.title}</h2>
      <p>${c.desc}</p>
      <ul class="rules">${c.rules.map(([s, t]) => `<li><i class="chk chk-beige-${s}"></i>${t}</li>`).join('')}</ul>
      <div class="best"><img alt="" style="width:18px;height:18px"><span>${c.best(Best[c.key])}</span></div>
      <div class="warn"></div>
      <button class="btn btn-red nine go">出击</button>`;
    card.querySelector('.medal img').src = tSrc(c.icon);
    card.querySelector('.best img').src = uiSrc('minimap_icon_star_yellow');
    card.querySelector('.go').onclick = () => App.startMode(c.key);
    card.dataset.mode = c.key;
    box.appendChild(card);
  }
  refreshModes();
  // briefing: who fights where. 超爽 uses every tank from the sample image; 普通战场 has its own fixed roster
  const unit = (src, name) => `<span><img alt="" src="${src}">${name}</span>`;
  const sample = MAPS.main.tanks.filter((t) => t.hull !== 'green');
  const B = MODES.battle;
  $('brief').innerHTML = `<b>作战简报</b>　战场按 Kenney 示例图 1:1 还原（四周各扩出 4 格）：草地与沙漠各占一半，道路、树木、沙袋、木箱和油桶的位置都和原图相同。
    <div class="roster">普通战场　友方：${unit(tSrc(HULLS[B.ally.hull].comp), HULLS[B.ally.hull].name)}${unit(tSrc('barricadeMetal'), '炮台')}　敌方：${B.enemies.map((h) => unit(tSrc(HULLS[h].comp), HULLS[h].name)).join('')}${unit(tSrc('barricadeMetal'), '炮台')}</div>
    <div class="roster">超爽模式　敌方：${sample.map((t) => unit(tSrc(HULLS[t.hull].comp), HULLS[t.hull].name)).join('')}</div>`;
}
function refreshModes() {
  const bad = loadoutProblems(Loadout).length > 0;
  document.querySelectorAll('#modeCards .card').forEach((card) => {
    const k = card.dataset.mode;
    card.querySelector('.warn').textContent = k !== 'fun' && bad ? '当前装备只能在超爽模式使用，出击前需要调整' : '';
  });
  const chip = $('modeLoadout');
  chip.innerHTML = '';
  const cv = el('canvas');
  cv.width = cv.height = 144;
  chip.appendChild(cv);
  drawThumb(cv, Loadout);
  const txt = el('div', '', `<b>当前坦克</b><br>${loadoutLabel(Loadout)}`);
  chip.appendChild(txt);
  const st = el('div', 'rules', `<li><i class="chk ${bad ? 'chk-brown-off' : 'chk-brown-on'}"></i>${bad ? '仅限超爽模式' : '全部模式可用'}</li>`);
  chip.appendChild(st);
}

// ---------- garage ----------
const Garage = {
  lo: null, mount: 0, preset: 0, syncHull: null, syncBarrel: null, hover: -1,
  open() {
    this.lo = normLoadout(Loadout);
    this.mount = 0;
    this.build();
  },
  build() {
    const hl = $('hullList');
    hl.innerHTML = '';
    for (const k of HULL_ORDER) {
      const H = HULLS[k];
      const b = el('button', 'hull-item' + (k === this.lo.hull ? ' on' : ''));
      b.innerHTML = `<span class="disc"><img alt="" src="${tSrc(H.body + '_outline')}"></span><span><b>${H.name}</b><small>${H.large ? `<img alt="" src="${uiSrc('minimap_icon_star_red')}">大型 · ${H.mounts.length} 炮位` : '小型 · 1 炮位'}</small><small>耐久 ${H.hp} · 速度 ${H.speed}</small></span>`;
      b.onclick = () => this.setHull(k);
      hl.appendChild(b);
    }
    if (!this.syncHull) this.syncHull = attachScroller(hl.parentElement);
    this.buildBarrels();
    this.refresh();
  },
  setHull(k) {
    const old = this.lo.guns;
    this.lo = normLoadout({ hull: k, guns: HULLS[k].mounts.map((_, i) => old[i] || old[0]) });
    this.mount = Math.min(this.mount, this.lo.guns.length - 1);
    this.build();
  },
  buildBarrels() {
    const bl = $('barrelList');
    bl.innerHTML = '';
    const large = HULLS[this.lo.hull].large;
    const head = (t) => {
      const h = el('div', 'g-title', t);
      h.style.gridColumn = '1 / -1';
      h.style.fontSize = '12.5px';
      bl.appendChild(h);
    };
    head('常规炮管');
    for (const id of BARREL_ORDER) {
      const B = BARRELS[id];
      if (B.kind === 'special' && id === 'x1') head('红黑特殊炮管 · 仅限大型坦克');
      const on = this.lo.guns[this.mount] === id;
      let cls = B.kind === 'regular' ? 'h-reg' : 'h-sp ' + (large ? 'ok' : 'no');
      const b = el('button', 'hexb ' + cls + (on ? ' on' : ''));
      b.title = B.name;
      b.setAttribute('aria-label', B.name);
      b.innerHTML = `<img alt="" src="${tSrc(B.sprite + '_outline')}">`;
      if (B.kind === 'special' && !large) b.innerHTML += `<i class="lock"></i><img class="badge" alt="" src="${uiSrc('checkbox_brown_cross')}" style="transform:none">`;
      b.onmouseenter = () => this.info(id);
      b.onfocus = () => this.info(id);
      b.onclick = () => {
        this.lo.guns[this.mount] = id;
        this.buildBarrels();
        this.refresh();
        this.info(id);
      };
      bl.appendChild(b);
    }
    if (!this.syncBarrel) this.syncBarrel = attachScroller(bl.parentElement);
    this.info(this.lo.guns[this.mount]);
  },
  info(id) {
    const B = BARRELS[id];
    const tag = B.kind === 'special' ? (HULLS[this.lo.hull].large ? '可装备' : '小型坦克装上它只能玩超爽模式') : '所有坦克可用';
    const extra = B.desc || (B.type === 1 ? '炮弹沉重，单发伤害高。' : B.type === 2 ? '装填快，适合连续压制。' : '弹速快、射程远。');
    $('barrelInfo').innerHTML = `<div><b>${B.name}</b>　<small>${tag}</small><br>${extra}<br><small>伤害 ${B.dmg}${B.pellets > 1 ? ' ×' + B.pellets : ''}${B.burst > 1 ? ' ×' + B.burst + ' 连发' : ''} · 装填 ${B.reload.toFixed(2)} 秒 · 射程 ${B.range}</small></div><img alt="炮弹" src="${tSrc(B.bullet + '_outline')}">`;
  },
  refresh() {
    document.querySelectorAll('#hullList .hull-item').forEach((b, i) => b.classList.toggle('on', HULL_ORDER[i] === this.lo.hull));
    const mc = $('mountChips');
    mc.innerHTML = '';
    this.lo.guns.forEach((g, i) => {
      const b = el('button', 'nine mount-chip ' + (i === this.mount ? 'fr-grey-detail' : 'fr-grey'), `炮位 ${i + 1}<br><small>${BARRELS[g].name}</small>`);
      b.onclick = () => {
        this.mount = i;
        this.buildBarrels();
        this.refresh();
      };
      mc.appendChild(b);
    });
    $('mountLabel').textContent = this.lo.guns.length > 1 ? `正在改装：炮位 ${this.mount + 1}` : '';
    const bad = loadoutProblems(this.lo);
    $('ruleBox').innerHTML = `<ul class="rules">
      <li>${bad.length ? '<i class="chk chk-brown-off"></i><span><b>仅限超爽模式</b>：红黑炮管装在了小型坦克上，普通战场和防守出击前需要换掉。</span>' : '<i class="chk chk-brown-on"></i><span><b>全部模式可用</b></span>'}</li>
      <li><i class="chk chk-brown-na"></i><span>红黑炮管只能装在大型坦克（红魔重坦、钢铁堡垒、巨像）上，大型坦克可同时装 ${HULLS.huge.mounts.length} 门以内的炮。超爽模式不限制。</span></li></ul>`;
    const s = loadoutStats(this.lo);
    const rows = [
      ['耐久', s.hp / 720, s.hp, 'fill-green-b'],
      ['机动', s.speed / 210, s.speed, 'fill-blue-b'],
      ['火力', Math.min(1, s.dps / 220), Math.round(s.dps), 'fill-red-b'],
      ['射速', Math.min(1, s.rate / 14), s.rate.toFixed(1) + '/秒', 'fill-white-b'],
    ];
    $('statBox').innerHTML = rows.map(([n, f, v, cls]) => `<span>${n}</span><div class="bar ${cls}" data-f="${f}"><i></i></div><span>${v}</span>`).join('');
    requestAnimationFrame(() => document.querySelectorAll('#statBox .bar').forEach((b) => setBar(b, +b.dataset.f)));
    this.drawPresets();
    this.drawBlueprint();
    this.syncHull && this.syncHull();
    this.syncBarrel && this.syncBarrel();
  },
  drawPresets() {
    const P = PRESETS[this.preset];
    const box = $('presetBox');
    box.innerHTML = `<button class="arrow prev" aria-label="上一个原厂配置"><img alt="" src="${uiSrc('minimap_arrow_b')}"></button>
      <div class="pv"><img alt="" src="${tSrc(P.comp)}"><div><b>原厂配置 · ${HULLS[P.hull].name}</b><small>${P.guns.map((g) => BARRELS[g].name).join(' + ')}</small><br><button class="btn btn-brown nine" style="min-height:34px;font-size:13px;margin-top:4px">套用</button></div></div>
      <button class="arrow next" aria-label="下一个原厂配置"><img alt="" src="${uiSrc('minimap_arrow_b')}"></button>`;
    box.querySelector('.prev').onclick = () => {
      this.preset = (this.preset + PRESETS.length - 1) % PRESETS.length;
      this.drawPresets();
    };
    box.querySelector('.next').onclick = () => {
      this.preset = (this.preset + 1) % PRESETS.length;
      this.drawPresets();
    };
    box.querySelector('.pv .btn').onclick = () => {
      this.lo = normLoadout({ hull: P.hull, guns: P.guns.slice() });
      this.mount = 0;
      this.build();
    };
  },
  bpTank: null,
  drawBlueprint() {
    const cv = $('bpCanvas'), c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    const t = previewTank(this.lo, cv.width / 2, cv.height / 2 + 30);
    this.bpTank = t;
    const s = HULLS[this.lo.hull].large ? 3.1 : 4.2;
    this.bpScale = s;
    const ring = uimg('minimap_ring_grey');
    const rr = (Math.max(img(t.H.body).width, img(t.H.body).height) * 0.5 + 34) * s;
    c.globalAlpha = 0.9;
    c.drawImage(ring, t.x - rr, t.y - rr, rr * 2, rr * 2);
    c.globalAlpha = 1;
    drawTank(c, t, s);
    // mount markers
    t.guns.forEach((g, i) => {
      const [mx, my] = mountPos(t, i);
      const x = t.x + (mx - t.x) * s, y = t.y + (my - t.y) * s;
      const star = uimg(i === this.mount ? 'minimap_icon_star_yellow' : 'minimap_icon_star_white');
      const sz = i === this.mount ? 46 : 34;
      c.drawImage(star, x - sz / 2, y - sz / 2 + 8, sz, sz);
    });
    c.font = '700 30px ' + getComputedStyle(document.body).fontFamily;
    c.fillStyle = '#fdf5e2';
    c.textAlign = 'left';
    c.fillText(HULLS[this.lo.hull].name + (HULLS[this.lo.hull].large ? ' · 大型' : ' · 小型'), 26, 46);
    c.font = '600 22px ' + getComputedStyle(document.body).fontFamily;
    c.fillText(t.guns.length > 1 ? '点击星标切换炮位' : '单炮位', 26, 80);
  },
  clickBlueprint(e) {
    const cv = $('bpCanvas'), r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * cv.width, y = ((e.clientY - r.top) / r.height) * cv.height;
    const t = this.bpTank, s = this.bpScale;
    let best = -1, bd = 90;
    t.guns.forEach((g, i) => {
      const [mx, my] = mountPos(t, i);
      const d = hypot(t.x + (mx - t.x) * s - x, t.y + (my - t.y) * s - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0 && best !== this.mount) {
      this.mount = best;
      this.buildBarrels();
      this.refresh();
    }
  },
  save() {
    Loadout = normLoadout(this.lo);
    saveLoadout();
  },
};
$('bpCanvas').addEventListener('click', (e) => Garage.clickBlueprint(e));

// ---------- HUD ----------
const HUD = {
  lastPips: '',
  setup(mode) {
    $('modeName').textContent = MODES[mode].name;
    $('waveBox').hidden = mode !== 'defense';
    $('lineGaugeWrap').hidden = mode !== 'defense';
    $('timeChip').hidden = mode === 'defense';
    $('hudHull').src = tSrc(HULLS[Loadout.hull].body + '_outline');
    $('radar').hidden = !Settings.radar;
    $('alert').hidden = true;
    $('toast').hidden = true;
    $('danger').classList.remove('on');
    $('hintBar').style.opacity = 1;
    $('hintBar').hidden = Input.isTouch;
    $('wheel').hidden = Input.isTouch;
    Wheel.reset();
    this.lastPips = '';
  },
  update() {
    const p = W.player;
    if (!p) return;
    const fr = p.hp / p.maxHp;
    setText('hpNum', Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp);
    const bar = $('hpBar'), low = fr < 0.3;
    if (bar._low !== low) {
      bar._low = low;
      bar.classList.toggle('fill-green', !low);
      bar.classList.toggle('fill-red', low);
    }
    setBar(bar, fr);
    let ready = 0, tot = 0, sig = '';
    p.guns.forEach((g, i) => {
      const r = BARRELS[g].reload;
      const f = 1 - Math.max(0, p.cd[i]) / r;
      tot += f;
      if (f >= 1) ready++;
      sig += f >= 1 ? 'r' : 'w';
    });
    if (sig !== this.lastPips) {
      this.lastPips = sig;
      $('pips').innerHTML = [...sig].map((s) => `<i class="pip ${s === 'r' ? 'ready' : 'wait'}"></i>`).join('');
    }
    setBar('reloadBar', tot / p.guns.length);
    const sp = clamp(p.speed / p.H.speed, 0, 1);
    setTop($('gSpeed').firstElementChild, (1 - sp) * 100);
    setTop($('gHeat').firstElementChild, (1 - p.heat) * 100);
    setText('killNum', W.kills);
    setText('timeChip', fmtTime(W.time));
  },
  toast(text, sec = 2.2) {
    const t = $('toast');
    t.textContent = text;
    show(t);
    clearTimeout(this._toast);
    this._toast = setTimeout(() => (t.hidden = true), sec * 1000);
  },
};
$('pauseBtn').onclick = () => Game.togglePause();

// ---------- steering wheel (drag with the mouse) ----------
// Turning the rim clockwise steers right. Full lock is 135deg either way; let go and it springs back to centre.
// It sits just ahead of the player's tank, so the mouse never has far to go between steering and aiming;
// the pause menu can send it back to the bottom-left corner.
const WHEEL_MAX = deg(135);
const Wheel = {
  angle: 0, dragging: false, last: 0, front: false, x: 0, y: 0, half: 0, pos: null,
  init() {
    const el = $('wheel');
    const centre = () => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const [cx, cy] = centre();
      this.dragging = true;
      this.last = Math.atan2(e.clientY - cy, e.clientX - cx);
      try {
        el.setPointerCapture(e.pointerId);
      } catch (err) {}
      el.classList.add('grab');
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const [cx, cy] = centre();
      if (hypot(e.clientX - cx, e.clientY - cy) < 10) return; // too close to the hub to read an angle
      const a = Math.atan2(e.clientY - cy, e.clientX - cx);
      this.angle = clamp(this.angle + angDiff(this.last, a), -WHEEL_MAX, WHEEL_MAX);
      this.last = a;
      this.render();
    });
    const end = () => {
      this.dragging = false;
      el.classList.remove('grab');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  },
  update(dt) {
    if (this.dragging || !this.angle) return;
    this.angle = approach(this.angle, 0, dt * 6);
    this.render();
  },
  steer() {
    return this.angle / WHEEL_MAX;
  },
  render() {
    const v = Math.round((this.angle * 180) / Math.PI);
    if (v === this._v) return;
    this._v = v;
    $('wheelRim').style.transform = `rotate(${v}deg)`;
    $('wheel').setAttribute('aria-valuenow', v);
  },
  reset() {
    this.angle = 0;
    this.dragging = false;
    this.render();
  },
  // the chase camera keeps the tank's nose pointing up the screen, so "ahead of the tank" is a fixed spot above it
  place() {
    const el = $('wheel'), p = W.player;
    if (el.hidden) return;
    let left = '', top = '';
    this.front = Settings.wheelFront && !!p;
    if (this.front) {
      const c = Cam.chase();
      this.half = this.half || el.offsetWidth / 2;
      const nose = (img(p.H.body).height / 2) * c.s;
      this.x = R.W / 2;
      this.y = Math.max(this.half + 8, R.H * c.ay - nose - 34 - this.half);
      left = Math.round(this.x - this.half) + 'px';
      top = Math.round(this.y - this.half) + 'px';
    }
    const pos = left + ',' + top;
    if (pos === this.pos) return;
    this.pos = pos;
    el.classList.toggle('front', this.front);
    el.style.left = left;
    el.style.top = top;
  },
};
Wheel.init();

// ---------- pause menu ----------
function syncPauseUi() {
  const set = (id, on, disabled) => {
    const b = $(id);
    b.firstElementChild.className = 'chk ' + (disabled ? 'chk-grey-x' : on ? 'chk-grey-on' : 'chk-grey-off');
    b.setAttribute('aria-pressed', on);
    b.setAttribute('aria-disabled', !!disabled);
  };
  set('optRadar', Settings.radar);
  set('optTracks', Settings.tracks);
  set('optBars', Settings.bars, false);
  set('optWheel', Settings.wheelFront, Input.isTouch);
  const v = Math.round(Settings.shake * 100);
  $('shakeVal').textContent = v + '%';
  $('shakeTrack').firstElementChild.style.left = v + '%';
  $('shakeTrack').setAttribute('aria-valuenow', v);
}
function saveSettings() {
  store.set('settings', Settings);
  syncPauseUi();
  $('radar').hidden = !Settings.radar;
}
$('optRadar').onclick = () => {
  Settings.radar = !Settings.radar;
  saveSettings();
};
$('optTracks').onclick = () => {
  Settings.tracks = !Settings.tracks;
  saveSettings();
};
$('optBars').onclick = () => {
  Settings.bars = !Settings.bars;
  saveSettings();
};
$('optWheel').onclick = () => {
  if (Input.isTouch) return; // touch screens drive with the stick instead
  Settings.wheelFront = !Settings.wheelFront;
  saveSettings();
  Wheel.place();
};
(function slider() {
  const tr = $('shakeTrack');
  const setFrom = (e) => {
    const r = tr.getBoundingClientRect();
    Settings.shake = clamp((e.clientX - r.left) / r.width, 0, 1);
    saveSettings();
  };
  let drag = false;
  tr.addEventListener('pointerdown', (e) => {
    drag = true;
    tr.setPointerCapture(e.pointerId);
    setFrom(e);
  });
  tr.addEventListener('pointermove', (e) => drag && setFrom(e));
  tr.addEventListener('pointerup', () => (drag = false));
  tr.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      Settings.shake = clamp(Settings.shake + (e.key === 'ArrowLeft' ? -0.1 : 0.1), 0, 1);
      saveSettings();
      e.preventDefault();
    }
  });
})();
$('pResume').onclick = () => Game.togglePause(false);
$('pauseClose').onclick = () => Game.togglePause(false);
$('pRestart').onclick = () => {
  show('pause', false);
  Game.start(Game.modeKey);
};
$('pHome').onclick = () => {
  show('pause', false);
  App.go('home');
};

// ---------- result ----------
function showResult(kind, stats, msg) {
  const win = kind === 'win';
  $('resTitle').textContent = kind === 'win' ? '防守成功' : kind === 'line' ? '防线失守' : '坦克被击毁';
  const box = $('resBox');
  box.className = 'nine box ' + (win ? 'pz-brown-corners-b' : kind === 'line' ? 'pz-brown-damaged-dark' : 'pz-brown-damaged');
  $('resMsg').className = 'msg nine ' + (win ? 'pz-grey-bolts-green' : 'pz-grey-bolts-detail-b');
  $('resStats').innerHTML = stats.map(([label, val]) => `<div class="stat"><div class="hexnum"${String(val).length > 3 ? ' style="font-size:15px"' : ''}>${val}</div>${label}</div>`).join('');
  $('resMsg').textContent = msg;
  show('result');
  $('rAgain').focus();
}
$('rAgain').onclick = () => {
  show('result', false);
  Game.start(Game.modeKey);
};
$('rGarage').onclick = () => {
  show('result', false);
  App.go('garage');
};
$('rHome').onclick = () => {
  show('result', false);
  App.go('home');
};

// ---------- touch controls ----------
(function touch() {
  const stick = $('stick'), knob = stick.firstElementChild, fire = $('fireBtn');
  let sid = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const m = hypot(dx, dy), max = r.width / 2 - 14;
    if (m > max) {
      dx *= max / m;
      dy *= max / m;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    Input.touchMove.x = dx / max;
    Input.touchMove.y = dy / max;
    Input.touchMove.active = true;
  };
  stick.addEventListener('pointerdown', (e) => {
    sid = e.pointerId;
    stick.setPointerCapture(sid);
    Input.setTouch(true);
    move(e);
  });
  stick.addEventListener('pointermove', (e) => e.pointerId === sid && move(e));
  const end = (e) => {
    if (e.pointerId !== sid) return;
    sid = null;
    knob.style.transform = '';
    Input.touchMove.active = false;
    Input.touchMove.x = Input.touchMove.y = 0;
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  fire.addEventListener('pointerdown', (e) => {
    fire.setPointerCapture(e.pointerId);
    Input.fireBtn = true;
  });
  fire.addEventListener('pointerup', () => (Input.fireBtn = false));
  fire.addEventListener('pointercancel', () => (Input.fireBtn = false));
})();
