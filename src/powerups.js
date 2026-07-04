import * as THREE from 'three';
import { POWERUPS } from './items.js';
import { makeGlowSprite } from './effects.js';
import { audio } from './audio.js';

// Classic CoD-zombies powerup drops: spinning glowing pickups that despawn.
// Insta-Kill (20s), Max Ammo (full refill), Berserker (30s beast mode).

function makePowerupMesh(key) {
  const def = POWERUPS[key];
  const g = new THREE.Group();
  let core;
  if (key === 'insta') {
    // skull-ish: white cube head + eye holes
    core = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xe8e4da, emissive: 0xe8e4da, emissiveIntensity: 0.35, roughness: 0.5 }));
    core.add(head);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a }));
      eye.position.set(s * 0.08, 0.05, 0.14);
      core.add(eye);
    }
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.24),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c4 }));
    jaw.position.y = -0.28;
    core.add(jaw);
  } else if (key === 'maxammo') {
    core = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2e3a26, emissive: 0x4a6a2a, emissiveIntensity: 0.4, roughness: 0.6 }));
    core.add(crate);
    for (let i = 0; i < 3; i++) {
      const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8),
        new THREE.MeshStandardMaterial({ color: 0xc8a742, metalness: 0.9, roughness: 0.3 }));
      bullet.position.set(-0.1 + i * 0.1, 0.24, 0);
      core.add(bullet);
    }
  } else if (key === 'double') {
    // ×2 coin
    core = new THREE.Group();
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: 0xc8a742, emissive: 0xf7d774, emissiveIntensity: 0.6, metalness: 0.85, roughness: 0.25 }));
    coin.rotation.x = Math.PI / 2;
    core.add(coin);
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x3a2c10 }));
      bar.rotation.z = s * 0.5;
      bar.position.set(s * 0.05, 0, 0.05);
      core.add(bar);
    }
  } else if (key === 'carpenter') {
    // hammer
    core = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2a, emissive: 0xd8a45a, emissiveIntensity: 0.25, roughness: 0.8 }));
    core.add(handle);
    const headM = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x565a63, emissive: 0xd8a45a, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.3 }));
    headM.position.y = 0.26;
    core.add(headM);
  } else {
    // berserker: flexing arm silhouette — bicep + fist
    core = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a1040, emissive: 0xff2a90, emissiveIntensity: 0.8, roughness: 0.4 });
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.36, 10), mat);
    upper.rotation.z = 1.1;
    core.add(upper);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.34, 10), mat);
    fore.rotation.z = -0.9;
    fore.position.set(0.16, 0.2, 0);
    core.add(fore);
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), mat);
    fist.position.set(0.28, 0.38, 0);
    core.add(fist);
  }
  g.add(core);
  const glowSprite = makeGlowSprite(def.color, 1.8);
  glowSprite.position.y = 0.1;
  g.add(glowSprite);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.02, 8, 24),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g.add(halo);
  return g;
}

export class Powerups {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.drops = [];
    this.onTake = null; // (key) => apply effect (main)
  }

  maybeDrop(pos, mult = 1) {
    // ~3% per kill, weighted; vulture perk passes mult 2
    if (Math.random() > 0.03 * mult) return;
    const roll = Math.random();
    const key = roll < 0.28 ? 'insta'
      : roll < 0.5 ? 'maxammo'
      : roll < 0.72 ? 'double'
      : roll < 0.86 ? 'carpenter'
      : 'berserker';
    this.spawn(pos, key);
  }

  spawn(pos, key) {
    const group = makePowerupMesh(key);
    group.position.copy(pos).setY(pos.y + 0.7);
    this.scene.add(group);
    this.drops.push({ group, key, t: 0, life: 25 });
  }

  update(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      d.life -= dt;
      d.group.rotation.y += dt * 2.4;
      d.group.position.y += Math.sin(d.t * 2.6) * 0.004;
      // blink when about to vanish
      d.group.visible = d.life > 6 || (d.life * 5 | 0) % 2 === 0;
      const dist = d.group.position.distanceTo(this.player.pos.clone().setY(this.player.pos.y + 0.8));
      if (dist < 1.3 && !this.player.dead) {
        audio.powerup();
        if (this.onTake) this.onTake(d.key);
        this._remove(i);
        continue;
      }
      if (d.life <= 0) this._remove(i);
    }
  }

  _remove(i) {
    const d = this.drops[i];
    this.scene.remove(d.group);
    d.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.drops.splice(i, 1);
  }
}
