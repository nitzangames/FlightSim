// Captures thumbnail.png by loading the running dev server and taking a clean
// menu shot of the biplane on the turntable. Run: `node tools/screenshot.cjs`
// while `npm run dev` is running.
//
// Uses the puppeteer install from a neighbor JSGames project so we don't bloat
// this repo's devDeps for a one-off capture.
const puppeteer = require('/Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/node_modules/puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:8085';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  // Let the turntable spin a beat so we get a flattering 3/4 angle
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: 'thumbnail.png', clip: { x: 0, y: 0, width: 540, height: 960 } });
  await browser.close();
  console.log('thumbnail.png saved');
})();
