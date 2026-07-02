// Asset Library — one WebGL canvas, scissored turntable per card
(() => {
  const T = THREE;
  const W = G.WEAPONS;

  function poseZombie(kind) {
    const { root, parts } = G.makeZombieBody();
    parts.torso.rotation.x = 0.22;
    parts.neck.rotation.x = -0.15;
    if (kind === 'shambler') {
      parts.armL.sh.rotation.x = -0.5; parts.armR.sh.rotation.x = -0.35;
      parts.armL.el.rotation.x = -0.3; parts.armR.el.rotation.x = -0.4;
      parts.legL.hip.rotation.x = 0.25; parts.legR.hip.rotation.x = -0.2;
    } else if (kind === 'runner') {
      parts.torso.rotation.x = 0.5;
      parts.armL.sh.rotation.x = -1.4; parts.armR.sh.rotation.x = -1.25;
      parts.legL.hip.rotation.x = 0.6; parts.legR.hip.rotation.x = -0.55;
      parts.legR.kn.rotation.x = 0.9;
    } else {
      root.scale.setScalar(1.18);
      parts.armL.sh.rotation.x = -1.5; parts.armR.sh.rotation.x = -1.5;
      parts.armL.sh.rotation.z = 0.3; parts.armR.sh.rotation.z = -0.3;
      parts.neck.rotation.x = -0.35;
    }
    root.userData.parts = parts;
    return root;
  }

  const wcap = (k, extra) => {
    const d = W[k];
    return `${d.dmg} dmg · ${d.mag} rd · ${d.rpm} rpm · ${extra}`;
  };

  const SECTIONS = [
    { title: 'Weapons', items: [
      { name: 'Mauser C96', cap: wcap('mauser', 'starting sidearm'), build: () => G.buildWeaponModel('mauser') },
      { name: 'K-98 Bolt Rifle', cap: wcap('kar98', 'wall buy 600'), build: () => G.buildWeaponModel('kar98') },
      { name: 'M97 Trench Gun', cap: wcap('trench', 'wall buy 1200'), build: () => G.buildWeaponModel('trench') },
      { name: 'M1928 SMG', cap: wcap('smg', 'wall buy 1750'), build: () => G.buildWeaponModel('smg') },
      { name: 'MG-42', cap: wcap('mg42', 'mystery box'), build: () => G.buildWeaponModel('mg42') },
      { name: 'STG-44', cap: wcap('stg', 'mystery box'), build: () => G.buildWeaponModel('stg') },
      { name: 'HELIOS-8 Scatter Laser', tag: 'ENERGY', cap: '8 beams · ' + wcap('laser', 'mystery box'), build: () => G.buildWeaponModel('laser') },
      { name: 'Arc Projector', tag: 'ENERGY', cap: 'AoE bolt · mystery box only', build: () => G.buildWeaponModel('arc') },
    ]},
    { title: 'Vehicle', items: [
      { name: 'Riptide Coupe', tag: 'DRIVABLE', cap: 'hotbar item · LMB deploy · F drive · mows the horde', build: G.buildCarModel,
        tick: (m, dt) => m.userData.wheels && m.userData.wheels.forEach(w => w.rotation.x += dt * 2.4) },
    ]},
    { title: 'Machines', items: [
      { name: 'The Reforger', tag: 'PACK-A-PUNCH', cap: 'insert weapon · 2500 pts · ×2.5 damage', build: G.buildPaPModel,
        tick: (m, dt, t) => { const u = m.userData; u.rollers.forEach(r => r.rotation.x += dt * 8); u.stamp.position.y = 1.42 - Math.abs(Math.sin(t * 3)) * 0.1; u.light.intensity = 0.8 + Math.sin(t * 4) * 0.4; } },
      { name: 'Mystery Box', cap: '950 pts · random weapon · beware the teddy', build: () => G.buildMysteryBoxModel(true) },
      { name: 'Crafting Bench', tag: 'CRAFTED', cap: '4 wood · placeable · 3×3 recipes', build: G.buildBenchModel },
      { name: 'Anvil', tag: 'CRAFTED', cap: '4 wood + 4 coal · smelts jet fuel', build: G.buildAnvilModel },
      { name: 'Magic Wand', tag: 'CATALYST', cap: '2 wood + 1 coal · crafts random weapons', build: G.buildWandModel },
      { name: 'Tough Tonic', tag: 'PERK', cap: '+150 max health · 2500 pts', build: () => G.buildPerkModel('TOUGH TONIC', 0x9e1b1b) },
      { name: 'Rapid Rounds', tag: 'PERK', cap: 'faster reload & fire · 3000 pts', build: () => G.buildPerkModel('RAPID ROUNDS', 0xb08414) },
      { name: 'Fleet Foot', tag: 'PERK', cap: '+17% move speed · 2000 pts', build: () => G.buildPerkModel('FLEET FOOT', 0x1c5d8a) },
      { name: 'Deadeye', tag: 'PERK', cap: '+40% damage · 2500 pts', build: () => G.buildPerkModel('DEADEYE', 0x5b2a7a) },
    ]},
    { title: 'The Horde', items: [
      { name: 'Shambler', cap: 'tears barricades · vaults windows', build: () => poseZombie('shambler'), sway: true },
      { name: 'Runner', cap: 'sprint variant · round 4+', build: () => poseZombie('runner'), sway: true },
      { name: 'Brute', cap: 'heavy frame · glowing eyes', build: () => poseZombie('brute'), sway: true },
    ]},
    { title: 'Buildables — Wood', items: [
      { name: 'Wall', cap: '50 pts · blocks the horde', build: () => G.buildPieceModel('wall') },
      { name: 'Floor', cap: '50 pts · bridge & platform', build: () => G.buildPieceModel('floor') },
      { name: 'Stairs', cap: '50 pts · ramp up 2.4m', build: () => G.buildPieceModel('stairs') },
    ]},
  ];

  const canvas = document.getElementById('gl');
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const size = () => renderer.setSize(innerWidth, innerHeight);
  size(); addEventListener('resize', size);

  const cards = [];
  const sectionsEl = document.getElementById('sections');
  for (const sec of SECTIONS) {
    const h = document.createElement('h2'); h.textContent = sec.title; sectionsEl.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'grid'; sectionsEl.appendChild(grid);
    for (const it of sec.items) {
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `<div class="view"></div><div class="meta"><h3>${it.name}${it.tag ? ` <span class="tag">${it.tag}</span>` : ''}</h3><p>${it.cap}</p></div>`;
      grid.appendChild(card);

      const scene = new T.Scene();
      scene.add(new T.HemisphereLight(0xc3cdde, 0x2a2018, 0.95));
      const key = new T.DirectionalLight(0xfff2dd, 1.0); key.position.set(2.5, 3.5, 2.5); scene.add(key);
      const rim = new T.DirectionalLight(0x7a9cc8, 0.5); rim.position.set(-3, 1.5, -2.5); scene.add(rim);

      const spin = new T.Group(); scene.add(spin);
      const model = it.build();
      const bb = new T.Box3().setFromObject(model);
      const c = bb.getCenter(new T.Vector3()), s = bb.getSize(new T.Vector3());
      model.position.sub(c);
      spin.add(model);
      const maxDim = Math.max(s.x, s.y, s.z);
      const ped = new T.Mesh(new T.CylinderGeometry(maxDim * 0.52, maxDim * 0.58, maxDim * 0.03, 36),
        new T.MeshStandardMaterial({ color: 0x1e2026, metalness: 0.6, roughness: 0.4 }));
      ped.position.y = -s.y / 2 - maxDim * 0.02; spin.add(ped);

      const cam = new T.PerspectiveCamera(32, 1, 0.01, 100);
      cam.position.set(0, maxDim * 0.22, maxDim * 2.05);
      cam.lookAt(0, 0, 0);

      cards.push({ el: card.querySelector('.view'), scene, cam, spin, model, tick: it.tick, sway: it.sway, t: Math.random() * 10 });
    }
  }

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const H = renderer.domElement.height / renderer.getPixelRatio();
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const card of cards) {
      const r = card.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width === 0) continue;
      card.t += dt;
      card.spin.rotation.y += dt * 0.55;
      if (card.tick) card.tick(card.model, dt, card.t);
      if (card.sway) {
        card.model.rotation.z = Math.sin(card.t * 1.3) * 0.04;
        const parts = card.model.userData.parts;
        if (parts) parts.neck.rotation.z = Math.sin(card.t * 0.9) * 0.15;
      }
      const y = H - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height);
      renderer.setScissor(r.left, y, r.width, r.height);
      card.cam.aspect = r.width / r.height;
      card.cam.updateProjectionMatrix();
      renderer.render(card.scene, card.cam);
    }
  }
  requestAnimationFrame(loop);
})();
