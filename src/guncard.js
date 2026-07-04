import * as THREE from 'three';
import { GRADES, weaponDef, WEAPONS, enchantLabel } from './items.js';
import { buildGunModel, makeRayGunMesh } from './weapons.js';
import { makeGlowSprite } from './effects.js';

// Borderlands-2-style dropped weapons: guns lie in the world under a colored
// rarity beam, hovering near one pops the stat card, F picks it up.

export function gunCardHTML(item) {
  const def = weaponDef(item);
  const grade = GRADES[item.grade || WEAPONS[item.weaponKey]?.grade || 'common'];
  const acc = Math.max(4, Math.min(98, Math.round((1 - def.spread * 52) * 100)));
  const fr = (def.rpm / 60).toFixed(1);
  const rl = def.reload.toFixed(1);
  const dmg = Math.round(def.dmg) * (def.pellets > 1 ? 1 : 1);
  const bar = (v, max) => {
    const pct = Math.max(3, Math.min(100, (v / max) * 100));
    return `<span class="gc-bar"><span style="width:${pct}%"></span></span>`;
  };
  const redLines = [];
  if (def.desc2) redLines.push(def.desc2);
  if (def.pellets > 1) redLines.push(`Fires ${def.pellets} projectiles per shot.`);
  if (item.nuclear) redLines.push('Leaves toxic waste that melts the horde.');
  if (item.custom?.fusedNames) redLines.push(`Fusion of ${item.custom.fusedNames}.`);
  if (item.ench?.length) redLines.push('Enchanted: ' + item.ench.map(enchantLabel).join(', '));
  return `
    <div class="gc-head" style="background:${grade.css}22;border-color:${grade.css}">
      <div class="gc-name" style="color:${grade.css}">${def.name}</div>
      <div class="gc-type">Level Requirement: ${grade.name}</div>
    </div>
    <div class="gc-body">
      <div class="gc-row"><span class="gc-ico">▣</span><span class="gc-label">Damage</span><b>${dmg}${def.pellets > 1 ? '×' + def.pellets : ''}</b>${bar(def.dmg * (def.pellets || 1), 1600)}</div>
      <div class="gc-row"><span class="gc-ico">◎</span><span class="gc-label">Accuracy</span><b>${acc}.${(item.weaponKey.length * 7) % 10}</b>${bar(acc, 100)}</div>
      <div class="gc-row"><span class="gc-ico">✦</span><span class="gc-label">Fire Rate</span><b>${fr}</b>${bar(def.rpm, 900)}</div>
      <div class="gc-row"><span class="gc-ico">↻</span><span class="gc-label">Reload Speed</span><b>${rl}</b>${bar(6 - def.reload, 6)}</div>
      <div class="gc-row"><span class="gc-ico">▤</span><span class="gc-label">Magazine Size</span><b>${def.flame ? '∞' : def.mag}</b>${bar(def.mag, 80)}</div>
      ${redLines.map((l) => `<div class="gc-red">• ${l}</div>`).join('')}
      <div class="gc-maker">${grade.name.toUpperCase()} · UNDEAD BUNKER ARMS</div>
    </div>`;
}

export class GroundGuns {
  constructor(scene) {
    this.scene = scene;
    this.entries = [];
    this.cardEl = document.getElementById('gunCard');
    this.shownFor = null;
  }

  spawn(pos, item, throwDir = null) {
    const grade = GRADES[item.grade || 'common'];
    const group = new THREE.Group();
    let model = null;
    if (item.weaponKey === 'raygun') model = makeRayGunMesh();
    if (!model) model = buildGunModel(item.weaponKey);
    model.scale.setScalar(1.5);
    model.position.y = 0.35;
    model.rotation.z = 0.5;
    group.add(model);
    // rarity beam
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.16, 3.2, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: grade.glow, transparent: true, opacity: 0.33, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    beam.position.y = 1.6;
    group.add(beam);
    const glowSprite = makeGlowSprite(grade.glow, 1.6);
    glowSprite.position.y = 0.45;
    group.add(glowSprite);
    group.position.copy(pos);
    this.scene.add(group);
    const entry = {
      group, item, t: Math.random() * 9, life: 120,
      vel: throwDir ? throwDir.clone().multiplyScalar(3.2).setY(2.4) : null,
    };
    this.entries.push(entry);
    return entry;
  }

  nearest(playerPos, maxDist = 2.4) {
    let best = null, bd = maxDist;
    for (const e of this.entries) {
      const d = e.group.position.distanceTo(playerPos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  take(entry) {
    const i = this.entries.indexOf(entry);
    if (i < 0) return null;
    this.scene.remove(entry.group);
    this.entries.splice(i, 1);
    if (this.shownFor === entry) this.hideCard();
    return entry.item;
  }

  showCard(entry) {
    if (this.shownFor === entry) return;
    this.shownFor = entry;
    this.cardEl.innerHTML = gunCardHTML(entry.item);
    this.cardEl.style.display = 'block';
  }

  hideCard() {
    this.shownFor = null;
    this.cardEl.style.display = 'none';
  }

  update(dt, playerPos, groundYFn) {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      e.t += dt;
      e.life -= dt;
      // small toss arc when dropped from inventory
      if (e.vel) {
        e.vel.y -= 12 * dt;
        e.group.position.addScaledVector(e.vel, dt);
        const gy = groundYFn ? groundYFn(e.group.position) : 0;
        if (e.group.position.y <= gy) { e.group.position.y = gy; e.vel = null; }
      }
      const model = e.group.children[0];
      model.rotation.y += dt * 1.4;
      model.position.y = 0.35 + Math.sin(e.t * 2.2) * 0.05;
      if (e.life <= 0) {
        this.scene.remove(e.group);
        this.entries.splice(i, 1);
        if (this.shownFor === e) this.hideCard();
      }
    }
    // card visibility maintained by main via nearest()
  }
}
