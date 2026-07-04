// Item + weapon definitions for UNDEAD BUNKER.
// Weapon stats follow the design handoff table (design/undead_bunker/README.md),
// with live-balance changes on top. rpm → fireRate = rpm/60. Limb hits ×0.8.

// Borderlands-style rarity grades (item cards + name colors)
export const GRADES = {
  common:    { name: 'Common',    css: '#e8e8e8', glow: 0xdedede },
  uncommon:  { name: 'Uncommon',  css: '#4fe04f', glow: 0x3fd23f },
  rare:      { name: 'Rare',      css: '#4f8fff', glow: 0x3f7fff },
  epic:      { name: 'Epic',      css: '#c45aff', glow: 0xb04aff },
  legendary: { name: 'Legendary', css: '#ffa22b', glow: 0xff9a1f },
};

export const WEAPONS = {
  mauser: {
    name: 'Mauser C96', dmg: 40, headMult: 3.0, mag: 10, reserve: 80,
    rpm: 300, auto: false, reload: 2.0, pellets: 1,
    spread: 0.010, adsSpread: 0.003, range: 70, recoil: 0.026, kick: 0.05,
    tracer: 0xffd27f, sound: 'pistol', source: 'start', adsFov: 59,
    grade: 'common', price: 500,
    // PaP: mini flamethrower pistol (CoD WaW style — 8s of heat, instant recharge)
    papInto: {
      name: 'Dragonspit', auto: true,
      flame: { maxHeat: 8, dps: 240, range: 8.5, slow: 0 },
      desc2: 'Unlimited fuel. Overheats after 8s of continuous fire.',
    },
  },
  kar98: {
    name: 'K-98 Bolt Rifle', dmg: 160, headMult: 4.0, mag: 5, reserve: 50,
    rpm: 46, auto: false, reload: 3.0, pellets: 1, bolt: true,
    spread: 0.006, adsSpread: 0.0012, range: 120, recoil: 0.09, kick: 0.13,
    tracer: 0xffe4a8, sound: 'rifle', source: 'wall', cost: 600, adsFov: 52,
    grade: 'common', price: 600,
  },
  trench: {
    name: 'M97 Trench Gun', dmg: 26, headMult: 1.5, mag: 6, reserve: 60,
    rpm: 65, auto: false, reload: 3.2, pellets: 8,
    spread: 0.055, adsSpread: 0.04, range: 24, recoil: 0.085, kick: 0.13,
    tracer: 0xffa050, sound: 'shotgun', source: 'wall', cost: 1200, adsFov: 62,
    grade: 'uncommon', price: 1200,
  },
  smg: {
    name: 'M1928 SMG', dmg: 34, headMult: 2.0, mag: 30, reserve: 210,
    rpm: 620, auto: true, reload: 2.6, pellets: 1,
    spread: 0.028, adsSpread: 0.011, range: 45, recoil: 0.015, kick: 0.03,
    tracer: 0x9fff8a, sound: 'smg', source: 'wall', cost: 1750, adsFov: 59,
    grade: 'uncommon', price: 1750,
  },
  mg42: {
    name: 'MG-42', dmg: 42, headMult: 2.0, mag: 75, reserve: 300,
    rpm: 900, auto: true, reload: 4.6, pellets: 1,
    spread: 0.038, adsSpread: 0.02, range: 60, recoil: 0.02, kick: 0.035,
    tracer: 0xffc36a, sound: 'mg', source: 'box', adsFov: 60,
    grade: 'uncommon', price: 3200,
  },
  stg: {
    name: 'STG-44', dmg: 55, headMult: 2.5, mag: 30, reserve: 180,
    rpm: 500, auto: true, reload: 2.8, pellets: 1,
    spread: 0.02, adsSpread: 0.008, range: 70, recoil: 0.02, kick: 0.035,
    tracer: 0xffd27f, sound: 'stg', source: 'box', adsFov: 56,
    grade: 'uncommon', price: 3000,
  },
  ppsh: {
    name: 'PPSh-41', dmg: 28, headMult: 2.0, mag: 71, reserve: 284,
    rpm: 900, auto: true, reload: 3.0, pellets: 1,
    spread: 0.034, adsSpread: 0.014, range: 42, recoil: 0.013, kick: 0.028,
    tracer: 0xffc36a, sound: 'smg', source: 'box', adsFov: 58,
    grade: 'uncommon', price: 2800,
  },
  rpg: {
    name: 'M9A1 Bazooka', dmg: 900, headMult: 1.0, mag: 1, reserve: 10,
    rpm: 30, auto: false, reload: 4.0, pellets: 1,
    projectile: { speed: 26, blast: 5.2, selfDmg: 40, color: 0xffb347, gravity: 1.4, missile: true },
    spread: 0.004, adsSpread: 0.002, range: 130, recoil: 0.12, kick: 0.2,
    tracer: 0xffb347, sound: 'arc', source: 'box', adsFov: 58,
    grade: 'rare', price: 20000,
    // PaP: press F while the rocket flies to take control of it (CoD-style)
    papInto: {
      name: 'Guided Fury', guided: true,
      desc2: 'Press F while the missile is in flight to pilot it.',
    },
  },
  revolver: {
    name: 'West Revolver', dmg: 180, headMult: 3.0, mag: 5, reserve: 40,
    rpm: 96, auto: false, reload: 2.4, pellets: 1,
    spread: 0.006, adsSpread: 0.001, range: 90, recoil: 0.11, kick: 0.16,
    tracer: 0xff5c5c, sound: 'revolver', source: 'box', adsFov: 50,
    grade: 'epic', price: 12000,
    // PaP: blasts the victim backwards; zombies caught behind lose 50% max HP
    papInto: {
      name: 'The Blaster', blastback: { knock: 14, corridor: 1.6, range: 12 },
      desc2: 'Targets are blasted backward. Zombies behind them lose 50% max HP.',
    },
  },
  laser: {
    name: 'HELIOS-8 Scatter Laser', dmg: 60, headMult: 2.0, mag: 8, reserve: 64,
    rpm: 85, auto: false, reload: 2.8, pellets: 8, beam: true,
    spread: 0.05, adsSpread: 0.035, range: 46, recoil: 0.05, kick: 0.08,
    tracer: 0x35e6ff, sound: 'laser', source: 'box', adsFov: 60,
    grade: 'legendary', price: 250000,
  },
  arc: {
    name: 'Arc Projector', dmg: 800, headMult: 1.0, mag: 3, reserve: 18,
    rpm: 90, auto: false, reload: 3.2, pellets: 1,
    projectile: { speed: 26, blast: 4.2, selfDmg: 20, color: 0x86c8ff, gravity: 2.5 },
    spread: 0.004, adsSpread: 0.002, range: 90, recoil: 0.1, kick: 0.16,
    tracer: 0x86c8ff, sound: 'arc', source: 'box', adsFov: 55,
    grade: 'legendary', price: 250000,
  },
  raygun: {
    name: 'Ray Gun', dmg: 400, headMult: 1.0, mag: 20, reserve: 160,
    rpm: 180, auto: false, reload: 3.0, pellets: 1,
    projectile: { speed: 42, blast: 2.4, selfDmg: 12, color: 0x54ff6a, gravity: 0 },
    spread: 0.005, adsSpread: 0.002, range: 100, recoil: 0.05, kick: 0.09,
    tracer: 0x54ff6a, sound: 'raygun', source: 'box', adsFov: 58, stl: '/models/raygun.stl',
    grade: 'legendary', price: 250000,
  },
  // ------- craft-only legendaries (recipes; gun store also stocks them) -------
  wavegun: {
    name: 'W.A.V.E. Cannon', dmg: 650, headMult: 1.0, mag: 6, reserve: 30,
    rpm: 45, auto: false, reload: 3.4, pellets: 1,
    wave: { range: 18, halfAngle: 0.55, knock: 7 },
    spread: 0.002, adsSpread: 0.001, range: 18, recoil: 0.14, kick: 0.22,
    tracer: 0xbfe8ff, sound: 'wave', source: 'craft', adsFov: 62,
    grade: 'legendary', price: 250000, craftOnly: true,
    desc2: 'Fires a visible pressure wave that bends the air and hurls the horde.',
  },
  tempest: {
    name: 'Tempest Coil', dmg: 420, headMult: 1.5, mag: 12, reserve: 72,
    rpm: 130, auto: false, reload: 2.9, pellets: 1,
    chain: { jumps: 5, radius: 7, falloff: 0.8 },
    spread: 0.006, adsSpread: 0.002, range: 70, recoil: 0.06, kick: 0.1,
    tracer: 0x86c8ff, sound: 'arc', source: 'craft', adsFov: 57,
    grade: 'legendary', price: 250000, craftOnly: true,
    desc2: 'Lightning arcs to up to 5 nearby zombies.',
  },
  hellfire: {
    name: 'Hellfire-12', dmg: 40, headMult: 1.5, mag: 8, reserve: 64,
    rpm: 80, auto: false, reload: 3.4, pellets: 9, burn: { dps: 55, dur: 3 },
    spread: 0.05, adsSpread: 0.035, range: 26, recoil: 0.09, kick: 0.14,
    tracer: 0xff7a1a, sound: 'shotgun', source: 'craft', adsFov: 62,
    grade: 'legendary', price: 250000, craftOnly: true,
    desc2: 'Dragon’s-breath shells set zombies ablaze.',
  },
};

// Pack-a-Punch transform (design: ×2.5 dmg, ×1.5 mag/reserve ceil, ×0.85 reload)
// + per-weapon papInto overrides (Dragonspit / The Blaster / Guided Fury).
export function papStats(def) {
  const over = def.papInto || {};
  return {
    ...def,
    name: over.name ? `★ ${over.name}` : `★ ${def.name}`,
    dmg: def.dmg * 2.5,
    mag: Math.ceil(def.mag * 1.5),
    reserve: Math.ceil(def.reserve * 1.5),
    reload: def.reload * 0.85,
    ...over,
    name: over.name ? `★ ${over.name}` : `★ ${def.name}`,
  };
}

// Final runtime stats for an item: base → PaP → fusion (custom) → nuclear → enchants.
export function weaponDef(item) {
  let d = WEAPONS[item.weaponKey];
  if (item.pap) d = papStats(d);
  if (item.custom) d = { ...d, ...item.custom };
  if (item.nuclear) {
    d = { ...d, name: `☢ ${d.name}`, dmg: d.dmg * 1.25, nuclear: true };
  }
  if (item.ench?.length) {
    let dl = 0, sl = 0;
    for (const e of item.ench) {
      if (e.key === 'damage') dl = e.lvl;
      if (e.key === 'speed') sl = e.lvl;
    }
    if (dl || sl) {
      d = {
        ...d,
        dmg: d.dmg * (1 + 0.09 * dl),
        rpm: d.rpm * (1 + 0.07 * sl),
        reload: d.reload * (1 - 0.07 * sl),
      };
    }
  }
  return d;
}

export const BOX_POOL = ['mg42', 'stg', 'laser', 'arc', 'raygun', 'smg', 'trench', 'kar98', 'revolver', 'ppsh', 'rpg'];
export const CRAFT_POOLS = {
  shotgun: ['trench'],
  ar: ['stg', 'smg', 'mg42', 'ppsh'],
  wonder: ['arc', 'laser', 'raygun'],
};

// ---------------- armor (Fable 5 flavor) ----------------
export const ARMOR_TIERS = {
  1: { label: 'Scrap', color: 0x8a6a42, css: '#b48c5a' },
  2: { label: 'Steel', color: 0x9aa7b4, css: '#aabed2' },
  3: { label: 'Nightforged', color: 0x7a44d0, css: '#aa5aff' },
};
// endurance ×15 — armor used to shred in seconds
export const ARMOR_POINTS = {
  helmet: { 1: 225, 2: 375, 3: 600 },
  chest:  { 1: 375, 2: 600, 3: 900 },
  legs:   { 1: 300, 2: 450, 3: 675 },
  boots:  { 1: 150, 2: 270, 3: 450 },
};
const ARMOR_ICONS = { helmet: '⛑', chest: '🦺', legs: '👖', boots: '🥾' };

// ---------------- item factories ----------------

export function makeWeaponItem(key, { pap = false } = {}) {
  const def = pap ? papStats(WEAPONS[key]) : WEAPONS[key];
  return {
    id: `weapon_${key}${pap ? '_pap' : ''}`, kind: 'weapon', weaponKey: key, pap,
    name: def.name, icon: '🔫', icon3d: `weapon:${key}${pap ? ':pap' : ''}`,
    stack: 1, count: 1, grade: WEAPONS[key].grade,
    mag: def.flame ? 1 : def.mag, reserve: def.flame ? 0 : def.reserve,
    desc: `${def.pellets > 1 ? def.pellets + '×' : ''}${Math.round(def.dmg)} dmg • ${def.mag} mag`,
  };
}

export const MATERIALS = {
  wood:    { name: 'Wood', icon: '🪵', icon3d: 'mat:wood', desc: 'Sturdy planks. Crafting + building material.' },
  coal:    { name: 'Coal', icon: '⚫', icon3d: 'mat:coal', desc: 'Burns hot. Crafting material.' },
  steel:   { name: 'Steel', icon: '🔩', desc: 'Refined from iron ore in the mines. Forging material.' },
  flint:   { name: 'Flint', icon: '🪨', desc: 'Sharp mineral from the mines. Mixes into rubber.' },
  rock:    { name: 'Rock Block', icon: '🧱', desc: 'Mined stone. LMB place as a block • 75% knife damage held.', build: 'block' },
  granite: { name: 'Granite Block', icon: '⬛', desc: 'Polished stone. LMB place • countertop material.', build: 'gblock' },
  diamond: { name: 'Diamond', icon: '💎', desc: 'Rare gem. Quests, deep chests and high crafting.' },
  beef:    { name: 'Raw Beef', icon: '🥩', desc: 'From cattle. 2 beef make a sandwich.' },
  leather: { name: 'Leather', icon: '🟤', desc: 'From cattle. Armor tints and forging.' },
  rubber:  { name: 'Rubber', icon: '⚫', desc: 'Flint + rock, vulcanized. Wheels need it.' },
  wheel:   { name: 'Wheel', icon: '🛞', desc: 'A performance wheel. The Lambo needs 4.' },
  nuclearBrick: { name: 'Nuclear Brick', icon: '🟩', desc: 'Dense irradiated alloy from the Research Facility abomination.' },
};

export function makeMaterial(key, count = 1) {
  const d = MATERIALS[key];
  return { id: key, kind: 'material', ...d, stack: 64, count };
}

export const TOOL_DEFS = {
  buildWall:   { name: 'Wood Wall', icon: '🧱', icon3d: 'build:wall', desc: 'LMB place (2 wood) • RMB remove', build: 'wall' },
  buildFloor:  { name: 'Wood Floor', icon: '🟫', icon3d: 'build:floor', desc: 'LMB place (2 wood) • RMB remove', build: 'floor' },
  buildStairs: { name: 'Wood Stairs', icon: '🪜', icon3d: 'build:stairs', desc: 'LMB place (3 wood) • RMB remove', build: 'stairs' },
  carKeys:     { name: 'Car Keys', icon: '🔑', icon3d: 'tool:keys', desc: 'LMB deploy the Riptide Coupe • F to drive' },
  lamboKeys:   { name: 'Lambo Keys', icon: '🗝', desc: 'LMB deploy the Ravager LX. Very fast. Very yellow.' },
  wand:        { name: 'Magic Wand', icon: '🪄', icon3d: 'tool:wand', desc: 'Channel strange forces. Used in weapon crafting.' },
  bench:       { name: 'Crafting Bench', icon: '🛠', icon3d: 'tool:bench', desc: 'Place with LMB • F to open 3×3 crafting', build: 'bench' },
  anvil:       { name: 'Anvil', icon: '⚒', icon3d: 'tool:anvil', desc: 'Place with LMB • F to forge + enchant', build: 'anvil' },
  jetpack:     { name: 'Jetpack', icon: '🚀', icon3d: 'tool:jetpack', desc: 'Equips automatically. Hold SPACE to fly.' },
  jetfuel:     { name: 'Jet Fuel', icon: '🛢', icon3d: 'tool:jetfuel', desc: '+50% jetpack fuel. Used on pickup.' },
  raygunPart:  { name: 'Ray Gun Part', icon: '⚙', icon3d: 'tool:raygunPart', desc: 'Dropped by the last blood-moon zombie. Craft 3 into a Ray Gun.' },
  pickaxe:     { name: 'Pickaxe-Axe', icon: '⛏', desc: 'One blade, two jobs. Chops trees, mines ore, splits skulls (+130 pts).' },
  sandwich:    { name: 'Sandwich', icon: '🥪', desc: 'LMB to eat. Restores 80 health.' },
  cabinet:     { name: 'Kitchen Cabinet', icon: '🗄', desc: 'LMB place. Home sweet bunker.', build: 'cabinet' },
  countertop:  { name: 'Granite Countertop', icon: '▬', desc: 'LMB place on a cabinet.', build: 'countertop' },
  lamboKit:    { name: 'Lambo Body Kit', icon: '🏎', desc: 'Torn off the Abomination. The chassis of a dream.' },
  lamboEngine: { name: 'Lambo Engine', icon: '⚙', desc: 'V12. Forged from steel and diamonds.' },
  gucciTint:   { name: 'Gucci Armor Tint', icon: '🟢', desc: 'RMB on equipped armor: +25% points. Full set: +15% speed, +25% more points.', tint: 'gucci' },
  onyxTint:    { name: 'Onyx Armor Tint', icon: '⬛', desc: 'RMB on equipped armor: +5% speed per tinted piece.', tint: 'onyx' },
  gildedTint:  { name: 'Gilded Armor Tint', icon: '🟨', desc: 'RMB on equipped armor: +10% points per tinted piece.', tint: 'gilded' },
  rotorBlades: { name: 'Rotor Blades', icon: '🌀', desc: 'Helicopter rotors. Someone buried them deep.' },
  heliEngine:  { name: 'Turboshaft Engine', icon: '🔧', desc: 'Helicopter engine, anvil-forged.' },
  fuelTank:    { name: 'Sealed Fuel Tank', icon: '🛢', desc: 'Aviation fuel. Handle far from campfires.' },
  avionics:    { name: 'Avionics Suite', icon: '📡', desc: 'Flight computer from the Research Facility.' },
  wifiRadio:   { name: 'Wifi Radio', icon: '📻', desc: 'LMB place: desk, laptop, boombox + tower. F to browse.', build: 'radio' },
  nuclearTable:{ name: 'Nuclear Crafting Table', icon: '☢', desc: 'LMB place • F to irradiate weapons (+25% dmg, toxic trail).', build: 'nucleartable' },
};

export function makeTool(key) {
  const stackFor = { jetfuel: 8, raygunPart: 3, sandwich: 8, nuclearBrick: 16, gucciTint: 4, onyxTint: 4, gildedTint: 4 };
  return { id: key, kind: 'tool', ...TOOL_DEFS[key], stack: stackFor[key] || 1, count: 1 };
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

// ---------------- crafting recipes (shapeless) ----------------
export const RECIPES = [
  { key: 'bench', name: 'Crafting Bench', grid: '2x2', mats: { wood: 4 }, result: () => makeTool('bench'), desc: '4 wood' },
  { key: 'wand', name: 'Magic Wand', grid: '2x2', mats: { wood: 2, coal: 1 }, result: () => makeTool('wand'), desc: '2 wood + 1 coal' },
  { key: 'sandwich', name: 'Sandwich', grid: '2x2', mats: { beef: 2 }, result: () => makeTool('sandwich'), desc: '2 raw beef' },
  { key: 'rubber', name: 'Rubber ×2', grid: '2x2', mats: { flint: 1, rock: 1 }, result: () => makeMaterial('rubber', 2), desc: '1 flint + 1 rock' },
  { key: 'randShotgun', name: 'Random Shotgun', grid: '2x2', mats: { wand: 1, wood: 2 }, pool: 'shotgun', fx: 'shotgun', desc: 'wand + 2 wood' },
  { key: 'randAR', name: 'Random Assault Rifle', grid: '2x2', mats: { wand: 1, coal: 2 }, pool: 'ar', fx: 'ar', desc: 'wand + 2 coal' },
  { key: 'randWonder', name: 'Random Wonder Weapon', grid: '2x2', mats: { wand: 1, coal: 3 }, pool: 'wonder', fx: 'wonder', desc: 'wand + 3 coal' },
  { key: 'raygunCraft', name: 'Ray Gun', grid: '2x2', mats: { raygunPart: 3 }, result: () => makeWeaponItem('raygun'), desc: '3 blood-moon parts' },
  { key: 'anvil', name: 'Anvil', grid: '3x3', mats: { wood: 4, coal: 4 }, result: () => makeTool('anvil'), desc: '4 wood + 4 coal' },
  { key: 'jetpack', name: 'Jetpack', grid: '3x3', mats: { wand: 1, wood: 4, coal: 4 }, result: () => makeTool('jetpack'), desc: 'wand + 4 wood + 4 coal' },
  { key: 'cabinet', name: 'Kitchen Cabinet', grid: '3x3', mats: { wood: 4 }, result: () => makeTool('cabinet'), desc: '4 wood' },
  { key: 'countertop', name: 'Granite Countertop', grid: '3x3', mats: { granite: 2 }, result: () => makeTool('countertop'), desc: '2 granite' },
  { key: 'gucciTint', name: 'Gucci Armor Tint', grid: '3x3', mats: { leather: 2, diamond: 1 }, result: () => makeTool('gucciTint'), desc: '2 leather + 1 diamond' },
  { key: 'onyxTint', name: 'Onyx Armor Tint', grid: '3x3', mats: { leather: 2, coal: 2 }, result: () => makeTool('onyxTint'), desc: '2 leather + 2 coal' },
  { key: 'gildedTint', name: 'Gilded Armor Tint', grid: '3x3', mats: { leather: 2, steel: 2 }, result: () => makeTool('gildedTint'), desc: '2 leather + 2 steel' },
  // ---- craft-only legendary weapons ----
  { key: 'wavegun', name: 'W.A.V.E. Cannon', grid: '3x3', mats: { steel: 6, diamond: 2, wand: 1 }, result: () => makeWeaponItem('wavegun'), desc: '6 steel + 2 diamond + wand' },
  { key: 'tempest', name: 'Tempest Coil', grid: '3x3', mats: { steel: 4, diamond: 3, coal: 2 }, result: () => makeWeaponItem('tempest'), desc: '4 steel + 3 diamond + 2 coal' },
  { key: 'hellfire', name: 'Hellfire-12', grid: '3x3', mats: { steel: 4, diamond: 1, coal: 3 }, result: () => makeWeaponItem('hellfire'), desc: '4 steel + 1 diamond + 3 coal' },
  // ---- anvil forging ----
  { key: 'jetfuel', name: 'Jet Fuel', grid: 'anvil', mats: { coal: 3 }, result: () => makeTool('jetfuel'), desc: '3 coal' },
  { key: 'wheel', name: 'Wheel', grid: 'anvil', mats: { rubber: 2, steel: 1 }, result: () => makeMaterial('wheel', 1), desc: '2 rubber + 1 steel' },
  { key: 'lamboEngine', name: 'Lambo Engine', grid: 'anvil', mats: { steel: 6, diamond: 2 }, result: () => makeTool('lamboEngine'), desc: '6 steel + 2 diamond' },
  { key: 'lambo', name: 'Ravager LX (Lambo)', grid: 'anvil', mats: { lamboKit: 1, lamboEngine: 1, wheel: 4, granite: 4 }, result: () => makeTool('lamboKeys'), desc: 'body kit + engine + 4 wheels + 4 granite' },
  { key: 'heliEngine', name: 'Turboshaft Engine', grid: 'anvil', mats: { steel: 8, diamond: 2 }, result: () => makeTool('heliEngine'), desc: '8 steel + 2 diamond' },
  { key: 'fuelTank', name: 'Sealed Fuel Tank', grid: 'anvil', mats: { steel: 4, jetfuel: 2 }, result: () => makeTool('fuelTank'), desc: '4 steel + 2 jet fuel' },
  { key: 'armor3helm', name: 'Nightforged Helmet', grid: 'anvil', mats: { steel: 3, diamond: 1, leather: 2 }, result: () => makeArmorItem('helmet', 3), desc: '3 steel + 1 diamond + 2 leather' },
  { key: 'armor3chest', name: 'Nightforged Chestplate', grid: 'anvil', mats: { steel: 5, diamond: 2, leather: 2 }, result: () => makeArmorItem('chest', 3), desc: '5 steel + 2 diamond + 2 leather' },
  { key: 'armor3legs', name: 'Nightforged Legs', grid: 'anvil', mats: { steel: 4, diamond: 1, leather: 2 }, result: () => makeArmorItem('legs', 3), desc: '4 steel + 1 diamond + 2 leather' },
  { key: 'armor3boots', name: 'Nightforged Boots', grid: 'anvil', mats: { steel: 2, diamond: 1, leather: 1 }, result: () => makeArmorItem('boots', 3), desc: '2 steel + 1 diamond + 1 leather' },
  { key: 'nuclearTable', name: 'Nuclear Crafting Table', grid: 'anvil', mats: { nuclearBrick: 6, steel: 2 }, result: () => makeTool('nuclearTable'), desc: '6 nuclear bricks + 2 steel' },
];

// build placement material costs (fortnite builds take blocks, not points)
export const BUILD_MATS = {
  wall: { wood: 2 },
  floor: { wood: 2 },
  stairs: { wood: 3 },
  block: { rock: 1 },
  gblock: { granite: 1 },
};

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
  powerCost: 1000,
  buildRefund: 1, // wood returned on remove
  doorCosts: [750, 1000, 1250, 1500],
  fundOfficeCost: 2500,
  lamboPrice: 1000000,
  sellRatio: 0.8,
  perks: { // colors per design tokens
    tonic:   { name: 'Tough Tonic', cost: 2500, color: 0x9e1b1b, badge: 'T', desc: '+150 max HP' },
    rapid:   { name: 'Rapid Rounds', cost: 3000, color: 0xb08414, badge: 'R', desc: 'Reload ×0.55 • RPM ×1.12' },
    fleet:   { name: 'Fleet Foot', cost: 2000, color: 0x1c5d8a, badge: 'F', desc: 'Speed ×1.17' },
    deadeye: { name: 'Deadeye', cost: 2500, color: 0x5b2a7a, badge: 'D', desc: 'Damage ×1.4' },
    revive:  { name: 'Quick Revive', cost: 500, color: 0x3a7cc8, badge: 'Q', desc: 'Self-revive once when killed', noPower: true },
    vulture: { name: 'Vulture Aid', cost: 3000, color: 0x4a7a2a, badge: 'V', desc: 'Zombies drop loot twice as often' },
    ironhide:{ name: 'Iron Hide', cost: 3500, color: 0x5a5f66, badge: 'I', desc: 'Take 20% less damage' },
  },
};

// enchantment tiers: cost → count of enchantments; pricier = hotter level rolls
export const ENCHANT_TIERS = [
  { cost: 2500, count: 1, bias: 0 },
  { cost: 5000, count: 2, bias: 0.25 },
  { cost: 10000, count: 3, bias: 0.55 },
];
export const ENCHANTS = {
  weapon: [
    { key: 'damage', name: 'Damage', max: 5 },
    { key: 'speed', name: 'Speed', max: 3 },
  ],
  armor: [
    { key: 'protection', name: 'Protection', max: 5 },
    { key: 'endurance', name: 'Endurance', max: 5 },
  ],
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export function enchantLabel(e) { return `${e.key[0].toUpperCase()}${e.key.slice(1)} ${ROMAN[e.lvl]}`; }

// powerup drops
export const POWERUPS = {
  insta:     { name: 'INSTA-KILL', color: 0xff4a3a, dur: 20, icon: '💀' },
  maxammo:   { name: 'MAX AMMO', color: 0xffd27f, dur: 0, icon: '🎁' },
  double:    { name: 'DOUBLE POINTS', color: 0xf7d774, dur: 30, icon: '✖2' },
  carpenter: { name: 'CARPENTER', color: 0xd8a45a, dur: 0, icon: '🔨' },
  berserker: { name: 'BERSERKER', color: 0xff2a90, dur: 30, icon: '💪' },
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
