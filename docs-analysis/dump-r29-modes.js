var fs = require('fs');
var path = require('path');
var h = fs.readFileSync(path.join(__dirname, '../customer-app/index.html'), 'utf8');
var i = h.indexOf('data-sid="R29"');
var j = h.indexOf('</section>', i);
var chunk = h.slice(i, j);
var m = chunk.indexOf('class="modes"');
console.log(chunk.slice(m, m + 2200));
console.log('\nmodes count', (chunk.match(/class="mode/g) || []).length);
