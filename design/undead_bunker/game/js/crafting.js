// Crafting: materials, recipes, 2x2/3x3/anvil UIs, wand craft animations, drops, jetpack fuel
window.G = window.G || {};
(() => {
  const T = THREE;

  // ---------- material / station models ----------
  const woodM = new T.MeshStandardMaterial({ color: 0x8a5c2e, roughness: 0.85 });
  const woodDk = new T.MeshStandardMaterial({ color: 0x4e3018, roughness: 0.9 });
  const coalM = new T.MeshStandardMaterial({ color: 0x111114, roughness: 0.55, metalness: 0.25 });
  const steelM = new T.MeshStandardMaterial({ color: 0x3c3f46, metalness: 0.85, roughness: 0.4 });

  G.buildWandModel = () => {
    const g = new T.Group();
    const s1 = new T.Mesh(new T.CylinderGeometry(0.008, 0.012, 0.24, 7), woodDk);
    s1.rotation.x = Math.PI / 2; s1.position.z = -0.06; g.add(s1);
    const s2 = new T.Mesh(new T.CylinderGeometry(0.006, 0.009, 0.12, 6), woodDk);
    s2.rotation.x = Math.PI / 2 - 0.18; s2.position.set(0.008, 0.012, -0.2); g.add(s2);
    const tip = new T.Mesh(new T.OctahedronGeometry(0.026), new T.MeshStandardMaterial({ color: 0x0a3038, emissive: 0x66e8ff, emissiveIntensity: 1.8 }));
    tip.position.set(0.01, 0.02, -0.27); g.add(tip);
    const ring = new T.Mesh(new T.TorusGeometry(0.016, 0.004, 6, 14), steelM);
    ring.position.z = -0.13; g.add(ring);
    const o = new T.Object3D(); o.position.copy(tip.position); g.add(o);
    g.userData.tip = o; g.userData.tipMesh = tip;
    return g;
  };
  G.buildMatModel = (mat) => {
    if (mat === 'wand') return G.buildWandModel();
    const g = new T.Group();
    if (mat === 'wood') {
      [[0, 0, 0, 0], [0, 0.09, 0, Math.PI / 2], [0, 0.18, 0, 0.2]].forEach(([x, y, z, ry]) => {
        const p = new T.Mesh(new T.BoxGeometry(0.5, 0.09, 0.16), woodM);
        p.position.set(x, y + 0.05, z); p.rotation.y = ry; g.add(p);
      });
    } else {
      for (let i = 0; i < 5; i++) {
        const l = new T.Mesh(new T.IcosahedronGeometry(0.09 + Math.random() * 0.05, 0), coalM);
        l.position.set((Math.random() - .5) * 0.22, 0.08 + (i === 4 ? 0.13 : 0), (Math.random() - .5) * 0.22);
        g.add(l);
      }
    }
    return g;
  };
  G.buildBenchModel = () => {
    const g = new T.Group();
    const gridTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#7a5127'; x.fillRect(0, 0, 128, 128);
      x.strokeStyle = 'rgba(40,20,6,.8)'; x.lineWidth = 4; x.strokeRect(14, 14, 100, 100);
      x.beginPath(); x.moveTo(47, 14); x.lineTo(47, 114); x.moveTo(81, 14); x.lineTo(81, 114);
      x.moveTo(14, 47); x.lineTo(114, 47); x.moveTo(14, 81); x.lineTo(114, 81); x.stroke();
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
    })();
    const top = new T.Mesh(new T.BoxGeometry(1.5, 0.12, 0.95), new T.MeshStandardMaterial({ map: gridTex, roughness: 0.8 }));
    top.position.y = 0.86; top.castShadow = true; g.add(top);
    [[-0.65, -0.38], [0.65, -0.38], [-0.65, 0.38], [0.65, 0.38]].forEach(([x, z]) => {
      const leg = new T.Mesh(new T.BoxGeometry(0.13, 0.82, 0.13), woodDk);
      leg.position.set(x, 0.41, z); leg.castShadow = true; g.add(leg);
    });
    const shelf = new T.Mesh(new T.BoxGeometry(1.3, 0.07, 0.7), woodDk); shelf.position.y = 0.28; g.add(shelf);
    const tools = new T.Mesh(new T.BoxGeometry(0.4, 0.12, 0.3), steelM); tools.position.set(-0.4, 0.36, 0); g.add(tools);
    return g;
  };
  G.buildAnvilModel = () => {
    const g = new T.Group();
    const base = new T.Mesh(new T.BoxGeometry(0.62, 0.22, 0.5), woodDk); base.position.y = 0.11; base.castShadow = true; g.add(base);
    const waist = new T.Mesh(new T.BoxGeometry(0.3, 0.28, 0.26), steelM); waist.position.y = 0.36; g.add(waist);
    const top = new T.Mesh(new T.BoxGeometry(0.78, 0.16, 0.3), steelM); top.position.y = 0.56; top.castShadow = true; g.add(top);
    const horn = new T.Mesh(new T.ConeGeometry(0.11, 0.32, 10), steelM);
    horn.rotation.z = Math.PI / 2; horn.position.set(0.52, 0.56, 0); g.add(horn);
    return g;
  };

  // ---------- recipes ----------
  G.RECIPES = [
    { id: 'bench', name: 'Crafting Bench', grid: 2, needs: { wood: 4 }, gives: { type: 'place', kind: 'bench' }, desc: 'placeable · 3×3 crafting' },
    { id: 'wand', name: 'Magic Wand', grid: 2, needs: { wood: 2, coal: 1 }, gives: { type: 'mat', mat: 'wand', count: 1 }, desc: 'catalyst for weaponcraft' },
    { id: 'rshot', name: 'Random Shotgun', grid: 2, needs: { wand: 1, wood: 2 }, pool: ['trench'], anim: 'shotgun', desc: 'consumes a wand' },
    { id: 'rar', name: 'Random Assault Rifle', grid: 2, needs: { wand: 1, coal: 2 }, pool: ['stg', 'smg', 'mg42'], anim: 'ar', desc: 'consumes a wand' },
    { id: 'rww', name: 'Random Wonder Weapon', grid: 2, needs: { wand: 1, coal: 3 }, pool: ['arc', 'laser'], anim: 'wonder', desc: 'consumes a wand' },
    { id: 'anvil', name: 'Anvil', grid: 3, needs: { wood: 4, coal: 4 }, gives: { type: 'place', kind: 'anvil' }, desc: 'placeable · smelting' },
    { id: 'jetpack', name: 'Jetpack', grid: 3, needs: { wand: 1, wood: 4, coal: 4 }, special: 'jetpack', desc: 'hold SPACE to fly' },
    { id: 'fuel', name: 'Jet Fuel', grid: 'anvil', needs: { coal: 3 }, special: 'fuel', desc: '+50% jetpack fuel' },
  ];

  const C = {
    mode: 'pocket',            // pocket | bench | anvil
    slots: new Array(9).fill(null),
    anim: null,
    match: null,
  };
  G.Craft = C;
  G.stations = [];

  // ---------- inventory material helpers ----------
  C.countMat = (mat) => {
    let n = 0;
    for (const s of [...G.Inv.slots, ...C.slots]) if (s && s.type === 'mat' && s.mat === mat) n += s.count;
    return n;
  };
  C.hasMats = (needs) => Object.keys(needs).every(m => C.countMat(m) >= needs[m]);
  C.consumeMats = (needs) => {
    for (const m in needs) {
      let left = needs[m];
      const take = (arr) => {
        for (let i = 0; i < arr.length && left > 0; i++) {
          const s = arr[i];
          if (s && s.type === 'mat' && s.mat === m) {
            const t = Math.min(left, s.count);
            s.count -= t; left -= t;
            if (s.count <= 0) arr[i] = null;
          }
        }
      };
      take(C.slots); take(G.Inv.slots);
    }
    G.Inv.render(); C.renderGrid();
  };

  // ---------- craft UI ----------
  let gridEl, resultEl, listEl, titleEl;
  const gridSlotEls = [];
  C.initUI = () => {
    const inner = document.getElementById('invInner');
    const wrap = document.createElement('div');
    wrap.id = 'craftWrap';
    wrap.innerHTML = `<div id="craftLeft"><h3 id="craftTitle">Crafting 2×2</h3><div id="craftGrid"></div><div id="craftArrowRow"><span id="craftArrow">➜</span><div id="craftResult" class="slot"><img draggable="false"><span class="cnt"></span></div></div></div>
      <div id="recipeBar"><h3>Recipes</h3><div id="recipeList"></div></div>`;
    inner.appendChild(wrap);
    gridEl = wrap.querySelector('#craftGrid');
    resultEl = wrap.querySelector('#craftResult');
    listEl = wrap.querySelector('#recipeList');
    titleEl = wrap.querySelector('#craftTitle');
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'slot'; d.innerHTML = '<img draggable="false"><span class="cnt"></span>';
      d.onclick = () => C.gridClick(i);
      gridEl.appendChild(d); gridSlotEls.push(d);
    }
    resultEl.onclick = () => { if (C.match) { C.consumeGridOnly(C.match.needs); C.produce(C.match); } };
    C.setMode('pocket');
  };
  C.gridClick = (i) => {
    if (!G.Inv.open) return;
    const cur = C.slots[i];
    const held = G.Inv.held;
    if (held) {
      if (cur && cur.type === 'mat' && held.type === 'mat' && cur.mat === held.mat) { cur.count += held.count; G.Inv.held = null; }
      else { C.slots[i] = held; G.Inv.held = cur || null; }
    } else if (cur) { G.Inv.held = cur; C.slots[i] = null; }
    G.Inv._updateGhost();
    C.refresh(); G.Inv.render();
  };
  C.gridSize = () => C.mode === 'bench' ? 9 : C.mode === 'anvil' ? 3 : 4;
  C.setMode = (m) => {
    C.mode = m;
    titleEl.textContent = m === 'bench' ? 'Crafting Bench 3×3' : m === 'anvil' ? 'Anvil — Smelt' : 'Crafting 2×2';
    gridEl.className = m;
    gridSlotEls.forEach((el, i) => el.style.display = i < C.gridSize() ? 'block' : 'none');
    C.refresh();
  };
  C.renderGrid = () => {
    gridSlotEls.forEach((el, i) => {
      const it = C.slots[i];
      const img = el.querySelector('img'), cnt = el.querySelector('.cnt');
      if (it) { img.src = G.Inv.iconFor(it); img.style.display = 'block'; cnt.textContent = it.type === 'mat' && it.count > 1 ? it.count : ''; }
      else { img.style.display = 'none'; cnt.textContent = ''; }
    });
  };
  C.recipesForMode = () => G.RECIPES.filter(r =>
    C.mode === 'anvil' ? r.grid === 'anvil' : (r.grid === 2 || (r.grid === 3 && C.mode === 'bench')));
  C.matchGrid = () => {
    const counts = {};
    for (let i = 0; i < C.gridSize(); i++) {
      const s = C.slots[i];
      if (!s) continue;
      if (s.type !== 'mat') return null;
      counts[s.mat] = (counts[s.mat] || 0) + s.count;
    }
    if (!Object.keys(counts).length) return null;
    for (const r of C.recipesForMode()) {
      const keys = Object.keys(r.needs);
      if (keys.length === Object.keys(counts).length && keys.every(k => counts[k] === r.needs[k])) return r;
    }
    return null;
  };
  C.consumeGridOnly = (needs) => {
    for (let i = 0; i < 9; i++) C.slots[i] = null;
    C.renderGrid();
  };
  C.refresh = () => {
    if (!gridEl) return;
    C.renderGrid();
    C.match = C.matchGrid();
    const img = resultEl.querySelector('img');
    if (C.match) { img.src = C.resultIcon(C.match); img.style.display = 'block'; resultEl.classList.add('canCraft'); }
    else { img.style.display = 'none'; resultEl.classList.remove('canCraft'); }
    // recipe list
    listEl.innerHTML = '';
    for (const r of C.recipesForMode()) {
      const ok = C.hasMats(r.needs);
      const b = document.createElement('button');
      b.className = 'recipeBtn' + (ok ? '' : ' off');
      const needTxt = Object.keys(r.needs).map(m => `${r.needs[m]} ${m}`).join(' + ');
      b.innerHTML = `<img src="${C.resultIcon(r)}"><span><b>${r.name}</b><i>${needTxt}</i><i>${r.desc}</i></span>`;
      if (ok) b.onclick = () => { C.consumeMats(r.needs); C.produce(r); };
      listEl.appendChild(b);
    }
  };
  C.resultIcon = (r) => {
    if (r.pool) return G.Inv.icons['m:wand'];
    if (r.special === 'jetpack') return G.Inv.icons['jetpack'] || G.Inv.icons['m:coal'];
    if (r.special === 'fuel') return G.Inv.icons['m:coal'];
    if (r.gives) {
      if (r.gives.type === 'place') return G.Inv.icons['p:' + r.gives.kind];
      if (r.gives.type === 'mat') return G.Inv.icons['m:' + r.gives.mat];
    }
    return '';
  };
  C.produce = (r) => {
    if (r.pool) {
      G.Inv.toggle(false);
      C.startWeaponCraft(r);
      return;
    }
    if (r.special === 'jetpack') {
      if (G.player.jetpack) { G.showMsg('Jetpack already built'); G.audio.deny(); C.refresh(); return; }
      G.player.jetpack = true; G.player.jetFuel = 100;
      G.updateFuelHUD(); G.audio.perkJingle();
      G.showMsg('Jetpack equipped — hold SPACE to fly');
    } else if (r.special === 'fuel') {
      if (!G.player.jetpack) { G.showMsg('Craft a jetpack first'); G.audio.deny(); C.refresh(); return; }
      G.player.jetFuel = Math.min(100, G.player.jetFuel + 50);
      G.updateFuelHUD(); G.audio.buy();
      G.showMsg('Jet fuel +50%');
    } else if (r.gives) {
      if (r.gives.type === 'mat') G.Inv.addMat(r.gives.mat, r.gives.count);
      else G.Inv.addItemAt({ type: 'place', kind: r.gives.kind });
      G.audio.boardAdd();
    }
    C.refresh(); G.Inv.render();
  };

  // ---------- weapon craft animation ----------
  const barWrap = () => document.getElementById('craftBar');
  C.startWeaponCraft = (recipe) => {
    C.anim = { type: recipe.anim, pool: recipe.pool, t: 0, dur: 3.0, tick: 0, burst: 0 };
    G.setHandModel(G.buildWandModel());
    barWrap().style.display = 'block';
    document.getElementById('craftLabel').textContent = 'ITEM CRAFTING — ' + recipe.name.toUpperCase();
  };
  C.tipWorld = () => {
    const v = new T.Vector3(0.2, -0.12, -0.62);
    return v.applyQuaternion(G.camera.quaternion).add(G.camera.position);
  };
  C.update = (dt) => {
    // scavenge cooldowns
    for (const n of G.scavenge) {
      if (n.cd > 0) { n.cd -= dt; n.group.scale.setScalar(Math.min(1, 1 - (n.cd / 8) * 0.5)); }
    }
    if (!C.anim) return;
    const a = C.anim;
    a.t += dt;
    document.getElementById('craftFill').style.width = Math.min(100, a.t / a.dur * 100) + '%';
    const tip = C.tipWorld();
    if (a.type === 'ar') {
      const ang = a.t * 9;
      const p = tip.clone().add(new T.Vector3(Math.cos(ang) * 0.25, Math.sin(a.t * 5) * 0.12, Math.sin(ang) * 0.25));
      G.spawnSpark(p, 0xffa040);
      a.tick -= dt; if (a.tick <= 0) { a.tick = 0.34; G.audio.craftTick(); }
    } else if (a.type === 'shotgun') {
      a.burst -= dt;
      if (a.burst <= 0) {
        a.burst = 0.5;
        for (let i = 0; i < 3; i++) G.spawnSpark(tip.clone().add(new T.Vector3((Math.random() - .5) * 0.5, (Math.random() - .5) * 0.3, (Math.random() - .5) * 0.5)), 0xff5030);
        G.shake(0.02); G.audio.craftTick();
      }
    } else { // wonder
      a.burst -= dt;
      if (a.burst <= 0) {
        a.burst = 0.36;
        const to = tip.clone().add(new T.Vector3((Math.random() - .5) * 1.6, Math.random() * 1.1, (Math.random() - .5) * 1.6));
        G.spawnBeam(tip, to, 0x9b4dff);
        G.spawnSpark(to, 0x9b4dff);
        G.audio.zap();
      }
    }
    if (a.t >= a.dur) {
      C.anim = null;
      barWrap().style.display = 'none';
      for (let i = 0; i < 4; i++) G.spawnSpark(tip, a.type === 'wonder' ? 0x9b4dff : 0xffd060);
      const key = a.pool[(Math.random() * a.pool.length) | 0];
      const pap = Math.random() < 0.3;
      G.Inv.addWeapon(key, { pap });
      G.audio.perkJingle();
      G.showMsg((pap ? '★ ' : '') + G.WEAPONS[key].name + ' crafted!');
    }
  };
  C.onInvToggle = (open) => {
    if (!open) {
      // return grid items to inventory
      for (let i = 0; i < 9; i++) {
        if (C.slots[i]) { G.Inv.addItemAt(C.slots[i]); C.slots[i] = null; }
      }
      C.setMode('pocket');
    } else C.refresh();
  };
  C.openStation = (kind) => {
    G.Inv.toggle(true);
    C.setMode(kind === 'bench' ? 'bench' : 'anvil');
  };
  C.gather = (node) => {
    if (node.cd > 0) return;
    node.cd = 8;
    node.group.scale.setScalar(0.5);
    const n = 1 + (Math.random() < 0.35 ? 1 : 0);
    G.Inv.addMat(node.mat, n);
    G.audio.pickup();
    G.showMsg(`+${n} ${node.mat}`);
  };

  // ---------- zombie material drops ----------
  const drops = [];
  G.Drops = {
    spawn(pos) {
      if (drops.length > 24) return;
      const mat = Math.random() < 0.35 ? 'coal' : 'wood';
      const m = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 0.16),
        new T.MeshStandardMaterial({ color: mat === 'coal' ? 0x111114 : 0x8a5c2e, emissive: mat === 'coal' ? 0x223 : 0x3a2408, emissiveIntensity: 0.5, roughness: 0.7 }));
      m.position.set(pos.x, pos.y + 0.4, pos.z);
      G.scene.add(m);
      drops.push({ mesh: m, mat, t: Math.random() * 6 });
    },
    update(dt) {
      const P = G.player;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.t += dt;
        d.mesh.rotation.y += dt * 2;
        d.mesh.position.y += Math.sin(d.t * 3) * dt * 0.12;
        const dx = P.pos.x - d.mesh.position.x, dz = P.pos.z - d.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2.4 && Math.abs(P.pos.y - d.mesh.position.y) < 1.8) {
          d.mesh.position.x += dx / dist * dt * 7;
          d.mesh.position.z += dz / dist * dt * 7;
          d.mesh.position.y += (P.pos.y + 1 - d.mesh.position.y) * dt * 5;
          if (dist < 0.5) {
            G.Inv.addMat(d.mat, 1);
            G.audio.pickup();
            G.scene.remove(d.mesh);
            drops.splice(i, 1);
          }
        }
        if (d.t > 45) { G.scene.remove(d.mesh); drops.splice(i, 1); }
      }
    }
  };
})();
