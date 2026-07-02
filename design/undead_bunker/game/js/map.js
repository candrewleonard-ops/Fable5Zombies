// Bunker map: geometry, textures, collision, windows/doors/perks/mystery box
window.G = window.G || {};
(() => {
  const T = THREE;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  function makeTex(w, h, draw, rx = 1, ry = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(rx, ry);
    tex.encoding = T.sRGBEncoding;
    return tex;
  }
  function noiseOn(ctx, w, h, n, alpha, dark) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(${dark ? 0 : 255},${dark ? 0 : 255},${dark ? 0 : 255},${alpha * Math.random()})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  }
  const concreteTex = makeTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5d5a54'; ctx.fillRect(0, 0, w, h);
    noiseOn(ctx, w, h, 900, 0.08, true); noiseOn(ctx, w, h, 500, 0.05, false);
    ctx.strokeStyle = 'rgba(30,28,25,.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); let x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (Math.random() - .5) * 60; y += Math.random() * 40; ctx.lineTo(x, y); } ctx.stroke(); }
  }, 2, 1.5);
  const floorTex = makeTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#46433e'; ctx.fillRect(0, 0, w, h);
    noiseOn(ctx, w, h, 1200, 0.1, true); noiseOn(ctx, w, h, 300, 0.04, false);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(20,16,12,.18)'; ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 8 + Math.random() * 30, Math.random() * 3, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.strokeRect(0, 0, w, h);
  }, 6, 6);
  const woodTex = makeTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { ctx.strokeStyle = `rgba(40,22,8,${0.1 + Math.random() * 0.2})`; ctx.beginPath(); ctx.moveTo(0, y + Math.random() * 3); ctx.bezierCurveTo(w / 3, y + Math.random() * 6 - 3, w * 2 / 3, y + Math.random() * 6 - 3, w, y + Math.random() * 3); ctx.stroke(); }
    noiseOn(ctx, w, h, 300, 0.08, true);
  });

  const MAT = {
    wall: new T.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 }),
    floor: new T.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }),
    ceil: new T.MeshStandardMaterial({ color: 0x3a3733, roughness: 0.95 }),
    wood: new T.MeshStandardMaterial({ map: woodTex, roughness: 0.85 }),
    woodDark: new T.MeshStandardMaterial({ color: 0x3e2c18, roughness: 0.9 }),
    metal: new T.MeshStandardMaterial({ color: 0x2e2f33, metalness: 0.7, roughness: 0.5 }),
    dirt: new T.MeshStandardMaterial({ color: 0x2a2620, roughness: 1 }),
  };

  G.solids = []; G.walkables = []; G.windows = []; G.doors = [];
  G.perkMachines = []; G.wallbuys = []; G.flyingBoards = []; G.scavenge = [];

  function solid(minX, maxX, minY, maxY, minZ, maxZ) {
    const s = { minX, maxX, minY, maxY, minZ, maxZ }; G.solids.push(s); return s;
  }
  function boxMesh(w, h, d, mat, x, y, z, opts = {}) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = opts.cast !== false; m.receiveShadow = true;
    G.scene.add(m);
    if (opts.solid !== false && !opts.ry) solid(x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2);
    if (opts.walkTop) G.walkables.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, y: y + h / 2 });
    return m;
  }

  const TH = 0.35;
  function wall(axis, fixed, a0, a1, y0, h, openings = []) {
    openings.sort((p, q) => p.c - q.c);
    let cur = a0;
    const seg = (s0, s1, yb, yt) => {
      if (s1 - s0 < 0.01 || yt - yb < 0.01) return;
      const len = s1 - s0, mid = (s0 + s1) / 2, ym = (yb + yt) / 2;
      if (axis === 'x') boxMesh(len, yt - yb, TH, MAT.wall, mid, ym, fixed);
      else boxMesh(TH, yt - yb, len, MAT.wall, fixed, ym, mid);
    };
    for (const o of openings) {
      seg(cur, o.c - o.w / 2, y0, y0 + h);
      seg(o.c - o.w / 2, o.c + o.w / 2, y0, o.b);
      seg(o.c - o.w / 2, o.c + o.w / 2, o.t, y0 + h);
      cur = o.c + o.w / 2;
    }
    seg(cur, a1, y0, y0 + h);
  }
  function openingBlocker(axis, fixed, c, w, b, t) {
    if (axis === 'x') return solid(c - w / 2, c + w / 2, b, t, fixed - 0.15, fixed + 0.15);
    return solid(fixed - 0.15, fixed + 0.15, b, t, c - w / 2, c + w / 2);
  }

  // ---------- windows & boards ----------
  function addWindow(axis, fixed, c, sillY, room, normalSign) {
    const b = sillY, t = sillY + 1.3, w = 1.7;
    openingBlocker(axis, fixed, c, w, b, t);
    const n = normalSign;
    let outer, inner, spawn, frameRot = 0;
    if (axis === 'x') { outer = v3(c, 0, fixed + n * 0.7); inner = v3(c, 0, fixed - n * 1.2); spawn = v3(c + (Math.random() - .5) * 2, 0, fixed + n * (6 + Math.random() * 3)); }
    else { frameRot = Math.PI / 2; outer = v3(fixed + n * 0.7, 0, c); inner = v3(fixed - n * 1.2, 0, c); spawn = v3(fixed + n * (6 + Math.random() * 3), 0, c + (Math.random() - .5) * 2); }
    const floorY = b - 0.9 < 1 ? 0 : 3.2;
    outer.y = 0; inner.y = floorY; spawn.y = 0;

    const grpPos = axis === 'x' ? v3(c, 0, fixed) : v3(fixed, 0, c);
    const group = new T.Group(); group.position.copy(grpPos); group.rotation.y = frameRot; G.scene.add(group);
    const frame = new T.Mesh(new T.BoxGeometry(w + 0.15, 1.45, 0.1), MAT.woodDark); frame.position.y = (b + t) / 2; group.add(frame);
    const hole = new T.Mesh(new T.BoxGeometry(w - 0.1, 1.28, 0.06), new T.MeshBasicMaterial({ color: 0x05070c })); hole.position.y = (b + t) / 2; group.add(hole);
    const boards = [];
    for (let i = 0; i < 6; i++) {
      const bm = new T.Mesh(new T.BoxGeometry(w + 0.35, 0.19, 0.05), MAT.wood);
      bm.position.set((Math.random() - .5) * 0.12, b + 0.18 + i * 0.2, (i % 2 ? 0.09 : 0.13));
      bm.rotation.z = (Math.random() - .5) * 0.22; bm.castShadow = true;
      group.add(bm); boards.push({ mesh: bm, on: true, home: bm.position.clone(), rot: bm.rotation.z });
    }
    const win = { group, boards, outer, inner, spawn, floorY, room, axis, fixed, c, sill: b };
    G.windows.push(win);
    return win;
  }
  G.ripBoard = (win, board) => {
    board.on = false;
    G.audio.boardRip();
    const m = board.mesh;
    G.flyingBoards.push({ mesh: m, vel: v3((Math.random() - .5) * 2, 2 + Math.random() * 2, (Math.random() - .5) * 2).add(win.group.position.clone().sub(win.inner).normalize().multiplyScalar(-2.5)), rot: v3(Math.random() * 6, Math.random() * 6, Math.random() * 6), t: 0, win });
  };
  G.addBoard = (win) => {
    const board = win.boards.find(b => !b.on);
    if (!board) return false;
    board.on = true;
    const m = board.mesh;
    if (m.parent !== win.group) { m.parent && m.parent.remove(m); win.group.add(m); }
    m.visible = true; m.position.copy(board.home); m.rotation.set(0, 0, board.rot); m.scale.setScalar(1);
    G.flyingBoards = G.flyingBoards.filter(f => f.mesh !== m);
    G.audio.boardAdd();
    return true;
  };

  // free-standing barricade frame (campsite fence gaps). Normal (nx,nz) points OUT of camp.
  function addBarricadeFrame(x, z, nx, nz, room, boardless) {
    const ry = Math.abs(nx) > 0.5 ? Math.PI / 2 : 0;
    const w = 1.7, b = 0.15, t = 2.2;
    const group = new T.Group(); group.position.set(x, 0, z); group.rotation.y = ry; G.scene.add(group);
    const postL = new T.Mesh(new T.BoxGeometry(0.22, 2.5, 0.22), MAT.woodDark); postL.position.set(-w / 2 - 0.15, 1.25, 0); postL.castShadow = true; group.add(postL);
    const postR = postL.clone(); postR.position.x = w / 2 + 0.15; group.add(postR);
    const top = new T.Mesh(new T.BoxGeometry(w + 0.7, 0.22, 0.26), MAT.woodDark); top.position.y = 2.42; top.castShadow = true; group.add(top);
    const boards = [];
    if (!boardless) {
      openingBlocker(ry === 0 ? 'x' : 'z', ry === 0 ? z : x, ry === 0 ? x : z, 0.2, 2.2);
      for (let i = 0; i < 6; i++) {
        const bm = new T.Mesh(new T.BoxGeometry(w + 0.35, 0.19, 0.05), MAT.wood);
        bm.position.set((Math.random() - .5) * 0.12, 0.35 + i * 0.32, (i % 2 ? 0.09 : 0.13));
        bm.rotation.z = (Math.random() - .5) * 0.22; bm.castShadow = true;
        group.add(bm); boards.push({ mesh: bm, on: true, home: bm.position.clone(), rot: bm.rotation.z });
      }
    }
    const outer = v3(x + nx * 0.8, 0, z + nz * 0.8);
    const inner = v3(x - nx * 1.3, 0, z - nz * 1.3);
    const spawn = v3(x + nx * (6 + Math.random() * 3) + (Math.random() - .5) * 2 * Math.abs(nz), 0, z + nz * (6 + Math.random() * 3) + (Math.random() - .5) * 2 * Math.abs(nx));
    const win = { group, boards, outer, inner, spawn, floorY: 0, room, axis: ry === 0 ? 'x' : 'z', fixed: ry === 0 ? z : x, c: ry === 0 ? x : z, sill: 0 };
    G.windows.push(win);
    return win;
  }

  // ---------- rooms / pathing ----------
  const ROOMS = {
    MAIN:    { rects: [{ x0: -14, x1: 14, z0: -10, z1: 10 }], lo: true, unlocked: true },
    ARMORY:  { rects: [{ x0: -26, x1: -14, z0: -2, z1: 10 }], lo: true, unlocked: false },
    STORAGE: { rects: [{ x0: 5.2, x1: 14, z0: 10, z1: 18 }], lo: true, unlocked: false },
    CAMP:    { rects: [{ x0: -34, x1: 0, z0: 10, z1: 34 }], lo: true, unlocked: false },
    UPPER:   { rects: [{ x0: -14, x1: 6.8, z0: 0, z1: 10 }], hi: true, unlocked: false },
  };
  const PORTALS = [
    { a: 'MAIN', b: 'ARMORY', pts: [v3(-14, 0, 4)] },
    { a: 'MAIN', b: 'STORAGE', pts: [v3(9.5, 0, 10)] },
    { a: 'MAIN', b: 'UPPER', pts: [v3(-9.5, 0, 9.05), v3(-12.9, 3.2, 9.05), v3(-12.3, 3.2, 7.3)] },
    { a: 'ARMORY', b: 'CAMP', pts: [v3(-20, 0, 10)] },
  ];
  const STAIR_ZONE = { x0: -13.6, x1: -9.3, z0: 8.2, z1: 10 };
  G.rooms = ROOMS;
  G.roomAt = (pos) => {
    if (pos.x >= STAIR_ZONE.x0 && pos.x <= STAIR_ZONE.x1 && pos.z >= STAIR_ZONE.z0 && pos.z <= STAIR_ZONE.z1)
      return pos.y > 1.6 ? 'UPPER' : 'MAIN';
    const hi = pos.y > 1.8;
    for (const k in ROOMS) {
      const r = ROOMS[k];
      if (r.hi && !hi) continue;
      if (r.lo && hi) continue;
      for (const rc of r.rects) if (pos.x >= rc.x0 && pos.x <= rc.x1 && pos.z >= rc.z0 && pos.z <= rc.z1) return k;
    }
    return 'MAIN';
  };
  G.pathChain = (from, to) => {
    if (from === to) return null;
    const q = [[from]]; const seen = new Set([from]);
    while (q.length) {
      const path = q.shift(); const cur = path[path.length - 1];
      if (cur === to) {
        const next = path[1];
        const portal = PORTALS.find(pt => (pt.a === from && pt.b === next) || (pt.b === from && pt.a === next));
        if (!portal) return null;
        const pts = portal.a === from ? [...portal.pts] : [...portal.pts].reverse();
        return pts.map(p => p.clone());
      }
      for (const pt of PORTALS) {
        let nb = null;
        if (pt.a === cur) nb = pt.b; else if (pt.b === cur) nb = pt.a;
        if (nb && !seen.has(nb) && ROOMS[nb].unlocked) { seen.add(nb); q.push([...path, nb]); }
      }
    }
    return null;
  };

  // ---------- collision ----------
  G.moveWithCollision = (pos, dx, dz, radius) => {
    const feet = pos.y;
    const hits = (x, z) => {
      for (const s of G.solids) {
        if (s.maxY - feet < 0.5 || s.minY > feet + 1.6) continue;
        if (x + radius > s.minX && x - radius < s.maxX && z + radius > s.minZ && z - radius < s.maxZ) return true;
      }
      return false;
    };
    if (!hits(pos.x + dx, pos.z)) pos.x += dx;
    if (!hits(pos.x, pos.z + dz)) pos.z += dz;
  };
  G.groundAt = (x, z, feet = Infinity) => {
    let best = 0;
    for (const w of G.walkables) {
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ && w.y <= feet + 0.55 && w.y > best) best = w.y;
    }
    return best;
  };
  G.volAt = (pos) => { const d = G.player ? Math.hypot(pos.x - G.player.pos.x, pos.z - G.player.pos.z) : 20; return 1 / (1 + d * 0.22); };

  // ---------- standalone display models (asset library) ----------
  G.buildPerkModel = (name, color) => {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(0.8, 1.75, 0.55), new T.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0.5, roughness: 0.5 }));
    body.position.y = 0.875; body.castShadow = true; g.add(body);
    const label = makeTex(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#0d0d10'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.fillRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(14, 60, w - 28, 130);
      ctx.fillStyle = '#f5eeda'; ctx.font = 'bold 26px Georgia'; ctx.textAlign = 'center';
      name.split(' ').forEach((wd, i) => ctx.fillText(wd, w / 2, 105 + i * 34));
      ctx.font = '44px Georgia'; ctx.fillText('♦', w / 2, 46);
    });
    const face = new T.Mesh(new T.PlaneGeometry(0.72, 1.6), new T.MeshStandardMaterial({ map: label, emissive: 0xffffff, emissiveMap: label, emissiveIntensity: 0.55, roughness: 0.6 }));
    face.position.set(0, 0.9, 0.283); g.add(face);
    return g;
  };
  G.buildMysteryBoxModel = (open) => {
    const g = new T.Group();
    const crate = new T.Mesh(new T.BoxGeometry(1.9, 0.62, 0.62), MAT.wood); crate.position.y = 0.45; crate.castShadow = true; g.add(crate);
    const trim = new T.Mesh(new T.BoxGeometry(1.94, 0.08, 0.66), new T.MeshStandardMaterial({ color: 0xc7a24a, metalness: 0.8, roughness: 0.35, emissive: 0x66500f, emissiveIntensity: 0.5 }));
    trim.position.y = 0.72; g.add(trim);
    const legs = new T.Mesh(new T.BoxGeometry(1.72, 0.16, 0.5), MAT.woodDark); legs.position.y = 0.08; g.add(legs);
    const lid = new T.Group(); lid.position.set(0, 0.76, -0.31); g.add(lid);
    const lidM = new T.Mesh(new T.BoxGeometry(1.9, 0.07, 0.62), MAT.woodDark); lidM.position.set(0, 0.035, 0.31); lid.add(lidM);
    const qT = makeTex(256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#eaf4ff'; ctx.font = 'bold 96px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', w * 0.3, h * 0.55); ctx.fillText('?', w * 0.7, h * 0.55);
    });
    const qM = new T.MeshBasicMaterial({ map: qT, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, color: 0x86c8ff });
    const qF = new T.Mesh(new T.PlaneGeometry(1.6, 0.52), qM); qF.position.set(0, 0.45, 0.315); g.add(qF);
    const qB = new T.Mesh(new T.PlaneGeometry(1.6, 0.52), qM.clone()); qB.rotation.y = Math.PI; qB.position.set(0, 0.45, -0.315); g.add(qB);
    if (open) {
      lid.rotation.x = -1.9;
      const glow = new T.Mesh(new T.PlaneGeometry(1.7, 0.52), new T.MeshBasicMaterial({ color: 0x86c8ff, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.78; g.add(glow);
    }
    return g;
  };

  // ---------- build ----------
  G.buildMap = () => {
    const S = G.scene;
    S.fog = new T.Fog(0x05070c, 16, 62);

    const sky = makeTex(1024, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0a1220'); g.addColorStop(0.55, '#060a12'); g.addColorStop(1, '#03040a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`; ctx.fillRect(Math.random() * w, Math.random() * h * 0.6, 1, 1); }
      const mx = w * 0.72, my = h * 0.26;
      const glow = ctx.createRadialGradient(mx, my, 8, mx, my, 90);
      glow.addColorStop(0, 'rgba(210,225,255,.9)'); glow.addColorStop(0.2, 'rgba(180,200,240,.35)'); glow.addColorStop(1, 'rgba(180,200,240,0)');
      ctx.fillStyle = glow; ctx.fillRect(mx - 90, my - 90, 180, 180);
      ctx.fillStyle = '#dfe8f5'; ctx.beginPath(); ctx.arc(mx, my, 22, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(160,175,200,.5)'; ctx.beginPath(); ctx.arc(mx - 7, my + 4, 6, 0, 7); ctx.fill();
    });
    S.add(new T.Mesh(new T.SphereGeometry(140, 24, 16), new T.MeshBasicMaterial({ map: sky, side: T.BackSide, fog: false })));

    S.add(new T.HemisphereLight(0x223044, 0x0a0806, 0.5));
    const moon = new T.DirectionalLight(0x9db4dd, 0.5);
    moon.position.set(40, 50, -60); moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 5, far: 200 });
    S.add(moon);

    const ground = new T.Mesh(new T.PlaneGeometry(280, 280), MAT.dirt);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; S.add(ground);
    G.walkables.push({ minX: -140, maxX: 140, minZ: -140, maxZ: 140, y: 0 });

    const floor = (x0, x1, z0, z1, y) => {
      const m = new T.Mesh(new T.BoxGeometry(x1 - x0, 0.25, z1 - z0), MAT.floor);
      m.position.set((x0 + x1) / 2, y - 0.125, (z0 + z1) / 2); m.receiveShadow = true; S.add(m);
      G.walkables.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y });
      if (y > 0) solid(x0, x1, y - 0.25, y, z0, z1);
    };
    floor(-14, 14, -10, 10, 0.02); floor(-26, -14, -2, 10, 0.02); floor(5.2, 14, 10, 18, 0.02);
    floor(-14, 6.8, 0, 8.2, 3.2); floor(-9.7, 6.8, 8.2, 10, 3.2); // mezzanine w/ stair opening

    const ceil = (x0, x1, z0, z1, y) => { const m = new T.Mesh(new T.BoxGeometry(x1 - x0, 0.25, z1 - z0), MAT.ceil); m.position.set((x0 + x1) / 2, y + 0.125, (z0 + z1) / 2); S.add(m); };
    ceil(-14, 14, -10, 10, 6.4); ceil(-26, -14, -2, 10, 3.2); ceil(5.2, 14, 10, 18, 3.2);

    // ===== walls =====
    wall('x', -10, -14, 14, 0, 6.4, [{ c: -8, w: 1.7, b: 0.9, t: 2.2 }, { c: 0, w: 1.7, b: 0.9, t: 2.2 }]);
    wall('z', 14, -10, 10, 0, 6.4, [{ c: -4, w: 1.7, b: 0.9, t: 2.2 }]);
    wall('z', -14, -10, -2, 0, 6.4, [{ c: -6, w: 1.7, b: 0.9, t: 2.2 }]);
    wall('z', -14, -2, 10, 0, 3.2, [{ c: 4, w: 1.5, b: 0, t: 2.5 }]);           // armory shared + door
    wall('z', -14, -2, 10, 3.2, 3.2, []);                                        // mezz west face
    wall('x', 10, -14, 5.2, 0, 3.2, []);                                         // main south ground
    wall('x', 10, 5.2, 14, 0, 3.2, [{ c: 9.5, w: 1.5, b: 0, t: 2.5 }]);          // storage shared + door
    wall('x', 10, -14, 6.8, 3.2, 3.2, [{ c: -8, w: 1.7, b: 4.1, t: 5.4 }, { c: -1, w: 1.7, b: 4.1, t: 5.4 }, { c: 4, w: 1.7, b: 4.1, t: 5.4 }]); // upper south + 3 windows
    wall('x', 10, 6.8, 14, 3.2, 3.2, []);
    wall('z', 6.8, 0, 10, 3.2, 3.2, []);                                         // mezz east wall
    wall('z', -26, -2, 10, 0, 3.2, [{ c: 4, w: 1.7, b: 0.9, t: 2.2 }]);          // armory west
    wall('x', -2, -26, -14, 0, 3.2, [{ c: -20, w: 1.7, b: 0.9, t: 2.2 }]);       // armory north
    wall('x', 10, -26, -14, 0, 3.2, [{ c: -20, w: 1.5, b: 0, t: 2.5 }]);           // armory south + campsite door
    wall('z', 14, 10, 18, 0, 3.2, [{ c: 14, w: 1.7, b: 0.9, t: 2.2 }]);          // storage east
    wall('x', 18, 5.2, 14, 0, 3.2, [{ c: 9, w: 1.7, b: 0.9, t: 2.2 }]);          // storage south
    wall('z', 5.2, 10, 18, 0, 3.2, []);                                          // storage west

    // stairs (MAIN west, up to mezzanine) + side stringer
    for (let i = 0; i < 10; i++) {
      const sx = -9.9 - i * 0.33;
      boxMesh(0.34, 0.32 * (i + 1), 1.5, MAT.wall, sx, (0.32 * (i + 1)) / 2, 9.05, { walkTop: true });
    }
    boxMesh(3.9, 3.2, 0.14, MAT.wood, -11.6, 1.6, 8.22);

    // columns + mezz edge beam + railings
    boxMesh(0.7, 6.4, 0.7, MAT.wall, 5, 3.2, -3);
    boxMesh(0.7, 6.4, 0.7, MAT.wall, -5, 3.2, -3);
    boxMesh(0.5, 3.2, 0.5, MAT.wall, -8, 1.6, 0);
    boxMesh(0.5, 3.2, 0.5, MAT.wall, 2, 1.6, 0);
    boxMesh(21, 0.3, 0.35, MAT.woodDark, -3.5, 3.05, 0.05, { solid: false });
    boxMesh(20.9, 0.09, 0.09, MAT.woodDark, -3.55, 3.98, 0.04, { solid: false, cast: false });
    for (let px = -13.5; px <= 6.6; px += 2.5) boxMesh(0.07, 0.78, 0.07, MAT.woodDark, px, 3.6, 0.04, { solid: false, cast: false });
    boxMesh(0.09, 0.09, 1.85, MAT.woodDark, -9.7, 3.98, 9.1, { solid: false, cast: false });
    boxMesh(4.3, 0.09, 0.09, MAT.woodDark, -11.85, 3.98, 8.22, { solid: false, cast: false });

    // ===== props =====
    boxMesh(1.1, 1.0, 1.1, MAT.wood, 12, 0.5, -8);
    boxMesh(0.9, 0.9, 0.9, MAT.wood, 11, 0.45, -8.7);
    boxMesh(0.9, 0.75, 0.9, MAT.wood, 11.5, 1.28, -8.3, { solid: false });
    boxMesh(2.2, 0.55, 0.9, MAT.dirt, 0.5, 0.275, -2.2, { walkTop: true });
    boxMesh(1.6, 0.5, 0.8, MAT.dirt, 0.5, 0.8, -2.25, { walkTop: true });
    boxMesh(2.0, 0.55, 0.9, MAT.dirt, 3.1, 0.275, -2.2, { walkTop: true });
    const barrel = (x, z) => { const m = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 1.05, 14), MAT.metal); m.position.set(x, 0.525, z); m.castShadow = m.receiveShadow = true; G.scene.add(m); solid(x - 0.42, x + 0.42, 0, 1.05, z - 0.42, z + 0.42); };
    barrel(13, 8); barrel(-12.5, -9.2); barrel(-25.2, -1.1); barrel(13.2, 11);
    boxMesh(1.0, 0.95, 1.0, MAT.wood, -24.5, 0.475, 8.6);
    boxMesh(0.9, 0.85, 0.9, MAT.wood, -15.6, 0.43, -1.2);
    boxMesh(1.0, 0.95, 1.0, MAT.wood, 6.2, 0.475, 17.1);
    boxMesh(1.0, 0.95, 1.0, MAT.wood, 6.2, 0.475, 16.0);
    boxMesh(0.9, 0.8, 0.9, MAT.wood, 6.25, 1.35, 16.6, { solid: false });
    boxMesh(1.0, 0.95, 1.0, MAT.wood, 5.8, 3.2 + 0.475, 1.4);
    boxMesh(2.0, 0.5, 0.9, MAT.dirt, 0, 3.2 + 0.25, 8.8, { walkTop: true });
    boxMesh(0.9, 0.85, 0.9, MAT.wood, -12.2, 3.2 + 0.43, 6.4);
    for (let bx = -12; bx <= 12; bx += 4) boxMesh(0.3, 0.3, 19.6, MAT.woodDark, bx, 6.15, 0, { solid: false, cast: false });

    // hanging bulbs
    G.bulbs = [];
    const bulb = (x, y, z, shadow, wireLen = 0.5) => {
      const wire = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, wireLen), MAT.metal); wire.position.set(x, y + wireLen / 2 + 0.05, z); G.scene.add(wire);
      const bm = new T.Mesh(new T.SphereGeometry(0.07, 10, 8), new T.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 2.2 }));
      bm.position.set(x, y, z); G.scene.add(bm);
      const L = new T.PointLight(0xffb35c, 0.95, 12, 1.6); L.position.set(x, y - 0.05, z);
      if (shadow) { L.castShadow = true; L.shadow.mapSize.set(512, 512); }
      G.scene.add(L);
      G.bulbs.push({ light: L, mesh: bm, base: 0.95, seed: Math.random() * 10 });
    };
    bulb(0, 4.6, -5, true, 1.75);
    bulb(-8, 4.6, -3, false, 1.75);
    bulb(9.5, 4.4, 4.5, false, 1.95);
    bulb(-5, 2.72, 5.5, false);
    bulb(2, 2.72, 2.5, false);
    bulb(-20, 2.72, 4, false);
    bulb(9.5, 2.72, 14, false);
    bulb(-4, 5.75, 6, true, 0.6);

    // ===== doors =====
    const mkDoor = (x, z, ry, cost, name, unlockRoom) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.scene.add(g);
      for (let i = 0; i < 6; i++) {
        const p = new T.Mesh(new T.BoxGeometry(0.24, 2.45, 0.09), MAT.wood);
        p.position.set(-0.62 + i * 0.25, 1.22, (i % 2) * 0.05); p.rotation.z = (Math.random() - .5) * 0.06; p.castShadow = true; g.add(p);
      }
      const cross = new T.Mesh(new T.BoxGeometry(1.55, 0.2, 0.06), MAT.woodDark); cross.position.set(0, 1.5, 0.1); cross.rotation.z = 0.25; g.add(cross);
      const sld = ry === 0 ? solid(x - 0.8, x + 0.8, 0, 2.5, z - 0.18, z + 0.18) : solid(x - 0.18, x + 0.18, 0, 2.5, z - 0.8, z + 0.8);
      const d = { group: g, solid: sld, cost, name, unlockRoom, open: false, pos: v3(x, 1.2, z), anim: 0 };
      G.doors.push(d); return d;
    };
    mkDoor(-14, 4, Math.PI / 2, 750, 'Armory', 'ARMORY');
    mkDoor(9.5, 10, 0, 1000, 'Storage Room', 'STORAGE');
    mkDoor(-9.45, 9.05, Math.PI / 2, 1250, 'Upper Quarters', 'UPPER');
    mkDoor(-20, 10, 0, 1500, 'Campsite', 'CAMP');

    // ===== windows =====
    addWindow('x', -10, -8, 0.9, 'MAIN', -1);
    addWindow('x', -10, 0, 0.9, 'MAIN', -1);
    addWindow('z', 14, -4, 0.9, 'MAIN', 1);
    addWindow('z', -14, -6, 0.9, 'MAIN', -1);
    addWindow('z', -26, 4, 0.9, 'ARMORY', -1);
    addWindow('x', -2, -20, 0.9, 'ARMORY', -1);
    addWindow('z', 14, 14, 0.9, 'STORAGE', 1);
    addWindow('x', 18, 9, 0.9, 'STORAGE', 1);
    addWindow('x', 10, -8, 4.1, 'UPPER', 1);
    addWindow('x', 10, -1, 4.1, 'UPPER', 1);
    addWindow('x', 10, 4, 4.1, 'UPPER', 1);

    // ===== perk machines =====
    const mkPerk = (x, z, ry, key, name, color, cost, y = 0) => {
      const g = new T.Group(); g.position.set(x, y, z); g.rotation.y = ry; G.scene.add(g);
      const body = new T.Mesh(new T.BoxGeometry(0.8, 1.75, 0.55), new T.MeshStandardMaterial({ color: 0x1c1d21, metalness: 0.5, roughness: 0.5 }));
      body.position.y = 0.875; body.castShadow = true; g.add(body);
      const label = makeTex(128, 256, (ctx, w, h) => {
        ctx.fillStyle = '#0d0d10'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.fillRect(8, 8, w - 16, h - 16);
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(14, 60, w - 28, 130);
        ctx.fillStyle = '#f5eeda'; ctx.font = 'bold 26px Georgia'; ctx.textAlign = 'center';
        name.split(' ').forEach((wd, i) => ctx.fillText(wd, w / 2, 105 + i * 34));
        ctx.font = '44px Georgia'; ctx.fillText('♦', w / 2, 46);
      });
      const face = new T.Mesh(new T.PlaneGeometry(0.72, 1.6), new T.MeshStandardMaterial({ map: label, emissive: 0xffffff, emissiveMap: label, emissiveIntensity: 0.55, roughness: 0.6 }));
      face.position.set(0, 0.9, 0.283); g.add(face);
      const L = new T.PointLight(color, 0.8, 5, 1.8); L.position.set(0, 1.4, 0.6); g.add(L);
      solid(x - 0.45, x + 0.45, y, y + 1.75, z - 0.32, z + 0.32);
      G.perkMachines.push({ group: g, key, name, color, cost, pos: v3(x, y, z), light: L });
    };
    mkPerk(13.45, -9.2, -Math.PI / 2, 'tonic', 'TOUGH TONIC', 0x9e1b1b, 2500);
    mkPerk(-25.35, 9.2, Math.PI / 2, 'rapid', 'RAPID ROUNDS', 0xb08414, 3000);
    mkPerk(-13.35, 2, Math.PI / 2, 'fleet', 'FLEET FOOT', 0x1c5d8a, 2000, 3.2);
    mkPerk(13.45, 17.2, -Math.PI / 2, 'deadeye', 'DEADEYE', 0x5b2a7a, 2500);

    // ===== wall buys (chalk) =====
    const mkWallbuy = (x, y, z, ry, key) => {
      const wpn = G.WEAPONS[key];
      const wtex = makeTex(256, 128, (ctx, w, h) => {
        ctx.strokeStyle = 'rgba(235,230,215,.85)'; ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
        ctx.strokeRect(6, 6, w - 12, h - 12); ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(235,230,215,.9)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(40, 58); ctx.lineTo(150, 58); ctx.lineTo(210, 52); ctx.moveTo(70, 58); ctx.lineTo(70, 74); ctx.lineTo(92, 74); ctx.moveTo(120, 58); ctx.lineTo(116, 80); ctx.stroke();
        ctx.fillStyle = 'rgba(235,230,215,.92)'; ctx.font = '20px Georgia'; ctx.textAlign = 'center';
        ctx.fillText(wpn.name.toUpperCase(), w / 2, 32);
        ctx.fillText('COST ' + wpn.cost, w / 2, 108);
      });
      const m = new T.Mesh(new T.PlaneGeometry(1.5, 0.75), new T.MeshBasicMaterial({ map: wtex, transparent: true, opacity: 0.92 }));
      m.position.set(x, y, z); m.rotation.y = ry; G.scene.add(m);
      G.wallbuys.push({ mesh: m, key, pos: v3(x, y, z) });
    };
    mkWallbuy(4, 1.7, -9.79, 0, 'kar98');
    mkWallbuy(10.5, 1.7, 17.79, Math.PI, 'trench');
    mkWallbuy(6.61, 4.9, 5, -Math.PI / 2, 'smg');

    // ===== mystery box (relocatable, teddy bear) =====
    G.boxPads = [
      { x: -24.9, z: 0.8, ry: Math.PI / 2 },
      { x: -16, z: 19.5, ry: 0 },
      { x: 8.5, z: -8.6, ry: 0 },
    ];
    G.boxPads.forEach(p => {
      const pal = new T.Mesh(new T.BoxGeometry(2.2, 0.1, 1.0), MAT.woodDark);
      pal.position.set(p.x, 0.05, p.z); pal.rotation.y = p.ry; pal.receiveShadow = true; S.add(pal);
    });
    const qTex = makeTex(256, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#eaf4ff'; ctx.font = 'bold 96px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', w * 0.3, h * 0.55); ctx.fillText('?', w * 0.7, h * 0.55);
    });
    const mb = new T.Group(); S.add(mb);
    const crate = new T.Mesh(new T.BoxGeometry(1.9, 0.62, 0.62), MAT.wood); crate.position.y = 0.45; crate.castShadow = true; mb.add(crate);
    const trim = new T.Mesh(new T.BoxGeometry(1.94, 0.08, 0.66), new T.MeshStandardMaterial({ color: 0xc7a24a, metalness: 0.8, roughness: 0.35, emissive: 0x66500f, emissiveIntensity: 0.5 }));
    trim.position.y = 0.72; mb.add(trim);
    const legs = new T.Mesh(new T.BoxGeometry(1.72, 0.16, 0.5), MAT.woodDark); legs.position.y = 0.08; mb.add(legs);
    const lid = new T.Group(); lid.position.set(0, 0.76, -0.31); mb.add(lid);
    const lidM = new T.Mesh(new T.BoxGeometry(1.9, 0.07, 0.62), MAT.woodDark); lidM.position.set(0, 0.035, 0.31); lid.add(lidM);
    const qMatF = new T.MeshBasicMaterial({ map: qTex, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, color: 0x86c8ff });
    const qF = new T.Mesh(new T.PlaneGeometry(1.6, 0.52), qMatF); qF.position.set(0, 0.45, 0.315); mb.add(qF);
    const qMatB = qMatF.clone();
    const qB = new T.Mesh(new T.PlaneGeometry(1.6, 0.52), qMatB); qB.rotation.y = Math.PI; qB.position.set(0, 0.45, -0.315); mb.add(qB);
    const beam = new T.Mesh(new T.CylinderGeometry(0.16, 0.34, 3.2, 12, 1, true),
      new T.MeshBasicMaterial({ color: 0x86c8ff, transparent: true, opacity: 0.0, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false }));
    beam.position.y = 2.2; mb.add(beam);
    const skyBeam = new T.Mesh(new T.CylinderGeometry(0.35, 1.3, 60, 10, 1, true),
      new T.MeshBasicMaterial({ color: 0x86c8ff, transparent: true, opacity: 0.045, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false }));
    skyBeam.position.y = 30; mb.add(skyBeam);
    const skyCore = new T.Mesh(new T.CylinderGeometry(0.1, 0.45, 60, 8, 1, true),
      new T.MeshBasicMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.08, blending: T.AdditiveBlending, side: T.DoubleSide, depthWrite: false, fog: false }));
    skyCore.position.y = 30; mb.add(skyCore);
    const holder = new T.Group(); holder.position.y = 1.15; mb.add(holder);
    const boxLight = new T.PointLight(0x86c8ff, 0, 6, 1.6); boxLight.position.set(0, 1.4, 0); mb.add(boxLight);
    // teddy bear
    const fur = new T.MeshStandardMaterial({ color: 0x6b4728, roughness: 0.95 });
    const furD = new T.MeshStandardMaterial({ color: 0x4e3018, roughness: 0.95 });
    const teddy = new T.Group();
    const tb = (w, h, d, m, x, y, z) => { const q = new T.Mesh(new T.BoxGeometry(w, h, d), m); q.position.set(x, y, z); teddy.add(q); return q; };
    tb(0.36, 0.42, 0.28, fur, 0, 0.21, 0);
    tb(0.2, 0.24, 0.06, furD, 0, 0.18, 0.13);
    tb(0.3, 0.28, 0.26, fur, 0, 0.56, 0);
    tb(0.1, 0.11, 0.07, furD, -0.12, 0.73, 0); tb(0.1, 0.11, 0.07, furD, 0.12, 0.73, 0);
    tb(0.09, 0.06, 0.07, furD, 0, 0.52, 0.14);
    tb(0.035, 0.05, 0.03, new T.MeshStandardMaterial({ color: 0x0a0a0a }), -0.07, 0.6, 0.135);
    tb(0.035, 0.05, 0.03, new T.MeshStandardMaterial({ color: 0x0a0a0a }), 0.07, 0.6, 0.135);
    tb(0.1, 0.3, 0.11, fur, -0.23, 0.24, 0.03); tb(0.1, 0.3, 0.11, fur, 0.23, 0.24, 0.03);
    tb(0.12, 0.14, 0.3, fur, -0.12, 0.07, 0.12); tb(0.12, 0.14, 0.3, fur, 0.12, 0.07, 0.12);
    teddy.visible = false; teddy.position.y = 0.5; mb.add(teddy);
    const mbSolid = solid(0, 0, 0, 0, 0, 0);
    G.mysteryBox = { group: mb, lid, beam, holder, light: boxLight, qMats: [qMatF, qMatB], teddy, solid: mbSolid, padIndex: 0, pos: v3(0, 0, 0), state: 'idle', t: 0, cost: 950, weapon: null, displayModel: null };
    G.moveMysteryBox = (i) => {
      const p = G.boxPads[i], mbx = G.mysteryBox;
      mbx.padIndex = i;
      mb.position.set(p.x, 0, p.z); mb.rotation.y = p.ry;
      mbx.pos.set(p.x, 0, p.z);
      const alongZ = Math.abs(Math.sin(p.ry)) > 0.5;
      const hw = alongZ ? 0.36 : 1.0, hd = alongZ ? 1.0 : 0.36;
      Object.assign(mbx.solid, { minX: p.x - hw, maxX: p.x + hw, minY: 0, maxY: 0.85, minZ: p.z - hd, maxZ: p.z + hd });
    };
    G.moveMysteryBox(0);

    // ===== CAMPSITE =====
    const palisade = (x, z, len, alongX) => {
      boxMesh(alongX ? len : 0.24, 2.3, alongX ? 0.24 : len, MAT.wood, x, 1.15, z);
      const n = Math.floor(len / 1.6);
      for (let i = 0; i <= n; i++) {
        const off = -len / 2 + i * (len / Math.max(1, n));
        const p = new T.Mesh(new T.CylinderGeometry(0.09, 0.11, 2.55, 7), MAT.woodDark);
        p.position.set(x + (alongX ? off : 0), 1.27, z + (alongX ? 0 : off));
        p.castShadow = true; S.add(p);
      }
    };
    palisade(-34, 15.5, 11, false); palisade(-34, 28.5, 11, false);   // west (gap @ z22)
    palisade(-26, 34, 16, true); palisade(-8, 34, 16, true);          // south (gap @ x-17)
    palisade(0, 13.5, 7, false); palisade(0, 22.25, 5.7, false); palisade(0, 30.45, 7.1, false); // east (trap gate + gap)
    palisade(-30, 10, 8, true);                                        // north stub

    addBarricadeFrame(-34, 22, -1, 0, 'CAMP');
    addBarricadeFrame(-17, 34, 0, 1, 'CAMP');
    addBarricadeFrame(0, 26, 1, 0, 'CAMP');
    addBarricadeFrame(0, 18.2, 1, 0, 'CAMP', true);                    // open gate — defended by the trap

    // campfire
    const fireGrp = new T.Group(); fireGrp.position.set(-17, 0, 22); S.add(fireGrp);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      const st = new T.Mesh(new T.BoxGeometry(0.28, 0.2, 0.22), MAT.wall);
      st.position.set(Math.cos(a) * 0.75, 0.1, Math.sin(a) * 0.75); st.rotation.y = a; fireGrp.add(st);
    }
    for (let i = 0; i < 3; i++) {
      const lg = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 1.0, 7), MAT.woodDark);
      lg.rotation.z = Math.PI / 2 - 0.5; lg.rotation.y = i * 2.1; lg.position.y = 0.22; fireGrp.add(lg);
    }
    const flame = new T.Mesh(new T.ConeGeometry(0.32, 0.85, 8), new T.MeshStandardMaterial({ color: 0x3a1404, emissive: 0xff7a1a, emissiveIntensity: 2.4, transparent: true, opacity: 0.9 }));
    flame.position.y = 0.6; fireGrp.add(flame);
    const flame2 = new T.Mesh(new T.ConeGeometry(0.18, 0.55, 7), new T.MeshStandardMaterial({ color: 0x401800, emissive: 0xffc040, emissiveIntensity: 2.8, transparent: true, opacity: 0.9 }));
    flame2.position.set(0.12, 0.5, 0.08); fireGrp.add(flame2);
    const fireL = new T.PointLight(0xff8a30, 1.6, 14, 1.5); fireL.position.set(-17, 1.1, 22); S.add(fireL);
    G.bulbs.push({ light: fireL, mesh: flame, base: 1.6, seed: 3.3 });
    solid(-17.8, -16.2, 0, 0.5, 21.2, 22.8);
    boxMesh(1.6, 0.4, 0.45, MAT.woodDark, -17, 0.2, 24.2, { walkTop: true });
    boxMesh(1.6, 0.4, 0.45, MAT.woodDark, -19.4, 0.2, 21.2, { ry: 0.9, solid: false });

    // tents
    const canvasMat = new T.MeshStandardMaterial({ color: 0x50493a, roughness: 0.95 });
    const tent = (x, z, ry) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g);
      const a = new T.Mesh(new T.BoxGeometry(2.6, 0.08, 2.2), canvasMat); a.position.set(-0.78, 1.05, 0); a.rotation.z = 1.02; a.castShadow = true; g.add(a);
      const b = a.clone(); b.position.x = 0.78; b.rotation.z = -1.02; g.add(b);
      const back = new T.Mesh(new T.BoxGeometry(2.2, 1.9, 0.06), canvasMat); back.position.set(0, 0.8, -1.06); g.add(back);
      solid(x - 1.3, x + 1.3, 0, 1.9, z - 1.15, z + 1.15);
    };
    tent(-28, 15.5, 0.35); tent(-30, 25, -0.5);

    // watchtower + steps
    [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([ox, oz]) => {
      const leg = new T.Mesh(new T.BoxGeometry(0.22, 2.7, 0.22), MAT.woodDark);
      leg.position.set(-8 + ox, 1.35, 30 + oz); leg.castShadow = true; S.add(leg);
    });
    boxMesh(3.2, 0.18, 3.2, MAT.wood, -8, 2.7, 30, { walkTop: true });
    boxMesh(3.2, 0.1, 0.1, MAT.woodDark, -8, 3.75, 28.45, { solid: false, cast: false });
    boxMesh(3.2, 0.1, 0.1, MAT.woodDark, -8, 3.75, 31.55, { solid: false, cast: false });
    boxMesh(0.1, 0.1, 3.2, MAT.woodDark, -9.55, 3.75, 30, { solid: false, cast: false });
    for (let i = 0; i < 8; i++) {
      const h = 0.35 * (i + 1);
      boxMesh(0.38, h, 1.2, MAT.wood, -4.6 - i * 0.36, h / 2, 30, { walkTop: true });
    }

    // lanterns, crates, rocks
    const lantern = (x, z) => {
      boxMesh(0.14, 2.4, 0.14, MAT.woodDark, x, 1.2, z);
      const lm = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc070, emissiveIntensity: 2 }));
      lm.position.set(x, 2.28, z + 0.22); S.add(lm);
      const L = new T.PointLight(0xffb35c, 0.85, 10, 1.6); L.position.set(x, 2.2, z + 0.22); S.add(L);
      G.bulbs.push({ light: L, mesh: lm, base: 0.85, seed: Math.random() * 9 });
    };
    lantern(-10, 24); lantern(-26, 20);
    boxMesh(1.0, 0.95, 1.0, MAT.wood, -6, 0.48, 28.2);
    boxMesh(0.85, 0.8, 0.85, MAT.wood, -6.6, 0.4, 27.1);
    const rock = (x, z, s) => { const r = new T.Mesh(new T.SphereGeometry(s, 7, 5), MAT.wall); r.position.set(x, s * 0.5, z); r.scale.y = 0.7; r.castShadow = true; S.add(r); };
    rock(-31.5, 12, 0.55); rock(-2.5, 31.5, 0.75); rock(-22, 32.5, 0.5);

    // scavenge nodes (F to gather materials)
    const scavNode = (x, z, mat) => {
      const g = new T.Group(); g.position.set(x, 0, z); S.add(g);
      if (mat === 'wood') {
        for (let i = 0; i < 3; i++) {
          const lg = new T.Mesh(new T.CylinderGeometry(0.14, 0.14, 1.5, 8), MAT.wood);
          lg.rotation.z = Math.PI / 2;
          lg.position.set(0, i === 2 ? 0.42 : 0.15, i === 0 ? -0.17 : i === 1 ? 0.17 : 0);
          lg.castShadow = true; g.add(lg);
        }
      } else {
        const sack = new T.Mesh(new T.BoxGeometry(0.8, 0.5, 0.8), new T.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.95 }));
        sack.position.y = 0.25; sack.castShadow = true; g.add(sack);
        for (let i = 0; i < 5; i++) {
          const lump = new T.Mesh(new T.SphereGeometry(0.09, 5, 4), new T.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6, metalness: 0.3 }));
          lump.position.set((Math.random() - .5) * 0.5, 0.53, (Math.random() - .5) * 0.5); g.add(lump);
        }
      }
      solid(x - 0.5, x + 0.5, 0, 0.55, z - 0.5, z + 0.5);
      G.scavenge.push({ pos: v3(x, 0, z), mat, cd: 0, group: g });
    };
    scavNode(12.6, 4.2, 'wood');
    scavNode(-16, 6.8, 'coal');
    scavNode(-13, 29.5, 'wood');
    scavNode(-4, 13, 'coal');

    // electro-trap at the open gate
    const trapPost = (z) => {
      const p = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 2.5, 8), new T.MeshStandardMaterial({ color: 0x2e2f33, metalness: 0.8, roughness: 0.4 }));
      p.position.set(0, 1.25, z); p.castShadow = true; S.add(p);
      const tip = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshStandardMaterial({ color: 0x0a2030, emissive: 0x66d4ff, emissiveIntensity: 1.2 }));
      tip.position.set(0, 2.55, z); S.add(tip);
      return tip;
    };
    const tipA = trapPost(16.9), tipB = trapPost(19.5);
    boxMesh(0.34, 0.5, 0.2, MAT.metal, 0, 1.3, 16.3, { solid: false });
    G.Trap = { tips: [tipA, tipB], switchPos: v3(0, 1.2, 16.3), state: 'ready', t: 0, cost: 1000,
               posA: v3(0, 0.2, 17.0), posB: v3(0, 0.2, 19.4), zone: { x0: -0.9, x1: 0.9, z0: 16.8, z1: 19.6 } };

    // exterior dressing
    const treeMat = new T.MeshStandardMaterial({ color: 0x17130e, roughness: 1 });
    const tree = (x, z, s) => {
      const tg = new T.Group(); tg.position.set(x, 0, z); G.scene.add(tg);
      const trunk = new T.Mesh(new T.CylinderGeometry(0.14 * s, 0.26 * s, 4.4 * s, 7), treeMat); trunk.position.y = 2.2 * s; tg.add(trunk);
      for (let i = 0; i < 4; i++) {
        const br = new T.Mesh(new T.CylinderGeometry(0.03 * s, 0.09 * s, 1.9 * s, 5), treeMat);
        br.position.set(Math.cos(i * 1.9) * 0.5 * s, 2.4 * s + i * 0.5 * s, Math.sin(i * 1.9) * 0.5 * s);
        br.rotation.z = 0.7 + Math.random() * 0.7; br.rotation.y = i * 1.9;
        tg.add(br);
      }
    };
    tree(-10, -20, 1.1); tree(14, -18, 0.9); tree(24, -6, 1.2); tree(28, 10, 1); tree(18, 24, 1.15);
    tree(-6, 26, 0.85); tree(-22, 20, 0.95); tree(-33, 2, 1.1); tree(-31, -12, 0.9); tree(6, -27, 1.05);
    for (let i = 0; i < 20; i++) {
      const px = -30 + i * 3.1;
      const post = new T.Mesh(new T.BoxGeometry(0.12, 1.1, 0.12), MAT.woodDark);
      post.position.set(px, 0.55, -23 + Math.sin(i * 2.7) * 0.5); post.rotation.z = (Math.random() - .5) * 0.2; G.scene.add(post);
    }
    const rail = new T.Mesh(new T.BoxGeometry(62, 0.06, 0.06), MAT.woodDark);
    rail.position.set(0.5, 0.85, -23); G.scene.add(rail);

    G.spawnPoint = v3(0, 0, 4);
  };
})();
