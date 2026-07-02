import * as THREE from 'three';
import { raycastColliders, groundHeightAt } from './physics.js';
import { audio } from './audio.js';

// Fortnite-style wood building (digests/build.md): 2m grid, 2.4m vertical
// module, surface snap, 90° yaw snap, green/red ghost. Placed pieces become
// real colliders, so the step-up physics climbs built stairs and zombies
// path around walls.

const GRID = 2;
const MODULE = 2.4;
const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];

function plankTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#7a5127'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 21) {
    g.fillStyle = `rgb(${90 + Math.random() * 30 | 0},${60 + Math.random() * 20 | 0},28)`;
    g.fillRect(0, y, 128, 19);
    g.fillStyle = 'rgba(30,16,5,0.6)';
    g.fillRect(0, y + 19, 128, 2);
    g.strokeStyle = 'rgba(45,25,8,0.35)';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      const yy = y + 4 + Math.random() * 12;
      g.moveTo(0, yy);
      g.lineTo(128, yy + Math.random() * 4 - 2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pieceBoxes(piece, cx, y0, cz, f) {
  const boxes = [];
  const box = (minX, maxX, minY, maxY, minZ, maxZ, walkTop = false) =>
    boxes.push({ minX, maxX, minY, maxY, minZ, maxZ, walkTop });
  switch (piece) {
    case 'wall': {
      const alongX = f === 0 || f === 2;
      if (alongX) box(cx - 1, cx + 1, y0, y0 + MODULE, cz - 0.08, cz + 0.08);
      else box(cx - 0.08, cx + 0.08, y0, y0 + MODULE, cz - 1, cz + 1);
      break;
    }
    case 'floor':
      box(cx - 1, cx + 1, y0, y0 + 0.16, cz - 1, cz + 1, true);
      break;
    case 'stairs': {
      const [dx, dz] = DIRS[f];
      for (let i = 0; i < 6; i++) {
        const off = -1 + 0.17 + i * 0.34;
        const sx = cx + dx * off, sz = cz + dz * off;
        const w2 = dx === 0 ? 1 : 0.17;
        const d2 = dz === 0 ? 1 : 0.17;
        box(sx - w2, sx + w2, y0, y0 + 0.4 * (i + 1), sz - d2, sz + d2, true);
      }
      break;
    }
    case 'bench':
      box(cx - 0.8, cx + 0.8, y0, y0 + 0.95, cz - 0.5, cz + 0.5);
      break;
    case 'anvil':
      box(cx - 0.45, cx + 0.45, y0, y0 + 0.66, cz - 0.3, cz + 0.3);
      break;
  }
  return boxes;
}

function meshFromBoxes(boxes, mat) {
  const g = new THREE.Group();
  for (const b of boxes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ), mat);
    m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function buildPieceModel(piece) {
  return meshFromBoxes(pieceBoxes(piece, 0, 0, 0, 0),
    new THREE.MeshStandardMaterial({ map: plankTex(), roughness: 0.85 }));
}

function buildBenchModel() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3e2c18, roughness: 0.9 });
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.9), wood);
  top.position.y = 0.85; top.castShadow = true;
  g.add(top);
  for (const [x, z] of [[-0.65, -0.35], [0.65, -0.35], [-0.65, 0.35], [0.65, 0.35]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), dark);
    leg.position.set(x, 0.4, z);
    g.add(leg);
  }
  const grid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.7 }));
  grid.position.set(0.2, 0.925, 0);
  g.add(grid);
  return g;
}

function buildAnvilModel() {
  const steel = new THREE.MeshStandardMaterial({ color: 0x393b40, metalness: 0.75, roughness: 0.4 });
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.5), steel);
  base.position.y = 0.1; base.castShadow = true;
  g.add(base);
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), steel);
  waist.position.y = 0.32;
  g.add(waist);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.34), steel);
  top.position.y = 0.52;
  g.add(top);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.13, 0.34, 8), steel);
  horn.rotation.z = Math.PI / 2;
  horn.position.set(0.58, 0.52, 0);
  g.add(horn);
  return g;
}

export class BuildSystem {
  constructor(scene, world, player, camera) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.camera = camera;

    this.woodMat = new THREE.MeshStandardMaterial({ map: plankTex(), roughness: 0.85 });
    this.ghostOk = new THREE.MeshBasicMaterial({ color: 0x4dff7a, transparent: true, opacity: 0.38, depthWrite: false });
    this.ghostBad = new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.38, depthWrite: false });

    this.active = null;
    this.valid = false;
    this.placed = [];
    this.stations = []; // { kind:'bench'|'anvil', pos, group }
    this.cx = 0; this.cz = 0; this.y0 = 0; this.f = 0;
    this.ghost = null;
    this.ghostKey = '';
    this.getPoints = () => 0; // main wires
  }

  setActive(piece) {
    this.active = piece || null;
    if (!this.active && this.ghost) { this.scene.remove(this.ghost); this.ghost = null; this.ghostKey = ''; }
  }

  update() {
    if (!this.active) {
      if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; this.ghostKey = ''; }
      return;
    }
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    const hitT = raycastColliders(this.world.colliders, origin, dir, 5.5);
    const t = Math.min(5.5, (hitT === Infinity ? 5.5 : hitT) + 0.05);
    const tgt = origin.clone().addScaledVector(dir, Math.max(2, t));

    this.cx = Math.round(tgt.x / GRID) * GRID;
    this.cz = Math.round(tgt.z / GRID) * GRID;
    const surf = groundHeightAt(this.world.colliders, this.cx, this.cz, tgt.y + 0.6, 0.2);
    this.y0 = (tgt.y - surf < 0.5 && tgt.y - surf > -1.2) ? surf : Math.max(0, Math.round(tgt.y / MODULE) * MODULE);
    this.f = ((Math.round(this.player.yaw.rotation.y / (Math.PI / 2)) % 4) + 4) % 4;

    const boxes = pieceBoxes(this.active, this.cx, this.y0, this.cz, this.f);
    this.valid = !this._overlapsSolids(boxes) && !this._containsPlayer(boxes) && this.getPoints() >= 50;

    const key = `${this.active}|${this.cx}|${this.cz}|${this.y0}|${this.f}|${this.valid}`;
    if (key !== this.ghostKey) {
      this.ghostKey = key;
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = meshFromBoxes(boxes, this.valid ? this.ghostOk : this.ghostBad);
      this.ghost.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      this.scene.add(this.ghost);
    }
  }

  _overlapsSolids(boxes) {
    const M = 0.05;
    for (const b of boxes) {
      for (const s of this.world.colliders) {
        if (b.minX + M < s.maxX && b.maxX - M > s.minX &&
            b.minY + M < s.maxY && b.maxY - M > s.minY &&
            b.minZ + M < s.maxZ && b.maxZ - M > s.minZ) return true;
      }
    }
    return false;
  }

  _containsPlayer(boxes) {
    const p = this.player.pos, r = 0.34;
    for (const b of boxes) {
      if (p.x + r > b.minX && p.x - r < b.maxX &&
          p.z + r > b.minZ && p.z - r < b.maxZ &&
          p.y + 1.7 > b.minY && p.y < b.maxY) return true;
    }
    return false;
  }

  // main handles points: call only when valid (place() re-checks anyway)
  place() {
    if (!this.active || !this.valid) { audio.deny(); return null; }
    const boxes = pieceBoxes(this.active, this.cx, this.y0, this.cz, this.f);
    let group;
    if (this.active === 'bench' || this.active === 'anvil') {
      group = this.active === 'bench' ? buildBenchModel() : buildAnvilModel();
      group.position.set(this.cx, this.y0, this.cz);
      group.rotation.y = this.f * Math.PI / 2;
      this.stations.push({ kind: this.active, pos: new THREE.Vector3(this.cx, this.y0, this.cz), group });
    } else {
      group = meshFromBoxes(boxes, this.woodMat);
    }
    this.scene.add(group);
    const solids = [];
    for (const b of boxes) {
      const s = { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY, minZ: b.minZ, maxZ: b.maxZ };
      this.world.colliders.push(s);
      this.world.shotSolids.push(s);
      solids.push(s);
    }
    const entry = { group, solids, piece: this.active };
    this.placed.push(entry);
    audio.boardAdd();
    this.ghostKey = '';
    return entry;
  }

  // returns { piece } of what was removed, or null
  removeTargeted() {
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    const M = 0.08;
    for (let t = 0.4; t < 6; t += 0.05) {
      const p = origin.clone().addScaledVector(dir, t);
      for (let i = 0; i < this.placed.length; i++) {
        const pl = this.placed[i];
        for (const b of pl.solids) {
          if (p.x > b.minX - M && p.x < b.maxX + M &&
              p.y > b.minY - M && p.y < b.maxY + M &&
              p.z > b.minZ - M && p.z < b.maxZ + M) {
            this.scene.remove(pl.group);
            for (const s of pl.solids) {
              const ci = this.world.colliders.indexOf(s);
              if (ci >= 0) this.world.colliders.splice(ci, 1);
              const si = this.world.shotSolids.indexOf(s);
              if (si >= 0) this.world.shotSolids.splice(si, 1);
            }
            const st = this.stations.findIndex((s) => s.group === pl.group);
            if (st >= 0) this.stations.splice(st, 1);
            this.placed.splice(i, 1);
            audio.boardRip();
            return { piece: pl.piece };
          }
        }
      }
    }
    return null;
  }

  clear() {
    for (const pl of [...this.placed]) {
      this.scene.remove(pl.group);
      for (const s of pl.solids) {
        const ci = this.world.colliders.indexOf(s);
        if (ci >= 0) this.world.colliders.splice(ci, 1);
        const si = this.world.shotSolids.indexOf(s);
        if (si >= 0) this.world.shotSolids.splice(si, 1);
      }
    }
    this.placed = [];
    this.stations = [];
    this.setActive(null);
  }
}
