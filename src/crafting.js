import * as THREE from 'three';
import { CRAFT_POOLS, makeWeaponItem, makeMaterial } from './items.js';
import { audio } from './audio.js';

// Weapon-craft sequences (magic wand + per-recipe FX), zombie material drops
// with magnet pickup, and scavenge node gathering. Values per digests/crafting.md.

function buildWandModel() {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.7 }));
  rod.rotation.x = -0.9;
  g.add(rod);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xf7d774, emissive: 0xf7d774, emissiveIntensity: 1.4 }));
  tip.position.set(0, 0.2, -0.16);
  tip.name = 'wandTip';
  g.add(tip);
  const light = new THREE.PointLight(0xf7d774, 1.5, 2, 2);
  light.position.copy(tip.position);
  g.add(light);
  return g;
}

export class Craft {
  constructor(scene, camera, player, inventory, effects) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.inventory = inventory;
    this.effects = effects;

    this.active = null;   // { recipe, t, tick }
    this.wand = null;
    this.barEl = document.getElementById('craftBar');
    this.fillEl = document.getElementById('craftFill');
    this.labelEl = document.getElementById('craftLabel');
    this.onFinish = null; // (item) => void  (main: message + select)
  }

  get crafting() { return !!this.active; }

  startSequence(recipe) {
    if (this.active) return;
    this.active = { recipe, t: 0, tick: 0, burst: 0 };
    this.wand = buildWandModel();
    this.wand.position.set(0.2, -0.12, -0.62);
    this.camera.add(this.wand);
    this.barEl.style.display = 'block';
    this.labelEl.textContent = `ITEM CRAFTING — ${recipe.name.toUpperCase()}`;
    this.fillEl.style.width = '0%';
    audio.craftTick();
  }

  _tipWorld() {
    return this.wand.getObjectByName('wandTip').getWorldPosition(new THREE.Vector3());
  }

  update(dt) {
    const a = this.active;
    if (!a) return;
    a.t += dt;
    this.fillEl.style.width = Math.min(100, (a.t / 3.0) * 100) + '%';

    // wand wiggle
    const type = a.recipe.fx;
    this.wand.rotation.z = Math.sin(a.t * (type === 'ar' ? 14 : type === 'shotgun' ? 6 : 9)) * 0.1;
    this.wand.rotation.x = -0.15 + Math.sin(a.t * 7) * 0.05;
    this.wand.position.y = -0.12 + Math.sin(a.t * 9) * 0.015;

    const tip = this._tipWorld();
    if (type === 'ar') {
      // orange spark spiral orbiting the tip, tick every 0.34s
      const ang = a.t * 9;
      const p = tip.clone().add(new THREE.Vector3(Math.cos(ang) * 0.25, Math.sin(a.t * 5) * 0.1, Math.sin(ang) * 0.25));
      this.effects.sparksColored(p, 0xffa040);
      a.tick -= dt;
      if (a.tick <= 0) { a.tick = 0.34; audio.craftTick(); }
    } else if (type === 'shotgun') {
      a.burst -= dt;
      if (a.burst <= 0) {
        a.burst = 0.5;
        for (let i = 0; i < 3; i++) {
          const p = tip.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3));
          this.effects.sparksColored(p, 0xff5030);
        }
        this.player.shake = Math.min(0.6, this.player.shake + 0.12);
        audio.craftTick();
      }
    } else { // wonder
      a.tick -= dt;
      if (a.tick <= 0) {
        a.tick = 0.36;
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize();
        const end = tip.clone().addScaledVector(dir, 1.2 + Math.random());
        this.effects.tracer(tip, end, 0x9b4dff);
        this.effects.sparksColored(end, 0x9b4dff);
        audio.zap();
      }
    }

    if (a.t >= 3.0) this._finish();
  }

  _finish() {
    const { recipe } = this.active;
    const pool = CRAFT_POOLS[recipe.pool];
    const key = pool[Math.floor(Math.random() * pool.length)];
    const pap = Math.random() < 0.3;
    const item = makeWeaponItem(key, { pap });

    const tip = this._tipWorld();
    this.effects.explosion(tip, 0xf7d774, 1.2);
    audio.perkJingle();

    this.camera.remove(this.wand);
    this.wand = null;
    this.active = null;
    this.barEl.style.display = 'none';

    if (!this.inventory.addItem(item)) {
      // full — drop at feet handled by main
      if (this.onOverflow) this.onOverflow(item);
    }
    if (this.onFinish) this.onFinish(item);
  }

  cancel() {
    if (!this.active) return;
    if (this.wand) this.camera.remove(this.wand);
    this.wand = null;
    this.active = null;
    this.barEl.style.display = 'none';
  }
}

// ---------------- zombie material drops ----------------

function buildDropModel(mat) {
  const g = new THREE.Group();
  if (mat === 'wood') {
    for (let i = 0; i < 2; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 7),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 }));
      log.rotation.z = Math.PI / 2;
      log.position.set(0, 0.05 + i * 0.09, (i - 0.5) * 0.06);
      g.add(log);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const lump = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.55, metalness: 0.3 }));
      lump.position.set((Math.random() - 0.5) * 0.14, 0.06 + Math.random() * 0.08, (Math.random() - 0.5) * 0.14);
      g.add(lump);
    }
  }
  const glow = new THREE.PointLight(mat === 'wood' ? 0xd8a45a : 0x8fb6ff, 0.9, 2.2, 2);
  glow.position.y = 0.3;
  g.add(glow);
  return g;
}

function buildLootModel(kind, colorHex) {
  const g = new THREE.Group();
  if (kind === 'ammo') {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2e3a26, roughness: 0.7 }));
    crate.position.y = 0.09;
    g.add(crate);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xc8a742, metalness: 0.8, roughness: 0.3 }));
    band.position.y = 0.1;
    g.add(band);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26),
      new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.6, roughness: 0.35, emissive: colorHex, emissiveIntensity: 0.25 }));
    box.position.y = 0.15;
    box.rotation.y = 0.6;
    g.add(box);
  }
  const glow = new THREE.PointLight(colorHex, 1.4, 2.6, 2);
  glow.position.y = 0.4;
  g.add(glow);
  return g;
}

export class Drops {
  constructor(scene, player, inventory) {
    this.scene = scene;
    this.player = player;
    this.inventory = inventory;
    this.drops = [];
    this.onPickup = null; // (mat) => toast
    this.onAmmo = null;   // () => add reserve to current weapon; return true if taken
    this.onItem = null;   // (item) => toast
  }

  spawn(pos) {
    if (this.drops.length >= 24) return;
    const mat = Math.random() < 0.35 ? 'coal' : 'wood';
    const group = buildDropModel(mat);
    group.position.set(pos.x, pos.y, pos.z);
    this.scene.add(group);
    this.drops.push({ group, mat, t: 0, life: 45 });
  }

  spawnAmmo(pos) {
    if (this.drops.length >= 24) return;
    const group = buildLootModel('ammo', 0xffd27f);
    group.position.copy(pos);
    this.scene.add(group);
    this.drops.push({ group, ammo: true, t: 0, life: 45 });
  }

  spawnItem(pos, item, colorHex = 0x9dff57, { delay = 0, force = false } = {}) {
    if (this.drops.length >= 30) {
      if (!force) return;
      // important loot (chests, bosses, quest parts) evicts a mundane drop
      const i = this.drops.findIndex((d) => !d.item);
      this._remove(i >= 0 ? i : 0);
    }
    const group = buildLootModel('item', colorHex);
    group.position.copy(pos);
    this.scene.add(group);
    this.drops.push({ group, item, t: 0, life: 90, delay });
  }

  update(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      d.life -= dt;
      d.group.rotation.y += dt * 2;
      d.group.position.y += Math.sin(d.t * 3) * 0.0015;

      if (d.delay > 0) { d.delay -= dt; continue; } // Q-dropped: brief pickup immunity
      const dx = this.player.pos.x - d.group.position.x;
      const dy = (this.player.pos.y + 0.5) - d.group.position.y;
      const dz = this.player.pos.z - d.group.position.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 2.4 && !this.player.dead) {
        // magnet
        const pull = 7 * dt / Math.max(dist, 0.001);
        d.group.position.x += dx * pull;
        d.group.position.y += dy * pull;
        d.group.position.z += dz * pull;
      }
      if (dist < 0.7 && !this.player.dead) {
        let taken = false;
        if (d.ammo) {
          taken = this.onAmmo ? this.onAmmo() : false;
        } else if (d.item) {
          taken = this.inventory.addItem(d.item);
          if (taken && this.onItem) this.onItem(d.item);
        } else {
          taken = this.inventory.addItem(makeMaterial(d.mat, 1));
          if (taken && this.onPickup) this.onPickup(d.mat);
        }
        if (taken) {
          audio.pickup();
          this._remove(i);
          continue;
        }
      }
      if (d.life <= 0) this._remove(i);
    }
  }

  _remove(i) {
    const d = this.drops[i];
    this.scene.remove(d.group);
    d.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.drops.splice(i, 1);
  }

  clear() {
    while (this.drops.length) this._remove(0);
  }
}

// ---------------- scavenge gathering ----------------

export function gatherNode(node, inventory) {
  if (node.cd > 0) return null;
  node.cd = 8;
  const amount = Math.random() < 0.35 ? 2 : 1;
  inventory.addItem(makeMaterial(node.mat, amount));
  audio.pickup();
  return { mat: node.mat, amount };
}

export function updateScavenge(scavenge, dt) {
  for (const n of scavenge) {
    if (n.cd > 0) {
      n.cd = Math.max(0, n.cd - dt);
      const s = 0.5 + 0.5 * (1 - n.cd / 8); // shrink then linear regrow
      n.group.scale.setScalar(s);
    } else if (n.group.scale.x !== 1) {
      n.group.scale.setScalar(1);
    }
  }
}
