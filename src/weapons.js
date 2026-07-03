import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { WEAPONS, weaponDef } from './items.js';
import { raycastColliders, groundHeightAt, baseGroundAt } from './physics.js';
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
    case 'rpg': {
      // shoulder-fired bazooka: long tube, blast shield, front/rear grips
      add(g, C(0.05, 0.05, 0.95, 14), metal, 0, 0.06, -0.08, Math.PI / 2);
      add(g, C(0.058, 0.05, 0.1, 14), dark, 0, 0.06, -0.58, Math.PI / 2);   // muzzle ring
      add(g, C(0.05, 0.065, 0.12, 14), dark, 0, 0.06, 0.42, Math.PI / 2);   // exhaust bell
      add(g, B(0.02, 0.12, 0.16), metal, 0, 0.13, 0.1, 0.2);                // shield plate
      add(g, B(0.04, 0.12, 0.05), darkWood, 0, -0.05, 0.12, 0.3);           // grip
      add(g, B(0.04, 0.1, 0.05), darkWood, 0, -0.05, -0.14, 0.15);          // foregrip
      add(g, B(0.012, 0.05, 0.012), metal, 0, 0.14, -0.34);                 // sight post
      add(g, C(0.035, 0.035, 0.3, 10), dark, 0, 0.06, -0.35, Math.PI / 2);  // loaded rocket tip
      add(g, C(0.012, 0.035, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x7a2c1c, roughness: 0.6 }), 0, 0.06, -0.62, Math.PI / 2);
      muzzleZ = -0.66;
      break;
    }
    case 'wavegun': {
      // sonic cannon: chrome horn emitter, ribbed body, glowing resonator
      const chrome = new THREE.MeshStandardMaterial({ color: 0xaab4c2, metalness: 0.9, roughness: 0.22 });
      const glow = new THREE.MeshStandardMaterial({ color: 0x123244, emissive: 0x7ad8ff, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.3 });
      add(g, B(0.08, 0.12, 0.34), dark, 0, 0.02, 0.0);
      add(g, C(0.028, 0.09, 0.3, 14), chrome, 0, 0.045, -0.32, Math.PI / 2); // horn
      add(g, C(0.095, 0.1, 0.03, 14), glow, 0, 0.045, -0.47, Math.PI / 2);   // emitter lip
      for (let i = 0; i < 3; i++) add(g, C(0.052 - i * 0.008, 0.052 - i * 0.008, 0.02, 12), chrome, 0, 0.045, -0.1 - i * 0.07, Math.PI / 2);
      add(g, new THREE.SphereGeometry(0.045, 12, 12), glow, 0, 0.09, 0.12);  // resonator orb
      add(g, B(0.05, 0.16, 0.07), dark, 0, -0.1, 0.12, 0.35);
      muzzleZ = -0.5;
      break;
    }
    case 'tempest': {
      const coil = new THREE.MeshStandardMaterial({ color: 0x2c3a4c, emissive: 0x86c8ff, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 });
      add(g, B(0.06, 0.1, 0.4), dark, 0, 0.02, -0.04);
      for (let i = 0; i < 4; i++) add(g, new THREE.TorusGeometry(0.05, 0.012, 8, 14), coil, 0, 0.045, -0.16 - i * 0.09);
      add(g, C(0.012, 0.012, 0.45, 8), metal, 0, 0.045, -0.28, Math.PI / 2);
      add(g, new THREE.SphereGeometry(0.03, 10, 10), coil, 0, 0.045, -0.52);
      add(g, B(0.05, 0.15, 0.07), dark, 0, -0.09, 0.1, 0.32);
      muzzleZ = -0.55;
      break;
    }
    case 'hellfire': {
      const hot = new THREE.MeshStandardMaterial({ color: 0x3a1408, emissive: 0xff6a1a, emissiveIntensity: 0.8, roughness: 0.5 });
      add(g, C(0.024, 0.024, 0.58, 10), metal, 0, 0.045, -0.2, Math.PI / 2);
      add(g, C(0.02, 0.02, 0.5, 10), hot, 0, -0.002, -0.16, Math.PI / 2);   // heated tube mag
      add(g, B(0.05, 0.05, 0.16), darkWood, 0, -0.002, -0.3);               // pump
      add(g, B(0.055, 0.08, 0.2), dark, 0, 0.02, 0.05);
      add(g, C(0.035, 0.028, 0.09, 10), dark, 0, 0.045, -0.52, Math.PI / 2); // flash cone
      add(g, B(0.05, 0.17, 0.1), darkWood, 0, -0.1, 0.16, 0.35);
      muzzleZ = -0.55;
      break;
    }
    case 'pickaxe': {
      // one-blade pick + axe hybrid: long haft, axe blade one side, pick spike the other
      const haft = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 });
      const blade = new THREE.MeshStandardMaterial({ color: 0x8f9aa8, metalness: 0.85, roughness: 0.25 });
      const edge = new THREE.MeshStandardMaterial({ color: 0xc8d2de, metalness: 0.95, roughness: 0.15 });
      add(g, C(0.016, 0.02, 0.62, 8), haft, 0, -0.1, -0.05, 0.5);           // angled haft
      add(g, B(0.02, 0.16, 0.1), blade, 0, 0.16, -0.2, 0.5);                // axe cheek
      add(g, B(0.014, 0.2, 0.05), edge, 0, 0.16, -0.26, 0.5);               // axe edge
      const spike = add(g, C(0.005, 0.028, 0.22, 6), blade, 0, 0.2, -0.06, Math.PI / 2 + 0.5);
      spike.rotation.z = 0.2;
      add(g, B(0.03, 0.05, 0.06), blade, 0, 0.14, -0.14, 0.5);              // head socket
      muzzleZ = -0.4;
      break;
    }
    case 'block': {
      const stone = new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.95 });
      add(g, B(0.2, 0.2, 0.2), stone, 0.05, -0.04, -0.1, 0.2, 0.4, 0.1);
      muzzleZ = -0.3;
      break;
    }
    case 'fists': {
      // bare knuckles — two forearm + fist blocks; berserker scales them up
      const skin = new THREE.MeshStandardMaterial({ color: 0xc9a184, roughness: 0.75 });
      const wrap = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
      for (const s of [-1, 1]) {
        add(g, B(0.09, 0.09, 0.22), skin, s * 0.16, -0.06, 0.06, 0.2, 0, s * -0.15); // forearm
        add(g, B(0.11, 0.1, 0.12), skin, s * 0.15, -0.04, -0.08, 0.1, 0, s * -0.1);  // fist
        add(g, B(0.115, 0.04, 0.08), wrap, s * 0.15, -0.02, -0.08, 0.1, 0, s * -0.1); // knuckle wrap
      }
      muzzleZ = -0.3;
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
    for (const key of ['fists', 'pickaxe', 'block']) {
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

    this.heat = 0;              // Dragonspit flamethrower heat (0..maxHeat)
    this.overheated = false;
    this.berserk = false;       // main sets during the Berserker powerup
    this.waves = [];            // live W.A.V.E. shots
    this.lastMissile = null;    // most recent bazooka rocket
    this.guiding = null;        // projectile under player control
    this.guideSteer = { x: 0, y: 0 };

    this.onShot = null;
    this.onHit = null;          // (zombie, dmg, part) -> points feed
    this.onGoop = null;         // (point, dmg) — nuclear weapons leave waste
    this.getMods = () => ({ dmgMult: 1, rpmMult: 1, reloadMult: 1 }); // perks, set by main
    this.scene = null;          // set by main for beams/projectiles
    this.mobs = null;           // set by main — bullets can hit cows
  }

  // Anything can be "held": weapons show their gun, the pickaxe-axe and
  // carried blocks show themselves, empty hands show fists (berserker-ready).
  equip(item) {
    const isWeapon = item?.kind === 'weapon';
    const modelKey = isWeapon ? item.weaponKey
      : item?.id === 'pickaxe' ? 'pickaxe'
      : (item?.build === 'block' || item?.build === 'gblock') ? 'block'
      : !item ? 'fists' : null;
    if (this.item === (isWeapon ? item : null) && this._modelKey === modelKey) return;
    if (this.model) this.model.visible = false;
    this._modelKey = modelKey;
    this.item = isWeapon ? item : null;
    this.holding = item || null;
    this.reloading = 0;
    this.triggerHeld = false;
    this.heat = 0;
    this.overheated = false;
    this.def = isWeapon ? weaponDef(item) : null;
    if (isWeapon && item.mag === undefined) { item.mag = this.def.mag; item.reserve = this.def.reserve; }
    this.model = modelKey ? this.models[modelKey] : null;
    if (this.model) {
      this.model.visible = true;
      this.raiseAnim = 0;
      audio.equip();
    }
    if (isWeapon) this._applyPapTint();
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
    if (this.def.flame) return; // Dragonspit streams continuously in update()
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

    if (this.def.wave) {
      this._fireWave(origin, baseDir, dmgMult, zombies, muzzleWorld);
    } else if (this.def.projectile) {
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
        const mHit = !zHit && this.mobs ? this.mobs.raycast(origin, dir, Math.min(this.def.range, wallT)) : null;

        let end;
        if (mHit) {
          end = mHit.point;
          this.mobs.damage(mHit.mob, this.def.dmg * dmgMult, mHit.point, dir);
        } else if (zHit) {
          end = zHit.point;
          const mult = zHit.part === 'head' ? this.def.headMult : zHit.part === 'legs' ? 0.8 : 1;
          const dmg = this.def.dmg * mult * dmgMult;
          zombies.damage(zHit.zombie, dmg, zHit.part, dir, zHit.point, this);
          if (this.def.burn) { zHit.zombie.burnT = this.def.burn.dur; zHit.zombie.burnDps = this.def.burn.dps * dmgMult; }
          if (this.def.chain) this._chainLightning(zHit.zombie, dmgMult, zombies, zHit.point);
          if (this.def.blastback) this._blastback(zHit.zombie, dir, zombies);
          if (this.onHit) this.onHit(zHit.zombie, dmg, zHit.part);
        } else if (wallT < this.def.range) {
          end = origin.clone().addScaledVector(dir, wallT);
          this.effects.sparks(end);
        } else {
          end = origin.clone().addScaledVector(dir, this.def.range);
        }
        if (this.def.nuclear && end && Math.random() < (this.def.auto ? 0.2 : 0.9)) this.onGoop?.(end.clone(), this.def.dmg * dmgMult);
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
    let mesh;
    if (p.missile) {
      // a real rocket: body + red tip + fins
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 10),
        new THREE.MeshStandardMaterial({ color: 0x5a5f52, metalness: 0.5, roughness: 0.5 }));
      body.rotation.x = Math.PI / 2;
      mesh.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 10),
        new THREE.MeshStandardMaterial({ color: 0x8a2c1c, roughness: 0.5 }));
      tip.rotation.x = -Math.PI / 2; tip.position.z = -0.32;
      mesh.add(tip);
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.1),
          new THREE.MeshStandardMaterial({ color: 0x3a3d36 }));
        fin.position.z = 0.22;
        fin.rotation.z = (i / 4) * Math.PI * 2;
        fin.translateY(0.08);
        mesh.add(fin);
      }
      const glow = new THREE.PointLight(0xffb347, 6, 5, 2);
      glow.position.z = 0.3;
      mesh.add(glow);
    } else {
      mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshBasicMaterial({ color: p.color })
      );
      const light = new THREE.PointLight(p.color, 8, 6, 2);
      mesh.add(light);
    }
    mesh.position.copy(from);
    if (this.scene) this.scene.add(mesh);
    const proj = {
      mesh, vel: dir.clone().multiplyScalar(p.speed),
      blast: p.blast, dmg: this.def.dmg * dmgMult, selfDmg: p.selfDmg,
      color: p.color, gravity: p.gravity || 0, life: p.missile ? 14 : 4, zombies,
      missile: !!p.missile, nuclear: !!this.item?.nuclear, smokeT: 0,
    };
    this.projectiles.push(proj);
    if (p.missile) this.lastMissile = proj;
  }

  _explode(proj, at) {
    const { zombies } = proj;
    this.effects.explosion(at, proj.color, proj.blast);
    audio.explosion();
    zombies.blastDamage(at, proj.blast, proj.dmg, (z, dmg) => { if (this.onHit) this.onHit(z, dmg, 'blast'); });
    this.mobs?.blast?.(at, proj.blast, proj.dmg); // spider boss + nukelings
    if (proj.nuclear) this.onGoop?.(at.clone(), proj.dmg);
    const dEye = this.player.eyePosition().distanceTo(at);
    if (dEye < proj.blast * 0.9) this.player.takeDamage(proj.selfDmg);
    this.scene?.remove(proj.mesh);
    if (this.guiding === proj) this.guiding = null;
    if (this.lastMissile === proj) this.lastMissile = null;
  }

  // PaP'd bazooka: take control of the rocket mid-flight (CoD-style).
  startGuiding() {
    if (this.lastMissile && this.projectiles.includes(this.lastMissile)) {
      this.guiding = this.lastMissile;
      this.guideSteer.x = 0; this.guideSteer.y = 0;
      return true;
    }
    return false;
  }

  // W.A.V.E. Cannon: a visible pressure wave — expanding rings + a warping
  // air shell — that batters everything in a forward cone.
  _fireWave(origin, dir, dmgMult, zombies, muzzleWorld) {
    const W = this.def.wave;
    const flat = dir.clone().setY(0).normalize();
    // damage + heavy knockback in the cone
    for (const z of zombies.zombies) {
      if (z.dead || !z.alive) continue;
      const to = new THREE.Vector3(z.pos.x - this.player.pos.x, 0, z.pos.z - this.player.pos.z);
      const d = to.length();
      if (d > W.range || Math.abs(z.pos.y - this.player.pos.y) > 3) continue;
      to.normalize();
      if (to.dot(flat) < Math.cos(W.halfAngle)) continue;
      const dmg = this.def.dmg * dmgMult * (1 - (d / W.range) * 0.5);
      const hp = z.pos.clone().setY(z.pos.y + 1.1);
      z.takeDamage(dmg, 'body', hp, to.clone());
      if (this.onHit) this.onHit(z, dmg, 'body');
      if (!z.dead) z.applyKnockback(to, z.boss ? 1.2 : W.knock);
    }
    this.player.shake = Math.min(0.9, this.player.shake + 0.45);
    // visuals: 4 shock rings + refracting air shell traveling out
    const group = new THREE.Group();
    group.position.copy(muzzleWorld);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.3 + i * 0.14, 0.05 - i * 0.008, 10, 28),
        new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55 - i * 0.1, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.position.z = -i * 0.5;
      group.add(ring);
    }
    // the "air bend": a transmissive lens shell that visually warps the scene
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshPhysicalMaterial({
        transmission: 1, thickness: 1.2, roughness: 0.12, ior: 1.35,
        transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    shell.rotation.x = -Math.PI / 2;
    group.add(shell);
    this.scene?.add(group);
    this.waves.push({ group, shell, t: 0, dir: dir.clone(), speed: 26, life: W.range / 26 });
  }

  // Tempest Coil: lightning arcs from the victim to nearby zombies.
  _chainLightning(victim, dmgMult, zombies, hitPoint) {
    const C = this.def.chain;
    let from = victim;
    let fromPt = hitPoint.clone();
    let dmg = this.def.dmg * dmgMult;
    const hitSet = new Set([victim]);
    for (let j = 0; j < C.jumps; j++) {
      let best = null, bd = C.radius;
      for (const z of zombies.zombies) {
        if (z.dead || !z.alive || hitSet.has(z)) continue;
        const d = z.pos.distanceTo(from.pos);
        if (d < bd) { bd = d; best = z; }
      }
      if (!best) break;
      hitSet.add(best);
      dmg *= C.falloff;
      const toPt = best.pos.clone().setY(best.pos.y + 1.2 * best.scale);
      // jagged arc: 3 tracer segments with midpoint jitter
      let a = fromPt;
      for (let s = 1; s <= 3; s++) {
        const b = fromPt.clone().lerp(toPt, s / 3);
        if (s < 3) b.add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7));
        this.effects.tracer(a, b, 0x86c8ff);
        a = b;
      }
      this.effects.sparksColored(toPt, 0x86c8ff);
      best.takeDamage(dmg, 'body', toPt, null);
      if (this.onHit) this.onHit(best, dmg, 'chain');
      from = best;
      fromPt = toPt;
    }
    if (hitSet.size > 1) audio.zap();
  }

  // ★ The Blaster: victim rockets backward; zombies caught in the corridor
  // behind them lose 50% of their max HP.
  _blastback(victim, dir, zombies) {
    const B = this.def.blastback;
    const flat = dir.clone().setY(0).normalize();
    if (!victim.dead) victim.applyKnockback(flat, victim.boss ? 2 : B.knock);
    const base = victim.pos.clone();
    for (const z of zombies.zombies) {
      if (z.dead || !z.alive || z === victim) continue;
      const rel = new THREE.Vector3(z.pos.x - base.x, 0, z.pos.z - base.z);
      const along = rel.dot(flat);
      if (along < 0 || along > B.range) continue;
      const perp = rel.clone().addScaledVector(flat, -along).length();
      if (perp > B.corridor) continue;
      const pt = z.pos.clone().setY(z.pos.y + 1.1);
      z.takeDamage(z.maxHp * 0.5, 'body', pt, flat.clone());
      if (this.onHit) this.onHit(z, z.maxHp * 0.5, 'body');
      if (!z.dead) z.applyKnockback(flat, 4);
    }
    this.effects.explosion(base.clone().setY(base.y + 1), 0xff5c5c, 2);
  }

  // Dragonspit: continuous flame cone — heat 0..8s, instant recharge on release.
  _updateFlame(dt, zombies) {
    const F = this.def?.flame;
    if (!F) return;
    const firing = this.triggerHeld && !this.overheated && this.reloading <= 0 &&
      !this.player.dead && this.raiseAnim > 0.55;
    if (firing) {
      this.heat += dt;
      if (this.heat >= F.maxHeat) { this.heat = F.maxHeat; this.overheated = true; }
      const muzzle = this.model.getObjectByName('muzzle');
      const mw = muzzle.getWorldPosition(new THREE.Vector3());
      const dir = this.player.eyeDirection();
      // flame jet particles
      for (let i = 0; i < 3; i++) {
        const v = dir.clone().multiplyScalar(9 + Math.random() * 4)
          .add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6));
        this.effects._emit(mw, v, 0.35 + Math.random() * 0.3,
          new THREE.Color(Math.random() < 0.5 ? 0xff7a1a : 0xffc040), 0.14 + Math.random() * 0.12, -1.5, 1.6);
      }
      this.flashLight.color.setHex(0xff8a30);
      this.flashLight.intensity = 14 + Math.random() * 8;
      this._flameSnd = (this._flameSnd || 0) - dt;
      if (this._flameSnd <= 0) { this._flameSnd = 0.14; audio.flame(); }
      // cone damage tick
      this._flameTick = (this._flameTick || 0) - dt;
      if (this._flameTick <= 0) {
        this._flameTick = 0.12;
        const dmg = F.dps * 0.12 * this.getMods().dmgMult;
        const flat = dir.clone().setY(0).normalize();
        for (const z of zombies.zombies) {
          if (z.dead || !z.alive) continue;
          const to = new THREE.Vector3(z.pos.x - this.player.pos.x, 0, z.pos.z - this.player.pos.z);
          const d = to.length();
          if (d > F.range || Math.abs(z.pos.y - this.player.pos.y) > 2.2) continue;
          to.normalize();
          if (to.dot(flat) < 0.78 && d > 1.2) continue;
          z.burnT = Math.max(z.burnT, 1.2);
          z.burnDps = Math.max(z.burnDps, 40);
          const res = z.takeDamage(dmg, 'body', z.pos.clone().setY(z.pos.y + 1.1), to);
          if (res && this.onHit) this.onHit(z, dmg, 'flame');
        }
      }
    } else if (!this.triggerHeld) {
      this.heat = 0; // recharges the instant the trigger is released
      this.overheated = false;
    }
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

    if (this.triggerHeld && this.def?.auto && !this.def.flame) this._tryFire(zombies);
    if (this.def?.flame) this._updateFlame(dt, zombies);

    this.flashLight.intensity *= Math.exp(-30 * dt);
    this.flashSprite.material.opacity *= Math.exp(-26 * dt);

    // W.A.V.E. shots: rings + air-lens shell rushing forward
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t += dt;
      w.group.position.addScaledVector(w.dir, w.speed * dt);
      const s = 1 + w.t * 6;
      w.group.scale.set(s, s, 1 + w.t * 2);
      for (const c of w.group.children) {
        if (c !== w.shell && c.material?.opacity !== undefined) c.material.opacity *= Math.exp(-1.4 * dt);
      }
      if (w.t > w.life) {
        this.scene?.remove(w.group);
        w.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        this.waves.splice(i, 1);
      }
    }

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
      if (pr.missile) {
        pr.smokeT -= dt;
        if (pr.smokeT <= 0) { pr.smokeT = 0.025; this.effects.smoke(pr.mesh.position, 1); }
        // nose (-Z) points along velocity
        pr.mesh.lookAt(pr.mesh.position.clone().sub(pr.vel));
      }
      if (pr === this.guiding) {
        // player steers the rocket with the mouse
        const speed = Math.max(20, pr.vel.length());
        const d = pr.vel.clone().normalize();
        d.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.guideSteer.x * 0.0022);
        const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
        if (right.lengthSq() > 0.01) d.applyAxisAngle(right, -this.guideSteer.y * 0.0022);
        pr.vel.copy(d.multiplyScalar(speed));
        pr.gravity = 0;
        this.guideSteer.x = 0;
        this.guideSteer.y = 0;
      }
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
      const gy = baseGroundAt(pr.mesh.position.x, pr.mesh.position.z);
      if (gy > -900 && pr.mesh.position.y <= gy + 0.05) {
        pr.mesh.position.y = gy + 0.05;
        this._explode(pr, pr.mesh.position.clone());
        this.projectiles.splice(i, 1);
        continue;
      }
      if (pr.life <= 0) {
        this.scene?.remove(pr.mesh);
        if (this.guiding === pr) this.guiding = null;
        if (this.lastMissile === pr) this.lastMissile = null;
        this.projectiles.splice(i, 1);
      }
    }

    this.meleeCd = Math.max(0, this.meleeCd - dt);

    if (!this.model) return;
    this.raiseAnim = Math.min(1, this.raiseAnim + dt * 4.5);
    this.kickBack *= Math.exp(-11 * dt);
    this.meleeAnim = Math.max(0, this.meleeAnim - dt * 3.2);

    // berserker: bare fists swell into wrecking balls
    if (this._modelKey === 'fists') {
      const target = this.berserk ? 1.9 : 1;
      const cur = this.model.scale.x;
      this.model.scale.setScalar(cur + (target - cur) * Math.min(1, dt * 8));
    }

    const kick = this.def?.kick ?? 0.06;
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
    basePos.z += this.kickBack * kick * 0.9;

    this.root.position.copy(basePos);
    this.root.position.x += this.swayX;
    this.root.position.y += this.swayY;
    this.root.rotation.set(
      this.kickBack * kick * 1.6 + this.swayY * 1.2 + (1 - this.raiseAnim) * 0.7,
      this.swayX * 1.4,
      this.swayX * 0.6
    );

    // bolt-action: visible cycling dip between kar98 shots
    if (this.def?.bolt && this.cooldown > 0.25) {
      const t = Math.sin(Math.min(1, (1 / this.fireRate() - this.cooldown) / 0.6) * Math.PI);
      this.root.position.y -= t * 0.05;
      this.root.rotation.z += t * 0.18;
    }

    if (this.reloading > 0) {
      const t = 1 - this.reloading / (this._reloadTotal || this.def?.reload || 2);
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

  // Melee: gun bash / pickaxe swing / punch. Small default damage + short
  // knockback; the pickaxe and berserker fists pass bigger numbers via opts.
  melee(zombies, opts = {}) {
    if (this.meleeCd > 0 || this.player.dead) return false;
    this.meleeCd = opts.cd ?? 0.8;
    this.meleeAnim = 1;
    audio.melee();
    const fwd = this.player.eyeDirection();
    fwd.y = 0;
    fwd.normalize();
    let hitAny = false;
    const reach = opts.reach ?? 2.3;
    for (const z of zombies.zombies) {
      if (z.dead || !z.alive) continue;
      const to = new THREE.Vector3(z.pos.x - this.player.pos.x, 0, z.pos.z - this.player.pos.z);
      const dist = to.length();
      if (dist > reach || Math.abs(z.pos.y - this.player.pos.y) > 1.6) continue;
      to.normalize();
      if (to.dot(fwd) < 0.35 && dist > 0.9) continue; // ~110° front cone (point-blank always hits)
      hitAny = true;
      const dmg = (opts.dmg ?? 35) * this.getMods().dmgMult;
      const hitPoint = z.pos.clone().setY(z.pos.y + 1.1);
      const res = z.takeDamage(dmg, 'body', hitPoint, to.clone());
      if (res && this.onHit) this.onHit(z, dmg, opts.tag || 'melee');
      if (!z.dead) z.applyKnockback(to, z.boss ? 0.6 : (opts.knock ?? 2.6)); // bosses barely budge
    }
    // punching cows / mobs too
    if (opts.mobs) {
      for (const m of opts.mobs.list) {
        if (m.dead) continue;
        const to = new THREE.Vector3(m.pos.x - this.player.pos.x, 0, m.pos.z - this.player.pos.z);
        const dist = to.length();
        if (dist > reach + 0.4) continue;
        to.normalize();
        if (to.dot(fwd) < 0.3 && dist > 1) continue;
        opts.mobs.damage(m, (opts.dmg ?? 35) * this.getMods().dmgMult, m.pos.clone().setY(m.pos.y + 0.8), to);
        hitAny = true;
      }
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
