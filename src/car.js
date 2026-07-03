import * as THREE from 'three';
import { groundHeightAt } from './physics.js';
import { audio } from './audio.js';
import { buildLamboModel } from './village.js';

// The "Riptide Coupe" (digests/car.md): deploy with Car Keys, F to drive.
// Arcade physics, third-person chase cam with speed-widened FOV, body roll,
// spinning wheels, headlight, crash bleed-off, and zombie roadkill.

export function buildCarModel() {
  const paint = new THREE.MeshStandardMaterial({ color: 0x17858a, metalness: 0.85, roughness: 0.22 });
  const paintD = new THREE.MeshStandardMaterial({ color: 0x0e5a5e, metalness: 0.8, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1418, metalness: 0.9, roughness: 0.12 });
  const black = new THREE.MeshStandardMaterial({ color: 0x101114, metalness: 0.4, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 1.0, roughness: 0.18 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.95 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0xbfe0ff, emissiveIntensity: 1.4 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x3a0508, emissive: 0xff2230, emissiveIntensity: 1.5 });

  const g = new THREE.Group();
  g.userData.wheels = [];
  const bx = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true;
    g.add(m); return m;
  };
  bx(1.86, 0.42, 4.35, paint, 0, 0.46, 0);
  bx(1.7, 0.16, 1.5, paint, 0, 0.68, -1.25, -0.06);
  bx(1.78, 0.2, 0.7, paint, 0, 0.72, 1.7, 0.1);
  bx(1.55, 0.42, 1.9, glass, 0, 0.9, 0.25);
  bx(1.5, 0.4, 0.5, glass, 0, 0.82, -0.85, -0.55);
  bx(1.5, 0.36, 0.45, glass, 0, 0.84, 1.28, 0.5);
  bx(1.6, 0.12, 2.0, paint, 0, 1.09, 0.25);
  bx(1.9, 0.18, 4.3, black, 0, 0.22, 0);
  bx(1.92, 0.12, 0.5, black, 0, 0.2, -2.05);
  bx(1.92, 0.14, 0.35, black, 0, 0.24, 2.1);
  bx(1.7, 0.06, 0.28, paintD, 0, 0.95, 2.12, 0.15);
  bx(0.55, 0.045, 0.18, headM, -0.6, 0.62, -2.16, 0, 0, 0.06);
  bx(0.55, 0.045, 0.18, headM, 0.6, 0.62, -2.16, 0, 0, -0.06);
  bx(1.55, 0.06, 0.1, tailM, 0, 0.68, 2.2);
  bx(0.1, 0.08, 0.28, paintD, -0.98, 0.86, -0.55, 0, 0, 0.3);
  bx(0.1, 0.08, 0.28, paintD, 0.98, 0.86, -0.55, 0, 0, -0.3);
  bx(1.2, 0.16, 0.06, black, 0, 0.5, -2.17);

  for (const [x, z] of [[-0.86, -1.42], [0.86, -1.42], [-0.86, 1.45], [0.86, 1.45]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 18), tire);
    t.rotation.z = Math.PI / 2;
    t.position.set(x, 0.37, z);
    t.castShadow = true;
    g.add(t);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.3, 10), chrome);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.37, z);
    g.add(hub);
    g.userData.wheels.push(t, hub);
  }
  return g;
}

export class CarSys {
  constructor(scene, world, player, camera) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.camera = camera;

    this.mesh = null;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.deployed = false;
    this.driving = false;
    this.camPos = null;
    this.headLight = null;
    this.thudCd = 0;
    this.radius = 1.05;

    this.onRunOverHit = null;   // (zombie, killed)
    this.onMessage = null;
    this.kind = 'coupe';
    this.stats = { acc: 13, top: 15, rev: -5.5 };
  }

  _fwd() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  deploy(pos, yaw, kind = 'coupe') {
    if (this.mesh && this.kind !== kind) {
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
    this.kind = kind;
    this.stats = kind === 'lambo'
      ? { acc: 24, top: 27, rev: -8 }   // the Ravager LX flies
      : { acc: 13, top: 15, rev: -5.5 };
    if (!this.mesh) {
      this.mesh = kind === 'lambo' ? buildLamboModel() : buildCarModel();
      if (!this.mesh.userData.wheels) this.mesh.userData.wheels = [];
      this.scene.add(this.mesh);
      this.headLight = new THREE.SpotLight(0xcfe8ff, 0, 22, 0.5, 0.4, 1.2);
      this.headLight.position.set(0, 0.7, -1.8);
      const target = new THREE.Object3D();
      target.position.set(0, 0.2, -10);
      this.mesh.add(target);
      this.headLight.target = target;
      this.mesh.add(this.headLight);
    }
    this.pos.copy(pos);
    this.pos.y = groundHeightAt(this.world.colliders, pos.x, pos.z, pos.y + 0.5, this.radius);
    this.yaw = yaw;
    this.speed = 0;
    this.deployed = true;
    this.mesh.visible = true;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    audio.vaultThud();
    if (this.onMessage) this.onMessage('Vehicle deployed');
  }

  canEnter(playerPos) {
    return this.deployed && !this.driving && playerPos.distanceTo(this.pos) < 2.9;
  }

  enter() {
    this.driving = true;
    this.player.viewLocked = true;
    if (this.headLight) this.headLight.intensity = 60;
    this.camPos = null;
  }

  exit() {
    this.driving = false;
    this.player.viewLocked = false;
    if (this.headLight) this.headLight.intensity = 0;
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(-1.6);
    this.player.pos.set(this.pos.x + side.x, this.pos.y, this.pos.z + side.z);
    this.player.vel.set(0, 0, 0);
    this.player.yaw.rotation.y = this.yaw + Math.PI;
    this.player.camera.fov = 75;
    this.player.camera.updateProjectionMatrix();
    this.player.camera.position.set(0, 0, 0);
    this.player.camera.rotation.set(0, 0, 0);
  }

  // prototype-style 2D slide against colliders
  _hits(x, z) {
    for (const s of this.world.colliders) {
      if (s.maxY - this.pos.y < 0.5 || s.minY > this.pos.y + 1.4) continue;
      if (x + this.radius > s.minX && x - this.radius < s.maxX &&
          z + this.radius > s.minZ && z - this.radius < s.maxZ) return true;
    }
    return false;
  }

  _move(dx, dz) {
    if (!this._hits(this.pos.x + dx, this.pos.z)) this.pos.x += dx;
    if (!this._hits(this.pos.x, this.pos.z + dz)) this.pos.z += dz;
  }

  update(dt, keys, zombies) {
    if (!this.deployed) return;

    let steer = 0;
    if (this.driving) {
      let acc = 0;
      if (keys.has('KeyW')) acc += this.stats.acc;
      if (keys.has('KeyS')) acc += this.speed > 0.5 ? -18 : -7;
      if (acc !== 0) this.speed += acc * dt;
      else this.speed *= Math.pow(0.35, dt);
      this.speed = Math.max(this.stats.rev, Math.min(this.stats.top, this.speed));
      if (Math.abs(this.speed) < 0.04) this.speed = 0;

      steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
      this.yaw += steer * dt * 1.9 * Math.min(1, Math.abs(this.speed) / 5) * Math.sign(this.speed || 1);

      const fwd = this._fwd();
      const before = this.pos.clone();
      this._move(fwd.x * this.speed * dt, fwd.z * this.speed * dt);
      const gy = groundHeightAt(this.world.colliders, this.pos.x, this.pos.z, this.pos.y + 0.4, this.radius);
      this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 10);

      // crash detection
      const moved = before.distanceTo(this.pos);
      const expect = Math.abs(this.speed) * dt;
      this.thudCd -= dt;
      if (expect > 0.02 && moved < expect * 0.4) {
        if (Math.abs(this.speed) > 5 && this.thudCd <= 0) {
          audio.vaultThud();
          this.player.shake = Math.min(0.6, this.player.shake + 0.25);
          this.thudCd = 0.5;
        }
        this.speed *= Math.pow(0.02, dt);
      }

      // wheel spin
      const ws = this.speed * dt * 2.8;
      for (const w of this.mesh.userData.wheels) w.rotation.x += ws;

      // player rides along
      this.player.pos.copy(this.pos);
      this.player.vel.set(0, 0, 0);

      // zombie roadkill
      if (Math.abs(this.speed) > 3.5 && zombies) {
        const hitP = this.pos.clone().addScaledVector(fwd, Math.sign(this.speed) * 1.6);
        for (const z of zombies.zombies) {
          if (!z.alive || z.dead) continue;
          if (Math.abs(z.pos.y - this.pos.y) > 1.6) continue;
          if (Math.hypot(z.pos.x - hitP.x, z.pos.z - hitP.z) < 1.5) {
            const res = z.takeDamage(80 + Math.abs(this.speed) * 22, 'body',
              new THREE.Vector3(z.pos.x, z.pos.y + 1, z.pos.z), fwd.clone());
            if (res && this.onRunOverHit) this.onRunOverHit(z, res.killed);
            audio.vaultThud();
            this.speed *= 0.82;
          }
        }
      }

      // chase camera
      const camTarget = new THREE.Vector3(
        this.pos.x - fwd.x * 6.2, this.pos.y + 3.0, this.pos.z - fwd.z * 6.2);
      if (!this.camPos) this.camPos = camTarget.clone();
      this.camPos.lerp(camTarget, Math.min(1, dt * 5));
      this.camera.getWorldPosition(new THREE.Vector3()); // ensure matrices
      // detach-style control: place the camera in world space via its parents
      const parentInv = new THREE.Matrix4();
      this.camera.parent.updateWorldMatrix(true, false);
      parentInv.copy(this.camera.parent.matrixWorld).invert();
      const local = this.camPos.clone().applyMatrix4(parentInv);
      this.camera.position.copy(local);
      const look = new THREE.Vector3(this.pos.x + fwd.x * 2.5, this.pos.y + 0.9, this.pos.z + fwd.z * 2.5);
      this.camera.lookAt(look);
      this.camera.fov = 72 + Math.abs(this.speed);
      this.camera.updateProjectionMatrix();
    }

    // body roll (decays even when parked)
    this.mesh.rotation.z += ((this.driving ? -steer * Math.min(1, Math.abs(this.speed) / 8) * 0.035 : 0) - this.mesh.rotation.z) * Math.min(1, dt * 6);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }

  reset() {
    if (this.mesh) this.mesh.visible = false;
    this.deployed = false;
    this.driving = false;
    this.speed = 0;
  }
}
