// Weapon definitions + procedural 3D viewmodels
window.G = window.G || {};
(() => {
  function tex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const gripWood = tex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5a3418'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.strokeStyle = `rgba(30,15,4,${0.15 + Math.random() * 0.25})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w / 3, y + Math.random() * 4 - 2, w * 2 / 3, y + Math.random() * 4 - 2, w, y); ctx.stroke();
    }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(90,55,25,.3)'; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  });
  const wornMetal = tex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#26272c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${140 + Math.random() * 60},${140 + Math.random() * 60},${150 + Math.random() * 60},${Math.random() * 0.09})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1); }
    for (let i = 0; i < 100; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.25})`; ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });

  const M = {
    metal:  new THREE.MeshStandardMaterial({ map: wornMetal, color: 0x9aa0ac, metalness: 0.85, roughness: 0.42 }),
    metal2: new THREE.MeshStandardMaterial({ color: 0x3a3b40, metalness: 0.8, roughness: 0.45 }),
    steel:  new THREE.MeshStandardMaterial({ color: 0x62656e, metalness: 0.92, roughness: 0.28 }),
    blued:  new THREE.MeshStandardMaterial({ map: wornMetal, color: 0x7c86a0, metalness: 0.9, roughness: 0.35 }),
    wood:   new THREE.MeshStandardMaterial({ map: gripWood, color: 0xa9885f, metalness: 0.05, roughness: 0.75 }),
    woodD:  new THREE.MeshStandardMaterial({ map: gripWood, color: 0x7a5a38, metalness: 0.05, roughness: 0.8 }),
    energy: new THREE.MeshStandardMaterial({ color: 0x18323a, metalness: 0.7, roughness: 0.4, emissive: 0x0f5f6e, emissiveIntensity: 0.6 }),
    // laser shotgun palette
    armor:  new THREE.MeshStandardMaterial({ color: 0xd6dbe2, metalness: 0.35, roughness: 0.42 }),
    gun2:   new THREE.MeshStandardMaterial({ color: 0x1b1d24, metalness: 0.75, roughness: 0.4 }),
    cyan:   new THREE.MeshStandardMaterial({ color: 0x0a3038, emissive: 0x35e6ff, emissiveIntensity: 1.5, metalness: 0.4, roughness: 0.35 }),
    amber:  new THREE.MeshStandardMaterial({ color: 0x3a1c04, emissive: 0xff8a2a, emissiveIntensity: 1.3, metalness: 0.4, roughness: 0.35 }),
  };
  function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m;
  }
  function cyl(r1, r2, h, mat, x = 0, y = 0, z = 0, rx = Math.PI / 2, seg = 14) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
    m.position.set(x, y, z); m.rotation.x = rx; return m;
  }
  function torus(r, t, mat, x, y, z, rx = 0, ry = 0) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20), mat);
    m.position.set(x, y, z); m.rotation.x = rx; m.rotation.y = ry; return m;
  }
  function grp(...kids) { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; }
  function muzzleAt(g, x, y, z) { const o = new THREE.Object3D(); o.position.set(x, y, z); g.add(o); g.userData.muzzle = o; return g; }

  // ---------- Mauser C96 — hero detail ----------
  function buildMauser() {
    const g = grp(
      // barrel: tapered base → thin tube → stepped muzzle
      cyl(0.016, 0.0125, 0.055, M.blued, 0, 0.016, -0.115),
      cyl(0.0105, 0.0105, 0.20, M.blued, 0, 0.016, -0.24),
      cyl(0.0128, 0.0128, 0.018, M.steel, 0, 0.016, -0.338),
      box(0.0075, 0.02, 0.007, M.blued, 0, 0.032, -0.332),           // front sight blade
      box(0.011, 0.006, 0.014, M.blued, 0, 0.024, -0.318),           // sight base
      // receiver: square body + proud side plates + milled panel lines
      box(0.042, 0.052, 0.135, M.blued, 0, 0.004, -0.035),
      box(0.046, 0.036, 0.09, M.metal2, 0, 0.0, -0.03),              // side panel relief
      box(0.043, 0.01, 0.1, M.steel, 0, -0.024, -0.035),             // lower rail line
      // bolt channel + rear bolt with cocking piece
      box(0.024, 0.018, 0.15, M.steel, 0, 0.037, -0.02),
      cyl(0.011, 0.011, 0.035, M.steel, 0, 0.037, 0.062),
      box(0.028, 0.006, 0.02, M.metal2, 0, 0.047, 0.05),             // serration cap
      // tangent rear sight
      box(0.024, 0.008, 0.05, M.metal2, 0, 0.05, -0.075),
      box(0.02, 0.005, 0.045, M.steel, 0, 0.056, -0.078, -0.12),     // sight leaf
      // ring hammer + spur
      torus(0.0115, 0.0032, M.steel, 0, 0.038, 0.083, 0, Math.PI / 2),
      box(0.008, 0.014, 0.01, M.steel, 0, 0.025, 0.08),
      // box magazine ahead of trigger, ribbed
      box(0.03, 0.072, 0.05, M.blued, 0, -0.052, -0.075),
      box(0.032, 0.062, 0.004, M.steel, 0, -0.052, -0.052),
      box(0.032, 0.062, 0.004, M.steel, 0, -0.052, -0.098),
      box(0.034, 0.006, 0.054, M.metal2, 0, -0.09, -0.075),          // floorplate
      // trigger + guard
      box(0.006, 0.005, 0.03, M.steel, 0, -0.055, -0.018),
      box(0.006, 0.024, 0.005, M.steel, 0, -0.066, -0.006),
      box(0.006, 0.005, 0.032, M.steel, 0, -0.077, -0.02),
      box(0.006, 0.016, 0.004, M.steel, 0, -0.062, -0.036, 0.25),    // trigger blade
      // broomhandle grip + cap + lanyard ring
      cyl(0.0165, 0.023, 0.095, M.woodD, 0, -0.078, 0.048, 0.38),
      cyl(0.024, 0.024, 0.008, M.metal2, 0, -0.121, 0.066, 0.38),
      torus(0.008, 0.0022, M.steel, 0, -0.132, 0.072, 0.4, 0),
      // frame screws
      cyl(0.004, 0.004, 0.046, M.steel, 0, 0.004, 0.02, 0, 8),
      cyl(0.004, 0.004, 0.046, M.steel, 0, -0.01, -0.09, 0, 8)
    );
    return muzzleAt(g, 0, 0.016, -0.35);
  }

  // ---------- HELIOS-8 Scatter Laser ----------
  function buildLaser() {
    const g = new THREE.Group();
    const add = (m) => { g.add(m); return m; };
    // chassis + armor cowls
    add(box(0.058, 0.066, 0.33, M.gun2, 0, 0.004, -0.1));
    add(box(0.064, 0.026, 0.3, M.armor, 0, 0.045, -0.09));
    add(box(0.064, 0.03, 0.09, M.armor, 0, 0.036, 0.09, 0.18));      // rear wedge
    add(box(0.05, 0.05, 0.07, M.armor, 0, -0.006, -0.29, -0.14));    // front cowl
    // glowing rails
    add(box(0.008, 0.01, 0.3, M.cyan, -0.033, -0.012, -0.1));
    add(box(0.008, 0.01, 0.3, M.cyan, 0.033, -0.012, -0.1));
    add(box(0.05, 0.008, 0.2, M.cyan, 0, -0.038, -0.13));
    // 8-barrel emitter array
    const shroud = add(cyl(0.037, 0.041, 0.075, M.gun2, 0, 0.004, -0.365));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(cyl(0.0062, 0.0062, 0.085, M.steel, Math.cos(a) * 0.022, 0.004 + Math.sin(a) * 0.022, -0.375));
      add(cyl(0.004, 0.004, 0.01, M.cyan, Math.cos(a) * 0.022, 0.004 + Math.sin(a) * 0.022, -0.418));
    }
    add(cyl(0.011, 0.011, 0.05, M.amber, 0, 0.004, -0.39));          // hot core
    add(torus(0.037, 0.005, M.cyan, 0, 0.004, -0.402, 0, 0));        // glowing muzzle ring
    // energy cell drum + coupling
    const drum = add(cyl(0.034, 0.034, 0.055, M.gun2, 0, -0.055, 0.02, 0));
    drum.rotation.x = 0; drum.rotation.z = Math.PI / 2;
    add(torus(0.035, 0.006, M.amber, 0.0, -0.055, 0.02, 0, Math.PI / 2));
    add(torus(0.035, 0.004, M.cyan, 0.0, -0.055, 0.041, 0, Math.PI / 2));
    // vents
    for (let i = 0; i < 3; i++) {
      add(box(0.004, 0.02, 0.03, M.amber, -0.031, 0.012, -0.2 + i * 0.045));
      add(box(0.004, 0.02, 0.03, M.amber, 0.031, 0.012, -0.2 + i * 0.045));
    }
    // holo sight
    add(box(0.006, 0.022, 0.006, M.gun2, -0.012, 0.068, -0.03));
    add(box(0.006, 0.022, 0.006, M.gun2, 0.012, 0.068, -0.03));
    const holo = add(box(0.026, 0.02, 0.002, new THREE.MeshBasicMaterial({ color: 0x66f0ff, transparent: true, opacity: 0.35 }), 0, 0.085, -0.03));
    add(box(0.005, 0.005, 0.002, M.cyan, 0, 0.085, -0.028));
    // grips
    add(box(0.024, 0.07, 0.03, M.gun2, 0, -0.062, 0.075, 0.3));
    add(box(0.024, 0.06, 0.026, M.gun2, 0, -0.055, -0.24, -0.25));
    add(box(0.02, 0.02, 0.05, M.steel, 0, -0.085, -0.02));           // trigger guard base
    return muzzleAt(g, 0, 0.004, -0.43);
  }

  function buildKar() {
    const g = grp(
      box(0.038, 0.06, 0.62, M.wood, 0, -0.01, -0.12),
      box(0.045, 0.075, 0.16, M.wood, 0, -0.03, 0.20),
      cyl(0.012, 0.012, 0.5, M.steel, 0, 0.025, -0.30),
      box(0.04, 0.045, 0.14, M.blued, 0, 0.02, 0.05),
      cyl(0.008, 0.008, 0.055, M.steel, 0.045, 0.03, 0.05, 0, 8),
      box(0.008, 0.024, 0.008, M.steel, 0, 0.055, -0.53),
      box(0.028, 0.008, 0.04, M.steel, 0, 0.052, -0.02),
      box(0.014, 0.03, 0.03, M.metal2, 0, -0.045, 0.09),
      cyl(0.013, 0.013, 0.02, M.steel, 0, 0.025, -0.545)
    );
    return muzzleAt(g, 0, 0.025, -0.56);
  }
  function buildTrench() {
    const g = grp(
      cyl(0.014, 0.014, 0.44, M.steel, 0, 0.025, -0.24),
      cyl(0.017, 0.017, 0.30, M.wood, 0, -0.012, -0.20),
      box(0.045, 0.06, 0.16, M.blued, 0, 0.005, 0.0),
      box(0.04, 0.06, 0.2, M.woodD, 0, -0.02, 0.17),
      box(0.05, 0.02, 0.4, M.steel, 0, 0.055, -0.22),
      box(0.014, 0.03, 0.03, M.metal2, 0, -0.045, 0.04)
    );
    return muzzleAt(g, 0, 0.025, -0.47);
  }
  function buildSMG() {
    const drum = cyl(0.05, 0.05, 0.03, M.metal2, 0, -0.07, -0.10, 0);
    drum.rotation.set(0, Math.PI / 2, Math.PI / 2);
    const g = grp(
      cyl(0.013, 0.013, 0.28, M.steel, 0, 0.02, -0.22),
      box(0.05, 0.024, 0.3, M.steel, 0, 0.05, -0.2),
      box(0.045, 0.06, 0.2, M.blued, 0, 0.005, -0.01),
      box(0.04, 0.06, 0.16, M.woodD, 0, -0.02, 0.16),
      cyl(0.016, 0.02, 0.07, M.woodD, 0, -0.06, -0.24, 0.3),
      cyl(0.016, 0.02, 0.07, M.woodD, 0, -0.065, 0.05, 0.3),
      drum
    );
    return muzzleAt(g, 0, 0.02, -0.38);
  }
  function buildMG() {
    const g = grp(
      cyl(0.016, 0.016, 0.55, M.steel, 0, 0.02, -0.3),
      box(0.06, 0.05, 0.55, M.metal2, 0, 0.02, -0.28),
      box(0.055, 0.08, 0.24, M.blued, 0, -0.005, 0.06),
      box(0.04, 0.055, 0.14, M.woodD, 0, -0.01, 0.23),
      box(0.02, 0.1, 0.07, M.metal2, -0.045, -0.03, 0.0),
      cyl(0.015, 0.018, 0.07, M.woodD, 0, -0.07, 0.1, 0.3),
      box(0.012, 0.06, 0.012, M.steel, 0.02, -0.09, -0.42, 0.5),
      box(0.012, 0.06, 0.012, M.steel, -0.02, -0.09, -0.42, -0.5)
    );
    return muzzleAt(g, 0, 0.02, -0.6);
  }
  function buildSTG() {
    const g = grp(
      cyl(0.012, 0.012, 0.3, M.steel, 0, 0.03, -0.28),
      box(0.045, 0.06, 0.3, M.blued, 0, 0.01, -0.06),
      box(0.035, 0.12, 0.06, M.metal2, 0, -0.075, -0.11, 0.25),
      box(0.04, 0.05, 0.18, M.woodD, 0, 0.0, 0.18),
      cyl(0.015, 0.019, 0.075, M.woodD, 0, -0.06, 0.02, 0.3),
      box(0.008, 0.025, 0.008, M.steel, 0, 0.06, -0.4),
      box(0.03, 0.03, 0.06, M.metal2, 0, 0.045, -0.02)
    );
    return muzzleAt(g, 0, 0.03, -0.44);
  }
  function buildArc() {
    const g = grp(
      box(0.05, 0.07, 0.2, M.metal2, 0, 0, -0.02),
      cyl(0.012, 0.012, 0.3, M.steel, 0, 0.02, -0.2),
      cyl(0.028, 0.028, 0.02, M.energy, 0, 0.02, -0.16, Math.PI / 2, 16),
      cyl(0.024, 0.024, 0.02, M.energy, 0, 0.02, -0.22, Math.PI / 2, 16),
      cyl(0.02, 0.02, 0.02, M.energy, 0, 0.02, -0.28, Math.PI / 2, 16),
      new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), M.energy.clone()),
      cyl(0.016, 0.02, 0.075, M.woodD, 0, -0.065, 0.04, 0.3),
      box(0.02, 0.05, 0.1, M.energy, 0, 0.055, 0.0)
    );
    g.children[5].position.set(0, 0.02, -0.33);
    return muzzleAt(g, 0, 0.02, -0.35);
  }

  G.WEAPONS = {
    mauser: { name: 'Mauser C96', sound: 'pistol', dmg: 40, headMult: 3.0, mag: 10, reserve: 80,  rpm: 300, auto: false, reload: 2.0, spread: 0.012, pellets: 1, kick: 0.02,  build: buildMauser, cost: 0 },
    kar98:  { name: 'K-98 Bolt Rifle', sound: 'rifle', dmg: 160, headMult: 4.0, mag: 5, reserve: 50, rpm: 46, auto: false, reload: 3.0, spread: 0.004, pellets: 1, kick: 0.06, bolt: true, build: buildKar, cost: 600 },
    trench: { name: 'M97 Trench Gun', sound: 'shotgun', dmg: 26, headMult: 1.5, mag: 6, reserve: 60, rpm: 65, auto: false, reload: 3.2, spread: 0.055, pellets: 8, kick: 0.08, build: buildTrench, cost: 1200 },
    smg:    { name: 'M1928 SMG', sound: 'smg', dmg: 34, headMult: 2.0, mag: 30, reserve: 210, rpm: 620, auto: true, reload: 2.6, spread: 0.02, pellets: 1, kick: 0.014, build: buildSMG, cost: 1750 },
    mg42:   { name: 'MG-42', sound: 'lmg', dmg: 42, headMult: 2.0, mag: 75, reserve: 300, rpm: 900, auto: true, reload: 4.6, spread: 0.028, pellets: 1, kick: 0.018, build: buildMG, boxOnly: true },
    stg:    { name: 'STG-44', sound: 'rifle', dmg: 55, headMult: 2.5, mag: 30, reserve: 180, rpm: 500, auto: true, reload: 2.8, spread: 0.014, pellets: 1, kick: 0.016, build: buildSTG, boxOnly: true },
    laser:  { name: 'HELIOS-8 Scatter Laser', sound: 'laser', dmg: 60, headMult: 2.0, mag: 8, reserve: 64, rpm: 85, auto: false, reload: 2.8, spread: 0.05, pellets: 8, kick: 0.05, beam: 0x35e6ff, flash: 0x4de8ff, build: buildLaser, boxOnly: true },
    arc:    { name: 'Arc Projector', sound: 'arc', dmg: 1200, headMult: 1.0, mag: 3, reserve: 18, rpm: 90, auto: false, reload: 3.2, spread: 0.002, pellets: 1, kick: 0.05, projectile: true, flash: 0x9fe8ff, build: buildArc, boxOnly: true },
  };
  G.BOX_POOL = ['smg', 'mg42', 'stg', 'arc', 'laser', 'trench', 'kar98'];

  G.buildWeaponModel = (key) => {
    const g = G.WEAPONS[key].build();
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    return g;
  };
})();
