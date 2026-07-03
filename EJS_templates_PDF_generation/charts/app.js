'use strict';

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Express Setup
// ─────────────────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve chart.js and any other static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// Accept any chart type supplied in the JSON. We only check for the
// presence of required fields so new chart types work without code changes.
// ─────────────────────────────────────────────────────────────────────────────
function validateChart(chart) {
  if (!chart || typeof chart !== 'object') {
    return 'Invalid chart configuration: must be an object.';
  }
  if (!chart.type) {
    return 'Missing required field: "type" (e.g. "bar", "line", "pie").';
  }
  
  const hasLabels = Array.isArray(chart.labels) && chart.labels.length > 0;
  const hasData = Array.isArray(chart.data) && chart.data.length > 0;
  const hasDatasets = Array.isArray(chart.datasets) && chart.datasets.length > 0;
  const hasTasks = Array.isArray(chart.tasks) && chart.tasks.length > 0;

  const isGantt = chart.type === 'gantt';
  const isScatterOrBubble = ['scatter', 'bubble'].includes(chart.type);

  if (isGantt && !hasTasks && !hasData) {
    return 'Missing required field: "tasks" or "data" for gantt chart.';
  }
  
  if (isScatterOrBubble && !hasDatasets && !hasData) {
    return 'Missing required field: "datasets" or "data" for scatter/bubble chart.';
  }

  if (!isGantt && !isScatterOrBubble) {
    if (!hasLabels && !hasDatasets) {
      return 'Missing required field: "labels" or "datasets".';
    }
    if (!hasData && !hasDatasets) {
      return 'Missing required field: "data" or "datasets".';
    }
  }

  return null; // valid
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: render the single chart.ejs template with a config object
// ─────────────────────────────────────────────────────────────────────────────
function renderChart(res, chartConfig) {
  const error = validateChart(chartConfig);

  // Always render the same chart.ejs — only the data changes
  res.render('chart', {
    config: error ? null : chartConfig,
    error:  error || null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// Each route defines a JSON config and passes it to the same chart.ejs template.
// Changing the JSON is all that is needed to produce a different chart.
// ─────────────────────────────────────────────────────────────────────────────

// GET /bar
app.get('/bar', (req, res) => {
  const chartConfig = {
    type:         'bar',
    title:        'Monthly Sales Report',
    labels:       ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasetLabel: 'Sales (₹ Thousands)',
    data:         [120, 190, 300, 250, 410, 380],
    colors:       ['rgba(99, 102, 241, 0.8)'],
    options:      {},
  };
  renderChart(res, chartConfig);
});

// GET /line
app.get('/line', (req, res) => {
  const chartConfig = {
    type:         'line',
    title:        'Website Traffic Trend',
    labels:       ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasetLabel: 'Visitors',
    data:         [540, 720, 680, 910, 860, 1100, 970],
    colors:       ['rgba(16, 185, 129, 0.8)'],
    options:      {},
  };
  renderChart(res, chartConfig);
});

// GET /pie
app.get('/pie', (req, res) => {
  const chartConfig = {
    type:         'pie',
    title:        'Market Share Distribution',
    labels:       ['Product A', 'Product B', 'Product C', 'Product D'],
    datasetLabel: 'Market Share %',
    data:         [35, 25, 20, 20],
    colors:       [
      'rgba(99, 102, 241, 0.8)',
      'rgba(236, 72, 153, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
    ],
    options: {},
  };
  renderChart(res, chartConfig);
});

// GET /doughnut
app.get('/doughnut', (req, res) => {
  const chartConfig = {
    type:         'doughnut',
    title:        'Budget Allocation',
    labels:       ['R&D', 'Marketing', 'Operations', 'HR', 'Infrastructure'],
    datasetLabel: 'Budget %',
    data:         [30, 20, 25, 10, 15],
    colors:       [
      'rgba(59, 130, 246, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(20, 184, 166, 0.8)',
      'rgba(245, 158, 11, 0.8)',
    ],
    options: {},
  };
  renderChart(res, chartConfig);
});

// GET /radar  (optional)
app.get('/radar', (req, res) => {
  const chartConfig = {
    type:         'radar',
    title:        'Team Skill Assessment',
    labels:       ['Communication', 'Technical', 'Creativity', 'Leadership', 'Problem Solving', 'Teamwork'],
    datasetLabel: 'Score',
    data:         [85, 92, 78, 88, 95, 90],
    colors:       ['rgba(236, 72, 153, 0.6)'],
    options:      {},
  };
  renderChart(res, chartConfig);
});

// GET /polararea  (optional)
app.get('/polararea', (req, res) => {
  const chartConfig = {
    type:         'polarArea',
    title:        'Revenue by Region',
    labels:       ['North', 'South', 'East', 'West', 'Central'],
    datasetLabel: 'Revenue (₹ Lakhs)',
    data:         [420, 310, 580, 290, 470],
    colors:       [
      'rgba(99, 102, 241, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(59, 130, 246, 0.8)',
    ],
    options: {},
  };
  renderChart(res, chartConfig);
});

// GET /scatter
app.get('/scatter', (req, res) => {
  const chartConfig = {
    type:         'scatter',
    title:        'Machine Learning Model Benchmark',
    datasetLabel: 'Model Performance',
    datasets:     [
      {
        label: 'Model Accuracy vs Latency',
        backgroundColor: '#36A2EB',
        data: [
          { x: 15, y: 82 },
          { x: 18, y: 85 },
          { x: 25, y: 91 },
          { x: 35, y: 94 },
          { x: 42, y: 96 },
          { x: 55, y: 97 },
          { x: 70, y: 98 }
        ]
      },
      {
        label: 'Production Models',
        backgroundColor: '#FF6384',
        data: [
          { x: 12, y: 80 },
          { x: 20, y: 86 },
          { x: 30, y: 89 },
          { x: 48, y: 95 }
        ]
      }
    ],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: 'ML Model Benchmark Analysis' }
      },
      scales: {
        x: { title: { display: true, text: 'Latency (ms)' } },
        y: { title: { display: true, text: 'Accuracy (%)' }, min: 70, max: 100 }
      }
    }
  };
  renderChart(res, chartConfig);
});

// GET /bubble
app.get('/bubble', (req, res) => {
  const chartConfig = {
    type:         'bubble',
    title:        'Global Startup Ecosystem Analysis',
    datasetLabel: 'Startup Metrics',
    datasets:     [
      {
        label: 'AI Startups',
        backgroundColor: 'rgba(54, 162, 235, 0.7)',
        borderColor: '#36A2EB',
        borderWidth: 2,
        data: [
          { x: 12, y: 85, r: 15 },
          { x: 18, y: 120, r: 22 },
          { x: 25, y: 180, r: 30 },
          { x: 32, y: 250, r: 38 },
          { x: 45, y: 320, r: 42 },
          { x: 60, y: 410, r: 50 }
        ]
      },
      {
        label: 'FinTech',
        backgroundColor: 'rgba(255, 99, 132, 0.7)',
        borderColor: '#FF6384',
        borderWidth: 2,
        data: [
          { x: 8, y: 60, r: 12 },
          { x: 15, y: 95, r: 18 },
          { x: 22, y: 145, r: 25 },
          { x: 35, y: 230, r: 32 },
          { x: 42, y: 280, r: 36 },
          { x: 55, y: 350, r: 44 }
        ]
      }
    ],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: 'Startup Funding vs Revenue vs Valuation' }
      },
      scales: {
        x: { title: { display: true, text: 'Funding (Million USD)' }, min: 0 },
        y: { title: { display: true, text: 'Annual Revenue (Million USD)' }, min: 0 }
      }
    }
  };
  renderChart(res, chartConfig);
});

// GET /gantt
app.get('/gantt', (req, res) => {
  const chartConfig = {
    type:         'gantt',
    title:        'Enterprise ERP Implementation Timeline',
    tasks:        [
      {
        name: 'Requirement Gathering',
        start: '2026-01-01',
        end: '2026-01-20',
        progress: 100
      },
      {
        name: 'Architecture Design',
        start: '2026-01-15',
        end: '2026-02-10',
        progress: 90
      },
      {
        name: 'Backend Development',
        start: '2026-02-01',
        end: '2026-04-30',
        progress: 65
      },
      {
        name: 'Frontend Development',
        start: '2026-03-01',
        end: '2026-05-15',
        progress: 55
      },
      {
        name: 'Testing',
        start: '2026-05-01',
        end: '2026-06-15',
        progress: 20
      },
      {
        name: 'Production Rollout',
        start: '2026-06-20',
        end: '2026-07-10',
        progress: 0
      }
    ],
    options: {}
  };
  renderChart(res, chartConfig);
});

// ─────────────────────────────────────────────────────────────────────────────
// 404 handler — rendered through the same chart.ejs template
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('chart', {
    config: null,
    multi:  null,
    error:  `Route "${req.originalUrl}" not found. Available routes: /bar  /line  /pie  /doughnut  /radar  /polararea  /scatter  /bubble  /gantt  /multi`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log(`  EJS Chart POC running at http://localhost:${PORT}`);
  console.log('');
  console.log('  Routes:');
  console.log(`    http://localhost:${PORT}/bar`);
  console.log(`    http://localhost:${PORT}/line`);
  console.log(`    http://localhost:${PORT}/pie`);
  console.log(`    http://localhost:${PORT}/doughnut`);
  console.log(`    http://localhost:${PORT}/radar`);
  console.log(`    http://localhost:${PORT}/polararea`);
  console.log(`    http://localhost:${PORT}/scatter`);
  console.log(`    http://localhost:${PORT}/bubble`);
  console.log(`    http://localhost:${PORT}/gantt`);
  console.log(`    http://localhost:${PORT}/multi`);
  console.log('');
});

module.exports = app;
