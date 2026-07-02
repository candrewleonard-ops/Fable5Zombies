import * as THREE from 'three';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
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
import { WEAPONS, weaponDef, ECON, ROUND, makeWeaponItem, makeTool } from './items.js';

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
renderer.toneMappingExposure = 1.25;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);

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
const pap = new PackAPunch(scene, world, effects);
const build = new BuildSystem(scene, world, player, camera);
const car = new CarSys(scene, world, player, camera);

// ---------------- game state ----------------
const state = {
  playing: false, paused: false, round: 0, points: ECON.startPoints,
  kills: 0, toSpawn: 0, spawnT: 2, intermission: 0, time: 0,
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
  onDropItem: (item) => { hud.showMsg(`${item.name} dropped — inventory full`); },
  onCraftWeapon: (recipe) => { inventory.close(); craft.startSequence(recipe); },
  getRound: () => state.round,
  getKills: () => state.kills,
});
const craft = new Craft(scene, camera, player, inventory, effects);
const drops = new Drops(scene, player, inventory);

player.onArmorAbsorb = (a) => inventory.absorbArmorDamage(a);
player.onHurt = () => hud.damageFlash();
player.onJetSpark = (pos) => effects.sparksColored(pos, 0xffa040);

// ---------------- economy ----------------
function addPoints(n) {
  state.points += n;
  hud.setPoints(state.points);
  hud.feed(n);
}
function spend(n) {
  if (state.points < n) { hud.showMsg('Not enough points'); return false; }
  state.points -= n;
  hud.setPoints(state.points);
  hud.feed(-n);
  return true;
}

// ---------------- perks ----------------
weapons.getMods = () => ({
  dmgMult: player.perks.has('deadeye') ? 1.4 : 1,
  rpmMult: player.perks.has('rapid') ? 1.12 : 1,
  reloadMult: player.perks.has('rapid') ? 0.55 : 1,
});

// ---------------- selection / loadout ----------------
function onSelectionChanged() {
  const item = inventory.selectedItem();
  weapons.equip(item?.kind === 'weapon' ? item : null);
  build.setActive(item?.kind === 'tool' && item.build ? item.build : null);

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

// ---------------- combat hooks ----------------
weapons.onShot = () => { updateAmmoHUD(); inventory.renderHUDHotbar(); };
weapons.onHit = (z, dmg, part) => {
  addPoints(ECON.hitPoints);
  hud.hitmarker(part === 'head');
  audio.hit();
};
zombies.onKill = (z, headshot) => {
  state.kills++;
  addPoints(headshot ? ECON.headshotKillBonus : ECON.killBonus);
  if (headshot) hud.hitmarker(true);
  if (Math.random() < 0.12) drops.spawn(z.pos.clone());
};
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
car.onRunOverHit = (z, killed) => { addPoints(ECON.hitPoints); };
car.onMessage = (m) => hud.showMsg(m);
build.getPoints = () => state.points;

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
  noLock = true;
  canvas.style.cursor = 'none';
  if (state.playing) hud.showMsg('Mouse-look active · Esc to pause');
}
document.addEventListener('pointerlockchange', () => {
  if (noLock || inventory.isOpen) return;
  const locked = document.pointerLockElement === canvas;
  if (state.playing && !player.dead) {
    state.paused = !locked;
    document.getElementById('pauseOverlay').style.display = locked ? 'none' : 'flex';
  }
});
document.getElementById('pauseOverlay').addEventListener('click', () => {
  if (!noLock) tryLock();
  else { state.paused = false; document.getElementById('pauseOverlay').style.display = 'none'; }
});
document.getElementById('resumeBtn')?.addEventListener('click', (e) => e.stopPropagation());

// ---------------- input ----------------
document.addEventListener('mousemove', (e) => {
  const canLook = (document.pointerLockElement === canvas || noLock || TEST_MODE);
  if (canLook && state.playing && !state.paused && !inventory.isOpen && !car.driving) {
    player.onMouseMove(e.movementX, e.movementY);
    mouseDelta.x += e.movementX;
    mouseDelta.y += e.movementY;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (!state.playing) return;

  switch (e.code) {
    case 'KeyT':
      if (player.dead || craft.crafting || car.driving) break;
      inventory.toggle();
      if (inventory.isOpen) {
        weapons.triggerUp();
        document.exitPointerLock?.();
      }
      break;
    case 'Escape':
      if (inventory.isOpen) inventory.close();
      else if (noLock && !player.dead) {
        state.paused = !state.paused;
        document.getElementById('pauseOverlay').style.display = state.paused ? 'flex' : 'none';
      }
      break;
    case 'KeyR':
      if (!inventory.isOpen && !state.paused && !car.driving) weapons.startReload();
      break;
    case 'KeyF':
      fHeld = true; fEdge = true;
      break;
    case 'Space':
      if (!inventory.isOpen && !state.paused && !player.jetpack && !car.driving) player.jump();
      e.preventDefault();
      break;
    default:
      if (/^Digit[1-9]$/.test(e.code) && !inventory.isOpen && !state.paused && !car.driving) {
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
  if (!state.playing || inventory.isOpen || state.paused || car.driving) return;
  const d = e.deltaY > 0 ? 1 : -1;
  inventory.select(inventory.sel + d);
}, { passive: true });

document.addEventListener('mousedown', (e) => {
  if (!state.playing || inventory.isOpen || state.paused || car.driving || player.dead || craft.crafting) return;
  if (document.pointerLockElement !== canvas && !noLock && !TEST_MODE) return;
  if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  if (e.button === 2) { mouse.rdown = true; mouse.rclicked = true; }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.rdown = false;
});
document.addEventListener('contextmenu', (e) => {
  if (state.playing && !inventory.isOpen) e.preventDefault();
});

// ---------------- rounds ----------------
function startRound(r) {
  state.round = r;
  state.toSpawn = NO_ZOMBIES ? 0 : ROUND.count(r);
  state.spawnT = 1.2;
  hud.setRound(r);
  const blood = r % 5 === 0 && r > 0;
  hud.banner(blood ? `☽ Blood Moon — Round ${r} ☾` : `Round ${r}`);
  world.moonLight.color.setHex(blood ? 0xd86a5a : 0x9db4dd);
  state.bloodMoon = blood;
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
  zombies.spawnAt(win, { hp: ROUND.hp(state.round), speed: pickSpeed(state.round), bloodMoon: state.bloodMoon });
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
    // player tick
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
    if (d < 2.2) cands.push({ d, type: 'perk', pm, prompt: `<b>F</b> — Buy ${pm.name} <b>[${pm.cost}]</b>` });
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
    const held = inventory.selectedWeapon();
    if (pap.state === 'idle' && held && !held.pap) {
      cands.push({ d: 0.6, type: 'pap', held, prompt: `<b>F</b> — Reforge ${held.name} <b>[${pap.cost}]</b>` });
    } else if (pap.ready) {
      cands.push({ d: 0.4, type: 'papTake', prompt: `<b>F</b> — Take ★ ${pap.item ? WEAPONS[pap.item.weaponKey].name : ''}` });
    } else if (pap.state !== 'idle') {
      cands.push({ d: 0.7, type: 'noop', prompt: 'Reforging…' });
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
    if (d < 2.3) cands.push({ d, type: 'station', st, prompt: `<b>F</b> — Use ${st.kind === 'bench' ? 'Crafting Bench (3×3)' : 'Anvil'}` });
  }
  const td = world.trap.switchPos.distanceTo(eye);
  if (td < 2.5) {
    const T = world.trap;
    if (T.state === 'ready') cands.push({ d: 1, type: 'trap', prompt: `<b>F</b> — Electro-trap <b>[${T.cost}]</b>` });
    else if (T.state === 'active') cands.push({ d: 1, type: 'noop', prompt: '⚡ TRAP ACTIVE ⚡' });
    else cands.push({ d: 1, type: 'noop', prompt: `Trap cooling — ${Math.ceil(T.t)}s` });
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
        if (world.addBoard(it.win)) { addPoints(ECON.boardRepair); audio.boardAdd(); }
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
      if (player.perks.size >= 4) { hud.showMsg('Max 4 perks'); audio.deny(); break; }
      const cost = ECON.perks[it.pm.key].cost;
      if (spend(cost)) {
        player.perks.add(it.pm.key);
        if (it.pm.key === 'tonic') { player.maxHealth = 250; player.health = 250; }
        audio.perkJingle();
        hud.perkHUD(player.perks);
        hud.showMsg(`${it.pm.name} acquired`);
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
      const upgraded = pap.takeOut();
      if (upgraded) {
        icons.refresh(upgraded);
        if (!inventory.slots[inventory.sel]) inventory.slots[inventory.sel] = upgraded;
        else inventory.addItem(upgraded);
        inventory.renderAll();
        onSelectionChanged();
        hud.showMsg(`${upgraded.name} ready`);
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
    case 'trap':
      if (spend(world.trap.cost)) {
        world.trap.state = 'active';
        world.trap.t = 25;
        audio.zap();
        hud.showMsg('Trap active');
      } else audio.deny();
      break;
  }
}

// ---------------- per-item LMB/RMB ----------------
function handleItemActions() {
  const item = inventory.selectedItem();
  if (!item || craft.crafting) { mouse.clicked = false; mouse.rclicked = false; return; }

  if (item.kind === 'weapon') {
    player.ads = mouse.rdown;
    if (mouse.down || mouse.clicked) weapons.triggerDown(zombies);
    else weapons.triggerUp();
  } else {
    player.ads = false;
    weapons.triggerUp();
    if (item.kind === 'tool' && item.build) {
      const isStation = item.build === 'bench' || item.build === 'anvil';
      if (mouse.clicked) {
        if (build.valid && (isStation || spend(ECON.buildCost))) {
          const placed = build.place();
          if (placed && isStation) {
            inventory.slots[inventory.sel] = null;
            inventory.renderAll();
            onSelectionChanged();
          }
        } else if (!build.valid) audio.deny();
      }
      if (mouse.rclicked && !isStation) {
        const removed = build.removeTargeted();
        if (removed) {
          if (removed.piece === 'bench' || removed.piece === 'anvil') inventory.addItem(makeTool(removed.piece));
          else addPoints(ECON.buildRefund);
        }
      }
    } else if (item.id === 'carKeys') {
      deployCd -= 0;
      if (mouse.clicked && deployCd <= 0) {
        deployCd = 1.2;
        const fwd = new THREE.Vector3(-Math.sin(player.yaw.rotation.y), 0, -Math.cos(player.yaw.rotation.y));
        const dp = player.pos.clone().addScaledVector(fwd, 4.6);
        car.deploy(dp, player.yaw.rotation.y);
      }
    }
  }
  mouse.clicked = false;
  mouse.rclicked = false;
}

// ---------------- start / death ----------------
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
  inventory.addItem(makeTool('buildWall'));
  inventory.addItem(makeTool('buildFloor'));
  inventory.addItem(makeTool('buildStairs'));
  inventory.addItem(makeTool('carKeys'));
  inventory.select(0);
  onSelectionChanged();
  hud.setPoints(state.points);
  hud.perkHUD(player.perks);
  setTimeout(() => startRound(1), 900);
}

function die() {
  player.dead = true;
  state.playing = false;
  document.exitPointerLock?.();
  document.getElementById('survStats').textContent =
    `Survived ${state.round} round${state.round > 1 ? 's' : ''} · ${state.kills} kills`;
  document.getElementById('deadOverlay').style.display = 'flex';
}

document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('restartBtn').addEventListener('click', () => location.reload());

// ---------------- main loop ----------------
const clock = new THREE.Clock();

function updateGame(dt) {
  state.time += dt;
  world.update(dt, state.time);

  if (state.playing && !player.dead && !state.paused && !inventory.isOpen) {
    if (!car.driving) {
      player.update(dt, { keys, jetThrust: keys.has('Space') });
      build.update();
      handleItemActions();

      // F interact scan
      const it = nearestInteract();
      hud.setPrompt(it ? it.prompt : null);
      if (it) doInteract(it, dt);
      else repairT = 0;
      fEdge = false;
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

    hud.updateHealthFx(player.health, player.maxHealth, dt);
    hud.updateFuel(player.jetpack, player.jetFuel);
    hud.updateArmor(player.armor, player.maxArmor);
    updateAmmoHUD();

    if (player.dead) die();
  } else {
    hud.updateHealthFx(player.health, player.maxHealth, dt);
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

// ---------------- zombie spawn helper on manager ----------------
// (weighted window selection lives here; manager exposes spawnAt)

// ---------------- headless test hook ----------------
if (TEST_MODE) {
  window.__game = {
    THREE, scene, camera, renderer, state,
    player, world, zombies, weapons, inventory, hud, box, pap, build, car, craft, drops,
    addPoints, spend, startRound, spawnZombie,
    start,
    keys,
    pressKey: (code) => keys.add(code),
    releaseKey: (code) => keys.delete(code),
    pressF: () => { fHeld = true; fEdge = true; },
    releaseF: () => { fHeld = false; },
    click: () => { mouse.clicked = true; mouse.down = true; setTimeout(() => (mouse.down = false), 0); },
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
  };
  start();
}
