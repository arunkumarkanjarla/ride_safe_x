// Smoke: platform vehicle union + rates for new cab variants
var path = require('path');
var root = path.join(__dirname, '..');
// minimal browser stubs
global.window = global;
global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); } };
global.addEventListener = function () {};
global.setInterval = function () { return 0; };
global.BroadcastChannel = function () { this.onmessage = null; this.postMessage = function () {}; };
global.location = { pathname: '/ride_safe_x/customer-app/index.html' };
global.document = { readyState: 'complete', addEventListener: function () {}, documentElement: { classList: { toggle: function () {} } } };
require(path.join(root, 'shared/platform-config.js'));
// simulate old stored config with only 4 vehicles
localStorage.setItem('ridenova.platform.v1', JSON.stringify({
  schema: 1, version: 1,
  vehicles: [
    { id: 'Bike', label: 'Bike', on: true, order: 1 },
    { id: 'Auto', label: 'Auto', on: true, order: 2 },
    { id: 'Cab', label: 'Cab', on: true, order: 3 },
    { id: 'Premium', label: 'Premium', on: true, order: 4 }
  ],
  pricing: { cities: { HYD: { Bike: { base: 20, perKm: 6.5, perMin: 0.8 }, Cab: { base: 50, perKm: 14.5, perMin: 1.5 } } } }
}));
require(path.join(root, 'shared/platform.js'));
var ids = RNPC.vehicles().map(function (v) { return v.id; });
console.log('vehicles', ids.join(', '));
['Cab', 'CabNonAC', 'CabSUV', 'CabMUV', 'Premium'].forEach(function (id) {
  var r = RNPC.rate(id);
  console.log(id, r ? ('base=' + r.base + ' /km=' + r.perKm) : 'MISSING RATE');
});
if (ids.indexOf('CabNonAC') < 0 || ids.indexOf('CabSUV') < 0) {
  console.error('FAIL: new vehicles not merged');
  process.exit(1);
}
console.log('OK');
