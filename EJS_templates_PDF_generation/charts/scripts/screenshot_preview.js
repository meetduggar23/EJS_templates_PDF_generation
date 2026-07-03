const puppeteer = require('puppeteer');
const path = require('path');
(async ()=>{
  const name = process.argv[2] || 'pie';
  const file = path.resolve(__dirname, '..', 'node_runtime', name, name + '_preview.html');
  const out = path.resolve(__dirname, '..', 'node_runtime', name, name + '_preview.png');
  const browser = await puppeteer.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox']});
  try{
    const page = await browser.newPage();
    await page.goto('file:///' + file.replace(/\\/g,'/'));
    await new Promise(r => setTimeout(r, 1200));
    const canvas = await page.$('canvas');
    if (!canvas) {
      console.error('Canvas not found');
      return process.exit(1);
    }
    await canvas.screenshot({path: out});
    console.log('Saved screenshot:', out);
  } finally { await browser.close(); }
})();