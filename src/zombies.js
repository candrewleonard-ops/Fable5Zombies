import * as THREE from 'three';
import { moveEntity, raycastColliders } from './physics.js';
import { audio } from './audio.js';

// Wave-based zombie horde. Zombies share the player's collision code, so the
// same step-up logic that lets you climb stairs lets them chase you up.

const TYPES = {
  walker: { hp: 100, speed: 1.9, scale: 1.0, reach: 1.45, dmg: 14, color: 0x5b7a4a, attackCd: 1.15, points: 60 },
  runner: { hp: 62, speed: 4.4, scale: 0.92, reach: 1.35, dmg: 10, color: 0x7a7a4a, attackCd: 0.9, points: 80 },
  brute:  { hp: 460, speed: 1.5, scale: 1.45, reach: 1.9, dmg: 30, color: 0x4a3f52, attackCd: 1.6, points: 200 },
};

let nextId = 1;

function buildZombie(type, bloodMoon) {
  const t = TYPES[type];
  const g = new THREE.Group();
  const s = t.scale;

  const skinHue = new THREE.Color(t.color).offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.1);
  const skin = new THREE.MeshStandardMaterial({ color: skinHue, roughness: 0.95 });
  const cloth = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(Math.random(), 0.25, 0.16 + Math.random() * 0.12), roughness: 1,
  });
  const mats = [skin, cloth];

  const mk = (w, h, d, mat, part) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), mat);
    m.castShadow = true;
    m.userData.part = part;
    return m;
  };

  // torso (pivot at hips)
  const torso = mk(0.62, 0.78, 0.34, cloth, 'body');
  torso.position.y = 1.12 * s;
  g.add(torso);

  // head
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.51 * s;
  const head = mk(0.4, 0.4, 0.4, skin, 'head');
  head.position.y = 0.2 * s;
  headPivot.add(head);
  // glowing eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: bloodMoon ? 0xff2211 : 0xaaff33 });
  for (const ex of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.05 * s, 0.02 * s), eyeMat);
    eye.position.set(ex * s, 0.24 * s, -0.2 * s);
    eye.userData.part = 'head';
    headPivot.add(eye);
  }
  g.add(headPivot);

  // arms (pivot at shoulders)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4 * s, 1.44 * s, 0);
    const arm = mk(0.16, 0.66, 0.16, Math.random() < 0.5 ? skin : cloth, 'body');
    arm.position.y = -0.3 * s;
    pivot.add(arm);
    g.add(pivot);
    arms.push(pivot);
  }

  // legs (pivot at hips)
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16 * s, 0.76 * s, 0);
    const leg = mk(0.2, 0.74, 0.2, cloth, 'legs');
    leg.position.y = -0.37 * s;
    pivot.add(leg);
    g.add(pivot);
    legs.push(pivot);
  }

  return { group: g, headPivot, head, arms, legs, torso, mats, eyeMat };
}

export class ZombieManager {
  constructor(scene, world, player, effects) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.effects = effects;

    this.zombies = [];
    this.wave = 0;
    this.bloodMoon = false;
    this.toSpawn = 0;
    this.spawnTimer = 0;
    this.maxAlive = 22;

    this.raycaster = new THREE.Raycaster();

    this.onKill = null;      // (zombie, part) => void
    this.onHurtPlayer = null;
    this.onRemainingChange = null;
  }

  get aliveCount() { return this.zombies.filter(z => !z.dead).length; }
  get remaining() { return this.toSpawn + this.aliveCount; }

  startWave(wave) {
    this.wave = wave;
    this.bloodMoon = wave % 5 === 0;
    this.toSpawn = 5 + wave * 2 + (this.bloodMoon ? 4 : 0);
    this.spawnTimer = 0.5;
    this.hpMult = 1 + (wave - 1) * 0.11;
    this.speedMult = (1 + Math.min(0.5, (wave - 1) * 0.045)) * (this.bloodMoon ? 1.25 : 1);
  }

  _pickType() {
    const w = this.wave;
    const r = Math.random();
    if (w >= 4 && r < Math.min(0.16, 0.05 + w * 0.012) * (this.bloodMoon ? 1.8 : 1)) return 'brute';
    if (w >= 2 && r < 0.18 + Math.min(0.25, w * 0.03)) return 'runner';
    return 'walker';
  }

  _spawnOne() {
    const type = this._pickType();
    const def = TYPES[type];
    const built = buildZombie(type, this.bloodMoon);

    // spawn at a point far-ish from the player
    const sps = this.world.spawnPoints;
    let sp = sps[Math.floor(Math.random() * sps.length)];
    for (let tries = 0; tries < 6; tries++) {
      sp = sps[Math.floor(Math.random() * sps.length)];
      if (sp.distanceTo(this.player.pos) > 14) break;
    }

    const z = {
      id: nextId++,
      type, def,
      hp: def.hp * this.hpMult,
      maxHp: def.hp * this.hpMult,
      pos: new THREE.Vector3(sp.x + (Math.random() - 0.5) * 2, 0, sp.z + (Math.random() - 0.5) * 2),
      vel: new THREE.Vector3(),
      radius: 0.34 * def.scale,
      // collision height capped below the 2.4m chapel door lintels so brutes
      // (visual scale 1.45) can duck inside and reach you
      height: Math.min(2.25, 1.72 * def.scale),
      speed: def.speed * this.speedMult * (0.88 + Math.random() * 0.24),
      state: 'rising',
      stateTime: 0,
      walkPhase: Math.random() * 10,
      attackCd: 0,
      groanTimer: 1 + Math.random() * 6,
      blockedTime: 0,
      steerSide: Math.random() < 0.5 ? 1 : -1,
      steerUntil: 0,
      flinch: 0,
      dead: false,
      headGone: false,
      ...built,
    };
    z.group.position.copy(z.pos);
    z.group.position.y -= z.height; // starts underground
    this.scene.add(z.group);
    this.effects.dirtBurst(z.pos.clone().setY(z.pos.y + 0.2));
    this.zombies.push(z);
  }

  // Ray vs zombie body parts. Returns { zombie, point, part } or null.
  raycast(origin, dir, maxDist) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const targets = [];
    for (const z of this.zombies) {
      if (!z.dead && z.state !== 'rising') targets.push(z.group);
    }
    if (!targets.length) return null;
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let part = h.object.userData.part;
      if (!part) continue;
      let node = h.object;
      while (node && !node.userData.zombieId) node = node.parent;
      // find owner by walking up to a registered group
      const z = this.zombies.find(zz => {
        let n = h.object;
        while (n) { if (n === zz.group) return true; n = n.parent; }
        return false;
      });
      if (z && !z.dead) return { zombie: z, point: h.point.clone(), part };
    }
    return null;
  }

  // Straight line from the zombie's chest to the player's chest, unblocked?
  _canReachPlayer(z) {
    const from = z.pos.clone();
    from.y += z.height * 0.6;
    const to = this.player.pos.clone();
    to.y += 1.2;
    const dir = to.sub(from);
    const dist = dir.length();
    if (dist < 0.01) return true;
    dir.normalize();
    return raycastColliders(this.world.colliders, from, dir, dist) === Infinity;
  }

  _dispose(z) {
    z.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of z.mats) m.dispose();
    z.eyeMat.dispose();
  }

  damage(z, dmg, part, dir, point) {
    if (z.dead) return;
    z.hp -= dmg;
    z.flinch = Math.min(1, z.flinch + dmg / z.maxHp * 2);

    this.effects.blood(point, dir, part === 'head' ? 20 : 12, 5, z.pos.y);
    this.effects.damageNumber(point, dmg, part === 'head');
    if (Math.random() < 0.4) {
      this.effects.bloodDecal(z.pos.x + (Math.random() - 0.5), z.pos.z + (Math.random() - 0.5), z.pos.y + 0.02, 0.55);
    }
    if (part === 'head') audio.headshot(); else audio.hit();

    // heavy hits shove
    z.vel.addScaledVector(dir.clone().setY(0).normalize(), dmg * 0.02);

    if (z.hp <= 0) {
      this._kill(z, part, dir);
    }
  }

  _kill(z, part, dir) {
    z.dead = true;
    z.state = 'dying';
    z.stateTime = 0;
    z.deathDir = dir ? dir.clone().setY(0).normalize() : new THREE.Vector3(0, 0, 1);

    if (part === 'head') {
      z.headGone = true;
      const headPos = new THREE.Vector3();
      z.head.getWorldPosition(headPos);
      this.effects.gib(headPos, z.pos.y);
      z.headPivot.visible = false;
    }
    this.effects.bloodDecal(z.pos.x, z.pos.z, z.pos.y + 0.02, z.def.scale * 1.6);
    audio.kill();
    if (this.onKill) this.onKill(z, part);
    if (this.onRemainingChange) this.onRemainingChange();
  }

  update(dt) {
    // spawning
    if (this.toSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.aliveCount < this.maxAlive) {
        this._spawnOne();
        this.toSpawn--;
        this.spawnTimer = Math.max(0.25, 1.4 - this.wave * 0.08);
        if (this.onRemainingChange) this.onRemainingChange();
      }
    }

    const playerPos = this.player.pos;

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      z.stateTime += dt;
      z.flinch *= Math.exp(-6 * dt);

      // ---- dying / cleanup ----
      if (z.dead) {
        const t = Math.min(1, z.stateTime / 0.45);
        z.group.rotation.x = -t * Math.PI / 2 * 0.96;
        z.group.position.y = z.pos.y + Math.sin(t * Math.PI / 2) * 0.15;
        if (z.stateTime > 0.45) {
          for (const m of z.mats) { m.transparent = true; m.opacity = Math.max(0, 1 - (z.stateTime - 0.45) / 2); }
          z.eyeMat.transparent = true;
          z.eyeMat.opacity = Math.max(0, 1 - (z.stateTime - 0.45) / 2);
        }
        if (z.stateTime > 2.6) {
          this.scene.remove(z.group);
          this._dispose(z);
          this.zombies.splice(i, 1);
        }
        continue;
      }

      // ---- rising from the grave ----
      if (z.state === 'rising') {
        const t = Math.min(1, z.stateTime / 1.1);
        z.group.position.copy(z.pos);
        z.group.position.y = z.pos.y - z.height * (1 - t * t);
        if (Math.random() < 0.12) this.effects.smoke(z.pos.clone().setY(z.pos.y + 0.15), 1);
        if (t >= 1) { z.state = 'chase'; z.stateTime = 0; }
        continue;
      }

      // ---- groans ----
      z.groanTimer -= dt;
      if (z.groanTimer <= 0) {
        z.groanTimer = 3 + Math.random() * 8;
        audio.zombieGroan(z.pos.distanceTo(playerPos), z.type === 'brute');
      }

      const toPlayer = playerPos.clone().sub(z.pos);
      const distXZ = Math.hypot(toPlayer.x, toPlayer.z);
      const dy = playerPos.y - z.pos.y;

      // ---- attack ----
      z.attackCd = Math.max(0, z.attackCd - dt);
      if (z.state === 'attack') {
        if (z.stateTime > 0.42) {
          // strike lands (LOS-checked so claws don't reach through walls)
          if (distXZ < z.def.reach + 0.35 && Math.abs(dy) < 1.7 && !this.player.dead && this._canReachPlayer(z)) {
            this.player.takeDamage(z.def.dmg * (this.bloodMoon ? 1.2 : 1));
            audio.zombieBite();
            if (this.onHurtPlayer) this.onHurtPlayer(z);
          }
          z.state = 'chase';
          z.stateTime = 0;
          z.attackCd = z.def.attackCd;
        }
      } else if (distXZ < z.def.reach && Math.abs(dy) < 1.6 && z.attackCd <= 0 && !this.player.dead && this._canReachPlayer(z)) {
        z.state = 'attack';
        z.stateTime = 0;
      }

      // ---- steering ----
      let desired = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();

      // wall-following when stuck (lets them find doors + stair entrances)
      if (performance.now() / 1000 < z.steerUntil) {
        desired.applyAxisAngle(new THREE.Vector3(0, 1, 0), z.steerSide * 1.15);
      }

      // separation from other zombies
      for (const o of this.zombies) {
        if (o === z || o.dead) continue;
        const dx = z.pos.x - o.pos.x, dz = z.pos.z - o.pos.z;
        const d2 = dx * dx + dz * dz;
        const minD = (z.radius + o.radius) * 1.6;
        if (d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          desired.x += (dx / d) * (1 - d / minD) * 1.4;
          desired.z += (dz / d) * (1 - d / minD) * 1.4;
        }
      }
      desired.normalize();

      const speed = z.state === 'attack' ? z.speed * 0.25 : z.speed * (1 - z.flinch * 0.7);
      z.vel.x += (desired.x * speed - z.vel.x) * Math.min(1, 8 * dt);
      z.vel.z += (desired.z * speed - z.vel.z) * Math.min(1, 8 * dt);

      const before = z.pos.clone();
      const res = moveEntity(this.world.colliders, z.pos, z.vel, dt, z.radius, z.height, this.world.bounds);
      const moved = before.distanceTo(z.pos);

      // stuck detection → engage wall-following for a while
      if (res.hitWall && moved < speed * dt * 0.35 && z.state === 'chase') {
        z.blockedTime += dt;
        if (z.blockedTime > 0.4) {
          z.steerUntil = performance.now() / 1000 + 0.7 + Math.random() * 0.5;
          if (Math.random() < 0.3) z.steerSide *= -1;
          z.blockedTime = 0;
        }
      } else {
        z.blockedTime = Math.max(0, z.blockedTime - dt * 2);
      }

      // ---- pose the model ----
      z.group.position.copy(z.pos);
      const facing = Math.atan2(toPlayer.x, toPlayer.z);
      let da = facing - z.group.rotation.y;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      z.group.rotation.y += da * Math.min(1, 7 * dt);
      z.group.rotation.x = 0;

      const hSpeed = Math.hypot(z.vel.x, z.vel.z);
      z.walkPhase += dt * (2.4 + hSpeed * 2.1);
      const swing = Math.sin(z.walkPhase);

      // shamble: legs swing, torso lurches, head lolls
      z.legs[0].rotation.x = swing * 0.65;
      z.legs[1].rotation.x = -swing * 0.65;
      z.torso.rotation.x = 0.14 + Math.sin(z.walkPhase * 2) * 0.05;
      z.torso.rotation.z = Math.sin(z.walkPhase * 0.5) * 0.08;
      if (!z.headGone) {
        z.headPivot.rotation.z = Math.sin(z.walkPhase * 0.7 + z.id) * 0.14;
        z.headPivot.rotation.x = Math.sin(z.walkPhase * 0.4) * 0.1 - z.flinch * 0.5;
      }

      if (z.state === 'attack') {
        const t = z.stateTime / 0.42;
        const raise = Math.sin(Math.min(1, t) * Math.PI);
        z.arms[0].rotation.x = -1.2 - raise * 1.2;
        z.arms[1].rotation.x = -1.2 - raise * 1.2;
      } else {
        // classic zombie arms out front
        z.arms[0].rotation.x = -1.25 + Math.sin(z.walkPhase + 1) * 0.18;
        z.arms[1].rotation.x = -1.25 + Math.sin(z.walkPhase + 2.4) * 0.18;
        z.arms[0].rotation.z = 0.12; z.arms[1].rotation.z = -0.12;
      }
    }
  }

  clear() {
    for (const z of this.zombies) {
      this.scene.remove(z.group);
      this._dispose(z);
    }
    this.zombies = [];
    this.toSpawn = 0;
  }
}
