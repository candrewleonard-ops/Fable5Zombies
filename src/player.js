import * as THREE from 'three';
import { moveEntity, raycastColliders, groundHeightAt } from './physics.js';
import { audio } from './audio.js';

// Undead Bunker FPS controller. Design values (digests/player.md): base speed
// 4.3, sprint ×1.42 (forward only), ADS ×0.55, Fleet Foot ×1.17, eye 1.62,
// regen 40 hp/s after 3.5s, jetpack 20 m/s² ramp → 4.4 m/s, fuel 18/s,
// gravity −13 airborne. Fable 5 extras kept: smooth Q/E lean, armor pool.

const EYE_HEIGHT = 1.62;
const RADIUS = 0.34;
const HEIGHT = 1.72;
const BASE_SPEED = 4.3;
const JUMP_VEL = 6.2;

const LEAN_OFFSET = 0.62;
const LEAN_ROLL = 0.235;
const LEAN_DROP = 0.09;
const LEAN_SPEED = 10;

export class Player {
  constructor(camera, world) {
    this.world = world;
    this.camera = camera;

    // rig: yaw -> lean (lateral offset + roll) -> pitch -> camera
    this.yaw = new THREE.Object3D();
    this.leanRoot = new THREE.Object3D();
    this.pitch = new THREE.Object3D();
    this.yaw.add(this.leanRoot);
    this.leanRoot.add(this.pitch);
    this.pitch.add(camera);
    camera.position.set(0, 0, 0);

    this.pos = world.spawnPoint.clone();
    this.vel = new THREE.Vector3();
    this.grounded = true;

    this.lean = 0;
    this.leanTarget = 0;

    this.maxHealth = 100;
    this.health = 100;
    this.armor = 0;
    this.maxArmor = 0;
    this.timeSinceHurt = 99;

    this.perks = new Set();
    this.jetpack = false;
    this.jetFuel = 0;
    this._jetSnd = 0;
    this.onJetSpark = null; // main wires to effects

    this.sprinting = false;
    this.ads = false;
    this.adsBlend = 0;
    this.baseFov = 75;

    this.bobPhase = 0;
    this.bobAmp = 0;
    this.smoothedEyeY = EYE_HEIGHT;
    this.recoilPitch = 0;
    this.shake = 0;

    this.kills = 0;
    this.dead = false;
    this._airTime = 0;
    this.viewLocked = false; // true while driving — car owns the camera
  }

  get speedMult() {
    return (this.perks.has('fleet') ? 1.17 : 1);
  }

  onMouseMove(dx, dy) {
    if (this.dead || this.viewLocked) return;
    const sens = 0.0021 * (1 - this.adsBlend * 0.45);
    this.yaw.rotation.y -= dx * sens;
    this.pitch.rotation.x -= dy * sens;
    this.pitch.rotation.x = Math.max(-1.45, Math.min(1.45, this.pitch.rotation.x));
  }

  jump() {
    if (this.grounded && !this.dead) {
      this.vel.y = JUMP_VEL;
      this.grounded = false;
      audio.jump();
    }
  }

  update(dt, input) {
    const { keys, jetThrust } = input;
    if (this.dead) { this._updateRig(dt); return; }

    this.timeSinceHurt += dt;

    // ---- lean (Q/E) ----
    this.leanTarget = 0;
    if (keys.has('KeyQ')) this.leanTarget -= 1;
    if (keys.has('KeyE')) this.leanTarget += 1;
    if (this.leanTarget !== 0) {
      const side = new THREE.Vector3(this.leanTarget, 0, 0).applyQuaternion(this.yaw.quaternion);
      const head = this.pos.clone().setY(this.pos.y + EYE_HEIGHT);
      const free = raycastColliders(this.world.colliders, head, side, LEAN_OFFSET + 0.25);
      if (free < LEAN_OFFSET + 0.2) this.leanTarget *= Math.max(0, (free - 0.2) / LEAN_OFFSET);
    }
    this.lean += (this.leanTarget - this.lean) * (1 - Math.exp(-LEAN_SPEED * dt));

    // ---- ADS blend ----
    const adsWant = this.ads ? 1 : 0;
    this.adsBlend += (adsWant - this.adsBlend) * Math.min(1, dt * 9);

    // ---- movement ----
    const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    this.sprinting = keys.has('ShiftLeft') && fwd > 0 && !this.ads;

    const wish = new THREE.Vector3(strafe, 0, -fwd);
    if (wish.lengthSq() > 0) wish.normalize();
    wish.applyQuaternion(this.yaw.quaternion);
    wish.y = 0;

    const speed = BASE_SPEED * this.speedMult
      * (this.sprinting ? 1.42 : 1)
      * (this.adsBlend > 0.5 ? 0.55 : 1);

    const target = wish.multiplyScalar(speed);
    const control = this.grounded ? 1 : 0.4;
    const accelK = Math.min(1, 12 * control * dt);
    this.vel.x += (target.x - this.vel.x) * accelK;
    this.vel.z += (target.z - this.vel.z) * accelK;

    // ---- jetpack ----
    const thrusting = this.jetpack && jetThrust && this.jetFuel > 0;
    if (thrusting) {
      this.vel.y = Math.min(this.vel.y + 20 * dt, 4.4);
      this.jetFuel = Math.max(0, this.jetFuel - 18 * dt);
      this._jetSnd -= dt;
      if (this._jetSnd <= 0) { this._jetSnd = 0.12; audio.jet(); }
      if (Math.random() < dt * 30 && this.onJetSpark) {
        this.onJetSpark(new THREE.Vector3(
          this.pos.x + (Math.random() - 0.5) * 0.4,
          this.pos.y + 0.15,
          this.pos.z + (Math.random() - 0.5) * 0.4));
      }
      this.grounded = false;
    }

    const wasGrounded = this.grounded;
    const prevY = this.pos.y;
    // jetpack floats gently: airborne gravity −13 while jetpacking (design), else engine gravity
    const res = moveEntity(this.world.colliders, this.pos, this.vel, dt, RADIUS, HEIGHT, this.world.bounds);
    this.grounded = res.grounded;
    if (this.pos.y > 50) { this.pos.y = 50; this.vel.y = Math.min(this.vel.y, 0); }

    if (!this.grounded) this._airTime += dt;
    else {
      if (!wasGrounded && this._airTime > 0.3) { audio.land(); this.shake = Math.min(0.5, this.shake + this._airTime * 0.2); }
      this._airTime = 0;
    }

    // ---- head bob & footsteps ----
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const moving = this.grounded && hSpeed > 0.5;
    const targetAmp = moving ? Math.min(1, hSpeed / BASE_SPEED) * (1 - this.adsBlend * 0.8) : 0;
    this.bobAmp += (targetAmp - this.bobAmp) * Math.min(1, 8 * dt);
    if (moving) {
      const prevPhase = this.bobPhase;
      this.bobPhase += dt * (this.sprinting ? 11 : 7.5);
      if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) audio.footstep();
    }

    // step-up eye smoothing
    const stepJump = this.pos.y - prevY;
    if (this.grounded && Math.abs(stepJump) > 0.08 && Math.abs(stepJump) < 0.7) {
      this.smoothedEyeY -= stepJump;
    }
    this.smoothedEyeY += (EYE_HEIGHT - this.smoothedEyeY) * Math.min(1, 14 * dt);

    this.recoilPitch *= Math.exp(-9 * dt);
    this.shake *= Math.exp(-7 * dt);

    // ---- regen: 40 hp/s after 3.5s without damage ----
    if (this.health > 0 && this.health < this.maxHealth && this.timeSinceHurt > 3.5) {
      this.health = Math.min(this.maxHealth, this.health + 40 * dt);
    }

    // ---- FOV: ADS 75→59, sprint widens slightly ----
    if (!this.viewLocked) {
      const fov = this.baseFov - this.adsBlend * 16 + (this.sprinting ? 5 : 0);
      if (Math.abs(this.camera.fov - fov) > 0.01) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
    }

    this._updateRig(dt);
  }

  _updateRig(dt) {
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.05 * this.bobAmp;
    const bobX = Math.sin(this.bobPhase) * 0.025 * this.bobAmp;

    this.yaw.position.set(
      this.pos.x,
      this.pos.y + this.smoothedEyeY + bobY - Math.abs(this.lean) * LEAN_DROP,
      this.pos.z
    );
    this.leanRoot.position.x = this.lean * LEAN_OFFSET + bobX;
    this.leanRoot.rotation.z = -this.lean * LEAN_ROLL + Math.sin(this.bobPhase) * 0.006 * this.bobAmp;

    if (!this.viewLocked) {
      const shakeX = (Math.random() - 0.5) * this.shake * 0.06;
      const shakeY = (Math.random() - 0.5) * this.shake * 0.06;
      this.camera.position.set(shakeX, shakeY, 0);
      this.camera.rotation.x = this.recoilPitch;
    }
  }

  takeDamage(dmg) {
    if (this.dead) return;
    this.timeSinceHurt = 0;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.65);
      this.armor -= absorbed;
      dmg -= absorbed;
      if (this.onArmorAbsorb) this.onArmorAbsorb(absorbed);
    }
    this.health -= dmg;
    this.shake = Math.min(0.8, this.shake + 0.3);
    audio.playerHurt();
    if (this.onHurt) this.onHurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    if (this.dead || this.health >= this.maxHealth) return false;
    this.health = Math.min(this.maxHealth, this.health + amount);
    audio.heal();
    return true;
  }

  addFuel(pct) {
    this.jetFuel = Math.min(100, this.jetFuel + pct);
  }

  reset() {
    this.pos.copy(this.world.spawnPoint);
    this.vel.set(0, 0, 0);
    this.maxHealth = 100;
    this.health = 100;
    this.armor = 0; this.maxArmor = 0;
    this.dead = false;
    this.kills = 0;
    this.perks.clear();
    this.jetpack = false;
    this.jetFuel = 0;
    this.lean = 0; this.leanTarget = 0;
    this.adsBlend = 0; this.ads = false;
    this.pitch.rotation.x = 0;
    this.yaw.rotation.y = 0;
    this.timeSinceHurt = 99;
    this.viewLocked = false;
  }

  standingOnY() {
    return groundHeightAt(this.world.colliders, this.pos.x, this.pos.z, this.pos.y, RADIUS);
  }

  eyePosition(out = new THREE.Vector3()) {
    return this.camera.getWorldPosition(out);
  }

  eyeDirection(out = new THREE.Vector3()) {
    return this.camera.getWorldDirection(out);
  }
}
