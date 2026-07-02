// Game bootstrap: scene, HUD, rounds, mystery box, particles, main loop
window.G = window.G || {};
(() => {
  const T = THREE;
  const $ = id => document.getElementById(id);
  const state = { playing: false, round: 0, points: 500, kills: 0, toSpawn: 0, spawnT: 2, intermission: 0, time: 0, shake: 0 };
  G.zombies = []; G.state = state;
  let renderer, hud = {};

  // ---------- init ----------
  function init() {
    G.scene = new T.Scene();
    G.scene.background = new T.Color(0x05070c);
    G.camera = new T.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 200);
    G.scene.add(G.camera);
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    $('game').appendChild(renderer.domElement);
    addEventListener('resize', () => {
      G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    ['round', 'pointsVal', 'pointsFeed', 'ammo', 'weaponName', 'prompt', 'msg', 'waveBanner', 'bloodOverlay', 'hitmarker', 'perksRow', 'reloadHint', 'hud'].forEach(k => hud[k] = $(k));

    G.buildMap();
    G.initPaP(8.5, 17.2, Math.PI);
    G.initPlayer();
    G.Inv.init();
    G.onSelectionChanged();
    G.bindInput(renderer.domElement);
    initParticles();
    $('loadNote').style.display = 'none';

    $('startBtn').onclick = start;
    $('resumeBtn').onclick = () => { $('pauseOverlay').style.display = 'none'; state.paused = false; if (!G.noLock) tryLock(); };
    $('restartBtn').onclick = () => location.reload();
    document.addEventListener('pointerlockchange', () => {
      if (G.noLock) return;
      if (G.Inv && G.Inv.open) return;
      if (document.pointerLockElement !== renderer.domElement && state.playing && !G.player.dead) {
        $('pauseOverlay').style.display = 'flex'; state.paused = true;
      } else { $('pauseOverlay').style.display = 'none'; state.paused = false; }
    });
    document.addEventListener('keydown', e => {
      if (e.code !== 'Escape' || !G.noLock || !state.playing || G.player.dead) return;
      if (G.Inv && G.Inv.open) return;
      state.paused = !state.paused;
      $('pauseOverlay').style.display = state.paused ? 'flex' : 'none';
    });
    requestAnimationFrame(loop);
  }

  function tryLock() {
    const c = renderer.domElement;
    try {
      const p = c.requestPointerLock ? c.requestPointerLock() : null;
      if (p && p.catch) p.catch(() => enableNoLock());
    } catch (err) { enableNoLock(); }
    setTimeout(() => { if (document.pointerLockElement !== c) enableNoLock(); }, 400);
  }
  G.tryLock = tryLock;
  function enableNoLock() {
    if (G.noLock) return;
    G.noLock = true;
    renderer.domElement.style.cursor = 'none';
    if (state.playing) G.showMsg('Mouse-look active \u00b7 Esc to pause');
  }

  function start() {
    G.audio.resume();
    $('menuOverlay').style.display = 'none';
    hud.hud.style.display = 'block';
    tryLock();
    state.playing = true;
    G.player.pos.copy(G.spawnPoint);
    setTimeout(() => startRound(1), 900);
  }

  // ---------- rounds ----------
  function zHp(r) { return r <= 9 ? 60 + r * 45 : (60 + 9 * 45) * Math.pow(1.08, r - 9); }
  function pickSpeed(r) {
    const roll = Math.random();
    if (r <= 1) return 0.9 + Math.random() * 0.4;
    const sprintChance = Math.min(0.55, Math.max(0, (r - 3) * 0.09));
    if (roll < sprintChance) return 3.1 + Math.random() * 0.8;
    if (roll < 0.65) return 1.7 + Math.random() * 0.7;
    return 1.0 + Math.random() * 0.5;
  }
  function startRound(r) {
    state.round = r;
    state.toSpawn = Math.min(45, Math.round(5 + r * 4.2));
    state.spawnT = 1.2;
    hud.round.textContent = r;
    hud.waveBanner.textContent = 'Round ' + r;
    hud.waveBanner.classList.remove('show'); void hud.waveBanner.offsetWidth;
    hud.waveBanner.classList.add('show');
    G.audio.roundStart();
  }
  function aliveCount() { return G.zombies.filter(z => z.alive && z.state !== 'dead').length; }
  function updateRound(dt) {
    if (state.intermission > 0) {
      state.intermission -= dt;
      if (state.intermission <= 0) startRound(state.round + 1);
      return;
    }
    if (state.toSpawn > 0) {
      state.spawnT -= dt;
      const cap = Math.min(12, 6 + state.round);
      if (state.spawnT <= 0 && aliveCount() < cap) {
        state.spawnT = Math.max(0.8, 2.4 - state.round * 0.12);
        spawnZombie();
      }
    } else if (aliveCount() === 0 && state.round > 0) {
      state.intermission = 8;
      G.audio.roundEnd();
      G.showMsg('Round clear');
    }
  }
  function spawnZombie() {
    const wins = G.windows.filter(w => G.rooms[w.room].unlocked);
    if (!wins.length) return;
    const P = G.player.pos;
    const weights = wins.map(w => 1 / (4 + w.group.position.distanceTo(P)));
    let sum = weights.reduce((a, b) => a + b, 0), roll = Math.random() * sum, win = wins[0];
    for (let i = 0; i < wins.length; i++) { roll -= weights[i]; if (roll <= 0) { win = wins[i]; break; } }
    state.toSpawn--;
    G.zombies.push(new G.Zombie(win, { hp: zHp(state.round), speed: pickSpeed(state.round) }));
  }
  G.onZombieKilled = (z) => { state.kills++; if (z && z.pos && Math.random() < 0.12) G.Drops.spawn(z.pos); };

  // ---------- economy / HUD ----------
  G.addPoints = (n) => {
    state.points += n;
    hud.pointsVal.textContent = state.points;
    const e = document.createElement('div'); e.className = 'pf' + (n < 0 ? ' neg' : ''); e.textContent = (n > 0 ? '+' : '') + n;
    hud.pointsFeed.appendChild(e); setTimeout(() => e.remove(), 1000);
    if (hud.pointsFeed.children.length > 6) hud.pointsFeed.firstChild.remove();
  };
  G.spend = (n) => {
    if (state.points < n) { G.showMsg('Not enough points'); return false; }
    state.points -= n; hud.pointsVal.textContent = state.points;
    const e = document.createElement('div'); e.className = 'pf neg'; e.textContent = '-' + n;
    hud.pointsFeed.appendChild(e); setTimeout(() => e.remove(), 1000);
    return true;
  };
  G.deny = () => G.audio.deny();
  G.updateAmmoHUD = () => {
    const item = G.player.curItem;
    if (!item) { hud.weaponName.textContent = ''; hud.ammo.innerHTML = ''; hud.reloadHint.classList.remove('show'); hud.ammo.classList.remove('low'); return; }
    if (item.type === 'weapon') {
      const st = G.Inv.weaponStats(item);
      hud.weaponName.textContent = st.displayName;
      hud.ammo.innerHTML = `${item.mag} <span class="res">/ ${item.reserve}</span>`;
      hud.ammo.classList.toggle('low', item.mag <= Math.max(2, st.mag * 0.25));
      hud.reloadHint.classList.toggle('show', item.mag === 0 && item.reserve > 0);
    } else if (item.type === 'build') {
      hud.weaponName.textContent = G.Inv.nameFor(item);
      hud.ammo.innerHTML = `<span class="res">50 pts · LMB place · RMB remove</span>`;
      hud.ammo.classList.remove('low'); hud.reloadHint.classList.remove('show');
    } else {
      hud.weaponName.textContent = 'Car Keys';
      hud.ammo.innerHTML = `<span class="res">LMB — deploy · F — enter</span>`;
      hud.ammo.classList.remove('low'); hud.reloadHint.classList.remove('show');
    }
  };
  const PERK_STYLE = { tonic: ['#9e1b1b', 'T'], rapid: ['#b08414', 'R'], fleet: ['#1c5d8a', 'F'], deadeye: ['#5b2a7a', 'D'] };
  G.perkHUD = () => {
    hud.perksRow.innerHTML = '';
    for (const k of G.player.perks) {
      const [c, letter] = PERK_STYLE[k];
      const d = document.createElement('div'); d.className = 'perkIcon';
      d.style.background = `radial-gradient(circle at 35% 30%, ${c}, #100a08 130%)`;
      d.textContent = letter; hud.perksRow.appendChild(d);
    }
  };
  G.setPrompt = (html) => {
    if (!html) { hud.prompt.style.display = 'none'; return; }
    hud.prompt.style.display = 'block';
    if (hud.prompt.innerHTML !== html) hud.prompt.innerHTML = html;
  };
  let msgT = null;
  G.showMsg = (t) => {
    hud.msg.textContent = t; hud.msg.style.opacity = 1;
    clearTimeout(msgT); msgT = setTimeout(() => hud.msg.style.opacity = 0, 1800);
  };
  G.hitmarker = (head) => {
    hud.hitmarker.classList.toggle('head', !!head);
    hud.hitmarker.classList.add('show');
    setTimeout(() => hud.hitmarker.classList.remove('show'), 70);
  };
  G.updateHealthFx = () => {
    const P = G.player;
    const base = Math.max(0, (1 - P.hp / P.maxHp) * 1.05 - 0.05);
    hud.bloodOverlay.style.opacity = Math.min(1, base + state.hurtFlash || 0);
  };
  G.updateFuelHUD = () => {
    const w = $('fuelWrap'); if (!w) return;
    w.style.display = G.player.jetpack ? 'flex' : 'none';
    const f = $('fuelFill');
    f.style.height = Math.round(G.player.jetFuel) + '%';
    f.style.background = G.player.jetFuel < 25 ? '#c8401e' : '#3fa7c8';
  };
  G.damagePlayer = (amt) => {
    const P = G.player;
    if (P.dead) return;
    P.hp -= amt; P.lastDamageT = performance.now() / 1000;
    state.hurtFlash = 0.6;
    G.audio.playerHurt();
    G.shake(0.05);
    G.updateHealthFx();
    if (P.hp <= 0) die();
  };
  function die() {
    G.player.dead = true; state.playing = false;
    document.exitPointerLock();
    $('survStats').textContent = `Survived ${state.round} round${state.round > 1 ? 's' : ''} · ${state.kills} kills`;
    $('deadOverlay').style.display = 'flex';
  }
  G.shake = (a) => state.shake = Math.min(0.12, state.shake + a);

  // ---------- doors ----------
  G.openDoor = (d) => {
    d.open = true;
    G.solids.splice(G.solids.indexOf(d.solid), 1);
    G.rooms[d.unlockRoom].unlocked = true;
    (d.wins || []).forEach(rn => G.rooms[rn] && (G.rooms[rn].unlocked = true));
    G.audio.doorOpen(); G.audio.buy();
    G.showMsg(d.name + ' opened');
    animDoors.push(d);
  };
  const animDoors = [];

  // ---------- mystery box ----------
  G.rollBox = () => {
    const mb = G.mysteryBox;
    mb.state = 'rolling'; mb.t = 0;
    G.audio.boxJingle();
  };
  G.takeBoxWeapon = () => {
    const mb = G.mysteryBox;
    if (mb.state !== 'ready') return;
    G.giveWeapon(mb.weapon);
    G.audio.buy();
    closeBox();
  };
  function closeBox() {
    const mb = G.mysteryBox;
    mb.state = 'closing'; mb.t = 0;
    if (mb.displayModel) { mb.holder.remove(mb.displayModel); mb.displayModel = null; }
  }
  function updateBox(dt) {
    const mb = G.mysteryBox;
    mb.t += dt;
    if (mb.qMats) mb.qMats.forEach((m, i) => m.opacity = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * 1.3 + i * 1.1)));
    const lidTarget = (mb.state === 'rolling' || mb.state === 'ready') ? -2.0 : 0;
    mb.lid.rotation.x += (lidTarget - mb.lid.rotation.x) * Math.min(1, dt * 5);
    const beamTarget = mb.state === 'rolling' ? 0.35 : (mb.state === 'ready' ? 0.15 : 0);
    mb.beam.material.opacity += (beamTarget - mb.beam.material.opacity) * Math.min(1, dt * 4);
    mb.light.intensity += ((mb.state === 'rolling' ? 1.6 : mb.state === 'ready' ? 0.9 : 0) - mb.light.intensity) * Math.min(1, dt * 4);
    if (mb.state === 'rolling') {
      mb.cycleT = (mb.cycleT || 0) - dt;
      if (mb.cycleT <= 0) {
        mb.cycleT = 0.16 + mb.t * 0.04;
        if (mb.displayModel) mb.holder.remove(mb.displayModel);
        const key = G.BOX_POOL[(Math.random() * G.BOX_POOL.length) | 0];
        mb.displayModel = G.buildWeaponModel(key); mb.displayModel.scale.setScalar(1.6);
        mb.displayModel.rotation.y = Math.PI / 2;
        mb.holder.add(mb.displayModel);
      }
      mb.holder.position.y = 1.0 + Math.min(0.5, mb.t * 0.2);
      if (mb.t > 3.6) {
        if (Math.random() < 0.1) {
          // teddy bear — box moves
          mb.state = 'teddy'; mb.t = 0;
          if (mb.displayModel) { mb.holder.remove(mb.displayModel); mb.displayModel = null; }
          mb.teddy.visible = true; mb.teddy.position.y = 0.5; mb.teddy.rotation.y = 0;
          G.audio.teddy();
          G.addPoints(950);
          G.showMsg('The box moves…');
        } else {
          const owned = G.Inv.slots.filter(s => s && s.type === 'weapon').map(s => s.key);
          let pool = G.BOX_POOL.filter(k => !owned.includes(k));
          if (!pool.length) pool = G.BOX_POOL;
          mb.weapon = pool[(Math.random() * pool.length) | 0];
          if (mb.displayModel) mb.holder.remove(mb.displayModel);
          mb.displayModel = G.buildWeaponModel(mb.weapon); mb.displayModel.scale.setScalar(1.6);
          mb.displayModel.rotation.y = Math.PI / 2;
          mb.holder.add(mb.displayModel);
          mb.state = 'ready'; mb.t = 0;
        }
      }
    } else if (mb.state === 'ready') {
      mb.holder.rotation.y += dt * 1.2;
      mb.holder.position.y = 1.5 + Math.sin(mb.t * 2) * 0.05;
      if (mb.t > 9) closeBox();
    } else if (mb.state === 'teddy') {
      mb.teddy.position.y = 0.5 + Math.min(1.1, mb.t * 0.7);
      mb.teddy.rotation.y += dt * 3;
      mb.light.intensity = 1.4 + Math.sin(mb.t * 8) * 0.6;
      if (mb.t > 2.6) {
        mb.teddy.visible = false;
        closeBox();
        const others = G.boxPads.map((_, i) => i).filter(i => i !== mb.padIndex);
        G.moveMysteryBox(others[(Math.random() * others.length) | 0]);
      }
    } else if (mb.state === 'closing') {
      mb.holder.rotation.y = 0;
      if (mb.t > 1.2) { mb.state = 'idle'; }
    }
  }

  // ---------- particles ----------
  let pool = [];
  function initParticles() {
    const geo = new T.PlaneGeometry(0.06, 0.06);
    for (let i = 0; i < 260; i++) {
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0x7a0f0a, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; G.scene.add(m);
      pool.push({ mesh: m, vel: new T.Vector3(), t: 0, life: 0, grav: 1 });
    }
  }
  function emit(pos, n, color, spread, grav) {
    let c = 0;
    for (const p of pool) {
      if (p.t < p.life) continue;
      p.mesh.visible = true; p.mesh.material.color.setHex(color); p.mesh.material.opacity = 1;
      p.mesh.position.copy(pos);
      p.vel.set((Math.random() - .5) * spread, Math.random() * spread * 0.7, (Math.random() - .5) * spread);
      p.t = 0; p.life = 0.5 + Math.random() * 0.5; p.grav = grav;
      p.mesh.scale.setScalar(0.7 + Math.random() * 1.6);
      if (++c >= n) break;
    }
  }
  G.spawnBlood = (pos, n) => emit(pos, n, 0x6e0d08, 3.4, 6);
  G.spawnDust = (pos) => emit(pos, 5, 0x8d8678, 1.4, 1.5);
  G.spawnSpark = (pos, color) => emit(pos, 6, color, 2.6, 2);

  // ---------- laser beams ----------
  const beams = [];
  const beamGeo = new T.CylinderGeometry(0.014, 0.014, 1, 6, 1, true);
  const yAxis = new T.Vector3(0, 1, 0);
  G.spawnBeam = (from, to, color) => {
    const dir = to.clone().sub(from), len = Math.max(0.1, dir.length());
    const m = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    m.position.copy(from).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(yAxis, dir.normalize());
    m.scale.set(1, len, 1);
    G.scene.add(m);
    beams.push({ m, t: 0 });
  };
  function updateBeams(dt) {
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i]; b.t += dt;
      b.m.material.opacity = 0.85 * (1 - b.t / 0.11);
      if (b.t > 0.11) { G.scene.remove(b.m); b.m.material.dispose(); beams.splice(i, 1); }
    }
  }
  function updateParticles(dt) {
    for (const p of pool) {
      if (p.t >= p.life) { if (p.mesh.visible) p.mesh.visible = false; continue; }
      p.t += dt;
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = 1 - p.t / p.life;
      p.mesh.quaternion.copy(G.camera.quaternion);
    }
  }

  // ---------- projectiles (Arc Projector) ----------
  const projectiles = [];
  G.fireProjectile = (origin, dir) => {
    const m = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), new T.MeshBasicMaterial({ color: 0x9fe8ff }));
    m.position.copy(origin).addScaledVector(dir, 0.5);
    const L = new T.PointLight(0x66d4ff, 1.6, 7, 1.6); m.add(L);
    G.scene.add(m);
    projectiles.push({ mesh: m, vel: dir.clone().multiplyScalar(26), t: 0 });
  };
  function pointInSolid(p) {
    for (const s of G.solids)
      if (p.x > s.minX && p.x < s.maxX && p.y > s.minY && p.y < s.maxY && p.z > s.minZ && p.z < s.maxZ) return true;
    return false;
  }
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.t += dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      let boom = pr.t > 2.5 || pointInSolid(pr.mesh.position) || pr.mesh.position.y < 0.05;
      if (!boom) for (const z of G.zombies) {
        if (!z.alive || z.state === 'dead') continue;
        if (pr.mesh.position.distanceTo(new T.Vector3(z.pos.x, z.pos.y + 1, z.pos.z)) < 0.8) { boom = true; break; }
      }
      if (boom) {
        explode(pr.mesh.position.clone());
        G.scene.remove(pr.mesh);
        projectiles.splice(i, 1);
      }
    }
  }
  function explode(at) {
    G.audio.explosion();
    emit(at, 30, 0x9fe8ff, 7, 2);
    emit(at, 20, 0xfff3c0, 5, 3);
    const flash = new T.PointLight(0x9fe8ff, 4, 14, 1.5); flash.position.copy(at); G.scene.add(flash);
    setTimeout(() => G.scene.remove(flash), 130);
    for (const z of G.zombies) {
      if (!z.alive || z.state === 'dead') continue;
      const d = at.distanceTo(new T.Vector3(z.pos.x, z.pos.y + 1, z.pos.z));
      if (d < 4.2) {
        const res = z.takeDamage(1200 * (1 - d / 5), 'body', new T.Vector3(z.pos.x, z.pos.y + 1.2, z.pos.z));
        if (res) { G.addPoints(10); if (res.killed) G.addPoints(50); }
      }
    }
    const pd = at.distanceTo(new T.Vector3(G.player.pos.x, G.player.pos.y + 1, G.player.pos.z));
    if (pd < 3) G.damagePlayer(15);
    G.shake(0.08);
  }

  // ---------- electro-trap ----------
  function updateTrap(dt) {
    const tr = G.Trap; if (!tr) return;
    if (tr.state === 'active') {
      tr.t -= dt;
      if (Math.random() < dt * 14) {
        const a = tr.posA.clone(); a.y = 0.3 + Math.random() * 2.1;
        const b = tr.posB.clone(); b.y = 0.3 + Math.random() * 2.1;
        G.spawnBeam(a, b, 0x9fd8ff);
        if (Math.random() < 0.35) G.audio.zap();
      }
      const zn = tr.zone;
      for (const z of G.zombies) {
        if (!z.alive || z.state === 'dead' || z.pos.y > 2) continue;
        if (z.pos.x > zn.x0 && z.pos.x < zn.x1 && z.pos.z > zn.z0 && z.pos.z < zn.z1) {
          const res = z.takeDamage(360 * dt + 15, 'body', new T.Vector3(z.pos.x, z.pos.y + 1, z.pos.z));
          if (res && res.killed) G.addPoints(50);
        }
      }
      const p = G.player.pos;
      if (p.x > zn.x0 && p.x < zn.x1 && p.z > zn.z0 && p.z < zn.z1 && p.y < 2) {
        tr.hurtT = (tr.hurtT || 0) - dt;
        if (tr.hurtT <= 0) { tr.hurtT = 0.5; G.damagePlayer(8); }
      }
      tr.tips.forEach(t => t.material.emissiveIntensity = 2 + Math.random() * 2);
      if (tr.t <= 0) { tr.state = 'cooldown'; tr.t = 40; tr.tips.forEach(t => t.material.emissiveIntensity = 0.3); }
    } else if (tr.state === 'cooldown') {
      tr.t -= dt;
      if (tr.t <= 0) { tr.state = 'ready'; tr.tips.forEach(t => t.material.emissiveIntensity = 1.2); }
    }
  }

  // ---------- flying boards ----------
  function updateBoards(dt) {
    for (let i = G.flyingBoards.length - 1; i >= 0; i--) {
      const f = G.flyingBoards[i];
      if (!f.attached) { G.scene.attach(f.mesh); f.attached = true; }
      f.t += dt;
      f.vel.y -= 9 * dt;
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += f.rot.x * dt; f.mesh.rotation.y += f.rot.y * dt; f.mesh.rotation.z += f.rot.z * dt;
      if (f.t > 1.4) { f.mesh.visible = false; G.flyingBoards.splice(i, 1); }
    }
  }

  // ---------- main loop ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    state.time += dt;

    // bulbs flicker
    if (G.bulbs) for (const b of G.bulbs) {
      const f = 0.82 + 0.18 * Math.sin(state.time * 11 + b.seed) * Math.sin(state.time * 4.7 + b.seed * 2);
      const black = Math.sin(state.time * 0.7 + b.seed * 3) > 0.985 ? 0.2 : 1;
      b.light.intensity = b.base * f * black;
      b.mesh.material.emissiveIntensity = 2.2 * f * black;
    }

    if (state.playing && !G.player.dead && !state.paused) {
      if (!G.CarSys.driving) { G.updatePlayer(dt); G.Build.update(); }
      G.CarSys.update(dt);
      G.PaP.update(dt);
      G.Craft.update(dt);
      G.Drops.update(dt);
      updateTrap(dt);
      updateRound(dt);
      for (const z of G.zombies) z.update(dt);
      G.zombies = G.zombies.filter(z => z.alive);
      updateBox(dt);
      updateProjectiles(dt);
    }
    updateBoards(dt);
    updateParticles(dt);
    updateBeams(dt);

    // door anims
    for (let i = animDoors.length - 1; i >= 0; i--) {
      const d = animDoors[i];
      d.group.position.y -= dt * 1.4;
      if (d.group.position.y < -2.7) { d.group.visible = false; animDoors.splice(i, 1); }
    }

    // hurt flash decay
    if (state.hurtFlash > 0) { state.hurtFlash = Math.max(0, state.hurtFlash - dt * 1.2); G.updateHealthFx(); }

    // camera shake
    if (state.shake > 0.0005) {
      G.camera.rotation.x += (Math.random() - .5) * state.shake * 0.5;
      G.camera.rotation.y += (Math.random() - .5) * state.shake * 0.5;
      state.shake *= Math.pow(0.002, dt);
    }

    renderer.render(G.scene, G.camera);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
