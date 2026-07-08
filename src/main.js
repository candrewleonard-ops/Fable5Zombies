import * as THREE from 'three';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { WeaponSystem, buildGunModel } from './weapons.js';
import { ZombieManager } from './zombies.js';
import { Effects } from './effects.js';
import { Inventory } from './inventory.js';
import { IconRenderer } from './icons.js';
import { HUD } from './hud.js';
import { audio } from './audio.js';
import { Craft, Drops, gatherNode, updateScavenge } from './crafting.js';
import { MysteryBox } from './mysterybox.js';
import { PackAPunch } from './pap.js';
import { BuildSystem } from './build.js';
import { CarSys } from './car.js';
import { GroundGuns } from './guncard.js';
import { Powerups } from './powerups.js';
import { Harvest, plantTree, Mobs } from './outdoors.js';
import { buildMines } from './mines.js';
import { buildVillage } from './village.js';
import { Market, GunStore, Combiner, Quests } from './economy.js';
import { buildFacility } from './facility.js';
import { Barrels } from './barrels.js';
import { Laptop } from './laptop.js';
import {
  WEAPONS, weaponDef, ECON, ROUND, POWERUPS, BUILD_MATS, TOOL_DEFS,
  makeWeaponItem, makeTool, makeArmorItem, makeMaterial,
} from './items.js';
import { groundHeightAt } from './physics.js';

const params = new URLSearchParams(location.search);
const TEST_MODE = params.has('test');
const NO_ZOMBIES = params.has('nozombies');

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);

const world = createWorld(scene);
const player = new Player(camera, world);
scene.add(player.yaw);

const effects = new Effects(scene, camera);
const weapons = new WeaponSystem(camera, player, { colliders: world.shotSolids, bounds: world.bounds }, effects);
weapons.scene = scene;
const zombies = new ZombieManager(scene, world, player, effects);
const hud = new HUD();
const icons = new IconRenderer();
const box = new MysteryBox(scene, world);
// ry=PI/2 faces the machine's tray out from the STORAGE west wall, into the room
const pap = new PackAPunch(scene, world, effects, world.papPos, Math.PI / 2);
const build = new BuildSystem(scene, world, player, camera);
const car = new CarSys(scene, world, player, camera);

// ---------------- game state ----------------
const state = {
  playing: false, paused: false, round: 0, points: ECON.startPoints,
  kills: 0, toSpawn: 0, spawnT: 2, intermission: 0, time: 0,
  boss: null, won: false,
  instaT: 0, berserkT: 0, doubleT: 0, gasT: 0, mineT: 0,
  markus: null,
};

const keys = new Set();
const mouse = { down: false, rdown: false, clicked: false, rclicked: false };
const mouseDelta = { x: 0, y: 0 };
let fHeld = false, fEdge = false;
let repairT = 0, deployCd = 0;
let noLock = false;

const inventory = new Inventory(player, icons, {
  onLoadoutChange: () => onSelectionChanged(),
  onClose: () => { if (state.playing && !TEST_MODE && !noLock) tryLock(); },
  onDropItem: (item) => { dropItemIntoWorld(item); hud.showMsg(`${item.name} dropped`); },
  onCraftWeapon: (recipe) => { inventory.close(); craft.startSequence(recipe); },
  onEnchanted: (item) => { hud.showMsg(`${item.name} enchanted`); if (item === weapons.item) weapons.refreshDef(); },
  spendPoints: (n) => spend(n),
  getRound: () => state.round,
  getKills: () => state.kills,
});
const craft = new Craft(scene, camera, player, inventory, effects);
const drops = new Drops(scene, player, inventory);

// ---------------- expansion systems ----------------
const harvest = new Harvest(scene, effects);
const groundGuns = new GroundGuns(scene);
const powerups = new Powerups(scene, player);
const mobs = new Mobs(scene, effects, drops);
const mines = buildMines(scene, world, harvest, drops);
const village = buildVillage(scene, world);
const facility = buildFacility(scene, world, effects, player);
const barrels = new Barrels(scene, world, effects);
const market = new Market(village.tvCanvas, village.tvTex);
const store = new GunStore();
const combiner = new Combiner();
const quests = new Quests();
const laptop = new Laptop();
const goops = []; // nuclear waste puddles

// chop-able trees + the cattle meadow east of the bunker
for (const [tx, tz, big] of [
  [24, -16, 1], [30, 4, 0], [34, 24, 1], [-42, -8, 0], [-46, 18, 1], [14, -32, 0],
  [-8, -34, 1], [40, -20, 0], [52, 16, 1], [-54, 30, 0], [26, 40, 0], [40, 36, 1],
  [64, -6, 0], [78, 16, 1], [-30, 44, 0], [8, 52, 1],
]) plantTree(scene, harvest, drops, tx, tz, !!big);
for (const [cx, cz] of [[38, -10], [44, 2], [50, -18], [58, 8], [34, 14]]) mobs.spawnCow(cx, cz);

// gun store wall racks — display models
['kar98', 'trench', 'smg', 'stg', 'mg42', 'ppsh'].forEach((k, i) => {
  const m = buildGunModel(k);
  m.scale.setScalar(2.2);
  m.position.copy(village.store.rackAnchors[i]);
  scene.add(m);
});

player.onArmorAbsorb = (a) => inventory.absorbArmorDamage(a);
player.onHurt = () => hud.damageFlash();
player.onJetSpark = (pos) => effects.sparksColored(pos, 0xffa040);

// ---------------- economy ----------------
function addPoints(n) {
  state.points += n;
  hud.setPoints(state.points);
  hud.feed(n);
}
// combat earnings respect armor tints (Gucci pays) and Double Points
function addCombatPoints(n) {
  addPoints(Math.round(n * inventory.tintBonuses().pts * (state.doubleT > 0 ? 2 : 1)));
}
function spend(n) {
  if (state.points < n) { hud.showMsg('Not enough points'); return false; }
  state.points -= n;
  hud.setPoints(state.points);
  hud.feed(-n);
  return true;
}

// economy panel wiring
for (const p of [market, store, combiner, quests]) {
  p.getPoints = () => state.points;
  p.spend = spend;
  p.addPoints = addPoints;
  p.toast = (m) => hud.showMsg(m);
  p.onClose = () => { if (state.playing && !TEST_MODE && !noLock) tryLock(); };
}
laptop.onClose = () => { if (state.playing && !TEST_MODE && !noLock) tryLock(); };
store.giveWeapon = (it) => inventory.addItem(it);
store.getHeld = () => inventory.selectedItem();
store.removeHeld = () => { inventory.slots[inventory.sel] = null; inventory.renderAll(); onSelectionChanged(); };
combiner.giveWeapon = (it) => inventory.addItem(it);
combiner.getHeld = () => inventory.selectedItem();
combiner.removeHeld = () => { inventory.slots[inventory.sel] = null; inventory.renderAll(); onSelectionChanged(); };
combiner.countDiamonds = () => inventory.countOf('diamond');
combiner.consumeDiamonds = (n) => inventory.consume('diamond', n);
quests.getRound = () => state.round;
quests.giveItem = (it) => inventory.addItem(it);
quests.countOf = (id) => inventory.countOf(id);
quests.consume = (id, n) => inventory.consume(id, n);

function uiPanelOpen() {
  return market.isOpen || store.isOpen || combiner.isOpen || quests.isOpen || laptop.isOpen || hud.noteOpen;
}
function closePanels() {
  if (market.isOpen) market.close();
  if (store.isOpen) store.close();
  if (combiner.isOpen) combiner.close();
  if (quests.isOpen) quests.close();
  if (laptop.isOpen) laptop.close();
  if (hud.noteOpen) hud.hideNote();
}
function openPanel(p) {
  p.open();
  weapons.triggerUp();
  document.exitPointerLock?.();
}

// ---------------- perks ----------------
weapons.getMods = () => ({
  dmgMult: (player.perks.has('deadeye') ? 1.4 : 1),
  rpmMult: player.perks.has('rapid') ? 1.12 : 1,
  reloadMult: player.perks.has('rapid') ? 0.55 : 1,
});

// ---------------- selection / loadout ----------------
function onSelectionChanged() {
  const item = inventory.selectedItem();
  weapons.equip(item);
  build.setActive(item?.build || null);

  // passive tools auto-apply
  for (let i = 0; i < inventory.slots.length; i++) {
    const it = inventory.slots[i];
    if (!it) continue;
    if (it.id === 'jetpack' && !player.jetpack) {
      player.jetpack = true;
      player.jetFuel = 100;
      inventory.slots[i] = null;
      hud.showMsg('Jetpack equipped — hold SPACE to fly');
    } else if (it.id === 'jetfuel' && player.jetpack) {
      player.addFuel(50 * it.count);
      inventory.slots[i] = null;
      hud.showMsg('+ Jet fuel');
    }
  }
  updateAmmoHUD();
  hud.updateArmor(player.armor, player.maxArmor);
}

function updateAmmoHUD() {
  const item = inventory.selectedItem();
  hud.setWeapon(item, item?.kind === 'weapon' ? weaponDef(item) : null, weapons.reloading > 0);
}

function dropItemIntoWorld(item) {
  const fwd = player.eyeDirection().setY(0).normalize();
  const at = player.pos.clone().addScaledVector(fwd, 1.3);
  at.y = player.pos.y + 0.4;
  if (item.kind === 'weapon') groundGuns.spawn(at, item, fwd);
  else drops.spawnItem(at, item, 0x9dff57, { delay: 1.4 });
}

// ---------------- combat hooks ----------------
weapons.onShot = () => { updateAmmoHUD(); inventory.renderHUDHotbar(); };
weapons.onHit = (z, dmg, part) => {
  addCombatPoints(ECON.hitPoints);
  // pickaxe kills pay a bounty (130 total: 50 kill bonus lands in onKill)
  if (part === 'pickaxe' && z.dead) addCombatPoints(80);
  hud.hitmarker(part === 'head');
  audio.hit();
};
weapons.onGoop = (point, dmg) => spawnGoop(point, dmg);
weapons.mobs = {
  list: mobs.list,
  raycast: (o, d, m) => mobs.raycast(o, d, m) || barrels.raycast(o, d, m) || facility.raycast(o, d, m),
  damage: (mob, dmg, point, dir) =>
    mob.kind === 'cow' ? mobs.damage(mob, dmg, point, dir)
      : mob.kind === 'barrel' ? barrels.damage(mob)
      : facility.damage(mob, dmg, point, dir),
  blast: (at, r, dmg) => { facility.blast(at, r, dmg); barrels.checkBlast(at, r); },
};
barrels.onBlast = (center, radius, dmg) => {
  zombies.blastDamage(center, radius, dmg);
  facility.blast(center, radius, dmg);
  const dP = player.pos.clone().setY(player.pos.y + 1).distanceTo(center);
  if (dP < radius * 0.7 && !player.dead) player.takeDamage(30);
};

// dismemberment bounty: every limb blown off pays out
zombies.onSever = (z, part) => {
  addCombatPoints(25);
  hud.hitmarker(false);
};

zombies.onKill = (z, headshot) => {
  state.kills++;
  addCombatPoints(headshot ? ECON.headshotKillBonus : ECON.killBonus);
  if (headshot) hud.hitmarker(true);
  quests.addKill();

  const at = z.pos.clone();
  const vulture = player.perks.has('vulture');
  powerups.maybeDrop(at, vulture ? 2 : 1);

  if (z.boss) {
    state.boss = null;
    hud.bossHUD(null);
    addPoints(1500);
    hud.banner('Abomination slain');
    quests.milestone('firstBoss');
    drops.spawnItem(at.clone(), makeTool('raygunPart'), 0xff4a3a, { force: true });
    drops.spawnItem(at.clone().add(new THREE.Vector3(0.7, 0, 0.3)), makeArmorItem(['helmet', 'chest', 'legs', 'boots'][Math.random() * 4 | 0], 3), 0xaa5aff, { force: true });
    if (Math.random() < 0.25) {
      drops.spawnItem(at.clone().add(new THREE.Vector3(-0.7, 0, -0.3)), makeTool('lamboKit'), 0xe8b820, { force: true });
      hud.showMsg('It dropped… a LAMBO BODY KIT?!');
    }
    return;
  }

  // blood moon: the LAST zombie of the round drops a Ray Gun part
  if (state.bloodMoon && state.toSpawn === 0 && zombies.aliveCount === 0) {
    drops.spawnItem(at.clone(), makeTool('raygunPart'), 0xff4a3a, { force: true });
    hud.showMsg('The blood moon yields a Ray Gun part…');
  }

  // armored zombies are walking loot pinatas
  if (z.armorTier && Math.random() < 0.2) {
    drops.spawnItem(at.clone(), makeArmorItem(['helmet', 'chest', 'legs', 'boots'][Math.random() * 4 | 0], z.armorTier), 0xaabed2);
  }

  // loot table: mats 12%, ammo 11% (halved — Max Ammo exists now),
  // armor 1%, weapon 0.5%. Vulture Aid sweetens the roll.
  const r = Math.random() * (vulture ? 0.8 : 1);
  if (r < 0.12) drops.spawn(at);
  else if (r < 0.23) drops.spawnAmmo(at);
  else if (r < 0.24) {
    const tier = state.round >= 6 ? (Math.random() < 0.3 ? 3 : 2) : (Math.random() < 0.5 ? 2 : 1);
    drops.spawnItem(at, makeArmorItem(['helmet', 'chest', 'legs', 'boots'][Math.random() * 4 | 0], tier), 0xaabed2);
  } else if (r < 0.245) {
    const pool = ['smg', 'trench', 'stg', 'ppsh', 'revolver'];
    groundGuns.spawn(at, makeWeaponItem(pool[Math.random() * pool.length | 0]));
  }
};
drops.onAmmo = () => {
  const cur = weapons.item;
  if (!cur) return false;
  const amount = weaponDef(cur).mag * 2;
  weapons.addReserve(amount);
  hud.showMsg(`+${amount} ammo`);
  updateAmmoHUD();
  return true;
};
drops.onItem = (item) => hud.showMsg(`${item.name} picked up`);
zombies.onHurtPlayer = () => hud.damageFlash();
zombies.onBoards = () => {};
drops.onPickup = (mat) => hud.showMsg(`+ ${mat[0].toUpperCase() + mat.slice(1)}`);
craft.onFinish = (item) => {
  hud.showMsg(`${item.name} crafted`);
  const idx = inventory.slots.indexOf(item);
  if (idx >= 0 && idx < 9) inventory.select(idx);
  onSelectionChanged();
};
box.ownedKeysProvider = () =>
  inventory.slots.filter((it) => it?.kind === 'weapon').map((it) => it.weaponKey);
box.onRefund = (n) => addPoints(n);
box.onMessage = (m) => hud.showMsg(m);
car.onRunOverHit = (z, killed) => { addCombatPoints(ECON.hitPoints); };
car.onMessage = (m) => hud.showMsg(m);
build.getPoints = () => state.points;
build.canAfford = (piece) => {
  if (['bench', 'anvil', 'cabinet', 'countertop', 'radio', 'nucleartable'].includes(piece)) return true;
  if (piece === 'block' || piece === 'gblock') return (inventory.selectedItem()?.count ?? 0) >= 1;
  const mats = BUILD_MATS[piece];
  return mats ? Object.entries(mats).every(([id, n]) => inventory.countOf(id) >= n) : true;
};
facility.onMessage = (m) => { hud.showMsg(m); hud.banner(m); };
facility.onMilestone = (k) => quests.milestone(k);
facility.onDrops = (pos) => {
  drops.spawnItem(pos.clone().setY(0.3), makeMaterial('nuclearBrick', 10), 0x54ff3a, { force: true });
  drops.spawnItem(pos.clone().setY(0.3).add(new THREE.Vector3(1, 0, 0.5)), makeTool('wifiRadio'), 0x3a6aff, { force: true });
  drops.spawnItem(facility.center.clone().add(new THREE.Vector3(0, 0.6, -17)), makeTool('avionics'), 0x35e6ff, { force: true });
  hud.showMsg('The avionics rack unseals behind the corpse…');
};

// ---------------- powerups ----------------
powerups.onTake = (key) => {
  const def = POWERUPS[key];
  hud.banner(def.name);
  if (key === 'insta') {
    state.instaT = def.dur;
    zombies.instaKill = true;
  } else if (key === 'maxammo') {
    for (const it of inventory.slots) {
      if (it?.kind === 'weapon') {
        const d = weaponDef(it);
        if (!d.flame) { it.mag = d.mag; it.reserve = d.reserve; }
      }
    }
    updateAmmoHUD();
    inventory.renderAll();
  } else if (key === 'double') {
    state.doubleT = def.dur;
  } else if (key === 'carpenter') {
    let n = 0;
    for (const win of world.windows) while (world.addBoard(win)) n++;
    addPoints(200);
    audio.boardAdd();
    if (n) hud.showMsg(`Every barricade rebuilt (+200)`);
  } else if (key === 'berserker') {
    state.berserkT = def.dur;
    weapons.berserk = true;
    audio.berserkRoar();
    hud.berserkFx(true);
  }
};

// ---------------- THE MARKUS SPECIAL ----------------
// Empty hands + F on a zombie: grab it where it hurts and squeeze until the
// pop. 75% of its max HP, +200 points on the kill. Warzone-finisher energy.
function findMarkusVictim() {
  const fwd = player.eyeDirection().setY(0).normalize();
  let best = null, bd = 1.9;
  for (const z of zombies.zombies) {
    if (z.dead || !z.alive || z.boss || z.state === 'grabbed') continue;
    if (z.state !== 'hunt' && z.state !== 'tearing') continue;
    const to = new THREE.Vector3(z.pos.x - player.pos.x, 0, z.pos.z - player.pos.z);
    const d = to.length();
    if (d > bd || Math.abs(z.pos.y - player.pos.y) > 1.4) continue;
    to.normalize();
    if (to.dot(fwd) < 0.4 && d > 0.9) continue;
    bd = d;
    best = z;
  }
  return best;
}

function startMarkus(z) {
  state.markus = { z, t: 1.25, popped: false };
  z.state = 'grabbed';
  z.grabT = 1.45;
  z.kb.set(0, 0, 0);
  const fwd = player.eyeDirection().setY(0).normalize();
  z.pos.set(player.pos.x + fwd.x * 1.05, player.pos.y, player.pos.z + fwd.z * 1.05);
  weapons.finisherT = 1.25;
  weapons.meleeCd = 1.8;
  player.lockT = 1.15; // planted while you work
  audio.markusSqueeze();
}

function updateMarkus(dt) {
  const m = state.markus;
  if (!m) return;
  m.t -= dt;
  const z = m.z;
  if (!m.popped && m.t <= 0.2 && !z.dead && z.alive) {
    m.popped = true;
    const at = z.pos.clone().setY(z.pos.y + 0.85 * z.scale);
    effects.blood(at, new THREE.Vector3(0, 0.7, 0), 30, 7, z.pos.y);
    effects.bloodDecal(z.pos.x, z.pos.z, z.pos.y + 0.02, 1.1);
    audio.markusPop();
    player.shake = Math.min(0.7, player.shake + 0.3);
    const res = z.takeDamage(z.maxHp * 0.75, 'body', at, null);
    if (res?.killed) {
      addCombatPoints(200);
      hud.banner('THE MARKUS SPECIAL');
      hud.showMsg('+200 — he felt that in the afterlife');
    } else if (!z.dead) {
      // it lives… barely. Send it hobbling.
      z.state = 'hunt';
      const away = new THREE.Vector3(z.pos.x - player.pos.x, 0, z.pos.z - player.pos.z).normalize();
      z.applyKnockback(away, 3.5);
      z.slowT = 2.5;
      hud.showMsg('THE MARKUS SPECIAL — it limps away');
    }
  }
  if (m.t <= 0) state.markus = null;
}

// ---------------- nuclear goop ----------------
function spawnGoop(point, dmg) {
  if (goops.length >= 14) {
    const old = goops.shift();
    scene.remove(old.mesh);
  }
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 14),
    new THREE.MeshStandardMaterial({
      color: 0x1a3a10, emissive: 0x54ff3a, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.75, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(point.x, Math.max(0.03, point.y - 1) + 0.03, point.z);
  scene.add(mesh);
  goops.push({ mesh, dmg, life: 6, tick: 0.5 });
}

function updateGoops(dt) {
  for (let i = goops.length - 1; i >= 0; i--) {
    const g = goops[i];
    g.life -= dt;
    g.tick -= dt;
    g.mesh.material.opacity = Math.min(0.75, g.life * 0.4);
    if (g.tick <= 0) {
      g.tick = 0.5;
      for (const z of zombies.zombies) {
        if (z.dead || !z.alive) continue;
        if (Math.abs(z.pos.y - g.mesh.position.y) > 1.6) continue;
        if (Math.hypot(z.pos.x - g.mesh.position.x, z.pos.z - g.mesh.position.z) < 1.3) {
          z.slowT = 0.8; // 20% slow while marinating
          z.takeDamage(g.dmg * 0.1, 'body', z.pos.clone().setY(z.pos.y + 0.5), null); // 20%/s in 0.5s ticks
        }
      }
    }
    if (g.life <= 0) { scene.remove(g.mesh); goops.splice(i, 1); }
  }
}

// ---------------- pointer lock ----------------
const canvas = renderer.domElement;
function tryLock() {
  if (TEST_MODE) return;
  try {
    const p = canvas.requestPointerLock();
    if (p?.catch) p.catch(() => enableNoLock());
    setTimeout(() => {
      if (state.playing && document.pointerLockElement !== canvas && !noLock) enableNoLock();
    }, 400);
  } catch { enableNoLock(); }
}
function enableNoLock() {
  // temporary fallback only — every click keeps retrying for a real lock
  noLock = true;
  canvas.style.cursor = 'none';
  if (state.playing) hud.showMsg('Click to capture the mouse');
}
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) {
    noLock = false; // real capture achieved — leave fallback mode for good
    canvas.style.cursor = 'default';
  }
  if (noLock || inventory.isOpen || uiPanelOpen()) return;
  if (state.playing && !player.dead) {
    state.paused = !locked;
    document.getElementById('pauseOverlay').style.display = locked ? 'none' : 'flex';
  }
});
// any click on the game while unlocked retries the capture
document.addEventListener('mousedown', (e) => {
  if (state.playing && !player.dead && !inventory.isOpen && !uiPanelOpen() && !TEST_MODE &&
      document.pointerLockElement !== canvas) {
    tryLock();
  }
  // Minecraft-style: click outside the inventory panel with a carried item → drop it
  if (inventory.isOpen && inventory.carried && !e.target.closest('#invInner')) {
    const item = inventory.carried;
    inventory.carried = null;
    inventory.renderAll();
    dropItemIntoWorld(item);
    hud.showMsg(`${item.name} dropped`);
  }
}, true);
document.getElementById('pauseOverlay').addEventListener('click', () => {
  if (!noLock) tryLock();
  else { state.paused = false; document.getElementById('pauseOverlay').style.display = 'none'; }
});
document.getElementById('resumeBtn')?.addEventListener('click', (e) => e.stopPropagation());

// ---------------- input ----------------
document.addEventListener('mousemove', (e) => {
  const canLook = (document.pointerLockElement === canvas || noLock || TEST_MODE);
  if (!canLook || !state.playing || state.paused || inventory.isOpen || uiPanelOpen()) return;
  if (weapons.guiding) { // steering the missile
    weapons.guideSteer.x += e.movementX;
    weapons.guideSteer.y += e.movementY;
    return;
  }
  if (!car.driving) {
    player.onMouseMove(e.movementX, e.movementY);
    mouseDelta.x += e.movementX;
    mouseDelta.y += e.movementY;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.target?.tagName === 'INPUT') return; // typing a URL into the laptop
  keys.add(e.code);
  if (!state.playing) return;

  switch (e.code) {
    case 'KeyT':
      if (player.dead || craft.crafting || car.driving) break;
      if (uiPanelOpen()) { closePanels(); break; }
      inventory.toggle();
      if (inventory.isOpen) {
        weapons.triggerUp();
        document.exitPointerLock?.();
      }
      break;
    case 'Escape':
      if (uiPanelOpen()) closePanels();
      else if (inventory.isOpen) inventory.close();
      else if (noLock && !player.dead) {
        state.paused = !state.paused;
        document.getElementById('pauseOverlay').style.display = state.paused ? 'flex' : 'none';
      }
      break;
    case 'KeyR':
      if (!inventory.isOpen && !state.paused && !car.driving && !uiPanelOpen()) weapons.startReload();
      break;
    case 'KeyF':
      fHeld = true; fEdge = true;
      break;
    case 'KeyG': // drop item (Q is taken by lean) — Shift+G drops the stack
      if (!inventory.isOpen && !state.paused && !car.driving && !uiPanelOpen() && !player.dead) {
        const dropped = inventory.takeDrop(e.shiftKey);
        if (dropped) {
          dropItemIntoWorld(dropped);
          onSelectionChanged();
        }
      }
      break;
    case 'Space':
      if (!inventory.isOpen && !state.paused && !player.jetpack && !car.driving && !uiPanelOpen()) player.jump();
      e.preventDefault();
      break;
    default:
      if (/^Digit[1-9]$/.test(e.code) && !inventory.isOpen && !state.paused && !car.driving && !uiPanelOpen()) {
        inventory.select(Number(e.code.slice(-1)) - 1);
      }
  }
});
document.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyF') fHeld = false;
});
window.addEventListener('blur', () => { keys.clear(); fHeld = false; });

document.addEventListener('wheel', (e) => {
  if (!state.playing || inventory.isOpen || state.paused || car.driving || uiPanelOpen()) return;
  const d = e.deltaY > 0 ? 1 : -1;
  inventory.select(inventory.sel + d);
}, { passive: true });

document.addEventListener('mousedown', (e) => {
  if (!state.playing || inventory.isOpen || state.paused || car.driving || player.dead || craft.crafting || uiPanelOpen()) return;
  if (document.pointerLockElement !== canvas && !noLock && !TEST_MODE) return;
  if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  if (e.button === 2) { mouse.rdown = true; mouse.rclicked = true; }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.rdown = false;
});
document.addEventListener('contextmenu', (e) => {
  if (state.playing && !inventory.isOpen && !uiPanelOpen()) e.preventDefault();
});

// ---------------- rounds ----------------
function startRound(r) {
  state.round = r;
  state.toSpawn = NO_ZOMBIES ? 0 : ROUND.count(r);
  state.spawnT = 1.2;
  hud.setRound(r);
  if (r % 10 === 0 && r > 0) setTimeout(() => { if (state.playing) spawnBoss(); }, 4000);
  const blood = r % 5 === 0 && r > 0;
  hud.banner(blood ? `☽ Blood Moon — Round ${r} ☾` : `Round ${r}`);
  world.moonLight.color.setHex(blood ? 0xd86a5a : 0x9db4dd);
  state.bloodMoon = blood;
  if (r >= 15) quests.milestone('round15');
  market.onRound(r);
  audio.roundStart();
}

function pickSpeed(r) {
  if (r <= 1) return 0.9 + Math.random() * 0.4;
  const sprintChance = ROUND.sprinterChance(r) * (state.bloodMoon ? 1.3 : 1);
  const roll = Math.random();
  if (roll < sprintChance) return 3.1 + Math.random() * 0.8;
  if (roll < 0.65) return 1.7 + Math.random() * 0.7;
  return 1.0 + Math.random() * 0.5;
}

function spawnZombie() {
  const candidates = world.windows.filter((w) => world.rooms[w.room]?.unlocked && !w.gate);
  if (!candidates.length) return;
  const weights = candidates.map((w) => 1 / (4 + w.group.position.distanceTo(player.pos)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  let win = candidates[0];
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { win = candidates[i]; break; }
  }
  state.toSpawn--;
  const opts = { hp: ROUND.hp(state.round), speed: pickSpeed(state.round), bloodMoon: state.bloodMoon };
  // randomly armored zombies from round 3 (~6%), random tier, tougher
  if (state.round >= 3 && Math.random() < 0.06) {
    const tier = 1 + Math.floor(Math.random() * 3);
    opts.armorTier = tier;
    opts.armorColor = [0x8a6a42, 0x9aa7b4, 0x7a44d0][tier - 1];
    opts.hp *= 1.7;
  }
  zombies.spawnAt(win, opts);
}

function spawnBoss() {
  const candidates = world.windows.filter((w) => world.rooms[w.room]?.unlocked && !w.gate);
  const win = candidates[Math.floor(Math.random() * candidates.length)];
  if (!win) return;
  const boss = zombies.spawnAt(win, {
    hp: ROUND.hp(state.round) * 22,
    speed: 2.3,
    bloodMoon: state.bloodMoon,
    boss: true,
  });
  state.boss = boss;
  hud.banner('☠ THE ABOMINATION ☠');
  audio.bossRoar();
}

function updateRound(dt) {
  if (state.intermission > 0) {
    state.intermission -= dt;
    if (state.intermission <= 0) startRound(state.round + 1);
    return;
  }
  const alive = zombies.aliveCount;
  if (state.toSpawn > 0) {
    state.spawnT -= dt;
    if (state.spawnT <= 0 && alive < ROUND.aliveCap(state.round)) {
      state.spawnT = ROUND.spawnInterval(state.round);
      spawnZombie();
    }
  } else if (alive === 0 && state.round > 0 && !NO_ZOMBIES) {
    if (state.bloodMoon) quests.milestone('bloodMoon');
    state.intermission = ROUND.intermission;
    audio.roundEnd();
    hud.showMsg('Round clear');
  }
}

// ---------------- trap ----------------
function updateTrap(dt) {
  const T = world.trap;
  if (T.state === 'active') {
    T.t -= dt;
    if (Math.random() < dt * 14) {
      const a = T.posA.clone(); a.y = 0.3 + Math.random() * 2.1;
      const b = T.posB.clone(); b.y = 0.3 + Math.random() * 2.1;
      effects.tracer(a, b, 0x9fd8ff);
      if (Math.random() < 0.35) audio.zap();
    }
    zombies.zoneDamage(T.zone, 360, dt);
    const p = player.pos;
    if (p.x > T.zone.x0 && p.x < T.zone.x1 && p.z > T.zone.z0 && p.z < T.zone.z1 && p.y < 2) {
      T.hurtT = (T.hurtT || 0) + dt;
      if (T.hurtT > 0.5) { T.hurtT = 0; player.takeDamage(8); }
    }
    for (const tip of T.tips) tip.material.emissiveIntensity = 2 + Math.random() * 2;
    if (T.t <= 0) {
      T.state = 'cooldown'; T.t = 40;
      for (const tip of T.tips) tip.material.emissiveIntensity = 0.3;
    }
  } else if (T.state === 'cooldown') {
    T.t -= dt;
    if (T.t <= 0) {
      T.state = 'ready';
      for (const tip of T.tips) tip.material.emissiveIntensity = 1.2;
    }
  }
}

// ---------------- F interactions ----------------
const STATION_LABELS = {
  bench: 'Crafting Bench (3×3)', anvil: 'Anvil — forge & enchant',
  radio: 'Wifi Radio — browse', nucleartable: 'Nuclear Table',
};
const NUCLEAR_ELIGIBLE = new Set(['smg', 'stg', 'mg42', 'ppsh', 'trench', 'hellfire', 'laser', 'arc', 'raygun', 'wavegun', 'tempest']);
const HELI_PART_ITEMS = { rotor: 'rotorBlades', engine: 'heliEngine', fuel: 'fuelTank', avionics: 'avionics' };

function nearestInteract() {
  const eye = player.pos.clone(); eye.y += 1.6;
  const cands = [];

  for (const win of world.windows) {
    if (win.gate || !world.rooms[win.room]?.unlocked) continue;
    const wp = win.group.position.clone(); wp.y = win.floorY;
    const d = wp.distanceTo(player.pos);
    if (d < 2.3 && win.boards.some((b) => !b.on)) {
      cands.push({ d, type: 'window', win, prompt: '<b>Hold F</b> — Rebuild barricade <b>+10</b>' });
    }
  }
  for (const door of world.doors) {
    if (door.open) continue;
    const d = door.pos.distanceTo(eye);
    if (d < 2.4) cands.push({ d, type: 'door', door, prompt: `<b>F</b> — Open ${door.name} <b>[${door.cost}]</b>` });
  }
  for (const pm of world.perks) {
    if (player.perks.has(pm.key)) continue;
    const d = pm.pos.clone().add(new THREE.Vector3(0, 0.2, 0)).distanceTo(eye);
    if (d < 2.2) {
      const needsPower = !ECON.perks[pm.key].noPower;
      if (needsPower && !world.powerSwitch.on) {
        cands.push({ d, type: 'noop', prompt: `${pm.name} — <b>NO POWER</b> (switch is on the roof)` });
      } else {
        cands.push({ d, type: 'perk', pm, prompt: `<b>F</b> — Buy ${pm.name} <b>[${pm.cost}]</b>` });
      }
    }
  }
  for (const wb of world.wallBuys) {
    const d = wb.pos.distanceTo(eye);
    if (d < 2.4) {
      const def = WEAPONS[wb.key];
      const owned = inventory.slots.find((it) => it?.kind === 'weapon' && it.weaponKey === wb.key && !it.pap);
      const cost = owned ? Math.round(def.cost / 2 / 10) * 10 : def.cost;
      cands.push({
        d, type: 'wallbuy', wb, owned, cost,
        prompt: `<b>F</b> — ${owned ? 'Ammo for' : 'Buy'} ${def.name} <b>[${cost}]</b>`,
      });
    }
  }
  const bd = box.pos.distanceTo(player.pos);
  if (bd < 2.5) {
    if (box.state === 'idle') cands.push({ d: 1, type: 'box', prompt: `<b>F</b> — Mystery Box <b>[${box.cost}]</b>` });
    else if (box.state === 'ready') cands.push({ d: 0.5, type: 'boxTake', prompt: `<b>F</b> — Take ${WEAPONS[box.weapon].name}` });
  }
  const pd = pap.pos.distanceTo(player.pos);
  if (pd < 2.6) {
    if (!world.powerSwitch.on) {
      cands.push({ d: 0.8, type: 'noop', prompt: 'Reforge — <b>NO POWER</b> (switch is on the roof)' });
    } else {
      const held = inventory.selectedWeapon();
      if (pap.state === 'idle' && held && !held.pap) {
        cands.push({ d: 0.6, type: 'pap', held, prompt: `<b>F</b> — Reforge ${held.name} <b>[${pap.cost}]</b>` });
      } else if (pap.ready) {
        cands.push({ d: 0.4, type: 'papTake', prompt: `<b>F</b> — Take ★ ${pap.item ? WEAPONS[pap.item.weaponKey].name : ''}` });
      } else if (pap.state !== 'idle') {
        cands.push({ d: 0.7, type: 'noop', prompt: 'Reforging…' });
      }
    }
  }
  if (car.canEnter(player.pos)) cands.push({ d: car.pos.distanceTo(player.pos), type: 'car', prompt: '<b>F</b> — Enter vehicle' });
  for (const n of world.scavenge) {
    if (n.cd > 0) continue;
    const d = n.pos.distanceTo(player.pos);
    if (d < 2.2) cands.push({ d, type: 'scav', n, prompt: `<b>F</b> — Gather ${n.mat}` });
  }
  for (const st of build.stations) {
    const d = st.pos.distanceTo(player.pos);
    if (d < 2.4) {
      if (st.kind === 'nucleartable') {
        const held = inventory.selectedWeapon();
        const ok = held && !held.nuclear && NUCLEAR_ELIGIBLE.has(held.weaponKey) && inventory.countOf('nuclearBrick') >= 1;
        cands.push({
          d, type: 'nuketable', held: ok ? held : null,
          prompt: ok ? `<b>F</b> — Irradiate ${weaponDef(held).name} <b>[1 ☢ brick]</b>`
            : 'Nuclear Table — hold an AR / shotgun / wonder weapon + 1 brick',
        });
      } else if (st.kind === 'radio') {
        cands.push({ d, type: 'radio', prompt: `<b>F</b> — Use ${STATION_LABELS.radio}` });
      } else {
        cands.push({ d, type: 'station', st, prompt: `<b>F</b> — Use ${STATION_LABELS[st.kind]}` });
      }
    }
  }
  const td = world.trap.switchPos.distanceTo(eye);
  if (td < 2.5) {
    const T = world.trap;
    if (T.state === 'ready') cands.push({ d: 1, type: 'trap', prompt: `<b>F</b> — Electro-trap <b>[${T.cost}]</b>` });
    else if (T.state === 'active') cands.push({ d: 1, type: 'noop', prompt: '⚡ TRAP ACTIVE ⚡' });
    else cands.push({ d: 1, type: 'noop', prompt: `Trap cooling — ${Math.ceil(T.t)}s` });
  }

  // ---- expansion interactions ----
  // dropped guns (Borderlands card + F pickup)
  const gg = groundGuns.nearest(player.pos, 2.4);
  if (gg) {
    groundGuns.showCard(gg);
    cands.push({ d: 0.9, type: 'gunpick', gg, prompt: `<b>F</b> — Pick up <b>${weaponDef(gg.item).name}</b>` });
  } else groundGuns.hideCard();

  // mine loot chests
  for (const chest of mines.chests) {
    if (chest.opened) continue;
    const d = chest.pos.distanceTo(eye);
    if (d < 2.4) cands.push({ d, type: 'chest', chest, prompt: '<b>F</b> — Open the chest' });
  }

  // readable notes
  for (const n of world.notes) {
    const d = n.pos.distanceTo(eye);
    if (d < 2.1) cands.push({ d, type: 'note', n, prompt: `<b>F</b> — Read "${n.title}"` });
  }

  // roof power switch
  const pwd = world.powerSwitch.pos.distanceTo(eye);
  if (pwd < 2.6) {
    if (world.powerSwitch.on) cands.push({ d: 1, type: 'noop', prompt: '⚡ POWER ON ⚡' });
    else cands.push({ d: 0.7, type: 'power', prompt: `<b>F</b> — RESTORE POWER <b>[${world.powerSwitch.cost}]</b>` });
  }

  // helicopter assembly / escape
  const hd = world.heli.pos.distanceTo(player.pos);
  if (hd < 4.2 && !world.heli.done) {
    const missing = Object.entries(HELI_PART_ITEMS).filter(([p]) => !world.heli.parts[p]);
    const installable = missing.find(([, id]) => inventory.countOf(id) > 0);
    if (installable) {
      cands.push({ d: 0.5, type: 'heliInstall', part: installable, prompt: `<b>F</b> — Install ${TOOL_DEFS[installable[1]].name}` });
    } else if (missing.length) {
      cands.push({ d: 1.2, type: 'noop', prompt: `She needs: <b>${missing.map(([p]) => p.toUpperCase()).join(' · ')}</b>` });
    } else if (!world.powerSwitch.on) {
      cands.push({ d: 1.2, type: 'noop', prompt: 'All parts installed — she needs <b>POWER</b>' });
    } else {
      cands.push({ d: 0.4, type: 'heliFly', prompt: '<b>F</b> — START HER UP' });
    }
  }

  // village: fund office door / banker / gun store / combiner / town hall / lambo
  if (!village.office.unlocked) {
    const d = village.office.doorPos.distanceTo(eye);
    if (d < 2.6) cands.push({ d, type: 'officeDoor', prompt: `<b>F</b> — Private Fund Placement <b>[${ECON.fundOfficeCost}]</b>` });
  } else {
    const d = village.office.bankerPos.distanceTo(player.pos);
    if (d < 2.6) cands.push({ d, type: 'bank', prompt: '<b>F</b> — Talk to the banker' });
  }
  if (village.store.counterPos.distanceTo(player.pos) < 2.8) {
    cands.push({ d: 1, type: 'shop', prompt: '<b>F</b> — Browse the gun store' });
  }
  if (village.combiner.pos.distanceTo(player.pos) < 2.6) {
    cands.push({ d: 0.9, type: 'combine', prompt: '<b>F</b> — Gun Combiner' });
  }
  if (village.townhall.reevePos.distanceTo(player.pos) < 2.8) {
    cands.push({ d: 1, type: 'quests', prompt: '<b>F</b> — Speak with the Reeve' });
  }
  if (village.showroom.pos.distanceTo(player.pos) < 3) {
    cands.push({ d: 1.1, type: 'lambo', prompt: `<b>F</b> — Buy the RAVAGER LX <b>[${ECON.lamboPrice.toLocaleString()}]</b>` });
  }

  cands.sort((a, b) => a.d - b.d);
  return cands[0] || null;
}

function doInteract(it, dt) {
  if (it.type === 'window') {
    if (fHeld) {
      repairT += dt;
      if (repairT > 0.55) {
        repairT = 0;
        if (world.addBoard(it.win)) { addPoints(ECON.boardRepair); quests.addBoard(); audio.boardAdd(); }
      }
    }
    return;
  }
  if (!fEdge) return;
  switch (it.type) {
    case 'door':
      if (spend(it.door.cost)) {
        world.openDoor(it.door);
        audio.doorOpen(); audio.buy();
        hud.showMsg(`${it.door.name} opened`);
      } else audio.deny();
      break;
    case 'perk': {
      const cost = ECON.perks[it.pm.key].cost;
      if (spend(cost)) {
        player.perks.add(it.pm.key);
        if (it.pm.key === 'tonic') { player.maxHealth = 250; player.health = 250; }
        audio.perkJingle();
        hud.perkHUD(player.perks);
        hud.showMsg(`${it.pm.name} — ${ECON.perks[it.pm.key].desc}`);
      } else audio.deny();
      break;
    }
    case 'wallbuy': {
      if (it.owned) {
        const def = weaponDef(it.owned);
        if (it.owned.reserve >= def.reserve) { hud.showMsg('Ammo full'); audio.deny(); break; }
        if (spend(it.cost)) { it.owned.reserve = def.reserve; audio.buy(); inventory.renderAll(); updateAmmoHUD(); }
        else audio.deny();
      } else if (spend(it.cost)) {
        inventory.addItem(makeWeaponItem(it.wb.key));
        audio.buy();
      } else audio.deny();
      break;
    }
    case 'box':
      if (spend(box.cost)) box.roll();
      else audio.deny();
      break;
    case 'boxTake': {
      const item = box.take();
      if (item && !inventory.addItem(item)) hud.showMsg('Inventory full');
      break;
    }
    case 'pap':
      if (spend(pap.cost)) {
        const idx = inventory.slots.indexOf(it.held);
        if (idx >= 0) inventory.slots[idx] = null;
        inventory.renderAll();
        pap.insert(it.held);
        onSelectionChanged();
      } else audio.deny();
      break;
    case 'papTake': {
      const hasRoom = !inventory.slots[inventory.sel] || inventory.slots.some((s) => !s);
      if (!hasRoom) { hud.showMsg('Inventory full'); audio.deny(); break; }
      const upgraded = pap.takeOut();
      if (upgraded) {
        icons.refresh(upgraded);
        if (!inventory.slots[inventory.sel]) inventory.slots[inventory.sel] = upgraded;
        else inventory.addItem(upgraded);
        inventory.renderAll();
        onSelectionChanged();
        hud.showMsg(`${weaponDef(upgraded).name} ready`);
        audio.perkJingle();
      }
      break;
    }
    case 'car':
      car.enter();
      hud.setPrompt(null);
      break;
    case 'scav': {
      const got = gatherNode(it.n, inventory);
      if (got) hud.showMsg(`+${got.amount} ${got.mat}`);
      break;
    }
    case 'station':
      inventory.open(it.st.kind);
      document.exitPointerLock?.();
      break;
    case 'radio':
      openPanel(laptop);
      break;
    case 'nuketable':
      if (!it.held) { audio.deny(); break; }
      inventory.consume('nuclearBrick', 1);
      it.held.nuclear = true;
      it.held.name = `☢ ${it.held.name}`;
      weapons.refreshDef();
      icons.refresh(it.held);
      inventory.renderAll();
      updateAmmoHUD();
      effects.explosion(player.pos.clone().setY(player.pos.y + 1.2), 0x54ff3a, 1.4);
      audio.enchant();
      hud.showMsg(`${weaponDef(it.held).name} — +25% damage, leaves toxic waste`);
      break;
    case 'trap':
      if (spend(world.trap.cost)) {
        world.trap.state = 'active';
        world.trap.t = 25;
        audio.zap();
        hud.showMsg('Trap active');
      } else audio.deny();
      break;
    // ---- expansion ----
    case 'gunpick': {
      const item = groundGuns.take(it.gg);
      if (item && !inventory.addItem(item)) {
        groundGuns.spawn(it.gg.group.position.clone(), item); // no room — put it back
        hud.showMsg('Inventory full');
      } else if (item) {
        audio.pickup();
        hud.showMsg(`${weaponDef(item).name} taken`);
      }
      break;
    }
    case 'chest': {
      it.chest.opened = true;
      it.chest.lid.rotation.x = -1.1;
      it.chest.glow.intensity = 14;
      audio.chestOpen();
      const loot = mines.rollChestLoot(it.chest);
      addPoints(loot.points);
      loot.items.forEach((item, i) => {
        const off = new THREE.Vector3(Math.cos(i * 2.4) * 0.8, 0.2, Math.sin(i * 2.4) * 0.8);
        drops.spawnItem(loot.at.clone().add(off), item, item.id === 'diamond' ? 0x63e8e2 : 0xf7d774, { force: true });
      });
      if (it.chest.rotor) hud.banner('WINGS FOR THE WAR BIRD');
      break;
    }
    case 'note':
      hud.showNote(it.n.title, it.n.text);
      break;
    case 'power':
      if (spend(world.powerSwitch.cost)) {
        world.powerSwitch.on = true;
        world.powerSwitch.lever.rotation.x = -0.7;
        world.powerSwitch.lightMat.emissive.setHex(0x54ff3a);
        world.powerSwitch.lightMat.color.setHex(0x0a330a);
        audio.powerOn();
        hud.banner('⚡ POWER RESTORED ⚡');
        hud.showMsg('Every perk machine and the Reforge hum to life…');
        facility.powerOn();
      } else audio.deny();
      break;
    case 'heliInstall': {
      const [part, itemId] = it.part;
      inventory.consume(itemId, 1);
      world.heli.parts[part] = true;
      world.heli.meshes[part].visible = true;
      audio.boardAdd();
      const left = Object.values(world.heli.parts).filter((v) => !v).length;
      hud.showMsg(left ? `${TOOL_DEFS[itemId].name} installed — ${left} to go` : 'She’s whole again. Now: POWER.');
      break;
    }
    case 'heliFly':
      world.heli.done = true;
      audio.heliStart();
      hud.banner('THE ROTORS TURN');
      setTimeout(() => { if (!state.won) win(); }, 5200);
      break;
    case 'officeDoor':
      if (spend(ECON.fundOfficeCost)) {
        village.office.unlocked = true;
        village.office.doorGroup.visible = false;
        const i = world.colliders.indexOf(village.office.doorSolid);
        if (i >= 0) world.colliders.splice(i, 1);
        const j = world.shotSolids.indexOf(village.office.doorSolid);
        if (j >= 0) world.shotSolids.splice(j, 1);
        audio.doorOpen();
        hud.showMsg('Welcome to Private Fund Placement');
      } else audio.deny();
      break;
    case 'bank': openPanel(market); break;
    case 'shop': openPanel(store); break;
    case 'combine': openPanel(combiner); break;
    case 'quests': openPanel(quests); break;
    case 'lambo':
      if (inventory.countOf('lamboKeys') > 0) { hud.showMsg('You already own her.'); audio.deny(); break; }
      if (spend(ECON.lamboPrice)) {
        inventory.addItem(makeTool('lamboKeys'));
        audio.perkJingle();
        hud.banner('RAVAGER LX');
        hud.showMsg('The keys are yours. Try not to hit the fountain.');
      } else audio.deny();
      break;
  }
}

// ---------------- per-item LMB/RMB ----------------
function handleItemActions(dt) {
  const item = inventory.selectedItem();
  if (craft.crafting) { mouse.clicked = false; mouse.rclicked = false; return; }

  if (item?.kind === 'weapon') {
    player.ads = mouse.rdown;
    if (mouse.down || mouse.clicked) weapons.triggerDown(zombies);
    else weapons.triggerUp();
  } else {
    player.ads = false;
    weapons.triggerUp();
    if (item?.build) {
      const consumesSelf = ['bench', 'anvil', 'cabinet', 'countertop', 'radio', 'nucleartable'].includes(item.build);
      const fromStack = item.build === 'block' || item.build === 'gblock';
      if (mouse.clicked) {
        if (build.valid) {
          const placed = build.place();
          if (placed) {
            if (consumesSelf) {
              inventory.slots[inventory.sel] = null;
            } else if (fromStack) {
              item.count--;
              if (item.count <= 0) inventory.slots[inventory.sel] = null;
            } else {
              for (const [id, n] of Object.entries(BUILD_MATS[item.build] || {})) inventory.consume(id, n);
            }
            inventory.renderAll();
            onSelectionChanged();
          }
        } else if (fromStack && weapons.meleeCd <= 0) {
          // no valid placement → swing the block (75% of the pickaxe's bite)
          weapons.melee(zombies, { dmg: 82, knock: 2.2, mobs: weapons.mobs });
        } else audio.deny();
      }
      if (mouse.rclicked && !consumesSelf) {
        const removed = build.removeTargeted();
        if (removed) {
          if (removed.piece === 'bench' || removed.piece === 'anvil' || removed.piece === 'cabinet' ||
              removed.piece === 'countertop' || removed.piece === 'radio' || removed.piece === 'nucleartable') {
            inventory.addItem(makeTool(removed.piece === 'radio' ? 'wifiRadio'
              : removed.piece === 'nucleartable' ? 'nuclearTable' : removed.piece));
          } else if (removed.piece === 'block') inventory.addItem(makeMaterial('rock', 1));
          else if (removed.piece === 'gblock') inventory.addItem(makeMaterial('granite', 1));
          else inventory.addItem(makeMaterial('wood', ECON.buildRefund));
        }
      }
    } else if (item?.id === 'carKeys' || item?.id === 'lamboKeys') {
      if (mouse.clicked && deployCd <= 0) {
        deployCd = 1.2;
        const fwd = new THREE.Vector3(-Math.sin(player.yaw.rotation.y), 0, -Math.cos(player.yaw.rotation.y));
        const dp = player.pos.clone().addScaledVector(fwd, 4.6);
        car.deploy(dp, player.yaw.rotation.y, item.id === 'lamboKeys' ? 'lambo' : 'coupe');
      }
    } else if (item?.id === 'pickaxe') {
      // mining: hold LMB on a tree/ore vein; swings hit zombies too
      if (mouse.down || mouse.clicked) {
        const node = harvest.hitTest(player.eyePosition(), player.eyeDirection());
        if (node) {
          state.mineT += dt;
          if (state.mineT >= 0.42) {
            state.mineT = 0;
            weapons.meleeAnim = 1;
            harvest.chip(node);
          }
        } else if (weapons.meleeCd <= 0 && mouse.clicked) {
          weapons.melee(zombies, { dmg: 110, tag: 'pickaxe', cd: 0.55, mobs: weapons.mobs });
        }
      } else state.mineT = 0;
    } else if (item?.id === 'sandwich') {
      if (mouse.clicked) {
        if (player.heal(80)) {
          item.count--;
          if (item.count <= 0) inventory.slots[inventory.sel] = null;
          inventory.renderAll();
          onSelectionChanged();
          hud.showMsg('Delicious.');
        } else hud.showMsg('Already full');
      }
    } else if (!item) {
      // bare fists — berserker turns them into wrecking balls
      if (mouse.clicked && weapons.meleeCd <= 0) {
        const berserk = state.berserkT > 0;
        weapons.melee(zombies, {
          dmg: berserk ? 660 : 60,
          knock: berserk ? 5 : 2.2,
          reach: berserk ? 2.7 : 2.2,
          cd: berserk ? 0.4 : 0.6,
          mobs: weapons.mobs,
        });
      }
    }
  }
  mouse.clicked = false;
  mouse.rclicked = false;
}

// ---------------- start / death / win ----------------
function start() {
  audio.start();
  document.getElementById('menuOverlay').style.display = 'none';
  hud.show();
  tryLock();
  state.playing = true;
  player.reset();
  player.pos.copy(world.spawnPoint);
  inventory.reset();
  inventory.addItem(makeWeaponItem('mauser'));
  inventory.addItem(makeTool('pickaxe'));
  inventory.addItem(makeTool('buildWall'));
  inventory.addItem(makeTool('buildFloor'));
  inventory.addItem(makeTool('buildStairs'));
  inventory.addItem(makeTool('carKeys'));
  inventory.select(0);
  onSelectionChanged();
  hud.setPoints(state.points);
  hud.perkHUD(player.perks);
  hud.setHealth(player.health, player.maxHealth);
  hud.bossHUD(null);
  setTimeout(() => startRound(1), 900);
}

function die() {
  if (car.driving) car.exit(); // release the chase camera
  player.dead = true;
  state.playing = false;
  laptop.stop();
  document.exitPointerLock?.();
  document.getElementById('survStats').textContent =
    `Survived ${state.round} round${state.round > 1 ? 's' : ''} · ${state.kills} kills`;
  document.getElementById('deadOverlay').style.display = 'flex';
}

function win() {
  state.won = true;
  state.playing = false;
  laptop.stop();
  document.exitPointerLock?.();
  document.getElementById('winStats').textContent =
    `Escaped on round ${state.round} · ${state.kills} kills · ${state.points.toLocaleString()} points banked`;
  document.getElementById('winOverlay').style.display = 'flex';
}

document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('restartBtn').addEventListener('click', () => location.reload());
document.getElementById('winRestartBtn').addEventListener('click', () => location.reload());
document.getElementById('noteModal').addEventListener('click', () => hud.hideNote());

// ---------------- guided missile camera ----------------
let guidingActive = false;
function beginGuidedCam() {
  guidingActive = true;
  player.viewLocked = true;
  scene.attach(camera);
}
function endGuidedCam() {
  guidingActive = false;
  player.viewLocked = false;
  player.pitch.add(camera);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);
  camera.fov = player.baseFov;
  camera.updateProjectionMatrix();
}
function updateGuidedCam() {
  const m = weapons.guiding;
  if (!m) { if (guidingActive) endGuidedCam(); return; }
  if (!guidingActive) beginGuidedCam();
  const dir = m.vel.clone().normalize();
  camera.position.copy(m.mesh.position).addScaledVector(dir, -1.7).add(new THREE.Vector3(0, 0.6, 0));
  camera.lookAt(m.mesh.position.clone().addScaledVector(dir, 3));
  camera.fov = 82;
  camera.updateProjectionMatrix();
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();

function updateGame(dt) {
  state.time += dt;
  world.update(dt, state.time, player.pos);

  const uiBlocked = inventory.isOpen || uiPanelOpen();

  if (state.playing && !player.dead && !state.paused && !uiBlocked) {
    if (!car.driving) {
      player.update(dt, { keys, jetThrust: keys.has('Space') });
      player.tintSpeed = inventory.tintBonuses().speed * (state.berserkT > 0 ? 1.12 : 1);
      build.update();
      handleItemActions(dt);

      // ---- F priority chain ----
      // 0. nukeling on your head → MASH F
      // 1. PaP'd bazooka rocket in flight → take control
      // 2. zombie in your face → shove
      // 3. world interaction
      // 4. free bash
      const latched = facility.latchedCount();
      const canGuide = weapons.item && weaponDef(weapons.item).guided &&
        weapons.lastMissile && !weapons.guiding;
      const fists = !inventory.selectedItem();
      const markusVictim = fists && !state.markus && weapons.meleeCd <= 0 ? findMarkusVictim() : null;
      const threat = zombies.zombies.some((z) =>
        !z.dead && z.alive && z.state === 'hunt' &&
        Math.abs(z.pos.y - player.pos.y) < 1.6 &&
        Math.hypot(z.pos.x - player.pos.x, z.pos.z - player.pos.z) < 1.9);
      const it = nearestInteract();

      if (latched > 0) {
        hud.setPrompt(`<b>MASH F</b> — RIP IT OFF (${latched})`);
        if (fEdge) { facility.shakeOne(); hud.damageFlash(); }
      } else if (markusVictim) {
        hud.setPrompt('<b>F</b> — THE MARKUS SPECIAL');
        if (fEdge) startMarkus(markusVictim);
      } else if (canGuide && fEdge) {
        if (weapons.startGuiding()) hud.showMsg('Missile control — steer with the mouse');
      } else if (threat && fEdge && weapons.meleeCd <= 0 && !fists) {
        weapons.melee(zombies);
        hud.setPrompt(it ? it.prompt : null);
      } else {
        hud.setPrompt(it ? it.prompt : (threat && !fists ? '<b>F</b> — Shove'
          : canGuide ? '<b>F</b> — Guide the missile' : null));
        if (it) doInteract(it, dt);
        else {
          repairT = 0;
          if (fEdge && weapons.meleeCd <= 0 && inventory.selectedItem()?.kind === 'weapon') {
            weapons.melee(zombies); // bash at will
          }
        }
      }
      fEdge = false;

      // sliding bowls the horde over
      if (player.slideT > 0) {
        for (const z of zombies.zombies) {
          if (z.dead || !z.alive || z.state === 'grabbed') continue;
          const to = new THREE.Vector3(z.pos.x - player.pos.x, 0, z.pos.z - player.pos.z);
          const d = to.length();
          if (d < 1.5 && Math.abs(z.pos.y - player.pos.y) < 1.6 && z.kb.lengthSq() < 4) {
            z.applyKnockback(to.normalize(), z.boss ? 0.5 : 3.6);
            audio.hit();
          }
        }
      }
    } else {
      // driving: exit prompt + F
      hud.setPrompt(Math.abs(car.speed) < 1 ? '<b>F</b> — Exit vehicle' : null);
      if (fEdge && Math.abs(car.speed) < 1) { car.exit(); hud.setPrompt(null); }
      fEdge = false;
    }
    deployCd = Math.max(0, deployCd - dt);

    car.update(dt, keys, zombies);
    pap.update(dt);
    craft.update(dt);
    drops.update(dt);
    updateScavenge(world.scavenge, dt);
    updateTrap(dt);
    updateRound(dt);
    zombies.update(dt);
    box.update(dt, state.time);
    weapons.update(dt, zombies, mouseDelta);
    updateGuidedCam();

    // expansion systems
    harvest.update(dt);
    mobs.update(dt);
    powerups.update(dt);
    groundGuns.update(dt, player.pos, (p) => groundHeightAt(world.colliders, p.x, p.z, p.y + 0.4, 0.25));
    market.update(dt);
    facility.update(dt);
    barrels.update(dt);
    updateGoops(dt);
    updateMarkus(dt);

    // powerup timers
    if (state.instaT > 0) {
      state.instaT -= dt;
      if (state.instaT <= 0) { zombies.instaKill = false; hud.showMsg('Insta-Kill fades'); }
    }
    if (state.berserkT > 0) {
      state.berserkT -= dt;
      if (state.berserkT <= 0) {
        weapons.berserk = false;
        hud.berserkFx(false);
        hud.showMsg('The rage subsides…');
      }
    }
    if (state.doubleT > 0) state.doubleT -= dt;
    const puActive = [];
    if (state.instaT > 0) puActive.push({ name: 'INSTA-KILL', icon: '💀', t: state.instaT, css: '#ff6a5a' });
    if (state.doubleT > 0) puActive.push({ name: 'DOUBLE POINTS', icon: '✖2', t: state.doubleT, css: '#f7d774' });
    if (state.berserkT > 0) puActive.push({ name: 'BERSERKER', icon: '💪', t: state.berserkT, css: '#ff2a90' });
    hud.powerupHUD(puActive);

    // nukeling gas: vision + damage over time
    hud.gasFx(facility.latchedCount());
    if (facility.latchedCount() > 0) {
      state.gasT += dt;
      if (state.gasT > 0.8) {
        state.gasT = 0;
        player.takeDamage(2.5 * facility.latchedCount());
      }
    }

    // village NPCs idle
    for (const npc of village.npcs) {
      npc.t += dt;
      npc.head.rotation.y = Math.sin(npc.t * 0.6) * 0.35;
    }

    // boss bars: the Specimen takes priority during its fight
    if (facility.boss.state === 'fight' && !facility.boss.dead) {
      hud.bossHUD(facility.boss, 'THE SPECIMEN');
    } else if (state.boss && !state.boss.dead) {
      if (state.boss.hp < state.boss.maxHp * 0.3) state.boss.speed = 3.2;
      hud.bossHUD(state.boss, 'THE ABOMINATION');
    } else {
      hud.bossHUD(null);
    }

    const def = weapons.def;
    hud.setHeat(!!def?.flame, weapons.heat, def?.flame?.maxHeat || 8);
    hud.setHealth(player.health, player.maxHealth);
    hud.updateHealthFx(player.health, player.maxHealth, dt);
    hud.updateFuel(player.jetpack, player.jetFuel);
    hud.updateArmor(player.armor, player.maxArmor);
    updateAmmoHUD();

  } else {
    hud.updateHealthFx(player.health, player.maxHealth, dt);
    if (state.playing && uiBlocked) {
      // world keeps breathing behind panels, but nothing hunts
      market.update(dt);
    }
  }

  // death gate (works no matter what killed you, mid-frame or not)
  if (state.playing && player.dead) {
    if (player.perks.has('revive')) {
      // Quick Revive: cheat death once — full heal, 3s of invulnerability,
      // and the horde gets hurled away so it actually FEELS like a revive
      player.perks.delete('revive');
      hud.perkHUD(player.perks);
      player.dead = false;
      player.health = player.maxHealth;
      player.timeSinceHurt = 0;
      player.invulnT = 3;
      hud.banner('⚕ QUICK REVIVE ⚕');
      hud.showMsg('Back from the brink — 3s of grace, RUN');
      audio.heal();
      audio.perkJingle();
      effects.explosion(player.pos.clone().setY(player.pos.y + 1), 0x3a7cc8, 5);
      for (const z of zombies.zombies) {
        if (z.dead || !z.alive) continue;
        const to = new THREE.Vector3(z.pos.x - player.pos.x, 0, z.pos.z - player.pos.z);
        if (to.length() < 8) z.applyKnockback(to.normalize(), 9);
      }
    } else die();
  }

  inventory.update(dt);
  effects.update(dt);
  mouseDelta.x = 0;
  mouseDelta.y = 0;
}

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  updateGame(dt);
  renderer.render(scene, camera);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- headless test hook ----------------
if (TEST_MODE) {
  window.__game = {
    THREE, scene, camera, renderer, state,
    player, world, zombies, weapons, inventory, hud, box, pap, build, car, craft, drops,
    harvest, mobs, mines, village, facility, market, store, combiner, quests, laptop,
    powerups, groundGuns, goops, barrels,
    startMarkus, findMarkusVictim,
    addPoints, spend, startRound, spawnZombie, spawnBoss, dropItemIntoWorld,
    nearestInteract, doInteract: (it) => { fEdge = true; doInteract(it, 1 / 60); fEdge = false; },
    start, win,
    keys,
    pressKey: (code) => keys.add(code),
    releaseKey: (code) => keys.delete(code),
    pressF: () => { fHeld = true; fEdge = true; },
    releaseF: () => { fHeld = false; },
    click: () => { mouse.clicked = true; mouse.down = true; setTimeout(() => (mouse.down = false), 0); },
    holdMouse: (down) => { mouse.down = down; if (down) mouse.clicked = true; },
    teleport: (x, y, z) => { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
    lookAt: (yaw, pitch) => { player.yaw.rotation.y = yaw; player.pitch.rotation.x = pitch; },
    aimAt: (x, y, z) => {
      const dx = x - player.pos.x, dy = y - (player.pos.y + 1.62), dz = z - player.pos.z;
      player.yaw.rotation.y = Math.atan2(-dx, -dz);
      player.pitch.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
    },
    fire: () => { weapons.triggerDown(zombies); weapons.triggerUp(); },
    simulate: (seconds) => {
      const step = 1 / 60;
      for (let t = 0; t < seconds; t += step) updateGame(step);
      renderer.render(scene, camera);
    },
    simulateDt: (seconds, dt) => { // worst-case low-FPS stepping
      for (let t = 0; t < seconds; t += dt) updateGame(dt);
      renderer.render(scene, camera);
    },
  };
  start();
}
