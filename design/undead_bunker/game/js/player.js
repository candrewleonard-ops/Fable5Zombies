// Player: controls, movement, hotbar items (weapons/build/car), shooting, interaction
window.G = window.G || {};
(() => {
  const T = THREE;
  const P = {
    pos: new T.Vector3(0, 0, 4), yaw: 0, pitch: 0,
    hp: 100, maxHp: 100, baseSpeed: 4.3,
    perks: new Set(),
    curItem: null, curWeapon: null,
    reloading: 0, reloadTotal: 0, fireCd: 0, ads: 0, boltT: 0,
    lastDamageT: -99, dead: false,
    vmKick: 0, bobT: 0, repairT: 0, deployCd: 0,
  };
  G.player = P;
  G.keys = {}; G.mouse = { down: false, rdown: false, clicked: false, rclicked: false };

  let vmRoot, vmWeapon, muzzleFlash, flashLight;

  G.initPlayer = () => {
    vmRoot = new T.Group();
    G.camera.add(vmRoot);
    vmRoot.position.set(0.24, -0.22, -0.45);
    muzzleFlash = new T.Mesh(new T.PlaneGeometry(0.22, 0.22),
      new T.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    G.scene.add(muzzleFlash);
    flashLight = new T.PointLight(0xffc070, 0, 9, 1.8);
    G.scene.add(flashLight);
  };

  G.onSelectionChanged = () => {
    const item = G.Inv.selected();
    P.curItem = item || null;
    P.curWeapon = item && item.type === 'weapon' ? G.Inv.weaponStats(item) : null;
    P.reloading = 0; P.fireCd = 0.25; P.boltT = 0;
    if (vmWeapon) { vmRoot.remove(vmWeapon); vmWeapon = null; }
    G.Build && G.Build.setActive(item && item.type === 'build' ? item.piece : item && item.type === 'place' ? item.kind : null);
    if (item) {
      if (item.type === 'weapon') {
        vmWeapon = G.WEAPONS[item.key].build();
        if (item.pap) vmWeapon.traverse(o => {
          if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.emissive = new T.Color(0x7a2bd6); o.material.emissiveIntensity = 0.4; }
        });
      } else if (item.type === 'build') {
        vmWeapon = G.buildPieceModel(item.piece);
        vmWeapon.scale.setScalar(0.07);
        vmWeapon.position.set(0.02, -0.06, -0.05);
        vmWeapon.rotation.y = 0.4;
      } else if (item.type === 'mat') {
        vmWeapon = G.buildMatModel(item.mat);
        vmWeapon.scale.setScalar(item.mat === 'wand' ? 1 : 0.35);
        vmWeapon.position.set(0, -0.06, -0.05);
      } else if (item.type === 'place') {
        vmWeapon = item.kind === 'bench' ? G.buildBenchModel() : G.buildAnvilModel();
        vmWeapon.scale.setScalar(0.12);
        vmWeapon.position.set(0.02, -0.08, -0.05);
        vmWeapon.rotation.y = 0.5;
      } else if (item.type === 'car') {
        vmWeapon = G.buildCarModel();
        vmWeapon.scale.setScalar(0.055);
        vmWeapon.position.set(0, -0.04, 0);
        vmWeapon.rotation.y = 2.6;
      }
      vmWeapon.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      vmRoot.add(vmWeapon);
    }
    G.updateAmmoHUD && G.updateAmmoHUD();
  };
  G.setHandModel = (model) => {
    if (vmWeapon) { vmRoot.remove(vmWeapon); vmWeapon = null; }
    if (model) {
      model.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      vmWeapon = model;
      vmRoot.add(model);
    } else G.onSelectionChanged();
  };
  G.giveWeapon = (key, opts) => G.Inv.addWeapon(key, opts);

  // ---------- input ----------
  G.bindInput = (canvas) => {
    document.addEventListener('keydown', e => {
      G.keys[e.code] = true;
      if (e.code === 'KeyR') tryReload();
    });
    document.addEventListener('keyup', e => G.keys[e.code] = false);
    document.addEventListener('mousemove', e => {
      if (P.dead || !G.state.playing || G.state.paused || G.CarSys.driving) return;
      if (document.pointerLockElement !== canvas && !G.noLock) return;
      const sens = 0.0021 * (1 - P.ads * 0.45);
      P.yaw -= e.movementX * sens;
      P.pitch -= e.movementY * sens;
      P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
    });
    canvas.addEventListener('mousedown', e => {
      if (document.pointerLockElement !== canvas && !G.noLock) return;
      if (G.state.paused || !G.state.playing) return;
      if (e.button === 0) { G.mouse.down = true; G.mouse.clicked = true; }
      if (e.button === 2) { G.mouse.rdown = true; G.mouse.rclicked = true; }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) G.mouse.down = false;
      if (e.button === 2) G.mouse.rdown = false;
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
      if (!G.state.playing || G.state.paused || G.Inv.open || G.CarSys.driving) return;
      if (document.pointerLockElement !== canvas && !G.noLock) return;
      const d = e.deltaY > 0 ? 1 : -1;
      G.Inv.select(((G.Inv.sel + d) % 9 + 9) % 9);
    });
  };

  function tryReload() {
    const item = P.curItem, def = P.curWeapon;
    if (!item || !def || P.reloading > 0 || item.mag >= def.mag || item.reserve <= 0) return;
    const time = def.reload * (P.perks.has('rapid') ? 0.55 : 1);
    P.reloading = time; P.reloadTotal = time;
    G.audio.reloadStart();
  }

  // segment vs solids (slab method)
  function rayVsSolids(o, d, maxDist) {
    let best = maxDist;
    for (const s of G.solids) {
      let tmin = 0, tmax = best, ok = true;
      const mm = [[s.minX, s.maxX, o.x, d.x], [s.minY, s.maxY, o.y, d.y], [s.minZ, s.maxZ, o.z, d.z]];
      for (const [mn, mx, oo, dd] of mm) {
        if (Math.abs(dd) < 1e-8) { if (oo < mn || oo > mx) { ok = false; break; } }
        else {
          let t1 = (mn - oo) / dd, t2 = (mx - oo) / dd;
          if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) { ok = false; break; }
        }
      }
      if (ok && tmin < best) best = tmin;
    }
    return best;
  }
  G.rayVsSolids = rayVsSolids;
  function headBlocked() {
    const x = P.pos.x, y = P.pos.y + 1.78, z = P.pos.z;
    for (const s of G.solids) if (x > s.minX && x < s.maxX && y > s.minY && y < s.maxY && z > s.minZ && z < s.maxZ) return true;
    return false;
  }

  const raycaster = new T.Raycaster();
  function fire() {
    const item = P.curItem, def = P.curWeapon;
    if (item.mag <= 0) { G.audio.empty(); tryReload(); P.fireCd = 0.3; return; }
    item.mag--;
    P.fireCd = 60 / (def.rpm * (P.perks.has('rapid') ? 1.12 : 1));
    if (def.bolt) { P.boltT = 0.8; setTimeout(() => G.audio.bolt(), 350); }
    G.audio.shot(def.sound);
    P.vmKick = Math.min(0.2, P.vmKick + def.kick);
    P.pitch += def.kick * 0.35;
    G.shake(def.kick * 1.4);

    const mz = new T.Vector3(); vmWeapon.userData.muzzle ? vmWeapon.userData.muzzle.getWorldPosition(mz) : vmRoot.getWorldPosition(mz);
    muzzleFlash.position.copy(mz); muzzleFlash.quaternion.copy(G.camera.quaternion);
    muzzleFlash.material.opacity = 0.9; muzzleFlash.rotation.z = Math.random() * 6;
    flashLight.position.copy(mz); flashLight.intensity = 2.4;
    flashLight.color.setHex(def.flash || 0xffc070);
    muzzleFlash.material.color.setHex(def.flash || 0xffd9a0);

    const origin = new T.Vector3(); G.camera.getWorldPosition(origin);
    if (def.projectile) { G.fireProjectile(origin, camDir(0)); G.updateAmmoHUD(); G.Inv.updateCounts(); return; }

    const hitMeshes = [];
    for (const z of G.zombies) if (z.alive && z.state !== 'dead') hitMeshes.push(...z.hitMeshes);

    for (let p = 0; p < def.pellets; p++) {
      const dir = camDir(def.spread * (P.ads > 0.5 ? 0.4 : 1));
      raycaster.set(origin, dir); raycaster.far = 60;
      const wallT = rayVsSolids(origin, dir, 60);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      let done = false;
      let end = origin.clone().addScaledVector(dir, Math.min(wallT - 0.02, 45));
      for (const h of hits) {
        if (h.distance > wallT + 0.1) break;
        const z = h.object.userData.zombie;
        if (!z || !z.alive || z.state === 'dead') continue;
        const dmg = def.dmg;
        const res = z.takeDamage(dmg, h.object.userData.part, h.point);
        end = h.point.clone();
        if (res) {
          G.hitmarker(res.head);
          G.audio.hitTick(res.head);
          G.addPoints(10);
          if (res.killed) G.addPoints(res.head ? 90 : 50);
        }
        done = true; break;
      }
      if (!done && wallT < 60) G.spawnDust(end);
      if (def.beam) { G.spawnBeam(mz, end, def.beam); G.spawnSpark(end, def.beam); }
    }
    G.updateAmmoHUD(); G.Inv.updateCounts();
  }

  function camDir(spread) {
    const dir = new T.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    if (spread) {
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread * 2;
      dir.z += (Math.random() - 0.5) * spread * 0.5;
      dir.normalize();
    }
    return dir;
  }

  // ---------- interaction ----------
  function nearestInteract() {
    const eye = P.pos.clone(); eye.y += 1.6;
    const list = [];
    for (const win of G.windows) {
      if (!G.rooms[win.room].unlocked) continue;
      const wp = win.group.position.clone(); wp.y = win.floorY;
      if (wp.distanceTo(P.pos) < 2.3 && win.boards.some(b => !b.on))
        list.push({ d: wp.distanceTo(P.pos), type: 'window', win, prompt: '<b>Hold F</b> — Rebuild barricade <b>+10</b>' });
    }
    for (const d of G.doors) {
      if (d.open) continue;
      if (d.pos.distanceTo(eye) < 2.4)
        list.push({ d: d.pos.distanceTo(eye), type: 'door', door: d, prompt: `<b>F</b> — Open ${d.name} <b>[${d.cost}]</b>` });
    }
    for (const pm of G.perkMachines) {
      const pp = pm.pos.clone(); pp.y += 1.2;
      if (pp.distanceTo(eye) < 2.2 && !P.perks.has(pm.key))
        list.push({ d: pp.distanceTo(eye), type: 'perk', pm, prompt: `<b>F</b> — Buy ${pm.name} <b>[${pm.cost}]</b>` });
    }
    for (const wb of G.wallbuys) {
      if (wb.pos.distanceTo(eye) < 2.4) {
        const def = G.WEAPONS[wb.key];
        const ownedItem = G.Inv.slots.find(s => s && s.type === 'weapon' && s.key === wb.key && !s.pap);
        const cost = ownedItem ? Math.round(def.cost / 2 / 10) * 10 : def.cost;
        list.push({ d: wb.pos.distanceTo(eye), type: 'wallbuy', wb, ownedItem, cost, prompt: `<b>F</b> — ${ownedItem ? 'Ammo for' : 'Buy'} ${def.name} <b>[${cost}]</b>` });
      }
    }
    const mb = G.mysteryBox;
    if (mb.pos.distanceTo(P.pos) < 2.5) {
      if (mb.state === 'idle') list.push({ d: 1, type: 'box', prompt: `<b>F</b> — Mystery Box <b>[${mb.cost}]</b>` });
      else if (mb.state === 'ready') list.push({ d: 0.5, type: 'boxTake', prompt: `<b>F</b> — Take ${G.WEAPONS[mb.weapon].name}` });
    }
    if (G.PaP && G.PaP.pos && G.PaP.pos.distanceTo(P.pos) < 2.6) {
      if (G.PaP.state === 'idle' && P.curItem && P.curItem.type === 'weapon' && !P.curItem.pap)
        list.push({ d: 0.6, type: 'pap', prompt: `<b>F</b> — Reforge ${P.curWeapon.displayName} <b>[${G.PaP.cost}]</b>` });
      else if (G.PaP.state === 'ready')
        list.push({ d: 0.4, type: 'papTake', prompt: `<b>F</b> — Take ★ ${G.WEAPONS[G.PaP.item.key].name}` });
      else if (G.PaP.state !== 'idle')
        list.push({ d: 0.7, type: 'papWait', prompt: 'Reforging…' });
    }
    if (G.CarSys.deployed && !G.CarSys.driving && G.CarSys.pos.distanceTo(P.pos) < 2.9)
      list.push({ d: G.CarSys.pos.distanceTo(P.pos), type: 'car', prompt: '<b>F</b> — Enter vehicle' });
    for (const n of G.scavenge) {
      if (n.cd > 0) continue;
      if (n.pos.distanceTo(P.pos) < 2.2)
        list.push({ d: n.pos.distanceTo(P.pos), type: 'scav', node: n, prompt: `<b>F</b> — Gather ${n.mat}` });
    }
    for (const st of G.stations) {
      if (st.pos.distanceTo(P.pos) < 2.3)
        list.push({ d: st.pos.distanceTo(P.pos), type: 'station', st, prompt: `<b>F</b> — Use ${st.kind === 'bench' ? 'Crafting Bench (3×3)' : 'Anvil'}` });
    }
    if (G.Trap && G.Trap.switchPos.distanceTo(eye) < 2.5) {
      if (G.Trap.state === 'ready') list.push({ d: 1, type: 'trap', prompt: `<b>F</b> — Electro-trap <b>[${G.Trap.cost}]</b>` });
      else list.push({ d: 1, type: 'noop', prompt: G.Trap.state === 'active' ? '⚡ TRAP ACTIVE ⚡' : `Trap cooling — ${Math.ceil(G.Trap.t)}s` });
    }
    list.sort((a, b) => a.d - b.d);
    return list[0] || null;
  }

  let fHeld = false, fEdge = false;
  document.addEventListener('keydown', e => { if (e.code === 'KeyF' && !fHeld) { fHeld = true; fEdge = true; } });
  document.addEventListener('keyup', e => { if (e.code === 'KeyF') fHeld = false; });

  function doInteract(it, dt) {
    if (it.type === 'window') {
      if (fHeld) {
        P.repairT += dt;
        if (P.repairT > 0.55) { P.repairT = 0; if (G.addBoard(it.win)) G.addPoints(10); }
      } else P.repairT = 0;
      return;
    }
    if (!fEdge) return;
    if (it.type === 'door') {
      if (G.spend(it.door.cost)) { G.openDoor(it.door); } else G.deny();
    } else if (it.type === 'perk') {
      if (P.perks.size >= 4) { G.showMsg('Max 4 perks'); G.deny(); }
      else if (G.spend(it.pm.cost)) {
        P.perks.add(it.pm.key);
        if (it.pm.key === 'tonic') { P.maxHp = 250; P.hp = 250; }
        G.audio.perkJingle(); G.perkHUD(); G.showMsg(it.pm.name + ' acquired');
      } else G.deny();
    } else if (it.type === 'wallbuy') {
      const def = G.WEAPONS[it.wb.key];
      if (it.ownedItem) {
        const st = G.Inv.weaponStats(it.ownedItem);
        if (it.ownedItem.reserve >= st.reserve) { G.showMsg('Ammo full'); return; }
        if (G.spend(it.cost)) { it.ownedItem.reserve = st.reserve; G.audio.buy(); G.Inv.render(); G.updateAmmoHUD(); } else G.deny();
      } else {
        if (G.spend(it.cost)) { G.Inv.addWeapon(it.wb.key); G.audio.buy(); } else G.deny();
      }
    } else if (it.type === 'box') {
      if (G.spend(G.mysteryBox.cost)) G.rollBox(); else G.deny();
    } else if (it.type === 'boxTake') {
      G.takeBoxWeapon();
    } else if (it.type === 'pap') {
      if (G.spend(G.PaP.cost)) {
        const item = P.curItem;
        G.Inv.slots[G.Inv.sel] = null;
        G.Inv.render();
        G.PaP.insert(item);
        G.onSelectionChanged();
      } else G.deny();
    } else if (it.type === 'papTake') {
      const upgraded = G.PaP.takeOut();
      if (upgraded) {
        G.Inv.addItemAt(upgraded, G.Inv.slots[G.Inv.sel] ? null : G.Inv.sel);
        G.showMsg(G.Inv.weaponStats(upgraded).displayName + ' ready');
        G.audio.perkJingle();
      }
    } else if (it.type === 'car') {
      G.CarSys.enter();
    } else if (it.type === 'scav') {
      G.Craft.gather(it.node);
    } else if (it.type === 'station') {
      G.Craft.openStation(it.st.kind);
    } else if (it.type === 'trap') {
      if (G.spend(G.Trap.cost)) { G.Trap.state = 'active'; G.Trap.t = 25; G.audio.zap(); G.showMsg('Trap active'); } else G.deny();
    }
  }

  // ---------- per-frame ----------
  G.updatePlayer = (dt) => {
    if (P.dead) return;
    const item = P.curItem, def = P.curWeapon;

    // movement
    let mx = 0, mz = 0;
    if (G.keys['KeyW']) mz += 1; if (G.keys['KeyS']) mz -= 1;
    if (G.keys['KeyA']) mx -= 1; if (G.keys['KeyD']) mx += 1;
    const moving = mx || mz;
    const sprinting = G.keys['ShiftLeft'] && mz > 0 && P.reloading <= 0;
    let spd = P.baseSpeed * (P.perks.has('fleet') ? 1.17 : 1) * (sprinting ? 1.42 : 1) * (P.ads > 0.5 ? 0.55 : 1);
    if (moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
      const dx = (mx * cos - mz * sin) * spd * dt;
      const dz = (-mx * sin - mz * cos) * spd * dt;
      G.moveWithCollision(P.pos, dx, dz, 0.34);
      P.bobT += dt * (sprinting ? 11 : 7.5);
    }
    const gy = G.groundAt(P.pos.x, P.pos.z, P.pos.y);
    const thrust = P.jetpack && G.keys['Space'] && P.jetFuel > 0 && !G.Inv.open;
    if (thrust) {
      P.vy = Math.min((P.vy || 0) + 20 * dt, 4.4);
      P.jetFuel = Math.max(0, P.jetFuel - 18 * dt);
      G.updateFuelHUD();
      P.jetSnd = (P.jetSnd || 0) - dt;
      if (P.jetSnd <= 0) { P.jetSnd = 0.12; G.audio.jet(); }
      if (Math.random() < dt * 30) G.spawnSpark(new T.Vector3(P.pos.x + (Math.random() - .5) * 0.4, P.pos.y + 0.15, P.pos.z + (Math.random() - .5) * 0.4), 0xffa040);
    }
    if (thrust || P.pos.y > gy + 0.03) {
      if (!thrust) P.vy = (P.vy || 0) - 13 * dt;
      P.pos.y += P.vy * dt;
      if (P.vy > 0 && headBlocked()) P.vy = 0;
      if (P.pos.y <= gy) { P.pos.y = gy; P.vy = 0; }
      if (P.pos.y > 50) { P.pos.y = 50; P.vy = Math.min(P.vy, 0); }
    } else {
      P.vy = 0;
      P.pos.y += (gy - P.pos.y) * Math.min(1, dt * (gy > P.pos.y ? 14 : 9));
    }

    G.camera.position.set(P.pos.x, P.pos.y + 1.62 + Math.sin(P.bobT) * (moving ? 0.025 : 0), P.pos.z);
    G.camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');

    // ADS (weapons only)
    const wantAds = def && G.mouse.rdown && P.reloading <= 0 ? 1 : 0;
    P.ads += (wantAds - P.ads) * Math.min(1, dt * 9);
    G.camera.fov = 75 - P.ads * 16; G.camera.updateProjectionMatrix();

    // viewmodel pose
    P.vmKick *= Math.pow(0.001, dt);
    const bobX = Math.sin(P.bobT) * 0.012 * (moving ? 1 : 0.2) * (1 - P.ads * 0.8);
    const bobY = Math.abs(Math.cos(P.bobT)) * 0.014 * (moving ? 1 : 0.2) * (1 - P.ads * 0.8);
    const tx = 0.24 * (1 - P.ads);
    const ty = -0.22 * (1 - P.ads) - 0.155 * P.ads;
    vmRoot.position.set(tx + bobX, ty - bobY + P.vmKick * 0.3, -0.45 + P.vmKick);
    vmRoot.rotation.set(P.vmKick * 1.6, 0, bobX * 0.6);
    if (P.reloading > 0 && def) {
      P.reloading -= dt;
      const k = 1 - Math.abs(P.reloading / P.reloadTotal - 0.5) * 2;
      vmRoot.rotation.x -= k * 0.9; vmRoot.position.y -= k * 0.12;
      if (P.reloading <= 0) {
        const need = def.mag - item.mag, take = Math.min(need, item.reserve);
        item.mag += take; item.reserve -= take;
        G.audio.reloadEnd(); G.updateAmmoHUD(); G.Inv.updateCounts();
      }
    }
    if (P.boltT > 0) { P.boltT -= dt; vmRoot.rotation.z += Math.sin((0.8 - P.boltT) * 8) * 0.06; }
    if (G.Craft && G.Craft.anim) {
      const a = G.Craft.anim;
      vmRoot.rotation.z += Math.sin(a.t * (a.type === 'ar' ? 14 : a.type === 'shotgun' ? 6 : 9)) * 0.1;
      vmRoot.rotation.x += -0.15 + Math.sin(a.t * 7) * 0.05;
      vmRoot.position.y += Math.sin(a.t * 9) * 0.015;
    }

    // actions per item type
    P.fireCd -= dt; P.deployCd -= dt;
    if (item && item.type === 'weapon' && def && !(G.Craft && G.Craft.anim)) {
      const wantFire = def.auto ? G.mouse.down : G.mouse.clicked;
      if (wantFire && P.fireCd <= 0 && P.reloading <= 0 && P.boltT <= 0 && !sprinting) fire();
    } else if (item && item.type === 'build') {
      if (G.mouse.clicked) G.Build.place();
      if (G.mouse.rclicked) G.Build.removeTargeted();
    } else if (item && item.type === 'place') {
      if (G.mouse.clicked && G.Build.place({ free: true })) {
        G.Inv.slots[G.Inv.sel] = null;
        G.Inv.render();
        G.onSelectionChanged();
      }
    } else if (item && item.type === 'car') {
      if (G.mouse.clicked && P.deployCd <= 0) {
        P.deployCd = 1.2;
        const fwd = new T.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
        const dp = P.pos.clone().addScaledVector(fwd, 4.6);
        G.CarSys.deploy(dp, P.yaw);
      }
    }
    G.mouse.clicked = false; G.mouse.rclicked = false;
    if (sprinting) { vmRoot.rotation.x += 0.35; vmRoot.position.y -= 0.05; }

    muzzleFlash.material.opacity *= Math.pow(0.0001, dt);
    flashLight.intensity *= Math.pow(0.0001, dt);

    // regen
    if (performance.now() / 1000 - P.lastDamageT > 3.5 && P.hp < P.maxHp) {
      P.hp = Math.min(P.maxHp, P.hp + 40 * dt);
      G.updateHealthFx();
    }

    // interact
    const it = nearestInteract();
    G.setPrompt(it ? it.prompt : null);
    if (it) doInteract(it, dt);
    fEdge = false;
    if (!it) P.repairT = 0;
  };
})();
