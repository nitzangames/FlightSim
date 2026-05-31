// Renders f86-inspect.html (live import of lib/plane/f86.js) and saves a
// screenshot. Run while `npm run dev` is up on :8085.
//   node tools/inspect-f86.cjs            -> f86-inspect.png
//   node tools/inspect-f86.cjs out.png    -> out.png
const puppeteer = require('/Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/node_modules/puppeteer');

(async () => {
  const out = process.argv[2] || 'f86-inspect.png';
  const url = 'http://localhost:8085/f86-inspect.html';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(out + ' saved');
})();
