/* RideNova Admin portal – Rides (A04): every ride with filters, and a detail view of each ride with its rider, driver,
   vehicle, route, fare, payment, timeline and notes. Actions follow the ride's state and the mock role's permissions
   (checked and written to the audit log by the engine): call or message, reassign driver, cancel, refund, retry
   payment, open incident, flag for fraud review, add note, download receipt. The live demo ride of the in-memory
   engine (booked in this tab) is shown at the top with its own actions. Synthetic data only. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, OD = RN.opsData, U = RN.opsUI, OPS = RN.ops, K = RN.kit, D = RN.data;
  var h = U.h, btn = U.btn, st = U.st, card = U.card;
  var GROUPS = {
    all: ['All', function () { return true; }],
    active: ['Active', function (r) { return ['DRIVER_ASSIGNED', 'ARRIVED', 'IN_PROGRESS'].indexOf(r.state) >= 0; }],
    waiting: ['Waiting', function (r) { return ['SEARCHING', 'OFFER'].indexOf(r.state) >= 0; }],
    completed: ['Completed', function (r) { return r.state === 'COMPLETED'; }],
    cancelled: ['Cancelled', function (r) { return r.state === 'CANCELLED'; }],
    nodriver: ['No driver', function (r) { return r.state === 'NO_DRIVER'; }],
    flagged: ['Flagged', function (r) { return r.flags.length > 0 || r.payment.state === 'FAILED'; }]
  };
  var STATE = { SEARCHING: ['Searching', 'warn'], OFFER: ['Offer pending', 'warn'], DRIVER_ASSIGNED: ['Driver assigned', 'info'], ARRIVED: ['Driver arrived', 'info'],
    IN_PROGRESS: ['On trip', 'info'], COMPLETED: ['Completed', 'ok'], CANCELLED: ['Cancelled', ''], NO_DRIVER: ['No driver found', 'err'] };
  var PAY = { PENDING: ['Pending', 'warn'], AUTHORISED: ['Authorised', 'info'], CAPTURED: ['Paid', 'ok'], COLLECTED: ['Cash collected', 'ok'], FAILED: ['Failed', 'err'],
    VOID: ['Not charged', ''], REFUNDED: ['Refunded', ''], PARTLY_REFUNDED: ['Partly refunded', 'warn'] };
  var M = { group: 'all', q: '', service: '', pay: '', time: '', sel: null, table: { sort: 'time', dir: -1, page: 0 } };
  var FINAL = ['COMPLETED', 'CANCELLED', 'NO_DRIVER'];

  function money(r, v) { return OD.money(v, r.currency); }
  function vOf(r) { return r.vehicleId ? OD.vehicle(r.vehicleId) : null; }
  function add(r, text, kind) { r.timeline.push({ at: Date.now(), text: text, kind: kind || '', by: U.me() }); }
  function refunded(r) { return r.refunds.reduce(function (t, x) { return t + x.amount; }, 0); }

  function filtered() {
    var now = Date.now();
    return OD.rides.filter(function (r) {
      if (!OD.inGeo(r.city, OPS.geo) || !GROUPS[M.group][1](r)) return false;
      if (M.service && r.service !== M.service) return false;
      if (M.pay && r.payment.state !== M.pay) return false;
      if (M.time === 'hour' && now - r.requestedAt > 3600000) return false;
      if (M.time === 'today' && new Date(r.requestedAt).toDateString() !== new Date().toDateString()) return false;
      if (M.q) { var v = vOf(r), hay = (r.id + ' ' + r.rider.name + ' ' + r.pickup.name + ' ' + r.drop.name + ' ' + (v ? v.driver.name + ' ' + v.plate : '')).toLowerCase(); if (hay.indexOf(M.q) < 0) return false; }
      return true;
    });
  }

  // ---------------------------------------------------------------- list
  function render() {
    if (OPS.nav.ride) { M.sel = OPS.nav.ride; delete OPS.nav.ride; }
    if (OPS.nav.rideStatus) { M.group = OPS.nav.rideStatus; M.sel = null; M.table.page = 0; delete OPS.nav.rideStatus; }
    var root = U.mount('ops-a04'); if (!root) return;
    UI.q('#mock .dc').setAttribute('data-live', liveSig());
    var hd = UI.q('#mock .dtop .ttl'); if (hd) hd.textContent = 'Rides';
    var live = liveCard(); if (live) root.appendChild(live);
    if (M.sel && OD.ride(M.sel)) { detail(root, OD.ride(M.sel)); return; }
    M.sel = null;
    var inGeo = OD.rides.filter(function (r) { return OD.inGeo(r.city, OPS.geo); });
    var services = []; OD.rides.forEach(function (r) { if (services.indexOf(r.service) < 0) services.push(r.service); });
    root.appendChild(h('div', { class: 'ops-bar' }, [U.geoBar(function () { M.table.page = 0; render(); }), h('span', { class: 'sp' }),
      U.search('Search ride, rider, driver, plate or place', M.q, function (q) { M.q = q; M.table.page = 0; draw(); })]));
    root.appendChild(h('div', { class: 'ops-bar' }, [
      U.chips('Ride status', Object.keys(GROUPS).map(function (k) { return [k, GROUPS[k][0], U.fmtN(inGeo.filter(GROUPS[k][1]).length)]; }), M.group, function (g) { M.group = g; M.table.page = 0; render(); }),
      h('span', { class: 'sp' }),
      U.select('Service', [['', 'Service: all']].concat(services.map(function (s) { return [s, s]; })), M.service, function (v) { M.service = v; M.table.page = 0; draw(); }),
      U.select('Payment', [['', 'Payment: all']].concat(Object.keys(PAY).map(function (k) { return [k, PAY[k][0]]; })), M.pay, function (v) { M.pay = v; M.table.page = 0; draw(); }),
      U.select('Time', [['', 'Any time'], ['hour', 'Last hour'], ['today', 'Today']], M.time, function (v) { M.time = v; M.table.page = 0; draw(); }),
      btn('Export CSV', exportCsv, 'g')]));
    var holder = h('div', { class: 'ops-fill' }); root.appendChild(holder);
    function draw() {
      UI.clear(holder);
      holder.appendChild(U.table({
        rows: filtered(), pageSize: 20, state: M.table, empty: 'No rides match these filters.',
        columns: [
          { key: 'id', label: 'Ride', get: function (r) { return h('b', { text: r.id }); }, sort: function (r) { return r.id; } },
          { key: 'time', label: 'Requested', get: function (r) { return U.clock(r.requestedAt); }, sort: function (r) { return r.requestedAt; } },
          { key: 'city', label: 'City', get: function (r) { return OD.CITIES[r.city].name; }, sort: function (r) { return OD.CITIES[r.city].name; } },
          { key: 'service', label: 'Service', get: function (r) { return r.service; }, sort: function (r) { return r.service; } },
          { key: 'rider', label: 'Rider', get: function (r) { return r.rider.name; }, sort: function (r) { return r.rider.name; } },
          { key: 'driver', label: 'Driver', get: function (r) { var v = vOf(r); return v ? v.driver.name : '—'; }, sort: function (r) { var v = vOf(r); return v ? v.driver.name : ''; } },
          { key: 'route', label: 'Pickup → drop', cls: 'w', get: function (r) { return r.pickup.name.split(',')[0] + ' → ' + r.drop.name.split(',')[0]; } },
          { key: 'fare', label: 'Fare', cls: 'num', get: function (r) { return money(r, r.fare.total); }, sort: function (r) { return r.fare.total; } },
          { key: 'pay', label: 'Payment', get: function (r) { return st(PAY[r.payment.state][0], PAY[r.payment.state][1]); }, sort: function (r) { return r.payment.state; } },
          { key: 'state', label: 'Status', get: function (r) { return h('span', null, [st(STATE[r.state][0], STATE[r.state][1])].concat(r.flags.map(function (f) { return st(f, f === 'SOS' ? 'err' : 'warn'); }))); }, sort: function (r) { return r.state; } }
        ],
        onRow: function (r) { M.sel = r.id; render(); }
      }));
    }
    draw();
  }

  function exportCsv(b) {
    U.act('report.export', 'export rides', 'rides', 'report.exported', b).then(function (ok) {
      if (!ok) return;
      var rows = [['ride', 'requested', 'city', 'service', 'rider', 'driver', 'pickup', 'drop', 'km', 'fare', 'currency', 'payment', 'status']].concat(filtered().map(function (r) {
        var v = vOf(r); return [r.id, new Date(r.requestedAt).toISOString(), OD.CITIES[r.city].name, r.service, r.rider.name, v ? v.driver.name : '', r.pickup.name, r.drop.name, r.km, r.fare.total, r.currency, r.payment.state, r.state];
      }));
      download('rides-' + OD.geoLabel(OPS.geo).replace(/\W+/g, '-').toLowerCase() + '.csv', rows.map(function (r) { return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n'), 'text/csv');
      UI.toast('Exported ' + (rows.length - 1) + ' rides (synthetic data).', 'info');
    });
  }
  function download(name, text, type) {
    var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------------------------------------------------------------- detail
  function detail(root, r) {
    var v = vOf(r), city = OD.CITIES[r.city], s = STATE[r.state];
    var back = btn('‹ All rides', function () { M.sel = null; render(); }, 'g');
    var head = h('div', { class: 'ops-dhead' }, [back, h('h2', { text: 'Ride ' + r.id }), st(s[0], s[1])].concat(r.flags.map(function (f) { return st(f, f === 'SOS' ? 'err' : 'warn'); }))
      .concat([h('span', { class: 'ops-muted', text: r.service + ' · ' + city.name + ', ' + city.countryName + ' · requested ' + U.clock(r.requestedAt) + ' (' + U.since(r.requestedAt) + ' ago)' })]));
    root.appendChild(head);
    root.appendChild(actions(r, v));

    var people = card('Rider, driver and vehicle', [U.kv([
      ['Rider', h('span', null, [h('b', { text: r.rider.name }), ' ★ ' + r.rider.rating + ' · ' + r.rider.trips + ' trips · ' + r.rider.phone])],
      ['Driver', v ? h('span', null, [h('b', { text: v.driver.name }), ' ★ ' + v.driver.rating + ' · ' + v.driver.phone + ' · since ' + v.driver.joined]) : 'Not assigned'],
      ['Vehicle', v ? OD.TYPES[v.type].label + ' · ' + v.model + ' · ' + v.plate : '—'],
      ['Driver now', v ? OD.STATUS[v.status] + ' · ' + v.speed + ' km/h · ping ' + v.ping + ' s ago' : '—'],
      ['Pickup', r.pickup.name], ['Drop', r.drop.name],
      ['Distance', r.km + ' km · about ' + r.minutes + ' min'], ['Zone', r.zone + (r.surge > 1 ? ' · surge ' + r.surge + '×' : '')],
      ['Pickup ETA', r.pickupEta + ' min'], ['Rating', r.rating ? r.rating + '★ from the rider' : '—']
    ])]);
    var f = r.fare, rf = refunded(r);
    var fareRows = [['Base fare', f.base], ['Distance', f.distance], ['Time', f.time], f.surge ? ['Surge ' + r.surge + '×', f.surge] : null, ['Taxes', f.tax], f.discount ? ['Discount', -f.discount] : null].filter(Boolean);
    var fare = card('Fare and payment', [
      h('table', { class: 'dt ops-dt' }, [h('tbody', null, fareRows.map(function (x) { return h('tr', null, [h('td', { text: x[0] }), h('td', { class: 'num', text: money(r, x[1]) })]); })
        .concat([h('tr', { class: 'ops-total' }, [h('td', { text: 'Total' }), h('td', { class: 'num', text: money(r, f.total) })])])
        .concat(r.refunds.map(function (x) { return h('tr', null, [h('td', { text: 'Refund · ' + x.reason }), h('td', { class: 'num', text: '−' + money(r, x.amount) })]); })))]),
      U.kv([['Method', r.payment.method], ['Status', st(PAY[r.payment.state][0], PAY[r.payment.state][1])], rf ? ['Refunded', money(r, rf)] : null])]);
    var route = card('Route', [routeMap(r, v)]);
    var tl = card('Timeline', [U.timeline(r.timeline)]);
    var notes = card('Internal notes', [r.notes.length ? h('ul', { class: 'ops-notes' }, r.notes.map(function (n) { return h('li', null, [h('b', { text: n.by }), ' · ' + U.clock(n.at) + ' – ' + n.text]); })) : h('p', { class: 'ops-muted', text: 'No notes yet. Notes are visible to operations staff only.' })],
      [btn('Add note', function (b) { note(r, b); }, 'g')]);
    root.appendChild(h('div', { class: 'ops-grid ops-grid-3' }, [h('div', { class: 'ops-col' }, [people, notes]), h('div', { class: 'ops-col' }, [fare, route]), tl]));
  }

  function actions(r, v) {
    var bar = h('div', { class: 'ops-actions', role: 'group', 'aria-label': 'Ride actions' });
    var final = FINAL.indexOf(r.state) >= 0, ok = function (perm) { return U.can(perm); };
    function a(label, perm, fn, cls, enabled, why) {
      var b = btn(label, function () { fn(b); }, cls);
      if (!enabled) { b.disabled = true; b.title = why; }
      else if (!ok(perm)) b.title = 'Your role cannot do this (needs ' + perm + '). Trying it is recorded in the audit log.';
      bar.appendChild(b);
    }
    a('Call rider', 'ride.view', function (b) { U.act('ride.view', 'call rider of ' + r.id, r.id, 'telephony.call', b).then(function (y) { if (y) { add(r, 'Admin called the rider (masked number)'); UI.toast('Calling ' + r.rider.name + ' (simulated – no call is placed).', 'info'); render(); } }); }, 'g', true);
    a('Call driver', 'ride.view', function (b) { U.act('ride.view', 'call driver of ' + r.id, r.id, 'telephony.call', b).then(function (y) { if (y) { add(r, 'Admin called the driver (masked number)'); UI.toast('Calling ' + v.driver.name + ' (simulated).', 'info'); render(); } }); }, 'g', !!v, 'No driver assigned');
    a('Message', 'ride.view', function (b) { message(r, v, b); }, 'g', true);
    a(r.state === 'SEARCHING' || r.state === 'NO_DRIVER' ? 'Assign driver' : 'Reassign driver', 'ride.dispatch', function (b) { reassign(r, b); }, '', ['SEARCHING', 'OFFER', 'DRIVER_ASSIGNED', 'ARRIVED', 'NO_DRIVER'].indexOf(r.state) >= 0, 'Only before the trip starts');
    a('Cancel ride', 'ride.cancel', function (b) { cancel(r, b); }, 'g', !final, 'The ride has ended');
    a('Refund', 'payment.refund', function (b) { refund(r, b); }, 'g', ['CAPTURED', 'COLLECTED', 'PARTLY_REFUNDED'].indexOf(r.payment.state) >= 0, 'Only for paid rides');
    a('Retry payment', 'payment.refund', function (b) { retry(r, b); }, 'g', r.payment.state === 'FAILED', 'Only for failed payments');
    a('Open incident', 'incident.handle', function (b) { incident(r, b); }, 'r', r.flags.indexOf('Incident open') < 0, 'An incident is already open');
    a('Flag for fraud review', 'fraud.block_account', function (b) { fraud(r, b); }, 'g', r.flags.indexOf('Fraud review') < 0, 'Already flagged');
    a('Download receipt', 'report.export', function (b) { receipt(r, v, b); }, 'g', r.state === 'COMPLETED', 'Only for completed rides');
    return bar;
  }
  function message(r, v, b) {
    U.form('Message about ' + r.id, [{ name: 'to', label: 'To', type: 'select', options: [['rider', 'Rider · ' + r.rider.name]].concat(v ? [['driver', 'Driver · ' + v.driver.name]] : []) },
      { name: 'text', label: 'Message', type: 'textarea', required: true }], 'Send').then(function (f) {
      if (!f) return;
      U.act('ride.view', 'message ' + f.to + ' of ' + r.id, r.id, 'ride.messaged', b).then(function (y) { if (y) { add(r, 'Message to the ' + f.to + ': “' + f.text + '”'); UI.toast('Message sent (simulated).', 'info'); render(); } });
    });
  }
  function reassign(r, b) {
    var pool = OD.vehicles.filter(function (x) { return x.city === r.city && x.status === 'AVAILABLE' && x.type === r.type; }).slice(0, 12);
    if (!pool.length) pool = OD.vehicles.filter(function (x) { return x.city === r.city && x.status === 'AVAILABLE' && OD.TYPES[x.type].perKm; }).slice(0, 12);
    if (!pool.length) { UI.toast('No available driver in ' + OD.CITIES[r.city].name + ' right now.', 'error'); return; }
    U.form('Assign a driver to ' + r.id, [{ name: 'v', label: 'Available drivers nearby', type: 'select', options: pool.map(function (x) { return [x.id, x.driver.name + ' · ★ ' + x.driver.rating + ' · ' + OD.TYPES[x.type].label + ' · ' + x.plate]; }) },
      { name: 'why', label: 'Reason', type: 'select', options: [['Rider waiting too long', 'Rider waiting too long'], ['Driver not moving', 'Driver not moving'], ['Driver asked to be released', 'Driver asked to be released'], ['Better match', 'Better match']] }],
      'Assign').then(function (f) {
      if (!f) return;
      U.act('ride.dispatch', 'assign a driver to ' + r.id, r.id, 'ride.assigned_manually', b).then(function (y) {
        if (!y) return;
        var old = vOf(r), nv = OD.vehicle(f.v);
        if (old) { old.status = 'AVAILABLE'; old.rideId = null; }
        nv.status = 'ON_TRIP'; nv.rideId = r.id; r.vehicleId = nv.id; r.state = 'DRIVER_ASSIGNED'; r.payment.state = 'AUTHORISED';
        add(r, (old ? 'Reassigned from ' + old.driver.name + ' to ' : 'Manually assigned to ') + nv.driver.name + ' · ' + f.why);
        UI.toast(nv.driver.name + ' assigned (simulated).', 'info'); render();
      });
    });
  }
  function cancel(r, b) {
    U.form('Cancel ride ' + r.id + '?', [{ name: 'why', label: 'Reason', type: 'select', options: [['Rider request via support', 'Rider request via support'], ['Driver not reachable', 'Driver not reachable'], ['Safety concern', 'Safety concern'], ['Duplicate booking', 'Duplicate booking'], ['Other', 'Other']] },
      { name: 'fee', label: 'Cancellation fee', type: 'select', options: [['waive', 'Waive the fee'], ['charge', 'Charge the fee']] }], 'Cancel ride', 'Both the rider and the driver are told in their apps.').then(function (f) {
      if (!f) return;
      U.act('ride.cancel', 'cancel ride ' + r.id, r.id, 'ride.cancelled', b).then(function (y) {
        if (!y) return;
        var v = vOf(r); if (v) { v.status = 'AVAILABLE'; v.rideId = null; }
        r.state = 'CANCELLED'; r.payment.state = f.fee === 'charge' ? 'CAPTURED' : 'VOID';
        add(r, 'Cancelled by admin · ' + f.why + (f.fee === 'charge' ? ' · fee charged' : ' · fee waived'), 'a');
        UI.toast('Ride cancelled (simulated).', 'info'); render();
      });
    });
  }
  function refund(r, b) {
    var left = Math.round((r.fare.total - refunded(r)) * 100) / 100;
    U.form('Refund for ' + r.id, [{ name: 'amount', label: 'Amount (' + r.currency + ', up to ' + left + ')', type: 'number', value: String(Math.min(left, Math.round(r.fare.total * 0.2))), required: true,
      check: function (x) { var n = Number(x); return !(n > 0 && n <= left) ? 'Enter an amount between 0 and ' + left + '.' : null; } },
      { name: 'reason', label: 'Reason', type: 'select', options: [['Driver took a longer route', 'Driver took a longer route'], ['Overcharged', 'Overcharged'], ['Poor service', 'Poor service'], ['Goodwill', 'Goodwill']] }],
      'Refund').then(function (f) {
      if (!f) return;
      U.act('payment.refund', 'refund ' + r.id, r.id, 'refund.issued', b).then(function (y) {
        if (!y) return;
        var amt = Math.round(Number(f.amount) * 100) / 100;
        r.refunds.push({ amount: amt, reason: f.reason, at: Date.now(), by: U.me() });
        r.payment.state = refunded(r) >= r.fare.total ? 'REFUNDED' : 'PARTLY_REFUNDED';
        add(r, 'Refund ' + money(r, amt) + ' · ' + f.reason);
        UI.toast('Refund of ' + money(r, amt) + ' issued (simulated – no money moves).', 'info'); render();
      });
    });
  }
  function retry(r, b) {
    U.act('payment.refund', 'retry payment of ' + r.id, r.id, 'payment.retried', b).then(function (y) {
      if (!y) return;
      var okNow = OD.random() < 0.75;
      r.payment.state = okNow ? 'CAPTURED' : 'FAILED';
      add(r, okNow ? 'Payment retried · collected' : 'Payment retried · failed again', okNow ? '' : 'a');
      UI.toast(okNow ? 'Payment collected on retry (simulated).' : 'Payment failed again (simulated). Ask the rider to update the method.', okNow ? 'info' : 'error'); render();
    });
  }
  function incident(r, b) {
    U.form('Open a safety incident for ' + r.id, [{ name: 'type', label: 'Type', type: 'select', options: [['Rider safety', 'Rider safety'], ['Driver safety', 'Driver safety'], ['Accident', 'Accident'], ['Harassment report', 'Harassment report']] },
      { name: 'prio', label: 'Priority', type: 'select', options: [['P1', 'P1 · immediate'], ['P2', 'P2 · within 15 min']] }, { name: 'text', label: 'What happened', type: 'textarea', required: true }], 'Open incident').then(function (f) {
      if (!f) return;
      U.act('incident.handle', 'open an incident for ' + r.id, r.id, 'incident.opened', b).then(function (y) {
        if (!y) return;
        r.flags.push('Incident open'); add(r, f.prio + ' incident opened · ' + f.type + ' · ' + f.text, 'a');
        UI.toast('Incident opened and sent to the safety console (A13).', 'info'); render();
      });
    });
  }
  function fraud(r, b) {
    U.form('Flag ' + r.id + ' for fraud review', [{ name: 'why', label: 'Signal', type: 'select', options: [['GPS spoofing suspected', 'GPS spoofing suspected'], ['Fake trip / collusion', 'Fake trip / collusion'], ['Promo abuse', 'Promo abuse'], ['Payment fraud', 'Payment fraud']] }], 'Flag').then(function (f) {
      if (!f) return;
      U.act('fraud.block_account', 'flag ' + r.id + ' for fraud review', r.id, 'fraud.flagged', b).then(function (y) { if (y) { r.flags.push('Fraud review'); add(r, 'Flagged for fraud review · ' + f.why, 'a'); UI.toast('Sent to the fraud queue (A14).', 'info'); render(); } });
    });
  }
  function note(r, b) {
    U.form('Internal note on ' + r.id, [{ name: 'text', label: 'Note', type: 'textarea', required: true }], 'Add note').then(function (f) {
      if (!f) return;
      U.act('ride.view', 'add a note to ' + r.id, r.id, 'ride.note', b).then(function (y) { if (y) { r.notes.push({ at: Date.now(), by: U.me(), text: f.text }); render(); } });
    });
  }
  function receipt(r, v, b) {
    U.act('report.export', 'download receipt ' + r.id, r.id, 'report.exported', b).then(function (y) {
      if (!y) return;
      var f = r.fare, lines = ['RideNova – trip receipt (synthetic demo data)', '', 'Ride      ' + r.id, 'Date      ' + new Date(r.requestedAt).toLocaleString('en-IN'), 'Service   ' + r.service,
        'From      ' + r.pickup.name, 'To        ' + r.drop.name, 'Distance  ' + r.km + ' km', 'Driver    ' + (v ? v.driver.name + ' · ' + v.plate : '-'), '',
        'Base      ' + money(r, f.base), 'Distance  ' + money(r, f.distance), 'Time      ' + money(r, f.time), 'Surge     ' + money(r, f.surge), 'Taxes     ' + money(r, f.tax), 'Discount  -' + money(r, f.discount),
        'Total     ' + money(r, f.total), 'Paid by   ' + r.payment.method + ' (' + PAY[r.payment.state][0] + ')'];
      download('receipt-' + r.id + '.txt', lines.join('\n'));
    });
  }

  // schematic route: pickup, drop and the vehicle on a light street grid (positions from the synthetic coordinates)
  function routeMap(r, v) {
    var NS = 'http://www.w3.org/2000/svg', W = 320, H = 200;
    var pts = [[r.pickup.lng, r.pickup.lat], [r.drop.lng, r.drop.lat]].concat(v ? [[v.lng, v.lat]] : []);
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), pad = 0.15;
    var sx = function (lng) { return 20 + (lng - x0) / Math.max(1e-6, x1 - x0) * (W - 40); }, sy = function (lat) { return 20 + (y1 - lat) / Math.max(1e-6, y1 - y0) * (H - 40); };
    var s = document.createElementNS(NS, 'svg'), add2 = function (tag, at) { var n = document.createElementNS(NS, tag); Object.keys(at).forEach(function (k) { n.setAttribute(k, at[k]); }); s.appendChild(n); return n; };
    s.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.setAttribute('class', 'ops-route'); s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'Route from ' + r.pickup.name + ' to ' + r.drop.name + (v ? ', vehicle shown' : ''));
    add2('rect', { x: 0, y: 0, width: W, height: H, class: 'bg' });
    for (var i = 1; i < 8; i++) { add2('line', { x1: i * W / 8, y1: 0, x2: i * W / 8 + (i % 2 ? 12 : -8), y2: H, class: 'st' }); add2('line', { x1: 0, y1: i * H / 6, x2: W, y2: i * H / 6 + (i % 2 ? -6 : 9), class: 'st' }); }
    var px1 = sx(r.pickup.lng), py1 = sy(r.pickup.lat), px2 = sx(r.drop.lng), py2 = sy(r.drop.lat);
    add2('path', { d: 'M' + px1.toFixed(1) + ' ' + py1.toFixed(1) + ' L' + px1.toFixed(1) + ' ' + ((py1 + py2) / 2).toFixed(1) + ' L' + px2.toFixed(1) + ' ' + ((py1 + py2) / 2).toFixed(1) + ' L' + px2.toFixed(1) + ' ' + py2.toFixed(1), class: 'rt' });
    add2('circle', { cx: px1, cy: py1, r: 7, class: 'pu' }); add2('rect', { x: px2 - 6, y: py2 - 6, width: 12, height: 12, class: 'dr' });
    if (v) add2('image', { href: 'assets/img/vehicles/' + v.type + '.svg', x: sx(v.lng) - 12, y: sy(v.lat) - 12, width: 24, height: 24 });
    var wrap = h('div', { class: 'ops-routewrap' }, [s]);
    wrap.appendChild(h('div', { class: 'ops-routekey' }, [h('span', null, [h('i', { class: 'pu' }), 'Pickup']), h('span', null, [h('i', { class: 'dr' }), 'Drop']), v ? h('span', null, ['Vehicle']) : null, h('span', { class: 'ops-muted', text: pad ? r.km + ' km' : '' })]));
    return wrap;
  }

  // ---------------------------------------------------------------- the engine's live demo ride (booked in this tab)
  function liveCard() {
    var e = UI.engine, r = e.ride && e.ride(); if (!r) return null;
    var dr = r.driverId && D.DRIVERS[r.driverId];
    var body = [h('div', { class: 'ops-livebar' }, [h('b', { text: r.id }), h('span', { 'data-bind': 'state', class: 'st info', text: r.state }),
      h('span', { class: 'ops-muted', text: (dr ? dr.short + ' · ' + dr.vehicle + ' · ' + dr.plate : 'No driver yet (' + r.offers.length + ' offer(s))') + ' · quote ' + RN.engineLib.rupees(r.quotePaise) + ' · ' + r.payment.method + ' ' + r.payment.state.toLowerCase().replace('_', ' ') })])];
    var acts = h('div', { class: 'ops-actions' });
    var x = function (label, cmd, p, cls, conf) { acts.appendChild(btn(label, function (b) { (conf ? UI.confirm(conf) : Promise.resolve(true)).then(function (y) { if (y) K.exec(cmd, p || {}, b, { actor: 'admin' }).then(function (res) { if (res.ok) UI.toast(label + ' done (simulated).', 'info'); }); }); }, cls)); };
    if (['SEARCHING_DRIVER', 'DRIVER_ASSIGNED'].indexOf(r.state) >= 0) Object.keys(e.state.drivers).map(function (k) { return e.state.drivers[k]; })
      .filter(function (d) { return d.avail === 'ONLINE' && !d.blocked && d.type === 'Cab'; }).forEach(function (d) { x('Assign ' + d.short, 'admin.assign', { driverId: d.id }, ''); });
    if (!K.rideFinal(r)) x('Cancel ride', 'ride.cancel', {}, 'g', 'Cancel this ride for the rider and driver?');
    x('Open incident', 'admin.openIncident', {}, 'r');
    body.push(acts);
    body.push(U.timeline(e.state.events.filter(function (ev) { return ev.ref === 'ride:' + r.id; }).slice(-6).map(function (ev) { return { at: ev.at, text: ev.note || ev.type, kind: /declined|expired|failed|denied|sos/.test(ev.type) ? 'a' : '' }; })));
    return card('Live demo ride · booked in this browser tab', body, null, 'ops-live-card');
  }

  function liveSig() {
    var e = UI.engine, ses = e.state.session.admin, r = e.ride && e.ride();
    return ses.status + ses.role + (r ? r.id + r.state + r.driverId + (r.payment && r.payment.state) : '');
  }
  K.def('A04', { init: render, update: function () {
    var dc = UI.q('#mock .dc');
    if (dc && dc.getAttribute('data-live') !== liveSig()) render();
  } });
  RN.opsRides = { state: M, render: render };
})();
