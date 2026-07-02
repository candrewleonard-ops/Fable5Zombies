import * as THREE from 'three';
import { WEAPONS, ECON } from './items.js';

// UNDEAD BUNKER — the map, rebuilt from the design handoff (design/digests/map.md).
// Rooms: MAIN hall (double height + mezzanine UPPER), ARMORY, STORAGE, CAMP.
// Exports colliders (movement) and shotSolids (bullet/LOS occlusion — window
// blockers are movement-only so you can shoot zombies through barricades).

const TH = 0.35; // wall thickness

function makeTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noiseOn(g, w, h, n, alpha, dark) {
  for (let i = 0; i < n; i++) {
    const v = dark ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * Math.random()})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}

export function createWorld(scene) {
  const colliders = [];   // movement + jetpack ceilings
  const shotSolids = [];  // bullet + LOS occlusion (no window blockers)
  const bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
  const bulbs = [];
  const windows = [];
  const doors = [];
  const perks = [];
  const wallBuys = [];
  const scavenge = [];
  const flyingBoards = [];

  const solid = (minX, maxX, minY, maxY, minZ, maxZ, { shots = true } = {}) => {
    const c = { minX, maxX, minY, maxY, minZ, maxZ };
    colliders.push(c);
    if (shots) shotSolids.push(c);
    return c;
  };

  // ---------- textures ----------
  const concreteTex = makeTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5d5a54'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 900, 0.08, true);
    noiseOn(g, w, h, 500, 0.05, false);
    g.strokeStyle = 'rgba(30,28,25,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      let x = Math.random() * w, y = Math.random() * h;
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (Math.random() - 0.5) * 60; y += Math.random() * 40; g.lineTo(x, y); }
      g.stroke();
    }
  }, 2, 1.5);

  const floorTex = makeTex(256, 256, (g, w, h) => {
    g.fillStyle = '#46433e'; g.fillRect(0, 0, w, h);
    noiseOn(g, w, h, 1200, 0.1, true);
    noiseOn(g, w, h, 300, 0.04, false);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(20,16,12,0.18)';
      g.save();
      g.translate(Math.random() * w, Math.random() * h);
      g.rotate(Math.random() * Math.PI);
      g.beginPath(); g.ellipse(0, 0, 10 + Math.random() * 40, 8 + Math.random() * 30, 0, 0, 7); g.fill();
      g.restore();
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(0, 0, w, h);
  }, 6, 6);

  const woodTex = makeTex(256, 128, (g, w, h) => {
    g.fillStyle = '#6b4a2a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      g.strokeStyle = `rgba(40,22,8,${0.1 + Math.random() * 0.2})`;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + (Math.random() - 0.5) * 6, w * 0.7, y + (Math.random() - 0.5) * 6, w, y);
      g.stroke();
    }
    noiseOn(g, w, h, 300, 0.08, true);
  });

  const skyTex = makeTex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a1220'); grad.addColorStop(0.55, '#060a12'); grad.addColorStop(1, '#03040a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`;
      g.fillRect(Math.random() * w, Math.random() * h * 0.6, 1.5, 1.5);
    }
    const mx = 0.72 * w, my = 0.26 * h;
    const glow = g.createRadialGradient(mx, my, 8, mx, my, 90);
    glow.addColorStop(0, 'rgba(210,225,255,0.9)');
    glow.addColorStop(0.2, 'rgba(180,200,240,0.35)');
    glow.addColorStop(1, 'rgba(180,200,240,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(mx, my, 90, 0, 7); g.fill();
    g.fillStyle = '#dfe8f5'; g.beginPath(); g.arc(mx, my, 22, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,175,200,0.5)'; g.beginPath(); g.arc(mx - 7, my + 4, 6, 0, 7); g.fill();
  });

  const qTex = makeTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#eaf4ff'; g.font = 'bold 96px Georgia';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', 0.3 * w, 0.55 * h);
    g.fillText('?', 0.7 * w, 0.55 * h);
  });

  const perkLabelTex = (name, color) => makeTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0d0d10'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.fillRect(8, 8, w - 16, h - 16);
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(14, 60, w - 28, 130);
    g.fillStyle = '#f5eeda'; g.textAlign = 'center';
    g.font = '44px Georgia'; g.fillText('♦', w / 2, 46);
    g.font = 'bold 26px Georgia';
    name.split(' ').forEach((word, i) => g.fillText(word, w / 2, 105 + i * 34));
  });

  const chalkTex = (key) => makeTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(235,230,215,0.85)'; g.lineWidth = 3; g.setLineDash([9, 6]);
    g.strokeRect(6, 6, w - 12, h - 12);
    g.setLineDash([]); g.strokeStyle = 'rgba(235,230,215,0.9)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(40, 58); g.lineTo(150, 58); g.lineTo(210, 52); g.stroke();
    g.beginPath(); g.moveTo(70, 58); g.lineTo(70, 74); g.lineTo(92, 74); g.stroke();
    g.beginPath(); g.moveTo(120, 58); g.lineTo(116, 80); g.stroke();
    g.fillStyle = 'rgba(235,230,215,0.92)'; g.font = '20px Georgia'; g.textAlign = 'center';
    g.fillText(WEAPONS[key].name.toUpperCase(), w / 2, 32);
    g.fillText(`COST ${WEAPONS[key].cost}`, w / 2, 108);
  });

  // ---------- materials ----------
  const MAT = {
    wall: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }),
    ceil: new THREE.MeshStandardMaterial({ color: 0x4a463f, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 }),
    woodDark: new THREE.MeshStandardMaterial({ color: 0x3e2c18, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2e2f33, metalness: 0.7, roughness: 0.5 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x4c4132, roughness: 1 }),
  };

  const boxMesh = (w, h, d, mat, x, y, z, { ry = 0, cast = true, solid: makeSolid = true, shots = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = cast;
    m.receiveShadow = true;
    scene.add(m);
    if (makeSolid && ry === 0) solid(x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2, { shots });
    return m;
  };

  // ---------- atmosphere ----------
  scene.background = new THREE.Color(0x080b14);
  scene.fog = new THREE.Fog(0x111827, 26, 100);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(140, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0x52709e, 0x2a2218, 2.6));
  const moonLight = new THREE.DirectionalLight(0xaec2ea, 3.4);
  moonLight.position.set(40, 50, -60);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -42; moonLight.shadow.camera.right = 42;
  moonLight.shadow.camera.top = 42; moonLight.shadow.camera.bottom = -42;
  moonLight.shadow.camera.near = 5; moonLight.shadow.camera.far = 200;
  moonLight.shadow.bias = -0.0004;
  scene.add(moonLight);

  // ---------- ground / floors / ceilings ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), MAT.dirt);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const floorSlab = (x0, x1, z0, z1, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.25, z1 - z0), MAT.floor);
    m.position.set((x0 + x1) / 2, y - 0.125, (z0 + z1) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    solid(x0, x1, y - 0.25, y, z0, z1); // standable top at y
  };
  floorSlab(-14, 14, -10, 10, 0.02);
  floorSlab(-26, -14, -2, 10, 0.02);
  floorSlab(5.2, 14, 10, 18, 0.02);
  floorSlab(-14, 6.8, 0, 8.2, 3.2);        // mezzanine
  floorSlab(-9.7, 6.8, 8.2, 10, 3.2);      // mezz beside stair opening

  const ceil = (x0, x1, z0, z1, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.25, z1 - z0), MAT.ceil);
    m.position.set((x0 + x1) / 2, y + 0.125, (z0 + z1) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    solid(x0, x1, y, y + 0.25, z0, z1); // jetpack head-bump
  };
  ceil(-14, 14, -10, 10, 6.4);
  ceil(-26, -14, -2, 10, 3.2);
  ceil(5.2, 14, 10, 18, 3.2);

  // ---------- walls (with openings) ----------
  function wall(axis, fixed, a0, a1, y0, h, openings = []) {
    const ops = [...openings].sort((p, q) => p.c - q.c);
    const segs = []; // [start, end, yb, yt]
    let cursor = a0;
    for (const o of ops) {
      if (o.c - o.w / 2 > cursor + 0.01) segs.push([cursor, o.c - o.w / 2, y0, y0 + h]);
      if (o.b > y0 + 0.01) segs.push([o.c - o.w / 2, o.c + o.w / 2, y0, o.b]);
      if (o.t < y0 + h - 0.01) segs.push([o.c - o.w / 2, o.c + o.w / 2, o.t, y0 + h]);
      cursor = o.c + o.w / 2;
    }
    if (a1 > cursor + 0.01) segs.push([cursor, a1, y0, y0 + h]);
    for (const [s0, s1, yb, yt] of segs) {
      const len = s1 - s0, mid = (s0 + s1) / 2, ym = (yb + yt) / 2, hh = yt - yb;
      if (len < 0.01 || hh < 0.01) continue;
      if (axis === 'x') boxMesh(len, hh, TH, MAT.wall, mid, ym, fixed);
      else boxMesh(TH, hh, len, MAT.wall, fixed, ym, mid);
    }
  }

  wall('x', -10, -14, 14, 0, 6.4, [{ c: -8, w: 1.7, b: 0.9, t: 2.2 }, { c: 0, w: 1.7, b: 0.9, t: 2.2 }]);
  wall('z', 14, -10, 10, 0, 6.4, [{ c: -4, w: 1.7, b: 0.9, t: 2.2 }]);
  wall('z', -14, -10, -2, 0, 6.4, [{ c: -6, w: 1.7, b: 0.9, t: 2.2 }]);
  wall('z', -14, -2, 10, 0, 3.2, [{ c: 4, w: 1.5, b: 0, t: 2.5 }]);
  wall('z', -14, -2, 10, 3.2, 3.2, []);
  wall('x', 10, -14, 5.2, 0, 3.2, []);
  wall('x', 10, 5.2, 14, 0, 3.2, [{ c: 9.5, w: 1.5, b: 0, t: 2.5 }]);
  wall('x', 10, -14, 6.8, 3.2, 3.2, [{ c: -8, w: 1.7, b: 4.1, t: 5.4 }, { c: -1, w: 1.7, b: 4.1, t: 5.4 }, { c: 4, w: 1.7, b: 4.1, t: 5.4 }]);
  wall('x', 10, 6.8, 14, 3.2, 3.2, []);
  wall('z', 6.8, 0, 10, 3.2, 3.2, []);
  wall('z', -26, -2, 10, 0, 3.2, [{ c: 4, w: 1.7, b: 0.9, t: 2.2 }]);
  wall('x', -2, -26, -14, 0, 3.2, [{ c: -20, w: 1.7, b: 0.9, t: 2.2 }]);
  wall('x', 10, -26, -14, 0, 3.2, [{ c: -20, w: 1.5, b: 0, t: 2.5 }]);
  wall('z', 14, 10, 18, 0, 3.2, [{ c: 14, w: 1.7, b: 0.9, t: 2.2 }]);
  wall('x', 18, 5.2, 14, 0, 3.2, [{ c: 9, w: 1.7, b: 0.9, t: 2.2 }]);
  wall('z', 5.2, 10, 18, 0, 3.2, []);

  // ---------- stairs MAIN → mezzanine ----------
  for (let i = 0; i < 10; i++) {
    const sx = -9.9 - i * 0.33;
    const h = 0.32 * (i + 1);
    boxMesh(0.34, h, 1.5, MAT.wall, sx, h / 2, 9.05);
  }
  boxMesh(3.9, 3.2, 0.14, MAT.wood, -11.6, 1.6, 8.22); // stringer

  // columns / beams / rails
  boxMesh(0.7, 6.4, 0.7, MAT.wall, 5, 3.2, -3);
  boxMesh(0.7, 6.4, 0.7, MAT.wall, -5, 3.2, -3);
  boxMesh(0.5, 3.2, 0.5, MAT.wall, -8, 1.6, 0);
  boxMesh(0.5, 3.2, 0.5, MAT.wall, 2, 1.6, 0);
  boxMesh(21, 0.3, 0.35, MAT.woodDark, -3.5, 3.05, 0.05, { solid: false });
  boxMesh(20.9, 0.09, 0.09, MAT.woodDark, -3.55, 3.98, 0.04, { solid: false, cast: false });
  for (let x = -13.5; x <= 6.6; x += 2.5) boxMesh(0.07, 0.78, 0.07, MAT.woodDark, x, 3.6, 0.04, { solid: false, cast: false });
  boxMesh(0.09, 0.09, 1.85, MAT.woodDark, -9.7, 3.98, 9.1, { solid: false, cast: false });
  boxMesh(4.3, 0.09, 0.09, MAT.woodDark, -11.85, 3.98, 8.22, { solid: false, cast: false });

  // ---------- interior props ----------
  boxMesh(1.1, 1.0, 1.1, MAT.wood, 12, 0.5, -8);
  boxMesh(0.9, 0.9, 0.9, MAT.wood, 11, 0.45, -8.7);
  boxMesh(0.9, 0.75, 0.9, MAT.wood, 11.5, 1.28, -8.3, { solid: false });
  boxMesh(2.2, 0.55, 0.9, MAT.dirt, 0.5, 0.275, -2.2);
  boxMesh(1.6, 0.5, 0.8, MAT.dirt, 0.5, 0.8, -2.25);
  boxMesh(2.0, 0.55, 0.9, MAT.dirt, 3.1, 0.275, -2.2);
  for (const [bx, bz] of [[13, 8], [-12.5, -9.2], [-25.2, -1.1], [13.2, 11]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 14), MAT.metal);
    b.position.set(bx, 0.525, bz); b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
    solid(bx - 0.42, bx + 0.42, 0, 1.05, bz - 0.42, bz + 0.42);
  }
  boxMesh(1.0, 0.95, 1.0, MAT.wood, -24.5, 0.475, 8.6);
  boxMesh(0.9, 0.85, 0.9, MAT.wood, -15.6, 0.43, -1.2);
  boxMesh(1.0, 0.95, 1.0, MAT.wood, 6.2, 0.475, 17.1);
  boxMesh(1.0, 0.95, 1.0, MAT.wood, 6.2, 0.475, 16.0);
  boxMesh(0.9, 0.8, 0.9, MAT.wood, 6.25, 1.35, 16.6, { solid: false });
  boxMesh(1.0, 0.95, 1.0, MAT.wood, 5.8, 3.675, 1.4);
  boxMesh(2.0, 0.5, 0.9, MAT.dirt, 0, 3.45, 8.8);
  boxMesh(0.9, 0.85, 0.9, MAT.wood, -12.2, 3.63, 6.4);
  for (let x = -12; x <= 12; x += 4) boxMesh(0.3, 0.3, 19.6, MAT.woodDark, x, 6.15, 0, { solid: false, cast: false });

  // ---------- hanging bulbs ----------
  function bulb(x, y, z, shadow = false, wireLen = 0.5) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, wireLen, 5), MAT.metal);
    wire.position.set(x, y + wireLen / 2, z);
    scene.add(wire);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 2.2 }));
    b.position.set(x, y, z);
    scene.add(b);
    const light = new THREE.PointLight(0xffc274, 26, 17, 1.5);
    light.position.set(x, y - 0.05, z);
    if (shadow) { light.castShadow = true; light.shadow.mapSize.set(512, 512); }
    scene.add(light);
    bulbs.push({ light, mesh: b, base: 26, seed: Math.random() * 10 });
  }
  bulb(0, 4.6, -5, true, 1.75);
  bulb(-8, 4.6, -3, false, 1.75);
  bulb(9.5, 4.4, 4.5, false, 1.95);
  bulb(-5, 2.72, 5.5);
  bulb(2, 2.72, 2.5);
  bulb(-20, 2.72, 4);
  bulb(9.5, 2.72, 14);
  bulb(-4, 5.75, 6, true, 0.6);
  bulb(8, 4.6, -7, false, 1.75);   // MAIN east corner
  bulb(-11.5, 2.72, 5, false, 0.5); // under-mezz west
  bulb(-23, 2.72, 8.5, false, 0.5); // armory south
  bulb(7, 2.72, 11.5, false, 0.5);  // storage doorway

  // ---------- doors ----------
  function mkDoor(x, z, ry, cost, name, unlockRoom) {
    const group = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.45, 0.09), MAT.wood);
      plank.position.set(-0.62 + i * 0.25, 1.22, (i % 2) * 0.05);
      plank.rotation.z = (i % 2 ? 1 : -1) * 0.03;
      plank.castShadow = true;
      group.add(plank);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.2, 0.06), MAT.woodDark);
    beam.position.set(0, 1.5, 0.1); beam.rotation.z = 0.25;
    group.add(beam);
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    scene.add(group);
    const s = ry === 0
      ? solid(x - 0.8, x + 0.8, 0, 2.5, z - 0.18, z + 0.18)
      : solid(x - 0.18, x + 0.18, 0, 2.5, z - 0.8, z + 0.8);
    doors.push({ group, solid: s, cost, name, unlockRoom, open: false, pos: new THREE.Vector3(x, 1.2, z), anim: 0 });
  }
  mkDoor(-14, 4, Math.PI / 2, ECON.doorCosts[0], 'Armory', 'ARMORY');
  mkDoor(9.5, 10, 0, ECON.doorCosts[1], 'Storage Room', 'STORAGE');
  mkDoor(-9.45, 9.05, Math.PI / 2, ECON.doorCosts[2], 'Upper Quarters', 'UPPER');
  mkDoor(-20, 10, 0, ECON.doorCosts[3], 'Campsite', 'CAMP');

  // ---------- windows / barricades ----------
  function openingBlocker(axis, fixed, c, b, t) {
    // movement-only: bullets pass through barricades
    if (axis === 'x') solid(c - 0.85, c + 0.85, b, t, fixed - 0.15, fixed + 0.15, { shots: false });
    else solid(fixed - 0.15, fixed + 0.15, b, t, c - 0.85, c + 0.85, { shots: false });
  }

  function addWindow(axis, fixed, c, sill, room, n) {
    const w = 1.7, b = sill, t = sill + 1.3;
    openingBlocker(axis, fixed, c, b, t);
    const floorY = (b - 0.9 < 1) ? 0 : 3.2;
    const group = new THREE.Group();
    let outer, inner, spawn;
    if (axis === 'x') {
      group.position.set(c, 0, fixed);
      outer = new THREE.Vector3(c, 0, fixed + n * 0.7);
      inner = new THREE.Vector3(c, floorY, fixed - n * 1.2);
      spawn = new THREE.Vector3(c + (Math.random() - 0.5) * 2, 0, fixed + n * (6 + Math.random() * 3));
    } else {
      group.position.set(fixed, 0, c);
      group.rotation.y = Math.PI / 2;
      outer = new THREE.Vector3(fixed + n * 0.7, 0, c);
      inner = new THREE.Vector3(fixed - n * 1.2, floorY, c);
      spawn = new THREE.Vector3(fixed + n * (6 + Math.random() * 3), 0, c + (Math.random() - 0.5) * 2);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 1.45, 0.1), MAT.woodDark);
    frame.position.y = (b + t) / 2;
    group.add(frame);
    const hole = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 1.28, 0.06), new THREE.MeshBasicMaterial({ color: 0x05070c }));
    hole.position.y = (b + t) / 2;
    group.add(hole);
    const boards = [];
    for (let i = 0; i < 6; i++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.19, 0.05), MAT.wood);
      const home = new THREE.Vector3((Math.random() - 0.5) * 0.12, b + 0.18 + i * 0.2, i % 2 ? 0.09 : 0.13);
      board.position.copy(home);
      board.rotation.z = (Math.random() - 0.5) * 0.22;
      board.castShadow = true;
      group.add(board);
      boards.push({ mesh: board, on: true, home, rotZ: board.rotation.z });
    }
    scene.add(group);
    windows.push({ group, boards, outer, inner, spawn, floorY, room, sill: b });
  }

  addWindow('x', -10, -8, 0.9, 'MAIN', -1);
  addWindow('x', -10, 0, 0.9, 'MAIN', -1);
  addWindow('z', 14, -4, 0.9, 'MAIN', 1);
  addWindow('z', -14, -6, 0.9, 'MAIN', -1);
  addWindow('z', -26, 4, 0.9, 'ARMORY', -1);
  addWindow('x', -2, -20, 0.9, 'ARMORY', -1);
  addWindow('z', 14, 14, 0.9, 'STORAGE', 1);
  addWindow('x', 18, 9, 0.9, 'STORAGE', 1);
  addWindow('x', 10, -8, 4.1, 'UPPER', 1);
  addWindow('x', 10, -1, 4.1, 'UPPER', 1);
  addWindow('x', 10, 4, 4.1, 'UPPER', 1);

  function addBarricadeFrame(x, z, nx, nz, room, boardless = false) {
    const ry = Math.abs(nx) > 0.5 ? Math.PI / 2 : 0;
    const w = 1.7, b = 0.15, t = 2.2;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.5, 0.22), MAT.woodDark);
      post.position.set(side * (w / 2 + 0.15), 1.25, 0);
      post.castShadow = true;
      group.add(post);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.22, 0.26), MAT.woodDark);
    top.position.y = 2.42;
    group.add(top);
    scene.add(group);
    const boards = [];
    if (!boardless) {
      openingBlocker(ry === 0 ? 'x' : 'z', ry === 0 ? z : x, ry === 0 ? x : z, b, t);
      for (let i = 0; i < 6; i++) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.19, 0.05), MAT.wood);
        const home = new THREE.Vector3((Math.random() - 0.5) * 0.12, 0.35 + i * 0.32, i % 2 ? 0.09 : 0.13);
        board.position.copy(home);
        board.rotation.z = (Math.random() - 0.5) * 0.22;
        group.add(board);
        boards.push({ mesh: board, on: true, home, rotZ: board.rotation.z });
      }
    }
    const outer = new THREE.Vector3(x + nx * 0.8, 0, z + nz * 0.8);
    const inner = new THREE.Vector3(x - nx * 1.3, 0, z - nz * 1.3);
    const spawn = new THREE.Vector3(x + nx * (6 + Math.random() * 3) + nz * (Math.random() - 0.5) * 2, 0, z + nz * (6 + Math.random() * 3) + nx * (Math.random() - 0.5) * 2);
    windows.push({ group, boards, outer, inner, spawn, floorY: 0, room, sill: 0, gate: boardless });
  }
  addBarricadeFrame(-34, 22, -1, 0, 'CAMP');
  addBarricadeFrame(-17, 34, 0, 1, 'CAMP');
  addBarricadeFrame(0, 26, 1, 0, 'CAMP');
  addBarricadeFrame(0, 18.2, 1, 0, 'CAMP', true); // open gate — trap-defended

  function ripBoard(win, board) {
    board.on = false;
    const worldPos = board.mesh.getWorldPosition(new THREE.Vector3());
    win.group.remove(board.mesh);
    board.mesh.position.copy(worldPos);
    scene.add(board.mesh);
    const away = worldPos.clone().sub(win.inner).setY(0).normalize().multiplyScalar(-2.5);
    flyingBoards.push({
      mesh: board.mesh, win, board,
      vel: new THREE.Vector3((Math.random() - 0.5) * 2 + away.x, 2 + Math.random() * 2, (Math.random() - 0.5) * 2 + away.z),
      rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      t: 0,
    });
  }

  function addBoard(win) {
    const board = win.boards.find((b) => !b.on);
    if (!board) return false;
    board.on = true;
    const idx = flyingBoards.findIndex((f) => f.board === board);
    if (idx >= 0) flyingBoards.splice(idx, 1);
    scene.remove(board.mesh);
    win.group.add(board.mesh);
    board.mesh.position.copy(board.home);
    board.mesh.rotation.set(0, 0, board.rotZ);
    board.mesh.scale.setScalar(1);
    return true;
  }

  // ---------- rooms & pathing ----------
  const rooms = {
    MAIN:    { rects: [{ x0: -14, x1: 14, z0: -10, z1: 10 }], lo: true, unlocked: true },
    ARMORY:  { rects: [{ x0: -26, x1: -14, z0: -2, z1: 10 }], lo: true, unlocked: false },
    STORAGE: { rects: [{ x0: 5.2, x1: 14, z0: 10, z1: 18 }], lo: true, unlocked: false },
    CAMP:    { rects: [{ x0: -34, x1: 0, z0: 10, z1: 34 }], lo: true, unlocked: false },
    UPPER:   { rects: [{ x0: -14, x1: 6.8, z0: 0, z1: 10 }], hi: true, unlocked: false },
  };
  const PORTALS = [
    { a: 'MAIN', b: 'ARMORY', pts: [new THREE.Vector3(-14, 0, 4)] },
    { a: 'MAIN', b: 'STORAGE', pts: [new THREE.Vector3(9.5, 0, 10)] },
    { a: 'MAIN', b: 'UPPER', pts: [new THREE.Vector3(-9.5, 0, 9.05), new THREE.Vector3(-12.9, 3.2, 9.05), new THREE.Vector3(-12.3, 3.2, 7.3)] },
    { a: 'ARMORY', b: 'CAMP', pts: [new THREE.Vector3(-20, 0, 10)] },
  ];
  const STAIR_ZONE = { x0: -13.6, x1: -9.3, z0: 8.2, z1: 10 };

  function roomAt(pos) {
    if (pos.x > STAIR_ZONE.x0 && pos.x < STAIR_ZONE.x1 && pos.z > STAIR_ZONE.z0 && pos.z < STAIR_ZONE.z1) {
      return pos.y > 1.6 ? 'UPPER' : 'MAIN';
    }
    const hi = pos.y > 1.8;
    for (const [key, r] of Object.entries(rooms)) {
      if (r.hi && !hi) continue;
      if (r.lo && hi) continue;
      for (const rect of r.rects) {
        if (pos.x >= rect.x0 && pos.x <= rect.x1 && pos.z >= rect.z0 && pos.z <= rect.z1) return key;
      }
    }
    return 'MAIN';
  }

  // BFS over unlocked rooms; returns the FIRST portal's waypoints toward `to`.
  function pathChain(from, to) {
    if (from === to) return null;
    const prev = { [from]: null };
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      for (const p of PORTALS) {
        for (const [nb, fwd] of [[p.b, true], [p.a, false]]) {
          const src = fwd ? p.a : p.b;
          if (src !== cur || prev[nb] !== undefined || !rooms[nb].unlocked) continue;
          prev[nb] = { room: cur, portal: p, fwd };
          if (nb === to) {
            // walk back to the first hop
            let node = nb;
            let hop = prev[node];
            while (hop.room !== from) { node = hop.room; hop = prev[node]; }
            const pts = hop.portal.pts.map((v) => v.clone());
            return hop.fwd ? pts : pts.reverse();
          }
          queue.push(nb);
        }
      }
    }
    return null;
  }

  // ---------- perks ----------
  function mkPerk(x, z, ry, key, name, cssColor, cost, y = 0) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.75, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0.5, roughness: 0.5 }));
    body.position.y = 0.875;
    body.castShadow = true;
    group.add(body);
    const tex = perkLabelTex(name, cssColor);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.6),
      new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 }));
    label.position.set(0, 0.9, 0.283);
    group.add(label);
    const light = new THREE.PointLight(new THREE.Color(cssColor), 8, 6, 1.8);
    light.position.set(0, 1.4, 0.6);
    group.add(light);
    group.position.set(x, y, z);
    group.rotation.y = ry;
    scene.add(group);
    solid(x - 0.45, x + 0.45, y, y + 1.75, z - 0.32, z + 0.32);
    perks.push({ group, key, name, cost, pos: new THREE.Vector3(x, y + 1, z), light });
  }
  mkPerk(13.45, -9.2, -Math.PI / 2, 'tonic', 'TOUGH TONIC', '#9e1b1b', ECON.perks.tonic.cost);
  mkPerk(-25.35, 9.2, Math.PI / 2, 'rapid', 'RAPID ROUNDS', '#b08414', ECON.perks.rapid.cost);
  mkPerk(-13.35, 2, Math.PI / 2, 'fleet', 'FLEET FOOT', '#1c5d8a', ECON.perks.fleet.cost, 3.2);
  mkPerk(13.45, 17.2, -Math.PI / 2, 'deadeye', 'DEADEYE', '#5b2a7a', ECON.perks.deadeye.cost);

  // ---------- wall-buys ----------
  function mkWallbuy(x, y, z, ry, key) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75),
      new THREE.MeshBasicMaterial({ map: chalkTex(key), transparent: true, opacity: 0.92 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    wallBuys.push({ mesh: m, key, pos: new THREE.Vector3(x, y, z) });
  }
  mkWallbuy(4, 1.7, -9.79, 0, 'kar98');
  mkWallbuy(10.5, 1.7, 17.79, Math.PI, 'trench');
  mkWallbuy(6.61, 4.9, 5, -Math.PI / 2, 'smg');

  // ---------- mystery box pads (box itself lives in mysterybox.js) ----------
  const boxPads = [
    { x: -24.9, z: 0.8, ry: Math.PI / 2 },
    { x: -16, z: 19.5, ry: 0 },
    { x: 8.5, z: -8.6, ry: 0 },
  ];
  for (const p of boxPads) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.0), MAT.woodDark);
    pallet.position.set(p.x, 0.05, p.z);
    pallet.rotation.y = p.ry;
    pallet.receiveShadow = true;
    scene.add(pallet);
  }

  const papPos = new THREE.Vector3(8.5, 0, 17.2);

  // ---------- campsite ----------
  function palisade(x, z, len, alongX) {
    if (alongX) boxMesh(len, 2.3, 0.24, MAT.wood, x, 1.15, z);
    else boxMesh(0.24, 2.3, len, MAT.wood, x, 1.15, z);
    const n = Math.floor(len / 1.6);
    for (let i = 0; i <= n; i++) {
      const off = -len / 2 + (len / n) * i;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.55, 7), MAT.woodDark);
      post.position.set(alongX ? x + off : x, 1.27, alongX ? z : z + off);
      post.castShadow = true;
      scene.add(post);
    }
  }
  palisade(-34, 15.5, 11, false);
  palisade(-34, 28.5, 11, false);
  palisade(-26, 34, 16, true);
  palisade(-8, 34, 16, true);
  palisade(0, 13.5, 7, false);
  palisade(0, 22.25, 5.7, false);
  palisade(0, 30.45, 7.1, false);
  palisade(-30, 10, 8, true);

  // campfire
  {
    const fx = -17, fz = 22;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.22), MAT.wall);
      stone.position.set(fx + Math.cos(a) * 0.75, 0.1, fz + Math.sin(a) * 0.75);
      stone.rotation.y = a;
      scene.add(stone);
    }
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 7), MAT.woodDark);
      log.rotation.z = Math.PI / 2 - 0.5;
      log.rotation.y = i * 2.1;
      log.position.set(fx, 0.22, fz);
      scene.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a1404, emissive: 0xff7a1a, emissiveIntensity: 2.4, transparent: true, opacity: 0.9 }));
    flame.position.set(fx, 0.6, fz);
    scene.add(flame);
    const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 7),
      new THREE.MeshStandardMaterial({ color: 0x401800, emissive: 0xffc040, emissiveIntensity: 2.8 }));
    flame2.position.set(fx + 0.12, 0.5, fz + 0.08);
    scene.add(flame2);
    const fireLight = new THREE.PointLight(0xff8a30, 30, 19, 1.4);
    fireLight.position.set(fx, 1.1, fz);
    scene.add(fireLight);
    bulbs.push({ light: fireLight, base: 30, seed: 3.3, flames: [flame, flame2] });
    solid(fx - 0.8, fx + 0.8, 0, 0.5, fz - 0.8, fz + 0.8);
    boxMesh(1.6, 0.4, 0.45, MAT.woodDark, -17, 0.2, 24.2);
    boxMesh(1.6, 0.4, 0.45, MAT.woodDark, -19.4, 0.2, 21.2, { ry: 0.9, solid: false });
  }

  // tents
  function tent(x, z, ry) {
    const canvas = new THREE.MeshStandardMaterial({ color: 0x50493a, roughness: 0.95 });
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 2.2), canvas);
      panel.position.set(side * 0.78, 1.05, 0);
      panel.rotation.z = side * 1.02;
      panel.castShadow = true;
      g.add(panel);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 0.06), canvas);
    back.position.set(0, 0.8, -1.06);
    g.add(back);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    solid(x - 1.3, x + 1.3, 0, 1.9, z - 1.15, z + 1.15);
  }
  tent(-28, 15.5, 0.35);
  tent(-30, 25, -0.5);

  // watchtower
  for (const [lx, lz] of [[-9.3, 28.7], [-6.7, 28.7], [-9.3, 31.3], [-6.7, 31.3]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 0.22), MAT.woodDark);
    leg.position.set(lx, 1.35, lz);
    leg.castShadow = true;
    scene.add(leg);
  }
  boxMesh(3.2, 0.18, 3.2, MAT.wood, -8, 2.7, 30);
  boxMesh(3.2, 0.1, 0.1, MAT.woodDark, -8, 3.75, 28.45, { solid: false, cast: false });
  boxMesh(3.2, 0.1, 0.1, MAT.woodDark, -8, 3.75, 31.55, { solid: false, cast: false });
  boxMesh(0.1, 0.1, 3.2, MAT.woodDark, -9.55, 3.75, 30, { solid: false, cast: false });
  // 6 steps ending just outside the platform slab so the headroom-checked
  // step-up can mount the deck (slab spans x -9.6..-6.4)
  for (let i = 0; i < 6; i++) {
    const h = 0.43 * (i + 1);
    boxMesh(0.38, h, 1.2, MAT.wood, -4.4 - i * 0.36, h / 2, 30);
  }

  // lanterns
  function lantern(x, z) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.14), MAT.woodDark);
    pole.position.set(x, 1.2, z);
    pole.castShadow = true;
    scene.add(pole);
    solid(x - 0.1, x + 0.1, 0, 2.4, z - 0.1, z + 0.1);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 2 }));
    globe.position.set(x, 2.28, z + 0.22);
    scene.add(globe);
    const light = new THREE.PointLight(0xffc274, 20, 14, 1.5);
    light.position.set(x, 2.2, z + 0.22);
    scene.add(light);
    bulbs.push({ light, mesh: globe, base: 20, seed: Math.random() * 10 });
  }
  lantern(-10, 24);
  lantern(-26, 20);

  boxMesh(1.0, 0.95, 1.0, MAT.wood, -6, 0.48, 28.2);
  boxMesh(0.85, 0.8, 0.85, MAT.wood, -6.6, 0.4, 27.1);
  for (const [rx, rz, rs] of [[-31.5, 12, 0.55], [-2.5, 31.5, 0.75], [-22, 32.5, 0.5]]) {
    const rock = new THREE.Mesh(new THREE.SphereGeometry(rs, 7, 5), MAT.wall);
    rock.position.set(rx, rs * 0.5, rz);
    rock.scale.y = 0.7;
    rock.castShadow = true;
    scene.add(rock);
  }

  // ---------- scavenge nodes ----------
  function scavNode(x, z, mat) {
    const group = new THREE.Group();
    if (mat === 'wood') {
      for (const [ly, lz] of [[0.15, -0.17], [0.15, 0.17], [0.42, 0]]) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 8), MAT.wood);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, ly, lz);
        log.castShadow = true;
        group.add(log);
      }
    } else {
      const sack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 }));
      sack.position.y = 0.25;
      group.add(sack);
      for (let i = 0; i < 5; i++) {
        const lump = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4),
          new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6, metalness: 0.3 }));
        lump.position.set((Math.random() - 0.5) * 0.5, 0.53, (Math.random() - 0.5) * 0.5);
        group.add(lump);
      }
    }
    group.position.set(x, 0, z);
    scene.add(group);
    solid(x - 0.5, x + 0.5, 0, 0.55, z - 0.5, z + 0.5);
    scavenge.push({ pos: new THREE.Vector3(x, 0, z), mat, cd: 0, group });
  }
  scavNode(12.6, 4.2, 'wood');
  scavNode(-16, 6.8, 'coal');
  scavNode(-13, 29.5, 'wood');
  scavNode(-4, 13, 'coal');

  // ---------- electro-trap gate ----------
  const trapTips = [];
  for (const tz of [16.9, 19.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x2e2f33, metalness: 0.8, roughness: 0.4 }));
    pole.position.set(0, 1.25, tz);
    pole.castShadow = true;
    scene.add(pole);
    solid(-0.12, 0.12, 0, 2.5, tz - 0.12, tz + 0.12);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x66d4ff, emissiveIntensity: 1.2 }));
    tip.position.set(0, 2.55, tz);
    scene.add(tip);
    trapTips.push(tip);
  }
  boxMesh(0.34, 0.5, 0.2, MAT.metal, 0, 1.3, 16.3, { solid: false });
  const trap = {
    tips: trapTips,
    switchPos: new THREE.Vector3(0, 1.2, 16.3),
    state: 'ready', t: 0, cost: ECON.trapCost,
    posA: new THREE.Vector3(0, 0.2, 17.0),
    posB: new THREE.Vector3(0, 0.2, 19.4),
    zone: { x0: -0.9, x1: 0.9, z0: 16.8, z1: 19.6 },
  };

  // ---------- exterior dressing ----------
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x352c20, roughness: 1 });
  for (const [tx, tz, ts] of [[-10, -20, 1.1], [14, -18, 0.9], [24, -6, 1.2], [28, 10, 1], [18, 24, 1.15], [-6, 26, 0.85], [-22, 20, 0.95], [-33, 2, 1.1], [-31, -12, 0.9], [6, -27, 1.05]]) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * ts, 0.26 * ts, 4.4 * ts, 7), barkMat);
    trunk.position.y = 2.2 * ts;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let i = 0; i < 4; i++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * ts, 0.09 * ts, 1.9 * ts, 5), barkMat);
      br.position.set(Math.cos(i * 1.9) * 0.5 * ts, 2.4 * ts + i * 0.5 * ts, Math.sin(i * 1.9) * 0.5 * ts);
      br.rotation.z = 0.7 + Math.random() * 0.7;
      br.rotation.y = i * 1.9;
      tree.add(br);
    }
    tree.position.set(tx, 0, tz);
    scene.add(tree);
  }
  for (let i = 0; i < 20; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), MAT.woodDark);
    post.position.set(-30 + i * 3.1, 0.55, -23 + Math.sin(i * 2.7) * 0.5);
    post.rotation.z = (i % 2 ? 1 : -1) * 0.1;
    scene.add(post);
  }
  boxMesh(62, 0.06, 0.06, MAT.woodDark, 0.5, 0.85, -23, { solid: false, cast: false });

  // ---------- door buying ----------
  function openDoor(door) {
    door.open = true;
    rooms[door.unlockRoom].unlocked = true;
    const idx = colliders.indexOf(door.solid);
    if (idx >= 0) colliders.splice(idx, 1);
    const sIdx = shotSolids.indexOf(door.solid);
    if (sIdx >= 0) shotSolids.splice(sIdx, 1);
  }

  // ---------- per-frame ----------
  function update(dt, time) {
    for (const b of bulbs) {
      const n = Math.sin(time * 9 + b.seed) * 0.5 + Math.sin(time * 23 + b.seed * 2.7) * 0.5;
      b.light.intensity = b.base * (0.82 + 0.18 * n) * (Math.random() < 0.004 ? 0.25 : 1);
      if (b.flames) {
        b.flames[0].scale.y = 1 + Math.sin(time * 11 + 1) * 0.15;
        b.flames[1].scale.y = 1 + Math.sin(time * 14) * 0.2;
      }
    }
    for (const d of doors) {
      if (d.open && d.anim < 1) {
        d.anim = Math.min(1, d.anim + dt * 1.2);
        d.group.position.y = -2.6 * d.anim;
        if (d.anim >= 1) d.group.visible = false;
      }
    }
    for (let i = flyingBoards.length - 1; i >= 0; i--) {
      const f = flyingBoards[i];
      f.t += dt;
      f.vel.y -= 9 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += f.rot.x * dt;
      f.mesh.rotation.y += f.rot.y * dt;
      f.mesh.rotation.z += f.rot.z * dt;
      if (f.t > 1.1) {
        f.mesh.scale.setScalar(Math.max(0.01, 1 - (f.t - 1.1) * 2));
      }
      if (f.t > 1.6) {
        scene.remove(f.mesh);
        flyingBoards.splice(i, 1);
      }
    }
  }

  return {
    colliders, shotSolids, bounds,
    rooms, roomAt, pathChain,
    windows, doors, openDoor, ripBoard, addBoard,
    perks, wallBuys, boxPads, papPos, scavenge, trap, bulbs,
    spawnPoint: new THREE.Vector3(0, 0.02, 4),
    update, moonLight,
    materials: MAT, textures: { qTex, woodTex },
  };
}
