// Building system: wood wall / floor / stairs on a 2m grid (Fortnite-style)
window.G = window.G || {};
(() => {
  const T = THREE;
  const GRID = 2, MODULE = 2.4, COST = 50, REFUND = 25;

  const plankTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7a5127'; ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 21) {
      ctx.fillStyle = `rgba(${90 + Math.random() * 30},${60 + Math.random() * 20},${28},1)`;
      ctx.fillRect(0, y, 128, 19);
      ctx.fillStyle = 'rgba(30,16,5,.6)'; ctx.fillRect(0, y + 19, 128, 2);
      for (let i = 0; i < 4; i++) { ctx.strokeStyle = 'rgba(45,25,8,.35)'; ctx.beginPath(); const yy = y + 4 + Math.random() * 12; ctx.moveTo(0, yy); ctx.lineTo(128, yy + Math.random() * 4 - 2); ctx.stroke(); }
    }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding;
    return t;
  })();
  const woodMat = new T.MeshStandardMaterial({ map: plankTex, roughness: 0.85 });
  const ghostOk = new T.MeshBasicMaterial({ color: 0x4dff7a, transparent: true, opacity: 0.38, depthWrite: false });
  const ghostBad = new T.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.38, depthWrite: false });

  // facing: 0=-z 1=-x 2=+z 3=+x
  const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];

  function pieceBoxes(piece, cx, y0, cz, f) {
    const boxes = [];
    if (piece === 'wall') {
      const alongX = (f === 0 || f === 2);
      boxes.push({
        minX: cx - (alongX ? 1 : 0.08), maxX: cx + (alongX ? 1 : 0.08),
        minZ: cz - (alongX ? 0.08 : 1), maxZ: cz + (alongX ? 0.08 : 1),
        minY: y0, maxY: y0 + MODULE,
      });
    } else if (piece === 'floor') {
      boxes.push({ minX: cx - 1, maxX: cx + 1, minZ: cz - 1, maxZ: cz + 1, minY: y0, maxY: y0 + 0.16, walkTop: true });
    } else if (piece === 'stairs') {
      const [dx, dz] = DIRS[f];
      for (let i = 0; i < 6; i++) {
        const off = -1 + 0.17 + i * 0.34;
        const px = cx + dx * off, pz = cz + dz * off;
        const w2 = (dx === 0) ? 1 : 0.17, d2 = (dz === 0) ? 1 : 0.17;
        boxes.push({ minX: px - w2, maxX: px + w2, minZ: pz - d2, maxZ: pz + d2, minY: y0, maxY: y0 + 0.4 * (i + 1), walkTop: true });
      }
    } else if (piece === 'bench') {
      boxes.push({ minX: cx - 0.8, maxX: cx + 0.8, minZ: cz - 0.5, maxZ: cz + 0.5, minY: y0, maxY: y0 + 0.95 });
    } else if (piece === 'anvil') {
      boxes.push({ minX: cx - 0.45, maxX: cx + 0.45, minZ: cz - 0.3, maxZ: cz + 0.3, minY: y0, maxY: y0 + 0.66 });
    }
    return boxes;
  }
  function meshFromBoxes(boxes, mat) {
    const g = new T.Group();
    for (const b of boxes) {
      const m = new T.Mesh(new T.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ), mat);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }
  // display model for icons / library (local space, facing 0)
  G.buildPieceModel = (piece) => meshFromBoxes(pieceBoxes(piece, 0, 0, 0, 0), woodMat);

  const B = {
    active: null, valid: false, placed: [],
    cx: 0, cz: 0, y0: 0, f: 0,
    ghost: null, ghostKey: '',
  };
  G.Build = B;

  B.setActive = (piece) => {
    B.active = piece || null;
    if (!B.active && B.ghost) { B.ghost.visible = false; }
  };

  function overlapsSolids(boxes) {
    const M = 0.05;
    for (const b of boxes) {
      for (const s of G.solids) {
        if (b.minX + M < s.maxX && b.maxX - M > s.minX &&
            b.minY + M < s.maxY && b.maxY - M > s.minY &&
            b.minZ + M < s.maxZ && b.maxZ - M > s.minZ) return true;
      }
    }
    return false;
  }
  function containsPlayer(boxes) {
    const p = G.player.pos, r = 0.34;
    for (const b of boxes) {
      if (p.x + r > b.minX && p.x - r < b.maxX && p.z + r > b.minZ && p.z - r < b.maxZ &&
          p.y + 1.7 > b.minY && p.y < b.maxY) return true;
    }
    return false;
  }

  B.update = () => {
    if (!B.active) { if (B.ghost) B.ghost.visible = false; return; }
    const origin = new T.Vector3(); G.camera.getWorldPosition(origin);
    const dir = new T.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    const hitT = G.rayVsSolids ? G.rayVsSolids(origin, dir, 5.5) : 5.5;
    const t = Math.min(5.5, hitT + 0.05);
    const tgt = origin.clone().addScaledVector(dir, Math.max(2, t));
    B.cx = Math.round(tgt.x / GRID) * GRID;
    B.cz = Math.round(tgt.z / GRID) * GRID;
    const surf = G.groundAt(B.cx, B.cz, tgt.y + 0.6);
    B.y0 = (tgt.y - surf < 0.5 && tgt.y - surf > -1.2) ? surf : Math.max(0, Math.round(tgt.y / MODULE) * MODULE);
    B.f = ((Math.round(G.player.yaw / (Math.PI / 2)) % 4) + 4) % 4;

    const boxes = pieceBoxes(B.active, B.cx, B.y0, B.cz, B.f);
    B.valid = !overlapsSolids(boxes) && !containsPlayer(boxes) && G.state.points >= COST;

    const key = `${B.active}|${B.cx}|${B.cz}|${B.y0}|${B.f}|${B.valid}`;
    if (key !== B.ghostKey) {
      B.ghostKey = key;
      if (B.ghost) { G.scene.remove(B.ghost); }
      B.ghost = meshFromBoxes(boxes, B.valid ? ghostOk : ghostBad);
      B.ghost.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      G.scene.add(B.ghost);
    }
    B.ghost.visible = true;
  };

  B.place = (opts = {}) => {
    if (!B.active || !B.valid) { G.audio.deny(); return false; }
    if (!opts.free && !G.spend(COST)) return false;
    const boxes = pieceBoxes(B.active, B.cx, B.y0, B.cz, B.f);
    let group;
    if (B.active === 'bench' || B.active === 'anvil') {
      group = B.active === 'bench' ? G.buildBenchModel() : G.buildAnvilModel();
      group.position.set(B.cx, B.y0, B.cz);
      group.rotation.y = B.f * Math.PI / 2;
      G.stations.push({ kind: B.active, pos: new T.Vector3(B.cx, B.y0, B.cz), group });
    } else group = meshFromBoxes(boxes, woodMat);
    G.scene.add(group);
    const solids = [], walks = [];
    for (const b of boxes) {
      const s = { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY, minZ: b.minZ, maxZ: b.maxZ };
      G.solids.push(s); solids.push(s);
      if (b.walkTop) { const w = { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, y: b.maxY }; G.walkables.push(w); walks.push(w); }
    }
    B.placed.push({ group, solids, walks, boxes, piece: B.active });
    G.audio.boardAdd();
    B.ghostKey = '';
    return true;
  };

  B.removeTargeted = () => {
    const origin = new T.Vector3(); G.camera.getWorldPosition(origin);
    const dir = new T.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    for (let t = 0.4; t < 6; t += 0.05) {
      const p = origin.clone().addScaledVector(dir, t);
      for (let i = 0; i < B.placed.length; i++) {
        const pl = B.placed[i];
        for (const b of pl.boxes) {
          const M = 0.08;
          if (p.x > b.minX - M && p.x < b.maxX + M && p.y > b.minY - M && p.y < b.maxY + M && p.z > b.minZ - M && p.z < b.maxZ + M) {
            G.scene.remove(pl.group);
            pl.solids.forEach(s => { const ix = G.solids.indexOf(s); if (ix >= 0) G.solids.splice(ix, 1); });
            pl.walks.forEach(w => { const ix = G.walkables.indexOf(w); if (ix >= 0) G.walkables.splice(ix, 1); });
            B.placed.splice(i, 1);
            if (pl.piece === 'bench' || pl.piece === 'anvil') {
              const si = G.stations.findIndex(s => s.group === pl.group);
              if (si >= 0) G.stations.splice(si, 1);
              G.Inv.addItemAt({ type: 'place', kind: pl.piece });
            } else G.addPoints(REFUND);
            G.audio.boardRip();
            return true;
          }
        }
      }
    }
    return false;
  };
})();
