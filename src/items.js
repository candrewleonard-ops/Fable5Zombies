// Item definitions shared by inventory, drops, weapons and the paperdoll.

export const WEAPONS = {
  pistol: {
    name: 'M1911', icon: '🔫', damage: 34, headshotMult: 2.5,
    magSize: 8, startingReserve: 72, fireRate: 3.8, auto: false,
    spread: 0.012, adsSpread: 0.004, reloadTime: 1.1, range: 60,
    pellets: 1, recoil: 0.028, kick: 0.05, tracer: 0xffd27f,
    sound: 'pistol',
  },
  smg: {
    name: 'VIPER SMG', icon: '🔫', damage: 22, headshotMult: 2.2,
    magSize: 32, startingReserve: 128, fireRate: 11, auto: true,
    spread: 0.03, adsSpread: 0.012, reloadTime: 1.6, range: 45,
    pellets: 1, recoil: 0.016, kick: 0.03, tracer: 0x9fff8a,
    sound: 'smg',
  },
  shotgun: {
    name: 'GRAVEDIGGER', icon: '🔫', damage: 14, headshotMult: 1.8,
    magSize: 6, startingReserve: 36, fireRate: 1.4, auto: false,
    spread: 0.07, adsSpread: 0.05, reloadTime: 2.2, range: 22,
    pellets: 8, recoil: 0.09, kick: 0.14, tracer: 0xffa050,
    sound: 'shotgun',
  },
  revolver: {
    name: 'FABLE .500', icon: '🔫', damage: 95, headshotMult: 3.0,
    magSize: 5, startingReserve: 30, fireRate: 1.6, auto: false,
    spread: 0.006, adsSpread: 0.001, reloadTime: 2.4, range: 90,
    pellets: 1, recoil: 0.12, kick: 0.18, tracer: 0xff5c5c,
    sound: 'revolver',
  },
};

// Armor tiers: 1 = Scrap, 2 = Steel, 3 = Nightforged
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

// def factory ------------------------------------------------------------

export function makeWeaponItem(key) {
  const w = WEAPONS[key];
  return {
    id: `weapon_${key}`, kind: 'weapon', weaponKey: key,
    name: w.name, icon: w.icon, stack: 1, count: 1,
    desc: `${w.pellets > 1 ? w.pellets + 'x' : ''}${w.damage} dmg • ${w.magSize} mag`,
  };
}

export function makeArmorItem(slot, tier) {
  const t = ARMOR_TIERS[tier];
  return {
    id: `armor_${slot}_${tier}`, kind: 'armor', armorSlot: slot, tier,
    name: `${t.label} ${slot === 'chest' ? 'Chestplate' : slot[0].toUpperCase() + slot.slice(1)}`,
    icon: ARMOR_ICONS[slot], stack: 1, count: 1, rarity: tier,
    armor: ARMOR_POINTS[slot][tier],
    desc: `+${ARMOR_POINTS[slot][tier]} armor`,
  };
}

export function makeMedkit() {
  return {
    id: 'medkit', kind: 'medkit', name: 'Medkit', icon: '💉',
    stack: 5, count: 1, desc: 'Right-click to heal 50 HP (or press F in game)',
  };
}

export function makeAmmoItem(amount) {
  return {
    id: 'ammo', kind: 'ammo', name: 'Ammo Cache', icon: '📦',
    stack: 99, count: amount, desc: 'Reserve rounds for your current weapon',
  };
}

export function cloneItem(item) {
  return item ? { ...item } : null;
}
