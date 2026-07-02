import * as THREE from 'three';
import { BOX_POOL, makeWeaponItem, ECON } from './items.js';
import { buildGunModel, makeRayGunMesh } from './weapons.js';
import { audio } from './audio.js';

// The Mystery Box (digests/map.md + game.md): 950 pts, lid opens, blue beam,
// weapons cycle ~3.6s slowing down, 9s take window, 10% teddy → refund +
// relocation to another pallet pad. Sky beam marks the active pad.

export function buildMysteryBoxModel(qTex, open = false) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3e2c18, roughness: 0.9 });

  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 0.62), wood);
  crate.position.y = 0.45;
  crate.castShadow = true;
  group.add(crate);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.08, 0.66),
    new THREE.MeshStandardMaterial({ color: 0xc7a24a, metalness: 0.8, roughness: 0.35, emissive: 0x66500f, emissiveIntensity: 0.5 }));
  trim.position.y = 0.72;
  group.add(trim);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.16, 0.5), woodDark);
  legs.position.y = 0.08;
  group.add(legs);

  const lid = new THREE.Group();
  lid.position.set(0, 0.76, -0.31);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.62), woodDark);
  slab.position.set(0, 0.035, 0.31);
  lid.add(slab);
  group.add(lid);

  const qMats = [];
  for (const [z, rot] of [[0.315, 0], [-0.315, Math.PI]]) {
    const qMat = new THREE.MeshBasicMaterial({
      map: qTex, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending,
      depthWrite: false, color: 0x86c8ff,
    });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.52), qMat);
    q.position.set(0, 0.45, z);
    q.rotation.y = rot;
    group.add(q);
    qMats.push(qMat);
  }
  if (open) lid.rotation.x = -1.9;
  return { group, lid, qMats };
}

function buildTeddy() {
  const fur = new THREE.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.95 });
  const furD = new THREE.MeshStandardMaterial({ color: 0x4e3018, roughness: 0.95 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
  const t = new THREE.Group();
  const part = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    t.add(m);
  };
  part(0.36, 0.42, 0.28, fur, 0, 0.21, 0);
  part(0.2, 0.24, 0.06, furD, 0, 0.18, 0.13);
  part(0.3, 0.28, 0.26, fur, 0, 0.56, 0);
  part(0.1, 0.11, 0.07, furD, -0.12, 0.73, 0);
  part(0.1, 0.11, 0.07, furD, 0.12, 0.73, 0);
  part(0.09, 0.06, 0.07, furD, 0, 0.52, 0.14);
  part(0.035, 0.05, 0.03, black, -0.07, 0.6, 0.135);
  part(0.035, 0.05, 0.03, black, 0.07, 0.6, 0.135);
  part(0.1, 0.3, 0.11, fur, -0.23, 0.24, 0.03);
  part(0.1, 0.3, 0.11, fur, 0.23, 0.24, 0.03);
  part(0.12, 0.14, 0.3, fur, -0.12, 0.07, 0.12);
  part(0.12, 0.14, 0.3, fur, 0.12, 0.07, 0.12);
  return t;
}

export class MysteryBox {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cost = ECON.boxCost;

    const built = buildMysteryBoxModel(world.textures.qTex);
    this.group = built.group;
    this.lid = built.lid;
    this.qMats = built.qMats;

    // lid-open beam
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.34, 3.2, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x86c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    this.beam.position.y = 2.2;
    this.group.add(this.beam);

    // always-on sky beam at the active pad
    this.skyBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 1.3, 60, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x86c8ff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })
    );
    this.skyBeam.position.y = 30;
    this.group.add(this.skyBeam);
    const skyCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.45, 60, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })
    );
    skyCore.position.y = 30;
    this.group.add(skyCore);

    this.holder = new THREE.Group();
    this.holder.position.y = 1.15;
    this.group.add(this.holder);

    this.light = new THREE.PointLight(0x86c8ff, 0, 6, 1.6);
    this.light.position.set(0, 1.4, 0);
    this.group.add(this.light);

    this.teddy = buildTeddy();
    this.teddy.visible = false;
    this.teddy.position.y = 0.5;
    this.group.add(this.teddy);

    scene.add(this.group);

    this.solid = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    world.colliders.push(this.solid);
    world.shotSolids.push(this.solid);

    this.state = 'idle';
    this.t = 0;
    this.cycleT = 0;
    this.weapon = null;
    this.displayModel = null;
    this.padIndex = 0;
    this.pos = new THREE.Vector3();

    this.ownedKeysProvider = () => [];
    this.onRefund = null; // teddy refund
    this.onMessage = null;

    this.moveTo(0);
  }

  moveTo(i) {
    const pad = this.world.boxPads[i];
    this.padIndex = i;
    this.group.position.set(pad.x, 0.1, pad.z);
    this.group.rotation.y = pad.ry;
    this.pos.set(pad.x, 0, pad.z);
    const alongZ = Math.abs(Math.sin(pad.ry)) > 0.5;
    const hw = alongZ ? 0.36 : 1.0;
    const hd = alongZ ? 1.0 : 0.36;
    this.solid.minX = pad.x - hw; this.solid.maxX = pad.x + hw;
    this.solid.minY = 0; this.solid.maxY = 0.85;
    this.solid.minZ = pad.z - hd; this.solid.maxZ = pad.z + hd;
  }

  roll() {
    if (this.state !== 'idle') return false;
    this.state = 'rolling';
    this.t = 0;
    this.cycleT = 0;
    audio.boxJingle();
    return true;
  }

  take() {
    if (this.state !== 'ready') return null;
    const item = makeWeaponItem(this.weapon);
    audio.buy();
    this._close();
    return item;
  }

  _setDisplay(key) {
    if (this.displayModel) this.holder.remove(this.displayModel);
    this.displayModel = key === 'raygun' ? (makeRayGunMesh() || buildGunModel(key)) : buildGunModel(key);
    this.displayModel.scale.setScalar(1.6);
    this.displayModel.rotation.y = Math.PI / 2;
    this.holder.add(this.displayModel);
  }

  _close() {
    this.state = 'closing';
    this.t = 0;
    if (this.displayModel) { this.holder.remove(this.displayModel); this.displayModel = null; }
  }

  update(dt, time) {
    this.t += dt;
    for (let i = 0; i < this.qMats.length; i++) {
      this.qMats[i].opacity = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.3 + i * 1.1));
    }
    const lidTarget = (this.state === 'rolling' || this.state === 'ready') ? -2.0 : 0;
    this.lid.rotation.x += (lidTarget - this.lid.rotation.x) * Math.min(1, dt * 5);
    const beamTarget = this.state === 'rolling' ? 0.35 : this.state === 'ready' ? 0.15 : 0;
    this.beam.material.opacity += (beamTarget - this.beam.material.opacity) * Math.min(1, dt * 4);
    const lightTarget = this.state === 'rolling' ? 8 : this.state === 'ready' ? 4.5 : 0;
    this.light.intensity += (lightTarget - this.light.intensity) * Math.min(1, dt * 4);

    switch (this.state) {
      case 'rolling': {
        this.cycleT -= dt;
        if (this.cycleT <= 0) {
          this.cycleT = 0.16 + this.t * 0.04;
          this._setDisplay(BOX_POOL[Math.floor(Math.random() * BOX_POOL.length)]);
        }
        this.holder.position.y = 1.0 + Math.min(0.5, this.t * 0.2);
        if (this.t > 3.6) {
          if (Math.random() < 0.1) {
            // teddy!
            this.state = 'teddy';
            this.t = 0;
            if (this.displayModel) { this.holder.remove(this.displayModel); this.displayModel = null; }
            this.teddy.visible = true;
            this.teddy.position.y = 0.5;
            this.teddy.rotation.y = 0;
            audio.teddy();
            if (this.onRefund) this.onRefund(this.cost);
            if (this.onMessage) this.onMessage('The box moves…');
          } else {
            const owned = this.ownedKeysProvider();
            let pool = BOX_POOL.filter((k) => !owned.includes(k));
            if (!pool.length) pool = BOX_POOL;
            this.weapon = pool[Math.floor(Math.random() * pool.length)];
            this._setDisplay(this.weapon);
            this.state = 'ready';
            this.t = 0;
          }
        }
        break;
      }
      case 'ready': {
        this.holder.rotation.y += dt * 1.2;
        this.holder.position.y = 1.5 + Math.sin(this.t * 2) * 0.05;
        if (this.t > 9) this._close();
        break;
      }
      case 'teddy': {
        this.teddy.position.y = 0.5 + Math.min(1.1, this.t * 0.7);
        this.teddy.rotation.y += dt * 3;
        this.light.intensity = 6 + Math.sin(this.t * 8) * 2.5;
        if (this.t > 2.6) {
          this.teddy.visible = false;
          this._close();
          const others = this.world.boxPads.map((_, i) => i).filter((i) => i !== this.padIndex);
          this.moveTo(others[Math.floor(Math.random() * others.length)]);
        }
        break;
      }
      case 'closing': {
        this.holder.rotation.y = 0;
        if (this.t > 1.2) this.state = 'idle';
        break;
      }
    }
  }
}
