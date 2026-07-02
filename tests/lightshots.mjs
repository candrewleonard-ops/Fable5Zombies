import { chromium } from 'playwright';
const OUT = 'tests/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/?test=1&nozombies=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__game?.state.playing, null, { timeout: 15000 });
await page.waitForTimeout(1500);

const spots = [
  ['light-main', 0, 0.1, 4, Math.PI, -0.05],        // main hall looking south... yaw π faces +z
  ['light-main-north', 0, 0.1, 6, 0, 0],            // looking north across the hall
  ['light-armory', -17, 0.1, 8, Math.PI * 0.75, 0], // armory interior
  ['light-mezz', -6, 3.3, 5, Math.PI / 2, -0.05],   // mezzanine
  ['light-camp', -8, 0.1, 13, Math.PI, -0.02],      // campsite toward campfire
  ['light-outside', 20, 0.1, -18, 0.5, 0.05],       // exterior field, moon + trees
];
for (const [name, x, y, z, yaw, pitch] of spots) {
  await page.evaluate(([x, y, z, yaw, pitch]) => {
    const g = window.__game;
    if (name !== 'light-camp') g.world.rooms.CAMP.unlocked = true;
    g.world.rooms.ARMORY.unlocked = true;
    g.world.rooms.UPPER.unlocked = true;
    g.teleport(x, y, z);
    g.lookAt(yaw, pitch);
    g.simulate(0.4);
  }, [x, y, z, yaw, pitch]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
await browser.close();
console.log('shots done');
