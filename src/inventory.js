import { ARMOR_TIERS, WEAPONS, weaponDef, RECIPES, makeWeaponItem } from './items.js';
import { audio } from './audio.js';

// 36-slot Minecraft-style inventory (9 hotbar + 27 grid) on T, with armor
// slots + armor slots (Fable 5 flavor) and the Undead Bunker crafting
// panel (2×2 pocket / 3×3 bench / anvil) with a recipes bar.

const SLOTS = 36;
const HOTBAR = 9;
const ARMOR_SLOTS = ['helmet', 'chest', 'legs', 'boots'];
const GRID_FOR_MODE = { pocket: 4, bench: 9, anvil: 3 };

export class Inventory {
  constructor(player, icons, callbacks = {}) {
    this.player = player;
    this.icons = icons;
    this.cb = callbacks; // { onLoadoutChange, onClose, onDropItem, onCraftWeapon, getRound, getKills }

    this.slots = new Array(SLOTS).fill(null);
    this.armor = { helmet: null, chest: null, legs: null, boots: null };
    this.sel = 0;
    this.carried = null;
    this.openFlag = false;

    this.craftMode = 'pocket';
    this.craftGrid = new Array(9).fill(null);
    this.craftMatch = null; // matched recipe for manual grid

    this.panel = document.getElementById('invPanel');
    this.gridEl = document.querySelector('.invGrid');
    this.hotRowEl = document.querySelector('.invHotRow');
    this.hudHotbarEl = document.getElementById('hotbar');
    this.ghostEl = document.getElementById('heldGhost');
    this.tooltipEl = document.getElementById('item-tooltip');
    this.craftGridEl = document.getElementById('craftGrid');
    this.craftResultEl = document.getElementById('craftResult');
    this.recipeBarEl = document.getElementById('recipeBar');
    this.craftTitleEl = document.getElementById('craftTitle');

    this._buildSlots();
    this._bindEvents();
    this.renderAll();
  }

  // ---------- DOM ----------
  _buildSlots() {
    for (let i = HOTBAR; i < SLOTS; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.container = 'inv';
      el.dataset.index = i;
      this.gridEl.appendChild(el);
    }
    for (let i = 0; i < HOTBAR; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.container = 'inv';
      el.dataset.index = i;
      this.hotRowEl.appendChild(el);
      const hud = document.createElement('div');
      hud.className = 'slot';
      hud.innerHTML = `<span class="hb-key">${i + 1}</span>`;
      this.hudHotbarEl.appendChild(hud);
    }
    for (const el of document.querySelectorAll('.armor-slot')) {
      el.dataset.container = 'armor';
      el.dataset.index = el.dataset.armor;
      el.dataset.ghost = el.querySelector('.slot-ghost')?.textContent || '';
    }
    for (let i = 0; i < 9; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.container = 'craft';
      el.dataset.index = i;
      this.craftGridEl.appendChild(el);
    }
    this.craftResultEl.dataset.container = 'craftResult';
    this.craftResultEl.dataset.index = 0;
  }

  _bindEvents() {
    this.panel.addEventListener('mousedown', (e) => {
      const slot = e.target.closest('.slot');
      const recipe = e.target.closest('.recipeBtn');
      if (recipe) { this._clickRecipe(recipe.dataset.key); return; }
      if (!slot || slot.dataset.container === undefined) return;
      e.preventDefault();
      this._clickSlot(slot.dataset.container, slot.dataset.index, e.button === 2);
    });
    this.panel.addEventListener('contextmenu', (e) => e.preventDefault());
    this.panel.addEventListener('mousemove', (e) => {
      this.ghostEl.style.left = e.clientX + 'px';
      this.ghostEl.style.top = e.clientY + 'px';
      this._updateTooltip(e);
    });
  }

  _get(container, index) {
    if (container === 'inv') return this.slots[index];
    if (container === 'armor') return this.armor[index];
    if (container === 'craft') return this.craftGrid[index];
    if (container === 'craftResult') return this._resultGhost();
    return null;
  }

  _set(container, index, item) {
    if (container === 'inv') this.slots[index] = item;
    else if (container === 'armor') this.armor[index] = item;
    else if (container === 'craft') this.craftGrid[index] = item;
  }

  _clickSlot(container, index, rightClick) {
    if (container === 'craftResult') { this._takeCraftResult(); return; }
    const cur = this._get(container, index);

    if (rightClick && !this.carried) {
      if (cur?.kind === 'armor' && container !== 'armor') { this._equipArmor(container, index); return; }
      return;
    }

    if (!this.carried) {
      if (!cur) return;
      this.carried = cur;
      this._set(container, index, null);
    } else {
      if (container === 'armor' && !(this.carried.kind === 'armor' && this.carried.armorSlot === index)) return;
      if (rightClick && this.carried.count > 1 && (!cur || cur.id === this.carried.id)) {
        // right-click: place one
        if (!cur) this._set(container, index, { ...this.carried, count: 1 });
        else if (cur.count < cur.stack) cur.count++;
        else return;
        this.carried.count--;
        if (this.carried.count <= 0) this.carried = null;
      } else if (cur && cur.id === this.carried.id && cur.stack > 1 && cur.count < cur.stack) {
        const move = Math.min(cur.stack - cur.count, this.carried.count);
        cur.count += move;
        this.carried.count -= move;
        if (this.carried.count <= 0) this.carried = null;
      } else {
        this._set(container, index, this.carried);
        this.carried = cur;
      }
      audio.equip();
    }
    this._afterChange();
  }

  _equipArmor(container, index) {
    const item = this._get(container, index);
    const prev = this.armor[item.armorSlot];
    this.armor[item.armorSlot] = item;
    this._set(container, index, prev || null);
    audio.equip();
    this._afterChange();
  }

  // ---------- armor durability (Fable 5) ----------
  _recomputeArmor() {
    let cur = 0, max = 0;
    for (const s of ARMOR_SLOTS) {
      const it = this.armor[s];
      if (!it) continue;
      if (it.remaining === undefined) it.remaining = it.armor;
      cur += it.remaining; max += it.armor;
    }
    this.player.armor = cur;
    this.player.maxArmor = max;
  }

  absorbArmorDamage(absorbed) {
    const items = ARMOR_SLOTS.map((s) => this.armor[s]).filter(Boolean);
    const total = items.reduce((n, it) => n + (it.remaining ?? it.armor), 0);
    if (total <= 0) return;
    for (const it of items) {
      if (it.remaining === undefined) it.remaining = it.armor;
      it.remaining = Math.max(0, it.remaining - absorbed * (it.remaining / total));
    }
    this._recomputeArmor();
  }

  _afterChange() {
    this._recomputeArmor();
    this.tooltipEl.classList.add('hidden');
    this._matchCraft();
    this.renderAll();
    if (this.cb.onLoadoutChange) this.cb.onLoadoutChange();
  }

  // ---------- public item API ----------
  addItem(item) {
    if (item.stack > 1) {
      for (const it of this.slots) {
        if (it && it.id === item.id && it.count < it.stack) {
          const move = Math.min(it.stack - it.count, item.count);
          it.count += move; item.count -= move;
          if (item.count <= 0) { this._afterChange(); return true; }
        }
      }
    }
    // weapons: same-key non-pap already owned → refill reserve instead
    if (item.kind === 'weapon' && !item.pap) {
      const owned = this.slots.find((it) => it?.kind === 'weapon' && it.weaponKey === item.weaponKey && !it.pap);
      if (owned) {
        owned.reserve = weaponDef(owned).reserve;
        this._afterChange();
        return true;
      }
    }
    // prefer hotbar for weapons/tools, then anywhere
    const order = item.kind === 'weapon' || item.kind === 'tool'
      ? [...Array(SLOTS).keys()]
      : [...Array(SLOTS - HOTBAR).keys()].map((i) => i + HOTBAR).concat([...Array(HOTBAR).keys()]);
    for (const i of order) {
      if (!this.slots[i]) { this.slots[i] = item; this._afterChange(); return true; }
    }
    return false;
  }

  addItemAt(item, slot) {
    if (slot != null && !this.slots[slot]) { this.slots[slot] = item; this._afterChange(); return true; }
    return this.addItem(item);
  }

  countOf(id) {
    let n = 0;
    for (const it of this.slots) if (it?.id === id) n += it.count;
    for (const it of this.craftGrid) if (it?.id === id) n += it.count;
    return n;
  }

  consume(id, n) {
    // pull from craft grid first, then inventory
    for (const arr of [this.craftGrid, this.slots]) {
      for (let i = 0; i < arr.length && n > 0; i++) {
        const it = arr[i];
        if (it?.id !== id) continue;
        const take = Math.min(it.count, n);
        it.count -= take; n -= take;
        if (it.count <= 0) arr[i] = null;
      }
    }
    this._afterChange();
    return n <= 0;
  }

  select(i) {
    this.sel = ((i % HOTBAR) + HOTBAR) % HOTBAR;
    this.renderAll();
    if (this.cb.onLoadoutChange) this.cb.onLoadoutChange();
  }

  selectedItem() { return this.slots[this.sel]; }
  selectedWeapon() {
    const it = this.slots[this.sel];
    return it?.kind === 'weapon' ? it : null;
  }

  // ---------- crafting ----------
  setCraftMode(mode) {
    this.craftMode = mode;
    // return any items stranded in hidden cells
    for (let i = 0; i < 9; i++) {
      if (this.craftGrid[i]) { this.addItem(this.craftGrid[i]); this.craftGrid[i] = null; }
    }
    this._matchCraft();
    this.renderAll();
  }

  _recipesForMode() {
    if (this.craftMode === 'anvil') return RECIPES.filter((r) => r.grid === 'anvil');
    if (this.craftMode === 'bench') return RECIPES.filter((r) => r.grid === '2x2' || r.grid === '3x3');
    return RECIPES.filter((r) => r.grid === '2x2');
  }

  _gridContents() {
    const m = {};
    const n = GRID_FOR_MODE[this.craftMode];
    for (let i = 0; i < n; i++) {
      const it = this.craftGrid[i];
      if (it) m[it.id] = (m[it.id] || 0) + it.count;
    }
    return m;
  }

  _matchCraft() {
    const grid = this._gridContents();
    this.craftMatch = null;
    for (const r of this._recipesForMode()) {
      const keys = Object.keys(r.mats);
      const gkeys = Object.keys(grid);
      if (keys.length !== gkeys.length) continue;
      if (keys.every((k) => grid[k] === r.mats[k])) { this.craftMatch = r; break; }
    }
  }

  _resultGhost() {
    if (!this.craftMatch) return null;
    const r = this.craftMatch;
    return r.result ? r.result() : { icon: '🔫', icon3d: null, name: r.name, kind: 'ghost', count: 1 };
  }

  canAfford(recipe) {
    return Object.entries(recipe.mats).every(([id, n]) => this.countOf(id) >= n);
  }

  _clickRecipe(key) {
    const r = RECIPES.find((r) => r.key === key);
    if (!r || !this.canAfford(r)) { audio.deny(); return; }
    this._doCraft(r);
  }

  _takeCraftResult() {
    if (!this.craftMatch) return;
    this._doCraft(this.craftMatch);
  }

  _doCraft(r) {
    for (const [id, n] of Object.entries(r.mats)) this.consume(id, n);
    if (r.pool) {
      // weapon craft sequence — handled by the Craft system (closes inventory)
      if (this.cb.onCraftWeapon) this.cb.onCraftWeapon(r);
    } else {
      const item = r.result();
      if (!this.addItem(item) && this.cb.onDropItem) this.cb.onDropItem(item);
      audio.craftTick();
    }
    this._afterChange();
  }

  // ---------- open/close ----------
  toggle() { this.openFlag ? this.close() : this.open(); }

  open(mode = 'pocket') {
    this.openFlag = true;
    this.setCraftMode(mode);
    this.panel.classList.add('open');
    this.renderAll();
  }

  close() {
    this.openFlag = false;
    if (this.carried) {
      const item = this.carried;
      this.carried = null;
      if (!this.addItem(item)) {
        if (item.kind === 'armor' && !this.armor[item.armorSlot]) {
          this.armor[item.armorSlot] = item;
          this._afterChange();
        } else if (this.cb.onDropItem) this.cb.onDropItem(item);
      }
    }
    // return craft grid contents
    for (let i = 0; i < 9; i++) {
      if (this.craftGrid[i]) {
        if (!this.addItem(this.craftGrid[i]) && this.cb.onDropItem) this.cb.onDropItem(this.craftGrid[i]);
        this.craftGrid[i] = null;
      }
    }
    this.panel.classList.remove('open');
    this.tooltipEl.classList.add('hidden');
    this.ghostEl.style.display = 'none';
    if (this.cb.onClose) this.cb.onClose();
  }

  get isOpen() { return this.openFlag; }

  update(dt) {
    if (!this.openFlag) return;
    document.getElementById('inv-hp').textContent = Math.ceil(this.player.health);
    document.getElementById('inv-armor').textContent = `${Math.ceil(this.player.armor)}/${this.player.maxArmor}`;
    document.getElementById('inv-round').textContent = this.cb.getRound ? this.cb.getRound() : 1;
    document.getElementById('inv-kills').textContent = this.cb.getKills ? this.cb.getKills() : 0;
  }

  // ---------- rendering ----------
  _slotHTML(item) {
    if (!item) return '';
    const url = this.icons?.iconFor(item);
    const img = url ? `<img src="${url}" draggable="false">` : `<span class="emoji">${item.icon}</span>`;
    let badge = '';
    if (item.kind === 'weapon' && item.mag !== undefined) badge = `<span class="cnt">${item.mag}</span>`;
    else if (item.count > 1) badge = `<span class="cnt">${item.count}</span>`;
    return img + badge;
  }

  renderAll() {
    for (const el of this.panel.querySelectorAll('.slot')) {
      const item = this._get(el.dataset.container, el.dataset.index);
      el.innerHTML = item
        ? this._slotHTML(item)
        : (el.dataset.ghost ? `<span class="slot-ghost">${el.dataset.ghost}</span>` : '');
      el.classList.remove('item-rarity-1', 'item-rarity-2', 'item-rarity-3', 'pap');
      if (item?.rarity) el.classList.add(`item-rarity-${item.rarity}`);
      if (item?.pap) el.classList.add('pap');
    }
    // craft grid sizing per mode
    const n = GRID_FOR_MODE[this.craftMode];
    this.craftGridEl.className = n === 4 ? 'g2' : n === 9 ? 'g3' : 'g1';
    const cells = this.craftGridEl.children;
    for (let i = 0; i < 9; i++) cells[i].style.display = i < n ? '' : 'none';
    this.craftTitleEl.textContent =
      this.craftMode === 'bench' ? 'CRAFTING BENCH (3×3)' :
      this.craftMode === 'anvil' ? 'ANVIL' : 'CRAFTING (2×2)';

    // recipes bar
    this.recipeBarEl.innerHTML = '';
    for (const r of this._recipesForMode()) {
      const btn = document.createElement('div');
      btn.className = 'recipeBtn' + (this.canAfford(r) ? '' : ' missing');
      btn.dataset.key = r.key;
      const preview = r.result ? r.result() : null;
      const url = preview ? this.icons?.iconFor(preview) : null;
      btn.innerHTML =
        `<div class="rIcon">${url ? `<img src="${url}">` : '🔫'}</div>` +
        `<div><div class="rName">${r.name}</div><div class="rDesc">${r.desc}</div></div>`;
      this.recipeBarEl.appendChild(btn);
    }

    // carried ghost
    if (this.carried) {
      const url = this.icons?.iconFor(this.carried);
      this.ghostEl.innerHTML = url ? `<img src="${url}">` : this.carried.icon;
      this.ghostEl.style.display = 'block';
    } else {
      this.ghostEl.style.display = 'none';
    }
    this.renderHUDHotbar();
  }

  renderHUDHotbar() {
    const els = this.hudHotbarEl.children;
    for (let i = 0; i < HOTBAR; i++) {
      const el = els[i];
      const item = this.slots[i];
      el.classList.toggle('sel', i === this.sel);
      el.classList.toggle('pap', !!item?.pap);
      el.innerHTML = `<span class="hb-key">${i + 1}</span>` + this._slotHTML(item);
    }
  }

  _updateTooltip(e) {
    const slot = e.target.closest('.slot');
    const item = slot ? this._get(slot.dataset.container, slot.dataset.index) : null;
    if (!item || this.carried) { this.tooltipEl.classList.add('hidden'); return; }
    const tierColor = item.rarity ? ARMOR_TIERS[item.rarity].css : (item.pap ? '#c99aff' : '#e8dfcf');
    this.tooltipEl.innerHTML =
      `<div class="tt-name" style="color:${tierColor}">${item.name}</div>` +
      `<div class="tt-desc">${item.desc || ''}</div>` +
      (item.kind === 'weapon' && item.mag !== undefined
        ? `<div class="tt-stat">${item.mag} in mag · ${item.reserve} reserve</div>` : '') +
      (item.kind === 'armor'
        ? `<div class="tt-stat">${Math.ceil(item.remaining ?? item.armor)}/${item.armor} durability</div>` : '');
    this.tooltipEl.classList.remove('hidden');
    this.tooltipEl.style.left = Math.min(window.innerWidth - 270, e.clientX + 16) + 'px';
    this.tooltipEl.style.top = (e.clientY + 14) + 'px';
  }

  reset() {
    this.slots.fill(null);
    this.craftGrid.fill(null);
    for (const s of ARMOR_SLOTS) this.armor[s] = null;
    this.carried = null;
    this.sel = 0;
    this.craftMode = 'pocket';
    this._recomputeArmor();
    this.renderAll();
  }
}
