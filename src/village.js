import * as THREE from 'three';

// WESTBROOK VILLAGE — a settlement far east of the bunker (about 8 map-widths
// down a lamplit road). Marketplace/bank with a giant market TV + the Private
// Fund Placement office, a gun store with the Gun Combiner, the Town Hall
// quest giver, and the Ravager LX (lambo) showroom.

export const VILLAGE = { x: 460, z: 0 };

function makeNPC(scene, x, z, ry, { suit = 0x2c3444, skin = 0xc9a184, tie = 0x7a1c1c } = {}) {
  const g = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), suitMat);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const tieM = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.02),
    new THREE.MeshStandardMaterial({ color: tie }));
  tieM.position.set(0, 1.15, 0.14);
  g.add(tieM);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), skinMat);
  head.position.y = 1.52;
  g.add(head);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.55, 0.12), suitMat);
    arm.position.set(s * 0.29, 1.05, 0);
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.74, 0.16), new THREE.MeshStandardMaterial({ color: 0x1c2026 }));
    leg.position.set(s * 0.12, 0.37, 0);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  scene.add(g);
  return { group: g, head, t: Math.random() * 9 };
}

export function buildVillage(scene, world) {
  const { solid, boxMesh, makeTex } = world;
  const MAT = world.materials;
  const V = VILLAGE;
  const npcs = [];

  const brick = new THREE.MeshStandardMaterial({
    map: makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7a5a48'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,24,16,0.5)'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 20) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (y / 20) % 2 ? 0 : 24; x < w; x += 48) {
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 20); g.stroke();
        }
      }
    }, 3, 2), roughness: 0.9,
  });
  const marble = new THREE.MeshStandardMaterial({ color: 0xcac2b2, roughness: 0.4, metalness: 0.05 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc8e8, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.35 });

  // ---------- the road (bunker → village) ----------
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.95 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(V.x - 22, 7), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.set((V.x + 22) / 2 - 6, 0.004, 6);
  road.receiveShadow = true;
  scene.add(road);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c245 });
  for (let x = 30; x < V.x - 18; x += 14) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.3), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, 0.006, 6);
    scene.add(dash);
  }
  // lamps along the road (emissive heads; a few real lights near the ends)
  for (let x = 44; x < V.x - 20; x += 42) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8), MAT.metal);
    pole.position.set(x, 2.3, 10.2);
    pole.castShadow = true;
    scene.add(pole);
    solid(x - 0.12, x + 0.12, 0, 4.6, 10.08, 10.32);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 2.4 }));
    headM.position.set(x, 4.55, 10.2);
    scene.add(headM);
    if (x === 44 || x > V.x - 62) { // just two real lights on the whole road
      const light = new THREE.PointLight(0xffc274, 26, 22, 1.5);
      light.position.set(x, 4.4, 10.2);
      scene.add(light);
      world.bulbs.push({ light, base: 26, seed: Math.random() * 10 });
    }
  }

  // village plaza: cobblestone circle + fountain + lamps
  const plazaTex = makeTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5c5850'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(${60 + Math.random() * 30 | 0},${58 + Math.random() * 26 | 0},${52 + Math.random() * 22 | 0},0.8)`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 12, 8 + Math.random() * 9, Math.random(), 0, 7);
      g.fill();
    }
  }, 8, 8);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(42, 36), new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.9 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(V.x, 0.005, V.z);
  plaza.receiveShadow = true;
  scene.add(plaza);
  { // fountain
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.8, 20), marble);
    rim.position.set(V.x, 0.4, V.z);
    rim.castShadow = true;
    scene.add(rim);
    solid(V.x - 3, V.x + 3, 0, 0.8, V.z - 3, V.z + 3);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a5a7a, roughness: 0.15, metalness: 0.4 }));
    water.position.set(V.x, 0.72, V.z);
    scene.add(water);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 2.2, 10), marble);
    spire.position.set(V.x, 1.7, V.z);
    scene.add(spire);
    const glow = new THREE.PointLight(0x9fd8ff, 14, 14, 1.6);
    glow.position.set(V.x, 2.4, V.z);
    scene.add(glow);
    world.bulbs.push({ light: glow, base: 14, seed: 2.2 });
  }
  for (const [i, a] of [0.6, 2.2, 3.9, 5.5].entries()) { // plaza lamps (2 real lights)
    const lx = V.x + Math.cos(a) * 14, lz = V.z + Math.sin(a) * 14;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 8), MAT.metal);
    pole.position.set(lx, 1.8, lz);
    scene.add(pole);
    solid(lx - 0.12, lx + 0.12, 0, 3.6, lz - 0.12, lz + 0.12);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 2.2 }));
    headM.position.set(lx, 3.66, lz);
    scene.add(headM);
    if (i % 2 === 0) {
      const light = new THREE.PointLight(0xffc274, 20, 17, 1.5);
      light.position.set(lx, 3.6, lz);
      scene.add(light);
      world.bulbs.push({ light, base: 20, seed: Math.random() * 10 });
    }
  }

  // generic building shell with a door opening on the south face
  function shell(cx, cz, w, d, h, mat, doorW = 2.2, doorAt = 0) {
    const T = 0.4;
    // south wall (door)
    const zS = cz + d / 2;
    const segA = (doorAt - doorW / 2) - (-w / 2);
    if (segA > 0.05) boxMesh(segA, h, T, mat, cx - w / 2 + segA / 2, h / 2, zS);
    const segB = (w / 2) - (doorAt + doorW / 2);
    if (segB > 0.05) boxMesh(segB, h, T, mat, cx + w / 2 - segB / 2, h / 2, zS);
    boxMesh(doorW, h - 2.6, T, mat, cx + doorAt, 2.6 + (h - 2.6) / 2, zS); // lintel
    // north/east/west
    boxMesh(w, h, T, mat, cx, h / 2, cz - d / 2);
    boxMesh(T, h, d, mat, cx - w / 2, h / 2, cz);
    boxMesh(T, h, d, mat, cx + w / 2, h / 2, cz);
    // roof + floor
    boxMesh(w + 0.6, 0.3, d + 0.6, MAT.ceil, cx, h + 0.15, cz);
    const floorM = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), MAT.floor);
    floorM.position.set(cx, 0.05, cz);
    floorM.receiveShadow = true;
    scene.add(floorM);
    solid(cx - w / 2, cx + w / 2, -0.1, 0.1, cz - d / 2, cz + d / 2);
  }

  function signPlane(text, wpx, x, y, z, ry, color = '#e8dcc0', bg = '#1c1410', wm = 4, hm = 0.9) {
    const tex = makeTex(512, 96, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.fillStyle = color; g.font = `bold ${wpx}px Georgia`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wm, hm), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  }

  function interiorLight(x, y, z, intensity = 22, dist = 18) {
    const light = new THREE.PointLight(0xffe0b0, intensity, dist, 1.4);
    light.position.set(x, y, z);
    scene.add(light);
    world.bulbs.push({ light, base: intensity, seed: Math.random() * 10 });
  }

  // ================= MARKETPLACE / BANK =================
  const BK = { x: V.x - 26, z: V.z - 22 };
  shell(BK.x, BK.z, 26, 18, 7, brick, 2.6);
  signPlane('WESTBROOK MARKETPLACE & TRUST', 40, BK.x, 7.6, BK.z + 9.4, 0, '#f0e2b8', '#141c2c', 12, 1.4);
  interiorLight(BK.x - 6, 5.6, BK.z, 26, 22);
  interiorLight(BK.x + 7, 5.6, BK.z + 3, 26, 22);
  // marble teller counter (chase-bank vibes)
  boxMesh(10, 1.15, 0.9, marble, BK.x - 3, 0.575, BK.z - 3);
  boxMesh(10, 0.1, 1.3, marble, BK.x - 3, 1.2, BK.z - 3);
  for (let i = 0; i < 3; i++) { // teller dividers
    boxMesh(0.06, 0.7, 1.0, glassMat, BK.x - 7 + i * 3.4, 1.65, BK.z - 3, { solid: false });
  }
  // velvet queue ropes
  for (let i = 0; i < 4; i++) {
    const px = BK.x - 6.5 + i * 2.4;
    boxMesh(0.08, 1.0, 0.08, MAT.metal, px, 0.5, BK.z + 1.6);
    if (i < 3) boxMesh(2.3, 0.05, 0.05, new THREE.MeshStandardMaterial({ color: 0x7a1c2c, roughness: 0.7 }), px + 1.2, 0.92, BK.z + 1.6, { solid: false });
  }
  // GIANT market TV (canvas texture redrawn by the Market system)
  const tvCanvas = document.createElement('canvas');
  tvCanvas.width = 1024; tvCanvas.height = 512;
  const tvTex = new THREE.CanvasTexture(tvCanvas);
  tvTex.colorSpace = THREE.SRGBColorSpace;
  const tvFrame = boxMesh(9.4, 4.9, 0.25, new THREE.MeshStandardMaterial({ color: 0x0c0c10, metalness: 0.6, roughness: 0.4 }), BK.x - 3, 4.0, BK.z - 8.6, { solid: false });
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5),
    new THREE.MeshBasicMaterial({ map: tvTex }));
  tv.position.set(BK.x - 3, 4.0, BK.z - 8.42);
  scene.add(tv);
  // teller NPCs
  npcs.push(makeNPC(scene, BK.x - 5, BK.z - 4.2, 0, { suit: 0x24303e }));
  npcs.push(makeNPC(scene, BK.x - 1.4, BK.z - 4.2, 0, { suit: 0x322a3e }));

  // Private Fund Placement office: a glass-walled corner room, paid door
  const OF = { x: BK.x + 8.2, z: BK.z - 4.5 };
  boxMesh(0.15, 3.4, 9, glassMat, OF.x - 4.2, 1.7, OF.z, { solid: false });
  solid(OF.x - 4.3, OF.x - 4.1, 0, 3.4, OF.z - 4.5, OF.z - 1.3);   // glass wall segments (door gap z -1.3..1.3)
  solid(OF.x - 4.3, OF.x - 4.1, 0, 3.4, OF.z + 1.3, OF.z + 4.5);
  boxMesh(4.4, 0.18, 9, MAT.ceil, OF.x - 2, 3.45, OF.z, { solid: false });
  signPlane('PRIVATE FUND PLACEMENT', 44, OF.x - 4.32, 2.7, OF.z, -Math.PI / 2, '#d8c88a', '#101418', 3.6, 0.5);
  signPlane('ENTRY $2,500', 52, OF.x - 4.32, 2.15, OF.z, -Math.PI / 2, '#8ad89a', '#101418', 2.2, 0.4);
  // office door (bought like a bunker door)
  const officeDoorGroup = new THREE.Group();
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 2.5), glassMat);
  doorMesh.position.set(OF.x - 4.2, 1.6, OF.z);
  officeDoorGroup.add(doorMesh);
  scene.add(officeDoorGroup);
  const officeDoorSolid = solid(OF.x - 4.35, OF.x - 4.05, 0, 3.2, OF.z - 1.3, OF.z + 1.3);
  // banker desk + banker
  boxMesh(2.6, 0.85, 1.2, MAT.woodDark, OF.x - 0.6, 0.425, OF.z);
  const banker = makeNPC(scene, OF.x + 0.6, OF.z, -Math.PI / 2, { suit: 0x1c2c24, tie: 0xc8a742 });
  npcs.push(banker);
  interiorLight(OF.x - 1.5, 3.1, OF.z, 14, 9);

  // ================= GUN STORE =================
  const GS = { x: V.x + 26, z: V.z - 18 };
  shell(GS.x, GS.z, 18, 13, 5.6, MAT.wall, 2.4);
  signPlane("IRONSIDE'S GUN STORE", 44, GS.x, 6.1, GS.z + 6.9, 0, '#f0c890', '#241410', 9, 1.1);
  interiorLight(GS.x, 4.4, GS.z, 24, 18);
  boxMesh(6.5, 1.05, 0.8, MAT.woodDark, GS.x - 2, 0.525, GS.z - 2.2);
  npcs.push(makeNPC(scene, GS.x - 2, GS.z - 3.4, 0, { suit: 0x3e3226, tie: 0x2c2c30 }));
  // wall racks (visual gun silhouettes get added by main via buildGunModel)
  const rackAnchors = [];
  for (let i = 0; i < 6; i++) {
    boxMesh(1.6, 0.08, 0.25, MAT.wood, GS.x - 7 + i * 2.6, 2.4, GS.z - 6.1, { solid: false });
    rackAnchors.push(new THREE.Vector3(GS.x - 7 + i * 2.6, 2.7, GS.z - 6.0));
  }
  // Gun Combiner machine — arcane arch of steel with item sockets
  const CB = { x: GS.x + 6.4, z: GS.z + 2.8 };
  boxMesh(2.2, 0.5, 1.4, MAT.metal, CB.x, 0.25, CB.z);
  for (const s of [-1, 1]) {
    boxMesh(0.3, 2.6, 0.3, MAT.metal, CB.x + s * 0.9, 1.55, CB.z);
  }
  boxMesh(2.1, 0.3, 0.35, MAT.metal, CB.x, 2.95, CB.z);
  const combinerGlow = new THREE.PointLight(0xb04aff, 10, 7, 1.8);
  combinerGlow.position.set(CB.x, 2.2, CB.z);
  scene.add(combinerGlow);
  world.bulbs.push({ light: combinerGlow, base: 10, seed: 5.5 });
  signPlane('GUN COMBINER', 52, CB.x, 3.35, CB.z + 0.25, 0, '#d8a8ff', '#180c20', 2.2, 0.42);

  // ================= TOWN HALL =================
  const TH = { x: V.x + 2, z: V.z + 30 };
  shell(TH.x, TH.z, 20, 14, 8, marble, 3, 0);
  // grand steps + columns
  for (let i = 0; i < 3; i++) {
    boxMesh(10 - i * 1.4, 0.55, 1.2, marble, TH.x, 0.275 + i * 0.18, TH.z - 7.8 - i * 0 + 0.0);
  }
  for (const sx of [-6, -2, 2, 6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 7.6, 12), marble);
    col.position.set(TH.x + sx, 3.8, TH.z - 7.6);
    col.castShadow = true;
    scene.add(col);
    solid(TH.x + sx - 0.5, TH.x + sx + 0.5, 0, 7.6, TH.z - 8.1, TH.z - 7.1);
  }
  signPlane('TOWN HALL', 56, TH.x, 8.7, TH.z - 7.8, 0, '#e8e0c8', '#2c2820', 7, 1.2);
  interiorLight(TH.x, 6.2, TH.z + 1, 28, 20);
  // quest giver: the Reeve at a grand desk
  boxMesh(3.4, 0.95, 1.4, MAT.woodDark, TH.x, 0.475, TH.z + 2);
  const reeve = makeNPC(scene, TH.x, TH.z + 3.2, Math.PI, { suit: 0x3a2c4a, tie: 0xc8a742 });
  npcs.push(reeve);
  // notice board with the engine clue
  boxMesh(2.4, 1.6, 0.12, MAT.wood, TH.x - 6, 1.8, TH.z + 6.8, { solid: false });
  world.mkNote(TH.x - 6, 1.8, TH.z + 6.6, "Blacksmith's ledger",
    "'Turbine for the war bird — eight bars of steel, two stones that cut glass. Forge it on an anvil or not at all.' The rest of the page is torn off.");

  // town hall doors face SOUTH toward plaza — shell puts door on +z side; flip:
  // (door already faces plaza since TH.z + d/2 is the south face)

  // ================= LAMBO SHOWROOM =================
  const LS = { x: V.x - 4, z: V.z - 34 };
  // glass pavilion
  boxMesh(12, 0.25, 9, MAT.ceil, LS.x, 4.1, LS.z);
  for (const [px, pz] of [[-5.6, -4.2], [5.6, -4.2], [-5.6, 4.2], [5.6, 4.2]]) {
    boxMesh(0.3, 4, 0.3, MAT.metal, LS.x + px, 2, LS.z + pz);
  }
  boxMesh(12, 4, 0.1, glassMat, LS.x, 2, LS.z - 4.4, { solid: false });
  solid(LS.x - 6, LS.x + 6, 0, 4, LS.z - 4.5, LS.z - 4.3);
  boxMesh(0.1, 4, 8.8, glassMat, LS.x - 5.9, 2, LS.z, { solid: false });
  solid(LS.x - 6, LS.x - 5.8, 0, 4, LS.z - 4.4, LS.z + 4.4);
  boxMesh(0.1, 4, 8.8, glassMat, LS.x + 5.9, 2, LS.z, { solid: false });
  solid(LS.x + 5.8, LS.x + 6, 0, 4, LS.z - 4.4, LS.z + 4.4);
  // rotating display pedestal + show lambo
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0x18181c, metalness: 0.7, roughness: 0.3 }));
  pedestal.position.set(LS.x, 0.175, LS.z);
  scene.add(pedestal);
  solid(LS.x - 2.8, LS.x + 2.8, 0, 0.35, LS.z - 2.8, LS.z + 2.8);
  const showLambo = buildLamboModel();
  showLambo.position.set(LS.x, 0.35, LS.z);
  scene.add(showLambo);
  const showGlow = new THREE.PointLight(0xffe080, 24, 14, 1.5);
  showGlow.position.set(LS.x, 3.4, LS.z);
  scene.add(showGlow);
  world.bulbs.push({ light: showGlow, base: 24, seed: 7.7 });
  signPlane('RAVAGER LX — $1,000,000', 44, LS.x, 4.6, LS.z + 4.5, 0, '#ffd23b', '#0c0c10', 8, 1.0);

  // a few cottages for flavor
  for (const [hx, hz, hw, hd] of [[V.x - 34, V.z + 18, 9, 8], [V.x + 34, V.z + 16, 8, 7], [V.x + 18, V.z + 34, 9, 8]]) {
    shell(hx, hz, hw, hd, 4.2, MAT.wood, 1.8);
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(Math.max(hw, hd) * 0.75, 2.4, 4),
      new THREE.MeshStandardMaterial({ color: 0x5a3226, roughness: 0.9 }));
    roofM.position.set(hx, 4.2 + 1.2, hz);
    roofM.rotation.y = Math.PI / 4;
    scene.add(roofM);
  }

  return {
    npcs,
    tvCanvas, tvTex,
    bank: { pos: new THREE.Vector3(BK.x - 3, 1, BK.z - 2.4) },
    office: {
      doorPos: new THREE.Vector3(OF.x - 4.2, 1.4, OF.z),
      doorSolid: officeDoorSolid, doorGroup: officeDoorGroup,
      bankerPos: new THREE.Vector3(OF.x + 0.2, 1, OF.z), unlocked: false,
    },
    store: { counterPos: new THREE.Vector3(GS.x - 2, 1, GS.z - 1.6), rackAnchors },
    combiner: { pos: new THREE.Vector3(CB.x, 1.2, CB.z) },
    townhall: { reevePos: new THREE.Vector3(TH.x, 1, TH.z + 2.6) },
    showroom: { pos: new THREE.Vector3(LS.x, 1, LS.z + 3.6), pedestal: showLambo },
  };
}

// the Ravager LX body — also used by the car system when deployed
export function buildLamboModel() {
  const g = new THREE.Group();
  g.userData.wheels = [];
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8b820, metalness: 0.75, roughness: 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x121216, metalness: 0.6, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2830, metalness: 0.4, roughness: 0.1 });
  // low wedge body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 4.4), paint);
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.26, 1.2), paint);
  nose.position.set(0, 0.42, -2.5);
  nose.rotation.x = 0.06;
  g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 1.8), glass);
  cabin.position.set(0, 0.9, 0.1);
  cabin.rotation.x = -0.08;
  g.add(cabin);
  const engineCover = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.3), paint);
  engineCover.position.set(0, 0.72, 1.5);
  g.add(engineCover);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), dark);
  wing.position.set(0, 1.05, 2.1);
  g.add(wing);
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.1), dark);
    strut.position.set(s * 0.6, 0.9, 2.1);
    g.add(strut);
    // wheels
    for (const wz of [-1.55, 1.55]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(s * 0.95, 0.42, wz);
      g.add(wheel);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10),
        new THREE.MeshStandardMaterial({ color: 0xc8a742, metalness: 0.9, roughness: 0.2 }));
      rim.rotation.z = Math.PI / 2;
      rim.position.set(s * 0.95, 0.42, wz);
      g.add(rim);
      g.userData.wheels.push(wheel, rim);
    }
    // headlights
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xfff8d8, emissive: 0xfff0b0, emissiveIntensity: 1.4 }));
    hl.position.set(s * 0.6, 0.52, -3.06);
    g.add(hl);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2020, emissiveIntensity: 1.2 }));
  tail.position.set(0, 0.7, 2.22);
  g.add(tail);
  return g;
}
