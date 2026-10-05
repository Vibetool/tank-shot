// ---------- tank parts ----------
// World units are retina pixels (the Kenney "Retina" folder, 2x the default size). Tile = 128.
// Sprites face down (+y) at rotation 0, so a hull with heading h is drawn at rotation h - 90deg.
// Mount offsets are measured from the factory composites (tank_*.png): x = sprite right, y = towards the nose.
const HULLS = {
  green: { name: '丛林', color: 'Green', body: 'tankBody_green', comp: 'tank_green', hp: 110, speed: 185, turn: 2.8, r: 35, trackW: 8, tracks: 'tracksSmall', mounts: [[0, 0]] },
  sand: { name: '沙暴', color: 'Sand', body: 'tankBody_sand', comp: 'tank_sand', hp: 120, speed: 175, turn: 2.7, r: 35, trackW: 12, tracks: 'tracksSmall', mounts: [[0, 0]] },
  red: { name: '赤焰', color: 'Red', body: 'tankBody_red', comp: 'tank_red', hp: 95, speed: 210, turn: 3.1, r: 33, trackW: 8, tracks: 'tracksSmall', mounts: [[0, 0]] },
  blue: { name: '海军', color: 'Blue', body: 'tankBody_blue', comp: 'tank_blue', hp: 130, speed: 165, turn: 2.6, r: 36, trackW: 8, tracks: 'tracksSmall', mounts: [[0, 0]] },
  dark: { name: '暗影', color: 'Dark', body: 'tankBody_dark', comp: 'tank_dark', hp: 150, speed: 150, turn: 2.4, r: 35, trackW: 12, tracks: 'tracksSmall', mounts: [[0, 0]] },
  bigRed: { name: '红魔重坦', color: 'Red', large: true, body: 'tankBody_bigRed', comp: 'tank_bigRed', hp: 230, speed: 128, turn: 2.0, r: 44, trackW: 12, tracks: 'tracksLarge', mounts: [[-20, -9], [20, -9]] },
  darkLarge: { name: '钢铁堡垒', color: 'Dark', large: true, body: 'tankBody_darkLarge', comp: 'tank_darkLarge', hp: 270, speed: 118, turn: 1.85, r: 48, trackW: 16, tracks: 'tracksLarge', mounts: [[-20, -17, 1], [20, -17]] },
  huge: { name: '巨像', color: 'Dark', large: true, body: 'tankBody_huge', comp: 'tank_huge', hp: 360, speed: 102, turn: 1.6, r: 57, trackW: 20, tracks: 'tracksDouble', mounts: [[0, -35], [-20, 31, 1], [20, 31]] },
};
const HULL_ORDER = ['green', 'sand', 'red', 'blue', 'dark', 'bigRed', 'darkLarge', 'huge'];

const COLORS = { Sand: '沙色', Green: '绿色', Red: '红色', Blue: '蓝色', Dark: '黑色' };
const COLOR_KEYS = { Sand: 's', Green: 'g', Red: 'r', Blue: 'b', Dark: 'd' };
const BARRELS = {};
const BARREL_ORDER = [];
(function buildBarrels() {
  // regular barrels: wide muzzle (1), thin quick-fire (2), long (3)
  const TYPES = {
    1: { name: '重炮', bullet: 2, flash: 'shotLarge', dmg: 34, speed: 640, reload: 0.95, range: 950, w: 24 },
    2: { name: '速射炮', bullet: 1, flash: 'shotThin', dmg: 12, speed: 930, reload: 0.3, range: 820, spread: 0.04, w: 16 },
    3: { name: '长管炮', bullet: 3, flash: 'shotOrange', dmg: 22, speed: 1150, reload: 0.6, range: 1150, w: 16 },
  };
  for (const col of Object.keys(COLORS)) {
    for (const t of [1, 2, 3]) {
      const T = TYPES[t];
      const id = COLOR_KEYS[col] + t;
      BARRELS[id] = {
        id, kind: 'regular', color: col, type: t,
        name: COLORS[col] + T.name,
        sprite: `tank${col}_barrel${t}`,
        pivot: [T.w / 2, 4], len: 52,
        bullet: `bullet${col}${T.bullet}`, flash: T.flash,
        dmg: T.dmg, speed: T.speed, reload: T.reload, range: T.range, spread: T.spread || 0.015,
        pellets: 1, burst: 1, splash: 0, pierce: 0,
      };
      BARREL_ORDER.push(id);
    }
  }
  // black-and-red special barrels: only large hulls may carry them (except in 超爽模式)
  const SP = [
    { name: '火箭炮', w: 28, h: 44, pivot: [14, 11], bullet: 'bulletRed2', flash: 'shotRed', dmg: 30, speed: 600, reload: 1.05, range: 980, splash: 78, desc: '命中后爆炸，波及周围。' },
    { name: '霰弹炮', w: 24, h: 48, pivot: [12, 11], bullet: 'bulletRed1', flash: 'shotOrange', dmg: 9, speed: 860, reload: 0.95, range: 560, pellets: 5, spread: 0.2, desc: '一次喷出 5 发弹丸，近距离威力大。' },
    { name: '狙击炮', w: 20, h: 56, pivot: [10, 9], bullet: 'bulletDark3', flash: 'shotThin', dmg: 58, speed: 1600, reload: 1.55, range: 1700, desc: '弹速极快，射程覆盖整张地图。' },
    { name: '穿甲炮', w: 20, h: 64, pivot: [10, 19], bullet: 'bulletRed3', flash: 'shotLarge', dmg: 40, speed: 1250, reload: 1.2, range: 1300, pierce: 3, desc: '炮弹可连续贯穿 3 辆坦克。' },
    { name: '榴弹炮', w: 24, h: 52, pivot: [12, 4], bullet: 'bulletDark2', flash: 'shotRed', dmg: 44, speed: 520, reload: 1.7, range: 900, splash: 120, desc: '大范围爆炸，可清除障碍。' },
    { name: '机关炮', w: 16, h: 52, pivot: [8, 4], bullet: 'bulletDark1', flash: 'shotThin', dmg: 8, speed: 1050, reload: 0.11, range: 820, spread: 0.07, desc: '射速极高，持续压制。' },
    { name: '连射炮', w: 16, h: 52, pivot: [8, 4], bullet: 'bulletRed1', flash: 'shotOrange', dmg: 15, speed: 1000, reload: 0.85, range: 950, burst: 3, desc: '每次扣动扳机连射 3 发。' },
  ];
  SP.forEach((s, i) => {
    const id = 'x' + (i + 1);
    BARRELS[id] = {
      id, kind: 'special', name: s.name, desc: s.desc,
      sprite: 'specialBarrel' + (i + 1),
      pivot: s.pivot, len: s.h,
      bullet: s.bullet, flash: s.flash, dmg: s.dmg, speed: s.speed, reload: s.reload, range: s.range,
      spread: s.spread || 0.012, splash: s.splash || 0, pierce: s.pierce || 0, pellets: s.pellets || 1, burst: s.burst || 1,
    };
    BARREL_ORDER.push(id);
  });
})();

// the factory composites (tank_*.png) double as presets
const PRESETS = [
  { comp: 'tank_green', hull: 'green', guns: ['g3'] },
  { comp: 'tank_sand', hull: 'sand', guns: ['s2'] },
  { comp: 'tank_red', hull: 'red', guns: ['r1'] },
  { comp: 'tank_blue', hull: 'blue', guns: ['b2'] },
  { comp: 'tank_dark', hull: 'dark', guns: ['d2'] },
  { comp: 'tank_bigRed', hull: 'bigRed', guns: ['x1', 'x1'] },
  { comp: 'tank_darkLarge', hull: 'darkLarge', guns: ['x4', 'x4'] },
  { comp: 'tank_huge', hull: 'huge', guns: ['x1', 'x4', 'x4'] },
];
const DEFAULT_LOADOUT = { hull: 'green', guns: ['g3'] };

function normLoadout(lo) {
  const hull = HULLS[lo && lo.hull] ? lo.hull : 'green';
  const n = HULLS[hull].mounts.length;
  const guns = [];
  for (let i = 0; i < n; i++) {
    const g = lo && lo.guns && lo.guns[i];
    guns.push(BARRELS[g] ? g : (lo && lo.guns && BARRELS[lo.guns[0]] ? lo.guns[0] : 'g3'));
  }
  return { hull, guns };
}

// standard rules (普通战场 / 防守): black-and-red barrels only on the large hulls
function loadoutProblems(lo) {
  const h = HULLS[lo.hull];
  const bad = [];
  lo.guns.forEach((g, i) => {
    if (BARRELS[g].kind === 'special' && !h.large) bad.push(i);
  });
  return bad;
}
function fixLoadout(lo) {
  const h = HULLS[lo.hull];
  const fallback = COLOR_KEYS[h.color] + '1';
  return { hull: lo.hull, guns: lo.guns.map((g) => (BARRELS[g].kind === 'special' && !h.large ? fallback : g)) };
}

function loadoutStats(lo) {
  const h = HULLS[lo.hull];
  let dps = 0, rate = 0;
  for (const g of lo.guns) {
    const b = BARRELS[g];
    const shots = b.pellets * b.burst;
    dps += (b.dmg * shots * (1 + (b.splash ? 0.4 : 0)) * (1 + (b.pierce ? 0.3 : 0))) / b.reload;
    rate += shots / b.reload;
  }
  return { hp: h.hp, speed: h.speed, dps, rate };
}

const MODES = {
  fun: { name: '超爽模式', map: 'main', enemyFire: false, free: true },
  battle: { name: '普通战场', map: 'main', enemyFire: true, cooldown: 3 },
  defense: { name: '防守', map: 'defense', enemyFire: true, cooldown: 3, waves: 10 },
};

// main map spawn-time loadouts come straight from the sample image's tanks
const SAMPLE_VIEW = { w: 1836, h: 1030 }; // Sample.png at 2x
