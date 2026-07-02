import * as THREE from 'three';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { WeaponSystem } from './weapons.js';
import { ZombieManager } from './zombies.js';
import { Effects } from './effects.js';
import { Inventory } from './inventory.js';
import { HUD } from './hud.js';
import { audio } from './audio.js';
import { WEAPONS, makeWeaponItem, makeArmorItem, makeMedkit } from './items.js';

const params = new URLSearchParams(location.search);
const TEST_MODE = params.has('test');
const NO_ZOMBIES = params.has('nozombies');

const ADS_FOV = { pistol: 58, smg: 55, shotgun: 62, revolver: 48 };

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.06, 400);

const world = createWorld(scene);
const player = new Player(camera, world);
scene.add(player.yaw);

const effects = new Effects(scene, camera);
const weapons = new WeaponSystem(camera, player, world, effects);
const zombies = new ZombieManager(scene, world, player, effects);
const hud = new HUD();

const inventory = new Inventory(player, {
  onLoadoutChange: () => { weapons.equip(inventory.selectedWeapon()); hud.setArmor(player.armor, player.maxArmor); },
  onClose: () => { if (state === 'playing' && !TEST_MODE) lockPointer(); },
});

// ---------------- game state ----------------
let state = 'menu'; // menu | playing | dead
let wave = 0;
let intermission = 0;
let timescale = 1;
let slowmoTimer = 0;
let killstreak = { count: 0, timer: 0 };
let pickups = [];
let paused = false;

const keys = new Set();
const mouseDelta = { x: 0, y: 0 };

// ---------------- pointer lock ----------------
const canvas = renderer.domElement;
function lockPointer() {
  if (TEST_MODE) return;
  canvas.requestPointerLock();
}
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (state === 'playing') {
    paused = !locked && !inventory.isOpen;
    document.getElementById('pause-hint').classList.toggle('hidden', !paused);
  }
});
document.getElementById('pause-hint').addEventListener('click', () => lockPointer());

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas && state === 'playing') {
    player.onMouseMove(e.movementX, e.movementY);
    mouseDelta.x += e.movementX;
    mouseDelta.y += e.movementY;
  }
});

// ---------------- input ----------------
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (state !== 'playing') return;

  switch (e.code) {
    case 'KeyT': // Minecraft-style inventory — on T, not E (E is lean!)
      inventory.toggle();
      if (inventory.isOpen) document.exitPointerLock?.();
      break;
    case 'Escape':
      if (inventory.isOpen) inventory.close();
      break;
    case 'Space':
      if (!inventory.isOpen) player.jump();
      e.preventDefault();
      break;
    case 'KeyR':
      if (!inventory.isOpen) weapons.startReload();
      break;
    case 'KeyF':
      if (!inventory.isOpen) {
        if (inventory.useMedkitQuick()) hud.toast('+50 HP');
      }
      break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
      if (!inventory.isOpen) inventory.selectSlot(Number(e.code.slice(-1)) - 1);
      break;
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

document.addEventListener('mousedown', (e) => {
  if (state !== 'playing' || inventory.isOpen || paused) return;
  if (document.pointerLockElement !== canvas && !TEST_MODE) return;
  if (e.button === 0) weapons.triggerDown(zombies);
  if (e.button === 2) player.ads = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) weapons.triggerUp();
  if (e.button === 2) player.ads = false;
});
document.addEventListener('contextmenu', (e) => {
  if (state === 'playing' && !inventory.isOpen) e.preventDefault();
});

// ---------------- pickups ----------------
function iconTexture(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '48px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 32, 36);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const iconCache = {};

function spawnPickup(pos, payload) {
  if (pickups.length > 14) return;
  const group = new THREE.Group();
  const icon = payload.item ? payload.item.icon : '📦';
  if (!iconCache[icon]) iconCache[icon] = iconTexture(icon);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconCache[icon], transparent: true }));
  sprite.scale.set(0.55, 0.55, 1);
  sprite.position.y = 0.55;
  group.add(sprite);

  const beamColor = payload.kind === 'ammo' ? 0xffd27f
    : payload.kind === 'medkit' ? 0xff6b6b
    : payload.kind === 'armor' ? [0xb48c5a, 0xaabed2, 0xaa5aff][(payload.item.tier || 1) - 1]
    : 0x9dff57;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.12, 3.2, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.position.y = 1.6;
  group.add(beam);

  group.position.copy(pos);
  scene.add(group);
  pickups.push({ group, sprite, payload, t: Math.random() * 6, life: 45 });
}

function rollDrop(z) {
  const p = z.pos.clone();
  if (z.type === 'brute') {
    // brutes always drop something juicy
    if (wave >= 6 && Math.random() < 0.4) spawnPickup(p, { kind: 'weapon', item: makeWeaponItem('revolver') });
    else spawnPickup(p, { kind: 'armor', item: makeArmorItem(['helmet', 'chest', 'legs', 'boots'][Math.random() * 4 | 0], Math.min(3, 2 + (Math.random() < 0.4 ? 1 : 0))) });
    return;
  }
  const r = Math.random();
  if (r < 0.26) spawnPickup(p, { kind: 'ammo' });
  else if (r < 0.36) spawnPickup(p, { kind: 'medkit', item: makeMedkit() });
  else if (r < 0.46) {
    const tier = wave >= 6 ? (Math.random() < 0.25 ? 3 : 2) : wave >= 3 ? (Math.random() < 0.5 ? 2 : 1) : 1;
    spawnPickup(p, { kind: 'armor', item: makeArmorItem(['helmet', 'chest', 'legs', 'boots'][Math.random() * 4 | 0], tier) });
  } else if (r < 0.52 && wave >= 2) {
    const key = wave >= 3 && Math.random() < 0.5 ? 'shotgun' : 'smg';
    spawnPickup(p, { kind: 'weapon', item: makeWeaponItem(key) });
  }
}

let fullToastCooldown = 0;
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.t += dt;
    pk.life -= dt;
    pk.sprite.position.y = 0.55 + Math.sin(pk.t * 2.4) * 0.12;
    pk.sprite.material.rotation = Math.sin(pk.t * 1.2) * 0.15;
    const d = pk.group.position.distanceTo(player.pos);
    let consumed = false;
    if (d < 1.35 && !player.dead) {
      const pay = pk.payload;
      if (pay.kind === 'ammo') {
        const cur = weapons.item;
        if (cur) {
          const amount = WEAPONS[cur.weaponKey].magSize * 2;
          weapons.addReserve(amount);
          hud.toast(`+${amount} AMMO`);
          consumed = true;
        }
      } else {
        if (inventory.addItem(pay.item)) {
          hud.toast(`${pay.item.icon} ${pay.item.name.toUpperCase()}`);
          consumed = true;
        } else if (fullToastCooldown <= 0) {
          hud.toast('INVENTORY FULL');
          fullToastCooldown = 2;
        }
      }
      if (consumed) audio.pickup();
    }
    if (consumed || pk.life <= 0) {
      scene.remove(pk.group);
      pickups.splice(i, 1);
    }
  }
  fullToastCooldown -= dt;
}

// ---------------- waves ----------------
function startWave(n) {
  wave = n;
  zombies.startWave(n);
  hud.setWave(n);
  const blood = n % 5 === 0;
  hud.waveBanner(blood ? `☽ BLOOD MOON — WAVE ${n} ☾` : `WAVE ${n}`, blood);
  audio.waveHorn(blood);
  // blood moon atmosphere
  scene.fog.color.setHex(blood ? 0x1a0708 : 0x070a12);
  scene.background.setHex(blood ? 0x0d0304 : 0x04060c);
  world.moonLight.color.setHex(blood ? 0xd86a5a : 0x8fa8d8);
}

zombies.onRemainingChange = () => hud.setZombiesLeft(zombies.remaining);

zombies.onKill = (z, part) => {
  const headshot = part === 'head';
  const pts = z.def.points + (headshot ? 40 : 0);
  player.points += pts;
  player.kills++;
  hud.setPoints(player.points);
  hud.hitmarker(true);
  hud.killfeed(`${headshot ? '💥 HEADSHOT — ' : ''}${z.type.toUpperCase()} +${pts}`);

  // killstreaks
  killstreak.count = killstreak.timer > 0 ? killstreak.count + 1 : 1;
  killstreak.timer = 2.2;
  if (killstreak.count >= 2) {
    const label = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'RAMPAGE'][Math.min(5, killstreak.count)];
    hud.killfeed(`⚡ ${label}`);
  }

  rollDrop(z);

  // last kill of the wave → bullet time
  if (zombies.remaining === 0) {
    timescale = 0.22;
    slowmoTimer = 1.5;
    hud.slowmo(true);
    audio.slowmo(true);
    intermission = 5;
    hud.waveBanner('WAVE CLEARED', true);
  }
};

zombies.onHurtPlayer = () => {
  hud.damageFlash(1);
  hud.setHealth(player.health, player.maxHealth);
  hud.setArmor(player.armor, player.maxArmor);
};

weapons.onShot = () => hud.setWeapon(weapons.item, weapons.def, weapons.reloading > 0);

// ---------------- start / death / restart ----------------
function startGame() {
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  audio.start();

  player.reset();
  inventory.reset();
  zombies.clear();
  for (const pk of pickups) scene.remove(pk.group);
  pickups = [];

  inventory.addItem(makeWeaponItem('pistol'));
  inventory.addItem(makeMedkit());
  inventory.selectSlot(0);
  weapons.equip(inventory.selectedWeapon());

  state = 'playing';
  paused = false;
  hud.show();
  hud.setHealth(player.health, player.maxHealth);
  hud.setArmor(0, 0);
  hud.setPoints(0);
  intermission = 0;
  timescale = 1;

  startWave(1);
  if (NO_ZOMBIES) { zombies.toSpawn = 0; hud.setZombiesLeft(0); intermission = 9999; }
  lockPointer();
}

function die() {
  state = 'dead';
  document.exitPointerLock?.();
  if (inventory.isOpen) inventory.close();
  weapons.triggerUp();
  hud.hide();
  document.getElementById('death-stats').innerHTML =
    `WAVE ${wave} • ${player.kills} KILLS • ${player.points} POINTS`;
  document.getElementById('death-screen').classList.remove('hidden');
}

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let groanAmbientTimer = 4;

function updateGame(dt, rawDt) {
  world.update(dt, clock.elapsedTime);
  effects.update(rawDt * (paused ? 0 : timescale));

  if (state === 'playing' && !paused) {
    const adsFov = weapons.def ? ADS_FOV[weapons.item.weaponKey] : 56;
    player.update(dt, { keys: inventory.isOpen ? new Set() : keys, adsFov });
    weapons.update(dt, zombies, mouseDelta);
    zombies.update(dt);
    updatePickups(dt);
    inventory.update(rawDt);

    killstreak.timer -= dt;

    // wave intermission
    if (zombies.remaining === 0 && intermission > 0) {
      intermission -= dt;
      if (intermission <= 0) startWave(wave + 1);
    }

    // HUD refresh
    hud.setHealth(player.health, player.maxHealth);
    hud.setArmor(player.armor, player.maxArmor);
    hud.setWeapon(weapons.item, weapons.def, weapons.reloading > 0);
    hud.setCrosshairSpread(weapons.crosshairSpread(), player.ads);

    // distant ambient groans to keep the dread up
    groanAmbientTimer -= dt;
    if (groanAmbientTimer <= 0) {
      groanAmbientTimer = 6 + Math.random() * 10;
      if (zombies.aliveCount > 0) audio.zombieGroan(18 + Math.random() * 15);
    }

    if (player.dead) die();
  }
}

function tick() {
  requestAnimationFrame(tick);
  const rawDt = Math.min(0.05, clock.getDelta());

  // slow-mo recovery runs on real time
  if (slowmoTimer > 0) {
    slowmoTimer -= rawDt;
    if (slowmoTimer <= 0) {
      timescale = 1;
      hud.slowmo(false);
      audio.slowmo(false);
    }
  }

  const dt = rawDt * (state === 'playing' && !paused ? timescale : 0);
  updateGame(dt, rawDt);

  mouseDelta.x = 0; mouseDelta.y = 0;
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
    THREE, scene, camera, renderer,
    player, world, zombies, weapons, inventory, hud,
    get state() { return state; },
    start: startGame,
    keys,
    pressKey: (code) => keys.add(code),
    releaseKey: (code) => keys.delete(code),
    teleport: (x, y, z) => { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
    lookAt: (yaw, pitch) => { player.yaw.rotation.y = yaw; player.pitch.rotation.x = pitch; },
    aimAt: (x, y, z) => {
      const dx = x - player.pos.x, dy = y - (player.pos.y + 1.62), dz = z - player.pos.z;
      player.yaw.rotation.y = Math.atan2(-dx, -dz);
      player.pitch.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
    },
    fire: () => { weapons.triggerDown(zombies); weapons.triggerUp(); },
    // step the sim at a fixed rate, independent of headless render speed
    simulate: (seconds) => {
      const step = 1 / 60;
      for (let t = 0; t < seconds; t += step) updateGame(step, step);
      renderer.render(scene, camera);
    },
    spawnPickupAt: (x, z, payload) => spawnPickup(new THREE.Vector3(x, 0, z), payload),
  };
  // auto-start so tests skip the menu click
  startGame();
}
