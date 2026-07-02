import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message.slice(0, 400)));
await page.goto('http://localhost:5173/?test=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => ({
  hasGame: typeof window.__game !== 'undefined',
  menuVisible: getComputedStyle(document.getElementById('menuOverlay')).display,
  hudDisplay: document.getElementById('hud').style.display,
}));
console.log(JSON.stringify(info));
if (info.hasGame) {
  await page.evaluate(() => window.__game.simulate(5));
  const st = await page.evaluate(() => ({ round: window.__game.state.round, z: window.__game.zombies.zombies.length, y: window.__game.player.pos.y }));
  console.log('sim:', JSON.stringify(st));
  await page.screenshot({ path: (process.env.OUT || 'tests/shots') + '/bunker-first.png' });
}
await browser.close();
