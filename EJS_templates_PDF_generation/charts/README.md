# EJS Chart POC — Single Reusable Template

## Project Overview

This is a Proof of Concept (POC) that validates whether a **single EJS template** (`chart.ejs`)
can dynamically render different chart types using only JSON configuration passed from Express routes.

```
JSON Configuration → Express Route → chart.ejs → Chart.js → Rendered Chart
```

---

## Objective

Prove that:
- One EJS template renders any chart type (bar, line, pie, doughnut, radar, polar area, scatter, bubble, gantt)
- Chart rendering is entirely driven by JSON — no template modification needed
- The process is documented and ready for product integration

---

## Setup Instructions

### Prerequisites
- Node.js v18 or higher
- npm v9 or higher

### Installation

```bash
# 1. Extract the ZIP
# 2. Open terminal and navigate to the project folder
cd chart_poc

# 3. Install dependencies
npm install

# 4. Start the server
npm start
```

### Run

```bash
npm start
```

Server starts at: `http://localhost:3000`

---

## Project Structure

```
chart_poc/
├── app.js                  ← Express server + all routes + validation
├── package.json            ← Dependencies (express, ejs, chart.js)
├── README.md
├── CAPABILITY_REPORT.md
├── IMPLEMENTATION_PROCESS.md
├── views/
│   └── chart.ejs           ← THE single reusable EJS template (only one)
├── config/                 ← Sample JSON configurations for reference
│   ├── bar.json
│   ├── line.json
│   ├── pie.json
│   ├── doughnut.json
│   ├── radar.json
│   ├── polararea.json
│   └── multi.json
└── public/
    └── js/
        └── chart.umd.min.js  ← Chart.js served locally (no CDN needed)
```

---

## Routes

| URL                          | Chart Type  | Description                          |
|------------------------------|-------------|--------------------------------------|
| `http://localhost:3000/bar`       | Bar         | Monthly Sales Report                 |
| `http://localhost:3000/line`      | Line        | Website Traffic Trend                |
| `http://localhost:3000/pie`       | Pie         | Market Share Distribution            |
| `http://localhost:3000/doughnut`  | Doughnut    | Budget Allocation                    |
| `http://localhost:3000/radar`     | Radar       | Team Skill Assessment                |
| `http://localhost:3000/polararea` | Polar Area  | Revenue by Region                    |
| `http://localhost:3000/scatter`   | Scatter     | ML Model Benchmark (XY points)       |
| `http://localhost:3000/bubble`    | Bubble      | Startup Ecosystem (XY with radius)   |
| `http://localhost:3000/gantt`     | Gantt       | Project Timeline (custom renderer)   |
| `http://localhost:3000/multi`     | All types   | Multi-chart validation               |

---

## JSON Configuration Format

### Single Chart

```json
{
  "chart": {
    "type":         "bar",
    "title":        "Monthly Sales Report",
    "labels":       ["Jan", "Feb", "Mar", "Apr"],
    "datasetLabel": "Sales",
    "data":         [120, 190, 300, 250],
    "colors":       ["rgba(99, 102, 241, 0.8)"],
    "options":      {}
  }
}
```

### Configurable Properties

| Property       | Type   | Required | Description                                        |
|----------------|--------|----------|----------------------------------------------------|
| `type`         | string | Yes      | Chart type: bar, line, pie, doughnut, radar, polarArea |
| `title`        | string | Yes      | Chart heading shown on the page                    |
| `labels`       | array  | Yes      | X-axis labels or segment names                     |
| `datasetLabel` | string | Yes      | Legend label for the dataset                       |
| `data`         | array  | Yes      | Numeric data values                                |
| `colors`       | array  | No       | RGBA colour strings (auto-generated if omitted)    |
| `options`      | object | No       | Chart.js options merged over defaults              |

### Multiple Charts

```json
{
  "charts": [
    { "type": "bar",  "title": "Sales",   "labels": [...], "data": [...], "colors": [...], "options": {} },
    { "type": "line", "title": "Traffic", "labels": [...], "data": [...], "colors": [...], "options": {} }
  ]
}
```

---

## Supported Chart Types

| Type       | Chart.js key | Notes                                        |
|------------|--------------|----------------------------------------------|
| Bar        | `bar`        | Vertical bars, multiple datasets supported   |
| Line       | `line`       | Smooth line with area fill, multiple datasets|
| Pie        | `pie`        | Full circle, per-segment colours             |
| Doughnut   | `doughnut`   | Hollow-centre pie variant                    |
| Radar      | `radar`      | Spider-web / radial axes, multiple datasets  |
| Polar Area | `polarArea`  | Equal-angle segments, varied radius          |
| Scatter    | `scatter`    | XY scatter plots, multiple datasets          |
| Bubble     | `bubble`     | XY scatter with radius, multiple datasets    |
| Gantt      | `gantt`      | Timeline chart (custom canvas renderer)      |

### Notes on Gantt Charts

Gantt charts are not a native Chart.js chart type. The project includes a custom canvas-based
renderer in `generate-pdf.js` that draws Gantt charts directly on the canvas. This approach
works reliably for PDF generation. For browser preview, the Gantt chart will display using
the fallback renderer when the page is loaded through Puppeteer.

---

## Example: Switching Chart Type

Change **only** the `"type"` field in JSON:

```json
{ "type": "bar" }   → renders a Bar Chart
{ "type": "pie" }   → renders a Pie Chart
{ "type": "line" }  → renders a Line Chart
```

`chart.ejs` is NOT modified. The template auto-adapts.
