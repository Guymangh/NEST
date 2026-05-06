const fs = require('fs');
let h = fs.readFileSync('frontend/dashboard.html', 'utf8');

// Find the stats-row div and remove it entirely
const start = h.indexOf('<div class="stats-row">');
const end = h.indexOf('</div>', h.indexOf('stat-spent')) + '</div>'.length;

if (start === -1 || end === -1) {
  console.log('NOT FOUND'); process.exit(1);
}

// Also remove the surrounding newlines/whitespace line
h = h.slice(0, start) + h.slice(end);
fs.writeFileSync('frontend/dashboard.html', h);
console.log('Removed stats-row block from', start, 'to', end);
