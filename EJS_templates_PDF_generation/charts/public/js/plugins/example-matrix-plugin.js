// Example plugin placeholder for matrix/heatmap style charts.
// This file is a minimal example showing how to register a plugin.
// Replace with a full plugin (e.g. chartjs-chart-matrix UMD build) for production.

(function(){
  if (typeof Chart === 'undefined') {
    console && console.warn && console.warn('Chart.js not found — plugin not registered');
    return;
  }

  // Simple plugin that registers and logs when charts are created.
  var ExampleMatrixPlugin = {
    id: 'exampleMatrixPlugin',
    beforeInit: function(chart, args, options) {
      // No-op: placeholder for plugin initialization
      // Real plugins should register controllers/elements here.
    }
  };

  Chart.register(ExampleMatrixPlugin);
  console && console.log && console.log('Plugin loaded: exampleMatrixPlugin');
})();
