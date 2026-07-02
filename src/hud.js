// DOM HUD: bars, ammo, wave banners, hitmarkers, killfeed, toasts.

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      healthFill: $('health-fill'), healthNum: $('health-num'),
      armorFill: $('armor-fill'), armorNum: $('armor-num'),
      ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'),
      weaponName: $('weapon-name'), reloadHint: $('reload-hint'),
      waveNum: $('wave-num'), zombiesLeft: $('zombies-left'), points: $('points'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'),
      damageFlash: $('damage-flash'), slowmoTint: $('slowmo-tint'),
      killfeed: $('killfeed'), waveBanner: $('wave-banner'),
      pickupToast: $('pickup-toast'),
    };
    this._hitTimer = null;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setHealth(hp, max) {
    this.el.healthFill.style.width = (hp / max * 100) + '%';
    this.el.healthNum.textContent = Math.ceil(hp);
    this.el.healthFill.style.background = hp < 30
      ? 'linear-gradient(90deg,#8a1111,#ff3b3b)'
      : 'linear-gradient(90deg,#4caf50,#9dff57)';
  }

  setArmor(armor, max) {
    this.el.armorFill.style.width = max > 0 ? (armor / max * 100) + '%' : '0%';
    this.el.armorNum.textContent = Math.ceil(armor);
  }

  setWeapon(item, def, reloading) {
    if (!item || !def) {
      this.el.weaponName.textContent = 'UNARMED';
      this.el.ammoMag.textContent = '-';
      this.el.ammoReserve.textContent = '-';
      this.el.reloadHint.classList.remove('show');
      return;
    }
    this.el.weaponName.textContent = def.name;
    this.el.ammoMag.textContent = reloading ? '••' : item.mag;
    this.el.ammoMag.classList.toggle('low', item.mag <= Math.ceil(def.magSize * 0.25) && !reloading);
    this.el.ammoReserve.textContent = item.reserve;
    this.el.reloadHint.classList.toggle('show', item.mag === 0 && item.reserve > 0 && !reloading);
  }

  setWave(n) { this.el.waveNum.textContent = n; }
  setZombiesLeft(n) { this.el.zombiesLeft.textContent = n; }
  setPoints(p) { this.el.points.textContent = p; }

  setCrosshairSpread(px, ads) {
    this.el.crosshair.style.setProperty('--spread', px + 'px');
    this.el.crosshair.classList.toggle('ads', !!ads);
  }

  hitmarker(kill = false) {
    const el = this.el.hitmarker;
    el.classList.toggle('kill', kill);
    el.classList.add('show');
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => el.classList.remove('show'), kill ? 220 : 90);
  }

  damageFlash(strength = 1) {
    const el = this.el.damageFlash;
    el.style.transition = 'none';
    el.style.opacity = Math.min(1, 0.5 + strength * 0.4);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.6s ease-out';
      el.style.opacity = 0;
    });
  }

  slowmo(on) { this.el.slowmoTint.style.opacity = on ? 1 : 0; }

  killfeed(text) {
    const entry = document.createElement('div');
    entry.className = 'kf-entry';
    entry.textContent = text;
    this.el.killfeed.prepend(entry);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => entry.remove(), 4200);
  }

  waveBanner(text, gold = false) {
    const el = this.el.waveBanner;
    el.textContent = text;
    el.classList.toggle('gold', gold);
    el.classList.remove('hidden');
    // restart the CSS animation
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    this.el.pickupToast.appendChild(t);
    while (this.el.pickupToast.children.length > 4) this.el.pickupToast.firstChild.remove();
    setTimeout(() => t.remove(), 2300);
  }
}
