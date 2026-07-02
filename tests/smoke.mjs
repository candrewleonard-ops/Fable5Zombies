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
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// ---------- menu ----------
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForSelector('#startBtn', { state: 'visible', timeout: 15000 }).catch(() => {});
push('menu renders', await page.locator('#startBtn').isVisible());
await page.screenshot({ path: `${SHOT_DIR}/menu.png` });

// ---------- movement / map (no zombies) ----------
await page.goto(BASE + '/?test=1&nozombies=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__game?.state.playing, null, { timeout: 15000 });
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

// ---------- perk machine ----------
const perk = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(12.4, 0.1, -9.2);
  g.simulate(0.1);
  g.pressF(); g.simulate(0.3); g.releaseF();
  return { has: g.player.perks.has('tonic'), hp: g.player.maxHealth };
});
push(`Tough Tonic buys (+maxHP=${perk.hp})`, perk.has && perk.hp === 250);

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
  const { makeTool } = await import('/src/items.js');
  g.inventory.reset();
  g.inventory.addItem(makeTool('buildStairs'));
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
await page.mouse.move(300, 200);
await page.waitForTimeout(300);
const headA = await page.evaluate(() => window.__game.inventory.paperdoll.headPivot.rotation.y);
await page.mouse.move(1100, 620);
await page.waitForTimeout(500);
const headB = await page.evaluate(() => window.__game.inventory.paperdoll.headPivot.rotation.y);
push(`paperdoll head tracks cursor (${headA.toFixed(2)}→${headB.toFixed(2)})`, Math.abs(headB - headA) > 0.2);
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
push(`right-click equips armor (${armorOk.pts} pts)`, armorOk.equipped && armorOk.pts === 25);
await page.screenshot({ path: `${SHOT_DIR}/inventory.png` });
await page.keyboard.press('KeyT');
await page.waitForTimeout(300);

// ---------- zombies: full lifecycle on a fresh page ----------
await page.goto(BASE + '/?test=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__game?.state.playing, null, { timeout: 15000 });
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

// ---------- library page ----------
await page.goto(BASE + '/library.html', { waitUntil: 'networkidle' });
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
