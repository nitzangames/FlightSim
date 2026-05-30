// Renders p51-inspect.html (live import of lib/plane/p51.js) and saves a
// screenshot. Run while `npm run dev` is up on :8085.
//   node tools/inspect-p51.cjs            -> p51-inspect.png
//   node tools/inspect-p51.cjs out.png    -> out.png
const puppeteer = require('/Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/node_modules/puppeteer');

(async () => {
  const out = process.argv[2] || 'p51-inspect.png';
  const url = 'http://localhost:8085/p51-inspect.html';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(out + ' saved');
})();
