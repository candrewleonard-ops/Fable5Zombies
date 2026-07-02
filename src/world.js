import * as THREE from 'three';
import { boxCollider } from './physics.js';

// Night graveyard arena with a ruined chapel. Every solid mesh registers an
// AABB collider; stairs are stacks of low steps so the step-up physics can
// climb them.

const ARENA = 44; // half-extent

function canvasTexture(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene) {
  const colliders = [];
  const bounds = { minX: -ARENA, maxX: ARENA, minZ: -ARENA, maxZ: ARENA };
  const flickerLights = [];
  const spawnPoints = [];

  const solid = (mesh, pad = 0) => {
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox.clone();
    b.applyMatrix4(mesh.matrixWorld);
    colliders.push({
      minX: b.min.x - pad, minY: b.min.y, minZ: b.min.z - pad,
      maxX: b.max.x + pad, maxY: b.max.y, maxZ: b.max.z + pad,
    });
  };

  // ---------- atmosphere ----------
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.FogExp2(0x070a12, 0.022);

  const hemi = new THREE.HemisphereLight(0x45557a, 0x131a10, 0.95);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0x9db4e4, 1.35);
  moonLight.position.set(-30, 42, -18);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -50;
  moonLight.shadow.camera.right = 50;
  moonLight.shadow.camera.top = 50;
  moonLight.shadow.camera.bottom = -50;
  moonLight.shadow.camera.far = 120;
  moonLight.shadow.bias = -0.0004;
  scene.add(moonLight);

  // moon disc
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false })
  );
  moon.position.set(-90, 110, -60);
  scene.add(moon);
  const moonGlow = new THREE.Mesh(
    new THREE.SphereGeometry(5.6, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x8fa8d8, transparent: true, opacity: 0.18, fog: false })
  );
  moonGlow.position.copy(moon.position);
  scene.add(moonGlow);

  // stars
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.42;
    const r = 220;
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph) + 8;
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcdd8ff, size: 0.7, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.85,
  })));

  // ---------- materials ----------
  const groundTex = canvasTexture((g, s) => {
    g.fillStyle = '#141a10'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const shade = 14 + Math.random() * 26;
      g.fillStyle = `rgb(${shade * 0.85 | 0},${shade + 6 | 0},${shade * 0.6 | 0})`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    for (let i = 0; i < 30; i++) { // dirt patches
      g.fillStyle = 'rgba(48,38,24,0.25)';
      g.beginPath();
      g.ellipse(Math.random() * s, Math.random() * s, 8 + Math.random() * 22, 5 + Math.random() * 14, Math.random() * 3, 0, 7);
      g.fill();
    }
  });
  groundTex.repeat.set(18, 18);

  const stoneTex = canvasTexture((g, s) => {
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = 46 + Math.random() * 30;
      g.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      g.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2;
    for (let y = 0; y < s; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      for (let x = (y / 32) % 2 ? 0 : 32; x < s; x += 64) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke();
      }
    }
  });

  const woodTex = canvasTexture((g, s) => {
    g.fillStyle = '#4a3521'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 20) {
      g.fillStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.2})`;
      g.fillRect(x, 0, 2, s);
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = 'rgba(90,64,38,0.4)';
      g.fillRect(Math.random() * s, Math.random() * s, 1, 6 + Math.random() * 14);
    }
  });

  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x777d88, roughness: 1 });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });

  const box = (w, h, d, mat, x, y, z, { collide = true, ry = 0, castShadow = true, parent = scene } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = castShadow;
    m.receiveShadow = true;
    parent.add(m);
    m.updateMatrixWorld(true);
    if (collide) solid(m);
    return m;
  };

  // ---------- ground ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2 + 20, ARENA * 2 + 20), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- perimeter walls ----------
  const W = ARENA;
  box(W * 2 + 2, 3.2, 1, stoneMat, 0, 1.6, -W - 0.5);
  box(W * 2 + 2, 3.2, 1, stoneMat, 0, 1.6, W + 0.5);
  box(1, 3.2, W * 2 + 2, stoneMat, -W - 0.5, 1.6, 0);
  box(1, 3.2, W * 2 + 2, stoneMat, W + 0.5, 1.6, 0);
  // wall spikes for silhouette
  for (let i = -W; i <= W; i += 8) {
    box(0.6, 1.2, 0.6, darkStoneMat, i, 3.6, -W - 0.5, { collide: false });
    box(0.6, 1.2, 0.6, darkStoneMat, i, 3.6, W + 0.5, { collide: false });
  }

  // ---------- ruined chapel (has THE stairs) ----------
  // footprint x: -9..9, z: -7..7, second floor at y = 3.2
  const FLOOR2 = 3.2;
  const wallT = 0.6;

  // slab floor
  box(18, 0.2, 14, darkStoneMat, 0, 0.1, 0, { castShadow: false });

  // south wall (z = 7) with door gap in the middle (gap x: -1.5..1.5)
  box(7.5, FLOOR2, wallT, stoneMat, -5.25, FLOOR2 / 2, 7);
  box(7.5, FLOOR2, wallT, stoneMat, 5.25, FLOOR2 / 2, 7);
  box(3, 0.5, wallT, stoneMat, 0, FLOOR2 - 0.25, 7); // lintel above door (2.7m clearance — brutes fit)
  // north wall (z = -7) with window gaps
  box(18, 1.2, wallT, stoneMat, 0, 0.6, -7);
  box(18, 0.9, wallT, stoneMat, 0, FLOOR2 - 0.45, -7);
  box(2.4, 1.1, wallT, stoneMat, -6.5, 1.75, -7);
  box(2.4, 1.1, wallT, stoneMat, 0, 1.75, -7);
  box(2.4, 1.1, wallT, stoneMat, 6.5, 1.75, -7);
  // west wall (x = -9), ruined: partial height
  box(wallT, FLOOR2, 14, stoneMat, -9, FLOOR2 / 2, 0);
  // east wall (x = 9) with door gap (z: -1.5..1.5)
  box(wallT, FLOOR2, 5.5, stoneMat, 9, FLOOR2 / 2, -4.25);
  box(wallT, FLOOR2, 5.5, stoneMat, 9, FLOOR2 / 2, 4.25);
  box(wallT, 0.5, 3, stoneMat, 9, FLOOR2 - 0.25, 0);

  // second floor slab with a stair hole above the staircase (x: 6.3..8.9, z: 1.7..6.2)
  box(15.3, 0.25, 14, woodMat, -1.35, FLOOR2, 0);          // everything west of the hole
  box(2.7, 0.25, 8.7, woodMat, 7.65, FLOOR2, -2.65);       // east strip, north of the hole
  box(2.7, 0.25, 0.8, woodMat, 7.65, FLOOR2, 6.6);         // landing at the top of the stairs

  // THE STAIRCASE — 8 climbable steps along the east wall. Base sits in the
  // open interior at z=2.0 and rises southward onto the landing above.
  const stepH = 0.4, stepD = 0.55, stepW = 2.6;
  const stepX = 7.6;
  for (let i = 0; i < 8; i++) {
    const h = stepH * (i + 1);
    box(stepW, h, stepD, stoneMat, stepX, h / 2, 2.0 + i * stepD);
  }

  // parapet around the rooftop edges (waist height so you can shoot over)
  box(12, 0.9, 0.3, stoneMat, -3, FLOOR2 + 0.45, -6.85);
  box(12, 0.9, 0.3, stoneMat, -3, FLOOR2 + 0.45, 6.85);
  box(0.3, 0.9, 14, stoneMat, -8.85, FLOOR2 + 0.45, 0);
  box(6, 0.9, 0.3, stoneMat, 6, FLOOR2 + 0.45, -6.85);
  box(0.3, 0.9, 8.7, stoneMat, 8.85, FLOOR2 + 0.45, -2.65);

  // broken columns inside
  box(0.8, 2.2, 0.8, darkStoneMat, -5, 1.1, -3);
  box(0.8, 1.4, 0.8, darkStoneMat, -5, 0.7, 3.2);
  box(0.8, 3.0, 0.8, darkStoneMat, 4, 1.5, -3.5);

  // ---------- outdoor sniper platform with wooden stairs ----------
  // platform at (-24, 2.6, 18), stairs from the south
  const P = { x: -24, z: 18, h: 2.6 };
  box(6, 0.3, 6, woodMat, P.x, P.h, P.z);
  // 4 legs
  for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
    box(0.4, P.h, 0.4, woodMat, P.x + dx, P.h / 2, P.z + dz);
  }
  // railing
  box(6, 0.7, 0.2, woodMat, P.x, P.h + 0.5, P.z - 3);
  box(0.2, 0.7, 6, woodMat, P.x - 3, P.h + 0.5, P.z);
  box(0.2, 0.7, 6, woodMat, P.x + 3, P.h + 0.5, P.z);
  // wooden steps up (6 steps of 0.43)
  for (let i = 0; i < 6; i++) {
    const h = 0.43 * (i + 1);
    box(2.4, h, 0.62, woodMat, P.x, h / 2, P.z + 3 + (5 - i) * 0.62);
  }

  // ---------- gravestones ----------
  const graveMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x8b929e, roughness: 1 });
  const gravePositions = [];
  let gseed = 7;
  const rand = () => { gseed = (gseed * 16807) % 2147483647; return gseed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const x = (rand() * 2 - 1) * (ARENA - 8);
    const z = (rand() * 2 - 1) * (ARENA - 8);
    if (Math.abs(x) < 13 && Math.abs(z) < 11) continue;           // keep chapel clear
    if (Math.hypot(x - P.x, z - P.z) < 7) continue;               // keep platform clear
    gravePositions.push([x, z]);
    const g = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1 + rand() * 0.5, 0.18), graveMat);
    stone.position.y = 0.55;
    stone.castShadow = true; stone.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 12, 1, false, 0, Math.PI), graveMat);
    top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2;
    top.position.y = 0.55 + stone.geometry.parameters.height / 2;
    top.castShadow = true;
    g.add(stone, top);
    g.position.set(x, 0, z);
    g.rotation.y = rand() * Math.PI * 2;
    g.rotation.z = (rand() - 0.5) * 0.16;
    scene.add(g);
    // square footprint sized to cover the stone at any yaw rotation
    colliders.push(boxCollider(x, 0.85, z, 0.9, 1.7, 0.9));
    if (gravePositions.length % 2 === 0) spawnPoints.push(new THREE.Vector3(x, 0, z));
  }

  // ---------- dead trees ----------
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const x = (rand() * 2 - 1) * (ARENA - 6);
    const z = (rand() * 2 - 1) * (ARENA - 6);
    if (Math.abs(x) < 14 && Math.abs(z) < 12) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 4.6, 7), barkMat);
    trunk.position.y = 2.3; trunk.castShadow = true;
    tree.add(trunk);
    for (let b = 0; b < 4; b++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 2.2, 5), barkMat);
      br.position.y = 3 + rand() * 1.4;
      br.rotation.z = 0.6 + rand() * 0.9;
      br.rotation.y = rand() * Math.PI * 2;
      br.translateY(0.8);
      br.castShadow = true;
      tree.add(br);
    }
    tree.position.set(x, 0, z);
    tree.rotation.y = rand() * 6.28;
    tree.rotation.x = (rand() - 0.5) * 0.1;
    scene.add(tree);
    colliders.push(boxCollider(x, 2.3, z, 0.7, 4.6, 0.7));
  }

  // ---------- crates & barrels ----------
  const cratePos = [[14, -14], [15.4, -13.2], [14.6, -14, 1.05], [-16, -20], [22, 12], [23.2, 13], [-12, 26], [4, 16], [-20, -8]];
  for (const [x, z, y = 0] of cratePos) {
    box(1.05, 1.05, 1.05, woodMat, x, y + 0.525, z, { ry: rand() * 0.8 - 0.4 });
  }

  // ---------- lamps ----------
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.6, metalness: 0.7 });
  const lampSpots = [[6, 10], [-14, -6], [18, -20], [-26, 12], [12, 26], [-6, -26]];
  for (const [x, z] of lampSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.4, 8), lampMat);
    pole.position.set(x, 2.2, z);
    pole.castShadow = true;
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x111318, emissive: 0xffb347, emissiveIntensity: 1.4 }));
    head.position.set(x, 4.4, z);
    scene.add(head);
    const light = new THREE.PointLight(0xffa04a, 14, 15, 1.8);
    light.position.set(x, 4.15, z);
    scene.add(light);
    flickerLights.push({ light, head, base: 14, phase: Math.random() * 10 });
    colliders.push(boxCollider(x, 2.2, z, 0.35, 4.4, 0.35));
  }

  // chapel interior candle light
  const candle = new THREE.PointLight(0xff7b2d, 9, 12, 1.9);
  candle.position.set(-3, 2.2, 0);
  scene.add(candle);
  flickerLights.push({ light: candle, base: 9, phase: 3 });

  // ---------- ground mist (cheap: big soft sprites) ----------
  const mistTex = canvasTexture((g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(150,170,200,0.24)');
    grad.addColorStop(1, 'rgba(150,170,200,0)');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
  }, 128);
  const mists = [];
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: mistTex, transparent: true, depthWrite: false, opacity: 0.5 + Math.random() * 0.3,
    }));
    const sc = 10 + Math.random() * 14;
    sp.scale.set(sc, sc * 0.35, 1);
    sp.position.set((Math.random() * 2 - 1) * ARENA, 0.7, (Math.random() * 2 - 1) * ARENA);
    scene.add(sp);
    mists.push({ sp, speed: 0.15 + Math.random() * 0.3, y: sp.position.y });
  }

  // edge spawn points (outside chapel, near walls)
  for (const [x, z] of [[-38, -38], [38, -38], [-38, 38], [38, 38], [0, -40], [0, 40], [-40, 0], [40, 0], [20, -38], [-20, 38]]) {
    spawnPoints.push(new THREE.Vector3(x, 0, z));
  }

  function update(dt, time) {
    for (const f of flickerLights) {
      const n = Math.sin(time * 9 + f.phase) * 0.5 + Math.sin(time * 23 + f.phase * 2.7) * 0.5;
      const v = f.base * (0.82 + 0.18 * n) * (Math.random() < 0.005 ? 0.2 : 1);
      f.light.intensity = v;
      if (f.head) f.head.material.emissiveIntensity = v / f.base * 1.4;
    }
    for (const m of mists) {
      m.sp.position.x += m.speed * dt;
      if (m.sp.position.x > ARENA + 12) m.sp.position.x = -ARENA - 12;
    }
  }

  return { colliders, bounds, spawnPoints, update, moonLight, FLOOR2 };
}
