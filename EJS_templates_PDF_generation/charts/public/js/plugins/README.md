Add Chart.js plugins here. Any `*.js` file placed in this directory will be inlined into the generated HTML by `generate-pdf.js`.

Example: to support matrix/heatmap charts with a Chart.js plugin, drop the plugin UMD file (for example `chartjs-chart-matrix.umd.js`) into this folder.

Notes:
- Plugins should register themselves with Chart.js (use `Chart.register(...)`) so the EJS template can use the new chart type without modifications.
- When running `node generate-pdf.js <config>`, the generator inlines every `.js` file in this folder in alphabetical order.
- If you want, I can add a sample plugin implementation for `chartjs-chart-matrix` that draws matrix/heatmap charts.
