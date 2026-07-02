import { chromium } from 'playwright';

// Barricade-escape stress test: sprint-jump diagonally into every window /
// camp barricade / closed door for seconds at worst-case 20fps timesteps
// (dt=0.05, the engine's clamp) and assert the player never ends up on the
// wrong side. This is the "glitched outside the map" repro.

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message.slice(0, 200)));
await page.goto((process.env.BASE_URL || 'http://localhost:5173') + '/?test=1&nozombies=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__game?.state.playing, null, { timeout: 15000 });
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const g = window.__game;
  for (const r of Object.values(g.world.rooms)) r.unlocked = true;
  g.player.perks.add('fleet'); // fastest possible sprint
  const out = [];

  // --- every window / camp barricade with boards ---
  for (const win of g.world.windows) {
    if (win.gate) continue; // the trap gate is open by design
    // rip all boards so only the blocker stands between us and outside
    for (const b of [...win.boards]) if (b.on) g.world.ripBoard(win, b);
    const inner = win.inner, outer = win.outer;
    // inward direction (from outer toward inner)
    const ix = inner.x - outer.x, iz = inner.z - outer.z;
    const il = Math.hypot(ix, iz);
    const nx = ix / il, nz = iz / il;

    for (const jump of [false, true]) {
      // stand just inside, face the window, sprint diagonally into it
      g.teleport(inner.x, win.floorY + 0.1, inner.z);
      g.lookAt(Math.atan2(nx, nz), 0); // forward = -inward = toward outside
      g.pressKey('KeyW');
      g.pressKey('ShiftLeft');
      g.pressKey('KeyA');
      if (jump) g.pressKey('Space');
      // wiggle strafe while pressing in, at 20fps worst case
      for (let i = 0; i < 12; i++) {
        g.simulateDt(0.35, 0.05);
        if (i % 3 === 0) { g.releaseKey('KeyA'); g.pressKey('KeyD'); }
        else if (i % 3 === 1) { g.releaseKey('KeyD'); g.pressKey('KeyA'); }
      }
      for (const k of ['KeyW', 'ShiftLeft', 'KeyA', 'KeyD', 'Space']) g.releaseKey(k);
      // which side are we on? project player onto the inward axis relative to the wall plane (group position)
      const wp = win.group.position;
      const side = (g.player.pos.x - wp.x) * nx + (g.player.pos.z - wp.z) * nz;
      if (side < 0.1) {
        out.push(`ESCAPED window ${win.room} @(${wp.x.toFixed(1)},${wp.z.toFixed(1)}) jump=${jump} side=${side.toFixed(2)}`);
      }
    }
    // restore boards
    for (let i = 0; i < 6; i++) g.world.addBoard(win);
  }

  // --- every closed door (reload state: doors already open from unlocks? doors stay closed until bought) ---
  for (const door of g.world.doors) {
    if (door.open) continue;
    const p = door.pos;
    // press into the door from both sides
    for (const sgn of [1, -1]) {
      const along = door.group.rotation.y === 0 ? { x: 0, z: 1 } : { x: 1, z: 0 };
      const sx = p.x + along.x * sgn * 1.2;
      const sz = p.z + along.z * sgn * 1.2;
      g.teleport(sx, 0.1, sz);
      g.simulateDt(0.3, 0.05); // settle; skip invalid starts (e.g. inside the staircase)
      if (Math.hypot(g.player.pos.x - sx, g.player.pos.z - sz) > 1) continue;
      g.lookAt(Math.atan2(-(p.x - sx), -(p.z - sz)), 0);
      g.pressKey('KeyW'); g.pressKey('ShiftLeft');
      g.simulateDt(3, 0.05);
      for (const k of ['KeyW', 'ShiftLeft']) g.releaseKey(k);
      const side = (g.player.pos.x - p.x) * along.x * sgn + (g.player.pos.z - p.z) * along.z * sgn;
      if (side < 0.05) out.push(`TUNNELED door ${door.name} from side ${sgn} (side=${side.toFixed(2)})`);
    }
  }

  return out;
});

console.log(res.length ? res.join('\n') : 'NO ESCAPES — all barricades and doors held at 20fps sprint+jump+wiggle');
await browser.close();
process.exit(res.length ? 1 : 0);
