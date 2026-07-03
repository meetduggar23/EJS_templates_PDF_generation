const puppeteer = require('puppeteer');
const path = require('path');
(async ()=>{
  const file = path.resolve(__dirname, '..', 'node_runtime', 'pie', 'pie_preview.html');
  const browser = await puppeteer.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox']});
  try{
    const page = await browser.newPage();
    page.on('console', msg => {
      try { console.log('PAGE:', msg.text()); } catch(e) {}
    });
    await page.goto('file:///' + file.replace(/\\/g,'/'));
    await new Promise(r => setTimeout(r, 1200));

    const result = await page.evaluate(()=>{
      const canvas = document.querySelector('canvas');
      if (!canvas) return { found:false };
      let ctx = null;
      try { ctx = canvas.getContext('2d'); } catch(e) { return { found:true, error: e.message }; }
      try {
        const id = ctx.getImageData(0,0,canvas.width,canvas.height);
        let nonzero = 0;
        for (let i=0;i<id.data.length;i+=4) { if (id.data[i]||id.data[i+1]||id.data[i+2]||id.data[i+3]) nonzero++; }
        const chartExists = (typeof Chart !== 'undefined') && (Chart.getChart ? !!Chart.getChart(canvas) : (Chart.instances ? Object.keys(Chart.instances).length>0 : true));
        const renderType = typeof window.renderChart;
        return { found:true, w: canvas.width, h: canvas.height, nonzeroPixels: nonzero, chartExists: chartExists, renderType: renderType };
      } catch (e) {
        const chartExists = (typeof Chart !== 'undefined');
        return { found:true, error: e.message, chartExists: chartExists };
      }
    });
    console.log('CANVAS_CHECK:', result);
    // Try invoking renderChart manually if available
    const manual = await page.evaluate(()=>{
      try {
        if (typeof renderChart === 'function') { renderChart('chartSingle', window.__injected_cfg || null); return 'invoked'; }
        return 'no-renderer';
      } catch(e) { return 'error:'+e.message; }
    });
    console.log('MANUAL_INVOKE:', manual);
  } finally { await browser.close(); }
})();