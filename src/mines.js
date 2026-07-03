import * as THREE from 'three';
import { groundHoles } from './physics.js';
import { makeMaterial, makeTool, makeWeaponItem, makeArmorItem } from './items.js';

// THE MINES — a procedurally generated cave system under the north forest.
// A shaft head north of the camp descends to y=-8. The network is carved on
// a 3m grid with drunken-walk corridors linking 4 big randomly-placed
// mineshaft chambers, each holding a serious loot chest. Ore veins
// (coal/steel/flint/rock/granite/diamond) stud the walls, mineable with the
// pickaxe-axe. Tunnel ceilings are thick slabs reaching y=0, so the forest
// above stays walkable.

const DEPTH = -8;   // tunnel floor level
const TUN_H = 3.1;  // tunnel height
const C = 3;        // grid cell size (m)

export function buildMines(scene, world, harvest, drops) {
  const { solid } = world;
  const MAT = world.materials;
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 1 });
  const rockDark = new THREE.MeshStandardMaterial({ color: 0x36322c, roughness: 1 });
  const chests = [];

  const GX0 = -80, GZ0 = 42, GW = 46, GD = 42; // grid origin + dims (cells)
  const cellX = (i) => GX0 + i * C;
  const cellZ = (j) => GZ0 + j * C;
  const carved = new Set();
  const key = (i, j) => `${i},${j}`;
  const carve = (i, j) => { if (i > 0 && j > 0 && i < GW - 1 && j < GD - 1) carved.add(key(i, j)); };
  const isCarved = (i, j) => carved.has(key(i, j));

  const oreDefs = {
    coal:    { color: 0x1a1a20, mat: 'coal', n: [1, 3], hp: 3 },
    steel:   { color: 0xb08a5a, mat: 'steel', n: [1, 2], hp: 4 },
    flint:   { color: 0x23262c, mat: 'flint', n: [1, 3], hp: 3 },
    rock:    { color: 0x6f6a62, mat: 'rock', n: [2, 4], hp: 2 },
    granite: { color: 0x8a5f52, mat: 'granite', n: [1, 3], hp: 4 },
    diamond: { color: 0x63e8e2, mat: 'diamond', n: [1, 1], hp: 6 },
  };
  function pickOre() {
    const r = Math.random();
    if (r < 0.26) return 'rock';
    if (r < 0.46) return 'coal';
    if (r < 0.64) return 'steel';
    if (r < 0.78) return 'flint';
    if (r < 0.93) return 'granite';
    return 'diamond';
  }

  // ---------- carve the layout ----------
  // entrance landing cell (trench arrives here from the south)
  const ENT = { x: -16, z: 44 };
  const trenchLen = 16 * 0.62 + 2.4; // matches the stair trench below
  const landI = Math.round((ENT.x - GX0) / C);
  const landJ = Math.round((ENT.z + trenchLen + 1.2 - GZ0) / C);
  carve(landI, landJ);
  carve(landI, landJ + 1);

  // 4 mineshaft rooms at randomized spots, drunken-walk corridors to them
  const roomCenters = [];
  const quadrants = [[-1, 0.4], [-0.35, 0.85], [0.3, 0.55], [0.8, 0.95]];
  for (let r = 0; r < 4; r++) {
    const [qx, qz] = quadrants[r];
    const ri = Math.max(4, Math.min(GW - 5, Math.round(landI + qx * 18 + (Math.random() - 0.5) * 6)));
    const rj = Math.max(4, Math.min(GD - 5, Math.round(landJ + qz * 26 + (Math.random() - 0.5) * 6)));
    roomCenters.push({ i: ri, j: rj });
  }
  function drunkWalk(i0, j0, i1, j1) {
    let i = i0, j = j0, guard = 500;
    while ((i !== i1 || j !== j1) && guard-- > 0) {
      carve(i, j);
      const opts = [];
      if (i !== i1) opts.push([Math.sign(i1 - i), 0], [Math.sign(i1 - i), 0]);
      if (j !== j1) opts.push([0, Math.sign(j1 - j)], [0, Math.sign(j1 - j)]);
      if (Math.random() < 0.3) opts.push([Math.random() < 0.5 ? 1 : -1, 0], [0, Math.random() < 0.5 ? 1 : -1]);
      const [di, dj] = opts[Math.floor(Math.random() * opts.length)];
      i = Math.max(1, Math.min(GW - 2, i + di));
      j = Math.max(1, Math.min(GD - 2, j + dj));
    }
    carve(i1, j1);
  }
  let prev = { i: landI, j: landJ + 1 };
  const shaftRooms = [];
  roomCenters.forEach((rc, idx) => {
    const from = idx === 0 || Math.random() < 0.55 ? { i: landI, j: landJ + 1 } : prev;
    drunkWalk(from.i, from.j, rc.i, rc.j);
    // room: 5×5 cells (~15m across)
    for (let di = -2; di <= 2; di++) for (let dj = -2; dj <= 2; dj++) carve(rc.i + di, rc.j + dj);
    prev = rc;
    shaftRooms.push(rc);
  });
  // a couple of dead-end side veins for spice
  for (let n = 0; n < 3; n++) {
    const cells = [...carved];
    const pick = cells[Math.floor(Math.random() * cells.length)].split(',').map(Number);
    drunkWalk(pick[0], pick[1],
      Math.max(1, Math.min(GW - 2, pick[0] + Math.round((Math.random() - 0.5) * 10))),
      Math.max(1, Math.min(GD - 2, pick[1] + Math.round((Math.random() - 0.5) * 10))));
  }

  // ---------- build geometry from the carved grid ----------
  // merge carved runs per row into floor/ceiling strips
  for (let j = 0; j < GD; j++) {
    let runStart = -1;
    for (let i = 0; i <= GW; i++) {
      const on = i < GW && isCarved(i, j);
      if (on && runStart < 0) runStart = i;
      if (!on && runStart >= 0) {
        const x0 = cellX(runStart), x1 = cellX(i), z0 = cellZ(j), z1 = cellZ(j + 1);
        const fl = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0), rockDark);
        fl.position.set((x0 + x1) / 2, DEPTH - 0.15, (z0 + z1) / 2);
        fl.receiveShadow = true;
        scene.add(fl);
        solid(x0, x1, DEPTH - 0.3, DEPTH, z0, z1);
        const ceH = -(DEPTH + TUN_H);
        const ce = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, ceH, z1 - z0), rockDark);
        ce.position.set((x0 + x1) / 2, DEPTH + TUN_H + ceH / 2, (z0 + z1) / 2);
        scene.add(ce);
        solid(x0, x1, DEPTH + TUN_H, 0, z0, z1);
        groundHoles.push({ x0, x1, z0, z1 });
        runStart = -1;
      }
    }
  }
  // walls: carved cell borders an un-carved cell → rock wall on that edge
  const wallRuns = [];
  for (let j = 0; j < GD; j++) {
    for (let i = 0; i < GW; i++) {
      if (!isCarved(i, j)) continue;
      if (!isCarved(i - 1, j)) wallRuns.push(['z', cellX(i), cellZ(j), cellZ(j + 1), -1]);
      if (!isCarved(i + 1, j)) wallRuns.push(['z', cellX(i + 1), cellZ(j), cellZ(j + 1), 1]);
      if (!isCarved(i, j - 1)) wallRuns.push(['x', cellZ(j), cellX(i), cellX(i + 1), -1]);
      if (!isCarved(i, j + 1)) wallRuns.push(['x', cellZ(j + 1), cellX(i), cellX(i + 1), 1]);
    }
  }
  const oreSpots = [];
  for (const [axis, fixed, a0, a1, n] of wallRuns) {
    // leave the trench mouth open where the entrance stairs reach the landing
    if (axis === 'x' && Math.abs(fixed - cellZ(landJ)) < 0.1 && a0 <= ENT.x && a1 >= ENT.x) continue;
    const T = 0.5;
    let x0, x1, z0, z1;
    if (axis === 'z') { x0 = fixed + (n > 0 ? 0 : -T); x1 = fixed + (n > 0 ? T : 0); z0 = a0; z1 = a1; }
    else { z0 = fixed + (n > 0 ? 0 : -T); z1 = fixed + (n > 0 ? T : 0); x0 = a0; x1 = a1; }
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, TUN_H, z1 - z0), rockMat);
    m.position.set((x0 + x1) / 2, DEPTH + TUN_H / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    scene.add(m);
    solid(x0, x1, DEPTH, DEPTH + TUN_H, z0, z1);
    // remember an ore-vein anchor on the inner face
    if (axis === 'z') oreSpots.push({ x: fixed - n * 0.22, z: (a0 + a1) / 2 });
    else oreSpots.push({ x: (a0 + a1) / 2, z: fixed - n * 0.22 });
  }

  // ---------- dressing: torches + ore veins ----------
  function torch(x, z, big = false) {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), MAT.woodDark);
    stick.position.set(x, DEPTH + 1.5, z);
    stick.rotation.z = 0.3;
    scene.add(stick);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a1404, emissive: 0xff8a30, emissiveIntensity: 2.4 }));
    flame.position.set(x - 0.08, DEPTH + 1.82, z);
    scene.add(flame);
    const light = new THREE.PointLight(0xff9440, big ? 24 : 13, big ? 17 : 11, 1.5);
    light.position.set(x, DEPTH + 1.9, z);
    scene.add(light);
    world.bulbs.push({ light, base: big ? 24 : 13, seed: Math.random() * 10, flames: [flame, flame] });
  }

  function oreVein(x, y, z, type) {
    const def = oreDefs[type];
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const lump = new THREE.Mesh(new THREE.BoxGeometry(0.22 + Math.random() * 0.2, 0.22 + Math.random() * 0.2, 0.2),
        new THREE.MeshStandardMaterial({
          color: def.color, roughness: 0.5, metalness: type === 'steel' ? 0.6 : 0.15,
          emissive: type === 'diamond' ? 0x2aa8a2 : 0x000000, emissiveIntensity: type === 'diamond' ? 0.8 : 0,
        }));
      lump.position.set((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.2);
      lump.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(lump);
    }
    g.position.set(x, y, z);
    scene.add(g);
    harvest.register({
      pos: new THREE.Vector3(x, y, z), radius: 0.8, hp: def.hp,
      kind: 'ore', ore: type, color: def.color, group: g, respawn: 150,
      onBreak: () => {
        const count = def.n[0] + Math.floor(Math.random() * (def.n[1] - def.n[0] + 1));
        drops.spawnItem(new THREE.Vector3(x, DEPTH + 0.1, z), makeMaterial(def.mat, count),
          type === 'diamond' ? 0x63e8e2 : 0xd8a45a);
      },
    });
  }

  // scatter torches + veins along walls (tight light budget — every real
  // PointLight makes every shader in the scene more expensive)
  let torchCount = 0;
  for (let s = 0; s < oreSpots.length; s++) {
    const spot = oreSpots[s];
    if (s % 14 === 2 && torchCount < 7) { torch(spot.x, spot.z); torchCount++; }
    if (Math.random() < 0.3) oreVein(spot.x, DEPTH + 0.9 + Math.random() * 1.4, spot.z, pickOre());
  }

  // ---------- loot chests in the 4 shafts ----------
  function lootChest(i, j, idx) {
    const x = cellX(i) + C / 2, z = cellZ(j) + C / 2;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.8 }));
    box.position.y = 0.3;
    box.castShadow = true;
    g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.22, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 }));
    lid.position.y = 0.68;
    g.add(lid);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.64, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xc8a742, metalness: 0.8, roughness: 0.35 }));
    band.position.y = 0.32;
    g.add(band);
    const glow = new THREE.PointLight(0xf7d774, 6, 6, 1.8);
    glow.position.y = 1;
    g.add(glow);
    g.position.set(x, DEPTH, z);
    scene.add(g);
    solid(x - 0.55, x + 0.55, DEPTH, DEPTH + 0.75, z - 0.38, z + 0.38);
    const chest = { pos: new THREE.Vector3(x, DEPTH + 0.6, z), idx, opened: false, group: g, lid, glow };
    chests.push(chest);
    return chest;
  }

  shaftRooms.forEach((rc, idx) => {
    const chest = lootChest(rc.i, rc.j, idx);
    // timber supports + minecart rails + big torches + rich veins
    for (const [di, dj] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      const bx = cellX(rc.i) + C / 2 + di * C, bz = cellZ(rc.j) + C / 2 + dj * C;
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.3, TUN_H, 0.3), MAT.woodDark);
      beam.position.set(bx, DEPTH + TUN_H / 2, bz);
      beam.castShadow = true;
      scene.add(beam);
      solid(bx - 0.15, bx + 0.15, DEPTH, DEPTH + TUN_H, bz - 0.15, bz + 0.15);
    }
    for (const dz of [0.9, 1.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.09), MAT.metal);
      rail.position.set(cellX(rc.i) + C / 2, DEPTH + 0.05, cellZ(rc.j) + C / 2 + dz);
      scene.add(rail);
    }
    torch(cellX(rc.i) - C + 0.6, cellZ(rc.j) + C / 2, true);
    for (let k = 0; k < 4; k++) {
      oreVein(cellX(rc.i) + C / 2 + (Math.random() - 0.5) * 8, DEPTH + 0.8 + Math.random() * 1.5,
        cellZ(rc.j) + C / 2 + (Math.random() - 0.5) * 8, Math.random() < 0.35 ? 'diamond' : pickOre());
    }
  });
  // the last (deepest) shaft hides the helicopter rotor blades
  chests[chests.length - 1].rotor = true;

  function rollChestLoot(chest) {
    const at = chest.pos.clone().add(new THREE.Vector3(0, 0.3, 0));
    const items = [];
    items.push(makeMaterial('diamond', 1 + Math.floor(Math.random() * 3)));
    items.push(makeMaterial('steel', 3 + Math.floor(Math.random() * 4)));
    const roll = Math.random();
    if (chest.rotor) items.push(makeTool('rotorBlades'));
    else if (roll < 0.3) items.push(makeWeaponItem(['revolver', 'rpg', 'ppsh', 'mg42'][Math.random() * 4 | 0]));
    else if (roll < 0.5) items.push(makeArmorItem(['helmet', 'chest', 'legs', 'boots'][Math.random() * 4 | 0], 3));
    else if (roll < 0.7) items.push(makeTool('jetfuel'));
    else items.push(makeMaterial('granite', 4 + Math.floor(Math.random() * 4)));
    return { at, items, points: 400 + Math.floor(Math.random() * 5) * 100 };
  }

  // ---------- entrance: shack + descending stair trench ----------
  {
    for (const [px, pz] of [[-2.4, -2.2], [2.4, -2.2], [-2.4, 2.2], [2.4, 2.2]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.2, 0.24), MAT.woodDark);
      post.position.set(ENT.x + px, 1.6, ENT.z + pz);
      post.castShadow = true;
      scene.add(post);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 5.2), MAT.wood);
    roof.position.set(ENT.x, 3.25, ENT.z);
    roof.castShadow = true;
    scene.add(roof);
    const signTex = world.makeTex(256, 64, (g, w, h) => {
      g.fillStyle = '#2a1c0e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8dcc0'; g.font = 'bold 34px Georgia'; g.textAlign = 'center';
      g.fillText('⛏ THE MINES ⛏', w / 2, 42);
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.55), new THREE.MeshBasicMaterial({ map: signTex }));
    label.position.set(ENT.x, 2.6, ENT.z - 2.35);
    label.rotation.y = Math.PI;
    scene.add(label);
  }
  // stair trench heading north (+z) from the shack down to the landing
  {
    const w2 = 1.3;
    const steps = 16;
    const stepDrop = -DEPTH / steps;
    const stepLen = 0.62;
    const zEnd = ENT.z + steps * stepLen;
    groundHoles.push({ x0: ENT.x - w2, x1: ENT.x + w2, z0: ENT.z - 0.4, z1: cellZ(landJ + 2) });
    for (let i = 0; i < steps; i++) {
      const top = -stepDrop * (i + 1);
      const z0 = ENT.z + i * stepLen;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w2 * 2, 1.2, stepLen), rockDark);
      m.position.set(ENT.x, top - 0.6, z0 + stepLen / 2);
      m.receiveShadow = true;
      scene.add(m);
      solid(ENT.x - w2, ENT.x + w2, top - 8.2, top, z0, z0 + stepLen);
    }
    // trench side walls
    for (const s of [-1, 1]) {
      const wallM = new THREE.Mesh(new THREE.BoxGeometry(0.5, -DEPTH + 1.2, zEnd - ENT.z + 0.8), rockMat);
      wallM.position.set(ENT.x + s * (w2 + 0.25), (DEPTH + 1.2) / 2, (ENT.z + zEnd) / 2);
      scene.add(wallM);
      solid(ENT.x + s * w2, ENT.x + s * (w2 + 0.5), DEPTH, 1.2, ENT.z - 0.4, zEnd + 0.4);
    }
    // south lip so you can't fall in backwards
    solid(ENT.x - w2, ENT.x + w2, DEPTH, 0, ENT.z - 0.9, ENT.z - 0.4);
    // connective floor from trench bottom to the landing cell
    const landZ0 = cellZ(landJ);
    if (landZ0 > zEnd) {
      const fl = new THREE.Mesh(new THREE.BoxGeometry(w2 * 2, 0.3, landZ0 - zEnd + 0.4), rockDark);
      fl.position.set(ENT.x, DEPTH - 0.15, (zEnd + landZ0) / 2);
      scene.add(fl);
      solid(ENT.x - w2, ENT.x + w2, DEPTH - 0.3, DEPTH, zEnd - 0.2, landZ0 + 0.2);
      for (const s of [-1, 1]) {
        solid(ENT.x + s * w2, ENT.x + s * (w2 + 0.5), DEPTH, 0, zEnd - 0.2, landZ0 + 0.2);
        const wm = new THREE.Mesh(new THREE.BoxGeometry(0.5, -DEPTH, landZ0 - zEnd + 0.4), rockMat);
        wm.position.set(ENT.x + s * (w2 + 0.25), DEPTH / 2, (zEnd + landZ0) / 2);
        scene.add(wm);
      }
    }
    torch(ENT.x + 0.9, zEnd + 0.6);
  }

  return {
    chests, rollChestLoot,
    entrance: new THREE.Vector3(ENT.x, 0, ENT.z),
    shaftRooms: shaftRooms.map((rc) => ({ x: cellX(rc.i) + C / 2, z: cellZ(rc.j) + C / 2 })),
    depth: DEPTH,
  };
}
