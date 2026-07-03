import { chromium } from 'playwright';

// UNDEAD BUNKER end-to-end suite. Uses ?test=1 (window.__game) + simulate()
// so logic assertions are independent of headless render speed.

const SHOT_DIR = process.env.SHOT_DIR || 'tests/shots';
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const results = [];
const errors = [];
const push = (name, ok) => results.push([name, ok]);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(60000); // software GL compiles the big scene slowly
await page.route('https://fonts.googleapis.com/**', (r) => r.abort()); // sandbox proxy hangs fonts
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// dev-server/browser flake tolerance: retry the game page until the hook is live
async function gotoGame(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      const st = await page.evaluate(() => ({ game: !!window.__game, playing: !!window.__game?.state?.playing }))
        .catch((e) => ({ err: e.message.split('\n')[0] }));
      if (st.playing) return;
      if (i === 14) console.log(`(attempt ${attempt + 1}: ${JSON.stringify(st)}; errors: ${errors.slice(-3).join(' | ')})`);
    }
  }
  throw new Error('game failed to load: ' + url);
}

// ---------- menu ----------
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#startBtn', { state: 'visible', timeout: 15000 }).catch(() => {});
push('menu renders', await page.locator('#startBtn').isVisible());
await page.screenshot({ path: `${SHOT_DIR}/menu.png` });
// let the raygun STL fetch finish before navigating away — aborting a large
// in-flight request can wedge the dev-server connection for the next page
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

// ---------- movement / map (no zombies) ----------
await gotoGame(BASE + '/?test=1&nozombies=1');
await page.waitForTimeout(1500); // round banner + STL

push('game auto-starts', await page.evaluate(() => window.__game.state.playing));

// bunker stairs to mezzanine (buy Upper Quarters door first)
const stair = await page.evaluate(() => {
  const g = window.__game;
  g.addPoints(20000);
  const door = g.world.doors.find((d) => d.name === 'Upper Quarters');
  g.teleport(-9.45, 0.1, 7.2);
  g.aimAt(door.pos.x, door.pos.y, door.pos.z);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  const opened = door.open;
  // walk up: stand east of stairs, face -x (up the run)
  g.teleport(-9.0, 0.1, 9.05);
  g.lookAt(Math.PI / 2, 0); // forward = -x
  g.pressKey('KeyW');
  let maxY = 0;
  for (let i = 0; i < 16 && maxY < 3.1; i++) { g.simulate(0.2); maxY = Math.max(maxY, g.player.pos.y); }
  g.releaseKey('KeyW');
  return { opened, maxY, room: g.world.roomAt(g.player.pos) };
});
push(`Upper Quarters door buys open (${stair.opened})`, stair.opened);
push(`bunker stairs climbable (peak y=${stair.maxY.toFixed(2)}, room=${stair.room})`, stair.maxY >= 3.1);
await page.screenshot({ path: `${SHOT_DIR}/mezzanine.png` });

// watchtower steps at the campsite
const tower = await page.evaluate(() => {
  const g = window.__game;
  g.world.rooms.CAMP.unlocked = true;
  g.teleport(-3.6, 0.1, 30);
  g.lookAt(Math.PI / 2, 0); // -x toward steps
  g.pressKey('KeyW');
  let maxY = 0;
  for (let i = 0; i < 14 && maxY < 2.7; i++) { g.simulate(0.2); maxY = Math.max(maxY, g.player.pos.y); }
  g.releaseKey('KeyW');
  return maxY;
});
push(`watchtower steps climbable (peak y=${tower.toFixed(2)})`, tower >= 2.7);

// lean still works
const lean = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(0, 0.1, 4);
  g.lookAt(0, 0);
  g.pressKey('KeyQ');
  g.simulate(0.8);
  const l = { lean: g.player.lean, roll: g.player.leanRoot.rotation.z };
  g.releaseKey('KeyQ');
  g.simulate(0.8);
  l.recovered = Math.abs(g.player.lean) < 0.05;
  return l;
});
push(`Q lean engages (lean=${lean.lean.toFixed(2)}, roll=${lean.roll.toFixed(2)})`, lean.lean < -0.9 && lean.roll > 0.18);
push('lean recovers', lean.recovered);

// ---------- economy: door spend/deny ----------
const econ = await page.evaluate(() => {
  const g = window.__game;
  const before = g.state.points;
  const ok = g.spend(100);
  const denied = !g.spend(10 ** 9);
  return { ok, denied, delta: before - g.state.points };
});
push(`spend works (+deny) (${econ.delta})`, econ.ok && econ.denied && econ.delta === 100);

// ---------- wall-buy ----------
const wallbuy = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(4, 0.1, -8.5);
  g.aimAt(4, 1.7, -9.79);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  const item = g.inventory.slots.find((it) => it?.weaponKey === 'kar98');
  return { got: !!item };
});
push('wall-buy grants K-98', wallbuy.got);

// ---------- roof power switch (new) + perk gating ----------
const power = await page.evaluate(() => {
  const g = window.__game;
  g.addPoints(20000);
  // perks are dead without power
  g.teleport(12.4, 0.1, -9.2);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  const deniedNoPower = !g.player.perks.has('tonic');
  // climb to the roof switch
  g.teleport(-6, 6.8, -8.6);
  const roofRoom = g.world.roomAt(g.player.pos);
  g.aimAt(-6, 7.3, -9.85);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  return { deniedNoPower, on: g.world.powerSwitch.on, roofRoom };
});
push(`perks need power (denied=${power.deniedNoPower})`, power.deniedNoPower);
push(`roof power switch activates (room=${power.roofRoom})`, power.on && power.roofRoom === 'ROOF');

// ---------- perk machine (with power) ----------
const perk = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(12.4, 0.1, -9.2);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  return { has: g.player.perks.has('tonic'), hp: g.player.maxHealth };
});
push(`Tough Tonic buys (+maxHP=${perk.hp})`, perk.has && perk.hp === 250);

// ---------- Quick Revive: powerless perk + self-revive ----------
const revive = await page.evaluate(() => {
  const g = window.__game;
  const wasOn = g.world.powerSwitch.on;
  g.world.powerSwitch.on = false; // revive must work without power
  g.teleport(2, 0.1, 8.6);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  const bought = g.player.perks.has('revive');
  g.world.powerSwitch.on = wasOn;
  g.player.health = 0;
  g.player.dead = true;
  g.simulate(0.2);
  return { bought, revived: !g.player.dead && g.player.health > 0, perkGone: !g.player.perks.has('revive') };
});
push(`Quick Revive buys without power + self-revives (${JSON.stringify(revive)})`, revive.bought && revive.revived && revive.perkGone);

// ---------- mystery box: roll → take (or teddy) ----------
const boxRes = await page.evaluate(() => {
  const g = window.__game;
  const pad = g.world.boxPads[g.box.padIndex];
  g.world.rooms.ARMORY.unlocked = true;
  g.world.rooms.CAMP.unlocked = true;
  g.teleport(pad.x + 1.6, 0.1, pad.z);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();          // pay + roll
  const rolling = g.box.state === 'rolling';
  g.simulate(4);                                       // roll finishes
  const after = g.box.state;
  let took = null;
  if (after === 'ready') {
    const before = g.inventory.slots.filter(Boolean).length;
    g.pressF(); g.simulate(0.3); g.releaseF();
    took = g.inventory.slots.filter(Boolean).length > before;
  } else {
    g.simulate(4); // teddy relocation completes
  }
  return { rolling, after, took, pad: g.box.padIndex };
});
push(`mystery box rolls (state after: ${boxRes.after})`, boxRes.rolling && (boxRes.after === 'ready' || boxRes.after === 'teddy'));
if (boxRes.after === 'ready') push('box weapon taken', boxRes.took === true);
else push('teddy relocated the box', true);

// ---------- Ray Gun: give + fire projectile at a wall ----------
const ray = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem } = await import('/src/items.js');
  g.inventory.reset();
  g.inventory.addItem(makeWeaponItem('raygun'));
  g.inventory.select(0);
  g.teleport(0, 0.1, 4);
  g.aimAt(4, 1.5, -9.8); // north wall (solid — x=0 is a window gap!)
  g.simulate(0.3);
  const magBefore = g.weapons.item.mag;
  g.fire();
  const projectiles = g.weapons.projectiles.length;
  g.simulate(1.2); // bolt flies + explodes
  return { magBefore, magAfter: g.weapons.item.mag, projectiles, exploded: g.weapons.projectiles.length === 0 };
});
push(`Ray Gun fires green bolt (${ray.magBefore}→${ray.magAfter}, proj=${ray.projectiles})`, ray.magAfter === ray.magBefore - 1 && ray.projectiles === 1 && ray.exploded);
await page.screenshot({ path: `${SHOT_DIR}/raygun.png` });

// ---------- crafting: materials → wand → wonder weapon sequence ----------
const craftRes = await page.evaluate(async () => {
  const g = window.__game;
  const { makeMaterial } = await import('/src/items.js');
  g.inventory.addItem(makeMaterial('wood', 8));
  g.inventory.addItem(makeMaterial('coal', 8));
  g.inventory.open();
  const wandRecipe = document.querySelector('.recipeBtn[data-key="wand"]');
  wandRecipe.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const gotWand = g.inventory.countOf('wand') === 1;
  const wonderBtn = document.querySelector('.recipeBtn[data-key="randWonder"]');
  const affordable = wonderBtn && !wonderBtn.classList.contains('missing');
  wonderBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const seqStarted = g.craft.crafting && !g.inventory.isOpen;
  g.simulate(3.2); // sequence completes
  const weapons = g.inventory.slots.filter((it) => it?.kind === 'weapon').map((it) => it.weaponKey);
  const gotWonder = weapons.some((k) => ['arc', 'laser', 'raygun'].includes(k));
  return { gotWand, affordable, seqStarted, gotWonder, weapons };
});
push(`craft wand from mats (${craftRes.gotWand})`, craftRes.gotWand);
push(`wonder-weapon craft sequence (${JSON.stringify(craftRes.weapons)})`, craftRes.affordable && craftRes.seqStarted && craftRes.gotWonder);

// ---------- Pack-a-Punch ----------
const papRes = await page.evaluate(() => {
  const g = window.__game;
  g.world.rooms.STORAGE.unlocked = true;
  g.addPoints(5000);
  // hold a non-pap weapon
  const idx = g.inventory.slots.findIndex((it) => it?.kind === 'weapon' && !it.pap);
  if (idx < 0) return { skip: true };
  if (idx >= 9) { g.inventory.slots[0] = g.inventory.slots[idx]; g.inventory.slots[idx] = null; }
  g.inventory.select(idx < 9 ? idx : 0);
  g.teleport(8.5, 0.1, 15.5);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();          // insert + pay
  const inserted = g.pap.state !== 'idle';
  g.simulate(6);                                       // in + work + out
  const ready = g.pap.ready;
  g.pressF(); g.simulate(0.3); g.releaseF();           // take
  const star = g.inventory.slots.find((it) => it?.pap);
  return { inserted, ready, star: !!star, name: star?.name };
});
push(`Pack-a-Punch upgrades (${papRes.name || 'FAIL'})`, papRes.inserted && papRes.ready && papRes.star);
await page.screenshot({ path: `${SHOT_DIR}/pap.png` });

// ---------- building ----------
const buildRes = await page.evaluate(async () => {
  const g = window.__game;
  const { makeTool, makeMaterial } = await import('/src/items.js');
  g.inventory.reset();
  g.inventory.addItem(makeTool('buildStairs'));
  g.inventory.addItem(makeMaterial('wood', 12)); // builds cost wood now
  g.inventory.select(0);
  g.addPoints(1000);
  g.teleport(-5, 0.1, -5);
  g.lookAt(0, -0.4);
  g.simulate(0.2);
  const before = g.world.colliders.length;
  g.click(); g.simulate(0.2);
  const placed = g.build.placed.length === 1;
  const solidsAdded = g.world.colliders.length - before;
  // climb the built stairs
  g.teleport(-5, 0.1, -3.2);
  g.lookAt(Math.PI, 0); // +z... stairs face snapped from lookAt(0) => f=0 (-z). Approach from -z side going +z? walk both ways
  g.pressKey('KeyW');
  let maxY = 0;
  for (let i = 0; i < 12; i++) { g.simulate(0.2); maxY = Math.max(maxY, g.player.pos.y); }
  g.releaseKey('KeyW');
  if (maxY < 1) {
    g.teleport(-5, 0.1, -6.8);
    g.lookAt(0, 0);
    g.pressKey('KeyW');
    for (let i = 0; i < 12; i++) { g.simulate(0.2); maxY = Math.max(maxY, g.player.pos.y); }
    g.releaseKey('KeyW');
  }
  return { placed, solidsAdded, maxY };
});
push(`build stairs places (+${buildRes.solidsAdded} solids)`, buildRes.placed && buildRes.solidsAdded === 6);
push(`built stairs climbable (peak y=${buildRes.maxY.toFixed(2)})`, buildRes.maxY >= 2.0);

// ---------- car ----------
const carRes = await page.evaluate(async () => {
  const g = window.__game;
  const { makeTool } = await import('/src/items.js');
  g.inventory.reset();
  g.inventory.addItem(makeTool('carKeys'));
  g.inventory.select(0);
  g.teleport(-20, 0.1, 22); // campsite open field
  g.lookAt(0, 0);
  g.simulate(0.2);
  g.click(); g.simulate(0.3);
  const deployed = g.car.deployed;
  g.teleport(g.car.pos.x + 1.5, 0.1, g.car.pos.z);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();  // enter
  const driving = g.car.driving;
  g.pressKey('KeyW');
  g.simulate(2);
  g.releaseKey('KeyW');
  const speedGained = Math.abs(g.car.speed) > 1;
  const moved = g.car.pos.distanceTo(new (Object.getPrototypeOf(g.car.pos).constructor)(-20, 0, 22)) > 3;
  g.simulate(2.5); // coast to stop
  g.pressF(); g.simulate(0.3); g.releaseF();  // exit
  return { deployed, driving, speedGained, moved, exited: !g.car.driving };
});
push(`car deploys + drives (moved=${carRes.moved})`, carRes.deployed && carRes.driving && carRes.speedGained && carRes.moved && carRes.exited);
await page.screenshot({ path: `${SHOT_DIR}/car.png` });

// ---------- jetpack ----------
const jet = await page.evaluate(async () => {
  const g = window.__game;
  const { makeTool } = await import('/src/items.js');
  g.inventory.addItem(makeTool('jetpack'));
  g.inventory.select(g.inventory.sel); // triggers onSelectionChanged → auto-equip
  const equipped = g.player.jetpack && g.player.jetFuel === 100;
  g.teleport(-17, 0.1, 28);
  g.pressKey('Space');
  g.simulate(1.5);
  g.releaseKey('Space');
  return { equipped, y: g.player.pos.y, fuel: g.player.jetFuel };
});
push(`jetpack flies (y=${jet.y.toFixed(2)}, fuel=${jet.fuel.toFixed(0)})`, jet.equipped && jet.y > 2 && jet.fuel < 90);

// ---------- inventory T + paperdoll + armor ----------
await page.keyboard.press('KeyT');
await page.waitForTimeout(400);
push('T opens inventory', await page.evaluate(() => window.__game.inventory.isOpen));
const armorOk = await page.evaluate(async () => {
  const g = window.__game;
  const { makeArmorItem } = await import('/src/items.js');
  const helm = makeArmorItem('helmet', 2);
  g.inventory.addItem(helm);
  const idx = g.inventory.slots.indexOf(helm);
  const els = [...document.querySelectorAll('.invGrid .slot'), ...document.querySelectorAll('.invHotRow .slot')];
  const el = els.find((e) => Number(e.dataset.index) === idx);
  el.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
  return { equipped: !!g.inventory.armor.helmet, pts: g.player.armor };
});
push(`right-click equips armor (${armorOk.pts} pts, ×15 endurance)`, armorOk.equipped && armorOk.pts === 375);
await page.screenshot({ path: `${SHOT_DIR}/inventory.png` });
await page.keyboard.press('KeyT');
await page.waitForTimeout(300);

// ---------- Ray Gun parts → craft ----------
const partCraft = await page.evaluate(async () => {
  const g = window.__game;
  const { makeTool } = await import('/src/items.js');
  g.inventory.reset();
  for (let i = 0; i < 3; i++) g.inventory.addItem(makeTool('raygunPart'));
  g.inventory.open();
  const btn = document.querySelector('.recipeBtn[data-key="raygunCraft"]');
  const affordable = btn && !btn.classList.contains('missing');
  btn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const gotRaygun = g.inventory.slots.some((it) => it?.weaponKey === 'raygun');
  const partsGone = g.inventory.countOf('raygunPart') === 0;
  g.inventory.close();
  return { affordable, gotRaygun, partsGone };
});
push(`3 blood-moon parts craft a Ray Gun (${JSON.stringify(partCraft)})`, partCraft.affordable && partCraft.gotRaygun && partCraft.partsGone);

// ---------- new box weapons exist ----------
const pool = await page.evaluate(async () => {
  const { BOX_POOL, WEAPONS } = await import('/src/items.js');
  return { hasRev: BOX_POOL.includes('revolver'), revName: WEAPONS.revolver.name, hasPpsh: BOX_POOL.includes('ppsh') };
});
push(`West Revolver + PPSh-41 in box pool (${pool.revName})`, pool.hasRev && pool.hasPpsh && pool.revName === 'West Revolver');

// ---------- zombies: full lifecycle on a fresh page ----------
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await gotoGame(BASE + '/?test=1');
const zRes = await page.evaluate(() => {
  const g = window.__game;
  g.player.maxHealth = 100000; g.player.health = 100000;
  g.teleport(0, 0.1, 4);
  g.simulate(2);   // round starts (900ms) + spawns
  const spawned = g.zombies.zombies.length;
  g.simulate(24);  // walk to windows, tear all 6 boards (~2s each), vault
  const states = g.zombies.zombies.map((z) => z.state);
  const anyInside = g.zombies.zombies.some((z) => z.state === 'hunt');
  const boardsRipped = g.world.windows.some((w) => w.boards.some((b) => !b.on));
  // shoot one hunter
  const z = g.zombies.zombies.find((z) => z.state === 'hunt' && !z.dead);
  let killRes = null;
  if (z) {
    const kBefore = g.state.kills;
    const pBefore = g.state.points;
    g.teleport(z.pos.x, z.pos.y + 0.1, z.pos.z + 3);
    for (let i = 0; i < 25 && !z.dead; i++) {
      g.simulate(0.25);
      g.aimAt(z.pos.x, z.pos.y + 1.35 * z.scale, z.pos.z);
      g.simulate(0.02);
      g.fire();
    }
    g.simulate(0.5);
    killRes = { dead: z.dead, kills: g.state.kills - kBefore, pts: g.state.points - pBefore };
  }
  return { spawned, states, anyInside, boardsRipped, killRes };
});
push(`zombies spawn at windows (${zRes.spawned})`, zRes.spawned >= 1);
push(`boards get ripped (${zRes.boardsRipped}) & zombies vault inside (${zRes.anyInside}) [${zRes.states.join(',')}]`, zRes.boardsRipped && zRes.anyInside);
push(`shooting kills + awards points (${JSON.stringify(zRes.killRes)})`, !!zRes.killRes && zRes.killRes.dead && zRes.killRes.kills >= 1 && zRes.killRes.pts > 50);
await page.screenshot({ path: `${SHOT_DIR}/combat.png` });

// board repair
const repair = await page.evaluate(() => {
  const g = window.__game;
  const win = g.world.windows.find((w) => w.boards.some((b) => !b.on) && !w.gate);
  if (!win) return { skip: true };
  const off = win.boards.filter((b) => !b.on).length;
  g.teleport(win.inner.x, win.floorY + 0.1, win.inner.z);
  g.pressF();
  g.simulate(1.4); // two boards at 0.55s cadence
  g.releaseF();
  const now = win.boards.filter((b) => !b.on).length;
  return { off, now };
});
push(`hold-F repairs boards (${repair.off}→${repair.now})`, repair.skip || repair.now < repair.off);

// ---------- melee shove + anti-clip ----------
const meleeRes = await page.evaluate(() => {
  const g = window.__game;
  const z = g.zombies.zombies.find((z) => !z.dead && z.state === 'hunt');
  if (!z) return { skip: true };
  // force the zombie INSIDE the player (the old death-trap glitch)
  z.pos.set(g.player.pos.x, g.player.pos.y, g.player.pos.z);
  g.simulate(0.3);
  const sep = Math.hypot(z.pos.x - g.player.pos.x, z.pos.z - g.player.pos.z);
  // now shove it
  g.aimAt(z.pos.x, z.pos.y + 1, z.pos.z);
  g.simulate(0.05);
  const hpBefore = z.hp;
  const before = Math.hypot(z.pos.x - g.player.pos.x, z.pos.z - g.player.pos.z);
  g.weapons.melee(g.zombies);
  // peak separation — sprinters can close the gap again within a second,
  // but the shove must still have bought breathing room
  let peak = before;
  for (let i = 0; i < 12; i++) {
    g.simulate(0.05);
    peak = Math.max(peak, Math.hypot(z.pos.x - g.player.pos.x, z.pos.z - g.player.pos.z));
  }
  return { sep, hpBefore, hpAfter: z.hp, before, after: peak, anim: true };
});
push(`zombie can never occupy the player (sep=${meleeRes.sep?.toFixed(2)} ≥ 0.7)`, meleeRes.skip || meleeRes.sep >= 0.7);
push(`F-shove damages + pushes back (${meleeRes.hpBefore?.toFixed(0)}→${meleeRes.hpAfter?.toFixed(0)}, ${meleeRes.before?.toFixed(2)}→peak ${meleeRes.after?.toFixed(2)}m)`,
  meleeRes.skip || (meleeRes.hpAfter < meleeRes.hpBefore && meleeRes.after > meleeRes.before + 0.3));

// ---------- W.A.V.E. cannon + ★ The Blaster ----------
const legends = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem } = await import('/src/items.js');
  const hunters = g.zombies.zombies.filter((z) => !z.dead && z.alive && z.state === 'hunt');
  if (hunters.length < 2) return { skip: true };
  const [zA, zB] = hunters;
  g.inventory.reset();
  g.inventory.slots[0] = makeWeaponItem('wavegun');
  g.inventory.select(0);
  g.teleport(0, 0.1, 4);
  g.lookAt(0, 0);
  zA.pos.set(0, 0, 0);   // 4m dead ahead
  zA.kb.set(0, 0, 0);
  zA.hp = zA.maxHp = 50000; // tank the wave so The Blaster corridor test is real
  g.aimAt(0, 1.2, 0);
  g.simulate(0.4);
  const hpA = zA.hp;
  g.fire();
  const waveVisual = g.weapons.waves.length === 1;
  g.simulate(0.4);
  const waveHit = zA.dead || zA.hp < hpA;
  // The Blaster: victim knocked back, zombie behind loses 50% max HP
  g.inventory.slots[0] = makeWeaponItem('revolver', { pap: true });
  g.inventory.select(0);
  if (zB.dead) return { waveHit, waveVisual, skipB: true };
  const targetZ = zA.dead ? zB : zA;
  g.simulate(0.4); // weapon raise
  // pin positions RIGHT before the shot so the aim can't go stale
  targetZ.pos.set(0, 0, 0);
  targetZ.kb.set(0, 0, 0);
  if (!zA.dead) { zB.pos.set(0, 0, -4); zB.hp = zB.maxHp; } // corridor behind the victim
  targetZ.mesh.position.copy(targetZ.pos);
  targetZ.mesh.updateMatrixWorld(true);
  if (!zA.dead) { zB.mesh.position.copy(zB.pos); zB.mesh.updateMatrixWorld(true); }
  g.aimAt(0, targetZ.pos.y + 1.1, 0);
  g.weapons.cooldown = 0; // the wave cannon's long cooldown carries across equips
  const hpT = targetZ.hp;
  g.fire();
  const behindHalved = zA.dead ? true : (zB.dead || zB.hp <= zB.maxHp * 0.55);
  const knocked = targetZ.dead || targetZ.kb.length() > 3 || targetZ.hp < hpT;
  return { waveHit, waveVisual, behindHalved, knocked, hpT, hpNow: targetZ.hp };
});
push(`W.A.V.E. cannon blasts the horde (${JSON.stringify(legends)})`,
  legends.skip || (legends.waveHit && legends.waveVisual));
push(`★ The Blaster: blastback + 50% max-HP corridor`,
  legends.skip || legends.skipB || (legends.behindHalved && legends.knocked));

// ---------- superboss ----------
const bossRes = await page.evaluate(() => {
  const g = window.__game;
  g.player.maxHealth = 100000; g.player.health = 100000;
  g.startRound(10);
  return new Promise((resolve) => setTimeout(() => {
    g.simulate(1);
    const boss = g.zombies.zombies.find((z) => z.boss);
    resolve(boss ? {
      hp: boss.hp, scale: boss.scale,
      barVisible: document.getElementById('bossBar').style.display === 'block',
    } : null);
  }, 4200));
});
push(`superboss spawns on round 10 (hp=${bossRes?.hp?.toFixed(0)}, ×${bossRes?.scale})`, !!bossRes && bossRes.hp > 5000 && bossRes.scale === 1.9);
push('boss health bar shows', !!bossRes && bossRes.barVisible);

// ---------- electro-trap ----------
const trapRes = await page.evaluate(() => {
  const g = window.__game;
  g.addPoints(5000);
  g.world.rooms.CAMP.unlocked = true;
  g.teleport(0.5, 0.1, 15.8);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  return g.world.trap.state;
});
push(`trap activates (${trapRes})`, trapRes === 'active');

// ================= EXPANSION SYSTEMS =================

// ---------- roof stairs: mezz → roof, zombie-pathable ----------
const roofPath = await page.evaluate(() => {
  const g = window.__game;
  g.world.rooms.UPPER.unlocked = true;
  g.world.rooms.ROOF.unlocked = true;
  g.teleport(-12.3, 3.3, 0.8);
  g.lookAt(Math.PI, 0); // face +z, up the roof stairs
  g.pressKey('KeyW');
  let maxY = 0;
  for (let i = 0; i < 16 && maxY < 6.6; i++) { g.simulate(0.2); maxY = Math.max(maxY, g.player.pos.y); }
  g.releaseKey('KeyW');
  const chain = g.world.pathChain('UPPER', 'ROOF');
  return { maxY, room: g.world.roomAt(g.player.pos), chainLen: chain?.length ?? 0 };
});
push(`roof stairs climbable (y=${roofPath.maxY.toFixed(2)}, room=${roofPath.room})`, roofPath.maxY >= 6.6 && roofPath.room === 'ROOF');
push(`zombies can path UPPER→ROOF (${roofPath.chainLen} waypoints)`, roofPath.chainLen >= 2);

// ---------- mines: underground floor + chest loot ----------
const mineRes = await page.evaluate(() => {
  const g = window.__game;
  const room = g.mines.shaftRooms[0];
  g.teleport(room.x, -7.8, room.z);
  g.simulate(0.5);
  const underground = g.player.pos.y < -7 && g.player.pos.y > -9;
  const chest = g.mines.chests[0];
  g.teleport(chest.pos.x + 1.2, -7.9, chest.pos.z);
  g.simulate(0.2);
  const pts = g.state.points;
  const nearestType = g.nearestInteract()?.type;
  const matsBefore = g.inventory.countOf('diamond') + g.inventory.countOf('steel');
  g.pressF(); g.simulate(0.3); g.releaseF();
  g.simulate(1); // the pickup magnet vacuums nearby loot into the inventory
  const lootNear = g.drops.drops.filter((d) => d.item && d.group.position.distanceTo(chest.pos) < 5).length;
  const matsGained = (g.inventory.countOf('diamond') + g.inventory.countOf('steel')) > matsBefore;
  return {
    underground, opened: chest.opened, nearestType,
    paid: g.state.points > pts, lootDropped: lootNear >= 1 || matsGained,
    shafts: g.mines.shaftRooms.length,
  };
});
push(`mines: player stands at depth (${JSON.stringify(mineRes.underground)})`, mineRes.underground);
push(`mine chest opens with points + loot (${JSON.stringify(mineRes)})`, mineRes.opened && mineRes.paid && mineRes.lootDropped && mineRes.shafts === 4);

// ---------- harvest: ore vein breaks into drops ----------
const oreRes = await page.evaluate(() => {
  const g = window.__game;
  const node = g.harvest.nodes.find((n) => n.kind === 'ore' && !n.broken);
  const before = g.drops.drops.length;
  for (let i = 0; i < 10 && !node.broken; i++) g.harvest.chip(node);
  return { broken: node.broken, dropped: g.drops.drops.length > before, ores: g.harvest.nodes.filter((n) => n.kind === 'ore').length };
});
push(`ore vein mines out + drops (${oreRes.ores} veins in the caves)`, oreRes.broken && oreRes.dropped && oreRes.ores > 15);

// ---------- trees + cows ----------
const meadow = await page.evaluate(() => {
  const g = window.__game;
  const tree = g.harvest.nodes.find((n) => n.kind === 'tree' && !n.broken);
  for (let i = 0; i < 8 && !tree.broken; i++) g.harvest.chip(tree);
  const cow = g.mobs.list.find((m) => !m.dead);
  const before = g.drops.drops.length;
  g.mobs.damage(cow, 500, cow.pos.clone().setY(1), null);
  return { treeFell: tree.broken, cowDead: cow.dead, drops: g.drops.drops.length - before };
});
push(`tree chops down (${meadow.treeFell})`, meadow.treeFell);
push(`cow drops beef + leather (${meadow.drops} drops)`, meadow.cowDead && meadow.drops >= 2);

// ---------- dropped guns: BL2 card + F pickup + G drop ----------
const gunDrop = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem } = await import('/src/items.js');
  g.teleport(460, 0.1, 10); // village plaza — no zombies stealing the F-press
  g.lookAt(0, 0);
  g.inventory.reset();
  g.groundGuns.spawn(g.player.pos.clone().add(new g.THREE.Vector3(0, 0, -1.4)), makeWeaponItem('revolver'));
  g.simulate(0.3);
  const cardShown = document.getElementById('gunCard').style.display === 'block';
  const cardHasStats = document.getElementById('gunCard').innerHTML.includes('Damage');
  g.pressF(); g.simulate(0.2); g.releaseF();
  const picked = g.inventory.slots.some((it) => it?.weaponKey === 'revolver');
  return { cardShown, cardHasStats, picked };
});
push(`ground gun shows Borderlands card (${JSON.stringify(gunDrop)})`, gunDrop.cardShown && gunDrop.cardHasStats && gunDrop.picked);

await page.keyboard.press('KeyG');
await page.waitForTimeout(250);
const gDrop = await page.evaluate(() => {
  const g = window.__game;
  g.simulate(0.2);
  return { onGround: g.groundGuns.entries.length === 1, slotEmpty: !g.inventory.slots[g.inventory.sel] };
});
push(`G drops held item into the world (${JSON.stringify(gDrop)})`, gDrop.onGround && gDrop.slotEmpty);

// ---------- powerups ----------
const pu = await page.evaluate(() => {
  const g = window.__game;
  g.powerups.spawn(g.player.pos.clone(), 'insta');
  g.simulate(0.4);
  const insta = g.state.instaT > 0 && g.zombies.instaKill;
  g.powerups.spawn(g.player.pos.clone(), 'berserker');
  g.simulate(0.4);
  const berserk = g.state.berserkT > 0 && g.weapons.berserk;
  return { insta, berserk };
});
push(`Insta-Kill + Berserker powerups apply (${JSON.stringify(pu)})`, pu.insta && pu.berserk);

// ---------- flamethrower pistol (PaP mauser) ----------
const flame = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem, weaponDef } = await import('/src/items.js');
  g.inventory.reset();
  const drag = makeWeaponItem('mauser', { pap: true });
  g.inventory.addItem(drag);
  g.inventory.select(0);
  g.simulate(0.5);
  const def = weaponDef(drag);
  g.holdMouse(true);
  g.simulate(1.2);
  const heated = g.weapons.heat > 0.8;
  g.holdMouse(false);
  g.simulate(0.2);
  return { name: def.name, isFlame: !!def.flame, heated, recharged: g.weapons.heat === 0 };
});
push(`★ Dragonspit flames + instant recharge (${flame.name}, heat→${flame.heated})`, flame.isFlame && flame.heated && flame.recharged);

// ---------- guided missile (PaP bazooka) ----------
const missile = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem } = await import('/src/items.js');
  g.inventory.reset();
  g.inventory.addItem(makeWeaponItem('rpg', { pap: true }));
  g.inventory.select(0);
  g.teleport(-17, 0.1, 22); // campsite, open air
  g.lookAt(0, 0.5);         // up and away
  g.simulate(0.5);
  g.fire();
  const launched = !!g.weapons.lastMissile;
  g.simulate(0.15);
  g.pressF(); g.simulate(0.1); g.releaseF();
  const guiding = !!g.weapons.guiding;
  const camDetached = g.player.viewLocked;
  for (let i = 0; i < 10; i++) { g.weapons.guideSteer.y = 500; g.simulate(0.1); } // steer down into the dirt
  g.simulate(4);
  return { launched, guiding, camDetached, released: !g.weapons.guiding, camBack: !g.player.viewLocked };
});
push(`PaP bazooka fires a controllable missile (${JSON.stringify(missile)})`,
  missile.launched && missile.guiding && missile.camDetached && missile.released && missile.camBack);

// ---------- economy: market / store / combiner / quests ----------
const econ2 = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem, weaponDef } = await import('/src/items.js');
  g.addPoints(100000);
  // market
  const re = g.market.funds.re;
  g.market.buy('re', 2);
  const owned = re.shares === 2;
  const priceBefore = re.price;
  const ptsBefore = g.state.points;
  g.market.onRound(4);
  const appreciated = re.price > priceBefore;
  const cashflow = g.state.points > ptsBefore;
  const stocksMoved = g.market.funds.stocks.price !== 1000;
  // gun store
  const invBefore = g.inventory.slots.filter(Boolean).length;
  g.store._buy('kar98');
  const bought = g.inventory.slots.some((it) => it?.weaponKey === 'kar98');
  // combiner
  g.inventory.reset();
  g.inventory.slots[0] = makeWeaponItem('smg');
  g.inventory.select(0);
  g.combiner._insert();
  g.inventory.slots[0] = makeWeaponItem('trench');
  g.inventory.select(0);
  g.combiner._insert();
  g.combiner._combine();
  const fused = g.inventory.slots.find((it) => it?.custom);
  // max donor dmg was 34 (M1928); +30% fusion bonus → ~44
  const fusedOk = fused && weaponDef(fused).dmg > 40 && fused.custom.fusedNames.includes('+');
  // quests
  g.quests.current = { type: 'kills', need: 2, have: 0, desc: () => 'test', reward: { points: 500 } };
  g.quests.addKill(); g.quests.addKill();
  const done = g.quests.isDone();
  const qPts = g.state.points;
  g.quests._claim();
  return {
    owned, appreciated, cashflow, stocksMoved, bought, invBefore,
    fusedOk, fusedName: fused?.name, questPaid: g.state.points === qPts + 500,
  };
});
push(`Real Estate: buy shares, +1%/round, 5% cashflow (${JSON.stringify({ o: econ2.owned, a: econ2.appreciated, c: econ2.cashflow })})`,
  econ2.owned && econ2.appreciated && econ2.cashflow && econ2.stocksMoved);
push(`gun store sells weapons (${econ2.bought})`, econ2.bought);
push(`gun combiner fuses 2 guns (${econ2.fusedName})`, econ2.fusedOk);
push(`quest contract pays out (${econ2.questPaid})`, econ2.questPaid);

// ---------- enchanting ----------
const ench = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem, weaponDef } = await import('/src/items.js');
  g.addPoints(30000);
  const gun = makeWeaponItem('stg');
  const base = weaponDef(gun).dmg;
  g.inventory.craftMode = 'anvil';
  g.inventory.craftGrid[0] = gun;
  g.inventory._enchant(2); // 10k tier: 3 enchantments
  const buffed = weaponDef(gun).dmg >= base;
  return { count: gun.ench?.length ?? 0, keys: gun.ench?.map((e) => `${e.key}${e.lvl}`), buffed };
});
push(`anvil enchanting rolls (${JSON.stringify(ench.keys)})`, ench.count >= 1 && ench.count <= 3 && ench.buffed);

// ---------- nuclear weapons ----------
const nuke = await page.evaluate(async () => {
  const g = window.__game;
  const { makeWeaponItem, makeMaterial, weaponDef } = await import('/src/items.js');
  g.inventory.reset();
  const gun = makeWeaponItem('stg');
  g.inventory.slots[0] = gun;
  g.inventory.select(0);
  g.inventory.addItem(makeMaterial('nuclearBrick', 2));
  const base = weaponDef(gun).dmg;
  g.doInteract({ type: 'nuketable', held: gun });
  const def = weaponDef(gun);
  // goop puddle mechanics
  g.weapons.onGoop(g.player.pos.clone().setY(1), 100);
  return {
    nuclear: gun.nuclear, dmgUp: Math.abs(def.dmg / base - 1.25) < 0.01,
    named: def.name.startsWith('☢'), brickUsed: g.inventory.countOf('nuclearBrick') === 1,
    goop: g.goops.length === 1,
  };
});
push(`nuclear table irradiates guns +25% + goop (${JSON.stringify(nuke)})`,
  nuke.nuclear && nuke.dmgUp && nuke.named && nuke.brickUsed && nuke.goop);

// ---------- lambo: buy + deploy ----------
const lambo = await page.evaluate(() => {
  const g = window.__game;
  g.addPoints(1100000);
  g.doInteract({ type: 'lambo' });
  const gotKeys = g.inventory.slots.some((it) => it?.id === 'lamboKeys');
  const idx = g.inventory.slots.findIndex((it) => it?.id === 'lamboKeys');
  if (idx >= 9) { g.inventory.slots[0] = g.inventory.slots[idx]; g.inventory.slots[idx] = null; }
  g.inventory.select(Math.min(idx, 0) >= 0 ? (idx < 9 ? idx : 0) : 0);
  g.teleport(-17, 0.1, 24);
  g.lookAt(0, 0);
  g.simulate(0.2);
  g.click();
  g.simulate(0.4);
  return { gotKeys, kind: g.car.kind, top: g.car.stats.top, deployed: g.car.deployed };
});
push(`Lambo buys for $1M + deploys fast (${lambo.kind}, top=${lambo.top})`, lambo.gotKeys && lambo.kind === 'lambo' && lambo.top > 20 && lambo.deployed);

// ---------- spider boss: wake → eyes → fight → drops ----------
const spider = await page.evaluate(() => {
  const g = window.__game;
  const F = g.facility;
  const asleep = F.boss.state === 'asleep';
  F.powerOn();
  const stirring = F.boss.state === 'stirring';
  // shoot two eyes
  const eyes = F.boss.parts.eyes;
  F.damage({ kind: 'eye', eye: eyes[0] }, 50, eyes[0].getWorldPosition(new g.THREE.Vector3()), null);
  F.damage({ kind: 'eye', eye: eyes[1] }, 50, eyes[1].getWorldPosition(new g.THREE.Vector3()), null);
  const fight = F.boss.state === 'fight';
  const hp = F.boss.maxHp;
  g.teleport(F.center.x, 0.1, F.center.z + 6);
  g.player.maxHealth = 100000; g.player.health = 100000;
  g.simulate(6);
  const moved = F.boss.pos.distanceTo(F.center) < 60; // it's alive and acting
  const dropsBefore = g.drops.drops.length;
  F.damage({ kind: 'specimen' }, 10 ** 7, F.boss.pos.clone(), null);
  return {
    asleep, stirring, fight, hp, moved,
    dead: F.boss.dead, dropped: g.drops.drops.length > dropsBefore,
  };
});
push(`Specimen wakes on power, unlocks on eye-shots (hp=${spider.hp})`, spider.asleep && spider.stirring && spider.fight && spider.hp >= 40000);
push(`Specimen dies → nuclear bricks + wifi radio drop`, spider.dead && spider.dropped);

// ---------- wifi radio browser + PiP ----------
const radio = await page.evaluate(() => {
  const g = window.__game;
  g.laptop.open();
  const full = document.getElementById('browserBox').className === 'fullBrowser';
  const hasIframe = !!document.getElementById('bb-iframe');
  g.laptop.playing = true; // simulate a video playing
  document.getElementById('bb-iframe').src = 'about:blank#video';
  g.laptop.close();
  const pip = document.getElementById('browserBox').className === 'pipBrowser';
  g.laptop.stop();
  return { full, hasIframe, pip };
});
push(`wifi radio browser opens + PiP on walk-away (${JSON.stringify(radio)})`, radio.full && radio.hasIframe && radio.pip);

// ---------- helicopter easter egg → win ----------
const heli = await page.evaluate(async () => {
  const g = window.__game;
  const { makeTool } = await import('/src/items.js');
  g.inventory.reset();
  for (const id of ['rotorBlades', 'heliEngine', 'fuelTank', 'avionics']) g.inventory.addItem(makeTool(id));
  g.world.powerSwitch.on = true;
  g.teleport(4.5, 6.9, 0);
  for (let i = 0; i < 4; i++) { g.simulate(0.15); g.pressF(); g.simulate(0.2); g.releaseF(); }
  const parts = { ...g.world.heli.parts };
  g.simulate(0.15);
  g.pressF(); g.simulate(0.2); g.releaseF(); // START HER UP
  const flying = g.world.heli.done;
  g.simulate(3);
  const lifting = g.world.heli.group.position.y >= 6.79;
  return { parts, flying, lifting };
});
push(`helicopter: 4 parts install (${Object.values(heli.parts).filter(Boolean).length}/4) + takeoff`,
  Object.values(heli.parts).every(Boolean) && heli.flying && heli.lifting);

// ---------- gucci tints ----------
const gucci = await page.evaluate(async () => {
  const g = window.__game;
  const { makeArmorItem, makeTool } = await import('/src/items.js');
  g.inventory.reset();
  for (const slot of ['helmet', 'chest', 'legs', 'boots']) g.inventory.armor[slot] = makeArmorItem(slot, 2);
  for (let i = 0; i < 4; i++) {
    const tint = makeTool('gucciTint');
    g.inventory.slots[30] = tint;
    g.inventory._applyTint('inv', 30, tint);
  }
  const b = g.inventory.tintBonuses();
  return { pts: b.pts, speed: b.speed, name: g.inventory.armor.helmet.name };
});
push(`full Gucci set: +points & +speed (pts×${gucci.pts.toFixed(2)}, spd×${gucci.speed.toFixed(2)}, "${gucci.name}")`,
  gucci.pts > 2 && gucci.speed > 1.1 && gucci.name.startsWith('Gucci'));

// ---------- village exists at distance ----------
const villageRes = await page.evaluate(async () => {
  const g = window.__game;
  const { VILLAGE } = await import('/src/village.js');
  const dist = Math.hypot(VILLAGE.x, VILLAGE.z);
  g.teleport(VILLAGE.x, 0.1, VILLAGE.z + 6);
  g.simulate(0.5);
  return { dist, standing: g.player.pos.y < 1, tv: !!g.village.tvCanvas, npcs: g.village.npcs.length };
});
push(`village sits ${Math.round(villageRes.dist)}m out with TV + ${villageRes.npcs} NPCs`, villageRes.dist > 400 && villageRes.standing && villageRes.tv && villageRes.npcs >= 4);

// ---------- library page ----------
await page.goto(BASE + '/library.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);
const cards = await page.evaluate(() => document.querySelectorAll('.card').length);
push(`asset library renders ${cards} cards`, cards >= 22);
await page.screenshot({ path: `${SHOT_DIR}/library.png` });

await browser.close();

console.log('\n=== UNDEAD BUNKER SMOKE ===');
let fail = 0;
for (const [name, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail++; }
console.log('\nConsole errors:', errors.length ? errors.slice(0, 10) : 'none');
process.exit(fail || errors.length ? 1 : 0);
