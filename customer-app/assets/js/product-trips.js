/* RideNova Customer app - long trips, buses, shared seats, trip plan, offline, hotels, rentals, price alerts (working screens).
   R32 long-distance search, R33 options, R34 shared seat, R35 bus seats, R36 trip plan, R37 stops, R38-R40 offline,
   R41/R42 hotels, R43 rentals, R50 price alert. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.store, P = RN.product, h = P.h, ic = P.ic, rs = P.rs;
  var exec = K.exec;

  // ------------------------------------------------------------ cities, distances, helpers
  var CITIES = [['Hyderabad', 17.385, 78.4867], ['Bengaluru', 12.9716, 77.5946], ['Chennai', 13.0827, 80.2707], ['Mumbai', 19.076, 72.8777], ['Pune', 18.5204, 73.8567], ['Goa (Panaji)', 15.4909, 73.8278],
    ['Kochi', 9.9312, 76.2673], ['Kozhikode', 11.2588, 75.7804], ['Mysuru', 12.2958, 76.6394], ['Vijayawada', 16.5062, 80.648], ['Visakhapatnam', 17.6868, 83.2185], ['Tirupati', 13.6288, 79.4192],
    ['Coimbatore', 11.0168, 76.9558], ['Warangal', 17.9689, 79.5941], ['Nagpur', 21.1458, 79.0882], ['Mangaluru', 12.9141, 74.856]].map(function (c) { return { n: c[0], lat: c[1], lon: c[2] }; });
  P.CITIES = CITIES;
  function city(n) { return CITIES.filter(function (c) { return c.n === n; })[0] || CITIES[0]; }
  function roadKm(a, b) { return Math.round(P.hav(city(a), city(b)) * 1.28 / 5) * 5 || 5; }
  P.roadKm = roadKm;
  function code() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return 'RN-' + s; }
  P.code = code;
  function tomorrow() { return P.isoDate(Date.now() + 86400000); }
  var NAMES = ['Anil', 'Vijay', 'Suresh', 'Ramesh', 'Mahesh', 'Karthik', 'Naveen', 'Imran', 'Faisal', 'Prakash'];

  // pay + create booking. o: {title, paise, cat, allow, booking:{...}, after(b), goto}
  P.checkout = function (o) {
    var d = P.discount(o.cat, o.paise), net = o.paise - d.paise;
    P.pay({ title: o.title, paise: net, allow: o.allow, note: d.paise ? 'Coupon ' + d.code + ' applied: you save ' + rs(d.paise) : (d.why || ''), onPaid: function (m) {
      var u = S.user(), paidWith = m === 'Cash' ? 'Pay at the property' : m;
      var b = S.addBooking(Object.assign({ paise: net, pay: paidWith, code: code(), status: 'Confirmed' }, o.booking));
      if (d.paise) P.useCoupon(d.paise, o.cat, d.code);
      P.applyUser(u); S.notify(u, 'Booking confirmed', o.title + ' \u00B7 ' + rs(net), 'Orders', 'R54');
      UI.toast('Booked: ' + o.title + '. Reference ' + b.code, 'info'); P.nav.booking = b.id; P.nav.tripTab = 'Upcoming';
      if (o.after) o.after(b); UI.go(o.goto || 'R62');
    } });
  };

  // ------------------------------------------------------------ long-distance options
  P.lt = { from: 'Hyderabad', to: 'Bengaluru', date: '', pax: 1, trip: 'One way', ret: '' };
  var OPERATORS = [['KSRTC Airavat', 'AC seater', 1.7], ['State bus', 'non-AC', 1.1], ['SRS Travels', 'AC sleeper', 2.4], ['Orange Tours', 'Volvo multi-axle', 2.7], ['IntrCity SmartBus', 'AC seater', 2.0], ['VRL Travels', 'AC sleeper', 2.5]];
  function hourTs(date, hour, min) { return P.parseIso(date) + (hour * 60 + (min || 0)) * 60000; }
  P.ltOptions = function (lt) {
    var km = roadKm(lt.from, lt.to), rnd = P.seeded(lt.from + lt.to + lt.date), out = [], now = Date.now();
    var dep = function (hrs) { return hrs.map(function (x) { return hourTs(lt.date, Math.floor(x), Math.round((x % 1) * 60 / 5) * 5); }).filter(function (t) { return t > now + 30 * 60000; }); };
    var dur = function (spd) { return Math.round(km / spd * 60 + 15); };
    dep([5.5, 8, 13.25, 19.5, 21.5, 22.75]).slice(0, 5).forEach(function (t, i) {
      var op = OPERATORS[(i + Math.floor(rnd() * 3)) % OPERATORS.length], d = dur(op[1] === 'non-AC' ? 42 : 52 + rnd() * 6), fare = Math.round(km * op[2] * (0.92 + rnd() * 0.18) / 5) * 5;
      out.push({ id: 'B' + i, kind: 'bus', title: op[0] + ' \u00B7 ' + op[1], sub: P.ftime(t) + ' \u2192 ' + P.ftime(t + d * 60000) + ' \u00B7 ' + P.mins(d), icon: 'bus', depart: t, arrive: t + d * 60000, mins: d, paise: fare * 100, seats: 4 + Math.floor(rnd() * 28), op: op[0], type: op[1] });
    });
    dep([6, 9.5, 15, 18]).slice(0, 3).forEach(function (t, i) {
      var d = dur(62), fare = Math.round(km * 4.1 * (0.9 + rnd() * 0.2) / 5) * 5, drv = NAMES[Math.floor(rnd() * NAMES.length)];
      out.push({ id: 'S' + i, kind: 'share', title: 'Shared cab seat \u00B7 ' + drv + ' K.', sub: P.ftime(t) + ' \u2192 ' + P.ftime(t + d * 60000) + ' \u00B7 ' + P.mins(d) + ' \u00B7 max 4 riders', icon: 'users', depart: t, arrive: t + d * 60000, mins: d, paise: fare * 100, seats: 1 + Math.floor(rnd() * 3), driver: drv + ' Kumar', car: ['Maruti Ertiga', 'Toyota Innova', 'Swift Dzire', 'Hyundai Aura'][Math.floor(rnd() * 4)], rating: (4.5 + rnd() * 0.5).toFixed(1) });
    });
    var d = dur(68);
    out.push({ id: 'C1', kind: 'cab', title: 'Private cab \u00B7 sedan (one way)', sub: 'Leave any time \u00B7 ' + P.mins(d) + ' \u00B7 tolls included', icon: 'car', depart: null, mins: d, paise: Math.round(km * 12.5 / 10) * 1000, seats: 4 });
    out.push({ id: 'C2', kind: 'cab', title: 'Private cab \u00B7 SUV (one way)', sub: 'Leave any time \u00B7 ' + P.mins(d) + ' \u00B7 up to 6 riders', icon: 'car2', depart: null, mins: d, paise: Math.round(km * 17 / 10) * 1000, seats: 6 });
    out.push({ id: 'R1', kind: 'self', title: 'Self-drive car', sub: 'Pick up in ' + lt.from + ' \u00B7 from ' + rs(180000) + ' / day', icon: 'key', paise: 180000, seats: 4 });
    out.push({ id: 'R2', kind: 'bike', title: 'Touring bike rental', sub: 'Pick up in ' + lt.from + ' \u00B7 from ' + rs(90000) + ' / day', icon: 'bike', paise: 90000, seats: 1 });
    var cheapest = out.filter(function (o) { return o.kind === 'bus' || o.kind === 'share'; }).sort(function (a, b) { return a.paise - b.paise; })[0]; if (cheapest) cheapest.tag = 'CHEAPEST';
    var fastest = out.filter(function (o) { return o.depart; }).sort(function (a, b) { return a.mins - b.mins; })[0]; if (fastest && fastest !== cheapest) fastest.tag = 'FASTEST';
    return out;
  };

  P.screen('R32', {
    title: 'Long-distance trip', back: 'R29',
    reset: function (v) { if (!P.lt.date || P.parseIso(P.lt.date) < P.startOfDay(Date.now())) P.lt.date = tomorrow(); v.prio = UI.engine.state.rider.priority; },
    build: function (body, v) {
      var lt = P.lt, names = CITIES.map(function (c) { return c.n; });
      var retBox = h('div', { hidden: lt.trip !== 'Round trip' }, P.field({ name: 'ret', label: 'Return date', type: 'date', value: lt.ret || '', min: P.isoDate(Date.now()), on: { change: function () { lt.ret = UI.val('ret'); } } }));
      body.appendChild(P.chips(['One way', 'Round trip'], lt.trip, function (t) { lt.trip = t; retBox.hidden = t !== 'Round trip'; }));
      var from = P.field({ name: 'from', label: 'From', select: names, value: lt.from, on: { change: function () { lt.from = UI.val('from'); } } });
      var to = P.field({ name: 'to', label: 'To', select: names, value: lt.to, on: { change: function () { lt.to = UI.val('to'); } } });
      body.appendChild(from); body.appendChild(to);
      body.appendChild(h('button', { type: 'button', class: 'chip p-swap', on: { click: function () { var a = UI.val('from'), b = UI.val('to'); if (a.trim() === b.trim()) { UI.toast(a.trim() ? 'Pickup and destination are the same.' : 'Enter both places to swap them.', 'info'); return; } from.input.value = b; to.input.value = a; lt.from = b; lt.to = a; } } }, [ic('repeat', 14), ' Swap']));
      body.appendChild(P.field({ name: 'date', label: 'Travel date', type: 'date', value: lt.date, min: P.isoDate(Date.now()), on: { change: function () { lt.date = UI.val('date'); } } }));
      body.appendChild(retBox);
      body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Passengers'), P.stepper(lt.pax, function (n) { lt.pax = n; }, 1, 6)]));
      body.appendChild(P.sec('MY PRIORITY'));
      body.appendChild(P.chips([['urgent', 'Urgent'], ['bal', 'Balanced'], ['saver', 'Saver'], ['flex', 'Flexible'], ['deals', 'Deals']], v.prio, function (p) { exec('rider.priority', { arg: p }, null, { instant: true }); }));
      body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn('Find options', '', function () {
        P.clearErrors(); lt.from = UI.val('from'); lt.to = UI.val('to'); lt.date = UI.val('date'); lt.ret = UI.val('ret') || ''; var bad = false;
        if (lt.from === lt.to) { UI.fieldError('to', 'Choose a different destination from ' + lt.from + '.'); bad = true; }
        if (!P.parseIso(lt.date) || P.parseIso(lt.date) < P.startOfDay(Date.now())) { UI.fieldError('date', 'Choose today or a later date.'); bad = true; }
        if (lt.trip === 'Round trip' && (!lt.ret || P.parseIso(lt.ret) < P.parseIso(lt.date))) { UI.fieldError('ret', 'Return date must be on or after the travel date.'); bad = true; }
        if (bad) return; P.nav.longMode = P.nav.longMode || 'all'; UI.go('R33');
      }));
    }
  });

  P.screen('R33', {
    title: 'Trip options', back: 'R32',
    reset: function (v) { if (!P.lt.date || P.parseIso(P.lt.date) < P.startOfDay(Date.now())) P.lt.date = tomorrow(); v.f = { share: 'Shared', bus: 'Bus' }[P.nav.longMode] || 'All'; P.nav.longMode = null; v.prio = UI.engine.state.rider.priority; },
    build: function (body, v) {
      var lt = P.lt, km = roadKm(lt.from, lt.to);
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('b', null, lt.from + ' \u2192 ' + lt.to), h('button', { type: 'button', class: 'chip', on: { click: function () { UI.go('R32'); } } }, 'Edit')]), h('div', { class: 'xs' }, P.fdate(P.parseIso(lt.date)) + ' \u00B7 ' + lt.pax + ' passenger' + (lt.pax > 1 ? 's' : '') + ' \u00B7 ' + km + ' km')]));
      body.appendChild(P.chips(['All', 'Bus', 'Shared', 'Cab', 'Self-drive', 'Bike'], v.f, function (f) { v.f = f; draw(); }));
      var list = h('div', { class: 'p-opts' }); body.appendChild(list);
      if (km > 150) body.appendChild(h('a', { class: 'banner warn', href: '#/R38', 'data-go': 'R38' }, [ic('info'), h('span', null, 'About ' + Math.round(km / 12) + ' km of this route has no mobile network. Tap to prepare offline.')]));
      var kindOf = { Bus: 'bus', Shared: 'share', Cab: 'cab', 'Self-drive': 'self', Bike: 'bike' };
      function draw() {
        P.clear(list); var all = P.ltOptions(lt), rows = all.filter(function (o) { return v.f === 'All' || o.kind === kindOf[v.f]; });
        var by = { urgent: function (a, b) { return (a.mins || 9999) - (b.mins || 9999); }, saver: function (a, b) { return a.paise - b.paise; }, flex: function (a, b) { return a.paise - b.paise; }, deals: function (a, b) { return a.paise - b.paise; }, bal: null }[v.prio]; if (by) rows.sort(by);
        if (!rows.length) { list.appendChild(P.empty('No ' + v.f.toLowerCase() + ' departures left for this date. Try another day.', 'calendar')); return; }
        rows.forEach(function (o) {
          list.appendChild(P.opt({ icon: o.icon, title: o.title + (o.tag ? '  ' + o.tag : ''), sub: o.sub, sub2: o.kind === 'bus' || o.kind === 'share' ? o.seats + ' seats left' : '', price: rs(o.paise) + (o.kind === 'self' || o.kind === 'bike' ? '/day' : ''), onClick: function () { choose(o); } }));
        });
      }
      function choose(o) {
        P.nav.ltOpt = o;
        if (o.kind === 'bus') UI.go('R35'); else if (o.kind === 'share') UI.go('R34');
        else if (o.kind === 'self' || o.kind === 'bike') { P.nav.rentTab = o.kind === 'bike' ? 'Bikes & scooters' : 'Cars'; P.nav.rentCity = lt.from; UI.go('R43'); }
        else cabSheet(o);
      }
      function cabSheet(o) {
        P.sheet(o.title, function (b, api) {
          b.appendChild(P.kv('Route', lt.from + ' \u2192 ' + lt.to)); b.appendChild(P.kv('Date', P.fdate(P.parseIso(lt.date)))); b.appendChild(P.kv('Distance', km + ' km \u00B7 about ' + P.mins(o.mins)));
          b.appendChild(P.field({ name: 'ptime', label: 'Pick-up time', select: ['06:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM'], value: '08:00 AM' }));
          b.appendChild(P.field({ name: 'paddr', label: 'Pick-up address', maxlength: 70, placeholder: 'e.g. Road 12, Banjara Hills' }));
          b.appendChild(P.btn('Book for ' + rs(o.paise), '', function () {
            P.clearErrors(); var addr = UI.val('paddr').trim(); if (addr.length < 4) { UI.fieldError('paddr', 'Enter your pick-up address.'); return; }
            var tm = /(\d+):(\d+) (AM|PM)/.exec(UI.val('ptime')), hr = +tm[1] % 12 + (tm[3] === 'PM' ? 12 : 0), when = hourTs(lt.date, hr, 0);
            if (when < Date.now() + 30 * 60000) { UI.fieldError('ptime', 'Choose a later time or another date.'); return; }
            api.close(); P.checkout({ title: lt.from + ' \u2192 ' + lt.to + ' private cab', paise: o.paise, cat: 'ride', allow: ['Wallet', 'UPI', 'Card'], booking: { type: 'cab', title: lt.from + ' \u2192 ' + lt.to, sub: o.title.split(' \u00B7 ')[1] + ' \u00B7 ' + km + ' km', when: when, route: { from: lt.from, to: lt.to, km: km }, details: [['Route', lt.from + ' \u2192 ' + lt.to], ['Pick-up', addr + ', ' + UI.val('ptime')], ['Vehicle', o.title], ['Distance', km + ' km']] } });
          }));
        });
      }
      draw();
    }
  });

  // ------------------------------------------------------------ R34 shared seat
  var BOARD = { 'Hyderabad': ['Mehdipatnam bus bay', 'Gachibowli flyover'], 'Bengaluru': ['Silk Board junction', 'Majestic bus stand'], 'Chennai': ['Koyambedu CMBT', 'Guindy'], 'Mumbai': ['Dadar TT circle', 'Andheri east'], 'Pune': ['Swargate', 'Hinjewadi phase 1'], 'Kochi': ['Edappally junction', 'Vyttila hub'], 'Kozhikode': ['Mavoor Road bus bay', 'Thamarassery junction'], 'Mysuru': ['KSRTC suburban stand', 'Vijayanagar ring road'] };
  function points(name) { return BOARD[name] || [name + ' main bus stand', name + ' bypass junction']; }
  P.screen('R34', {
    title: 'Shared seat', back: 'R33',
    reset: function (v) { v.o = P.nav.ltOpt && P.nav.ltOpt.kind === 'share' ? P.nav.ltOpt : P.ltOptions(P.lt).filter(function (o) { return o.kind === 'share'; })[0]; v.seats = 1; v.board = 0; v.drop = 0; },
    build: function (body, v) {
      var o = v.o, lt = P.lt;
      if (!o) { body.appendChild(P.empty('No shared cab left on this date.', 'users')); body.appendChild(P.btn('See other options', 'soft', function () { UI.go('R33'); })); return; }
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'p-hello' }, [h('span', { class: 'av' }, o.driver.split(' ').map(function (x) { return x[0]; }).join('')), h('div', { class: 'x-flex-1 p-left' }, [h('b', null, o.driver), h('div', { class: 'xs' }, o.car + ' \u00B7 AC \u00B7 verified driver')]), h('span', { class: 'p-rate' }, '\u2605 ' + o.rating)]), P.kv('Departs', P.fdt(o.depart)), P.kv('Arrives', P.ftime(o.arrive) + ' (' + P.mins(o.mins) + ')'), P.kv('Seats left', String(o.seats))]));
      var bp = points(lt.from), dp = points(lt.to), bl = h('div', { class: 'list' }), dl = h('div', { class: 'list' });
      body.appendChild(P.sec('BOARDING POINT'));
      bp.forEach(function (p, i) { var r = P.row({ icon: 'pin', title: p, sub: P.ftime(o.depart + i * 25 * 60000), on: i === v.board, onClick: function () { v.board = i; P.pickGroup(bl)(r); } }); r.setAttribute('aria-pressed', String(i === v.board)); bl.appendChild(r); }); body.appendChild(bl);
      body.appendChild(P.sec('DROP POINT'));
      dp.forEach(function (p, i) { var r = P.row({ icon: 'flag', title: p, sub: P.ftime(o.arrive - (dp.length - 1 - i) * 20 * 60000), on: i === v.drop, onClick: function () { v.drop = i; P.pickGroup(dl)(r); } }); r.setAttribute('aria-pressed', String(i === v.drop)); dl.appendChild(r); }); body.appendChild(dl);
      var total = h('b', { class: 'x-font-size-18px' }), btn = P.btn('', '', function () {
        P.checkout({ title: lt.from + ' \u2192 ' + lt.to + ' shared seat', paise: o.paise * v.seats, cat: 'share', allow: ['Wallet', 'UPI', 'Card'], booking: { type: 'share', title: lt.from + ' \u2192 ' + lt.to, sub: 'Shared cab \u00B7 ' + v.seats + ' seat' + (v.seats > 1 ? 's' : '') + ' \u00B7 ' + o.driver, when: o.depart, route: { from: lt.from, to: lt.to, km: roadKm(lt.from, lt.to) }, details: [['Driver', o.driver + ' \u00B7 ' + o.car], ['Seats', String(v.seats)], ['Boarding', bp[v.board] + ' ' + P.ftime(o.depart + v.board * 25 * 60000)], ['Drop', dp[v.drop]], ['Departs', P.fdt(o.depart)]] } });
      });
      body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Seats'), P.stepper(1, function (n) { v.seats = n; paint(); }, 1, Math.min(o.seats, lt.pax > 1 ? lt.pax : 3))]));
      body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Total'), total])); body.appendChild(btn);
      function paint() { total.textContent = rs(o.paise * v.seats); btn.textContent = 'Book ' + v.seats + ' seat' + (v.seats > 1 ? 's' : '') + ' \u00B7 ' + rs(o.paise * v.seats); }
      paint();
    }
  });

  // ------------------------------------------------------------ R35 bus seats
  P.screen('R35', {
    title: 'Choose seats', back: 'R33',
    reset: function (v) { v.o = P.nav.ltOpt && P.nav.ltOpt.kind === 'bus' ? P.nav.ltOpt : P.ltOptions(P.lt).filter(function (o) { return o.kind === 'bus'; })[0]; v.sel = []; v.board = 0; v.drop = 0; },
    build: function (body, v) {
      var o = v.o, lt = P.lt, u = S.user();
      if (!o) { body.appendChild(P.empty('No buses left on this date.', 'bus')); body.appendChild(P.btn('See other options', 'soft', function () { UI.go('R33'); })); return; }
      body.appendChild(h('div', { class: 'card-m' }, [h('b', null, o.title), h('div', { class: 'xs' }, lt.from + ' \u2192 ' + lt.to + ' \u00B7 ' + P.fdt(o.depart) + ' \u2192 ' + P.ftime(o.arrive))]));
      var rnd = P.seeded(o.id + lt.date + lt.from), taken = {}; for (var k = 0; k < 40; k++) if (rnd() < (o.seats > 20 ? 0.35 : 0.8)) taken[k] = 1;
      var max = Math.min(6, Math.max(1, lt.pax)), grid = h('div', { class: 'p-seats' }), info = h('div', { class: 'xs' });
      var idx = 0; for (var r = 1; r <= 10; r++) ['A', 'B', null, 'C', 'D'].forEach(function (col, ci) {
        if (!col) { grid.appendChild(h('span', { class: 'p-seat gap' })); return; }
        var row = Math.floor(idx / 4) + 1, label = row + col, n = idx++, t = !!taken[n];
        var b = h('button', { type: 'button', class: 'p-seat' + (t ? ' taken' : ''), 'aria-label': 'Seat ' + label + (t ? ' booked' : ''), 'aria-pressed': 'false', disabled: t }, label);
        b.addEventListener('click', function () {
          var i = v.sel.indexOf(label);
          if (i >= 0) v.sel.splice(i, 1); else { if (v.sel.length >= max) { UI.toast('You can pick up to ' + max + ' seat' + (max > 1 ? 's' : '') + ' for this search.', 'warn'); return; } v.sel.push(label); }
          b.classList.toggle('sel', i < 0); b.setAttribute('aria-pressed', String(i < 0)); paint();
        }); grid.appendChild(b);
      });
      body.appendChild(h('div', { class: 'xs' }, 'Tap seats \u00B7 grey = booked \u00B7 up to ' + max)); body.appendChild(grid); body.appendChild(info);
      var bp = [lt.from + ' \u00B7 ' + points(lt.from)[0], lt.from + ' \u00B7 ' + points(lt.from)[1]], dp = [lt.to + ' \u00B7 ' + points(lt.to)[0], lt.to + ' \u00B7 ' + points(lt.to)[1]];
      body.appendChild(P.field({ name: 'board', label: 'Boarding point', select: bp.map(function (x, i) { return [i, x + ' \u00B7 ' + P.ftime(o.depart + i * 30 * 60000)]; }) }));
      body.appendChild(P.field({ name: 'dropp', label: 'Drop point', select: dp.map(function (x, i) { return [i, x]; }) }));
      var pass = h('div'); body.appendChild(pass);
      function paint() {
        info.textContent = v.sel.length ? 'Selected: ' + v.sel.join(', ') + ' \u00B7 ' + rs(o.paise * v.sel.length) : 'No seats selected yet.'; btn.textContent = v.sel.length ? 'Continue to pay \u00B7 ' + rs(o.paise * v.sel.length) : 'Select seats to continue';
        var keep = {}; UI.qa('#mock input[name^="pn"]').forEach(function (x) { keep[x.name] = x.value; });
        P.clear(pass); v.sel.forEach(function (s, i) { pass.appendChild(P.field({ name: 'pn' + i, label: 'Passenger ' + (i + 1) + ' name (seat ' + s + ')', value: keep['pn' + i] != null ? keep['pn' + i] : (i === 0 ? u.name : ''), maxlength: 40 })); });
      }
      var btn = P.btn('', '', function () {
        P.clearErrors(); if (!v.sel.length) { UI.toast('Select at least one seat.', 'error'); return; }
        var bad = false, names = v.sel.map(function (s, i) { var n = UI.val('pn' + i).trim(); if (n.length < 2) { UI.fieldError('pn' + i, 'Enter the passenger name.'); bad = true; } return n; }); if (bad) return;
        var bi = +UI.val('board'), di = +UI.val('dropp');
        P.checkout({ title: o.op + ' \u00B7 ' + lt.from + ' \u2192 ' + lt.to, paise: o.paise * v.sel.length, cat: 'bus', allow: ['Wallet', 'UPI', 'Card'], booking: { type: 'bus', title: lt.from + ' \u2192 ' + lt.to, sub: o.op + ' \u00B7 seats ' + v.sel.join(', '), when: o.depart, route: { from: lt.from, to: lt.to, km: roadKm(lt.from, lt.to) }, details: [['Operator', o.title], ['Seats', v.sel.join(', ')], ['Passengers', names.join(', ')], ['Boarding', bp[bi] + ' ' + P.ftime(o.depart + bi * 30 * 60000)], ['Drop', dp[di]], ['Departs', P.fdt(o.depart)]] } });
      });
      body.appendChild(btn); paint();
    }
  });

  // ------------------------------------------------------------ R36 trip plan
  var PLAN_TYPES = ['bus', 'share', 'cab', 'hotel', 'rental'];
  P.screen('R36', {
    title: 'Trip plan', back: 'R29',
    right: function () { return h('button', { type: 'button', class: 'chip', on: { click: function () { UI.go('R37'); } } }, 'Stops'); },
    build: function (body, v) {
      var u = S.user(), items = u.bookings.filter(function (b) { return PLAN_TYPES.indexOf(b.type) >= 0 && b.status !== 'Cancelled' && (b.status === 'Planned' || (b.when && b.when > Date.now() - 6 * 3600000)); }).sort(function (a, b) { return (a.when || 0) - (b.when || 0); });
      if (!items.length) {
        body.appendChild(P.empty('Your trip plan is empty. Add a bus, stay or rental, or let the AI planner build a plan.', 'map'));
        body.appendChild(P.btn('Plan with AI', '', function () { UI.go('R52'); })); body.appendChild(h('div', { class: 'p-sticky-actions' }, [P.btn('Long trip', 'soft sm', function () { UI.go('R32'); }), P.btn('Hotels', 'soft sm', function () { UI.go('R41'); }), P.btn('Rentals', 'soft sm', function () { UI.go('R43'); })])); return;
      }
      var planned = items.filter(function (b) { return b.status === 'Planned'; }), total = items.reduce(function (s, b) { return s + (b.paise || 0); }, 0), pTotal = planned.reduce(function (s, b) { return s + (b.paise || 0); }, 0);
      body.appendChild(h('div', { class: 'card-m brand' }, [h('span', { class: 'xs' }, items.length + ' item' + (items.length > 1 ? 's' : '') + ' in your plan'), h('b', { class: 'big-num' }, rs(total)), h('span', { class: 'xs' }, planned.length ? planned.length + ' still to book (' + rs(pTotal) + ')' : 'Everything is booked')]));
      var day = '', list = null;
      items.forEach(function (b) {
        var d = b.when ? P.fdate(b.when) : 'Undated';
        if (d !== day) { day = d; body.appendChild(P.sec(d.toUpperCase())); list = h('div', { class: 'list' }); body.appendChild(list); }
        list.appendChild(P.row({ icon: P.iconOf(b.type), tone: b.status === 'Planned' ? 'amber' : 'brand', title: b.title, sub: (b.when ? P.ftime(b.when) + ' \u00B7 ' : '') + b.sub, right: b.status === 'Planned' ? 'Planned' : rs(b.paise), rightKind: b.status === 'Planned' ? 'warn' : 'ok', chev: true, onClick: function () { P.nav.booking = b.id; UI.go('R62'); } }));
      });
      var more = (u.stops || []).length; if (more) body.appendChild(P.banner('info', more + ' stop' + (more > 1 ? 's' : '') + ' added along the route.', 'pin'));
      if (planned.length) body.appendChild(P.btn('Book all \u00B7 ' + rs(pTotal), '', function () {
        P.pay({ title: 'Book ' + planned.length + ' planned item' + (planned.length > 1 ? 's' : ''), paise: pTotal, allow: ['Wallet', 'UPI', 'Card'], onPaid: function (m) {
          planned.forEach(function (b) { b.status = 'Confirmed'; b.pay = m; b.code = P.code(); }); S.save(); P.applyUser(u); S.notify(u, 'Trip booked', planned.length + ' items confirmed \u00B7 ' + rs(pTotal), 'Orders', 'R54'); UI.toast('All booked. Have a great trip!', 'info'); v.draw();
        } });
      }));
      body.appendChild(h('div', { class: 'p-sticky-actions' }, [P.btn('Customise stops', 'soft sm', function () { UI.go('R37'); }), P.btn('Offline pack', 'ghost sm', function () { UI.go('R38'); })]));
    }
  });

  // ------------------------------------------------------------ R37 stops, R38 - R40 offline
  function legRoute() {
    var u = S.user(), b = u.bookings.filter(function (x) { return x.route && x.status !== 'Cancelled' && (!x.when || x.when > Date.now() - 86400000); }).sort(function (a, b) { return (a.when || 0) - (b.when || 0); })[0];
    return b ? b.route : { from: P.lt.from, to: P.lt.to, km: roadKm(P.lt.from, P.lt.to) };
  }
  P.stopsFor = function (route) {
    var rnd = P.seeded(route.from + route.to), pool = [['Food', 'Hill View Mess', '\u20B9'], ['Food', 'Green Leaf Caf\u00E9', '\u20B9\u20B9'], ['Food', 'Royal Dhaba', '\u20B9\u20B9'], ['Stays', 'Forest Edge Resort', '\u20B9\u20B9\u20B9'], ['Stays', 'Travellers Inn', '\u20B9\u20B9'], ['Fuel/EV', 'IOCL Fuel Station', ''], ['Fuel/EV', 'Fast EV Charging Hub', ''], ['Bus stops', 'Highway bus bay', ''], ['Hospitals', 'Govt Primary Health Centre', ''], ['Hospitals', 'City Care Hospital', '']];
    var out = []; for (var i = 0; i < 10; i++) { var p = pool[i % pool.length], km = Math.round(route.km * (i + 1) / 11); out.push({ kind: p[0], n: p[1], price: p[2], km: km, eta: Math.round(km / 55 * 60), rating: (3.9 + rnd() * 1).toFixed(1), id: route.from + route.to + i }); }
    return out;
  };
  P.screen('R37', {
    title: 'Stops along the route', back: 'R36',
    reset: function (v) { v.f = 'All'; },
    build: function (body, v) {
      var u = S.user(), route = legRoute(); u.stops = u.stops || [];
      body.appendChild(h('div', { class: 'xs' }, route.from + ' \u2192 ' + route.to + ' \u00B7 ' + route.km + ' km'));
      body.appendChild(P.chips(['All', 'Food', 'Stays', 'Fuel/EV', 'Bus stops', 'Hospitals'], v.f, function (f) { v.f = f; draw(); }));
      if (route.km > 150) body.appendChild(h('a', { class: 'banner warn', href: '#/R38', 'data-go': 'R38' }, [ic('info'), h('span', null, 'Km ' + Math.round(route.km * 0.55) + '-' + Math.round(route.km * 0.55 + route.km / 12) + ' has no network. Plan a stop before it.')]));
      var added = h('div'), list = h('div', { class: 'list' }); body.appendChild(added); body.appendChild(list);
      function draw() {
        P.clear(list); P.clear(added);
        if (u.stops.length) { added.appendChild(P.sec('YOUR STOPS')); added.appendChild(P.list(u.stops.map(function (s, i) { return P.row({ icon: 'pin', tone: 'brand', title: s.n, sub: 'km ' + s.km + ' \u00B7 ' + s.kind, trail: h('button', { type: 'button', class: 'ib', 'aria-label': 'Remove ' + s.n, on: { click: function () { var gone = u.stops.splice(i, 1)[0]; S.save(); draw(); P.undo('Stop removed.', function () { u.stops.splice(i, 0, gone); S.save(); draw(); }); } } }, ic('x', 14)) }); }))); }
        P.stopsFor(route).filter(function (s) { return v.f === 'All' || s.kind === v.f; }).forEach(function (s) {
          var has = u.stops.some(function (x) { return x.id === s.id; });
          list.appendChild(P.row({ icon: { Food: 'food', Stays: 'bed', 'Fuel/EV': 'bolt', 'Bus stops': 'bus', Hospitals: 'shield' }[s.kind], title: s.n + (s.price ? ' \u00B7 ' + s.price : ''), sub: 'km ' + s.km + ' \u00B7 ' + P.mins(s.eta) + ' from start \u00B7 \u2605 ' + s.rating, trail: h('button', { type: 'button', class: 'chip' + (has ? ' on' : ''), on: { click: function () { if (has) u.stops = u.stops.filter(function (x) { return x.id !== s.id; }); else u.stops.push(s); S.save(); UI.toast(has ? s.n + ' removed from your plan.' : s.n + ' added as a stop.', 'info'); draw(); } } }, has ? 'Added' : 'Add') }));
        });
      }
      draw();
    }
  });
  P.screen('R38', {
    title: 'No-network stretch ahead', back: 'R36',
    build: function (body, v) {
      var u = S.user(), route = legRoute(), stretch = Math.max(12, Math.round(route.km / 10));
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'p-hello' }, [h('span', { class: 'ic amber' }, ic('info')), h('div', { class: 'x-flex-1 p-left' }, [h('b', null, 'About ' + stretch + ' km with no mobile network'), h('div', { class: 'xs' }, route.from + ' \u2192 ' + route.to + ', around km ' + Math.round(route.km * 0.55))])]), P.progress(88), h('span', { class: 'xs' }, '88% of this route has coverage.')]));
      body.appendChild(P.list([
        P.row({ icon: 'download', tone: 'brand', title: 'Download offline pack', sub: 'Map, tickets and contacts \u00B7 about 38 MB', chev: true, go: 'R39' }),
        P.row({ icon: 'pin', title: 'Stop before the stretch', sub: 'See food, fuel and stays near km ' + Math.round(route.km * 0.5), chev: true, go: 'R37' }),
        P.row({ icon: 'users', title: 'Auto check-in', sub: 'Contacts are alerted if you miss a check-in', trail: P.toggle(u.prefs.checkin !== false, function (on) { u.prefs.checkin = on; S.save(); UI.toast(on ? 'Auto check-in on: your contacts are alerted if you go quiet.' : 'Auto check-in off.', 'info'); }, 'Auto check-in') })]));
      body.appendChild(P.btn('Set up my backup plan', '', function () { UI.go('R39'); }));
    }
  });
  P.screen('R39', {
    title: 'Offline pack & backup plan', back: 'R38',
    reset: function (v) { if (v.t) clearInterval(v.t); v.t = null; },
    build: function (body, v) {
      var u = S.user(), route = legRoute(), key = route.from + '>' + route.to; u.offline = u.offline || {}; var done = !!u.offline[key];
      body.appendChild(h('div', { class: 'card-m' }, [h('b', null, 'Offline pack: ' + route.from + ' \u2192 ' + route.to), h('span', { class: 'xs' }, 'Route map, your tickets with QR codes, stops list and emergency contacts.')]));
      var bar = P.progress(done ? 100 : 0), st = h('div', { class: 'xs' }, done ? 'Downloaded and ready.' : 'Not downloaded yet.');
      body.appendChild(bar); body.appendChild(st);
      var dl = P.btn(done ? 'Downloaded' : 'Download pack (38 MB)', done ? 'ghost' : '', function () {
        if (v.t || done) return; dl.disabled = true; var step = 0;
        v.t = setInterval(function () { step += 10 + Math.random() * 12; if (step >= 100) { step = 100; clearInterval(v.t); v.t = null; u.offline[key] = true; S.save(); dl.textContent = 'Downloaded'; dl.classList.add('ghost'); st.textContent = 'Downloaded and ready.'; S.notify(u, 'Offline pack ready', route.from + ' \u2192 ' + route.to, 'Updates'); } else st.textContent = 'Downloading... ' + Math.round(step) + '% (' + Math.round(step * 0.38) + ' of 38 MB)'; bar.set(step); }, 350);
      });
      body.appendChild(dl);
      body.appendChild(P.sec('BACKUP PLAN'));
      body.appendChild(P.list([P.row({ icon: 'phone', title: 'Share trip by SMS if offline', sub: u.emergency.length ? 'To ' + u.emergency.map(function (c) { return c.name; }).join(', ') : 'Add an emergency contact first', trail: P.toggle(u.prefs.share !== false, function (on) { u.prefs.share = on; S.save(); }, 'SMS fallback') }), P.row({ icon: 'shield', title: 'SOS works by SMS', sub: 'Sends your last known location' })]));
      if (!u.emergency.length) body.appendChild(P.btn('Add emergency contact', 'soft sm', function () { UI.go('R24'); }));
      body.appendChild(h('div', { class: 'fill' })); body.appendChild(P.btn('Done', '', function () { UI.go('R40'); }));
    }
  });
  P.screen('R40', {
    title: 'Travelling offline', back: 'R36',
    build: function (body) {
      var u = S.user(), tix = u.bookings.filter(function (b) { return /Confirmed/.test(b.status) && PLAN_TYPES.indexOf(b.type) >= 0 && (!b.when || b.when > Date.now() - 86400000); }).slice(0, 3);
      body.appendChild(P.banner('warn', 'You are in offline mode (simulated). Tickets and the map below work without network.', 'info'));
      if (!tix.length) body.appendChild(P.empty('No confirmed tickets to show offline yet.', 'bus'));
      tix.forEach(function (b) { body.appendChild(h('div', { class: 'card-m center' }, [h('b', null, b.title), h('span', { class: 'xs' }, b.sub + (b.when ? ' \u00B7 ' + P.fdt(b.when) : '')), P.qr(b.code || b.id), h('span', { class: 'xs' }, 'Show to the conductor / driver \u00B7 ' + (b.code || b.id))])); });
      body.appendChild(P.btn('SOS by SMS', 'danger', function () { exec('sos.raise', {}, null, { instant: true }).then(function (r) { if (r && r.ok) UI.toast(r.queued ? 'SOS saved and will be sent by SMS the moment there is signal.' : 'SOS recorded: ' + (r.incidentId || '') + ' (simulated).', 'warn'); }); }));
      body.appendChild(P.btn('Back to my plan', 'ghost', function () { UI.go('R36'); }));
    }
  });

  // ------------------------------------------------------------ hotels
  var HCITIES = ['Mysuru', 'Hyderabad', 'Bengaluru', 'Goa (Panaji)', 'Kochi', 'Chennai', 'Kozhikode', 'Pune', 'Tirupati'];
  var HN = [['Comfort Lodge', 1, ['Wi-Fi', 'AC']], ['Heritage View Hotel', 2, ['Breakfast', 'Wi-Fi', 'Family']], ['Garden Homestay', 2, ['Breakfast', 'Family', 'Garden']], ['Palace Road Resort', 3, ['Pool', 'Breakfast', 'Spa']], ['City Centre Inn', 2, ['Wi-Fi', 'AC']], ['Lakeside Residency', 3, ['Pool', 'Wi-Fi', 'Breakfast']], ['Budget Stay Plus', 1, ['Wi-Fi']], ['The Grand Orchid', 3, ['Pool', 'Spa', 'Breakfast', 'Family']]];
  P.hotelsFor = function (cityName) {
    var rnd = P.seeded(cityName);
    return HN.map(function (x, i) { var price = [1200, 2800, 3600, 7200][x[1]] * (0.85 + rnd() * 0.4); return { id: cityName + i, n: x[0], city: cityName, stars: x[1] + 2, price: Math.round(price / 50) * 50 * 100, rating: (3.8 + rnd() * 1.1).toFixed(1), dist: Math.round((0.3 + rnd() * 5) * 10) / 10, tags: x[2], reviews: 80 + Math.floor(rnd() * 900) }; });
  };
  P.hq = { city: 'Mysuru', cin: '', cout: '', guests: 2, rooms: 1 };
  P.screen('R41', {
    title: 'Hotels', back: 'R29',
    reset: function (v) { var q = P.hq; if (!q.cin || P.parseIso(q.cin) < P.startOfDay(Date.now())) { q.cin = tomorrow(); q.cout = P.isoDate(Date.now() + 3 * 86400000); } v.filters = []; v.sort = 'Price'; },
    build: function (body, v) {
      var q = P.hq; body.appendChild(P.field({ name: 'city', label: 'City', select: HCITIES, value: q.city, on: { change: function () { q.city = UI.val('city'); draw(); } } }));
      body.appendChild(h('div', { class: 'row2' }, [P.field({ name: 'cin', label: 'Check-in', type: 'date', value: q.cin, min: P.isoDate(Date.now()), on: { change: function () { q.cin = UI.val('cin'); check(); } } }), P.field({ name: 'cout', label: 'Check-out', type: 'date', value: q.cout, min: P.isoDate(Date.now()), on: { change: function () { q.cout = UI.val('cout'); check(); } } })]));
      body.appendChild(h('div', { class: 'row2' }, [h('div', { class: 'kv' }, [h('span', null, 'Guests'), P.stepper(q.guests, function (n) { q.guests = n; draw(); }, 1, 8)]), h('div', { class: 'kv' }, [h('span', null, 'Rooms'), P.stepper(q.rooms, function (n) { q.rooms = n; draw(); }, 1, 4)])]));
      body.appendChild(P.chips(['Near bus stand', 'Budget', 'Pool', 'Family', 'Breakfast'], [], function (f) { v.filters = f; draw(); }, true));
      body.appendChild(P.chips(['Price', 'Rating', 'Distance'], v.sort, function (s) { v.sort = s; draw(); }));
      var info = h('div', { class: 'xs' }), list = h('div', { class: 'list' }); body.appendChild(info); body.appendChild(list);
      function nights() { return Math.round((P.parseIso(q.cout) - P.parseIso(q.cin)) / 86400000); }
      function check() { P.clearErrors(); var n = nights(); if (!(n >= 1)) { UI.fieldError('cout', 'Check-out must be after check-in.'); return false; } if (n > 30) { UI.fieldError('cout', 'Stays are limited to 30 nights.'); return false; } draw(); return true; }
      function draw() {
        P.clear(list); var n = nights(); if (!(n >= 1 && n <= 30)) { info.textContent = ''; return; }
        var hs = P.hotelsFor(q.city).filter(function (x) { return v.filters.every(function (f) { return f === 'Near bus stand' ? x.dist <= 1.5 : f === 'Budget' ? x.price <= 200000 : x.tags.indexOf(f) >= 0; }); });
        hs.sort(function (a, b) { return v.sort === 'Price' ? a.price - b.price : v.sort === 'Rating' ? b.rating - a.rating : a.dist - b.dist; });
        info.textContent = hs.length + ' stays in ' + q.city + ' \u00B7 ' + n + ' night' + (n > 1 ? 's' : '') + ' \u00B7 ' + q.guests + ' guest' + (q.guests > 1 ? 's' : '');
        if (!hs.length) list.appendChild(P.empty('No stays match these filters. Remove a filter.', 'bed'));
        hs.forEach(function (x) { list.appendChild(P.row({ icon: 'bed', tone: 'blue', title: x.n + ' ' + '\u20B9'.repeat(Math.min(3, x.stars - 2)), sub: x.dist + ' km from bus stand \u00B7 \u2605 ' + x.rating + ' (' + x.reviews + ') \u00B7 ' + x.tags.join(', '), right: rs(x.price) + '/night', rightKind: 'info', chev: true, onClick: function () { if (!check()) return; P.nav.hotel = x; UI.go('R42'); } })); });
      }
      draw();
    }
  });
  P.screen('R42', {
    title: 'Hotel details', back: 'R41',
    reset: function (v) { v.room = 0; },
    build: function (body, v) {
      var x = P.nav.hotel, q = P.hq, u = S.user(); if (!x) { UI.go('R41', { replace: true }); return; }
      var nights = Math.max(1, Math.round((P.parseIso(q.cout) - P.parseIso(q.cin)) / 86400000));
      body.appendChild(h('div', { class: 'p-photo' }, x.n + ' (photo placeholder)'));
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('b', { class: 'h2' }, x.n), h('span', { class: 'p-rate' }, '\u2605 ' + x.rating)]), h('div', { class: 'xs' }, x.dist + ' km from the bus stand, ' + x.city + ' \u00B7 ' + x.reviews + ' reviews'), h('div', { class: 'chips' }, x.tags.map(function (t) { return h('span', { class: 'chip' }, t); }))]));
      var rooms = [['Deluxe double', 1, 'Breakfast included'], ['Palace-view room', 1.35, 'Breakfast, balcony view'], ['Family suite', 1.9, 'Sleeps 4, breakfast']], list = h('div', { class: 'p-opts' }), sum = h('div', { class: 'card-m' }), btn;
      body.appendChild(P.sec('CHOOSE A ROOM')); body.appendChild(list); body.appendChild(sum);
      body.appendChild(P.field({ name: 'gname', label: 'Guest name', value: u.name, maxlength: 40 }));
      body.appendChild(P.field({ name: 'gphone', label: 'Contact number', type: 'tel', inputmode: 'numeric', value: u.phone, maxlength: 12 }));
      body.appendChild(P.field({ name: 'greq', label: 'Special requests (optional)', area: true, rows: 2, maxlength: 160 }));
      function price() { var per = Math.round(x.price * rooms[v.room][1] / 5000) * 5000, sub = per * nights * q.rooms, d = P.discount('hotel', sub), taxable = sub - d.paise, tax = Math.round(taxable * 0.12); return { per: per, sub: sub, tax: tax, disc: d.paise, code: d.code, why: d.why, total: taxable + tax }; }
      function paint() {
        P.clear(list); rooms.forEach(function (r, i) { var per = Math.round(x.price * r[1] / 5000) * 5000; list.appendChild(P.opt({ title: r[0], sub: r[2], price: rs(per), on: i === v.room, onClick: function () { v.room = i; paint(); } })); });
        var p = price(); P.clear(sum); sum.appendChild(P.kv(q.rooms + ' room' + (q.rooms > 1 ? 's' : '') + ' \u00D7 ' + nights + ' night' + (nights > 1 ? 's' : ''), rs(p.sub))); sum.appendChild(P.kv(P.fdate(P.parseIso(q.cin)) + ' \u2192 ' + P.fdate(P.parseIso(q.cout)), q.guests + ' guests'));
        if (p.disc) sum.appendChild(P.kv('Coupon ' + p.code, '-' + rs(p.disc))); else if (p.why) sum.appendChild(h('div', { class: 'xs' }, p.why));
        sum.appendChild(P.kv('Taxes (12%)', rs(p.tax))); sum.appendChild(h('div', { class: 'hr' })); sum.appendChild(h('div', { class: 'kv' }, [h('b', null, 'Total'), h('b', { class: 'x-font-size-18px' }, rs(p.total))]));
        btn.textContent = 'Book \u00B7 ' + rs(p.total);
      }
      btn = P.btn('', '', function () {
        P.clearErrors(); var nm = UI.val('gname').trim(), ph = UI.val('gphone'), bad = false;
        if (nm.length < 2) { UI.fieldError('gname', 'Enter the guest name.'); bad = true; } if (!S.validPhone(ph)) { UI.fieldError('gphone', 'Enter a valid 10-digit mobile number.'); bad = true; } if (bad) return;
        var p = price(), when = P.parseIso(q.cin) + 14 * 3600000;
        P.checkout({ title: x.n + ', ' + x.city, paise: p.sub + Math.round(p.sub * 0.12), cat: 'hotel', allow: ['Wallet', 'UPI', 'Card', 'Cash'], booking: { type: 'hotel', title: x.n, sub: rooms[v.room][0] + ' \u00B7 ' + nights + ' night' + (nights > 1 ? 's' : '') + ' \u00B7 ' + q.guests + ' guests', when: when, details: [['Hotel', x.n + ', ' + x.city], ['Room', rooms[v.room][0] + ' \u00D7 ' + q.rooms], ['Check-in', P.fdate(P.parseIso(q.cin)) + ' from 2:00 PM'], ['Check-out', P.fdate(P.parseIso(q.cout)) + ' by 11:00 AM'], ['Guest', nm + ' \u00B7 ' + ph], ['Requests', UI.val('greq') || 'None']] } });
      });
      body.appendChild(btn);
      body.appendChild(P.btn('Add to trip plan (book later)', 'ghost sm', function () { var p = price(); S.addBooking({ type: 'hotel', title: x.n, sub: rooms[v.room][0] + ' \u00B7 ' + nights + ' night' + (nights > 1 ? 's' : ''), when: P.parseIso(q.cin) + 14 * 3600000, paise: p.total, status: 'Planned', details: [['Hotel', x.n + ', ' + x.city], ['Dates', P.fdate(P.parseIso(q.cin)) + ' \u2192 ' + P.fdate(P.parseIso(q.cout))]] }); UI.toast('Added to your trip plan.', 'info'); UI.go('R36'); }));
      paint();
    }
  });

  // ------------------------------------------------------------ R43 rentals
  var RENT = {
    'Cars': [['Hatchback \u00B7 manual', 'Maruti Swift', 180000, 400000, '200 km/day', 'car'], ['Compact SUV \u00B7 automatic', 'Hyundai Creta', 320000, 600000, '250 km/day', 'car2'], ['Sedan \u00B7 manual', 'Honda City', 260000, 500000, '250 km/day', 'car'], ['Electric hatchback', 'Tata Tiago EV', 240000, 500000, '180 km/day', 'bolt']],
    'Bikes & scooters': [['Scooter 110cc', 'Honda Activa \u00B7 2 helmets', 45000, 100000, '100 km/day', 'bike'], ['350cc cruiser bike', 'Royal Enfield Classic', 110000, 300000, '150 km/day', 'bike'], ['Electric scooter', 'Ather 450', 70000, 150000, '80 km/day', 'bolt'], ['Commuter 125cc', 'Hero Glamour', 55000, 120000, '120 km/day', 'bike']],
    'With driver': [['Hatchback + driver', 'Maruti Swift \u00B7 8 hours', 150000, 0, '80 km included', 'car'], ['SUV + driver', 'Toyota Innova \u00B7 8 hours', 300000, 0, '80 km included', 'car2'], ['Sedan + driver', 'Honda City \u00B7 8 hours', 210000, 0, '80 km included', 'car']]
  };
  P.screen('R43', {
    title: 'Car & bike rentals', back: 'R29',
    reset: function (v) { v.tab = P.nav.rentTab || 'Cars'; v.city = P.nav.rentCity || 'Hyderabad'; P.nav.rentTab = P.nav.rentCity = null; v.days = 2; v.date = tomorrow(); v.deliver = false; },
    build: function (body, v) {
      body.appendChild(P.chips(['Cars', 'Bikes & scooters', 'With driver'], v.tab, function (t) { v.tab = t; draw(); }));
      body.appendChild(P.field({ name: 'rcity', label: 'City', select: CITIES.map(function (c) { return c.n; }), value: v.city, on: { change: function () { v.city = UI.val('rcity'); } } }));
      body.appendChild(h('div', { class: 'row2' }, [P.field({ name: 'rdate', label: 'Pick-up date', type: 'date', value: v.date, min: P.isoDate(Date.now()), on: { change: function () { v.date = UI.val('rdate'); } } }), h('div', { class: 'inp' }, [h('label', null, 'Days'), P.stepper(v.days, function (n) { v.days = n; draw(); }, 1, 14)])]));
      body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Deliver to my address (+\u20B999)'), P.toggle(false, function (on) { v.deliver = on; draw(); }, 'Delivery')]));
      var list = h('div', { class: 'list' }); body.appendChild(list);
      function draw() {
        P.clear(list);
        RENT[v.tab].forEach(function (r) {
          var days = v.tab === 'With driver' ? 1 : v.days, total = r[2] * days + (v.deliver ? 9900 : 0);
          list.appendChild(P.row({ icon: r[5], tone: 'blue', title: r[0], sub: r[1] + ' \u00B7 ' + r[4] + (r[3] ? ' \u00B7 deposit ' + rs(r[3]) : ''), right: rs(r[2]) + (v.tab === 'With driver' ? '' : '/day'), rightKind: 'info', chev: true, onClick: function () { book(r, total, days); } }));
        });
      }
      function book(r, total, days) {
        P.clearErrors(); var date = UI.val('rdate') || v.date;
        if (!P.parseIso(date) || P.parseIso(date) < P.startOfDay(Date.now())) { UI.fieldError('rdate', 'Choose a pick-up date from today onwards.'); UI.toast('Choose a pick-up date from today onwards.', 'error'); return; }
        var self = v.tab !== 'With driver';
        P.sheet(r[0], function (b, api) {
          b.appendChild(P.kv('Vehicle', r[1])); b.appendChild(P.kv('Pick-up', P.fdate(P.parseIso(date)) + ', ' + v.city)); b.appendChild(P.kv(self ? 'Rental' : 'Package', days + (self ? ' day' + (days > 1 ? 's' : '') : ' day (8 h)') + ' \u00B7 ' + rs(total)));
          if (r[3]) b.appendChild(P.kv('Refundable deposit', rs(r[3])));
          if (self) b.appendChild(P.field({ name: 'dl', label: 'Driving licence number *', maxlength: 18, placeholder: 'e.g. TS09 20110012345' }));
          b.appendChild(P.btn('Continue to pay \u00B7 ' + rs(total + r[3]), '', function () {
            P.clearErrors(); var dl = UI.val('dl').toUpperCase().replace(/[\s-]/g, '');
            if (self && !/^[A-Z]{2}\d{2}\d{4,11}$/.test(dl)) { UI.fieldError('dl', 'Enter a valid licence number (e.g. TS0920110012345).'); return; }
            api.close(); P.checkout({ title: r[0] + ' \u00B7 ' + v.city, paise: total + r[3], cat: 'rental', allow: ['Wallet', 'UPI', 'Card'], booking: { type: 'rental', title: r[0], sub: r[1] + ' \u00B7 ' + days + ' day' + (days > 1 ? 's' : '') + ' \u00B7 ' + v.city, when: P.parseIso(date) + 9 * 3600000, details: [['Vehicle', r[1]], ['City', v.city], ['Pick-up', P.fdate(P.parseIso(date)) + ', 9:00 AM'], ['Duration', days + (self ? ' day(s)' : ' day (8 h)')], ['Deposit', r[3] ? rs(r[3]) + ' (refunded on return)' : 'None'], ['Licence', self ? 'Verified: ending ' + dl.slice(-4) : 'Driver provided'], ['Delivery', v.deliver ? 'To your address' : 'Collect from the partner']] } });
          }));
        });
      }
      draw();
    }
  });

  // ------------------------------------------------------------ R50 price alert
  P.screen('R50', {
    title: 'Flexible: price alert', back: 'R49',
    reset: function (v) { v.win = 'Next 7 days'; v.notify = true; },
    build: function (body, v) {
      var u = S.user(), lt = P.lt, names = CITIES.map(function (c) { return c.n; });
      body.appendChild(P.banner('info', 'Tell us the price you want. We watch fares and notify you when a bus or shared seat drops to it.', 'bell'));
      body.appendChild(h('div', { class: 'row2' }, [P.field({ name: 'afrom', label: 'From', select: names, value: lt.from, on: { change: function () { now(); } } }), P.field({ name: 'ato', label: 'To', select: names, value: lt.to, on: { change: function () { now(); } } })]));
      var cur = h('div', { class: 'xs' });
      function now() { var f = UI.val('afrom'), t = UI.val('ato'); var km = roadKm(f, t); var cheapest = Math.round(km * 1.1 / 5) * 5; cur.textContent = f !== t ? 'Typical cheapest fare today: ' + rs(cheapest * 100) + ' (' + km + ' km)' : ''; return cheapest * 100; }
      body.appendChild(cur);
      body.appendChild(P.field({ name: 'aprice', label: 'Alert me at or below (\u20B9)', type: 'tel', inputmode: 'numeric', prefix: P.RUP, maxlength: 5, placeholder: 'e.g. 450' }));
      body.appendChild(h('div', { class: 'inp' }, [h('label', null, 'Travel window'), P.chips(['Next 7 days', 'Next 14 days', 'Next 30 days'], v.win, function (w) { v.win = w; })]));
      body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Notify me in the app'), P.toggle(true, function (on) { v.notify = on; }, 'Notify')]));
      now();
      body.appendChild(P.btn('Start watching', '', function () {
        P.clearErrors(); var f = UI.val('afrom'), t = UI.val('ato'), p = parseInt(UI.val('aprice').replace(/\D/g, ''), 10), base = now(), bad = false;
        if (f === t) { UI.fieldError('ato', 'Choose a different destination.'); bad = true; }
        if (!p || p < 50) { UI.fieldError('aprice', 'Enter a target price of at least \u20B950.'); bad = true; } else if (p * 100 >= base * 1.5) { UI.fieldError('aprice', 'This is already above today\'s fares. Try a lower price.'); bad = true; }
        if (bad) return;
        u.alerts.push({ id: S.uid('AL'), from: f, to: t, paise: p * 100, win: v.win, notify: v.notify, at: Date.now(), fireAt: Date.now() + 20000 + Math.random() * 15000, fired: false }); S.save();
        UI.toast('Watching ' + f + ' \u2192 ' + t + ' for ' + rs(p * 100) + '. We will notify you.', 'info'); v.draw();
      }));
      if (u.alerts.length) { body.appendChild(P.sec('YOUR ALERTS')); body.appendChild(P.list(u.alerts.map(function (a, i) { return P.row({ icon: 'bell', tone: a.fired ? 'brand' : 'amber', title: a.from + ' \u2192 ' + a.to, sub: 'Target ' + rs(a.paise) + ' \u00B7 ' + a.win, right: a.fired ? 'Price hit' : 'Watching', rightKind: a.fired ? 'ok' : 'info', trail: h('button', { type: 'button', class: 'ib', 'aria-label': 'Remove alert', on: { click: function () { var gone = u.alerts.splice(i, 1)[0]; S.save(); v.draw(); P.undo('Price alert removed.', function () { u.alerts.splice(i, 0, gone); S.save(); v.draw(); }); } } }, ic('trash', 14)) }); }))); }
    }
  });
  P.every(function () {
    var u = S.user(); if (!u) return;
    u.alerts.forEach(function (a) {
      if (a.fired || Date.now() < a.fireAt) return; a.fired = true; var dropTo = Math.max(5000, Math.round(a.paise * 0.97 / 500) * 500);
      if (a.notify) S.notify(u, 'Price alert: ' + a.from + ' \u2192 ' + a.to, 'A seat is now ' + rs(dropTo) + ', at or below your ' + rs(a.paise) + ' target. Tap to book.', 'Offers', 'R33'); S.save();
    });
  });
})();