import * as THREE from 'three';
import { raycastColliders } from './physics.js';
import { groundHeightAt } from './physics.js';
import { audio } from './audio.js';

// Undead Bunker zombies (per design/digests/zombies.md):
// states toWindow → tearing → vault → hunt → dead, room-portal pathing,
// articulated rig with elbows/knees, board ripping, 1.15s vault arc.

const SKIN = [0x8a9a7b, 0x96a186, 0x7d8a6f, 0xa8a28c, 0x8f9c8f];
const SHIRT = [0x4a4438, 0x3d3a33, 0x52493a, 0x37413b, 0x4d4032];
const PANTS = [0x33302b, 0x3a352c, 0x2c2c30, 0x403a2e];

let ZID = 0;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function makeZombieBody(bloodMoon = false, opts = {}) {
  const boss = !!opts.boss;
  const skin = new THREE.MeshStandardMaterial({ color: boss ? 0x4a3a42 : pick(SKIN), roughness: 0.9 });
  const shirt = new THREE.MeshStandardMaterial({ color: boss ? 0x241418 : pick(SHIRT), roughness: 0.95 });
  const pants = new THREE.MeshStandardMaterial({ color: boss ? 0x1a1214 : pick(PANTS), roughness: 0.95 });
  const gore = new THREE.MeshStandardMaterial({ color: 0x4a0d08, roughness: 0.85 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x221100, emissive: (bloodMoon || boss) ? 0xff3020 : 0xffb340, emissiveIntensity: boss ? 2.6 : 1.6,
  });
  const boots = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 0.9 });
  const mats = [skin, shirt, pants, gore, eyeMat, boots];

  const hitMeshes = [];
  const mk = (w, h, d, mat, parent, x, y, z, part) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    if (part) { m.userData.part = part; hitMeshes.push(m); }
    return m;
  };

  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const neck = new THREE.Group(); neck.position.y = 0.62; torso.add(neck);

  mk(0.44, 0.55, 0.24, shirt, torso, 0, 0.32, 0, 'body');
  mk(0.4, 0.18, 0.22, skin, torso, 0, 0.02, 0, 'body');
  mk(0.2, 0.16, 0.02, gore, torso, 0.08, 0.3, 0.125);
  const head = mk(0.24, 0.28, 0.26, skin, neck, 0, 0.16, 0, 'head');
  const jaw = mk(0.2, 0.08, 0.2, skin, neck, 0, 0.02, 0.02, 'head');
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMat);
  eyeL.position.set(-0.06, 0.19, 0.13); neck.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.06; neck.add(eyeR);
  const headGore = mk(0.1, 0.12, 0.02, gore, neck, -0.07, 0.2, 0.132);

  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(0.28 * side, 0.52, 0); torso.add(sh);
    const upper = mk(0.12, 0.34, 0.13, shirt, sh, 0, -0.16, 0, 'limb');
    const el = new THREE.Group(); el.position.y = -0.33; sh.add(el);
    const fore = mk(0.1, 0.32, 0.11, skin, el, 0, -0.15, 0, 'limb');
    const hand = mk(0.11, 0.1, 0.12, skin, el, 0, -0.34, 0, 'limb');
    return { sh, el, meshes: [upper, fore, hand] };
  };
  const leg = (side) => {
    const hip = new THREE.Group(); hip.position.set(0.12 * side, -0.02, 0); hips.add(hip);
    const thigh = mk(0.16, 0.42, 0.17, pants, hip, 0, -0.22, 0, 'limb');
    const kn = new THREE.Group(); kn.position.y = -0.44; hip.add(kn);
    const shin = mk(0.13, 0.4, 0.14, pants, kn, 0, -0.2, 0, 'limb');
    const boot = mk(0.14, 0.09, 0.24, boots, kn, 0, -0.42, 0.04, 'limb');
    return { hip, kn, meshes: [thigh, shin, boot] };
  };

  const parts = {
    root, hips, torso, neck,
    armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1),
    headMeshes: [head, jaw, eyeL, eyeR, headGore],
  };

  // scavenged armor plates (randomly armored zombies)
  if (opts.armorTier) {
    const plate = new THREE.MeshStandardMaterial({
      color: opts.armorColor ?? 0x9aa7b4, metalness: 0.7, roughness: 0.35,
    });
    mats.push(plate);
    const helm = mk(0.3, 0.16, 0.32, plate, neck, 0, 0.28, 0, 'head');
    parts.headMeshes.push(helm);
    mk(0.5, 0.4, 0.3, plate, torso, 0, 0.36, 0, 'body');
    mk(0.14, 0.14, 0.16, plate, torso, -0.3, 0.55, 0, 'body');
    mk(0.14, 0.14, 0.16, plate, torso, 0.3, 0.55, 0, 'body');
  }
  // boss: jagged shoulder spikes + gnarled crown
  if (boss) {
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x151013, metalness: 0.5, roughness: 0.5 });
    mats.push(spikeMat);
    for (const sx of [-0.34, 0.34]) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), spikeMat);
      sp.position.set(sx, 0.62, 0); sp.rotation.z = sx > 0 ? -0.5 : 0.5;
      torso.add(sp);
    }
    for (let i = 0; i < 4; i++) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), spikeMat);
      horn.position.set(-0.09 + i * 0.06, 0.32, 0);
      neck.add(horn);
    }
  }
  return { root, parts, hitMeshes, mats };
}

export class Zombie {
  constructor(win, opts, manager) {
    this.id = ++ZID;
    this.mgr = manager;
    this.win = win;
    this.hp = opts.hp;
    this.maxHp = opts.hp;
    this.speed = opts.speed;

    const body = makeZombieBody(opts.bloodMoon, opts);
    this.mesh = body.root;
    this.parts = body.parts;
    this.hitMeshes = body.hitMeshes;
    this.mats = body.mats;
    this.boss = !!opts.boss;
    this.armorTier = opts.armorTier || 0;
    this.scale = this.boss ? 1.9 : 0.95 + Math.random() * 0.14;
    this.mesh.scale.setScalar(this.scale);
    for (const m of this.hitMeshes) m.userData.zombie = this;

    this.pos = win.spawn.clone();
    this.pos.x += (Math.random() - 0.5) * 1.5;
    this.pos.z += (Math.random() - 0.5) * 1.5;
    this.mesh.position.copy(this.pos);

    this.state = 'toWindow';
    this.t = Math.random() * 10;
    this.tearTimer = 0.8 + Math.random() * 0.8;
    this.attackCd = 0;
    this.attackAnim = 0;
    this.attackPending = 0; // windup timer (replaces prototype setTimeout — pausable)
    this.vaultT = 0;
    this.deadT = 0;
    this.repathT = 0;
    this.chain = null;
    this.groanT = 1 + Math.random() * 4;
    this.radius = this.boss ? 0.5 : 0.32;
    this.kb = new THREE.Vector3(); // melee knockback, decays
    this.slamCd = 5;
    this.alive = true;
    this.dead = false;

    manager.scene.add(this.mesh);
  }

  // prototype-style horizontal collision: skip steppable (top within 0.5 of
  // feet) and overhead (bottom above feet+1.6) solids, slide per-axis
  _hits(x, z) {
    for (const s of this.mgr.world.colliders) {
      if (s.maxY - this.pos.y < 0.5 || s.minY > this.pos.y + 1.6) continue;
      if (x + this.radius > s.minX && x - this.radius < s.maxX &&
          z + this.radius > s.minZ && z - this.radius < s.maxZ) return true;
    }
    return false;
  }

  _move(dx, dz) {
    if (!this._hits(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    if (!this._hits(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
  }

  face(tx, tz, dt, rate = 6) {
    const want = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    let d = want - this.mesh.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.mesh.rotation.y += d * Math.min(1, dt * rate);
  }

  stepToward(tx, tz, dt, spd) {
    let dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.0001) { dx /= dist; dz /= dist; }
    // separation
    for (const o of this.mgr.zombies) {
      if (o === this || o.dead || !o.alive) continue;
      if (Math.abs(o.pos.y - this.pos.y) > 1.5) continue;
      const sx = this.pos.x - o.pos.x, sz = this.pos.z - o.pos.z;
      const d2 = sx * sx + sz * sz;
      if (d2 < 0.45 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        dx += (sx / d) * 0.55;
        dz += (sz / d) * 0.55;
      }
    }
    const n = Math.hypot(dx, dz);
    if (n > 0.0001) { dx /= n; dz /= n; }
    this._move(dx * spd * dt, dz * spd * dt);
    this.face(this.pos.x + dx, this.pos.z + dz, dt);
    return dist;
  }

  applyKnockback(dir, strength) {
    this.kb.x += dir.x * strength;
    this.kb.z += dir.z * strength;
  }

  // zombies may never occupy the player's space — hard minimum distance so
  // one can't clip inside you and become unkillable/inescapable
  _resolvePlayerOverlap() {
    const P = this.mgr.player;
    if (P.dead) return;
    if (Math.abs(P.pos.y - this.pos.y) > 1.6) return;
    const minD = this.radius + 0.34 + 0.06;
    let dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z;
    const d = Math.hypot(dx, dz);
    if (d >= minD) return;
    if (d < 0.001) { dx = Math.sin(this.id); dz = Math.cos(this.id); }
    else { dx /= d; dz /= d; }
    // push the ZOMBIE out (never the player, so you keep full control)
    this._move(dx * (minD - d), dz * (minD - d));
    // if a wall pinned it, force the position out along the free axis
    const d2 = Math.hypot(this.pos.x - P.pos.x, this.pos.z - P.pos.z);
    if (d2 < minD * 0.75) {
      this.pos.x = P.pos.x + dx * minD;
      this.pos.z = P.pos.z + dz * minD;
    }
  }

  walkAnim(dt, spd) {
    this.t += dt * (2.2 + spd * 2.2);
    const p = this.parts;
    const s = Math.sin(this.t), c = Math.cos(this.t);
    p.legL.hip.rotation.x = s * 0.55;
    p.legR.hip.rotation.x = -s * 0.55;
    p.legL.kn.rotation.x = Math.max(0, -c) * 0.9;
    p.legR.kn.rotation.x = Math.max(0, c) * 0.9;
    p.hips.position.y = 0.92 + Math.abs(c) * 0.03;
    p.torso.rotation.x = 0.22 + s * 0.03;
    p.torso.rotation.z = Math.sin(this.t * 0.5) * 0.06;
    p.neck.rotation.x = -0.15;
    p.neck.rotation.z = Math.sin(this.t * 0.3 + this.id) * 0.12;
  }

  armsReach(amt, dt) {
    const p = this.parts;
    const k = Math.min(1, dt * 5);
    const tgt = -1.35 * amt - 0.25;
    p.armL.sh.rotation.x += (tgt - p.armL.sh.rotation.x) * k;
    p.armR.sh.rotation.x += (tgt + Math.sin(this.t * 1.7) * 0.1 * amt - p.armR.sh.rotation.x) * k;
    p.armL.el.rotation.x += (-0.25 * (1 - amt) - p.armL.el.rotation.x) * k;
    p.armR.el.rotation.x += (-0.25 * (1 - amt) - p.armR.el.rotation.x) * k;
  }

  update(dt) {
    const mgr = this.mgr;
    const P = mgr.player;
    const world = mgr.world;

    if (this.state !== 'dead') {
      this.groanT -= dt;
      if (this.groanT <= 0) {
        this.groanT = 3 + Math.random() * 6;
        audio.zombieGroan(this.pos.distanceTo(P.pos));
      }
    }

    switch (this.state) {
      case 'toWindow': {
        const d = this.stepToward(this.win.outer.x, this.win.outer.z, dt, this.speed * 0.9);
        this.walkAnim(dt, this.speed);
        this.armsReach(0, dt);
        if (d < 0.55) {
          this.state = this.win.boards.some((b) => b.on) ? 'tearing' : 'vault0';
        }
        break;
      }
      case 'tearing': {
        this.face(this.win.inner.x, this.win.inner.z, dt);
        this.t += dt * 6;
        const p = this.parts;
        p.armL.sh.rotation.x = -1.6 + Math.sin(this.t) * 0.5;
        p.armR.sh.rotation.x = -1.6 + Math.sin(this.t + Math.PI) * 0.5;
        p.torso.rotation.x = 0.15 + Math.sin(this.t) * 0.06;
        this.tearTimer -= dt;
        const onBoards = this.win.boards.filter((b) => b.on);
        if (this.tearTimer <= 0 && onBoards.length) {
          this.tearTimer = 1.4 + Math.random() * 0.9;
          world.ripBoard(this.win, onBoards[onBoards.length - 1]);
          audio.boardRip();
          if (mgr.onBoards) mgr.onBoards(this.win);
        }
        if (!this.win.boards.some((b) => b.on) && Math.random() < dt * 2) this.state = 'vault0';
        break;
      }
      case 'vault0': {
        this.vaultFrom = this.pos.clone();
        this.vaultT = 0;
        this.state = 'vault';
        audio.vaultThud();
        break;
      }
      case 'vault': {
        this.vaultT += dt / 1.15;
        const k = Math.min(1, this.vaultT);
        this.pos.x = THREE.MathUtils.lerp(this.vaultFrom.x, this.win.inner.x, k);
        this.pos.z = THREE.MathUtils.lerp(this.vaultFrom.z, this.win.inner.z, k);
        this.pos.y = this.vaultFrom.y + (this.win.floorY - this.vaultFrom.y) * k + Math.sin(k * Math.PI) * 0.6;
        const p = this.parts;
        p.torso.rotation.x = 0.9 * Math.sin(k * Math.PI);
        p.legL.hip.rotation.x = -1.2 * Math.sin(k * Math.PI);
        p.legR.hip.rotation.x = -0.8 * Math.sin(k * Math.PI);
        this.armsReach(1, dt);
        this.face(this.win.inner.x, this.win.inner.z, dt, 10);
        if (k >= 1) { this.state = 'hunt'; this.pos.y = this.win.floorY; }
        break;
      }
      case 'hunt': {
        this.repathT -= dt;
        if (this.repathT <= 0) {
          this.repathT = 0.5;
          const myRoom = world.roomAt(this.pos);
          const pRoom = world.roomAt(P.pos);
          if (myRoom !== pRoom) {
            this.chain = world.pathChain(myRoom, pRoom);
            while (this.chain && this.chain.length > 1 &&
                   Math.hypot(this.chain[0].x - this.pos.x, this.chain[0].z - this.pos.z) < 1.2 &&
                   Math.abs(this.chain[0].y - this.pos.y) < 1.2) {
              this.chain.shift();
            }
          } else this.chain = null;
        }
        let tx = P.pos.x, tz = P.pos.z;
        if (this.chain && this.chain.length) {
          const wp = this.chain[0];
          if (Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 0.8 && Math.abs(wp.y - this.pos.y) < 1.2) {
            this.chain.shift();
            if (!this.chain.length) this.repathT = 0;
          }
          if (this.chain.length) { tx = this.chain[0].x; tz = this.chain[0].z; }
        }
        const distP = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
        const spd = this.speed * (distP < 3 ? 1.12 : 1);
        this.stepToward(tx, tz, dt, spd);
        this.walkAnim(dt, spd);
        this.armsReach(distP < 4 ? 1 : (this.speed > 2.4 ? 0.8 : 0.15), dt);

        // floor snap
        const g = groundHeightAt(world.colliders, this.pos.x, this.pos.z, this.pos.y, this.radius, 1.7);
        this.pos.y += (g - this.pos.y) * Math.min(1, dt * 10);

        // boss ground slam: shockwave when the player lingers close
        if (this.boss) {
          this.slamCd -= dt;
          if (this.slamCd <= 0 && distP < 5 && Math.abs(P.pos.y - this.pos.y) < 1.2 && !P.dead) {
            this.slamCd = 6;
            const at = this.pos.clone(); at.y += 0.3;
            this.mgr.effects.explosion(at, 0xff5a2a, 4.5);
            audio.explosion();
            if (distP < 4.5) {
              P.takeDamage(25);
              const away = new THREE.Vector3(P.pos.x - this.pos.x, 0, P.pos.z - this.pos.z).normalize();
              P.vel.x += away.x * 9;
              P.vel.z += away.z * 9;
              P.vel.y += 3.5;
            }
          }
        }

        // attack (LOS-checked so claws don't reach through walls)
        this.attackCd -= dt;
        const reach = this.boss ? 2.3 : 1.7;
        if (distP < reach && this.attackCd <= 0 && Math.abs(P.pos.y - this.pos.y) < 1.6 && !P.dead && this._losToPlayer()) {
          this.attackCd = 1.15;
          this.attackAnim = 0.4;
          this.attackPending = 0.28;
          audio.attackSnarl(Math.min(1, 3.5 / Math.max(1, distP)));
        }
        if (this.attackPending > 0) {
          this.attackPending -= dt;
          if (this.attackPending <= 0 && !this.dead && !P.dead) {
            const d2 = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
            if (d2 < (this.boss ? 2.6 : 2.0) && this._losToPlayer()) {
              P.takeDamage(this.boss ? 40 : mgr.hitDamage);
              audio.zombieBite();
              if (mgr.onHurtPlayer) mgr.onHurtPlayer(this);
            }
          }
        }
        if (this.attackAnim > 0) {
          this.attackAnim -= dt;
          const k = Math.max(0, this.attackAnim / 0.4);
          this.parts.armR.sh.rotation.x = -1.9;
          this.parts.armR.sh.rotation.z = -1.2 * Math.sin(k * Math.PI);
          this.parts.torso.rotation.y = 0.4 * Math.sin(k * Math.PI);
        } else {
          this.parts.armR.sh.rotation.z *= 0.9;
          this.parts.torso.rotation.y *= 0.9;
        }
        break;
      }
      case 'dead': {
        this.deadT += dt;
        const k = Math.min(1, this.deadT * 2.4);
        this.mesh.rotation.x = (-Math.PI / 2) * k * this.deadDir;
        this.parts.hips.position.y = 0.92 - k * 0.55;
        if (this.deadT > 3.2) this.mesh.position.y -= dt * 0.35;
        if (this.deadT > 4.5) this.dispose();
        break;
      }
    }

    if (!this.dead && this.state !== 'rising') {
      // decaying melee knockback
      if (this.kb.lengthSq() > 0.0004) {
        this._move(this.kb.x * dt * 6, this.kb.z * dt * 6);
        this.kb.multiplyScalar(Math.exp(-6 * dt));
      }
      this._resolvePlayerOverlap();
    }

    if (this.state !== 'dead') this.mesh.position.copy(this.pos);
    else { this.mesh.position.x = this.pos.x; this.mesh.position.z = this.pos.z; }
  }

  _losToPlayer() {
    const from = this.pos.clone(); from.y += 1.2 * this.scale;
    const to = this.mgr.player.pos.clone(); to.y += 1.2;
    const dir = to.sub(from);
    const dist = dir.length();
    if (dist < 0.01) return true;
    dir.normalize();
    return raycastColliders(this.mgr.world.shotSolids, from, dir, dist) === Infinity;
  }

  takeDamage(dmg, part, hitPoint, dir) {
    if (this.dead) return null;
    this.hp -= dmg;
    this.mgr.effects.blood(hitPoint, dir || new THREE.Vector3(0, 0.4, 0), part === 'head' ? 14 : 7, 5, this.pos.y);
    this.mgr.effects.damageNumber(hitPoint, dmg, part === 'head');
    if (Math.random() < 0.35) this.mgr.effects.bloodDecal(this.pos.x, this.pos.z, this.pos.y + 0.02, 0.55);
    if (part === 'head') audio.headshot(); else audio.hit();
    if (this.hp <= 0) {
      this.die(part === 'head');
      return { killed: true, head: part === 'head' };
    }
    return { killed: false, head: part === 'head' };
  }

  die(headshot) {
    this.state = 'dead';
    this.dead = true;
    this.deadT = 0;
    this.deadDir = Math.random() < 0.5 ? 1 : -1;
    if (headshot) {
      for (const m of this.parts.headMeshes) m.visible = false;
      const at = this.mesh.position.clone(); at.y += 1.6 * this.scale;
      this.mgr.effects.gib(at, this.pos.y);
    }
    this.mgr.effects.bloodDecal(this.pos.x, this.pos.z, this.pos.y + 0.02, 1.3);
    for (const m of this.hitMeshes) m.userData.zombie = null;
    audio.kill();
    if (this.mgr.onKill) this.mgr.onKill(this, headshot);
  }

  dispose() {
    this.alive = false;
    this.mgr.scene.remove(this.mesh);
    this.mesh.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
  }
}

export class ZombieManager {
  constructor(scene, world, player, effects) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.effects = effects;
    this.zombies = [];
    this.raycaster = new THREE.Raycaster();
    this.hitDamage = 22;
    this.onKill = null;        // (zombie, headshot)
    this.onHurtPlayer = null;
    this.onBoards = null;
  }

  get aliveCount() { return this.zombies.filter((z) => !z.dead).length; }

  // main picks the window (design: weighted 1/(4+dist) toward the player)
  spawnAt(win, opts) {
    const z = new Zombie(win, opts, this);
    this.zombies.push(z);
    return z;
  }

  raycast(origin, dir, maxDist) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const targets = [];
    for (const z of this.zombies) {
      if (!z.dead && (z.state === 'hunt' || z.state === 'tearing' || z.state === 'vault' || z.state === 'toWindow')) {
        targets.push(z.mesh);
      }
    }
    if (!targets.length) return null;
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      const part = h.object.userData.part;
      const zombie = h.object.userData.zombie;
      if (part && zombie && !zombie.dead) return { zombie, point: h.point.clone(), part };
    }
    return null;
  }

  // weapons call this with FINAL damage (head/limb multipliers already applied)
  damage(z, dmg, part, dir, point) {
    return z.takeDamage(dmg, part === 'blast' ? 'body' : part, point, dir);
  }

  blastDamage(center, radius, dmg, onHit) {
    for (const z of this.zombies) {
      if (z.dead) continue;
      const c = z.pos.clone(); c.y += 0.9;
      const d = c.distanceTo(center);
      if (d < radius) {
        const scaled = dmg * (1 - (d / radius) * 0.55);
        if (onHit) onHit(z, scaled);
        z.takeDamage(scaled, 'body', c, c.clone().sub(center).normalize());
      }
    }
  }

  // trap calls this
  zoneDamage(zone, dps, dt) {
    for (const z of this.zombies) {
      if (z.dead || z.state !== 'hunt') continue;
      if (z.pos.x > zone.x0 && z.pos.x < zone.x1 && z.pos.z > zone.z0 && z.pos.z < zone.z1) {
        z.takeDamage(dps * dt, 'body', z.pos.clone().setY(z.pos.y + 1), new THREE.Vector3(0, 1, 0));
      }
    }
  }

  update(dt) {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.update(dt);
      if (!z.alive) this.zombies.splice(i, 1);
    }
  }

  clear() {
    for (const z of this.zombies) z.dispose();
    this.zombies = [];
  }
}
