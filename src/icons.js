import * as THREE from 'three';
import { buildGunModel, makeRayGunMesh } from './weapons.js';
import { ARMOR_TIERS } from './items.js';

// Inventory icons rendered from real 3D models (128px, transparent),
// per digests/inventory.md: offscreen renderer, warm key + cool rim,
// model wrapped at rotation (0.42, -0.72, 0), camera fov 30.

const SIZE = 128;

function mk(geo, color, opts = {}) {
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }));
  return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r1, r2, h, s = 10) => new THREE.CylinderGeometry(r1, r2, h, s);

function buildIconModel(key) {
  const g = new THREE.Group();
  const [kind, a, b] = key.split(':');
  switch (kind) {
    case 'weapon': {
      let gun = a === 'raygun' ? (makeRayGunMesh() || buildGunModel('raygun')) : buildGunModel(a);
      if (b === 'pap') {
        gun.traverse((o) => {
          if (o.isMesh) {
            o.material = o.material.clone ? o.material.clone() : o.material;
            if (o.material.emissive) { o.material.emissive.setHex(0x7a2bd6); o.material.emissiveIntensity = 0.4; }
          }
        });
      }
      g.add(gun);
      break;
    }
    case 'mat':
      if (a === 'wood') {
        for (const [y, z] of [[0.06, -0.07], [0.06, 0.07], [0.17, 0]]) {
          const log = mk(C(0.055, 0.055, 0.5, 8), 0x6b4a2a);
          log.rotation.z = Math.PI / 2;
          log.position.set(0, y, z);
          g.add(log);
        }
      } else {
        for (let i = 0; i < 5; i++) {
          const lump = mk(new THREE.SphereGeometry(0.09, 6, 5), 0x101014, { roughness: 0.55, metalness: 0.3 });
          lump.position.set((Math.random() - 0.5) * 0.22, 0.05 + Math.random() * 0.14, (Math.random() - 0.5) * 0.22);
          g.add(lump);
        }
      }
      break;
    case 'build':
      if (a === 'wall') g.add(mk(B(0.5, 0.6, 0.05), 0x6b4a2a));
      else if (a === 'floor') { const f = mk(B(0.55, 0.05, 0.55), 0x6b4a2a); f.position.y = 0.05; g.add(f); }
      else for (let i = 0; i < 4; i++) { const s = mk(B(0.14, 0.1 * (i + 1), 0.4), 0x6b4a2a); s.position.set(-0.2 + i * 0.14, 0.05 * (i + 1), 0); g.add(s); }
      break;
    case 'tool':
      switch (a) {
        case 'keys': {
          const ring = mk(new THREE.TorusGeometry(0.14, 0.025, 8, 16), 0xc8a742, { metalness: 0.85, roughness: 0.3 });
          g.add(ring);
          const kbody = mk(B(0.06, 0.24, 0.02), 0xaab0b8, { metalness: 0.9, roughness: 0.3 });
          kbody.position.set(0.1, -0.2, 0);
          g.add(kbody);
          const teeth = mk(B(0.09, 0.06, 0.02), 0xaab0b8, { metalness: 0.9, roughness: 0.3 });
          teeth.position.set(0.13, -0.3, 0);
          g.add(teeth);
          break;
        }
        case 'wand': {
          const rod = mk(C(0.02, 0.028, 0.55, 8), 0x241a10);
          rod.rotation.z = 0.5;
          g.add(rod);
          const tip = mk(new THREE.SphereGeometry(0.05, 8, 8), 0xf7d774, { emissive: 0xf7d774, emissiveIntensity: 0.9 });
          tip.position.set(-0.13, 0.26, 0);
          g.add(tip);
          break;
        }
        case 'bench': {
          const top = mk(B(0.62, 0.07, 0.42), 0x6b4a2a); top.position.y = 0.2; g.add(top);
          for (const [x, z] of [[-0.26, -0.15], [0.26, -0.15], [-0.26, 0.15], [0.26, 0.15]]) {
            const leg = mk(B(0.07, 0.34, 0.07), 0x3e2c18); leg.position.set(x, 0, z); g.add(leg);
          }
          const grid = mk(B(0.3, 0.015, 0.3), 0x2c2c30); grid.position.y = 0.245; g.add(grid);
          break;
        }
        case 'anvil': {
          const base = mk(B(0.34, 0.12, 0.26), 0x2e2f33, { metalness: 0.7, roughness: 0.45 }); base.position.y = 0.0; g.add(base);
          const waist = mk(B(0.18, 0.14, 0.18), 0x2e2f33, { metalness: 0.7, roughness: 0.45 }); waist.position.y = 0.13; g.add(waist);
          const top = mk(B(0.5, 0.1, 0.2), 0x393b40, { metalness: 0.75, roughness: 0.4 }); top.position.y = 0.25; g.add(top);
          const horn = mk(C(0.02, 0.08, 0.2, 8), 0x393b40, { metalness: 0.75, roughness: 0.4 });
          horn.rotation.z = Math.PI / 2; horn.position.set(0.32, 0.25, 0); g.add(horn);
          break;
        }
        case 'jetpack': {
          for (const x of [-0.11, 0.11]) {
            const tank = mk(C(0.09, 0.09, 0.42, 12), 0x37414b, { metalness: 0.6, roughness: 0.4 });
            tank.position.set(x, 0.05, 0); g.add(tank);
            const nozzle = mk(C(0.05, 0.08, 0.1, 8), 0x1d2126, { metalness: 0.7 });
            nozzle.position.set(x, -0.22, 0); g.add(nozzle);
          }
          const strap = mk(B(0.3, 0.08, 0.04), 0x4a3521); strap.position.set(0, 0.1, 0.1); g.add(strap);
          break;
        }
        case 'jetfuel': {
          const can = mk(B(0.28, 0.4, 0.18), 0x2a4c5c, { metalness: 0.5, roughness: 0.5 }); g.add(can);
          const cap = mk(C(0.05, 0.05, 0.08, 8), 0x3fa7c8); cap.position.y = 0.24; g.add(cap);
          break;
        }
      }
      break;
    case 'armor': {
      const tier = Number(b) || 1;
      const col = ARMOR_TIERS[tier].color;
      const mat = { metalness: 0.65, roughness: 0.35 };
      if (a === 'helmet') {
        const dome = mk(B(0.4, 0.24, 0.4), col, mat); dome.position.y = 0.1; g.add(dome);
        const band = mk(B(0.42, 0.1, 0.42), col, mat); band.position.y = -0.04; g.add(band);
      } else if (a === 'chest') {
        const c1 = mk(B(0.42, 0.46, 0.24), col, mat); g.add(c1);
        for (const x of [-0.25, 0.25]) { const p = mk(B(0.13, 0.16, 0.14), col, mat); p.position.set(x, 0.18, 0); g.add(p); }
      } else if (a === 'legs') {
        for (const x of [-0.1, 0.1]) { const l = mk(B(0.16, 0.42, 0.16), col, mat); l.position.set(x, 0, 0); g.add(l); }
        const belt = mk(B(0.4, 0.1, 0.2), col, mat); belt.position.y = 0.24; g.add(belt);
      } else {
        for (const x of [-0.11, 0.11]) { const bt = mk(B(0.16, 0.12, 0.28), col, mat); bt.position.set(x, 0, 0.02); g.add(bt); }
      }
      break;
    }
  }
  return g;
}

export class IconRenderer {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setSize(SIZE, SIZE);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xcfd8e8, 0x40352a, 1.6));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.2);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    this.cache = new Map();
  }

  iconFor(item) {
    if (!item?.icon3d) return null;
    if (this.cache.has(item.icon3d)) return this.cache.get(item.icon3d);
    const model = buildIconModel(item.icon3d);
    const wrap = new THREE.Group();
    wrap.add(model);
    wrap.rotation.set(0.42, -0.72, 0);
    this.scene.add(wrap);

    const box = new THREE.Box3().setFromObject(wrap);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const r = Math.max(size.x, size.y, size.z) || 0.5;
    this.camera.position.set(center.x, center.y, center.z + r * 2.15);
    this.camera.lookAt(center);

    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL();
    this.scene.remove(wrap);
    wrap.traverse((o) => { if (o.isMesh) { o.geometry.dispose?.(); } });
    this.cache.set(item.icon3d, url);
    return url;
  }

  refresh(item) {
    if (item?.icon3d) this.cache.delete(item.icon3d);
  }
}
