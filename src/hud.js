import { ECON } from './items.js';

// Undead Bunker HUD (digests/game.md + html_hud.md): gothic round counter,
// points feed, prompt, gold messages, perk badges, fuel/armor bars.

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      round: $('round'), pointsVal: $('pointsVal'), pointsFeed: $('pointsFeed'),
      weaponName: $('weaponName'), ammo: $('ammo'), reloadHint: $('reloadHint'),
      perksRow: $('perksRow'), fuelWrap: $('fuelWrap'), fuelFill: $('fuelFill'),
      armorWrap: $('armorWrap'), armorFill: $('armorFill'),
      prompt: $('prompt'), msg: $('msg'), waveBanner: $('waveBanner'),
      bloodOverlay: $('bloodOverlay'), hitmarker: $('hitmarker'),
    };
    this._msgTimer = null;
    this._hitTimer = null;
    this._lastPrompt = null;
    this.hurtFlash = 0;
  }

  show() { this.el.hud.style.display = 'block'; }
  hide() { this.el.hud.style.display = 'none'; }

  setRound(r) { this.el.round.textContent = r; }

  banner(text) {
    const el = this.el.waveBanner;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  setPoints(p) { this.el.pointsVal.textContent = p; }

  feed(n) {
    const div = document.createElement('div');
    div.className = 'pf' + (n < 0 ? ' neg' : '');
    div.textContent = (n > 0 ? '+' : '') + n;
    this.el.pointsFeed.appendChild(div);
    setTimeout(() => div.remove(), 1000);
    while (this.el.pointsFeed.children.length > 6) this.el.pointsFeed.firstChild.remove();
  }

  setWeapon(item, def, reloading) {
    if (!item || !def) {
      this.el.weaponName.textContent = item ? item.name : '';
      this.el.weaponName.classList.remove('pap');
      this.el.ammo.innerHTML = item?.kind === 'tool' && item.build
        ? `<span class="res">50 pts · LMB place · RMB remove</span>`
        : item?.id === 'carKeys' ? `<span class="res">LMB deploy · F drive</span>` : '';
      this.el.reloadHint.classList.remove('show');
      return;
    }
    this.el.weaponName.textContent = def.name;
    this.el.weaponName.classList.toggle('pap', !!item.pap);
    this.el.ammo.innerHTML = `${reloading ? '••' : item.mag} <span class="res">/ ${item.reserve}</span>`;
    this.el.ammo.classList.toggle('low', item.mag <= Math.max(2, def.mag * 0.25) && !reloading);
    this.el.reloadHint.classList.toggle('show', item.mag === 0 && item.reserve > 0 && !reloading);
  }

  perkHUD(perks) {
    this.el.perksRow.innerHTML = '';
    for (const key of perks) {
      const p = ECON.perks[key];
      if (!p) continue;
      const div = document.createElement('div');
      div.className = 'perkIcon';
      const css = '#' + p.color.toString(16).padStart(6, '0');
      div.style.background = `radial-gradient(circle at 35% 30%, ${css}, #100a08 130%)`;
      div.textContent = p.badge;
      div.title = `${p.name} — ${p.desc}`;
      this.el.perksRow.appendChild(div);
    }
  }

  setPrompt(html) {
    if (html === this._lastPrompt) return;
    this._lastPrompt = html;
    if (!html) { this.el.prompt.style.display = 'none'; return; }
    this.el.prompt.style.display = 'block';
    this.el.prompt.innerHTML = html;
  }

  showMsg(text) {
    this.el.msg.textContent = text;
    this.el.msg.style.opacity = 1;
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => { this.el.msg.style.opacity = 0; }, 1800);
  }

  hitmarker(head) {
    const el = this.el.hitmarker;
    el.classList.toggle('head', !!head);
    el.classList.add('show');
    clearTimeout(this._hitTimer);
    this._hitTimer = setTimeout(() => el.classList.remove('show'), 70);
  }

  damageFlash() { this.hurtFlash = 0.6; }

  updateHealthFx(hp, maxHp, dt) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.2);
    const v = Math.min(1, Math.max(0, (1 - hp / maxHp) * 1.05 - 0.05) + this.hurtFlash);
    this.el.bloodOverlay.style.opacity = v;
  }

  updateFuel(hasJetpack, fuel) {
    this.el.fuelWrap.style.display = hasJetpack ? 'flex' : 'none';
    if (hasJetpack) {
      this.el.fuelFill.style.height = Math.round(fuel) + '%';
      this.el.fuelFill.style.background = fuel < 25 ? '#c8401e' : '#3fa7c8';
    }
  }

  updateArmor(armor, maxArmor) {
    this.el.armorWrap.style.display = maxArmor > 0 ? 'flex' : 'none';
    if (maxArmor > 0) this.el.armorFill.style.height = Math.round(armor / maxArmor * 100) + '%';
  }
}
