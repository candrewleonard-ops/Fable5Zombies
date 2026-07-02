// Item + weapon definitions for UNDEAD BUNKER.
// Weapon stats follow the design handoff table exactly (design/undead_bunker/README.md).
// rpm → fireRate = rpm/60. Limb hits ×0.8 everywhere.

export const WEAPONS = {
  mauser: {
    name: 'Mauser C96', dmg: 40, headMult: 3.0, mag: 10, reserve: 80,
    rpm: 300, auto: false, reload: 2.0, pellets: 1,
    spread: 0.010, adsSpread: 0.003, range: 70, recoil: 0.026, kick: 0.05,
    tracer: 0xffd27f, sound: 'pistol', source: 'start', adsFov: 59,
  },
  kar98: {
    name: 'K-98 Bolt Rifle', dmg: 160, headMult: 4.0, mag: 5, reserve: 50,
    rpm: 46, auto: false, reload: 3.0, pellets: 1, bolt: true,
    spread: 0.006, adsSpread: 0.0012, range: 120, recoil: 0.09, kick: 0.13,
    tracer: 0xffe4a8, sound: 'rifle', source: 'wall', cost: 600, adsFov: 52,
  },
  trench: {
    name: 'M97 Trench Gun', dmg: 26, headMult: 1.5, mag: 6, reserve: 60,
    rpm: 65, auto: false, reload: 3.2, pellets: 8,
    spread: 0.055, adsSpread: 0.04, range: 24, recoil: 0.085, kick: 0.13,
    tracer: 0xffa050, sound: 'shotgun', source: 'wall', cost: 1200, adsFov: 62,
  },
  smg: {
    name: 'M1928 SMG', dmg: 34, headMult: 2.0, mag: 30, reserve: 210,
    rpm: 620, auto: true, reload: 2.6, pellets: 1,
    spread: 0.028, adsSpread: 0.011, range: 45, recoil: 0.015, kick: 0.03,
    tracer: 0x9fff8a, sound: 'smg', source: 'wall', cost: 1750, adsFov: 59,
  },
  mg42: {
    name: 'MG-42', dmg: 42, headMult: 2.0, mag: 75, reserve: 300,
    rpm: 900, auto: true, reload: 4.6, pellets: 1,
    spread: 0.038, adsSpread: 0.02, range: 60, recoil: 0.02, kick: 0.035,
    tracer: 0xffc36a, sound: 'mg', source: 'box', adsFov: 60,
  },
  stg: {
    name: 'STG-44', dmg: 55, headMult: 2.5, mag: 30, reserve: 180,
    rpm: 500, auto: true, reload: 2.8, pellets: 1,
    spread: 0.02, adsSpread: 0.008, range: 70, recoil: 0.02, kick: 0.035,
    tracer: 0xffd27f, sound: 'stg', source: 'box', adsFov: 56,
  },
  laser: {
    name: 'HELIOS-8 Scatter Laser', dmg: 60, headMult: 2.0, mag: 8, reserve: 64,
    rpm: 85, auto: false, reload: 2.8, pellets: 8, beam: true,
    spread: 0.05, adsSpread: 0.035, range: 46, recoil: 0.05, kick: 0.08,
    tracer: 0x35e6ff, sound: 'laser', source: 'box', adsFov: 60,
  },
  arc: {
    name: 'Arc Projector', dmg: 1200, headMult: 1.0, mag: 3, reserve: 18,
    rpm: 90, auto: false, reload: 3.2, pellets: 1,
    projectile: { speed: 26, blast: 4.2, selfDmg: 20, color: 0x86c8ff, gravity: 2.5 },
    spread: 0.004, adsSpread: 0.002, range: 90, recoil: 0.1, kick: 0.16,
    tracer: 0x86c8ff, sound: 'arc', source: 'box', adsFov: 55,
  },
  revolver: {
    name: 'West Revolver', dmg: 180, headMult: 3.0, mag: 5, reserve: 40,
    rpm: 96, auto: false, reload: 2.4, pellets: 1,
    spread: 0.006, adsSpread: 0.001, range: 90, recoil: 0.11, kick: 0.16,
    tracer: 0xff5c5c, sound: 'revolver', source: 'box', adsFov: 50,
  },
  ppsh: {
    name: 'PPSh-41', dmg: 28, headMult: 2.0, mag: 71, reserve: 284,
    rpm: 900, auto: true, reload: 3.0, pellets: 1,
    spread: 0.034, adsSpread: 0.014, range: 42, recoil: 0.013, kick: 0.028,
    tracer: 0xffc36a, sound: 'smg', source: 'box', adsFov: 58,
  },
  raygun: {
    name: 'Ray Gun', dmg: 1000, headMult: 1.0, mag: 20, reserve: 160,
    rpm: 180, auto: false, reload: 3.0, pellets: 1,
    projectile: { speed: 42, blast: 2.4, selfDmg: 12, color: 0x54ff6a, gravity: 0 },
    spread: 0.005, adsSpread: 0.002, range: 100, recoil: 0.05, kick: 0.09,
    tracer: 0x54ff6a, sound: 'raygun', source: 'box', adsFov: 58, stl: '/models/raygun.stl',
  },
};

// Pack-a-Punch transform (design: ×2.5 dmg, ×1.5 mag/reserve ceil, ×0.85 reload)
export function papStats(def) {
  return {
    ...def,
    name: `★ ${def.name}`,
    dmg: def.dmg * 2.5,
    mag: Math.ceil(def.mag * 1.5),
    reserve: Math.ceil(def.reserve * 1.5),
    reload: def.reload * 0.85,
  };
}

export function weaponDef(item) {
  const base = WEAPONS[item.weaponKey];
  return item.pap ? papStats(base) : base;
}

export const BOX_POOL = ['mg42', 'stg', 'laser', 'arc', 'raygun', 'smg', 'trench', 'kar98', 'revolver', 'ppsh'];
export const CRAFT_POOLS = {
  shotgun: ['trench'],
  ar: ['stg', 'smg', 'mg42', 'ppsh'],
  wonder: ['arc', 'laser', 'raygun'],
};

// ---------------- armor (Fable 5 flavor, kept from the graveyard build) ----------------
export const ARMOR_TIERS = {
  1: { label: 'Scrap', color: 0x8a6a42, css: '#b48c5a' },
  2: { label: 'Steel', color: 0x9aa7b4, css: '#aabed2' },
  3: { label: 'Nightforged', color: 0x7a44d0, css: '#aa5aff' },
};
export const ARMOR_POINTS = {
  helmet: { 1: 15, 2: 25, 3: 40 },
  chest:  { 1: 25, 2: 40, 3: 60 },
  legs:   { 1: 20, 2: 30, 3: 45 },
  boots:  { 1: 10, 2: 18, 3: 30 },
};
const ARMOR_ICONS = { helmet: '⛑', chest: '🦺', legs: '👖', boots: '🥾' };

// ---------------- item factories ----------------

export function makeWeaponItem(key, { pap = false } = {}) {
  const def = pap ? papStats(WEAPONS[key]) : WEAPONS[key];
  return {
    id: `weapon_${key}${pap ? '_pap' : ''}`, kind: 'weapon', weaponKey: key, pap,
    name: def.name, icon: '🔫', icon3d: `weapon:${key}${pap ? ':pap' : ''}`,
    stack: 1, count: 1,
    mag: def.mag, reserve: def.reserve,
    desc: `${def.pellets > 1 ? def.pellets + '×' : ''}${def.dmg} dmg • ${def.mag} mag`,
  };
}

export function makeMaterial(key, count = 1) {
  const defs = {
    wood: { name: 'Wood', icon: '🪵', icon3d: 'mat:wood', desc: 'Sturdy planks. Crafting material.' },
    coal: { name: 'Coal', icon: '⚫', icon3d: 'mat:coal', desc: 'Burns hot. Crafting material.' },
  };
  return { id: key, kind: 'material', ...defs[key], stack: 64, count };
}

export function makeTool(key) {
  const defs = {
    buildWall:   { name: 'Wood Wall', icon: '🧱', icon3d: 'build:wall', desc: 'LMB place (50 pts) • RMB remove', build: 'wall' },
    buildFloor:  { name: 'Wood Floor', icon: '🟫', icon3d: 'build:floor', desc: 'LMB place (50 pts) • RMB remove', build: 'floor' },
    buildStairs: { name: 'Wood Stairs', icon: '🪜', icon3d: 'build:stairs', desc: 'LMB place (50 pts) • RMB remove', build: 'stairs' },
    carKeys:     { name: 'Car Keys', icon: '🔑', icon3d: 'tool:keys', desc: 'LMB deploy the Riptide Coupe • F to drive' },
    wand:        { name: 'Magic Wand', icon: '🪄', icon3d: 'tool:wand', desc: 'Channel strange forces. Used in weapon crafting.' },
    bench:       { name: 'Crafting Bench', icon: '🛠', icon3d: 'tool:bench', desc: 'Place with LMB • F to open 3×3 crafting', build: 'bench' },
    anvil:       { name: 'Anvil', icon: '⚒', icon3d: 'tool:anvil', desc: 'Place with LMB • F to forge jet fuel', build: 'anvil' },
    jetpack:     { name: 'Jetpack', icon: '🚀', icon3d: 'tool:jetpack', desc: 'Equips automatically. Hold SPACE to fly.' },
    jetfuel:     { name: 'Jet Fuel', icon: '🛢', icon3d: 'tool:jetfuel', desc: '+50% jetpack fuel. Used on pickup.' },
    raygunPart:  { name: 'Ray Gun Part', icon: '⚙', icon3d: 'tool:raygunPart', desc: 'Dropped by the last blood-moon zombie. Craft 3 into a Ray Gun.' },
  };
  return { id: key, kind: 'tool', ...defs[key], stack: key === 'jetfuel' ? 8 : key === 'raygunPart' ? 3 : 1, count: 1 };
}

export function makeArmorItem(slot, tier) {
  const t = ARMOR_TIERS[tier];
  const pts = ARMOR_POINTS[slot][tier];
  return {
    id: `armor_${slot}_${tier}`, kind: 'armor', armorSlot: slot, tier,
    name: `${t.label} ${slot === 'chest' ? 'Chestplate' : slot[0].toUpperCase() + slot.slice(1)}`,
    icon: ARMOR_ICONS[slot], icon3d: `armor:${slot}:${tier}`, stack: 1, count: 1, rarity: tier,
    armor: pts, remaining: pts,
    desc: `+${pts} armor`,
  };
}

export function cloneItem(item) {
  return item ? { ...item } : null;
}

// ---------------- crafting recipes (shapeless; exact per design) ----------------
// mats: {itemId: count} consumed. result: factory. pool: random weapon pool key.
export const RECIPES = [
  { key: 'bench', name: 'Crafting Bench', grid: '2x2', mats: { wood: 4 }, result: () => makeTool('bench'), desc: '4 wood' },
  { key: 'wand', name: 'Magic Wand', grid: '2x2', mats: { wood: 2, coal: 1 }, result: () => makeTool('wand'), desc: '2 wood + 1 coal' },
  { key: 'randShotgun', name: 'Random Shotgun', grid: '2x2', mats: { wand: 1, wood: 2 }, pool: 'shotgun', fx: 'shotgun', desc: 'wand + 2 wood' },
  { key: 'randAR', name: 'Random Assault Rifle', grid: '2x2', mats: { wand: 1, coal: 2 }, pool: 'ar', fx: 'ar', desc: 'wand + 2 coal' },
  { key: 'randWonder', name: 'Random Wonder Weapon', grid: '2x2', mats: { wand: 1, coal: 3 }, pool: 'wonder', fx: 'wonder', desc: 'wand + 3 coal' },
  { key: 'anvil', name: 'Anvil', grid: '3x3', mats: { wood: 4, coal: 4 }, result: () => makeTool('anvil'), desc: '4 wood + 4 coal' },
  { key: 'jetpack', name: 'Jetpack', grid: '3x3', mats: { wand: 1, wood: 4, coal: 4 }, result: () => makeTool('jetpack'), desc: 'wand + 4 wood + 4 coal' },
  { key: 'raygunCraft', name: 'Ray Gun', grid: '2x2', mats: { raygunPart: 3 }, result: () => makeWeaponItem('raygun'), desc: '3 blood-moon parts' },
  { key: 'jetfuel', name: 'Jet Fuel', grid: 'anvil', mats: { coal: 3 }, result: () => makeTool('jetfuel'), desc: '3 coal' },
];

// ---------------- economy ----------------
export const ECON = {
  startPoints: 500,
  hitPoints: 10,
  killBonus: 50,
  headshotKillBonus: 90,
  boardRepair: 10,
  boxCost: 950,
  papCost: 2500,
  trapCost: 1000,
  buildCost: 50,
  buildRefund: 25,
  doorCosts: [750, 1000, 1250, 1500],
  perks: { // colors per design tokens
    tonic:   { name: 'Tough Tonic', cost: 2500, color: 0x9e1b1b, badge: 'T', desc: '+150 max HP' },
    rapid:   { name: 'Rapid Rounds', cost: 3000, color: 0xb08414, badge: 'R', desc: 'Reload ×0.55 • RPM ×1.12' },
    fleet:   { name: 'Fleet Foot', cost: 2000, color: 0x1c5d8a, badge: 'F', desc: 'Speed ×1.17' },
    deadeye: { name: 'Deadeye', cost: 2500, color: 0x5b2a7a, badge: 'D', desc: 'Damage ×1.4' },
  },
};

// Rounds (design formulas, verbatim)
export const ROUND = {
  count: (r) => Math.min(45, Math.round(5 + r * 4.2)),
  hp: (r) => (r <= 9 ? 60 + r * 45 : (60 + 9 * 45) * Math.pow(1.08, r - 9)),
  sprinterChance: (r) => Math.min(0.55, Math.max(0, (r - 3) * 0.09)),
  aliveCap: (r) => Math.min(12, 6 + r),
  spawnInterval: (r) => Math.max(0.8, 2.4 - r * 0.12),
  intermission: 8,
  zombieHitDmg: 22,
};
