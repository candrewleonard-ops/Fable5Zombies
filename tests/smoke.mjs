import { chromium } from 'playwright';

// End-to-end smoke test. Uses the ?test=1 hook (window.__game) and its
// simulate() helper so game-logic assertions are independent of headless
// render speed.

const SHOT_DIR = process.env.SHOT_DIR || 'tests/shots';
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const results = [];
const errors = [];

const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => {
  // ignore network noise (blocked font CDN etc.) — we care about game errors
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text());
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// --- menu ---
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${SHOT_DIR}/menu.png` });
results.push(['menu renders', await page.locator('#play-btn').isVisible()]);

// --- test mode, no zombies: deterministic movement checks ---
await page.goto(BASE + '/?test=1&nozombies=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
results.push(['game auto-starts in test mode', await page.evaluate(() => window.__game?.state === 'playing')]);
results.push(['HUD visible', await page.locator('#hud').isVisible()]);
await page.screenshot({ path: `${SHOT_DIR}/hud.png` });

// --- STAIRS: chapel staircase to the rooftop ---
const stair = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(7.6, 0.3, -0.5);   // chapel interior, north of the stair base
  g.lookAt(Math.PI, 0);         // face +z, straight up the stairs
  g.pressKey('KeyW');
  let maxY = 0;
  for (let i = 0; i < 15 && maxY < 3.0; i++) { // stop at the top (before walking off the roof edge)
    g.simulate(0.2);
    maxY = Math.max(maxY, g.player.pos.y);
  }
  g.releaseKey('KeyW');
  return { maxY, z: g.player.pos.z };
});
results.push([`chapel stairs climbable (peak y=${stair.maxY.toFixed(2)}, z=${stair.z.toFixed(1)}, need >= 3.0)`, stair.maxY >= 3.0]);
await page.screenshot({ path: `${SHOT_DIR}/on-rooftop.png` });

// walk around the rooftop — should stay up there (floor2, not fall through)
const roof = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(7.65, 3.4, 6.5);
  g.lookAt(Math.PI / 2, 0);     // face -x across the roof
  g.pressKey('KeyW');
  g.simulate(2);
  g.releaseKey('KeyW');
  return { y: g.player.pos.y, x: g.player.pos.x };
});
results.push([`rooftop walkable (x -> ${roof.x.toFixed(1)}, y=${roof.y.toFixed(2)})`, roof.y > 3.0]);

// --- STAIRS: outdoor wooden platform ---
const stair2 = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(-24, 0.1, 25.2);
  g.lookAt(0, 0);               // face -z toward the platform steps
  g.pressKey('KeyW');
  g.simulate(3);
  g.releaseKey('KeyW');
  return { y: g.player.pos.y, z: g.player.pos.z };
});
results.push([`platform stairs climbable (y -> ${stair2.y.toFixed(2)}, need >= 2.5)`, stair2.y >= 2.5]);

// --- LEAN: Q/E swerve ---
const lean = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(0, 0.3, 12);
  g.lookAt(0, 0);
  g.pressKey('KeyQ');
  g.simulate(0.8);
  const engaged = {
    lean: g.player.lean,
    roll: g.player.leanRoot.rotation.z,
    offx: g.player.leanRoot.position.x,
  };
  g.releaseKey('KeyQ');
  g.simulate(0.8);
  engaged.recovered = Math.abs(g.player.lean) < 0.05;
  return engaged;
});
results.push([`Q lean engages (lean=${lean.lean.toFixed(2)}, roll=${lean.roll.toFixed(2)}, offset=${lean.offx.toFixed(2)})`, lean.lean < -0.9 && lean.roll > 0.18 && lean.offx < -0.5]);
results.push(['lean recovers on release', lean.recovered]);
await page.evaluate(() => { const g = window.__game; g.pressKey('KeyE'); g.simulate(0.8); });
await page.screenshot({ path: `${SHOT_DIR}/lean-e.png` });
await page.evaluate(() => { const g = window.__game; g.releaseKey('KeyE'); g.simulate(0.8); });

// --- INVENTORY on T ---
await page.keyboard.press('KeyT');
await page.waitForTimeout(400);
results.push(['T opens inventory', await page.locator('#inventory-screen').isVisible()]);

// paperdoll head tracks the cursor
await page.mouse.move(250, 180);
await page.waitForTimeout(400);
const headA = await page.evaluate(() => window.__game.inventory.paperdoll.headPivot.rotation.y);
await page.mouse.move(1150, 620);
await page.waitForTimeout(600);
const headB = await page.evaluate(() => window.__game.inventory.paperdoll.headPivot.rotation.y);
results.push([`paperdoll head tracks cursor (${headA.toFixed(2)} -> ${headB.toFixed(2)})`, Math.abs(headB - headA) > 0.2]);
await page.screenshot({ path: `${SHOT_DIR}/inventory.png` });

// right-click equips armor, paperdoll shows it
const armorOk = await page.evaluate(async () => {
  const g = window.__game;
  const { makeArmorItem } = await import('/src/items.js');
  g.inventory.addItem(makeArmorItem('helmet', 2));   // +25
  g.inventory.addItem(makeArmorItem('chest', 3));    // +60
  const gridEls = [...document.querySelectorAll('#inv-grid .slot')];
  g.inventory.grid.forEach((it, i) => {
    if (it?.kind === 'armor') {
      gridEls[i].dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
    }
  });
  return {
    helmet: !!g.inventory.armor.helmet,
    chest: !!g.inventory.armor.chest,
    armorPts: g.player.armor,
    dollShowsHelmet: g.inventory.paperdoll.armorMeshes.helmet[0].visible,
    dollShowsChest: g.inventory.paperdoll.armorMeshes.chest[0].visible,
  };
});
results.push([`right-click equips armor (pts=${armorOk.armorPts}, need 85)`, armorOk.helmet && armorOk.chest && armorOk.armorPts === 85]);
results.push(['paperdoll shows equipped armor', armorOk.dollShowsHelmet && armorOk.dollShowsChest]);
await page.mouse.move(640, 480);
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOT_DIR}/inventory-armored.png` });

await page.keyboard.press('KeyT');
await page.waitForTimeout(250);
results.push(['T closes inventory', !(await page.locator('#inventory-screen').isVisible())]);

// --- combat: zombies spawn, take damage, die, drop loot ---
await page.goto(BASE + '/?test=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const combat = await page.evaluate(() => {
  const g = window.__game;
  g.teleport(0, 0.3, 12);
  g.simulate(6); // spawn + rise + approach
  const z = g.zombies.zombies.find((z) => !z.dead && z.state !== 'rising');
  if (!z) return { skip: true, count: g.zombies.zombies.length };
  g.player.maxHealth = 100000; g.player.health = 100000; // survive the horde while we test
  g.teleport(z.pos.x, z.pos.y + 0.1, z.pos.z + 4);
  g.aimAt(z.pos.x, z.pos.y + 1.1, z.pos.z);
  g.simulate(0.05);
  const hpBefore = z.hp;
  const magBefore = g.weapons.item.mag;
  g.fire();
  const hpAfterFirst = z.hp;
  // now dump shots into it until it dies (pistol: 34 dmg/shot)
  for (let i = 0; i < 15 && !z.dead; i++) {
    g.simulate(0.5);            // wait out fire cooldown + any reload
    g.aimAt(z.pos.x, z.pos.y + 1.1, z.pos.z);
    g.simulate(0.02);           // let the rig matrices settle on the new aim
    g.fire();
  }
  g.simulate(1);
  return {
    count: g.zombies.zombies.length,
    hpBefore, hpAfterFirst,
    magBefore, magAfter: g.weapons.item.mag,
    died: z.dead,
    kills: g.player.kills,
    points: g.player.points,
  };
});
results.push([`zombies spawn (${combat.count})`, combat.count >= 1]);
if (!combat.skip) {
  results.push([`shooting damages zombies (${combat.hpBefore?.toFixed(0)} -> ${combat.hpAfterFirst?.toFixed(0)})`, combat.hpAfterFirst < combat.hpBefore]);
  results.push([`zombie dies + kill credited (kills=${combat.kills}, pts=${combat.points})`, combat.died && combat.kills >= 1 && combat.points > 0]);
} else {
  results.push(['combat test found a chasing zombie', false]);
}
await page.screenshot({ path: `${SHOT_DIR}/combat.png` });

await browser.close();

console.log('\n=== SMOKE RESULTS ===');
let fail = 0;
for (const [name, ok] of results) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name); if (!ok) fail++; }
console.log('\nConsole errors:', errors.length ? errors.slice(0, 10) : 'none');
process.exit(fail || errors.length ? 1 : 0);
