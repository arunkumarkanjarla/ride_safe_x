var fs = require('fs');
var h = fs.readFileSync(__dirname + '/../customer-app/index.html', 'utf8');
var re = /script src="([^"]+)"/g, m;
while ((m = re.exec(h))) console.log(m[1]);
