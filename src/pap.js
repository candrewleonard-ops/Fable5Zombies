import * as THREE from 'three';
import { buildGunModel, makeRayGunMesh } from './weapons.js';
import { papStats, WEAPONS, ECON } from './items.js';
import { audio } from './audio.js';

// Pack-a-Punch — "The Reforger" (digests/pap.md). Insert a gun, the tray rides
// in, rollers spin, the stamp pounds for 3.4s in purple sparks, and the gun
// ejects upgraded (★, ×2.5 dmg) floating on the tray until taken.

export function buildPapModel() {
  const dark = new THREE.MeshStandardMaterial({ color: 0x191b20, metalness: 0.7, roughness: 0.45 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x565a63, metalness: 0.9, roughness: 0.3 });
  const copper = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, metalness: 0.95, roughness: 0.35 });
  const runeM = new THREE.MeshStandardMaterial({ color: 0x1a0a24, emissive: 0xb04aff, emissiveIntensity: 1.4 });
  const hotM = new THREE.MeshStandardMaterial({ color: 0x2a1004, emissive: 0xff7a1a, emissiveIntensity: 1.2 });

  const group = new THREE.Group();
  const bx = (w, h, d, mat, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true;
    group.add(m); return m;
  };
  const cy = (r, h, mat, x, y, z, rz = Math.PI / 2) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat);
    m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true;
    group.add(m); return m;
  };

  bx(1.5, 0.95, 0.85, dark, 0, 0.475, 0);
  bx(1.5, 0.22, 0.9, steel, 0, 1.02, 0);
  bx(1.34, 0.55, 0.7, dark, 0, 1.4, -0.05);
  bx(1.34, 0.3, 0.72, steel, 0, 1.78, -0.05, -0.15);
  bx(1.52, 0.06, 0.87, runeM, 0, 1.14, 0);
  bx(0.09, 0.06, 0.4, runeM, -0.55, 1.81, -0.02, -0.15);
  bx(0.09, 0.06, 0.4, runeM, 0.55, 1.81, -0.02, -0.15);
  cy(0.07, 1.5, copper, -0.82, 0.9, -0.25, 0);
  cy(0.07, 1.5, copper, 0.82, 0.9, -0.25, 0);
  cy(0.11, 0.5, copper, -0.82, 1.62, -0.25);
  cy(0.11, 0.5, copper, 0.82, 1.62, -0.25);
  bx(0.9, 0.34, 0.06, hotM, 0, 1.38, 0.31);

  const rollers = [cy(0.06, 0.85, steel, 0, 1.06, 0.28), cy(0.06, 0.85, steel, 0, 1.06, 0.44)];
  const stamp = bx(0.5, 0.22, 0.4, steel, 0, 1.42, 0.38);

  const tray = new THREE.Group();
  tray.position.set(0, 0.86, 0.55);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.55), steel);
  tray.add(plate);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.05), dark);
  lip.position.set(0, 0.04, 0.27);
  tray.add(lip);
  group.add(tray);

  const light = new THREE.PointLight(0xb04aff, 3, 6, 1.8);
  light.position.set(0, 1.6, 0.8);
  group.add(light);

  group.userData = { tray, rollers, stamp, light, runeMat: runeM };
  return group;
}

export class PackAPunch {
  constructor(scene, world, effects, pos = world.papPos, ry = Math.PI) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.cost = ECON.papCost;

    this.model = buildPapModel();
    this.model.position.set(pos.x, 0, pos.z);
    this.model.rotation.y = ry;
    scene.add(this.model);
    const solid = { minX: pos.x - 0.85, maxX: pos.x + 0.85, minY: 0, maxY: 1.9, minZ: pos.z - 0.55, maxZ: pos.z + 0.55 };
    world.colliders.push(solid);
    world.shotSolids.push(solid);

    this.pos = new THREE.Vector3(pos.x, 0, pos.z);
    this.u = this.model.userData;
    this.state = 'idle';
    this.t = 0;
    this.item = null;
    this.weaponModel = null;
  }

  canInsert(item) {
    return this.state === 'idle' && item && item.kind === 'weapon' && !item.pap;
  }

  insert(item) {
    if (!this.canInsert(item)) return false;
    this.item = item;
    this.state = 'in';
    this.t = 0;
    if (this.weaponModel) this.u.tray.remove(this.weaponModel);
    this.weaponModel = item.weaponKey === 'raygun'
      ? (makeRayGunMesh() || buildGunModel('raygun'))
      : buildGunModel(item.weaponKey);
    this.weaponModel.scale.setScalar(1.5);
    this.weaponModel.rotation.y = Math.PI / 2;
    this.weaponModel.position.set(0, 0.12, 0);
    this.u.tray.add(this.weaponModel);
    this.u.tray.position.z = 1.0;
    audio.reload();
    return true;
  }

  get ready() { return this.state === 'ready'; }

  takeOut() {
    if (this.state !== 'ready') return null;
    const item = this.item;
    item.pap = true;
    const st = papStats(WEAPONS[item.weaponKey]);
    item.name = st.name;
    item.mag = st.mag;
    item.reserve = st.reserve;
    item.icon3d = `weapon:${item.weaponKey}:pap`;
    this.item = null;
    this.state = 'idle';
    this.t = 0;
    if (this.weaponModel) { this.u.tray.remove(this.weaponModel); this.weaponModel = null; }
    this.u.tray.position.set(0, 0.86, 0.55);
    audio.buy();
    return item;
  }

  update(dt) {
    this.t += dt;
    const pulse = 1 + Math.sin(this.t * 3) * 0.25;
    const u = this.u;

    switch (this.state) {
      case 'idle':
        u.light.intensity = 2.4 * pulse;
        u.runeMat.emissiveIntensity = 1.2 + Math.sin(this.t * 2) * 0.3;
        break;
      case 'in':
        u.tray.position.z = Math.max(0.18, u.tray.position.z - dt * 1.4);
        if (u.tray.position.z <= 0.18) {
          this.state = 'work';
          this.t = 0;
          audio.papHum();
        }
        break;
      case 'work': {
        for (const r of u.rollers) r.rotation.x += dt * 14;
        u.stamp.position.y = 1.42 - Math.abs(Math.sin(this.t * 6)) * 0.16;
        u.light.intensity = 7 + Math.sin(this.t * 12) * 3.5;
        u.runeMat.emissiveIntensity = 2.2 + Math.sin(this.t * 9) * 1;
        if (this.weaponModel && Math.random() < dt * 6) {
          const at = this.model.localToWorld(new THREE.Vector3(0, 1.1, 0.3));
          this.effects.sparksColored(at, 0xb04aff);
        }
        if (this.t > 3.4) {
          this.state = 'out';
          this.t = 0;
          this.weaponModel.traverse((o) => {
            if (o.isMesh && o.material) {
              o.material = o.material.clone();
              o.material.emissive = new THREE.Color(0x7a2bd6);
              o.material.emissiveIntensity = 0.45;
            }
          });
          audio.papDing();
        }
        break;
      }
      case 'out':
        u.tray.position.z = Math.min(1.0, u.tray.position.z + dt * 1.2);
        u.stamp.position.y += (1.42 - u.stamp.position.y) * Math.min(1, dt * 6);
        if (u.tray.position.z >= 1.0) { this.state = 'ready'; this.t = 0; }
        break;
      case 'ready':
        u.light.intensity = 5 * pulse;
        if (this.weaponModel) this.weaponModel.position.y = 0.16 + Math.sin(this.t * 2.5) * 0.03;
        if (this.t > 40) this.t = 10;
        break;
    }
  }
}
