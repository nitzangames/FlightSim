const puppeteer = require('/Users/nitzanwilnai/Programming/Claude/JSGames/CanyonRun3D/node_modules/puppeteer');

(async () => {
  const out = process.argv[2] || 'f16-side.png';
  const url = 'http://localhost:8085/f16-side.html';
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 600, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  await new Promise(r => setTimeout(r, 400));
  const cv = await page.$('#cv');
  await cv.screenshot({ path: out });
  await browser.close();
  console.log(out + ' saved');
})();
