// Captures the F-22 as it actually renders IN-GAME (menu turntable, real game
// lighting + camera), from several rotation angles. Cycles the menu ► arrow to
// the F-22 (locked planes are browseable). Run while `npm run dev` (8085) is up:
//   node tools/shot-f22-game.cjs
const puppeteer = require('/Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/node_modules/puppeteer');

const PLANE_ORDER = ['biplane','triplane','ww2','p51','f86','f4','a10','f16','f18','f15','f22','sr71'];

(async () => {
  const url = process.argv[2] || 'http://localhost:8085';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1500)); // settle

  // Click ► to walk from the biplane (index 0) to the F-22 (index 10).
  const steps = PLANE_ORDER.indexOf('f22');
  for (let i = 0; i < steps; i++) {
    await page.click('button[data-next]');
    await new Promise(r => setTimeout(r, 120));
  }
  // Confirm we're on the F-22.
  const name = await page.$eval('[data-name], .plane-name, body', el => el.textContent || '');
  await new Promise(r => setTimeout(r, 300));

  // Turntable spins 0.5 rad/s. Capture 8 frames ~45deg apart = full circle.
  const N = 8;
  for (let i = 0; i < N; i++) {
    await page.screenshot({ path: `f22-game-${i}.png`, clip: { x: 0, y: 0, width: 540, height: 760 } });
    await new Promise(r => setTimeout(r, 1570));
  }
  await browser.close();
  console.log(`saved f22-game-0..${N - 1}.png (name sample: ${name.slice(0, 40)})`);
})();
