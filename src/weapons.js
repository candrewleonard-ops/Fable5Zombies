import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { WEAPONS, weaponDef } from './items.js';
import { raycastColliders, groundHeightAt } from './physics.js';
import { audio } from './audio.js';

// Viewmodel + shooting for the Undead Bunker arsenal.
// Hitscan guns raycast; HELIOS renders 8 beams; Arc Projector and the Ray Gun
// fire simulated projectiles with splash damage. Ammo lives ON the inventory
// item (item.mag / item.reserve) so weapons keep state when stashed.

const HIP_POS = new THREE.Vector3(0.3, -0.28, -0.55);
const ADS_POS = new THREE.Vector3(0, -0.205, -0.42);

const MATS = {
  metal: new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.8, roughness: 0.38 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x17181c, metalness: 0.6, roughness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.82 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x3d2a17, roughness: 0.85 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x0c333c, emissive: 0x35e6ff, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x14263c, emissive: 0x86c8ff, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.3 }),
  green: new THREE.MeshStandardMaterial({ color: 0x0e2c14, emissive: 0x54ff6a, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 }),
};

function add(g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  g.add(m); return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r1, r2, h, s = 10) => new THREE.CylinderGeometry(r1, r2, h, s);

// Procedural WWII viewmodels (silhouette-faithful to the design prototype).
export function buildGunModel(key) {
  const g = new THREE.Group();
  const { metal, dark, wood, darkWood, cyan, blue, green } = MATS;
  let muzzleZ = -0.3;

  switch (key) {
    case 'mauser':
      add(g, B(0.05, 0.1, 0.24), metal, 0, 0.03, -0.02);
      add(g, C(0.015, 0.015, 0.22, 8), dark, 0, 0.05, -0.22, Math.PI / 2);
      add(g, B(0.045, 0.16, 0.06), darkWood, 0, -0.08, 0.06, 0.3);         // broomhandle grip
      add(g, B(0.04, 0.11, 0.05), dark, 0, -0.045, -0.04);                 // box mag ahead of trigger
      muzzleZ = -0.33;
      break;
    case 'kar98':
      add(g, B(0.05, 0.09, 0.78), wood, 0, 0, -0.12);                      // full stock
      add(g, C(0.014, 0.014, 0.5, 8), metal, 0, 0.045, -0.36, Math.PI / 2);
      add(g, B(0.04, 0.05, 0.2), metal, 0, 0.05, 0.06);                    // receiver
      add(g, C(0.01, 0.01, 0.07, 6), metal, 0.05, 0.06, 0.06, 0, 0, 1.2);  // bolt handle
      add(g, B(0.05, 0.14, 0.1), wood, 0, -0.09, 0.22, 0.32);              // grip/butt
      add(g, B(0.012, 0.035, 0.012), metal, 0, 0.085, -0.55);              // front sight
      muzzleZ = -0.62;
      break;
    case 'trench':
      add(g, C(0.022, 0.022, 0.6, 10), metal, 0, 0.04, -0.2, Math.PI / 2);
      add(g, C(0.019, 0.019, 0.5, 10), dark, 0, -0.005, -0.16, Math.PI / 2); // tube mag
      add(g, B(0.05, 0.05, 0.16), wood, 0, -0.005, -0.3);                  // pump
      add(g, B(0.055, 0.08, 0.2), metal, 0, 0.02, 0.05);                   // receiver
      add(g, B(0.05, 0.17, 0.1), wood, 0, -0.1, 0.16, 0.35);
      muzzleZ = -0.5;
      break;
    case 'smg':
      add(g, B(0.055, 0.09, 0.4), metal, 0, 0.03, -0.06);
      add(g, C(0.02, 0.02, 0.24, 10), metal, 0, 0.045, -0.36, Math.PI / 2); // finned barrel
      for (let i = 0; i < 4; i++) add(g, C(0.026, 0.026, 0.012, 10), dark, 0, 0.045, -0.28 - i * 0.06, Math.PI / 2);
      add(g, C(0.055, 0.055, 0.03, 14), dark, 0, -0.05, -0.1, 0, 0, Math.PI / 2); // drum mag
      add(g, B(0.045, 0.14, 0.06), wood, 0, -0.09, 0.08, 0.3);
      add(g, B(0.045, 0.1, 0.05), wood, 0, -0.06, -0.22, 0.15);            // foregrip
      add(g, B(0.05, 0.07, 0.16), wood, 0, -0.01, 0.2, 0.12);              // stock
      muzzleZ = -0.5;
      break;
    case 'mg42':
      add(g, B(0.06, 0.11, 0.55), metal, 0, 0.02, -0.1);
      add(g, C(0.02, 0.02, 0.42, 10), metal, 0, 0.05, -0.5, Math.PI / 2);
      add(g, B(0.03, 0.09, 0.42), dark, -0.045, 0.02, -0.3);               // vented shroud side
      add(g, C(0.03, 0.02, 0.07, 10), dark, 0, 0.05, -0.73, Math.PI / 2);  // flash hider cone
      add(g, B(0.05, 0.13, 0.07), dark, 0, -0.09, 0.14, 0.28);
      add(g, B(0.024, 0.14, 0.1), metal, -0.05, -0.06, -0.05);             // belt box
      muzzleZ = -0.77;
      break;
    case 'stg':
      add(g, B(0.05, 0.1, 0.44), metal, 0, 0.02, -0.06);
      add(g, C(0.016, 0.016, 0.28, 8), metal, 0, 0.05, -0.4, Math.PI / 2);
      add(g, B(0.04, 0.2, 0.06), dark, 0, -0.12, -0.06, 0.28);             // curved mag (approx)
      add(g, B(0.04, 0.1, 0.05), dark, 0, -0.16, -0.02, 0.55);
      add(g, B(0.045, 0.13, 0.06), wood, 0, -0.08, 0.12, 0.3);
      add(g, B(0.045, 0.06, 0.18), wood, 0, 0, 0.24);
      add(g, B(0.012, 0.04, 0.012), metal, 0, 0.09, -0.5);
      muzzleZ = -0.56;
      break;
    case 'laser': {
      add(g, B(0.07, 0.1, 0.4), dark, 0, 0.02, -0.05);
      for (const off of [-0.02, 0.02]) add(g, C(0.016, 0.016, 0.3, 8), cyan, off, 0.045, -0.32, Math.PI / 2);
      add(g, C(0.05, 0.035, 0.1, 12), cyan, 0, 0.045, -0.48, Math.PI / 2); // emitter cone
      add(g, B(0.05, 0.05, 0.12), cyan, 0, 0.1, 0.02);                     // charge cell
      add(g, B(0.045, 0.15, 0.07), dark, 0, -0.09, 0.1, 0.32);
      muzzleZ = -0.54;
      break;
    }
    case 'arc': {
      add(g, B(0.08, 0.11, 0.36), dark, 0, 0.02, -0.02);
      add(g, C(0.045, 0.045, 0.16, 12), blue, 0, 0.05, -0.05, Math.PI / 2); // tesla drum
      for (const a of [0, 2.1, 4.2]) {
        add(g, C(0.008, 0.008, 0.3, 6), metal, Math.cos(a) * 0.035, 0.05 + Math.sin(a) * 0.035, -0.32, Math.PI / 2);
      }
      add(g, new THREE.SphereGeometry(0.035, 10, 10), blue, 0, 0.05, -0.48); // emitter orb
      add(g, B(0.05, 0.16, 0.08), dark, 0, -0.1, 0.1, 0.35);
      muzzleZ = -0.5;
      break;
    }
    case 'revolver': {
      add(g, C(0.016, 0.016, 0.3, 8), metal, 0, 0.05, -0.16, Math.PI / 2);   // barrel
      add(g, B(0.02, 0.015, 0.28), metal, 0, 0.068, -0.15);                  // top rib
      add(g, C(0.036, 0.036, 0.065, 8), dark, 0, 0.032, -0.01, 0, 0, Math.PI / 2); // cylinder
      add(g, B(0.045, 0.06, 0.14), metal, 0, 0.03, 0.06);                    // frame
      add(g, B(0.04, 0.13, 0.06), wood, 0, -0.06, 0.1, 0.42);                // walnut grip
      add(g, B(0.012, 0.03, 0.012), metal, 0, 0.075, -0.3);                  // front sight
      muzzleZ = -0.32;
      break;
    }
    case 'ppsh': {
      // modeled off the reference photo: perforated shroud, drum mag, full wood stock
      add(g, B(0.055, 0.075, 0.42), wood, 0, -0.005, 0.02);                  // wooden body
      add(g, B(0.05, 0.095, 0.2), wood, 0, -0.05, 0.28, 0.16);               // stock riser
      add(g, B(0.048, 0.075, 0.16), wood, 0, -0.115, 0.38, 0.32);            // buttstock
      add(g, C(0.03, 0.03, 0.44, 12), metal, 0, 0.045, -0.28, Math.PI / 2);  // barrel shroud
      for (let i = 0; i < 5; i++) {                                          // oval cooling slots
        add(g, B(0.064, 0.018, 0.05), dark, 0, 0.045, -0.13 - i * 0.075);
        add(g, B(0.02, 0.045, 0.05), dark, 0, 0.045 + 0.018, -0.13 - i * 0.075);
      }
      add(g, B(0.062, 0.05, 0.045), metal, 0, 0.042, -0.5, 0, 0, 0.18);      // slanted muzzle brake
      add(g, C(0.011, 0.011, 0.1, 8), dark, 0, 0.045, -0.51, Math.PI / 2);   // barrel tip
      add(g, C(0.075, 0.075, 0.048, 16), dark, 0, -0.055, -0.1, 0, 0, Math.PI / 2); // drum magazine
      add(g, C(0.028, 0.028, 0.052, 10), metal, 0, -0.055, -0.1, 0, 0, Math.PI / 2); // drum hub
      add(g, B(0.02, 0.05, 0.03), metal, 0.04, 0.02, 0.12);                  // bolt handle
      add(g, B(0.03, 0.03, 0.05), metal, 0, 0.075, 0.05);                    // rear sight
      add(g, B(0.012, 0.035, 0.012), metal, 0, 0.085, -0.46);                // front sight post
      muzzleZ = -0.55;
      break;
    }
    case 'raygun': {
      // placeholder shown until the STL loads and replaces it
      add(g, B(0.06, 0.1, 0.3), green, 0, 0.02, -0.02);
      add(g, C(0.02, 0.035, 0.22, 10), green, 0, 0.04, -0.28, Math.PI / 2);
      add(g, B(0.045, 0.15, 0.07), dark, 0, -0.09, 0.08, 0.32);
      muzzleZ = -0.42;
      break;
    }
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.045, muzzleZ);
  muzzle.name = 'muzzle';
  g.add(muzzle);
  return g;
}

// Async: swap the Ray Gun placeholder for the real uploaded STL model.
let rayGunGeo = null;
export function loadRayGunSTL(onReady) {
  new STLLoader().load('/models/raygun.stl', (geo) => {
    geo.computeVertexNormals();
    geo.center();
    // STL: barrel along -X, Z-up → three viewmodel: barrel -Z, Y-up
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeBoundingBox();
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    const scale = 0.55 / size.z; // 0.55m long in hand
    geo.scale(scale, scale, scale);
    geo.computeBoundingBox();
    rayGunGeo = geo;
    if (onReady) onReady(geo);
  }, undefined, () => { /* keep placeholder on error */ });
}

// Classic red ray-gun paint job (reference: crimson body, chrome barrel,
// blue mid bands, red bulb tip) applied as vertex colors along the barrel axis.
function paintRayGun(geo) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const bb = geo.boundingBox;
  const zLen = bb.max.z - bb.min.z;
  const RED = [0.40, 0.022, 0.018];    // deep crimson body
  const CHROME = [0.58, 0.60, 0.65];   // silver trim
  const BLUE = [0.22, 0.38, 0.68];     // steel-blue bands
  const BULB = [0.78, 0.07, 0.05];     // glowing tip bulb
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    const t = (z - bb.min.z) / zLen;   // 0 = muzzle tip, 1 = grip end
    let c = RED;
    if (t < 0.045) c = BULB;                          // antenna bulb
    else if (t < 0.17) c = CHROME;                    // needle barrel
    else if (t >= 0.34 && t < 0.52 && y > -0.02) c = BLUE; // mid cylinder bands
    else if (y > 0.13) c = CHROME;                    // top fins
    else if (y < -0.1 && t > 0.6) c = CHROME;         // trigger guard loop
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function makeRayGunMesh() {
  if (!rayGunGeo) return null;
  if (!rayGunGeo.attributes.color) paintRayGun(rayGunGeo);
  const g = new THREE.Group();
  const body = new THREE.Mesh(rayGunGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.15, roughness: 0.42,
    emissive: 0x1c0503, emissiveIntensity: 0.25,
  }));
  body.castShadow = true;
  g.add(body);
  // energy core glow (bolts stay classic green)
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff4a3a }));
  core.position.set(0, 0.02, 0.05);
  g.add(core);
  const coreLight = new THREE.PointLight(0xff5040, 0.45, 0.55, 2);
  coreLight.position.copy(core.position);
  g.add(coreLight);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, rayGunGeo.boundingBox.min.z - 0.01);
  muzzle.name = 'muzzle';
  g.add(muzzle);
  return g;
}

export class WeaponSystem {
  constructor(camera, player, world, effects) {
    this.camera = camera;
    this.player = player;
    this.world = world;
    this.effects = effects;

    this.root = new THREE.Group();
    camera.add(this.root);

    this.models = {};
    for (const key of Object.keys(WEAPONS)) {
      const model = buildGunModel(key);
      model.visible = false;
      this.root.add(model);
      this.models[key] = model;
    }
    loadRayGunSTL(() => {
      const real = makeRayGunMesh();
      if (!real) return;
      const old = this.models.raygun;
      const wasVisible = old.visible;
      this.root.remove(old);
      real.visible = wasVisible;
      this.root.add(real);
      this.models.raygun = real;
      if (this.item?.weaponKey === 'raygun') this.model = real;
    });

    // soft fill so the viewmodel reads at night
    const fill = new THREE.PointLight(0xd8e0ee, 0.35, 2.4, 1.6);
    fill.position.set(0.25, -0.1, -0.35);
    camera.add(fill);

    this.flashLight = new THREE.PointLight(0xffb347, 0, 9, 2);
    this.flashLight.position.set(0, 0, -0.7);
    camera.add(this.flashLight);
    const flashTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,240,190,1)');
      grad.addColorStop(0.4, 'rgba(255,170,60,0.8)');
      grad.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTex, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    this.flashSprite.scale.set(0.25, 0.25, 1);
    this.root.add(this.flashSprite);

    // beam pool for HELIOS
    this.beams = [];
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x35e6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      mesh.visible = false;
      // parent set at fire time (scene)
      this.beams.push({ mesh, life: 0 });
    }

    // live projectiles (arc bolts / ray gun bolts)
    this.projectiles = [];

    this.item = null;
    this.def = null;
    this.model = null;

    this.cooldown = 0;
    this.reloading = 0;
    this.triggerHeld = false;
    this.raiseAnim = 0;
    this.kickBack = 0;
    this.swayX = 0; this.swayY = 0;
    this.spreadBloom = 0;

    this.meleeCd = 0;
    this.meleeAnim = 0;         // 1 -> 0 bash swing

    this.onShot = null;
    this.onHit = null;          // (zombie, dmg, part) -> points feed
    this.getMods = () => ({ dmgMult: 1, rpmMult: 1, reloadMult: 1 }); // perks, set by main
    this.scene = null;          // set by main for beams/projectiles
  }

  equip(item) {
    if (this.item === item) return;
    if (this.model) this.model.visible = false;
    this.item = item;
    this.reloading = 0;
    this.triggerHeld = false;
    if (!item || item.kind !== 'weapon') { this.def = null; this.model = null; this.item = null; return; }
    this.def = weaponDef(item);
    if (item.mag === undefined) { item.mag = this.def.mag; item.reserve = this.def.reserve; }
    this.model = this.models[item.weaponKey];
    this.model.visible = true;
    this._applyPapTint();
    this.raiseAnim = 0;
    audio.equip();
  }

  _applyPapTint() {
    if (!this.model) return;
    const pap = !!this.item?.pap;
    this.model.traverse((o) => {
      if (!o.isMesh || !o.material?.emissive) return;
      if (pap) {
        if (!o.userData.baseMaterial) o.userData.baseMaterial = o.material;
        o.material = o.userData.baseMaterial.clone();
        o.material.emissive.setHex(0xb04aff);
        o.material.emissiveIntensity = 0.35;
      } else if (o.userData.baseMaterial) {
        // restore — models are shared between pap and non-pap items of a key
        o.material.dispose?.();
        o.material = o.userData.baseMaterial;
      }
    });
  }

  refreshDef() { // call after PaP upgrade of the held item
    if (this.item) { this.def = weaponDef(this.item); this._applyPapTint(); }
  }

  triggerDown(zombies) {
    this.triggerHeld = true;
    this._tryFire(zombies);
  }

  triggerUp() { this.triggerHeld = false; }

  startReload() {
    if (!this.item || this.reloading > 0) return;
    if (this.item.mag >= this.def.mag || this.item.reserve <= 0) return;
    this.reloading = this.def.reload * this.getMods().reloadMult;
    this._reloadTotal = this.reloading;
    audio.reload();
  }

  addReserve(amount) {
    if (!this.item) return false;
    this.item.reserve += amount;
    return true;
  }

  fireRate() { return (this.def.rpm / 60) * this.getMods().rpmMult; }

  _tryFire(zombies) {
    if (!this.item || this.player.dead) return;
    if (this.cooldown > 0 || this.reloading > 0 || this.raiseAnim < 0.55) return;
    if (this.item.mag <= 0) {
      audio.dryFire();
      this.startReload();
      return;
    }

    this.item.mag--;
    this.cooldown = 1 / this.fireRate();
    audio.shoot(this.def.sound);

    this.player.recoilPitch += this.def.recoil * (0.85 + Math.random() * 0.3);
    this.player.shake = Math.min(0.6, this.player.shake + this.def.kick * 0.6);
    this.kickBack = 1;
    this.spreadBloom = Math.min(1, this.spreadBloom + 0.35);

    const isEnergy = this.def.beam || this.def.projectile;
    this.flashLight.color.setHex(isEnergy ? this.def.tracer : 0xffb347);
    this.flashLight.intensity = 26;
    const muzzle = this.model.getObjectByName('muzzle');
    const muzzleWorld = muzzle.getWorldPosition(new THREE.Vector3());
    this.flashSprite.position.copy(this.root.worldToLocal(muzzleWorld.clone()));
    this.flashSprite.material.opacity = 1;
    this.flashSprite.material.rotation = Math.random() * Math.PI * 2;
    if (!isEnergy) {
      this.effects.smoke(muzzleWorld, 2);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
      const casingFloor = groundHeightAt(this.world.colliders, muzzleWorld.x, muzzleWorld.z, this.player.pos.y, 0.3);
      this.effects.casing(muzzleWorld, right, casingFloor);
    }

    const origin = this.player.eyePosition();
    const baseDir = this.player.eyeDirection();
    const spread = (this.player.ads ? this.def.adsSpread : this.def.spread) * (1 + this.spreadBloom * 1.6) * (this.player.ads ? 0.4 : 1);
    const dmgMult = this.getMods().dmgMult;

    if (this.def.projectile) {
      const dir = baseDir.clone();
      this._launchProjectile(muzzleWorld, dir, dmgMult, zombies);
    } else {
      for (let p = 0; p < this.def.pellets; p++) {
        const dir = baseDir.clone();
        dir.x += (Math.random() - 0.5) * 2 * spread;
        dir.y += (Math.random() - 0.5) * 2 * spread;
        dir.z += (Math.random() - 0.5) * 2 * spread;
        dir.normalize();

        const wallT = raycastColliders(this.world.colliders, origin, dir, this.def.range);
        const zHit = zombies.raycast(origin, dir, Math.min(this.def.range, wallT));

        let end;
        if (zHit) {
          end = zHit.point;
          const mult = zHit.part === 'head' ? this.def.headMult : zHit.part === 'legs' ? 0.8 : 1;
          const dmg = this.def.dmg * mult * dmgMult;
          zombies.damage(zHit.zombie, dmg, zHit.part, dir, zHit.point, this);
          if (this.onHit) this.onHit(zHit.zombie, dmg, zHit.part);
        } else if (wallT < this.def.range) {
          end = origin.clone().addScaledVector(dir, wallT);
          this.effects.sparks(end);
        } else {
          end = origin.clone().addScaledVector(dir, this.def.range);
        }
        if (this.def.beam) this._beam(muzzleWorld, end);
        else this.effects.tracer(muzzleWorld, end, this.def.tracer);
      }
    }

    if (this.onShot) this.onShot();
    if (this.item.mag === 0 && this.item.reserve > 0) this.startReload();
  }

  _beam(from, to) {
    const b = this.beams.find((b) => b.life <= 0) || this.beams[0];
    if (!b.mesh.parent && this.scene) this.scene.add(b.mesh);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const len = from.distanceTo(to);
    b.mesh.position.copy(mid);
    b.mesh.scale.set(1, len, 1);
    b.mesh.lookAt(to);
    b.mesh.rotateX(Math.PI / 2);
    b.mesh.material.opacity = 0.9;
    b.mesh.visible = true;
    b.life = 0.09;
    this.effects.sparks(to);
  }

  _launchProjectile(from, dir, dmgMult, zombies) {
    const p = this.def.projectile;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshBasicMaterial({ color: p.color })
    );
    mesh.position.copy(from);
    const light = new THREE.PointLight(p.color, 8, 6, 2);
    mesh.add(light);
    if (this.scene) this.scene.add(mesh);
    this.projectiles.push({
      mesh, vel: dir.clone().multiplyScalar(p.speed),
      blast: p.blast, dmg: this.def.dmg * dmgMult, selfDmg: p.selfDmg,
      color: p.color, gravity: p.gravity || 0, life: 4, zombies,
    });
  }

  _explode(proj, at) {
    const { zombies } = proj;
    this.effects.explosion(at, proj.color, proj.blast);
    audio.explosion();
    zombies.blastDamage(at, proj.blast, proj.dmg, (z, dmg) => { if (this.onHit) this.onHit(z, dmg, 'blast'); });
    const dEye = this.player.eyePosition().distanceTo(at);
    if (dEye < proj.blast * 0.9) this.player.takeDamage(proj.selfDmg);
    this.scene?.remove(proj.mesh);
  }

  update(dt, zombies, mouseDelta) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 1.8);

    if (this.reloading > 0 && this.item) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        const need = this.def.mag - this.item.mag;
        const take = Math.min(need, this.item.reserve);
        this.item.mag += take;
        this.item.reserve -= take;
      }
    }

    if (this.triggerHeld && this.def?.auto) this._tryFire(zombies);

    this.flashLight.intensity *= Math.exp(-30 * dt);
    this.flashSprite.material.opacity *= Math.exp(-26 * dt);

    // beams
    for (const b of this.beams) {
      if (b.life > 0) {
        b.life -= dt;
        b.mesh.material.opacity = Math.max(0, b.life / 0.09) * 0.9;
        if (b.life <= 0) b.mesh.visible = false;
      }
    }

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.vel.y -= pr.gravity * dt;
      const step = pr.vel.length() * dt;
      const dir = pr.vel.clone().normalize();
      const from = pr.mesh.position.clone();
      const wallT = raycastColliders(this.world.colliders, from, dir, step + 0.1);
      const zHit = pr.zombies.raycast(from, dir, Math.min(step + 0.1, wallT));
      if (zHit) {
        this._explode(pr, zHit.point);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (wallT <= step + 0.1) {
        this._explode(pr, from.addScaledVector(dir, wallT));
        this.projectiles.splice(i, 1);
        continue;
      }
      pr.mesh.position.addScaledVector(dir, step);
      if (pr.mesh.position.y <= 0.05) {
        pr.mesh.position.y = 0.05;
        this._explode(pr, pr.mesh.position.clone());
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.life <= 0) {
        this.scene?.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    this.meleeCd = Math.max(0, this.meleeCd - dt);

    if (!this.model) return;
    this.raiseAnim = Math.min(1, this.raiseAnim + dt * 4.5);
    this.kickBack *= Math.exp(-11 * dt);
    this.meleeAnim = Math.max(0, this.meleeAnim - dt * 3.2);

    const k = 1 - Math.exp(-10 * dt);
    this.swayX += (THREE.MathUtils.clamp(-mouseDelta.x * 0.0012, -0.03, 0.03) - this.swayX) * k;
    this.swayY += (THREE.MathUtils.clamp(mouseDelta.y * 0.0012, -0.03, 0.03) - this.swayY) * k;

    const adsBlend = this.player.ads && this.reloading <= 0 ? 1 : 0;
    this._adsCur = (this._adsCur ?? 0) + (adsBlend - (this._adsCur ?? 0)) * Math.min(1, 12 * dt);
    const basePos = HIP_POS.clone().lerp(ADS_POS, this._adsCur);

    const bob = this.player.bobAmp;
    const ph = this.player.bobPhase;
    basePos.x += Math.sin(ph) * 0.012 * bob * (1 - this._adsCur);
    basePos.y += Math.abs(Math.cos(ph)) * 0.014 * bob * (1 - this._adsCur) - (1 - this.raiseAnim) * 0.35;
    basePos.z += this.kickBack * this.def.kick * 0.9;

    this.root.position.copy(basePos);
    this.root.position.x += this.swayX;
    this.root.position.y += this.swayY;
    this.root.rotation.set(
      this.kickBack * this.def.kick * 1.6 + this.swayY * 1.2 + (1 - this.raiseAnim) * 0.7,
      this.swayX * 1.4,
      this.swayX * 0.6
    );

    // bolt-action: visible cycling dip between kar98 shots
    if (this.def.bolt && this.cooldown > 0.25) {
      const t = Math.sin(Math.min(1, (1 / this.fireRate() - this.cooldown) / 0.6) * Math.PI);
      this.root.position.y -= t * 0.05;
      this.root.rotation.z += t * 0.18;
    }

    if (this.reloading > 0) {
      const t = 1 - this.reloading / (this._reloadTotal || this.def.reload);
      const dip = Math.sin(Math.min(1, t * 1.15) * Math.PI);
      this.root.position.y -= dip * 0.22;
      this.root.rotation.x -= dip * 0.5;
      this.root.rotation.z += dip * 0.3;
    }

    // gun-bash swing: lunge forward + twist, then recover
    if (this.meleeAnim > 0) {
      const k = Math.sin(this.meleeAnim * Math.PI); // out-and-back
      this.root.position.z -= k * 0.28;
      this.root.position.x -= k * 0.1;
      this.root.rotation.x += k * 0.55;
      this.root.rotation.y += k * 0.35;
      this.root.rotation.z -= k * 0.25;
    }
  }

  // Gun bash: shove nearby zombies back with the weapon. Small damage,
  // realistic short knockback, 0.8s cooldown, viewmodel swing animation.
  melee(zombies) {
    if (this.meleeCd > 0 || this.player.dead) return false;
    this.meleeCd = 0.8;
    this.meleeAnim = 1;
    audio.melee();
    const origin = this.player.eyePosition();
    const fwd = this.player.eyeDirection();
    fwd.y = 0;
    fwd.normalize();
    let hitAny = false;
    for (const z of zombies.zombies) {
      if (z.dead || !z.alive) continue;
      const to = new THREE.Vector3(z.pos.x - this.player.pos.x, 0, z.pos.z - this.player.pos.z);
      const dist = to.length();
      if (dist > 2.3 || Math.abs(z.pos.y - this.player.pos.y) > 1.6) continue;
      to.normalize();
      if (to.dot(fwd) < 0.35 && dist > 0.9) continue; // ~110° front cone (point-blank always hits)
      hitAny = true;
      const dmg = 35 * this.getMods().dmgMult;
      const hitPoint = z.pos.clone().setY(z.pos.y + 1.1);
      const res = z.takeDamage(dmg, 'body', hitPoint, to.clone());
      if (res && this.onHit) this.onHit(z, dmg, 'melee');
      if (!z.dead) z.applyKnockback(to, z.boss ? 0.6 : 2.6); // bosses barely budge
    }
    if (hitAny) audio.hit();
    return true;
  }

  crosshairSpread() {
    if (!this.def) return 6;
    const move = Math.hypot(this.player.vel.x, this.player.vel.z) / 5.4;
    const base = (this.player.ads ? this.def.adsSpread : this.def.spread) * 900;
    return 4 + base * (1 + this.spreadBloom * 1.6 + move * 0.7);
  }
}
