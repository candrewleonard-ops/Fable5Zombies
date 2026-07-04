import * as THREE from 'three';
import { makeGlowSprite } from './effects.js';
import { audio } from './audio.js';

// Explosive red barrels — shoot one and the corner goes up. Nearby barrels
// chain with a short fuse delay. They respawn a couple of rounds later.

const SPOTS = [
  [12.6, -6.8], [-24.6, -0.2], [7.2, 12.6],      // bunker rooms
  [-30.5, 20.5], [-11, 32.6],                    // campsite
  [24, 2.5], [58, 9.5],                          // road east
  [-13, 39],                                     // by the mine shack
  [452, -8], [468, 12],                          // village plaza edges
  [138, -131],                                   // facility yard
];

export class Barrels {
  constructor(scene, world, effects) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.list = [];
    this.fuses = [];   // chained barrels waiting to blow
    this.raycaster = new THREE.Raycaster();
    this.onBlast = null; // (center, radius, dmg) — main wires zombie/boss/player damage
    for (const [x, z] of SPOTS) this._spawn(x, z);
  }

  _spawn(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 14),
      new THREE.MeshStandardMaterial({ color: 0x9e1b1b, metalness: 0.45, roughness: 0.5 }));
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.16, 14),
      new THREE.MeshStandardMaterial({ color: 0xe8d84a, roughness: 0.6 }));
    stripe.position.y = 0.72;
    g.add(stripe);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ map: hazardTex(), transparent: true }));
    mark.position.set(0, 0.42, 0.425);
    g.add(mark);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const solid = { minX: x - 0.42, maxX: x + 0.42, minY: 0, maxY: 1.1, minZ: z - 0.42, maxZ: z + 0.42 };
    this.world.colliders.push(solid);
    this.world.shotSolids.push(solid);
    const barrel = { group: g, pos: new THREE.Vector3(x, 0.55, z), solid, dead: false, respawnT: 0, home: [x, z] };
    for (const o of g.children) o.userData.barrel = barrel;
    this.list.push(barrel);
    return barrel;
  }

  raycast(origin, dir, maxDist) {
    const targets = this.list.filter((b) => !b.dead).map((b) => b.group);
    if (!targets.length) return null;
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      const b = h.object.userData.barrel;
      if (b && !b.dead) return { mob: { kind: 'barrel', b }, point: h.point.clone() };
    }
    return null;
  }

  damage(mob) { this.explode(mob.b); }

  explode(b) {
    if (b.dead) return;
    b.dead = true;
    b.respawnT = 60;
    b.group.visible = false;
    const ci = this.world.colliders.indexOf(b.solid);
    if (ci >= 0) this.world.colliders.splice(ci, 1);
    const si = this.world.shotSolids.indexOf(b.solid);
    if (si >= 0) this.world.shotSolids.splice(si, 1);
    this.effects.explosion(b.pos.clone(), 0xff7a1a, 5);
    audio.explosion();
    this.onBlast?.(b.pos.clone(), 4.8, 650);
    // chain nearby barrels on a short fuse
    for (const other of this.list) {
      if (other.dead || other === b) continue;
      if (other.pos.distanceTo(b.pos) < 6.5 && !this.fuses.some((f) => f.b === other)) {
        this.fuses.push({ b: other, t: 0.28 + Math.random() * 0.2 });
      }
    }
  }

  // blast from any other explosion can set barrels off too
  checkBlast(center, radius) {
    for (const b of this.list) {
      if (b.dead) continue;
      if (b.pos.distanceTo(center) < radius + 0.6 && !this.fuses.some((f) => f.b === b)) {
        this.fuses.push({ b, t: 0.2 });
      }
    }
  }

  update(dt) {
    for (let i = this.fuses.length - 1; i >= 0; i--) {
      const f = this.fuses[i];
      f.t -= dt;
      if (f.t <= 0) {
        this.fuses.splice(i, 1);
        this.explode(f.b);
      }
    }
    for (const b of this.list) {
      if (!b.dead) continue;
      b.respawnT -= dt;
      if (b.respawnT <= 0) {
        b.dead = false;
        b.group.visible = true;
        this.world.colliders.push(b.solid);
        this.world.shotSolids.push(b.solid);
      }
    }
  }
}

let _hazardTex = null;
function hazardTex() {
  if (_hazardTex) return _hazardTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e8d84a';
  g.beginPath(); g.moveTo(32, 6); g.lineTo(58, 54); g.lineTo(6, 54); g.closePath(); g.fill();
  g.fillStyle = '#141410';
  g.font = 'bold 34px Arial'; g.textAlign = 'center';
  g.fillText('!', 32, 48);
  _hazardTex = new THREE.CanvasTexture(c);
  return _hazardTex;
}
