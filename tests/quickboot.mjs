import { chromium } from 'playwright';

const OUT = process.env.OUT || 'tests/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:5173/?test=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const st = await page.evaluate(() => window.__game ? { playing: window.__game.state.playing, round: window.__game.state.round } : null).catch(() => null);
console.log('state:', JSON.stringify(st));
await page.evaluate(() => window.__game?.simulate(5)).catch((e) => errors.push('SIM: ' + e.message));
const st2 = await page.evaluate(() => ({
  round: window.__game.state.round,
  zombies: window.__game.zombies.zombies.length,
  pts: window.__game.state.points,
  playerY: window.__game.player.pos.y.toFixed(2),
})).catch((e) => { errors.push('READ: ' + e.message); return null; });
console.log('after sim:', JSON.stringify(st2));
await page.screenshot({ path: `${OUT}/bunker-first.png` });

// library page too
await page.goto('http://localhost:5173/library.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/library.png`, fullPage: false });

console.log('errors:', errors.length ? JSON.stringify(errors.slice(0, 8), null, 1) : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
