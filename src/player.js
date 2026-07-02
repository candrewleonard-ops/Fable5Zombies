import * as THREE from 'three';
import { moveEntity, raycastColliders } from './physics.js';
import { audio } from './audio.js';

const EYE_HEIGHT = 1.62;
const RADIUS = 0.35;
const HEIGHT = 1.72;
const WALK_SPEED = 5.4;
const SPRINT_MULT = 1.55;
const ACCEL = 42;
const FRICTION = 11;
const JUMP_VEL = 7.4;

// Lean tuning — the smooth Q/E swerve.
const LEAN_OFFSET = 0.62;   // metres the head swings sideways
const LEAN_ROLL = 0.235;    // ~13.5° of body roll
const LEAN_DROP = 0.09;     // head dips a little while leaning
const LEAN_SPEED = 10;      // exponential smoothing rate

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

    this.pos = new THREE.Vector3(0, 0, 14);   // feet
    this.vel = new THREE.Vector3();
    this.grounded = true;

    this.lean = 0;          // smoothed -1..1
    this.leanTarget = 0;

    this.maxHealth = 100;
    this.health = 100;
    this.armor = 0;
    this.maxArmor = 0;
    this.timeSinceHurt = 99;

    this.sprinting = false;
    this.ads = false;
    this.baseFov = 75;
    this.fov = 75;

    this.bobPhase = 0;
    this.bobAmp = 0;
    this.smoothedEyeY = EYE_HEIGHT;
    this.recoilPitch = 0;   // weapons add to this; it recovers over time
    this.shake = 0;

    this.kills = 0;
    this.points = 0;
    this.dead = false;

    this._airTime = 0;
  }

  onMouseMove(dx, dy, sensitivity = 0.0021) {
    if (this.dead) return;
    this.yaw.rotation.y -= dx * sensitivity;
    this.pitch.rotation.x -= dy * sensitivity;
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
    const { keys } = input;
    if (this.dead) { this._updateRig(dt); return; }

    this.timeSinceHurt += dt;

    // ---- lean target from Q / E ----
    this.leanTarget = 0;
    if (keys.has('KeyQ')) this.leanTarget -= 1;
    if (keys.has('KeyE')) this.leanTarget += 1;

    // don't lean through walls: probe sideways from the head
    if (this.leanTarget !== 0) {
      const side = new THREE.Vector3(this.leanTarget, 0, 0).applyQuaternion(this.yaw.quaternion);
      const head = this.pos.clone().setY(this.pos.y + EYE_HEIGHT);
      const free = raycastColliders(this.world.colliders, head, side, LEAN_OFFSET + 0.25);
      if (free < LEAN_OFFSET + 0.2) this.leanTarget *= Math.max(0, (free - 0.2) / LEAN_OFFSET);
    }

    const lk = 1 - Math.exp(-LEAN_SPEED * dt);
    this.lean += (this.leanTarget - this.lean) * lk;

    // ---- movement ----
    const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    this.sprinting = keys.has('ShiftLeft') && fwd > 0 && !this.ads;

    const wish = new THREE.Vector3(strafe, 0, -fwd);
    if (wish.lengthSq() > 0) wish.normalize();
    wish.applyQuaternion(this.yaw.quaternion);
    wish.y = 0;

    let speed = WALK_SPEED * (this.sprinting ? SPRINT_MULT : 1) * (this.ads ? 0.62 : 1);

    // horizontal accel + friction
    const hvel = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    const target = wish.multiplyScalar(speed);
    const control = this.grounded ? 1 : 0.35;
    hvel.x += (target.x - hvel.x) * Math.min(1, (wish.lengthSq() > 0 ? ACCEL : FRICTION) * control * dt / Math.max(speed, 0.01) * 5);
    hvel.z += (target.z - hvel.z) * Math.min(1, (wish.lengthSq() > 0 ? ACCEL : FRICTION) * control * dt / Math.max(speed, 0.01) * 5);
    this.vel.x = hvel.x; this.vel.z = hvel.z;

    const wasGrounded = this.grounded;
    const prevY = this.pos.y;
    const res = moveEntity(this.world.colliders, this.pos, this.vel, dt, RADIUS, HEIGHT, this.world.bounds);
    this.grounded = res.grounded;

    if (!this.grounded) this._airTime += dt;
    else {
      if (!wasGrounded && this._airTime > 0.25) { audio.land(); this.shake = Math.min(0.5, this.shake + this._airTime * 0.25); }
      this._airTime = 0;
    }

    // ---- head bob & footsteps ----
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const moving = this.grounded && hSpeed > 0.5;
    const targetAmp = moving ? Math.min(1, hSpeed / WALK_SPEED) * (this.ads ? 0.25 : 1) : 0;
    this.bobAmp += (targetAmp - this.bobAmp) * Math.min(1, 8 * dt);
    if (moving) {
      const prevPhase = this.bobPhase;
      this.bobPhase += dt * (this.sprinting ? 11.5 : 8.5);
      if (Math.floor(prevPhase / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) audio.footstep();
    }

    // step-up smoothing: eye glides even when feet snap up a stair
    const stepJump = this.pos.y - prevY;
    if (this.grounded && Math.abs(stepJump) > 0.08 && Math.abs(stepJump) < 0.7) {
      this.smoothedEyeY -= stepJump; // cancel, then recover below
    }
    this.smoothedEyeY += (EYE_HEIGHT - this.smoothedEyeY) * Math.min(1, 14 * dt);

    // recoil recovery + shake decay
    this.recoilPitch *= Math.exp(-9 * dt);
    this.shake *= Math.exp(-7 * dt);

    // soft health regen up to 40 after 8s
    if (this.health > 0 && this.health < 40 && this.timeSinceHurt > 8) {
      this.health = Math.min(40, this.health + 2.5 * dt);
    }

    // fov: sprint widens, ads narrows
    const targetFov = this.ads ? (input.adsFov || 56) : (this.sprinting ? this.baseFov + 8 : this.baseFov);
    this.fov += (targetFov - this.fov) * Math.min(1, 10 * dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
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

    // the lean itself: lateral shift + body roll, silky-smoothed
    this.leanRoot.position.x = this.lean * LEAN_OFFSET + bobX;
    this.leanRoot.rotation.z = -this.lean * LEAN_ROLL + Math.sin(this.bobPhase) * 0.006 * this.bobAmp;

    // recoil + shake ride on the pitch object
    const shakeX = (Math.random() - 0.5) * this.shake * 0.06;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.06;
    this.camera.position.set(shakeX, shakeY, 0);
    this.camera.rotation.x = this.recoilPitch;
  }

  takeDamage(dmg) {
    if (this.dead) return;
    this.timeSinceHurt = 0;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.65);
      this.armor -= absorbed;
      dmg -= absorbed;
      // let the inventory chip durability off the equipped pieces
      if (this.onArmorAbsorb) this.onArmorAbsorb(absorbed);
    }
    this.health -= dmg;
    this.shake = Math.min(0.8, this.shake + 0.35);
    audio.playerHurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    if (this.dead) return false;
    if (this.health >= this.maxHealth) return false;
    this.health = Math.min(this.maxHealth, this.health + amount);
    audio.heal();
    return true;
  }

  setArmor(points, maxPoints) {
    this.armor = points;
    this.maxArmor = maxPoints;
  }

  reset() {
    this.pos.set(0, 0, 14);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
    this.armor = 0; this.maxArmor = 0;
    this.dead = false;
    this.kills = 0;
    this.points = 0;
    this.lean = 0; this.leanTarget = 0;
    this.pitch.rotation.x = 0;
    this.yaw.rotation.y = 0;
    this.timeSinceHurt = 99;
  }

  eyePosition(out = new THREE.Vector3()) {
    return this.camera.getWorldPosition(out);
  }

  eyeDirection(out = new THREE.Vector3()) {
    return this.camera.getWorldDirection(out);
  }
}
