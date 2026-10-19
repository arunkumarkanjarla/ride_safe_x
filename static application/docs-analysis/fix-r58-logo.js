var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, '../customer-app/index.html');
var h = fs.readFileSync(file, 'utf8');
var bad = '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>';
var good = '<path d="M3 11l18-8-8 18-2.5-7.5L3 11z"/>';
var i = h.indexOf('data-sid="R58"');
var j = h.indexOf('</section>', i);
if (i < 0) throw new Error('R58 missing');
var chunk = h.slice(i, j);
if (chunk.indexOf(bad) < 0) {
  console.log('logo already ok or different');
} else {
  chunk = chunk.replace(bad, good);
  h = h.slice(0, i) + chunk + h.slice(j);
  fs.writeFileSync(file, h);
  console.log('fixed R58 paper-plane logo');
}
