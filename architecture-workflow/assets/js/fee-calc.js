/* Earnings and daily-fee calculator (architecture page 26).
   Same arithmetic and rounding as source/fees.py; numbers come from js/generated/fee-config.js.
   Builds rows with DOM APIs only (no HTML strings). */
(function () {
  'use strict';
  var C = window.RN_FEES, COLR = window.RN_FEE_COLORS;
  var root = document.getElementById('feecalc');
  if (!root || !C) return;

  function r(x) { return Math.floor(x + 0.5); }
  function rs(p) { var a = Math.abs(p); return (p < 0 ? '−' : '') + '₹' + Math.floor(a / 100).toLocaleString('en-IN') + '.' + String(a % 100).padStart(2, '0'); }
  function el(id) { return document.getElementById(id); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function row(label, value, cls, note) {
    var tr = document.createElement('tr'); if (cls) tr.className = cls;
    var a = document.createElement('td'); a.textContent = label;
    if (note) { a.appendChild(document.createElement('br')); var s = document.createElement('span'); s.className = 'calc-sub'; s.textContent = note; a.appendChild(s); }
    var b = document.createElement('td'); b.className = 'r'; b.textContent = value;
    tr.appendChild(a); tr.appendChild(b); return tr;
  }
  function fill(id, rows) { var t = el(id); clear(t); rows.forEach(function (x) { t.appendChild(x); }); }
  function bar(id, parts) {
    var box = el(id); clear(box);
    var tot = parts.reduce(function (s, p) { return s + Math.max(p[1], 0); }, 0) || 1;
    parts.filter(function (p) { return p[1] > 0; }).forEach(function (p) {
      var w = p[1] * 100 / tot, i = document.createElement('i');
      i.style.width = w.toFixed(2) + '%';            // CSSOM, allowed by the CSP
      i.style.background = COLR[p[0]] || '#8A99A6';
      i.textContent = w > 9 ? rs(p[1]) : '';
      box.appendChild(i);
    });
  }
  function msg(cls, text) { var c = el('fc-check'); clear(c); var s = document.createElement('span'); s.className = cls; s.textContent = text; c.appendChild(s); }

  function run() {
    var amt = parseFloat(el('fc-amt').value), n = parseInt(el('fc-n').value, 10), z = C.zones[el('fc-zone').value], py = C.pay[el('fc-pay').value];
    var amtInput = el('fc-amt'), nInput = el('fc-n');
    amtInput.setAttribute('aria-invalid', String(!(amt > 0)));
    nInput.setAttribute('aria-invalid', String(!(n >= 0)));
    if (!(amt > 0) || !(n >= 0)) {
      ['fc-ride', 'fc-day', 'fc-fee', 'fc-rbar', 'fc-fbar'].forEach(function (i) { clear(el(i)); });
      msg('bad', 'Enter a fare above zero and rides of 0 or more'); return;
    }
    var t = r(amt * 100), th = Math.min(r(z.thru * 100), t), tx = t - th, fare = r(tx * 100 / (100 + C.gst)), gst = tx - fare, gw = r(t * py.pct / 100), com = r(fare * C.cmp / 100);
    var rows = [row('Rider pays', rs(t), 'tot')];
    if (th) rows.push(row(z.thru_label, rs(th)));
    rows.push(row('GST ' + C.gst + '% (to government)', rs(gst)), row('Driver gets (100% of fare)', rs(fare), 'tot'), row('Platform takes', '₹0.00'));
    fill('fc-ride', rows); bar('fc-rbar', [['driver', fare], ['gst', gst], ['thru', th]]);

    var earned = n * fare, full = r(z.fee * 100), fee = n <= 0 ? 0 : Math.min(full, r(earned * C.cap / 100)), net = r(fee * 100 / (100 + C.gst_fee)), fgst = fee - net;
    var costs = C.costs.map(function (c) { return [c.key, c.label, c.desc, n > 0 ? r(c.rs * 100) : 0]; });
    costs.splice(1, 0, ['gateway', 'Payment gateway (merchant fee)', py.name + ': ' + py.pct + '% on ' + n + ' rides', n * gw]);
    var used = costs.reduce(function (s, c) { return s + c[3]; }, 0), profit = net - used, commission = n * com, kept = earned - fee;
    var fl = n <= 0 ? 'No rides today, so no fee' : (fee < full ? 'Daily fee (capped at ' + C.cap + '% of fares)' : 'Daily fee (₹' + z.fee + ' flat, ' + z.name + ')');
    fill('fc-day', [row('Driver earned (' + n + ' × ' + rs(fare) + ')', rs(earned)), row(fl, rs(-fee)), row('Driver keeps', rs(kept), 'tot'),
      row('A ' + C.cmp + '% commission would take', rs(-commission)), row('Driver saves today', rs(commission - fee), 'tot')]);
    var feeRows = [row('GST ' + C.gst_fee + '% included in the fee', rs(fgst), 'sub')];
    costs.forEach(function (c) { feeRows.push(row(c[1], rs(c[3]), 'sub', c[2])); });
    feeRows.push(row(profit < 0 ? 'Platform loss (absorbed by platform)' : 'Platform profit', rs(profit), 'sub'));
    fill('fc-fee', feeRows);
    bar('fc-fbar', [['fgst', fgst]].concat(costs.map(function (c) { return [c[0], c[3]]; })).concat([['profit', Math.max(profit, 0)]]));
    var ok = (fare + gst + th === t) && (kept + fee === earned) && (net + fgst === fee) && (used + profit === net);
    if (ok) msg('ok', '✓ Each ride: ' + rs(fare) + ' + ' + rs(gst) + (th ? ' + ' + rs(th) : '') + ' = ' + rs(t) + '. The driver keeps 100% of every fare; the only charge is one daily fee.');
    else msg('bad', 'Lines do not add up');
  }
  ['fc-amt', 'fc-n', 'fc-zone', 'fc-pay'].forEach(function (id) { el(id).addEventListener('input', run); });
  run();
})();
