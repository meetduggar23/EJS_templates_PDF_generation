const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function findPreviews(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...findPreviews(full));
    else if (e.isFile() && e.name.endsWith('_preview.html')) results.push(full);
  }
  return results;
}

(async ()=>{
  const root = path.resolve(__dirname, '..', 'node_runtime');
  if (!fs.existsSync(root)) { console.error('node_runtime folder missing'); process.exit(1); }
  const previews = findPreviews(root);
  if (!previews.length) { console.log('No preview HTML files found under node_runtime/'); return; }

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  try {
    for (const htmlPath of previews) {
      const rel = path.relative(root, htmlPath);
      const out = htmlPath.replace(/_preview.html$/i, '_preview.png');
      const page = await browser.newPage();
      page.on('console', msg => {});
      await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
      await new Promise(r => setTimeout(r, 800));

      const canvas = await page.$('canvas');
      if (canvas) {
        await canvas.screenshot({ path: out });
        console.log(`Saved canvas screenshot: ${path.relative(process.cwd(), out)}`);
      } else {
        // fallback: full page screenshot
        await page.screenshot({ path: out, fullPage: true });
        console.log(`Saved fullpage screenshot: ${path.relative(process.cwd(), out)}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
})();
