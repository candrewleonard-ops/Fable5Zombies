import { ARMOR_TIERS } from './items.js';
import { Paperdoll } from './paperdoll.js';
import { audio } from './audio.js';

// Minecraft-style inventory, opened with T. Click to pick up / place / swap,
// right-click armor to equip, right-click medkit to use. Armor slots + a live
// 3D paperdoll whose head follows the cursor.

const GRID_SIZE = 27;
const HOTBAR_SIZE = 5;
const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots'];

export class Inventory {
  constructor(player, callbacks = {}) {
    this.player = player;
    this.cb = callbacks; // { onLoadoutChange, onClose }

    this.grid = new Array(GRID_SIZE).fill(null);
    this.hotbar = new Array(HOTBAR_SIZE).fill(null);
    this.armor = { helmet: null, chest: null, legs: null, boots: null };
    this.selected = 0;
    this.carried = null;
    this.openFlag = false;

    this.screen = document.getElementById('inventory-screen');
    this.gridEl = document.getElementById('inv-grid');
    this.hotbarRowEl = document.getElementById('inv-hotbar-row');
    this.hudHotbarEl = document.getElementById('hotbar');
    this.ghostEl = document.getElementById('drag-ghost');
    this.tooltipEl = document.getElementById('item-tooltip');

    this.paperdoll = new Paperdoll(document.getElementById('paperdoll'));

    this._buildSlots();
    this._bindEvents();
    this.renderAll();
  }

  // ---------- DOM ----------
  _buildSlots() {
    for (let i = 0; i < GRID_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.container = 'grid';
      el.dataset.index = i;
      this.gridEl.appendChild(el);
    }
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.container = 'hotbar';
      el.dataset.index = i;
      this.hotbarRowEl.appendChild(el);
      // HUD mirror
      const hud = document.createElement('div');
      hud.className = 'hb-slot';
      hud.innerHTML = `<span class="hb-key">${i + 1}</span>`;
      this.hudHotbarEl.appendChild(hud);
    }
    for (const el of document.querySelectorAll('.armor-slot')) {
      el.dataset.container = 'armor';
      el.dataset.index = el.dataset.armor;
    }
  }

  _bindEvents() {
    this.screen.addEventListener('mousedown', (e) => {
      const slot = e.target.closest('.slot');
      if (!slot) return;
      e.preventDefault();
      this._clickSlot(slot.dataset.container, slot.dataset.index, e.button === 2);
    });
    this.screen.addEventListener('contextmenu', (e) => e.preventDefault());

    this.screen.addEventListener('mousemove', (e) => {
      this.cursor = { x: e.clientX, y: e.clientY };
      this.ghostEl.style.left = e.clientX + 'px';
      this.ghostEl.style.top = e.clientY + 'px';
      this.paperdoll.onCursor(e.clientX, e.clientY);
      this._updateTooltip(e);
    });
  }

  _get(container, index) {
    if (container === 'grid') return this.grid[index];
    if (container === 'hotbar') return this.hotbar[index];
    return this.armor[index];
  }

  _set(container, index, item) {
    if (container === 'grid') this.grid[index] = item;
    else if (container === 'hotbar') this.hotbar[index] = item;
    else this.armor[index] = item;
  }

  _clickSlot(container, index, rightClick) {
    const cur = this._get(container, index);

    if (rightClick && !this.carried) {
      if (cur?.kind === 'armor' && container !== 'armor') { this._equipArmor(container, index); return; }
      if (cur?.kind === 'medkit') { this._useMedkitFromSlot(container, index); return; }
      return;
    }

    if (!this.carried) {
      if (!cur) return;
      // picking up equipped armor removes its protection
      if (container === 'armor') this._applyArmorDelta(-cur.armor);
      this.carried = cur;
      this._set(container, index, null);
    } else {
      // validation: armor slots only take matching armor
      if (container === 'armor' && !(this.carried.kind === 'armor' && this.carried.armorSlot === index)) return;

      if (cur && cur.id === this.carried.id && cur.stack > 1) {
        // merge stacks
        const space = cur.stack - cur.count;
        const move = Math.min(space, this.carried.count);
        cur.count += move;
        this.carried.count -= move;
        if (this.carried.count <= 0) this.carried = null;
      } else {
        if (cur && container === 'armor') this._applyArmorDelta(-cur.armor);
        this._set(container, index, this.carried);
        if (container === 'armor') this._applyArmorDelta(this.carried.armor);
        this.carried = cur; // swap (or null)
      }
      audio.equip();
    }
    this._afterChange();
  }

  _equipArmor(container, index) {
    const item = this._get(container, index);
    const slot = item.armorSlot;
    const prev = this.armor[slot];
    this.armor[slot] = item;
    this._set(container, index, prev || null);
    if (prev) this._applyArmorDelta(-prev.armor);
    this._applyArmorDelta(item.armor);
    audio.equip();
    this._afterChange();
  }

  _useMedkitFromSlot(container, index) {
    const item = this._get(container, index);
    if (!this.player.heal(50)) return;
    item.count--;
    if (item.count <= 0) this._set(container, index, null);
    this._afterChange();
  }

  _applyArmorDelta(delta) {
    const max = this.totalArmorPoints();
    this.player.maxArmor = max;
    this.player.armor = Math.max(0, Math.min(max, this.player.armor + delta));
  }

  totalArmorPoints() {
    return ARMOR_SLOTS.reduce((sum, s) => sum + (this.armor[s]?.armor || 0), 0);
  }

  _afterChange() {
    this.renderAll();
    this.paperdoll.setArmor(this.armor);
    if (this.cb.onLoadoutChange) this.cb.onLoadoutChange();
  }

  // ---------- public API ----------
  addItem(item) {
    // stackables merge first
    if (item.stack > 1) {
      for (const arr of [this.grid, this.hotbar]) {
        for (const it of arr) {
          if (it && it.id === item.id && it.count < it.stack) {
            const move = Math.min(it.stack - it.count, item.count);
            it.count += move;
            item.count -= move;
            if (item.count <= 0) { this._afterChange(); return true; }
          }
        }
      }
    }
    // weapons prefer an empty hotbar slot
    if (item.kind === 'weapon') {
      const h = this.hotbar.indexOf(null);
      if (h !== -1) { this.hotbar[h] = item; this._afterChange(); return true; }
    }
    const g = this.grid.indexOf(null);
    if (g !== -1) { this.grid[g] = item; this._afterChange(); return true; }
    if (item.kind !== 'weapon') {
      const h = this.hotbar.indexOf(null);
      if (h !== -1) { this.hotbar[h] = item; this._afterChange(); return true; }
    }
    return false; // full
  }

  selectSlot(i) {
    this.selected = i;
    this.renderAll();
    if (this.cb.onLoadoutChange) this.cb.onLoadoutChange();
  }

  selectedItem() { return this.hotbar[this.selected]; }

  selectedWeapon() {
    const it = this.hotbar[this.selected];
    return it?.kind === 'weapon' ? it : null;
  }

  useMedkitQuick() {
    for (const arr of [this.hotbar, this.grid]) {
      for (let i = 0; i < arr.length; i++) {
        if (arr[i]?.kind === 'medkit') {
          if (!this.player.heal(50)) return false;
          arr[i].count--;
          if (arr[i].count <= 0) arr[i] = null;
          this._afterChange();
          return true;
        }
      }
    }
    return false;
  }

  toggle() { this.openFlag ? this.close() : this.open(); }

  open() {
    this.openFlag = true;
    this.screen.classList.remove('hidden');
    this.paperdoll.setArmor(this.armor);
    this.renderAll();
  }

  close() {
    this.openFlag = false;
    // drop carried item back into any free slot
    if (this.carried) {
      const item = this.carried;
      this.carried = null;
      this.addItem(item);
    }
    this.screen.classList.add('hidden');
    this.tooltipEl.classList.add('hidden');
    this.ghostEl.classList.add('hidden');
    if (this.cb.onClose) this.cb.onClose();
  }

  get isOpen() { return this.openFlag; }

  update(dt) {
    if (!this.openFlag) return;
    this.paperdoll.update(dt);
    // stats panel
    document.getElementById('inv-hp').textContent = Math.ceil(this.player.health);
    document.getElementById('inv-armor').textContent = Math.ceil(this.player.armor) + '/' + this.totalArmorPoints();
    document.getElementById('inv-kills').textContent = this.player.kills;
    const weight = ARMOR_SLOTS.reduce((n, s) => n + (this.armor[s] ? 1 : 0), 0);
    document.getElementById('inv-speed').textContent = (100 - weight * 2) + '%';
  }

  // ---------- rendering ----------
  _slotHTML(item) {
    if (!item) return '';
    const count = item.count > 1 ? `<span class="item-count">${item.count}</span>` : '';
    const ammo = item.kind === 'weapon' && item.mag !== undefined
      ? `<span class="item-count">${item.mag}</span>` : '';
    return `<span class="item-icon">${item.icon}</span>${count}${ammo}`;
  }

  renderAll() {
    const slots = this.screen.querySelectorAll('.slot');
    for (const el of slots) {
      const item = this._get(el.dataset.container, el.dataset.index);
      const ghost = el.querySelector('.slot-ghost');
      el.innerHTML = this._slotHTML(item);
      el.classList.remove('item-rarity-1', 'item-rarity-2', 'item-rarity-3');
      if (item?.rarity) el.classList.add(`item-rarity-${item.rarity}`);
      if (!item && ghost) el.appendChild(ghost);
    }
    // carried ghost
    if (this.carried) {
      this.ghostEl.textContent = this.carried.icon;
      this.ghostEl.classList.remove('hidden');
    } else {
      this.ghostEl.classList.add('hidden');
    }
    this.renderHUDHotbar();
  }

  renderHUDHotbar() {
    const slots = this.hudHotbarEl.children;
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const el = slots[i];
      const item = this.hotbar[i];
      el.classList.toggle('active', i === this.selected);
      el.innerHTML = `<span class="hb-key">${i + 1}</span>` + this._slotHTML(item);
    }
  }

  _updateTooltip(e) {
    const slot = e.target.closest('.slot');
    const item = slot ? this._get(slot.dataset.container, slot.dataset.index) : null;
    if (!item || this.carried) { this.tooltipEl.classList.add('hidden'); return; }
    const tierColor = item.rarity ? ARMOR_TIERS[item.rarity].css : '#e8f0dd';
    this.tooltipEl.innerHTML =
      `<div class="tt-name" style="color:${tierColor}">${item.name}</div>` +
      `<div class="tt-desc">${item.desc || ''}</div>` +
      (item.kind === 'weapon' && item.mag !== undefined
        ? `<div class="tt-stat">${item.mag} in mag • ${item.reserve} reserve</div>` : '');
    this.tooltipEl.classList.remove('hidden');
    this.tooltipEl.style.left = Math.min(window.innerWidth - 260, e.clientX + 16) + 'px';
    this.tooltipEl.style.top = (e.clientY + 14) + 'px';
  }

  reset() {
    this.grid.fill(null);
    this.hotbar.fill(null);
    for (const s of ARMOR_SLOTS) this.armor[s] = null;
    this.carried = null;
    this.selected = 0;
    this.player.maxArmor = 0;
    this.paperdoll.setArmor(this.armor);
    this.renderAll();
  }
}
