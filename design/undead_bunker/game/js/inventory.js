// Minecraft-style hotbar + inventory, item registry, 3D-rendered item icons
window.G = window.G || {};
(() => {
  const T = THREE;
  const HOT = 9, TOTAL = 36;

  const Inv = {
    slots: new Array(TOTAL).fill(null),
    sel: 0, open: false, held: null,
    icons: {},
  };
  G.Inv = Inv;

  // ---------- stats ----------
  Inv.weaponStats = (item) => {
    const base = G.WEAPONS[item.key];
    if (!item.pap) return Object.assign({}, base, { displayName: base.name });
    return Object.assign({}, base, {
      dmg: base.dmg * 2.5,
      mag: Math.ceil(base.mag * 1.5),
      reserve: Math.ceil(base.reserve * 1.5),
      reload: base.reload * 0.85,
      displayName: '★ ' + base.name,
      pap: true,
    });
  };

  // ---------- icon rendering ----------
  let iconRenderer = null;
  function renderIcon(model, zoom = 1) {
    if (!iconRenderer) {
      iconRenderer = new T.WebGLRenderer({ alpha: true, antialias: true });
      iconRenderer.setSize(128, 128);
      iconRenderer.outputEncoding = T.sRGBEncoding;
    }
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xcfd8e8, 0x40352a, 1.1));
    const dl = new T.DirectionalLight(0xffffff, 1.1); dl.position.set(2, 4, 3); scene.add(dl);
    const wrap = new T.Group(); wrap.add(model); scene.add(wrap);
    const bb = new T.Box3().setFromObject(model);
    const c = bb.getCenter(new T.Vector3()), size = bb.getSize(new T.Vector3());
    model.position.sub(c);
    wrap.rotation.set(0.42, -0.72, 0);
    const r = Math.max(size.x, size.y, size.z);
    const cam = new T.PerspectiveCamera(30, 1, 0.01, 50);
    cam.position.set(0, 0, r * 2.15 / zoom); cam.lookAt(0, 0, 0);
    iconRenderer.render(scene, cam);
    return iconRenderer.domElement.toDataURL();
  }
  function genIcons() {
    for (const key in G.WEAPONS) Inv.icons['w:' + key] = renderIcon(G.buildWeaponModel(key), 1.12);
    Inv.icons['car'] = renderIcon(G.buildCarModel(), 1.05);
    ['wall', 'floor', 'stairs'].forEach(p => Inv.icons['b:' + p] = renderIcon(G.buildPieceModel(p)));
    ['wood', 'coal', 'wand'].forEach(m => Inv.icons['m:' + m] = renderIcon(G.buildMatModel(m), m === 'wand' ? 1.15 : 1));
    Inv.icons['p:bench'] = renderIcon(G.buildBenchModel());
    Inv.icons['p:anvil'] = renderIcon(G.buildAnvilModel(), 1.1);
    iconRenderer.dispose(); iconRenderer.forceContextLoss && iconRenderer.forceContextLoss(); iconRenderer = null;
  }
  Inv.iconFor = (item) =>
    item.type === 'weapon' ? Inv.icons['w:' + item.key] :
    item.type === 'build' ? Inv.icons['b:' + item.piece] :
    item.type === 'mat' ? Inv.icons['m:' + item.mat] :
    item.type === 'place' ? Inv.icons['p:' + item.kind] :
    Inv.icons['car'];
  const MAT_NAMES = { wood: 'Wood', coal: 'Coal', wand: 'Magic Wand' };
  Inv.nameFor = (item) =>
    item.type === 'weapon' ? Inv.weaponStats(item).displayName :
    item.type === 'build' ? ({ wall: 'Wood Wall', floor: 'Wood Floor', stairs: 'Wood Stairs' })[item.piece] :
    item.type === 'mat' ? MAT_NAMES[item.mat] :
    item.type === 'place' ? (item.kind === 'bench' ? 'Crafting Bench' : 'Anvil') :
    'Car Keys';

  // ---------- DOM ----------
  let hotEl, panelEl, ghostEl;
  const slotEls = [], panelSlotEls = [];
  function mkSlot(i, arr, parent) {
    const d = document.createElement('div');
    d.className = 'slot'; d.dataset.i = i;
    d.innerHTML = '<img draggable="false"><span class="cnt"></span>';
    parent.appendChild(d); arr[i] = d;
    return d;
  }
  function slotClick(i) {
    if (!Inv.open) return;
    const cur = Inv.slots[i];
    if (Inv.held) {
      Inv.slots[i] = Inv.held;
      Inv.held = cur || null;
    } else if (cur) {
      Inv.held = cur; Inv.slots[i] = null;
    }
    updateGhost();
    Inv.render();
    if (i === Inv.sel || Inv.held) G.onSelectionChanged && G.onSelectionChanged();
  }
  function updateGhost() {
    if (Inv.held) {
      ghostEl.style.display = 'block';
      ghostEl.querySelector('img').src = Inv.iconFor(Inv.held);
    } else ghostEl.style.display = 'none';
  }

  Inv.init = () => {
    genIcons();
    hotEl = document.getElementById('hotbar');
    panelEl = document.getElementById('invPanel');
    ghostEl = document.getElementById('heldGhost');
    for (let i = 0; i < HOT; i++) mkSlot(i, slotEls, hotEl);
    const grid = panelEl.querySelector('.invGrid');
    for (let i = HOT; i < TOTAL; i++) { const d = mkSlot(i, panelSlotEls, grid); d.onclick = () => slotClick(i); }
    const hotRow = panelEl.querySelector('.invHotRow');
    for (let i = 0; i < HOT; i++) { const d = mkSlot(i, panelSlotEls2, hotRow); d.onclick = () => slotClick(i); }
    panelEl.addEventListener('mousemove', e => { ghostEl.style.left = e.clientX + 14 + 'px'; ghostEl.style.top = e.clientY + 10 + 'px'; });
    G.Craft.initUI();

    // starting loadout
    Inv.slots[0] = { type: 'weapon', key: 'mauser', mag: G.WEAPONS.mauser.mag, reserve: G.WEAPONS.mauser.reserve, pap: false };
    Inv.slots[1] = { type: 'build', piece: 'wall' };
    Inv.slots[2] = { type: 'build', piece: 'floor' };
    Inv.slots[3] = { type: 'build', piece: 'stairs' };
    Inv.slots[4] = { type: 'car' };
    Inv.render();
  };
  const panelSlotEls2 = [];

  Inv.render = () => {
    const paint = (el, item, isSel) => {
      if (!el) return;
      el.classList.toggle('sel', !!isSel);
      const img = el.querySelector('img'), cnt = el.querySelector('.cnt');
      if (item) {
        img.src = Inv.iconFor(item); img.style.display = 'block';
        el.classList.toggle('pap', !!item.pap);
        el.title = Inv.nameFor(item);
        cnt.textContent = item.type === 'weapon' ? item.mag : item.type === 'build' ? '50⚡' : item.type === 'mat' && item.count > 1 ? item.count : '';
      } else {
        img.style.display = 'none'; cnt.textContent = ''; el.title = ''; el.classList.remove('pap');
      }
    };
    for (let i = 0; i < HOT; i++) {
      paint(slotEls[i], Inv.slots[i], i === Inv.sel);
      paint(panelSlotEls2[i], Inv.slots[i], i === Inv.sel);
    }
    for (let i = HOT; i < TOTAL; i++) paint(panelSlotEls[i], Inv.slots[i], false);
    if (G.Craft && Inv.open && G.Craft.refresh) G.Craft.refresh();
  };
  Inv._updateGhost = () => updateGhost();
  Inv.addMat = (mat, n) => {
    const stack = Inv.slots.find(s => s && s.type === 'mat' && s.mat === mat);
    if (stack) stack.count += n;
    else {
      let slot = -1;
      for (let i = 0; i < TOTAL; i++) if (!Inv.slots[i]) { slot = i; break; }
      if (slot < 0) { G.showMsg('Inventory full'); return false; }
      Inv.slots[slot] = { type: 'mat', mat, count: n };
    }
    Inv.render();
    return true;
  };
  Inv.updateCounts = () => {
    for (let i = 0; i < HOT; i++) {
      const it = Inv.slots[i];
      if (it && it.type === 'weapon' && slotEls[i]) slotEls[i].querySelector('.cnt').textContent = it.mag;
    }
  };

  Inv.select = (i) => {
    if (i < 0 || i >= HOT || i === Inv.sel) { if (i === Inv.sel) return; return; }
    Inv.sel = i;
    Inv.render();
    G.onSelectionChanged && G.onSelectionChanged();
  };
  Inv.selected = () => Inv.slots[Inv.sel];

  Inv.addWeapon = (key, opts = {}) => {
    const pap = !!opts.pap;
    const existing = Inv.slots.findIndex(s => s && s.type === 'weapon' && s.key === key && !!s.pap === pap);
    if (existing >= 0) {
      const st = Inv.weaponStats(Inv.slots[existing]);
      Inv.slots[existing].mag = st.mag; Inv.slots[existing].reserve = st.reserve;
      if (existing < HOT) Inv.select(existing);
      Inv.render();
      return Inv.slots[existing];
    }
    const st = Inv.weaponStats({ key, pap });
    const item = { type: 'weapon', key, mag: st.mag, reserve: st.reserve, pap };
    let slot = -1;
    for (let i = 0; i < HOT; i++) if (!Inv.slots[i]) { slot = i; break; }
    if (slot < 0) for (let i = HOT; i < TOTAL; i++) if (!Inv.slots[i]) { slot = i; break; }
    if (slot < 0) {
      const cur = Inv.selected();
      if (cur && cur.type === 'weapon') { Inv.slots[Inv.sel] = item; slot = Inv.sel; }
      else { G.showMsg('Inventory full'); return null; }
    }
    Inv.slots[slot] = item;
    if (slot < HOT) Inv.select(slot); else G.showMsg('Sent to inventory (E)');
    Inv.render();
    G.onSelectionChanged && G.onSelectionChanged();
    return item;
  };
  Inv.addItemAt = (item, prefer) => {
    if (prefer != null && !Inv.slots[prefer]) { Inv.slots[prefer] = item; }
    else {
      let slot = -1;
      for (let i = 0; i < TOTAL; i++) if (!Inv.slots[i]) { slot = i; break; }
      if (slot < 0) { G.showMsg('Inventory full'); return false; }
      Inv.slots[slot] = item;
    }
    Inv.render(); G.onSelectionChanged && G.onSelectionChanged();
    return true;
  };

  Inv.toggle = (force) => {
    const want = force != null ? force : !Inv.open;
    if (want === Inv.open) return;
    Inv.open = want;
    panelEl.style.display = want ? 'flex' : 'none';
    G.state.paused = want;
    if (want) {
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      if (Inv.held) { Inv.addItemAt(Inv.held); Inv.held = null; updateGhost(); }
      if (!G.noLock && G.state.playing && !G.player.dead) G.tryLock && G.tryLock();
    }
    G.Craft && G.Craft.onInvToggle && G.Craft.onInvToggle(want);
    Inv.render();
  };

  document.addEventListener('keydown', e => {
    if (!G.state || !G.state.playing || G.player.dead) return;
    if (e.code === 'KeyE') Inv.toggle();
    if (!Inv.open) {
      if (e.code.startsWith('Digit')) {
        const n = +e.code.slice(5);
        if (n >= 1 && n <= 9) Inv.select(n - 1);
      }
    } else if (e.code === 'Escape') Inv.toggle(false);
  });
})();
