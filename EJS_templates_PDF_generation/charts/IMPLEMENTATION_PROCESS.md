# IMPLEMENTATION PROCESS — EJS Chart POC

> This document covers all 10 required points as specified in the POC requirements.

---

## 1. How EJS Templating Works

EJS (Embedded JavaScript) is a templating engine for Node.js.
It lets you write HTML with JavaScript placeholders that get replaced with real values at render time.

**Basic example:**
```ejs
<!-- EJS template -->
<h1><%= data.name %></h1>
```

If you pass `{ name: "Meet" }` → output HTML is:
```html
<h1>Meet</h1>
```

If you pass `{ name: "Aditya" }` → output HTML is:
```html
<h1>Aditya</h1>
```

**Same template. Different data. Different output.** This is the core concept of this POC.

EJS has two main tags used in this project:
- `<%= value %>` — outputs a value (HTML-escaped, safe)
- `<%- value %>` — outputs raw/unescaped value (used for JSON injection into `<script>`)
- `<% code %>` — runs JavaScript logic (if/else, forEach, etc.) without outputting anything

---

## 2. How JSON Data is Passed from Express to EJS

In Express, `res.render()` accepts two arguments:
1. The template name (without `.ejs`)
2. A data object — this becomes available as variables inside the template

```js
// app.js — Express route
app.get('/bar', (req, res) => {

  // Step 1: Define the JSON configuration
  const chartConfig = {
    type:         'bar',
    title:        'Monthly Sales Report',
    labels:       ['Jan', 'Feb', 'Mar', 'Apr'],
    datasetLabel: 'Sales',
    data:         [120, 190, 300, 250],
    colors:       ['rgba(99, 102, 241, 0.8)'],
    options:      {},
  };

  // Step 2: Pass it to the template
  res.render('chart', {
    config: chartConfig,  // ← available as `config` inside chart.ejs
    error:  null,
    multi:  null,
  });
});
```

Inside `chart.ejs`, `config` is now available:
```ejs
<h1><%= config.title %></h1>    <!-- outputs: Monthly Sales Report -->
```

**Key point:** Every route passes a different `config` object to the same `chart.ejs`.
The template file never changes — only the data object changes.

---

## 3. How EJS Generates HTML Dynamically

EJS processes the template on the **server side** before sending HTML to the browser.

**Template (chart.ejs):**
```ejs
<h1><%= config.title %></h1>
<canvas id="chartSingle"></canvas>
<pre><%= JSON.stringify(config, null, 2) %></pre>
```

**Express passes:** `{ config: { title: "Monthly Sales", type: "bar", data: [...] } }`

**Generated HTML sent to browser:**
```html
<h1>Monthly Sales</h1>
<canvas id="chartSingle"></canvas>
<pre>{
  "title": "Monthly Sales",
  "type": "bar",
  ...
}</pre>
```

The browser receives complete, ready-to-render HTML.
EJS has already done its job — the browser only needs to run Chart.js.

**For loops in EJS** (used in multi-chart path):
```ejs
<% multi.forEach(function(chart, index) { %>
  <canvas id="chartMulti_<%= index %>"></canvas>
<% }); %>
```
This generates a separate `<canvas>` tag for each chart in the array — automatically.

---

## 4. How Chart.js is Integrated

Chart.js is a JavaScript library that draws charts on HTML `<canvas>` elements.

**In this POC**, Chart.js is:
- Installed via npm: `npm install chart.js`
- Copied to `public/js/chart.umd.min.js`
- Served as a static file by Express: `app.use(express.static('public'))`
- Loaded in the browser via: `<script src="/js/chart.umd.min.js"></script>`

**No CDN or internet connection required.**

**Basic Chart.js usage:**
```js
new Chart(canvas, {
  type:    'bar',                          // chart type
  data:    { labels: [...], datasets: [{
    data: [...],
    backgroundColor: 'rgba(99,102,241,0.8)',
  }]},
  options: { responsive: true },
});
```

In this POC, every value (`type`, `labels`, `data`, `backgroundColor`, `options`) comes from the JSON config — not hardcoded.

---

## 5. How Chart Metadata Controls Rendering

The JSON config object controls every aspect of the chart:

| JSON field     | Controls in Chart.js                    |
|----------------|-----------------------------------------|
| `type`         | Which chart type is drawn (bar/pie/etc) |
| `title`        | The `<h1>` heading on the page          |
| `labels`       | X-axis labels or pie segment names      |
| `data`         | The numeric values plotted              |
| `datasetLabel` | The legend label                        |
| `colors`       | backgroundColor of bars/slices/line     |
| `options`      | Any Chart.js option (responsive, scale, etc.) |

**Example — colors:**
```json
"colors": ["rgba(99, 102, 241, 0.8)"]
```
→ Template reads `cfg.colors[0]` and sets `backgroundColor` in the dataset.

**Example — options:**
```json
"options": { "indexAxis": "y" }
```
→ Template merges this into `finalOptions` → Chart.js renders a horizontal bar chart.
→ Template was NOT changed.

---

## 6. How Changing JSON Changes the Generated Chart

This is the core POC validation.

**Example 1 — Change type only:**
```json
{ "type": "bar",  ... }   →  Bar chart rendered
{ "type": "pie",  ... }   →  Pie chart rendered
{ "type": "line", ... }   →  Line chart rendered
```
`chart.ejs` is identical in all three cases.

**Example 2 — Change data:**
```json
{ "data": [100, 200, 300] }   →  three bars
{ "data": [50, 900] }         →  two bars, very different heights
```

**Example 3 — Change colors:**
```json
{ "colors": ["rgba(99,102,241,0.8)"] }   →  purple bar
{ "colors": ["rgba(239,68,68,0.8)"] }    →  red bar
```

**Flow each time:**
```
New JSON in route → res.render('chart', { config: newJSON }) → same chart.ejs → different HTML → different chart
```

---

## 7. How a Single Template Supports Multiple Chart Types

The template uses Chart.js's own `type` field to handle all chart types:

```js
// Inside chart.ejs <script> block
new Chart(canvas, {
  type: cfg.type,    // ← This single field tells Chart.js everything
  ...
});
```

Chart.js internally knows how to draw each type. The template does not have any `if (type === 'bar')` drawing logic — Chart.js handles all of that.

The only type-specific logic in the template is colour resolution:

```js
// Multi-segment charts (pie, doughnut, polarArea) need one colour per data point
var isMultiSegment = ['pie', 'doughnut', 'polarArea'].indexOf(cfg.type) !== -1;

var bgColors = isMultiSegment
  ? cfg.colors                 // array of colours — one per slice
  : cfg.colors[0];             // single colour for the whole bar/line
```

That's the only place `type` is checked. Everything else is generic.

**Multi-chart path:**
```ejs
<% multi.forEach(function(chart, index) { %>
  <canvas id="chartMulti_<%= index %>"></canvas>
<% }); %>
```
```js
chartsData.forEach(function(cfg, index) {
  renderChart('chartMulti_' + index, cfg);  // same function, different data
});
```

The template iterates the array and calls `renderChart()` for each item.
Each item can be a completely different chart type.

---

## 8. Steps Followed During the POC

```
Step 1 — Understood the requirement
         One EJS file. JSON drives the chart. Template never changes.

Step 2 — Set up the project
         mkdir chart_poc
         npm init -y
         npm install express ejs chart.js

Step 3 — Copied Chart.js to public/js/
         cp node_modules/chart.js/dist/chart.umd.min.js public/js/
         (no CDN dependency)

Step 4 — Wrote app.js
         Set up Express with EJS as view engine.
         Served public/ as static.
         Wrote one route per chart type.
         Each route defines a JSON config and calls res.render('chart', { config }).
         Added validateChart() for error handling.
         Added /multi route with charts array.

Step 5 — Wrote chart.ejs (single template)
         Three states: config (single chart), multi (array), error.
         For single: renders <h1>, <canvas>, <pre> with JSON.
         For multi: forEach loop creates a canvas per chart.
         Shared renderChart() JS function reads all values from cfg.
         Used DOMContentLoaded to ensure canvas exists before Chart.js runs.
         Used <%- JSON.stringify(config) %> to inject server-side JSON into client script.

Step 6 — Tested all routes
         /bar /line /pie /doughnut /radar /polararea /multi
         Verified chart renders correctly in browser.
         Verified template was NOT modified between tests.

Step 7 — Tested error handling
         Removed required fields from config → error message shown.
         Page did not crash.

Step 8 — Wrote documentation
         README.md — setup and usage
         CAPABILITY_REPORT.md — test results
         IMPLEMENTATION_PROCESS.md — this file
```

---

## 9. Findings and Learnings

| Finding | Detail |
|---------|--------|
| EJS + JSON = powerful combination | Passing a JSON object to res.render() gives the template full access to all config properties |
| Chart.js `type` field does the heavy lifting | The template doesn't need to know how to draw each chart type — Chart.js handles it internally |
| `maintainAspectRatio: false` is required | Without this, Chart.js tries to control its own height and may render at 0px inside a flex/relative container |
| Canvas needs explicit height | Setting `height: 420px` on a wrapper `<div>` with `position: relative` ensures the canvas always has a defined size |
| CDN is unreliable for POC | Serving chart.umd.min.js locally from `public/js/` is more reliable than a CDN in all environments |
| `<%- %>` vs `<%= %>` matters | `<%= JSON.stringify(config) %>` would HTML-escape the JSON and break the JS. `<%- JSON.stringify(config) %>` outputs raw JSON — correct for injecting into `<script>` |
| DOMContentLoaded is essential | Without it, `document.getElementById(canvasId)` may return null because the canvas isn't in the DOM yet when the script runs |

---

## 10. How This Approach Can Be Integrated Into the Product

The POC proves the template approach works. Here is how to move it into the actual product:

### Step 1 — Replace hardcoded JSON with database data

In `app.js`, instead of:
```js
const chartConfig = { type: 'bar', data: [120, 190, 300] };
```

Do:
```js
const row = await db.query('SELECT * FROM chart_configs WHERE id = ?', [id]);
const chartConfig = JSON.parse(row.config_json);
res.render('chart', { config: chartConfig, error: null, multi: null });
```

**`chart.ejs` does not change.**

### Step 2 — Accept dynamic JSON via POST endpoint

```js
app.post('/render', (req, res) => {
  const chartConfig = req.body.chart;  // JSON from API request
  renderChart(res, chartConfig);       // same render helper
});
```

### Step 3 — Use the template in product pages

The `chart.ejs` template can be included as a partial in a larger product page:

```ejs
<%- include('chart', { config: reportConfig, error: null, multi: null }) %>
```

### Step 4 — Server-side image generation (future)

Use `chartjs-node-canvas` to render the same config to a PNG image (for email reports, PDFs):
```js
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const canvas = new ChartJSNodeCanvas({ width: 800, height: 400 });
const image  = await canvas.renderToBuffer({ type: cfg.type, data: { ... } });
```

### Summary of product integration flow

```
Product Database
    ↓ (query chart config as JSON)
Express Route
    ↓ (res.render with config object)
chart.ejs (unchanged from POC)
    ↓ (EJS injects JSON into HTML)
Browser
    ↓ (Chart.js reads JSON, draws chart)
Chart visible to end user
```

The only thing that changes between the POC and production is **where the JSON comes from**.
The template, the rendering logic, and Chart.js integration remain exactly the same.
