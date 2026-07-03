import * as THREE from 'three';
import { makeMaterial } from './items.js';
import { audio } from './audio.js';

// Minecraft-style harvestables (trees outside, ore veins in the mines) hit
// with the pickaxe-axe, plus cows that wander the meadow and drop beef+leather.

export class Harvest {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.nodes = [];
  }

  register(node) { // { pos, radius, hp, maxHp, kind, color, group, onBreak, respawn }
    node.maxHp = node.hp;
    this.nodes.push(node);
    return node;
  }

  // ray vs node spheres — nearest hit within maxDist
  hitTest(origin, dir, maxDist = 3.4) {
    let best = null, bt = maxDist;
    for (const n of this.nodes) {
      if (n.broken) continue;
      const to = n.pos.clone().sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > bt) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(n.pos) < n.radius) { bt = t; best = n; }
    }
    return best;
  }

  chip(node) {
    if (node.broken) return false;
    node.hp--;
    audio.chip(node.kind === 'tree');
    this.effects.sparksColored(node.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5)), node.color);
    // flinch
    node.group.rotation.z = (Math.random() - 0.5) * 0.06;
    setTimeout(() => { if (node.group) node.group.rotation.z = 0; }, 90);
    if (node.hp <= 0) {
      node.broken = true;
      node.group.visible = false;
      if (node.onBreak) node.onBreak(node);
      if (node.respawn) {
        node.timer = node.respawn;
      }
      return true;
    }
    return false;
  }

  update(dt) {
    for (const n of this.nodes) {
      if (n.broken && n.respawn) {
        n.timer -= dt;
        if (n.timer <= 0) {
          n.broken = false;
          n.hp = n.maxHp;
          n.group.visible = true;
          n.group.scale.setScalar(0.3);
        }
      }
      if (!n.broken && n.group.visible && n.group.scale.x < 1) {
        n.group.scale.setScalar(Math.min(1, n.group.scale.x + dt * 0.8));
      }
    }
  }
}

// blocky tree: trunk cubes + leaf canopy
export function plantTree(scene, harvest, drops, x, z, big = false) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x54381e, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5226, roughness: 0.95 });
  const g = new THREE.Group();
  const h = big ? 3.6 : 2.8;
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.55), trunkMat);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const canopy = new THREE.Group();
  const S = big ? 1.1 : 0.9;
  for (const [cx, cy, cz] of [[0, 0, 0], [S, 0, 0], [-S, 0, 0], [0, 0, S], [0, 0, -S], [0, S, 0], [S * 0.6, S * 0.7, S * 0.6], [-S * 0.6, S * 0.7, -S * 0.6]]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(S * 1.15, S * 1.15, S * 1.15), leafMat);
    leaf.position.set(cx, cy, cz);
    leaf.castShadow = true;
    canopy.add(leaf);
  }
  canopy.position.y = h + S * 0.4;
  g.add(canopy);
  g.position.set(x, 0, z);
  scene.add(g);
  harvest.register({
    pos: new THREE.Vector3(x, 1.3, z), radius: 1.0, hp: big ? 5 : 4,
    kind: 'tree', color: 0xa8742a, group: g, respawn: 80,
    onBreak: () => {
      drops.spawnItem(new THREE.Vector3(x, 0.1, z), makeMaterial('wood', big ? 5 : 3), 0xd8a45a);
      audio.treeFall();
    },
  });
  return g;
}

// ---------------- cows ----------------

function makeCowBody() {
  const hide = new THREE.MeshStandardMaterial({ color: 0x6e4a33, roughness: 0.95 });
  const patch = new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 0.9 });
  const g = new THREE.Group();
  const meshes = [];
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.62, 1.25), hide);
  body.position.y = 0.78;
  body.castShadow = true;
  g.add(body); meshes.push(body);
  for (const [px, py, pz, s] of [[0.2, 0.9, 0.3, 0.3], [-0.25, 0.75, -0.35, 0.36]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(s, s, s * 1.2), patch);
    p.position.set(px, py, pz);
    g.add(p); meshes.push(p);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), hide);
  head.position.set(0, 1.05, -0.82);
  g.add(head); meshes.push(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.14), patch);
  snout.position.set(0, 0.92, -1.06);
  g.add(snout); meshes.push(snout);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 5), patch);
    horn.position.set(s * 0.22, 1.3, -0.82);
    g.add(horn);
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.05), hide);
    ear.position.set(s * 0.26, 1.16, -0.78);
    g.add(ear);
  }
  const legs = [];
  for (const [lx, lz] of [[-0.26, 0.42], [0.26, 0.42], [-0.26, -0.42], [0.26, -0.42]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), dark);
    leg.position.set(lx, 0.25, lz);
    g.add(leg); meshes.push(leg);
    legs.push(leg);
  }
  return { group: g, meshes, legs };
}

export class Mobs {
  constructor(scene, effects, drops) {
    this.scene = scene;
    this.effects = effects;
    this.drops = drops;
    this.list = [];
    this.raycaster = new THREE.Raycaster();
  }

  spawnCow(x, z) {
    const body = makeCowBody();
    body.group.position.set(x, 0, z);
    this.scene.add(body.group);
    const cow = {
      kind: 'cow', pos: new THREE.Vector3(x, 0, z), home: new THREE.Vector3(x, 0, z),
      hp: 70, dead: false, group: body.group, legs: body.legs,
      state: 'graze', t: Math.random() * 4, dir: Math.random() * Math.PI * 2,
      fleeT: 0, deadT: 0,
    };
    for (const m of body.meshes) m.userData.mob = cow;
    this.list.push(cow);
    return cow;
  }

  raycast(origin, dir, maxDist) {
    const targets = this.list.filter((m) => !m.dead).map((m) => m.group);
    if (!targets.length) return null;
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      const mob = h.object.userData.mob;
      if (mob && !mob.dead) return { mob, point: h.point.clone() };
    }
    return null;
  }

  damage(mob, dmg, point, dir) {
    if (mob.dead) return;
    mob.hp -= dmg;
    this.effects.blood(point, dir || new THREE.Vector3(0, 0.5, 0), 8, 4, 0);
    this.effects.damageNumber(point, dmg, false);
    mob.state = 'flee';
    mob.fleeT = 3;
    mob.dir = Math.atan2(mob.pos.x - point.x, mob.pos.z - point.z);
    audio.cowMoo(true);
    if (mob.hp <= 0) {
      mob.dead = true;
      mob.deadT = 0;
      const at = mob.pos.clone().setY(0.2);
      this.drops.spawnItem(at.clone(), makeMaterial('beef', 2 + (Math.random() * 2 | 0)), 0xd05a4a);
      this.drops.spawnItem(at.clone().add(new THREE.Vector3(0.5, 0, 0.3)), makeMaterial('leather', 1 + (Math.random() * 2 | 0)), 0xb48c5a);
      this.effects.bloodDecal(mob.pos.x, mob.pos.z, 0.03, 1.1);
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      if (m.dead) {
        m.deadT += dt;
        m.group.rotation.z = Math.min(Math.PI / 2, m.deadT * 3);
        if (m.deadT > 6) {
          m.group.position.y -= dt * 0.3;
          if (m.deadT > 8) {
            this.scene.remove(m.group);
            this.list.splice(i, 1);
            // respawn a fresh cow near home after a while
            setTimeout(() => this.spawnCow(m.home.x + (Math.random() - 0.5) * 8, m.home.z + (Math.random() - 0.5) * 8), 40000);
          }
        }
        continue;
      }
      m.t -= dt;
      if (m.state === 'flee') {
        m.fleeT -= dt;
        if (m.fleeT <= 0) m.state = 'graze';
      }
      if (m.t <= 0) {
        m.t = 2 + Math.random() * 4;
        if (m.state !== 'flee') {
          m.state = Math.random() < 0.55 ? 'graze' : 'walk';
          m.dir = Math.atan2(m.home.x - m.pos.x, m.home.z - m.pos.z) + (Math.random() - 0.5) * 2.4;
        }
      }
      const spd = m.state === 'flee' ? 4.2 : m.state === 'walk' ? 1.1 : 0;
      if (spd > 0) {
        m.pos.x += Math.sin(m.dir) * spd * dt;
        m.pos.z += Math.cos(m.dir) * spd * dt;
        m.group.rotation.y = m.dir + Math.PI;
        const ph = performance.now() * 0.008 * (m.state === 'flee' ? 2 : 1);
        m.legs.forEach((l, li) => { l.rotation.x = Math.sin(ph + li * Math.PI / 2) * 0.5; });
      } else {
        m.legs.forEach((l) => { l.rotation.x *= 0.9; });
        m.group.rotation.x = Math.sin(m.t * 2) * 0.02; // grazing nod
      }
      m.group.position.set(m.pos.x, 0, m.pos.z);
      if (Math.random() < dt * 0.02) audio.cowMoo(false);
    }
  }
}
