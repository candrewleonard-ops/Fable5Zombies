import * as THREE from 'three';
import { makeGlowSprite } from './effects.js';
import { audio } from './audio.js';

// BLACKROCK NUCLEAR FACILITY — an abandoned complex north-east of the bunker.
// Spinning waste barrels, a giant RESEARCH FACILITY hall, and THE SPECIMEN:
// a monstrous spider asleep on the ceiling. It wakes when the power comes on,
// unlocks when you shoot its eyes, seals the hall, and fights in phases —
// skittering wall-jumps, acid spit volleys, pounces, and gas-shrouded
// nukelings that latch onto your head (mash F to rip them off).

const FX = 150, FZ = -150;      // facility center
const HALL = 19;                 // hall half-size
const HALL_H = 13;

export function buildFacility(scene, world, effects, player) {
  const { solid, boxMesh, makeTex } = world;
  const MAT = world.materials;
  const concrete = MAT.wall;
  const rust = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, metalness: 0.5, roughness: 0.7 });
  const goo = new THREE.MeshStandardMaterial({ color: 0x1a3a10, emissive: 0x54ff3a, emissiveIntensity: 0.9, roughness: 0.4 });

  // ---------- approach track from the bunker ----------
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x3c352a, roughness: 1 });
  {
    const from = new THREE.Vector2(24, -24), to = new THREE.Vector2(FX - 14, FZ + 26);
    const dirLen = from.distanceTo(to);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(dirLen, 4.5), dirtMat);
    track.rotation.x = -Math.PI / 2;
    track.rotation.z = Math.atan2(to.y - from.y, to.x - from.x);
    track.position.set((from.x + to.x) / 2, 0.003, (from.y + to.y) / 2);
    scene.add(track);
  }

  // ---------- yard: fence + barrels + sign ----------
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const px = FX + Math.cos(a) * 34, pz = FZ + Math.sin(a) * 34;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), rust);
    post.position.set(px, 1.3, pz);
    post.rotation.z = (Math.random() - 0.5) * 0.16;
    scene.add(post);
  }
  const barrels = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 9;
    const bx = FX + Math.cos(a) * r, bz = FZ + Math.sin(a) * r;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.15, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a4a1c, metalness: 0.4, roughness: 0.6 }));
    b.position.set(bx, 0.575, bz);
    b.rotation.z = Math.random() < 0.3 ? Math.PI / 2 : 0;
    b.castShadow = true;
    scene.add(b);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.18, 12), goo);
    band.position.set(bx, 0.62, bz);
    band.rotation.copy(b.rotation);
    scene.add(band);
    solid(bx - 0.45, bx + 0.45, 0, 1.15, bz - 0.45, bz + 0.45);
    barrels.push({ mesh: b, band, spin: 0.1 + Math.random() * 0.3 }); // subtle ominous spin
    if (i === 0) { // one shared sickly glow (light budget)
      const glow = new THREE.PointLight(0x54ff3a, 10, 14, 1.6);
      glow.position.set(bx, 2, bz);
      scene.add(glow);
      world.bulbs.push({ light: glow, base: 10, seed: Math.random() * 10 });
    }
  }
  { // broken gate sign
    const sTex = makeTex(512, 128, (g, w, h) => {
      g.fillStyle = '#c8b830'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#141410'; g.font = 'bold 44px Arial'; g.textAlign = 'center';
      g.fillText('☢ BLACKROCK NUCLEAR FACILITY', w / 2, 58);
      g.font = '26px Arial';
      g.fillText('AUTHORIZED PERSONNEL ONLY — SITE CONDEMNED', w / 2, 100);
      for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(40,30,10,0.5)'; g.fillRect(Math.random() * w, Math.random() * h, 8, 3); }
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: sTex }));
    sign.position.set(FX, 2.6, FZ + 33.9);
    sign.rotation.y = 0;
    sign.rotation.z = -0.05;
    scene.add(sign);
    for (const s of [-3.2, 3.2]) boxMesh(0.16, 3.4, 0.16, rust, FX + s, 1.7, FZ + 34);
  }

  // ---------- RESEARCH FACILITY hall ----------
  // walls with a south entrance (blast door seals it during the fight)
  const T = 0.6;
  const doorW = 3.2;
  // south wall segments
  boxMesh(HALL - doorW / 2, HALL_H, T, concrete, FX - (HALL + doorW / 2) / 2, HALL_H / 2, FZ + HALL);
  boxMesh(HALL - doorW / 2, HALL_H, T, concrete, FX + (HALL + doorW / 2) / 2, HALL_H / 2, FZ + HALL);
  boxMesh(doorW, HALL_H - 3.4, T, concrete, FX, 3.4 + (HALL_H - 3.4) / 2, FZ + HALL); // lintel
  boxMesh(HALL * 2, HALL_H, T, concrete, FX, HALL_H / 2, FZ - HALL);
  boxMesh(T, HALL_H, HALL * 2, concrete, FX - HALL, HALL_H / 2, FZ);
  boxMesh(T, HALL_H, HALL * 2, concrete, FX + HALL, HALL_H / 2, FZ);
  // roof + floor
  boxMesh(HALL * 2 + 1, 0.5, HALL * 2 + 1, MAT.ceil, FX, HALL_H + 0.25, FZ);
  const floorM = new THREE.Mesh(new THREE.BoxGeometry(HALL * 2, 0.12, HALL * 2), MAT.floor);
  floorM.position.set(FX, 0.06, FZ);
  floorM.receiveShadow = true;
  scene.add(floorM);
  solid(FX - HALL, FX + HALL, -0.06, 0.12, FZ - HALL, FZ + HALL);
  // big painted title
  const titleTex = makeTex(1024, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(200,190,160,0.85)'; g.font = 'bold 86px Arial'; g.textAlign = 'center';
    g.fillText('RESEARCH FACILITY', w / 2, 92);
  });
  const title = new THREE.Mesh(new THREE.PlaneGeometry(22, 2.75), new THREE.MeshBasicMaterial({ map: titleTex, transparent: true }));
  title.position.set(FX, 9.2, FZ - HALL + T / 2 + 0.02);
  scene.add(title);
  // interior dressing: vats, consoles, catwalk beams, flicker lights
  [[FX - 13, FZ - 12], [FX - 9, FZ - 13.5], [FX + 12, FZ - 11]].forEach(([vx, vz], vi) => {
    const vat = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.6, 14),
      new THREE.MeshStandardMaterial({ color: 0x28303a, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.85 }));
    vat.position.set(vx, 1.8, vz);
    vat.castShadow = true;
    scene.add(vat);
    solid(vx - 1.3, vx + 1.3, 0, 3.6, vz - 1.3, vz + 1.3);
    const juice = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12), goo);
    juice.position.set(vx, 1.5, vz);
    scene.add(juice);
    if (vi === 0) {
      const glow = new THREE.PointLight(0x54ff3a, 12, 14, 1.6);
      glow.position.set(vx, 3.6, vz);
      scene.add(glow);
      world.bulbs.push({ light: glow, base: 12, seed: Math.random() * 10 });
    }
  });
  for (let i = 0; i < 4; i++) {
    boxMesh(2.4, 1.1, 0.9, rust, FX - 12 + i * 7, 0.55, FZ + 13, {});
  }
  for (let x = -14; x <= 14; x += 7) boxMesh(0.4, 0.4, HALL * 2 - 1, MAT.metal, FX + x, HALL_H - 1.2, FZ, { solid: false });
  const flicker = new THREE.PointLight(0xcfe0d0, 20, 34, 1.4);
  flicker.position.set(FX, HALL_H - 2, FZ);
  scene.add(flicker);
  world.bulbs.push({ light: flicker, base: 20, seed: 1.1 });
  const flicker2 = new THREE.PointLight(0x9fffa0, 14, 26, 1.5);
  flicker2.position.set(FX - 10, 7, FZ + 8);
  scene.add(flicker2);
  world.bulbs.push({ light: flicker2, base: 14, seed: 4.2 });

  // avionics rack behind the specimen (spawns the pickup after the kill)
  boxMesh(2.2, 2.6, 0.8, MAT.metal, FX, 1.3, FZ - HALL + 1.2);
  world.mkNote(FX + 2.2, 1.1, FZ - HALL + 1.6, 'RESEARCH LOG 44',
    'Avionics rack sealed behind the specimen. Restoring site power WILL wake it. If it opens its eyes, shoot them and pray. God forgive us.');

  // blast door (slides down to seal the hall during the fight)
  const blastDoor = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.4, 3.6, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5a4a20, metalness: 0.7, roughness: 0.4 }));
  blastDoor.position.set(FX, -2.0, FZ + HALL); // hidden below floor
  scene.add(blastDoor);
  let doorSolid = null;

  // ---------- THE SPECIMEN ----------
  const boss = buildSpecimen();
  boss.group.position.set(FX, HALL_H - 1.1, FZ);
  scene.add(boss.group);
  // hanging thread
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0xcfd0c0, roughness: 0.9 }));
  thread.position.set(FX, HALL_H - 0.4, FZ);
  scene.add(thread);

  const S = {
    state: 'asleep',      // asleep → stirring (power on) → fight → dead
    hp: 1, maxHp: 1,
    pos: boss.group.position,
    group: boss.group, parts: boss,
    anchors: [],          // skitter targets on walls/floor
    phase: 'skitter', phaseT: 0, hopT: 0, hopFrom: null, hopTo: null, hopDur: 0.001,
    spitT: 0, nukeT: 6, slamCd: 0,
    nukelings: [],
    spits: [],
    dead: false, started: false,
    eyeHits: 0,
    radius: 2.2,
  };
  // anchor points: wall mounts + floor spots
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    S.anchors.push(new THREE.Vector3(FX + Math.cos(a) * (HALL - 3.5), 3.5 + Math.random() * 6, FZ + Math.sin(a) * (HALL - 3.5)));
  }
  for (let i = 0; i < 6; i++) {
    S.anchors.push(new THREE.Vector3(FX + (Math.random() - 0.5) * (HALL * 1.5), 0.8, FZ + (Math.random() - 0.5) * (HALL * 1.5)));
  }

  function buildSpecimen() {
    const chitin = new THREE.MeshStandardMaterial({ color: 0x1c2416, metalness: 0.3, roughness: 0.55 });
    const belly = new THREE.MeshStandardMaterial({ color: 0x2c3a1a, emissive: 0x3aff2a, emissiveIntensity: 0.25, roughness: 0.6 });
    const g = new THREE.Group();
    const meshes = [];
    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 12), chitin);
    abdomen.scale.set(1, 0.85, 1.25);
    abdomen.position.z = 1.3;
    abdomen.castShadow = true;
    g.add(abdomen); meshes.push(abdomen);
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), belly);
    thorax.position.z = -0.6;
    thorax.castShadow = true;
    g.add(thorax); meshes.push(thorax);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), chitin);
    head.position.set(0, 0.05, -1.55);
    g.add(head); meshes.push(head);
    // 6 eyes — the wake-up locks
    const eyes = [];
    const eyeMat = () => new THREE.MeshStandardMaterial({ color: 0x1a0505, emissive: 0xff2020, emissiveIntensity: 0.15 });
    for (const [ex, ey, r] of [[-0.3, 0.15, 0.11], [0.3, 0.15, 0.11], [-0.14, 0.28, 0.09], [0.14, 0.28, 0.09], [-0.2, 0.0, 0.07], [0.2, 0.0, 0.07]]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), eyeMat());
      eye.position.set(ex, ey + 0.05, -2.05);
      eye.userData.isEye = true;
      g.add(eye);
      eyes.push(eye);
      meshes.push(eye);
    }
    // fangs
    for (const s of [-1, 1]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), belly);
      fang.position.set(s * 0.22, -0.4, -1.8);
      fang.rotation.x = Math.PI;
      g.add(fang);
    }
    // 8 legs: 2-segment
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const t = (i % 4) / 3;
      const hip = new THREE.Group();
      hip.position.set(side * 0.8, 0.2, -1.1 + t * 2.2);
      const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.4, 7), chitin);
      femur.position.set(side * 1.0, 0.6, 0);
      femur.rotation.z = side * -0.9;
      femur.castShadow = true;
      hip.add(femur);
      const knee = new THREE.Group();
      knee.position.set(side * 2.0, 1.15, 0);
      const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 2.6, 7), chitin);
      tibia.position.set(side * 0.5, -1.1, 0);
      tibia.rotation.z = side * 0.5;
      tibia.castShadow = true;
      knee.add(tibia);
      hip.add(knee);
      g.add(hip);
      legs.push({ hip, knee, side, t });
      meshes.push(femur, tibia);
    }
    for (const m of meshes) m.userData.specimen = true;
    return { group: g, eyes, legs, meshes, abdomen, thorax };
  }

  // curl asleep pose
  for (const leg of boss.legs) leg.hip.rotation.z = leg.side * 0.9;
  boss.group.rotation.x = 0.15;

  const raycaster = new THREE.Raycaster();

  const facility = {
    center: new THREE.Vector3(FX, 0, FZ),
    boss: S,
    onDrops: null,        // (pos) => main spawns bricks + radio + avionics
    onMessage: null,
    onMilestone: null,

    // weapons integration
    raycast(origin, dir, maxDist) {
      const targets = [];
      if (!S.dead && S.state !== 'asleep') targets.push(S.group);
      if (S.state === 'asleep' || S.state === 'stirring') targets.push(S.group); // eyes shootable while waking
      for (const n of S.nukelings) if (!n.dead && !n.latched) targets.push(n.group);
      if (!targets.length) return null;
      raycaster.set(origin, dir);
      raycaster.far = maxDist;
      const hits = raycaster.intersectObjects(targets, true);
      for (const h of hits) {
        if (h.object.userData.isEye) return { mob: { kind: 'eye', eye: h.object }, point: h.point.clone() };
        if (h.object.userData.specimen) return { mob: { kind: 'specimen' }, point: h.point.clone() };
        if (h.object.userData.nukeling) return { mob: { kind: 'nukeling', nk: h.object.userData.nukeling }, point: h.point.clone() };
      }
      return null;
    },

    damage(mob, dmg, point, dir) {
      if (mob.kind === 'eye') {
        if (S.state === 'stirring' && !mob.eye.userData.shot) {
          mob.eye.userData.shot = true;
          mob.eye.material.emissiveIntensity = 2.6;
          mob.eye.material.color.setHex(0xff2020);
          S.eyeHits++;
          audio.spiderHiss();
          effects.sparksColored(point, 0xff3030);
          facility.onMessage?.(`An eye snaps open… (${S.eyeHits}/2)`);
          if (S.eyeHits >= 2) startFight();
        } else if (S.state === 'fight') {
          hurtBoss(dmg * 1.8, point, dir); // eyes stay weak points
        }
        return;
      }
      if (mob.kind === 'specimen') {
        if (S.state === 'fight') hurtBoss(dmg, point, dir);
        else effects.sparksColored(point, 0x54ff3a);
        return;
      }
      if (mob.kind === 'nukeling') hurtNukeling(mob.nk, dmg, point);
    },

    blast(at, radius, dmg) {
      if (S.state === 'fight' && !S.dead && S.pos.distanceTo(at) < radius + S.radius) {
        hurtBoss(dmg, S.pos.clone().setY(S.pos.y + 1), null);
      }
      for (const n of S.nukelings) {
        if (!n.dead && !n.latched && n.pos.distanceTo(at) < radius) hurtNukeling(n, dmg, n.pos.clone());
      }
    },

    powerOn() {
      if (S.state !== 'asleep') return;
      S.state = 'stirring';
      for (const eye of boss.eyes) eye.material.emissiveIntensity = 0.9;
      flicker.intensity = 34;
      audio.spiderHiss();
      facility.onMessage?.('Something stirs in the Research Facility…');
    },

    latchedCount: () => S.nukelings.filter((n) => n.latched && !n.dead).length,
    shakeOne() {
      const n = S.nukelings.find((n) => n.latched && !n.dead);
      if (!n) return false;
      hurtNukeling(n, 9999, player.pos.clone().setY(player.pos.y + 1.5));
      return true;
    },

    update, barrels,
  };

  function hurtBoss(dmg, point, dir) {
    if (S.dead) return;
    S.hp -= dmg;
    effects.blood(point || S.pos.clone(), dir || new THREE.Vector3(0, 1, 0), 8, 4, 0);
    effects.damageNumber(point || S.pos.clone(), dmg, false);
    if (S.hp <= 0) killBoss();
  }

  function startFight() {
    S.state = 'fight';
    S.started = true;
    S.maxHp = 46000;
    S.hp = S.maxHp;
    scene.remove(thread);
    // seal the hall
    blastDoor.position.y = 1.8;
    doorSolid = solid(FX - doorW / 2 - 0.2, FX + doorW / 2 + 0.2, 0, 3.6, FZ + HALL - 0.25, FZ + HALL + 0.25);
    // drop to the floor
    S.hopFrom = S.pos.clone();
    S.hopTo = new THREE.Vector3(FX, 0.8, FZ);
    S.hopT = 0; S.hopDur = 0.9;
    S.phase = 'skitter';
    S.phaseT = 6;
    for (const eye of boss.eyes) { eye.material.emissiveIntensity = 2.6; }
    audio.bossRoar();
    facility.onMessage?.('☣ THE SPECIMEN AWAKENS ☣');
  }

  function killBoss() {
    S.dead = true;
    S.state = 'dead';
    audio.bossRoar();
    effects.explosion(S.pos.clone().setY(S.pos.y + 1), 0x54ff3a, 8);
    // unseal
    blastDoor.position.y = -2.0;
    if (doorSolid) {
      const i = world.colliders.indexOf(doorSolid);
      if (i >= 0) world.colliders.splice(i, 1);
      const j = world.shotSolids.indexOf(doorSolid);
      if (j >= 0) world.shotSolids.splice(j, 1);
    }
    for (const n of S.nukelings) if (!n.dead) hurtNukeling(n, 9999, n.pos.clone());
    // death slump
    S.group.rotation.z = 0.6;
    S.group.position.y = 0.6;
    facility.onDrops?.(S.pos.clone());
    facility.onMilestone?.('spider');
  }

  // ---------- nukelings ----------
  function spawnNukeling() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2c3a1a, emissive: 0x54ff3a, emissiveIntensity: 0.5, roughness: 0.6 }));
    body.scale.y = 0.7;
    g.add(body);
    for (let i = 0; i < 6; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.4, 5), body.material);
      const a = (i / 6) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.3, -0.12, Math.sin(a) * 0.3);
      leg.rotation.z = Math.cos(a) * 1.1;
      leg.rotation.x = Math.sin(a) * 1.1;
      g.add(leg);
    }
    // gas shroud sprite
    const gasTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
      grad.addColorStop(0, 'rgba(120,255,90,0.5)');
      grad.addColorStop(1, 'rgba(120,255,90,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const gas = new THREE.Sprite(new THREE.SpriteMaterial({ map: gasTex, transparent: true, opacity: 0.8, depthWrite: false }));
    gas.scale.set(1.4, 1.4, 1);
    g.add(gas);
    const spawnAt = S.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3));
    g.position.copy(spawnAt);
    scene.add(g);
    const nk = {
      group: g, pos: g.position, dead: false, latched: false, hp: 90,
      state: 'scuttle', leapAt: 3 + Math.random() * 5, vel: new THREE.Vector3(), t: Math.random() * 9,
    };
    for (const o of g.children) o.userData.nukeling = nk;
    S.nukelings.push(nk);
  }

  function hurtNukeling(nk, dmg, point) {
    if (nk.dead) return;
    nk.hp -= dmg;
    effects.sparksColored(point, 0x54ff3a);
    if (nk.hp <= 0) {
      nk.dead = true;
      if (nk.latched) player.latchedGas = Math.max(0, (player.latchedGas || 0) - 1);
      effects.explosion(nk.pos.clone(), 0x54ff3a, 1.2);
      scene.remove(nk.group);
    }
  }

  // ---------- spit projectiles ----------
  function spit() {
    const from = S.pos.clone().setY(S.pos.y + 0.8);
    const target = player.pos.clone().setY(player.pos.y + 1.2);
    const dir = target.sub(from).normalize();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x54ff3a }));
    mesh.position.copy(from);
    mesh.add(makeGlowSprite(0x54ff3a, 1.1));
    scene.add(mesh);
    S.spits.push({ mesh, vel: dir.multiplyScalar(20).add(new THREE.Vector3((Math.random() - 0.5) * 2.5, 1.6, (Math.random() - 0.5) * 2.5)), life: 4 });
    audio.spit();
  }

  // ---------- per-frame ----------
  function update(dt) {
    for (const b of barrels) { b.mesh.rotation.y += b.spin * dt; b.band.rotation.y += b.spin * dt; }
    if (S.state === 'asleep' || S.state === 'stirring') {
      // gentle breathing
      const t = performance.now() * 0.001;
      boss.abdomen.scale.setScalar(1 + Math.sin(t * 1.4) * 0.03);
      boss.abdomen.scale.z = 1.25;
      boss.abdomen.scale.y = 0.85;
      return;
    }
    if (S.dead) return;

    // ----- fight -----
    S.phaseT -= dt;
    const toPlayer = player.pos.clone().sub(S.pos);
    const distP = Math.hypot(toPlayer.x, toPlayer.z);

    // face the player
    const want = Math.atan2(toPlayer.x, toPlayer.z) + Math.PI;
    let dyaw = want - S.group.rotation.y;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    S.group.rotation.y += dyaw * Math.min(1, dt * 4);

    // hop movement (used by all phases)
    if (S.hopTo) {
      S.hopT += dt / S.hopDur;
      const k = Math.min(1, S.hopT);
      S.pos.lerpVectors(S.hopFrom, S.hopTo, k);
      S.pos.y += Math.sin(k * Math.PI) * 3.2;
      // leg scramble
      const t = performance.now() * 0.02;
      boss.legs.forEach((leg, i) => { leg.hip.rotation.x = Math.sin(t + i) * 0.5; });
      if (k >= 1) {
        S.pos.copy(S.hopTo);
        S.hopTo = null;
        audio.spiderLand();
        effects.sparksColored(S.pos.clone(), 0x54ff3a);
        // pounce landing damage
        if (S.phase === 'pounce' && !player.dead) {
          const d = Math.hypot(player.pos.x - S.pos.x, player.pos.z - S.pos.z);
          if (d < 4.2 && Math.abs(player.pos.y - S.pos.y) < 2.5) {
            player.takeDamage(38);
            const away = new THREE.Vector3(player.pos.x - S.pos.x, 0, player.pos.z - S.pos.z).normalize();
            player.vel.x += away.x * 11;
            player.vel.z += away.z * 11;
            player.vel.y += 4;
          }
          effects.explosion(S.pos.clone(), 0x54ff3a, 4);
        }
      }
    } else {
      // idle leg twitch
      const t = performance.now() * 0.004;
      boss.legs.forEach((leg, i) => { leg.hip.rotation.x = Math.sin(t + i * 1.2) * 0.12; });
      // contact damage
      if (distP < 3 && Math.abs(player.pos.y - S.pos.y) < 2.4 && !player.dead) {
        S.slamCd -= dt;
        if (S.slamCd <= 0) {
          S.slamCd = 1.6;
          player.takeDamage(30);
          audio.spiderHiss();
        }
      }
    }

    // phase logic
    if (S.phaseT <= 0) {
      const roll = Math.random();
      const enraged = S.hp < S.maxHp * 0.4;
      S.phase = roll < (enraged ? 0.3 : 0.45) ? 'skitter' : roll < 0.75 ? 'spit' : 'pounce';
      S.phaseT = S.phase === 'skitter' ? 4.5 : S.phase === 'spit' ? 3.6 : 3;
      if (enraged) S.phaseT *= 0.7;
      if (S.phase === 'spit') S.spitT = 0.2;
    }
    if (S.phase === 'skitter' && !S.hopTo && Math.random() < dt * 1.6) {
      S.hopFrom = S.pos.clone();
      S.hopTo = S.anchors[Math.floor(Math.random() * S.anchors.length)].clone();
      S.hopT = 0;
      S.hopDur = 0.55 + Math.random() * 0.3;
    }
    if (S.phase === 'spit' && !S.hopTo) {
      S.spitT -= dt;
      if (S.spitT <= 0) { S.spitT = 0.42; spit(); }
    }
    if (S.phase === 'pounce' && !S.hopTo && Math.random() < dt * 2.2) {
      S.hopFrom = S.pos.clone();
      S.hopTo = player.pos.clone();
      S.hopT = 0;
      S.hopDur = 0.6;
      audio.spiderHiss();
    }

    // nukelings spawn
    S.nukeT -= dt;
    const aliveNk = S.nukelings.filter((n) => !n.dead).length;
    if (S.nukeT <= 0 && aliveNk < 4) {
      S.nukeT = 7 + Math.random() * 4;
      spawnNukeling();
      spawnNukeling();
    }

    // spit projectiles fly
    for (let i = S.spits.length - 1; i >= 0; i--) {
      const sp = S.spits[i];
      sp.life -= dt;
      sp.vel.y -= 8 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      const d = sp.mesh.position.distanceTo(player.pos.clone().setY(player.pos.y + 1.2));
      if (d < 0.9 && !player.dead) {
        player.takeDamage(16);
        effects.sparksColored(sp.mesh.position, 0x54ff3a);
        sp.life = 0;
      }
      if (sp.mesh.position.y < 0.1) {
        effects.sparksColored(sp.mesh.position, 0x54ff3a);
        sp.life = 0;
      }
      if (sp.life <= 0) { scene.remove(sp.mesh); S.spits.splice(i, 1); }
    }

    // nukelings AI
    for (const nk of S.nukelings) {
      if (nk.dead) continue;
      nk.t += dt;
      if (nk.latched) {
        // riding the player's head — handled by main (vision blur + DoT)
        nk.pos.set(player.pos.x, player.pos.y + 1.75, player.pos.z);
        nk.group.rotation.y += dt * 3;
        continue;
      }
      if (nk.state === 'leap') {
        nk.vel.y -= 14 * dt;
        nk.pos.addScaledVector(nk.vel, dt);
        const d = nk.pos.distanceTo(player.pos.clone().setY(player.pos.y + 1.5));
        if (d < 0.8 && !player.dead) {
          nk.latched = true;
          player.latchedGas = (player.latchedGas || 0) + 1;
          audio.spiderHiss();
        } else if (nk.pos.y <= 0.25) {
          nk.pos.y = 0.25;
          nk.state = 'scuttle';
          nk.leapAt = 3 + Math.random() * 5;
        }
      } else {
        const to = player.pos.clone().sub(nk.pos).setY(0);
        const d = to.length();
        to.normalize();
        nk.pos.addScaledVector(to, 3.4 * dt);
        nk.pos.y = 0.25 + Math.abs(Math.sin(nk.t * 9)) * 0.12;
        nk.group.rotation.y = Math.atan2(to.x, to.z);
        // leap from a RANDOM distance
        if (d < nk.leapAt && !player.dead) {
          nk.state = 'leap';
          const jump = player.pos.clone().setY(player.pos.y + 1.6).sub(nk.pos);
          const t = Math.max(0.4, d / 9);
          nk.vel.copy(jump.multiplyScalar(1 / t));
          nk.vel.y += 3;
        }
      }
      nk.group.position.copy(nk.pos);
    }

    S.group.position.copy(S.pos);
  }

  return facility;
}
