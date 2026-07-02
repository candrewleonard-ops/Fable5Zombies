// Pack-a-Punch: the "REFORGER" — insert weapon, upgrade animation, eject
window.G = window.G || {};
(() => {
  const T = THREE;
  const dark = new T.MeshStandardMaterial({ color: 0x191b20, metalness: 0.7, roughness: 0.45 });
  const steel = new T.MeshStandardMaterial({ color: 0x565a63, metalness: 0.9, roughness: 0.3 });
  const copper = new T.MeshStandardMaterial({ color: 0x8a5a2a, metalness: 0.95, roughness: 0.35 });
  const runeM = new T.MeshStandardMaterial({ color: 0x1a0a24, emissive: 0xb04aff, emissiveIntensity: 1.4 });
  const hotM = new T.MeshStandardMaterial({ color: 0x2a1004, emissive: 0xff7a1a, emissiveIntensity: 1.2 });

  function bx(w, h, d, mat, x, y, z, rx = 0) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; return m;
  }
  function cy(r, h, mat, x, y, z, rz = Math.PI / 2) {
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 12), mat);
    m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; return m;
  }

  // machine model; front faces +Z. Also used by the asset library.
  G.buildPaPModel = () => {
    const g = new T.Group();
    g.add(bx(1.5, 0.95, 0.85, dark, 0, 0.475, 0));                       // base cabinet
    g.add(bx(1.5, 0.22, 0.9, steel, 0, 1.02, 0));                        // mid band
    g.add(bx(1.34, 0.55, 0.7, dark, 0, 1.4, -0.05));                     // upper housing
    g.add(bx(1.34, 0.3, 0.72, steel, 0, 1.78, -0.05, -0.15));            // console top
    g.add(bx(1.52, 0.06, 0.87, runeM, 0, 1.14, 0));                      // rune strip
    g.add(bx(0.09, 0.06, 0.4, runeM, -0.55, 1.81, -0.02, -0.15));
    g.add(bx(0.09, 0.06, 0.4, runeM, 0.55, 1.81, -0.02, -0.15));
    g.add(cy(0.07, 1.5, copper, -0.82, 0.9, -0.25, 0));                  // side pipes
    g.add(cy(0.07, 1.5, copper, 0.82, 0.9, -0.25, 0));
    g.add(cy(0.11, 0.5, copper, -0.82, 1.62, -0.25, Math.PI / 2));
    g.add(cy(0.11, 0.5, copper, 0.82, 1.62, -0.25, Math.PI / 2));
    g.add(bx(0.9, 0.34, 0.06, hotM, 0, 1.38, 0.31));                     // furnace window
    // rollers above tray
    const rollers = [];
    for (let i = 0; i < 2; i++) { const r = cy(0.06, 0.85, steel, 0, 1.06, 0.28 + i * 0.16); g.add(r); rollers.push(r); }
    // stamp head
    const stamp = bx(0.5, 0.22, 0.4, steel, 0, 1.42, 0.38); g.add(stamp);
    // tray (slides in/out along Z)
    const tray = new T.Group(); tray.position.set(0, 0.86, 0.55); g.add(tray);
    tray.add(bx(0.95, 0.06, 0.55, steel, 0, 0, 0));
    tray.add(bx(0.95, 0.1, 0.05, dark, 0, 0.04, 0.27));
    const L = new T.PointLight(0xb04aff, 0.7, 6, 1.8); L.position.set(0, 1.6, 0.8); g.add(L);
    g.userData = { tray, rollers, stamp, light: L, runeMat: runeM };
    return g;
  };

  const P = { state: 'idle', t: 0, item: null, model: null, weaponModel: null, pos: null, cost: 2500 };
  G.PaP = P;

  G.initPaP = (x, z, ry) => {
    P.model = G.buildPaPModel();
    P.model.position.set(x, 0, z); P.model.rotation.y = ry;
    G.scene.add(P.model);
    const s = 0.85;
    G.solids.push({ minX: x - s, maxX: x + s, minY: 0, maxY: 1.9, minZ: z - 0.55, maxZ: z + 0.55 });
    P.pos = new T.Vector3(x, 0, z);
  };

  P.canInsert = (item) => P.state === 'idle' && item && item.type === 'weapon' && !item.pap;

  P.insert = (item) => {
    P.item = item; P.state = 'in'; P.t = 0;
    const u = P.model.userData;
    if (P.weaponModel) u.tray.remove(P.weaponModel);
    P.weaponModel = G.buildWeaponModel(item.key);
    P.weaponModel.scale.setScalar(1.5);
    P.weaponModel.rotation.y = Math.PI / 2;
    P.weaponModel.position.set(0, 0.12, 0);
    u.tray.add(P.weaponModel);
    u.tray.position.z = 1.0;
    G.audio.reloadStart();
  };

  P.takeOut = () => {
    if (P.state !== 'ready') return null;
    const item = P.item;
    item.pap = true;
    const st = G.Inv.weaponStats(item);
    item.mag = st.mag; item.reserve = st.reserve;
    P.item = null; P.state = 'idle'; P.t = 0;
    const u = P.model.userData;
    if (P.weaponModel) { u.tray.remove(P.weaponModel); P.weaponModel = null; }
    u.tray.position.z = 0.55 - P.model.position.z + P.model.position.z; // reset local
    u.tray.position.set(0, 0.86, 0.55);
    G.audio.buy();
    return item;
  };

  P.update = (dt) => {
    if (!P.model) return;
    const u = P.model.userData;
    P.t += dt;
    const pulse = 1 + Math.sin(P.t * 3) * 0.25;
    if (P.state === 'idle') {
      u.light.intensity = 0.55 * pulse;
      u.runeMat.emissiveIntensity = 1.2 + Math.sin(P.t * 2) * 0.3;
    } else if (P.state === 'in') {
      u.tray.position.z = Math.max(0.18, u.tray.position.z - dt * 1.4);
      if (u.tray.position.z <= 0.18) { P.state = 'work'; P.t = 0; G.audio.papHum && G.audio.papHum(); }
    } else if (P.state === 'work') {
      u.rollers.forEach(r => r.rotation.x += dt * 14);
      u.stamp.position.y = 1.42 - Math.abs(Math.sin(P.t * 6)) * 0.16;
      u.light.intensity = 1.6 + Math.sin(P.t * 12) * 0.8;
      u.runeMat.emissiveIntensity = 2.2 + Math.sin(P.t * 9) * 1;
      if (P.weaponModel && Math.random() < dt * 6) G.spawnSpark(P.model.localToWorld(new T.Vector3(0, 1.1, 0.3)), 0xb04aff);
      if (P.t > 3.4) {
        P.state = 'out'; P.t = 0;
        // upgraded glow on the display weapon
        P.weaponModel.traverse(o => {
          if (o.isMesh && o.material) {
            o.material = o.material.clone();
            o.material.emissive = new T.Color(0x7a2bd6);
            o.material.emissiveIntensity = 0.45;
          }
        });
        G.audio.papDing && G.audio.papDing();
      }
    } else if (P.state === 'out') {
      u.tray.position.z = Math.min(1.0, u.tray.position.z + dt * 1.2);
      u.stamp.position.y += (1.42 - u.stamp.position.y) * Math.min(1, dt * 6);
      if (u.tray.position.z >= 1.0) { P.state = 'ready'; P.t = 0; }
    } else if (P.state === 'ready') {
      u.light.intensity = 1.2 * pulse;
      if (P.weaponModel) P.weaponModel.position.y = 0.16 + Math.sin(P.t * 2.5) * 0.03;
      if (P.t > 40) { // auto-eject timeout safeguard: keep waiting, just keep glowing
        P.t = 10;
      }
    }
  };
})();
