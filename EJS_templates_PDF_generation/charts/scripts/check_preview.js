const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
(async ()=>{
  const file = path.join(__dirname,'..','node_runtime','pie','pie_preview.html');
  if (!fs.existsSync(file)) { console.error('Not found', file); process.exit(1); }
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => console.log('PAGE:', m.text()));
  await page.goto('file://'+file, { waitUntil: 'networkidle0' });
  // wait a bit for scripts and DOM handlers to run
  await new Promise(r=>setTimeout(r,1800));
  const info = await page.evaluate(()=>{
    const cvs = Array.from(document.querySelectorAll('canvas')).map(c=>({id:c.id, w:c.width, h:c.height}));
    const cfgExists = typeof window.__injected_cfg !== 'undefined';
    const cfg = cfgExists ? window.__injected_cfg : null;
    const ready = document.readyState;
    function sumPixels(c){ try{ const ctx=c.getContext('2d'); const d=ctx.getImageData(0,0,c.width,c.height).data; let s=0; for(let i=0;i<d.length;i++)s+=d[i]; return s;}catch(e){return null;} }
    const sums = Array.from(document.querySelectorAll('canvas')).map(c=>sumPixels(c));
    return { canvases:cvs, cfgExists, ready, cfg, sums };
  });
  console.log('RESULT:', JSON.stringify(info,null,2));

  // If cfg wasn't injected, try forcing a render to see errors
  if (!info.cfgExists) {
    const forced = await page.evaluate(()=>{
      try {
        if (typeof renderChart !== 'function') return { ok: false, msg: 'renderChart missing' };
        // try a minimal forced config
        const testCfg = { type: 'pie', labels: ['A','B','C'], data: [1,2,3], title: 'forced' };
        try { renderChart('chartSingle', testCfg); } catch (e) { return { ok: false, msg: e.message }; }
        return { ok: true };
      } catch (e) { return { ok: false, msg: e.message }; }
    });
    console.log('FORCED_RENDER:', forced);
    const afterSums = await page.evaluate(()=>{ function sumPixels(c){try{const ctx=c.getContext('2d');const d=ctx.getImageData(0,0,c.width,c.height).data;let s=0;for(let i=0;i<d.length;i++)s+=d[i];return s}catch(e){return null}}; return Array.from(document.querySelectorAll('canvas')).map(sumPixels); });
    console.log('AFTER_SUMS', afterSums);
  }
  await browser.close();
})();