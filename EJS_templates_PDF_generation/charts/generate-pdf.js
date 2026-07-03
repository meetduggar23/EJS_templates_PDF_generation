'use strict';

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

const CONFIG_DIR = path.join(__dirname, 'config');
const RUNTIME_DIR = path.join(__dirname, 'node_runtime');
const TEMPLATE_PATH = path.join(__dirname, 'views', 'chart.ejs');
const CHARTJS_PATH = path.join(__dirname, 'public', 'js', 'chart.umd.min.js');

function ensureFolder(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getVersionedPath(folderPath, baseName, ext, overwrite = false) {
  if (overwrite) {
    return path.join(folderPath, `${baseName}${ext}`);
  }
  const plain = path.join(folderPath, `${baseName}${ext}`);
  if (!fs.existsSync(plain)) return plain;
  let i = 1;
  while (true) {
    const p = path.join(folderPath, `${baseName}(${i})${ext}`);
    if (!fs.existsSync(p)) return p;
    i++;
  }
}

// Supported chart types
const SUPPORTED_CHART_TYPES = [
  'bar', 'line', 'pie', 'doughnut', 'radar', 'polararea', 'scatter', 'bubble', 'gantt'
];
function normalizeConfigStructure(raw) {
  let chart = null;
  
  // Check for nested chart object
  if (raw && raw.chart) {
    chart = raw.chart;
  } else if (raw && typeof raw === 'object') {
    chart = raw;
  }
  
  if (!chart) return null;
  
  // Handle nested data structure: { type, data: { labels, datasets } }
  if (chart.data && typeof chart.data === 'object' && !Array.isArray(chart.data)) {
    const nestedData = chart.data;
    // Move labels and datasets from nested data to top level
    if (Array.isArray(nestedData.labels)) {
      chart.labels = nestedData.labels;
    }
    if (Array.isArray(nestedData.datasets)) {
      chart.datasets = nestedData.datasets;
    }
    // Also handle flat data array in nested structure
    if (!Array.isArray(nestedData.labels) && !Array.isArray(nestedData.datasets) && Array.isArray(nestedData.data)) {
      chart.data = nestedData.data;
    }
    // Remove the nested data object to avoid confusion
    delete chart.data;
  }
  
  return chart;
}

/**
 * Validate chart configuration
 * Returns { valid: boolean, errors: string[] }
 */
function validateChartConfig(chart) {
  const errors = [];
  
  if (!chart || typeof chart !== 'object') {
    errors.push('Invalid chart configuration: must be an object');
    return { valid: false, errors };
  }
  
  // Validate chart type
  if (!chart.type) {
    errors.push('Missing required field: "type" (e.g., "bar", "line", "pie")');
  } else {
    const type = String(chart.type).toLowerCase();
    if (!SUPPORTED_CHART_TYPES.includes(type)) {
      errors.push(`Unsupported chart type: "${chart.type}". Supported types: ${SUPPORTED_CHART_TYPES.join(', ')}`);
    }
  }
  
  const isGantt = chart.type && chart.type.toLowerCase() === 'gantt';
  const isScatterOrBubble = ['scatter', 'bubble'].includes(chart.type && chart.type.toLowerCase());
  const isMultiSegment = ['pie', 'doughnut', 'polararea'].includes(chart.type && chart.type.toLowerCase());
  
  if (isGantt) {
    // Gantt charts need tasks or data
    if (!Array.isArray(chart.tasks) || chart.tasks.length === 0) {
      if (!Array.isArray(chart.data) || chart.data.length === 0) {
        errors.push('Gantt chart requires "tasks" or "data" array with task definitions');
      }
    }
  } else if (isScatterOrBubble) {
    // Scatter/Bubble charts need datasets with x,y coordinates
    if (!Array.isArray(chart.datasets) || chart.datasets.length === 0) {
      if (!Array.isArray(chart.data) || chart.data.length === 0) {
        errors.push('Scatter/Bubble chart requires "datasets" or "data" array with x,y coordinates');
      }
    }
  } else {
    // Standard charts need labels and data/datasets
    const hasLabels = Array.isArray(chart.labels) && chart.labels.length > 0;
    const hasDatasets = Array.isArray(chart.datasets) && chart.datasets.length > 0;
    const hasData = Array.isArray(chart.data) && chart.data.length > 0;
    
    if (!hasLabels && !hasDatasets) {
      errors.push('Chart requires "labels" array or "datasets" array with labels');
    }
    
    if (!hasData && !hasDatasets) {
      errors.push('Chart requires "data" array or "datasets" array with values');
    }
    
    // Validate dataset structure if datasets exist
    if (hasDatasets) {
      chart.datasets.forEach((ds, i) => {
        if (!ds || typeof ds !== 'object') {
          errors.push(`Dataset ${i + 1} is not a valid object`);
        } else if (!Array.isArray(ds.data) || ds.data.length === 0) {
          errors.push(`Dataset ${i + 1} has empty or missing "data" array`);
        }
      });
      
      // For multi-segment charts, datasets should have data matching labels count
      if (isMultiSegment && chart.datasets.length === 1) {
        const ds = chart.datasets[0];
        if (hasLabels && ds.data.length !== chart.labels.length) {
          errors.push(`Dataset data count (${ds.data.length}) does not match labels count (${chart.labels.length})`);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function loadConfig(name) {
  // Prevent path traversal
  const safeName = path.basename(name);
  const fp = path.join(CONFIG_DIR, `${safeName}.json`);
  if (!fp.startsWith(CONFIG_DIR)) throw new Error(`Invalid config name: ${name}`);
  if (!fs.existsSync(fp)) throw new Error(`Config not found: ${fp}`);
  
  // Log file modification time to verify fresh read
  const stats = fs.statSync(fp);
  console.log(`  ● Loading config file: ${safeName}.json (modified: ${stats.mtime.toISOString()})`);
  
  let raw;
  try {
    const fileContent = fs.readFileSync(fp, 'utf-8');
    raw = JSON.parse(fileContent);
  } catch (e) {
    return {
      config: null,
      rawConfig: null,
      error: `Failed to parse JSON: ${e.message}`,
      detectedType: null
    };
  }

  // Normalize the config structure (handles nested data, chart wrapper, etc.)
  const chart = normalizeConfigStructure(raw);
  
  // Validate the configuration
  const validation = validateChartConfig(chart);
  if (!validation.valid) {
    console.log('  ✗ Validation errors:');
    validation.errors.forEach(err => console.log(`    - ${err}`));
    return {
      config: chart,
      rawConfig: chart,
      error: validation.errors.join('; '),
      detectedType: chart && chart.type ? String(chart.type).toLowerCase() : null,
      validationErrors: validation.errors
    };
  }
  
  // Log loaded config summary
  if (chart) {
    console.log(`  ● Chart type: ${chart.type}`);
    console.log(`  ● Labels count: ${Array.isArray(chart.labels) ? chart.labels.length : 0}`);
    console.log(`  ● Datasets count: ${Array.isArray(chart.datasets) ? chart.datasets.length : 0}`);
    
    if (chart.datasets && chart.datasets.length > 0) {
      chart.datasets.forEach((ds, i) => {
        const dataLen = Array.isArray(ds.data) ? ds.data.length : 0;
        console.log(`    - Dataset ${i + 1}: "${ds.label || 'unnamed'}" with ${dataLen} data points`);
        // Log data range for debugging
        if (dataLen > 0) {
          const numericData = ds.data.filter(d => typeof d === 'number');
          if (numericData.length > 0) {
            const min = Math.min(...numericData);
            const max = Math.max(...numericData);
            console.log(`      Data range: ${min} to ${max}`);
          }
        }
      });
    } else if (Array.isArray(chart.data) && chart.data.length > 0) {
      console.log(`  ● Data points: ${chart.data.length}`);
      const numericData = chart.data.filter(d => typeof d === 'number');
      if (numericData.length > 0) {
        const min = Math.min(...numericData);
        const max = Math.max(...numericData);
        console.log(`    Data range: ${min} to ${max}`);
      }
    }
    
    if (chart.tasks && chart.tasks.length > 0) {
      console.log(`  ● Gantt tasks: ${chart.tasks.length}`);
    }
  }
  
  return {
    config: chart || null,
    rawConfig: chart || null,
    error: null,
    detectedType: chart && chart.type ? String(chart.type).toLowerCase() : null
  };
}

async function renderHTMLInline(configName, templateData) {
  const raw = await ejs.renderFile(TEMPLATE_PATH, Object.assign({ configName }, templateData));
  const chartJs = fs.existsSync(CHARTJS_PATH) ? fs.readFileSync(CHARTJS_PATH, 'utf-8') : '';

  let replacement = `<script>${chartJs}</script>`;
  const pluginsDir = path.join(__dirname, 'public', 'js', 'plugins');
  if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js')).sort().forEach(fname => {
      try {
        const src = fs.readFileSync(path.join(pluginsDir, fname), 'utf-8');
        replacement += `\n<script>/* Plugin: ${fname} */\n${src}\n</script>`;
      } catch (e) { /* ignore */ }
    });
  }

  return raw.replace(/<script\s+src=["']\/js\/chart\.umd\.min\.js["']\s*><\/script>/, replacement);
}

function resolveChartType(templateData, configName) {
  if (templateData.detectedType) return templateData.detectedType.toLowerCase();
  if (templateData.config && templateData.config.type) return String(templateData.config.type).toLowerCase();
  return configName.toLowerCase();
}

function ensureChartFolder(chartType) {
  const folder = path.join(RUNTIME_DIR, chartType);
  ensureFolder(folder);
  return folder;
}

async function generate(configName, sharedBrowser = null) {
  configName = path.basename(configName);
  const templateData = loadConfig(configName);
  console.log('  • (generate) templateData keys:', Object.keys(templateData).join(','), 'config-is-null:', templateData.config==null);
  const chartType = resolveChartType(templateData, configName);
  const folder = ensureChartFolder(chartType);

  const html = await renderHTMLInline(configName, templateData);
  const previewPath = path.join(folder, `${configName}_preview.html`);
  fs.writeFileSync(previewPath, html, 'utf-8');

  const pdfPath = getVersionedPath(folder, `${configName}_chart`, '.pdf', OVERWRITE_MODE);

  const browserArgs = process.env.NO_SANDBOX === 'true' || process.env.DOCKER === 'true' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
  const browser = sharedBrowser || await puppeteer.launch({ headless: true, args: browserArgs });
  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      try { console.log('PAGE_LOG:', msg.text()); } catch (e) {}
    });
    await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Force-inject the config into the page and call renderChart() from Node
    try {
      if (templateData.config) {
        // Try renderChart first, then fallback to direct Chart construction
        const res = await page.evaluate((cfg) => {
          try {
            window.__injected_cfg = cfg;
            // special-case: draw a simple Gantt directly onto the canvas
            if (cfg && cfg.type === 'gantt') {
              try {
                var cvs = document.getElementById('chartSingle');
                var ctx = cvs.getContext('2d');
                // clear
                ctx.clearRect(0,0,cvs.width,cvs.height);
                var tasks = cfg.tasks || cfg.data || [];
                var parsed = tasks.map(function(t){
                  var s = new Date(t.start || t.from || (Array.isArray(t) ? t[0] : null));
                  var e = new Date(t.end   || t.to   || (Array.isArray(t) ? t[1] : null));
                  return { task: t.task || t.name || (t[0]||''), start: s.getTime(), end: e.getTime() };
                }).filter(function(p){ return p && isFinite(p.start) && isFinite(p.end); });
                if (parsed.length === 0) return { ok: false, err: 'no tasks' };
                var min = Math.min.apply(null, parsed.map(p=>p.start));
                var max = Math.max.apply(null, parsed.map(p=>p.end));
                if (min === max) { max = min + 24*3600*1000; }
                var padL = 120, padR = 30, padT = 24, padB = 40;
                var areaW = Math.max(10, cvs.width - padL - padR);
                var areaH = Math.max(10, cvs.height - padT - padB);
                var rowH = Math.max(22, Math.floor(areaH / parsed.length));
                ctx.font = '12px sans-serif';
                ctx.textBaseline = 'top';

                // draw y labels and bars
                parsed.forEach(function(p, i){
                  var y = padT + i * rowH + 2;
                  // label (task)
                  ctx.fillStyle = '#111';
                  ctx.textAlign = 'left';
                  ctx.fillText(p.task, 8, y);
                  // compute x positions
                  var x1 = padL + Math.round((p.start - min) / (max - min) * areaW);
                  var x2 = padL + Math.round((p.end   - min) / (max - min) * areaW);
                  var w = Math.max(6, x2 - x1);
                  ctx.fillStyle = '#4f46e5';
                  ctx.fillRect(x1, y + 2, w, rowH - 8);
                  // subtle border
                  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
                  ctx.strokeRect(x1, y + 2, w, rowH - 8);
                });

                // x-axis line
                var axisY = padT + parsed.length * rowH + 2;
                ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, axisY); ctx.lineTo(cvs.width - padR, axisY); ctx.stroke();

                // x-axis ticks and labels
                var tickCount = 5;
                ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '11px sans-serif';
                for (var i = 0; i <= tickCount; i++) {
                  var t = min + (i / tickCount) * (max - min);
                  var x = padL + Math.round((t - min) / (max - min) * areaW);
                  // tick
                  ctx.beginPath(); ctx.moveTo(x, axisY); ctx.lineTo(x, axisY + 6); ctx.stroke();
                  // label (YYYY-MM-DD)
                  var label = new Date(t).toISOString().slice(0,10);
                  ctx.fillText(label, x, axisY + 8);
                }

                // y-axis title
                ctx.save();
                ctx.translate(40, padT + areaH/2);
                ctx.rotate(-Math.PI/2);
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#222'; ctx.font = '13px sans-serif';
                ctx.fillText('Tasks', 0, 0);
                ctx.restore();

                // small margin axis labels
                ctx.fillStyle = '#333'; ctx.textAlign = 'left'; ctx.font = '13px sans-serif';
                ctx.fillText(cfg.title || '', padL, 6);

                return { ok: true, fallback: 'gantt-canvas' };
              } catch (e) { return { ok: false, err: String(e && e.message) || String(e) }; }
            }

            if (typeof renderChart === 'function') {
              try { renderChart('chartSingle', cfg); return { ok: true }; } catch (e) { return { ok: false, err: String(e && e.message) || String(e) }; }
            }

            // fallback: create Chart directly if Chart global exists
            if (typeof Chart === 'function' || (typeof Chart === 'object' && Chart && typeof Chart === 'object')) {
              try {
                var ctx = document.getElementById('chartSingle').getContext('2d');
                var datasets = [];
                if (Array.isArray(cfg.datasets) && cfg.datasets.length) {
                  datasets = cfg.datasets.map(function(ds){
                    var copy = Object.assign({}, ds);
                    if (cfg.type === 'scatter' || cfg.type === 'bubble') {
                      if (copy.showLine == null) copy.showLine = true;
                      if (copy.pointRadius == null) copy.pointRadius = 6;
                      if (copy.borderWidth == null) copy.borderWidth = 2;
                      if (copy.borderColor == null) copy.borderColor = copy.backgroundColor || copy.borderColor || 'rgba(0,0,0,1)';
                    }
                    return copy;
                  });
                } else {
                  datasets = [ { data: cfg.data || [], backgroundColor: cfg.colors || undefined, label: cfg.datasetLabel || cfg.title || 'Dataset' } ];
                  if (cfg.type === 'scatter' || cfg.type === 'bubble') { datasets[0].showLine = true; datasets[0].pointRadius = 6; datasets[0].borderWidth = 2; datasets[0].borderColor = datasets[0].backgroundColor || 'rgba(0,0,0,1)'; }
                }
                var data = { labels: cfg.labels || [], datasets: datasets };
                new Chart(ctx, { type: cfg.type || 'bar', data: data, options: cfg.options || {} });
                return { ok: true, fallback: 'direct' };
              } catch (e) { return { ok: false, err: String(e && e.message) || String(e) }; }
            }
            return { ok: false, err: 'renderChart and Chart unavailable' };
          } catch (e) { return { ok: false, err: String(e && e.message) || String(e) }; }
        }, templateData.config);
        if (!res.ok) console.log('PAGE_INJECT:', res.err || res);
      }
    } catch (e) {
      console.log('PAGE_INJECT_EXCEPTION:', e && e.message);
    }

    // Check canvas pixel sum to confirm rendering
    try {
      const sums = await page.evaluate(() => {
        function sumPixels(c) { try { const ctx = c.getContext('2d'); const d = ctx.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i++) s += d[i]; return s; } catch (e) { return null; } }
        return Array.from(document.querySelectorAll('canvas')).map(sumPixels);
      });
      console.log('  • Canvas pixel sums:', Array.isArray(sums) ? sums.join(',') : String(sums));
    } catch (e) { console.log('  • Canvas sum check failed:', e && e.message); }

    // Wait until at least one canvas has non-zero pixels or timeout
    await page.waitForFunction(() => {
      try {
        window.__chart_wait_start = window.__chart_wait_start || performance.now();
        const canvases = document.querySelectorAll('canvas');
        if (canvases.length === 0) return true;

        let nonBlank = 0;
        for (const canvas of canvases) {
          try {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (Array.prototype.some.call(imageData.data, p => p !== 0)) { nonBlank++; }
          } catch (e) {
            // If readback fails, assume it's rendered to avoid blocking
            nonBlank++;
          }
        }

        if (nonBlank >= 1) return true;
        if (performance.now() - window.__chart_wait_start > 3000) return true;
        return false;
      } catch (e) {
        return true;
      }
    }, { timeout: 15000 });

    // small buffer
    await new Promise(r => setTimeout(r, 400));

    await page.pdf({ path: pdfPath, format: 'A4', landscape: true, printBackground: true });
  } finally {
    try {
      const pages = await browser.pages();
      for (const page of pages) {
        if (page.url() !== 'about:blank') await page.close();
      }
    } catch(e){}
    if (!sharedBrowser) await browser.close();
  }
  return { previewPath, pdfPath, chartType };
}

function safeString(v) { return v == null ? '' : String(v); }

function normalizeAndLog(templateData) {
  const logs = [];
  const cfg = templateData.config || templateData.rawConfig || null;
  if (!cfg) return logs;
  const t = String(cfg.type || '').toLowerCase();

  if ((t === 'scatter' || t === 'bubble') && Array.isArray(cfg.data) && cfg.data.length > 0 && typeof cfg.data[0] === 'object' && ('x' in cfg.data[0] || 'y' in cfg.data[0])) {
    if (!Array.isArray(cfg.datasets) || cfg.datasets.length === 0) {
      cfg.datasets = cfg.datasets || [];
      cfg.datasets.push(Object.assign({}, cfg.dataset || {}, { data: cfg.data }));
      logs.push('  • Normalized scatter/bubble data into datasets');
    }
  }

  // Ensure scatter/bubble datasets have labels and sensible point sizes
  if ((t === 'scatter' || t === 'bubble') && Array.isArray(cfg.datasets) && cfg.datasets.length > 0) {
    cfg.datasets.forEach(function(ds, idx){
      if (!ds) return;
      if (ds.label == null) ds.label = cfg.datasetLabel || cfg.title || ('Dataset ' + (idx+1));
      if (ds.pointRadius == null) ds.pointRadius = 6;
      if (ds.pointHoverRadius == null) ds.pointHoverRadius = 8;
      // coerce numeric x,y values if present
      if (Array.isArray(ds.data)) {
        ds.data = ds.data.map(function(pt){
          if (pt && typeof pt === 'object') {
            var out = {};
            out.x = isFinite(Number(pt.x)) ? Number(pt.x) : (isFinite(Number(pt[0])) ? Number(pt[0]) : pt.x);
            out.y = isFinite(Number(pt.y)) ? Number(pt.y) : (isFinite(Number(pt[1])) ? Number(pt[1]) : pt.y);
            if (pt.r != null) out.r = Number(pt.r) || pt.r;
            return out;
          }
          return pt;
        });
      }
    });
    logs.push('  • Ensured scatter/bubble dataset defaults');
  }

  if ((t === 'pie' || t === 'doughnut' || t === 'polararea') && Array.isArray(cfg.data) && cfg.data.length > 0 && typeof cfg.data[0] === 'object') {
    const labels = [];
    const data = [];
    cfg.data.forEach(item => {
      if (item == null) return;
      if ('label' in item) labels.push(safeString(item.label));
      else if ('x' in item) labels.push(safeString(item.x));
      else labels.push(safeString(item));

      if ('value' in item) data.push(Number(item.value) || 0);
      else if ('y' in item && typeof item.y === 'number') data.push(item.y);
      else if ('v' in item) data.push(Number(item.v) || 0);
      else data.push(0);
    });
    if (labels.length && data.length) {
      cfg.labels = labels;
      cfg.data = data;
      logs.push('  • Normalized pie/doughnut objects into labels+data');
    }
  }

  if ((!Array.isArray(cfg.datasets) || cfg.datasets.length === 0) && Array.isArray(cfg.data) && cfg.data.length > 0 && (typeof cfg.data[0] === 'number' || typeof cfg.data[0] === 'string')) {
    const arr = cfg.data.map(v => (isFinite(Number(v)) ? Number(v) : v));
    const ds = { data: arr };
    if (['pie','doughnut','polararea'].indexOf(t) !== -1) {
      const needed = arr.length;
      let src = Array.isArray(cfg.colors) && cfg.colors.length ? cfg.colors.slice() : [];
      const defaultPalette = [
        'rgba(99,102,241,0.85)','rgba(236,72,153,0.85)','rgba(16,185,129,0.85)','rgba(245,158,11,0.85)',
        'rgba(59,130,246,0.85)','rgba(239,68,68,0.85)','rgba(139,92,246,0.85)','rgba(20,184,166,0.85)'
      ];
      let fillIdx = 0;
      while (src.length < needed) { src.push(defaultPalette[fillIdx % defaultPalette.length]); fillIdx++; }
      ds.backgroundColor = src.slice(0, needed);
      ds.borderColor = ds.backgroundColor.map(c => String(c).replace(/[\d.]+\)$/, '1)'));
    } else {
      const defaultColor = 'rgba(99,102,241,0.85)';
      ds.backgroundColor = (Array.isArray(cfg.colors) && cfg.colors.length) ? cfg.colors[0] : defaultColor;
      ds.borderColor = (Array.isArray(cfg.colors) && cfg.colors.length) ? String(cfg.colors[0]).replace(/[\d.]+\)$/, '1)') : String(defaultColor).replace(/[\d.]+\)$/, '1)');
    }
    cfg.datasets = [ds];
    logs.push('  • Wrapped numeric data into a single dataset');
  }

  return logs;
}

async function processConfig(name, sharedBrowser = null, collectResults = null) {
  console.log(`\n  ▶ Processing: config/${name}.json`);
  const templateData = loadConfig(name);
  const chartType = resolveChartType(templateData, name);
  console.log(`  ● Chart type:    ${chartType}`);

  const logs = normalizeAndLog(templateData);
  logs.forEach(l => console.log(l));

  const folder = ensureChartFolder(chartType);
  console.log(`  ✓ Folder exists:  node_runtime/${chartType}/`);

  const { previewPath, pdfPath } = await generate(name, sharedBrowser);
  console.log(`  • Wrote preview HTML: ${path.join('node_runtime', chartType, name + '_preview.html')}`);
  const pdfPathDisplay = path.join('node_runtime', chartType, path.basename(pdfPath));
  console.log(`\x1b[42m\x1b[30m  ✓ PDF saved:     ${pdfPathDisplay}  \x1b[0m`);

  // Collect result for summary display
  if (collectResults) {
    collectResults.push({ name, pdfPath: pdfPathDisplay });
  }
}

// Global flag for overwrite mode
let OVERWRITE_MODE = false;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node generate-pdf.js <config-name> or --all');
    console.log('Options:');
    console.log('  --all, -all    Generate PDFs for all config files');
    console.log('  --overwrite    Overwrite existing PDFs instead of creating versioned files');
    return;
  }
  
  // Parse flags
  OVERWRITE_MODE = args.includes('--overwrite');
  
  // Find the config name (first non-flag argument) or check for --all
  const arg = args.find(a => !a.startsWith('--'));
  const isAll = args.includes('--all') || args.includes('-all');
  
  if (!arg && !isAll) {
    console.log('Error: No config name provided');
    console.log('Usage: node generate-pdf.js <config-name> or --all [--overwrite]');
    return;
  }
  
  if (OVERWRITE_MODE) {
    console.log('  ● Overwrite mode: ON - Existing PDFs will be overwritten');
  }
  
  if (isAll) {
    console.log('\n  ╔══════════════════════════════════════════╗');
    console.log('  ║   EJS Chart → PDF Generator (Puppeteer) ║');
    console.log('  ╚══════════════════════════════════════════╝');
    const start = Date.now();
    const configs = fs.readdirSync(CONFIG_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    console.log(`\n  Found ${configs.length} config(s): ${configs.join(', ')}`);
    const browserArgs = process.env.NO_SANDBOX === 'true' || process.env.DOCKER === 'true' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
    const browser = await puppeteer.launch({ headless: true, args: browserArgs });
    const results = [];
    try {
      for (const c of configs) {
        try { await processConfig(c, browser, results); } catch (e) { console.error(`  ✗ Failed: ${c} — ${e.message}`); }
      }
    } finally {
      await browser.close();
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    // Display summary of all generated PDFs
    if (results.length > 0) {
      console.log('\n  ╔═══════════════════════════════════════╗');
      console.log('  ║         Generated PDF Summary         ║');
      console.log('  ╚═══════════════════════════════════════╝');
      results.forEach(r => {
        console.log(`  ✓ PDF saved:     ${r.pdfPath}`);
      });
    }

    console.log(`\n  Done (${elapsed}s)\n`);
    return;
  }
  await processConfig(arg);
}

main().catch(err => { console.error(err); process.exit(1); });
