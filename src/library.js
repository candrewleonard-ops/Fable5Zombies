import * as THREE from 'three';
import { buildGunModel, loadRayGunSTL, makeRayGunMesh } from './weapons.js';
import { makeZombieBody } from './zombies.js';
import { buildCarModel } from './car.js';
import { buildPapModel } from './pap.js';
import { buildPieceModel } from './build.js';
import { buildMysteryBoxModel } from './mysterybox.js';
import { WEAPONS } from './items.js';

// Asset Library: one WebGL canvas behind a scrolling DOM grid; each card's
// scene rendered via scissored viewport. Pedestals, key/rim lights, turntables.

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

function qTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#eaf4ff'; g.font = 'bold 96px Georgia';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', 77, 70); g.fillText('?', 179, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function perkCabinet(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.75, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0.5, roughness: 0.5 }));
  body.position.y = 0.875;
  g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.6),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, roughness: 0.6 }));
  face.position.set(0, 0.9, 0.283);
  g.add(face);
  return g;
}

function benchModel() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.9), wood);
  top.position.y = 0.85; g.add(top);
  for (const [x, z] of [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x3e2c18 }));
    leg.position.set(x, 0.4, z); g.add(leg);
  }
  return g;
}

function anvilModel() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x393b40, metalness: 0.75, roughness: 0.4 });
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.5), steel); base.position.y = 0.1; g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.34), steel); top.position.y = 0.52; g.add(top);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.13, 0.34, 8), steel);
  horn.rotation.z = Math.PI / 2; horn.position.set(0.58, 0.52, 0); g.add(horn);
  return g;
}

function wandModel() {
  const g = new THREE.Group();
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.7, 8),
    new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.7 }));
  rod.position.y = 0.35; g.add(rod);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xf7d774, emissive: 0xf7d774, emissiveIntensity: 1.2 }));
  tip.position.y = 0.74; g.add(tip);
  return g;
}

const SECTIONS = [
  {
    title: 'Weapons',
    items: Object.keys(WEAPONS).map((key) => ({
      name: WEAPONS[key].name,
      desc: `${WEAPONS[key].pellets > 1 ? WEAPONS[key].pellets + '×' : ''}${WEAPONS[key].dmg} dmg · ${WEAPONS[key].mag} mag · ${WEAPONS[key].source}`,
      build: () => key === 'raygun' ? (makeRayGunMesh() || buildGunModel(key)) : buildGunModel(key),
      scale: 2.2, y: 0.6, tick: null,
    })),
  },
  {
    title: 'Vehicle',
    items: [{
      name: 'Riptide Coupe', desc: 'Deployable · runs the horde down',
      build: () => buildCarModel(), scale: 0.45, y: 0.15,
      tick: (m, dt) => { for (const w of m.userData.wheels || []) w.rotation.x += dt * 3; },
    }],
  },
  {
    title: 'Machines',
    items: [
      { name: 'Mystery Box', desc: '950 pts · maybe a teddy', build: () => buildMysteryBoxModel(qTexture(), true).group, scale: 0.9, y: 0.1 },
      { name: 'Tough Tonic', desc: '+150 max HP', build: () => perkCabinet(0x9e1b1b), scale: 1.0, y: 0.1 },
      { name: 'Rapid Rounds', desc: 'Reload ×0.55 · RPM ×1.12', build: () => perkCabinet(0xb08414), scale: 1.0, y: 0.1 },
      { name: 'Fleet Foot', desc: 'Speed ×1.17', build: () => perkCabinet(0x1c5d8a), scale: 1.0, y: 0.1 },
      { name: 'Deadeye', desc: 'Damage ×1.4', build: () => perkCabinet(0x5b2a7a), scale: 1.0, y: 0.1 },
      {
        name: 'The Reforger', desc: 'Pack-a-Punch · ★ upgrades',
        build: () => buildPapModel(), scale: 0.75, y: 0.1,
        tick: (m, dt) => { for (const r of m.userData.rollers || []) r.rotation.x += dt * 6; },
      },
      { name: 'Crafting Bench', desc: '3×3 crafting station', build: () => benchModel(), scale: 1.0, y: 0.15 },
      { name: 'Anvil', desc: 'Forge jet fuel', build: () => anvilModel(), scale: 1.4, y: 0.2 },
      { name: 'Magic Wand', desc: '2 wood + 1 coal · crafts weapons', build: () => wandModel(), scale: 1.6, y: 0.15 },
    ],
  },
  {
    title: 'The Horde',
    items: [0, 1, 2].map((i) => ({
      name: ['Walker', 'Jogger', 'Sprinter'][i],
      desc: ['1.0–1.5 m/s', '1.7–2.4 m/s', '3.1–3.9 m/s · round 4+'][i],
      build: () => {
        const b = makeZombieBody(i === 2);
        b.parts.armL.sh.rotation.x = -1.2 - i * 0.2;
        b.parts.armR.sh.rotation.x = -1.3 - i * 0.15;
        b.parts.torso.rotation.x = 0.2 + i * 0.06;
        return b.root;
      },
      scale: 0.85, y: 0.05,
      tick: (m, dt, t) => { m.rotation.z = Math.sin(t * 1.4) * 0.03; },
    })),
  },
  {
    title: 'Buildables',
    items: ['wall', 'floor', 'stairs'].map((p) => ({
      name: `Wood ${p[0].toUpperCase()}${p.slice(1)}`,
      desc: '50 pts · RMB refunds 25',
      build: () => buildPieceModel(p), scale: p === 'floor' ? 0.7 : 0.55, y: 0.1,
    })),
  },
];

const cards = [];
const sectionsEl = document.getElementById('sections');

function makeCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<div class="view"></div><div class="meta"><div class="name">${item.name}</div><div class="desc">${item.desc}</div></div>`;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(34, 1.3, 0.05, 60);

  const key = new THREE.DirectionalLight(0xfff0dd, 4.2);
  key.position.set(2.2, 3.2, 2.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x86c8ff, 2.4);
  rim.position.set(-2.4, 1.6, -2.4);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x4a5060, 2.2));

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.2, 0.18, 24),
    new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 0.8, roughness: 0.35 }));
  pedestal.position.y = -0.09;
  scene.add(pedestal);

  const spin = new THREE.Group();
  scene.add(spin);
  let model = null;
  const mount = () => {
    model = item.build();
    model.scale.setScalar(item.scale);
    // center on pedestal
    const bb = new THREE.Box3().setFromObject(model);
    const c = new THREE.Vector3(); bb.getCenter(c);
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y += item.y - bb.min.y;
    spin.add(model);
    const size = new THREE.Vector3(); bb.getSize(size);
    const r = Math.max(size.x, size.z, size.y, 1.2);
    cam.position.set(0, r * 0.85, r * 2.0);
    cam.lookAt(0, r * 0.42, 0);
  };
  mount();

  cards.push({ el: card.querySelector('.view'), scene, cam, spin, item, model, t: Math.random() * 6 });
  return card;
}

for (const sec of SECTIONS) {
  const h = document.createElement('h2');
  h.textContent = sec.title;
  sectionsEl.appendChild(h);
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const item of sec.items) grid.appendChild(makeCard(item));
  sectionsEl.appendChild(grid);
}

// once the STL lands, swap the Ray Gun placeholder
loadRayGunSTL(() => {
  const rg = cards.find((c) => c.item.name === 'Ray Gun');
  if (!rg) return;
  rg.spin.remove(rg.model);
  rg.model = makeRayGunMesh();
  rg.model.scale.setScalar(rg.item.scale);
  const bb = new THREE.Box3().setFromObject(rg.model);
  const c = new THREE.Vector3(); bb.getCenter(c);
  rg.model.position.x -= c.x; rg.model.position.z -= c.z;
  rg.model.position.y += rg.item.y - bb.min.y;
  rg.spin.add(rg.model);
});

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());

  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  const vh = window.innerHeight;
  for (const c of cards) {
    const rect = c.el.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) continue;
    c.t += dt;
    c.spin.rotation.y += dt * 0.6;
    if (c.item.tick && c.model) c.item.tick(c.model, dt, c.t);

    const w = Math.floor(rect.width), h = Math.floor(rect.height);
    const left = Math.floor(rect.left);
    const bottom = Math.floor(vh - rect.bottom);
    renderer.setViewport(left, bottom, w, h);
    renderer.setScissor(left, bottom, w, h);
    c.cam.aspect = w / h;
    c.cam.updateProjectionMatrix();
    renderer.render(c.scene, c.cam);
  }
}
loop();
