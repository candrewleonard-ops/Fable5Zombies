import * as THREE from 'three';
import { WEAPONS } from './items.js';
import { raycastColliders } from './physics.js';
import { audio } from './audio.js';

// Viewmodel + hitscan shooting. Ammo lives ON the inventory item
// (item.mag / item.reserve) so weapons keep their state when stashed.

const HIP_POS = new THREE.Vector3(0.3, -0.28, -0.55);
const ADS_POS = new THREE.Vector3(0, -0.205, -0.42);

function buildGunModel(key) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.75, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17181c, metalness: 0.6, roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.8 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    g.add(m); return m;
  };

  switch (key) {
    case 'pistol':
      add(new THREE.BoxGeometry(0.05, 0.09, 0.26), metal, 0, 0.02, -0.05);
      add(new THREE.BoxGeometry(0.045, 0.14, 0.07), dark, 0, -0.08, 0.05, 0.18);
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), dark, 0, 0.03, -0.2, Math.PI / 2);
      break;
    case 'smg':
      add(new THREE.BoxGeometry(0.06, 0.1, 0.46), metal, 0, 0.02, -0.08);
      add(new THREE.BoxGeometry(0.05, 0.2, 0.06), dark, 0, -0.1, -0.04, 0.1);
      add(new THREE.BoxGeometry(0.045, 0.12, 0.06), dark, 0, -0.07, 0.12, 0.25);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 10), dark, 0, 0.035, -0.38, Math.PI / 2);
      add(new THREE.BoxGeometry(0.04, 0.05, 0.18), dark, 0, 0.09, -0.02); // sight rail
      break;
    case 'shotgun':
      add(new THREE.CylinderGeometry(0.024, 0.024, 0.62, 10), metal, 0, 0.045, -0.2, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 10), dark, 0, 0.0, -0.16, Math.PI / 2);
      add(new THREE.BoxGeometry(0.055, 0.07, 0.16), wood, 0, 0.0, 0.03, 0, 0, 0);
      add(new THREE.BoxGeometry(0.05, 0.05, 0.14), wood, 0, -0.005, -0.28); // pump
      add(new THREE.BoxGeometry(0.05, 0.16, 0.09), wood, 0, -0.09, 0.12, 0.35);
      break;
    case 'revolver':
      add(new THREE.CylinderGeometry(0.017, 0.017, 0.34, 8), metal, 0, 0.045, -0.15, Math.PI / 2);
      add(new THREE.BoxGeometry(0.045, 0.06, 0.2), metal, 0, 0.03, 0.0);
      add(new THREE.CylinderGeometry(0.038, 0.038, 0.07, 8), dark, 0, 0.028, -0.02, 0, 0, Math.PI / 2);
      add(new THREE.BoxGeometry(0.04, 0.13, 0.06), wood, 0, -0.07, 0.08, 0.3);
      break;
  }

  // muzzle marker (invisible) — flash + tracer origin
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.03, key === 'smg' ? -0.5 : key === 'shotgun' ? -0.54 : -0.28);
  muzzle.name = 'muzzle';
  g.add(muzzle);
  return g;
}

export class WeaponSystem {
  constructor(camera, player, world, effects) {
    this.camera = camera;
    this.player = player;
    this.world = world;
    this.effects = effects;

    this.root = new THREE.Group();      // holds the active viewmodel
    camera.add(this.root);

    this.models = {};
    for (const key of Object.keys(WEAPONS)) {
      const model = buildGunModel(key);
      model.visible = false;
      this.root.add(model);
      this.models[key] = model;
    }

    // soft fill so the viewmodel reads at night
    const fill = new THREE.PointLight(0xcfd8e8, 1.1, 2.2, 1.6);
    fill.position.set(0.25, -0.1, -0.35);
    camera.add(fill);

    // muzzle flash
    this.flashLight = new THREE.PointLight(0xffb347, 0, 9, 2);
    camera.parent ? camera.add(this.flashLight) : null;
    this.flashLight.position.set(0, 0, -0.7);
    camera.add(this.flashLight);
    const flashTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,240,190,1)');
      grad.addColorStop(0.4, 'rgba(255,170,60,0.8)');
      grad.addColorStop(1, 'rgba(255,120,20,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTex, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending,
    }));
    this.flashSprite.scale.set(0.25, 0.25, 1);
    this.root.add(this.flashSprite);

    this.item = null;           // active inventory weapon item
    this.def = null;
    this.model = null;

    this.cooldown = 0;
    this.reloading = 0;
    this.triggerHeld = false;
    this.raiseAnim = 0;         // 0..1 raise progress
    this.kickBack = 0;
    this.swayX = 0; this.swayY = 0;
    this.spreadBloom = 0;

    this.onShot = null;         // hook set by main (hud updates)
    this.onKillCredit = null;
  }

  // Equip an inventory weapon item (or null for empty hands).
  equip(item) {
    if (this.item === item) return;
    if (this.model) this.model.visible = false;
    this.item = item;
    this.reloading = 0;
    this.triggerHeld = false;
    if (!item) { this.def = null; this.model = null; return; }
    if (item.mag === undefined) {
      item.mag = WEAPONS[item.weaponKey].magSize;
      item.reserve = WEAPONS[item.weaponKey].startingReserve;
    }
    this.def = WEAPONS[item.weaponKey];
    this.model = this.models[item.weaponKey];
    this.model.visible = true;
    this.raiseAnim = 0;
    audio.equip();
  }

  triggerDown(zombies) {
    this.triggerHeld = true;
    this._tryFire(zombies);
  }

  triggerUp() { this.triggerHeld = false; }

  startReload() {
    if (!this.item || this.reloading > 0) return;
    if (this.item.mag >= this.def.magSize || this.item.reserve <= 0) return;
    this.reloading = this.def.reloadTime;
    audio.reload();
  }

  addReserve(amount) {
    if (!this.item) return false;
    this.item.reserve += amount;
    return true;
  }

  _tryFire(zombies) {
    if (!this.item || this.player.dead) return;
    if (this.cooldown > 0 || this.reloading > 0 || this.raiseAnim < 0.55) return;
    if (this.item.mag <= 0) {
      audio.dryFire();
      this.startReload();
      return;
    }

    this.item.mag--;
    this.cooldown = 1 / this.def.fireRate;
    audio.shoot(this.def.sound);

    // recoil + viewmodel kick + bloom
    this.player.recoilPitch += this.def.recoil * (0.85 + Math.random() * 0.3);
    this.player.shake = Math.min(0.6, this.player.shake + this.def.kick * 0.6);
    this.kickBack = 1;
    this.spreadBloom = Math.min(1, this.spreadBloom + 0.35);

    // muzzle flash
    this.flashLight.intensity = 26;
    const muzzle = this.model.getObjectByName('muzzle');
    const muzzleWorld = muzzle.getWorldPosition(new THREE.Vector3());
    this.flashSprite.position.copy(this.root.worldToLocal(muzzleWorld.clone()));
    this.flashSprite.material.opacity = 1;
    this.flashSprite.material.rotation = Math.random() * Math.PI * 2;
    this.effects.smoke(muzzleWorld, 2);

    // casing
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
    this.effects.casing(muzzleWorld, right, this.player.pos.y);

    // hitscan per pellet
    const origin = this.player.eyePosition();
    const baseDir = this.player.eyeDirection();
    const spread = (this.player.ads ? this.def.adsSpread : this.def.spread) * (1 + this.spreadBloom * 1.6);

    for (let p = 0; p < this.def.pellets; p++) {
      const dir = baseDir.clone();
      dir.x += (Math.random() - 0.5) * 2 * spread;
      dir.y += (Math.random() - 0.5) * 2 * spread;
      dir.z += (Math.random() - 0.5) * 2 * spread;
      dir.normalize();

      const wallT = raycastColliders(this.world.colliders, origin, dir, this.def.range);
      const zHit = zombies.raycast(origin, dir, Math.min(this.def.range, wallT));

      let end;
      if (zHit) {
        end = zHit.point;
        const dmg = this.def.damage * (zHit.part === 'head' ? this.def.headshotMult : zHit.part === 'legs' ? 0.75 : 1);
        zombies.damage(zHit.zombie, dmg, zHit.part, dir, zHit.point, this);
      } else if (wallT < this.def.range) {
        end = origin.clone().addScaledVector(dir, wallT);
        this.effects.sparks(end);
      } else {
        end = origin.clone().addScaledVector(dir, this.def.range);
      }
      this.effects.tracer(muzzleWorld, end, this.def.tracer);
    }

    if (this.onShot) this.onShot();
    if (this.item.mag === 0) this.startReload();
  }

  update(dt, zombies, mouseDelta) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 1.8);

    if (this.reloading > 0 && this.item) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        const need = this.def.magSize - this.item.mag;
        const take = Math.min(need, this.item.reserve);
        this.item.mag += take;
        this.item.reserve -= take;
      }
    }

    if (this.triggerHeld && this.def?.auto) this._tryFire(zombies);

    // flash decay
    this.flashLight.intensity *= Math.exp(-30 * dt);
    this.flashSprite.material.opacity *= Math.exp(-26 * dt);

    if (!this.model) return;
    this.raiseAnim = Math.min(1, this.raiseAnim + dt * 4.5);
    this.kickBack *= Math.exp(-11 * dt);

    // mouse sway (viewmodel lags the camera slightly)
    const k = 1 - Math.exp(-10 * dt);
    this.swayX += (THREE.MathUtils.clamp(-mouseDelta.x * 0.0012, -0.03, 0.03) - this.swayX) * k;
    this.swayY += (THREE.MathUtils.clamp(mouseDelta.y * 0.0012, -0.03, 0.03) - this.swayY) * k;

    // hip/ads blend
    const adsBlend = this.player.ads && this.reloading <= 0 ? 1 : 0;
    this._adsCur = (this._adsCur ?? 0) + (adsBlend - (this._adsCur ?? 0)) * Math.min(1, 12 * dt);
    const basePos = HIP_POS.clone().lerp(ADS_POS, this._adsCur);

    // bob
    const bob = this.player.bobAmp;
    const ph = this.player.bobPhase;
    basePos.x += Math.sin(ph) * 0.012 * bob * (1 - this._adsCur);
    basePos.y += Math.abs(Math.cos(ph)) * 0.014 * bob * (1 - this._adsCur) - (1 - this.raiseAnim) * 0.35;
    basePos.z += this.kickBack * this.def.kick * 0.9;

    this.root.position.copy(basePos);
    this.root.position.x += this.swayX;
    this.root.position.y += this.swayY;
    this.root.rotation.set(
      this.kickBack * this.def.kick * 1.6 + this.swayY * 1.2 + (1 - this.raiseAnim) * 0.7,
      this.swayX * 1.4,
      this.swayX * 0.6
    );

    // reload dip
    if (this.reloading > 0) {
      const t = 1 - this.reloading / this.def.reloadTime;
      const dip = Math.sin(Math.min(1, t * 1.15) * Math.PI);
      this.root.position.y -= dip * 0.22;
      this.root.rotation.x -= dip * 0.5;
      this.root.rotation.z += dip * 0.3;
    }
  }

  crosshairSpread() {
    if (!this.def) return 6;
    const move = Math.hypot(this.player.vel.x, this.player.vel.z) / 5.4;
    const base = (this.player.ads ? this.def.adsSpread : this.def.spread) * 900;
    return 4 + base * (1 + this.spreadBloom * 1.6 + move * 0.7);
  }
}
