const fs = require('fs');
let content = fs.readFileSync('charts/app.js', 'utf8');

const oldStr = `  if (chart.type === 'gantt' && !hasTasks && !hasData) {
    return 'Missing required field: "tasks" or "data" for gantt chart.';
  }
  
  if (['scatter', 'bubble'].includes(chart.type) && !hasDatasets && !hasData) {
    return 'Missing required field: "datasets" or "data" for scatter/bubble chart.';
  }

  if (chart.type !== 'gantt' && !['scatter', 'bubble'].includes(chart.type)) {
    if (!hasLabels && !hasDatasets) {
      return 'Missing required field: "labels" or "datasets".';
    }
    if (!hasData && !hasDatasets) {
      return 'Missing required field: "data" or "datasets".';
    }
  }`;

const newStr = `  const isGantt = chart.type === 'gantt';
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
  }`;

content = content.replace(oldStr, newStr);
fs.writeFileSync('charts/app.js', content, 'utf8');
console.log('Replaced successfully');