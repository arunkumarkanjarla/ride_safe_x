/* RideNova Customer app - city rides (working screens).
   R07 ride home (map kept), R59 bike taxi / auto, R08 destination search, R31 compare, R09 options & fare, R10 confirm & pay,
   R12/R15 live details, R13 masked call, R14 chat, R17 trip complete, R19 invoice, R55 where your money went, R23 schedule. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.store, P = RN.product, h = P.h, ic = P.ic, rs = P.rs;
  var exec = K.exec;

  // ------------------------------------------------------------ places and fares
  var PLACES = [
    ['Hitec City Metro Station', 'Madhapur', 17.4435, 78.3772], ['Hitec City Cyber Towers', 'Madhapur', 17.4506, 78.381], ['Hitex Exhibition Centre', 'Izzat Nagar', 17.472, 78.377],
    ['Rajiv Gandhi Intl Airport', 'Shamshabad', 17.2403, 78.4294], ['Inorbit Mall', 'Madhapur', 17.4339, 78.386], ['Secunderabad Railway Station', 'Secunderabad', 17.4337, 78.5013],
    ['Charminar', 'Old City', 17.3616, 78.4747], ['Gachibowli Stadium', 'Gachibowli', 17.4401, 78.3489], ['Jubilee Hills Check Post', 'Jubilee Hills', 17.4326, 78.4071],
    ['Kukatpally Housing Board', 'Kukatpally', 17.4948, 78.3996], ['Begumpet Airport Road', 'Begumpet', 17.4399, 78.4983], ['Ameerpet Metro', 'Ameerpet', 17.4375, 78.4483],
    ['LB Nagar Metro', 'LB Nagar', 17.3457, 78.5522], ['Mehdipatnam Bus Stop', 'Mehdipatnam', 17.395, 78.439], ['Hussain Sagar Lake', 'Tank Bund', 17.4239, 78.4738],
    ['Golconda Fort', 'Golconda', 17.3833, 78.4011], ['Financial District', 'Nanakramguda', 17.4177, 78.343], ['Jubilee Bus Station (JBS)', 'Secunderabad', 17.4503, 78.4994],
    ['Mahatma Gandhi Bus Station', 'Gowliguda', 17.3787, 78.4837], ['Banjara Hills Road 1', 'Banjara Hills', 17.4156, 78.4347], ['Apollo Hospital', 'Jubilee Hills', 17.4172, 78.4116], ['Kondapur Botanical Garden', 'Kondapur', 17.4605, 78.3616]
  ].map(function (p) { return { n: p[0], a: p[1], lat: p[2], lon: p[3] }; });
  P.PLACES = PLACES;
  var HOME_PICKUP = { n: 'Gate 2, Lumbini Apartments', a: 'Road 12, Banjara Hills', lat: 17.4126, lon: 78.4482 };
  function hav(a, b) { var R = 6371, rad = Math.PI / 180, dLa = (b.lat - a.lat) * rad, dLo = (b.lon - a.lon) * rad, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.asin(Math.sqrt(x)); }
  P.hav = hav;
  function textPlace(text) {
    var t = String(text).trim(), m = PLACES.filter(function (p) { return p.n.toLowerCase() === t.toLowerCase(); })[0]; if (m) return m;
    var r = P.seeded(t.toLowerCase()); return { n: t, a: 'Hyderabad', lat: 17.35 + r() * 0.15, lon: 78.34 + r() * 0.2, custom: true };
  }
  P.pickup = function () { var u = S.user(); return u && u.saved.home ? Object.assign({}, HOME_PICKUP, { a: u.saved.home.area }) : Object.assign({}, HOME_PICKUP); };
  P.trip = { pickup: null, drop: null, vehicle: 'Cab', pay: 'UPI', extras: [], label: '' };
  function legOf(drop) { var from = P.pickup(), km = Math.max(1.2, Math.round(hav(from, drop) * 1.3 * 10) / 10); return { km: km, mins: Math.max(6, Math.round(km / 24 * 60 + 4)) }; }
  var VEH = {
    Bike: { icon: 'bike', base: 20, km: 6.5, min: 0.8, eta: 2, seats: 1, note: 'Helmet provided \u00B7 1 seat' },
    Auto: { icon: 'auto', base: 30, km: 11, min: 1, eta: 4, seats: 3, note: 'Metered fare \u00B7 3 seats' },
    Cab: { icon: 'car', base: 50, km: 14.5, min: 1.5, eta: 3, seats: 4, note: 'AC \u00B7 4 seats' },
    Premium: { icon: 'car2', base: 80, km: 21, min: 2.2, eta: 6, seats: 4, note: 'Top-rated drivers \u00B7 sedan' }
  };
  P.VEH = VEH;
  function surgeNow() { var hr = new Date().getHours(); return (hr >= 8 && hr < 10) || (hr >= 17 && hr < 20) ? 1.2 : 1; }
  // quote for a vehicle on the current trip; amounts in paise, lines add up to the total exactly
  P.quote = function (trip, vehicle, extras, opts) {
    opts = opts || {}; var v = VEH[vehicle] || VEH.Cab, leg = legOf(trip.drop), surge = surgeNow(), lines = [];
    var base = Math.round(v.base * 100 * (opts.factor || 1)), dist = Math.round(leg.km * v.km * 100 * (opts.factor || 1)), time = Math.round(leg.mins * v.min * 100 * (opts.factor || 1));
    lines.push(['Base fare', base], ['Distance ' + leg.km + ' km', dist], ['Time ' + leg.mins + ' min', time]);
    var pre = base + dist + time;
    if (surge > 1) { var s = Math.round(pre * (surge - 1)); lines.push(['High demand ' + surge + 'x', s]); pre += s; }
    (extras || []).forEach(function (x) { var amt = { 'Extra luggage': 4000, 'Pet friendly': 3000, 'Prefer woman driver': 0, 'Trip insurance': 500 }[x] || 0; if (amt) { lines.push([x, amt]); pre += amt; } });
    var d = P.discount('ride', pre), disc = 0, code = '';
    if (d.paise) { disc = d.paise; code = d.code; lines.push(['Coupon ' + code, -disc]); }
    var tax = Math.round((pre - disc) * 0.05); lines.push(['Taxes (GST 5%)', tax]);
    var total = pre - disc + tax;
    return { total: total, lines: lines, km: leg.km, mins: leg.mins, eta: v.eta, surge: surge, discount: disc, code: code, why: d.why, tax: tax };
  };
  function setDrop(place) { P.trip.pickup = P.pickup(); P.trip.drop = place; }

  // generic place search box + results. opts: {placeholder, onPick(place), exclude}
  P.placePicker = function (opts) {
    var wrap = h('div', { class: 'p-picker' }), list = h('div', { class: 'list' }), u = S.user();
    var box = P.search(opts.placeholder || 'Search places', draw), input = UI.q('input', box);
    wrap.appendChild(box); wrap.appendChild(list);
    function row(p, sub, icon) { return P.row({ icon: icon || 'pin', title: p.n, sub: sub || (p.a + ' \u00B7 ' + legOf(p).km + ' km'), chev: true, onClick: function () { opts.onPick(p); } }); }
    function draw(q) {
      P.clear(list); q = String(q || '').trim().toLowerCase();
      var saved = [];
      if (u.saved.home) saved.push([{ n: u.saved.home.area, a: 'Home', custom: true }, 'Home', 'home']);
      if (u.saved.work) saved.push([{ n: u.saved.work.area, a: 'Work', custom: true }, 'Work', 'pin']);
      u.saved.other.forEach(function (o) { saved.push([{ n: o.area, a: o.name, custom: true }, o.name, 'pin']); });
      if (!q) {
        saved.forEach(function (s) { var p = textPlace(s[0].n); p.a = s[1]; list.appendChild(row(p, s[1] + ' \u00B7 ' + legOf(p).km + ' km', s[2])); });
        var recent = u.bookings.filter(function (b) { return b.type === 'ride' && b.dropName; }).slice(0, 3).map(function (b) { return b.dropName; });
        recent.forEach(function (n) { var p = PLACES.filter(function (x) { return x.n === n; })[0]; if (p) list.appendChild(row(p, 'Recent \u00B7 ' + legOf(p).km + ' km', 'clock')); });
        PLACES.slice(0, 6).forEach(function (p) { list.appendChild(row(p)); });
        return;
      }
      var hits = PLACES.filter(function (p) { return (p.n + ' ' + p.a).toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
      hits.forEach(function (p) { list.appendChild(row(p)); });
      if (!hits.length) list.appendChild(P.empty('No places match "' + input.value.trim() + '".', 'search'));
      if (q.length >= 3 && !hits.some(function (p) { return p.n.toLowerCase() === q; })) list.appendChild(row(textPlace(input.value.trim()), 'Use this address as typed', 'pin'));
    }
    draw(''); wrap.input = input; wrap.draw = draw; return wrap;
  };

  // ------------------------------------------------------------ R07 ride home (map screen kept, content made live)
  function gotoOptions() { UI.go(RN.engine_priority_is_bal() ? 'R09' : 'R31'); }
  RN.engine_priority_is_bal = function () { return !UI.engine || UI.engine.state.rider.priority === 'bal'; };
  K.extend('R07', {
    init: function () {
      var u = S.user(); if (!u) return;
      var b = UI.q('#mock .floating b'); if (b) b.textContent = P.firstName(u);
      var g = UI.q('#mock .floating .xs'); if (g) g.textContent = P.hello();
      var list = UI.q('#mock .list'); if (!list) return;
      P.clear(list);
      var rows = [['Home', u.saved.home, 'home'], ['Work', u.saved.work, 'pin']];
      rows.forEach(function (r) {
        list.appendChild(h('div', { class: 'li', role: 'button', tabindex: '0', 'data-do': 'x.destination', 'data-arg': r[0] }, [h('span', { class: 'ic ' + (r[0] === 'Home' ? 'brand' : '') }, ic(r[2])), h('span', { class: 'tx' }, [h('b', null, r[0]), h('span', null, r[1] ? r[1].area : 'Tap to add ' + r[0].toLowerCase())])]));
      });
      var coup = UI.q('#mock .banner.warn'); if (coup) { var c = u.coupon && P.coupon(u.coupon); if (c) coup.lastChild.textContent = c.code + ' \u00B7 ' + c.title; }
    },
    actions: {
      destination: function (n, arg) {
        var u = S.user(), sp = arg === 'Home' ? u.saved.home : arg === 'Work' ? u.saved.work : null;
        if (!sp) { UI.toast('Add your ' + String(arg).toLowerCase() + ' address in Account > Saved places.', 'info'); UI.go('R28'); return false; }
        var p = textPlace(sp.area); p.a = arg; setDrop(p); P.trip.vehicle = 'Cab'; gotoOptions(); return false;
      },
      vehicle: function (n) {
        var label = ((UI.q('.xs', n.parentElement) || {}).textContent || 'Cab').trim(); P.trip.vehicle = VEH[label] ? label : 'Cab';
        P.trip.pickup = P.pickup(); if (!P.trip.drop) { UI.toast('Where to? Choose a destination first.', 'info'); UI.go('R08'); return false; }
        UI.go('R09'); return false;
      }
    }
  });
  // the 4 vehicle tiles and Where-to open real search instead of fixed screens
  document.addEventListener('DOMContentLoaded', function () {
    UI.qa('.rn-screen[data-sid="R07"] [data-do="x.vehicle"]').forEach(function (n) { n.removeAttribute('data-go'); });
  });

  // ------------------------------------------------------------ R59 bike taxi / auto
  var nearby = { n: 5 };
  P.screen('R59', {
    title: function () { return (P.nav.quick || 'Bike') === 'Auto' ? 'Auto rickshaw' : 'Bike taxi'; }, back: 'R29',
    reset: function (v) { v.veh = P.nav.quick === 'Auto' ? 'Auto' : 'Bike'; v.drop = null; v.pay = 'UPI'; },
    build: function (body, v) {
      var vv = VEH[v.veh], u = S.user();
      body.appendChild(h('div', { class: 'card-m brand' }, [h('div', { class: 'p-hello' }, [h('span', { class: 'ic' }, ic(vv.icon, 22)), h('div', { class: 'x-flex-1 p-left' }, [h('b', { class: 'h2' }, v.veh === 'Bike' ? 'Beat the traffic' : 'Metered autos, fair fares'), h('div', { class: 'xs p-near' }, nearby.n + ' ' + v.veh.toLowerCase() + 's nearby \u00B7 pickup in ' + vv.eta + ' min')])]), h('span', { class: 'xs' }, vv.note)]));
      body.appendChild(h('div', { class: 'card-m x-gap-0' }, [h('div', { class: 'loc' }, [h('span', { class: 'd' }), h('span', { class: 'tx' }, [h('b', null, 'Current location'), h('span', null, P.pickup().a)])])]));
      var out = h('div', { class: 'p-quote' });
      var picker = P.placePicker({ placeholder: 'Where to?', onPick: function (p) { v.drop = p; P.trip.drop = p; P.trip.pickup = P.pickup(); show(); } });
      body.appendChild(picker); body.appendChild(out);
      function show() {
        P.clear(out); if (!v.drop) return;
        P.trip.vehicle = v.veh; P.trip.drop = v.drop; var q = P.quote(P.trip, v.veh);
        out.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('b', null, v.drop.n), h('button', { type: 'button', class: 'chip', on: { click: function () { v.drop = null; show(); } } }, 'Change')]), P.kv('Distance', q.km + ' km \u00B7 about ' + q.mins + ' min'), P.kv('Pickup in', q.eta + ' min'), q.discount ? P.kv('Coupon ' + q.code, '-' + rs(q.discount), 'x-color-0b7a68') : null, q.why ? h('div', { class: 'xs' }, q.why) : null,
          h('div', { class: 'hr' }), h('div', { class: 'kv' }, [h('b', null, 'Estimated fare'), h('b', { class: 'x-font-size-18px' }, rs(q.total))])]));
        out.appendChild(h('div', { class: 'inp' }, [h('label', null, 'Pay with'), P.chips(['Wallet', 'UPI', 'Card', 'Cash'], v.pay, function (m) { v.pay = m; })]));
        out.appendChild(P.btn('Book ' + v.veh + ' \u00B7 ' + rs(q.total), '', function () {
          if (v.pay === 'Wallet' && u.walletPaise < q.total) { UI.toast('Your wallet has ' + rs(u.walletPaise) + '. Add money or pick another way to pay.', 'warn'); return; }
          P.trip.pay = v.pay; P.trip.extras = []; UI.go('R10');
        }));
        setTimeout(function () { out.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
      }
      v.show = show;
    },
    tick: function (v) { if (Math.random() < 0.08) { nearby.n = Math.max(2, Math.min(11, nearby.n + (Math.random() < 0.5 ? -1 : 1))); var n = UI.q('.p-near', v.body); if (n) n.textContent = nearby.n + ' ' + v.veh.toLowerCase() + 's nearby \u00B7 pickup in ' + VEH[v.veh].eta + ' min'; } }
  });

  // ------------------------------------------------------------ R08 destination search
  P.screen('R08', {
    title: 'Plan your ride', back: 'R07',
    build: function (body, v) {
      var from = P.pickup();
      body.appendChild(h('div', { class: 'card-m x-gap-0' }, [h('div', { class: 'loc' }, [h('span', { class: 'd' }), h('span', { class: 'tx' }, [h('b', null, 'Current location'), h('span', null, from.a)])])]));
      var pk = P.placePicker({ placeholder: 'Where to? Search a place or address', onPick: function (p) { setDrop(p); P.trip.extras = []; UI.toast('Destination: ' + p.n + '. Fares are estimates.', 'info'); UI.go(UI.engine.state.rider.priority === 'bal' ? 'R09' : 'R31'); } });
      body.appendChild(pk); setTimeout(function () { pk.input.focus(); }, 80);
    }
  });

  // ------------------------------------------------------------ R31 compare by priority, R09 options
  var PRIO = [['urgent', 'Urgent'], ['bal', 'Balanced'], ['saver', 'Saver'], ['flex', 'Flexible'], ['deals', 'Deals']];
  function options() {
    var t = P.trip, cab = P.quote(t, 'Cab'), mk = function (name, veh, factor, tag, extra) { var q = P.quote(t, veh, [], { factor: factor || 1 }); return { name: name, veh: veh, q: q, tag: tag || '', mins: Math.round(q.mins * (extra && extra.t || 1)), note: extra && extra.note || VEH[veh].note, eta: q.eta }; };
    return [mk('Shared cab', 'Cab', 0.58, 'CHEAPEST', { t: 1.25, note: 'Up to 2 co-riders \u00B7 small detour' }), mk('Bike taxi', 'Bike', 1, 'FAST', { t: 0.8 }), mk('Auto', 'Auto'), mk('Cab', 'Cab', 1, 'BEST VALUE'), mk('Premium', 'Premium')];
  }
  function ensureTrip() { if (!P.trip.drop) { setDrop(PLACES[0]); } if (!P.trip.pickup) P.trip.pickup = P.pickup(); }
  P.screen('R31', {
    title: 'Compare by priority', back: 'R08',
    reset: function (v) { ensureTrip(); v.prio = UI.engine.state.rider.priority; v.sel = null; v.extras = []; },
    build: function (body, v) {
      var t = P.trip; body.appendChild(h('div', { class: 'xs' }, P.pickup().a + ' \u2192 ' + t.drop.n));
      body.appendChild(P.chips(PRIO, v.prio, function (p) { v.prio = p; exec('rider.priority', { arg: p }, null, { instant: true }); draw(); }));
      var list = h('div', { class: 'p-opts' }); body.appendChild(list);
      body.appendChild(P.sec('ADD-ONS'));
      body.appendChild(P.chips(['Extra luggage', 'Pet friendly', 'Prefer woman driver', 'Trip insurance'], [], function (x) { v.extras = x; draw(); }, true));
      var btn = P.btn('Choose an option', '', function () { var o = v.cur; if (!o) return; t.vehicle = o.veh; t.label = o.name; t.extras = v.extras; t.factor = o.q && o.name === 'Shared cab' ? 0.58 : 1; UI.go('R10'); }); body.appendChild(btn);
      function draw() {
        P.clear(list); var os = options();
        os.forEach(function (o) { o.q = P.quote(t, o.veh, v.extras, { factor: o.name === 'Shared cab' ? 0.58 : 1 }); });
        var keyf = { urgent: function (a, b) { return a.mins - b.mins; }, saver: function (a, b) { return a.q.total - b.q.total; }, deals: function (a, b) { return b.q.discount - a.q.discount || a.q.total - b.q.total; }, flex: function (a, b) { return a.q.total - b.q.total; }, bal: function (a, b) { return (a.q.total * a.mins) - (b.q.total * b.mins); } }[v.prio];
        os.sort(keyf);
        if (!v.sel || !os.some(function (o) { return o.name === v.sel; })) v.sel = os[0].name;
        os.forEach(function (o) {
          var on = o.name === v.sel;
          list.appendChild(P.opt({ icon: VEH[o.veh].icon, title: o.name + (o.tag && o === os[0] ? '  ' + o.tag : ''), sub: o.mins + ' min \u00B7 ' + o.eta + ' min away', sub2: o.note, price: rs(o.q.total), on: on, onClick: function () { v.sel = o.name; draw(); } }));
          if (on) { v.cur = o; btn.textContent = 'Book ' + o.name + ' \u00B7 ' + rs(o.q.total); }
        });
      }
      draw();
    }
  });

  P.screen('R09', {
    title: function () { return P.trip.drop ? P.pickup().a.split(',')[0] + ' \u2192 ' + P.trip.drop.n : 'Choose a ride'; }, back: 'R08',
    reset: function (v) { ensureTrip(); v.veh = P.trip.vehicle && VEH[P.trip.vehicle] ? P.trip.vehicle : 'Cab'; v.pay = P.trip.pay || 'UPI'; },
    build: function (body, v) {
      var t = P.trip, active = UI.engine.activeRide();
      if (active) body.appendChild(P.banner('warn', 'You already have an active ride (' + K.label(active.state) + ').', 'car'));
      var leg = legOf(t.drop), surge = surgeNow();
      body.appendChild(h('div', { class: 'p-hello' }, [h('div', { class: 'x-flex-1 p-left' }, [h('b', { class: 'h2' }, 'Choose a ride'), h('div', { class: 'xs' }, leg.km + ' km \u00B7 about ' + leg.mins + ' min')]), surge > 1 ? h('a', { class: 'chip amber', href: '#/R55', 'data-go': 'R55' }, surge + 'x high demand') : null]));
      var list = h('div', { class: 'p-opts' }); body.appendChild(list);
      var book = P.btn('', '', function () {
        if (active) { UI.toast('You already have an active ride.', 'error'); UI.go(RN.engineLib.rideScreen(active)); return; }
        if (UI.engine.state.rider.debtPaise > 0) { UI.toast('Settle your unpaid fare first.', 'error'); UI.go('R17'); return; }
        t.vehicle = v.veh; t.label = v.veh; t.pay = v.pay; t.extras = []; t.factor = 1; UI.go('R10');
      });
      var payRow = h('div', { class: 'inp' }, [h('label', null, 'Pay with'), P.chips(['Wallet', 'UPI', 'Card', 'Cash'], v.pay, function (m) { v.pay = m; })]);
      var coup = h('a', { class: 'chip', href: '#/R22', 'data-go': 'R22' }, [ic('percent', 14), ' ' + (S.user().coupon || 'Apply coupon')]);
      body.appendChild(payRow); body.appendChild(h('div', null, coup)); body.appendChild(book);
      function draw() {
        P.clear(list);
        Object.keys(VEH).forEach(function (name) {
          var q = P.quote(t, name), on = name === v.veh;
          list.appendChild(P.opt({ icon: VEH[name].icon, title: name, sub: q.eta + ' min away \u00B7 ' + VEH[name].note, sub2: q.discount ? 'Coupon ' + q.code + ' saves ' + rs(q.discount) : '', price: rs(q.total), on: on, onClick: function () { v.veh = name; draw(); } }));
          if (on) book.textContent = 'Book ' + name + ' \u00B7 ' + rs(q.total);
        });
      }
      draw();
    }
  });

  // ------------------------------------------------------------ R10 confirm pickup and pay
  function patchRide(r, q, t) {
    Object.assign(r, { pickup: t.pickup.n, pickupArea: t.pickup.a, drop: t.drop.n, dropArea: t.drop.a, km: q.km, mins: q.mins, quotePaise: q.total, finalPaise: q.total, fare: q.lines, surge: q.surge,
      driverEarnPaise: q.total - q.tax, couponCode: q.code, extras: (t.extras || []).slice() });
  }
  P.screen('R10', {
    title: 'Confirm pickup & pay', back: 'R09',
    reset: function (v) { ensureTrip(); v.pay = P.trip.pay || 'UPI'; },
    build: function (body, v) {
      var t = P.trip, u = S.user(), q = P.quote(t, t.vehicle, t.extras, { factor: t.factor || 1 });
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'loc' }, [h('span', { class: 'd' }), h('span', { class: 'tx' }, [h('b', null, P.pickup().n), h('span', null, P.pickup().a + ' \u00B7 meet at the gate')])]), h('div', { class: 'vline' }), h('div', { class: 'loc' }, [h('span', { class: 'd sq' }), h('span', { class: 'tx' }, [h('b', null, t.drop.n), h('span', null, q.km + ' km \u00B7 about ' + q.mins + ' min')])])]));
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('b', null, (t.label || t.vehicle) + ' fare'), h('b', { class: 'x-font-size-18px' }, rs(q.total))]), q.discount ? h('div', { class: 'xs' }, 'Includes coupon ' + q.code + ' (-' + rs(q.discount) + ')') : null, q.surge > 1 ? h('div', { class: 'xs' }, 'High demand ' + q.surge + 'x applied') : null]));
      body.appendChild(P.field({ name: 'note', label: 'Note for the driver (optional)', maxlength: 80, placeholder: 'e.g. Blue gate, opposite the pharmacy' }));
      body.appendChild(P.sec('PAY WITH'));
      var list = h('div', { class: 'list' });
      [['Wallet', 'wallet', 'RideNova wallet', rs(u.walletPaise) + ' available'], ['UPI', 'bolt', 'UPI', 'Pay with any UPI app'], ['Card', 'card', 'Card', 'Charged at the end of the trip'], ['Cash', 'wallet', 'Cash', 'Pay the driver']].forEach(function (m) {
        var low = m[0] === 'Wallet' && u.walletPaise < q.total;
        var r = P.row({ icon: m[1], tone: 'brand', title: m[2], sub: low ? m[3] + ' - not enough for this ride' : m[3], onClick: function () { if (low) { UI.toast('Add money to your wallet or choose another method.', 'warn'); return; } v.pay = m[0]; P.pickGroup(list)(r); } });
        r.setAttribute('aria-pressed', String(v.pay === m[0] && !low)); if (v.pay === m[0] && !low) r.classList.add('on'); if (low) r.classList.add('p-disabled'); if (low && v.pay === 'Wallet') v.pay = 'UPI'; list.appendChild(r);
      });
      body.appendChild(list);
      body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn('Confirm pickup', '', function (e) {
        var btn = e.currentTarget, qq = P.quote(t, t.vehicle, t.extras, { factor: t.factor || 1 });
        if (v.pay === 'Wallet' && u.walletPaise < qq.total) { UI.toast('Your wallet balance is too low for this ride.', 'error'); return; }
        D.DISPATCH_PLANS.pbike = [['DRV-2001', 'accept']];
        exec('ride.quote', { vehicle: t.vehicle, payMethod: v.pay }, null, { instant: true }).then(function () {
          return exec('ride.request', { vehicle: t.vehicle, payMethod: v.pay, plan: t.vehicle === 'Bike' ? 'pbike' : undefined }, btn);
        }).then(function (r) {
          if (!r.ok) return;
          var ride = UI.engine.state.rides[r.rideId]; patchRide(ride, qq, t); ride.pay = v.pay; ride.dropName = t.drop.n;
          if (qq.discount) P.useCoupon(qq.discount, 'ride', qq.code);
          UI.go('R11');
        });
      }));
    }
  });
  P.useCoupon = function (paise, cat, code) {
    var u = S.user(); if (!u) return; u.savedPaise += paise || 0; u.couponUse = u.couponUse || {};
    if (code) { u.couponUse[code] = (u.couponUse[code] || 0) + 1; if (code !== 'RIDE50' || u.couponUse[code] >= 2) { u.coupon = ''; u.couponUse[code] = 0; } }
    S.save();
  };

  // ------------------------------------------------------------ live ride details: R12 driver assigned, R15 in progress
  K.extend('R12', { update: function (ctx) {
    var r = ctx.engine.ride(); if (!r || !r.driverId) return; var d = D.DRIVERS[r.driverId]; if (!d) return;
    var li = UI.q('#mock .li.x-padding-0'); if (!li) return;
    var av = UI.q('.av', li); if (av && av.textContent !== d.initials) av.textContent = d.initials;
    var sub = UI.q('.tx span', li); if (sub && sub.textContent !== d.vehicle) sub.textContent = d.vehicle;
    var tag = UI.q('.tag', li); if (tag && tag.textContent !== d.plate) tag.textContent = d.plate;
    var loc = UI.q('#mock .loc .tx b'); if (loc && r.pickup) loc.textContent = r.pickup;
    var hd = UI.q('#mock .sheet .h2'); if (hd && /Arriving/.test(hd.textContent) === false && r.state !== 'DRIVER_ARRIVED') hd.setAttribute('data-bind', 'eta');
  } });
  K.extend('R15', {
    update: function (ctx) {
      var r = ctx.engine.ride(); if (!r) return;
      var d = D.DRIVERS[r.driverId]; var li = UI.q('#mock .li.x-padding-0');
      if (d && li) { var av = UI.q('.av', li); if (av) av.textContent = d.initials; var b = UI.q('.tx b', li); if (b) b.textContent = d.short; var sp = UI.q('.tx span', li); if (sp) sp.textContent = d.vehicle + ' \u00B7 ' + d.plate; }
      var dest = UI.q('#mock a.loc .tx b'); if (dest) dest.textContent = r.drop;
    },
    tick: function (ctx) {
      var r = ctx.engine.ride(); if (!r || !r.startedAt || RN.engineLib.rideScreen(r) !== 'R15') return;
      var total = ctx.engine.dur('end'), frac = Math.min(1, (Date.now() - r.startedAt) / total), left = Math.max(0, r.km * (1 - frac));
      var arrive = new Date(Date.now() + Math.max(0, total - (Date.now() - r.startedAt)) * (r.mins * 60000 / total));
      UI.bind('drop', 'Drop at ' + P.ftime(arrive.getTime()) + ' \u00B7 ' + left.toFixed(1) + ' km left');
      var bar = UI.q('#mock .sheet .progress i'); if (bar) bar.style.width = Math.round(frac * 100) + '%';
    }
  });

  // ------------------------------------------------------------ R13 masked call, R14 chat
  function rideAndDriver() { var r = UI.engine.activeRide(); return r && r.driverId ? { r: r, d: D.DRIVERS[r.driverId] } : null; }
  P.screen('R13', {
    title: 'Masked call', back: function () { return 'R12'; },
    reset: function (v) { v.t0 = Date.now(); v.muted = false; v.speaker = false; v.ended = false; },
    build: function (body, v) {
      var x = rideAndDriver();
      if (!x) { body.appendChild(P.empty('Masked calling works only while a driver is assigned.', 'phone')); body.appendChild(P.btn('Back', 'soft', function () { UI.back('R29'); })); return; }
      body.appendChild(h('div', { class: 'center p-callbox' }, [h('div', { class: 'av lg' }, x.d.initials), h('b', { class: 'h1' }, x.d.name), h('div', { class: 'sub' }, 'Masked number ' + x.d.phoneMasked + ' \u2022\u2022\u2022'), h('div', { class: 'h2 p-ctimer' }, 'Calling...'), h('span', { class: 'xs' }, 'Your real number is hidden. Simulated: no audio.')]));
      body.appendChild(h('div', { class: 'row2' }, [P.btn('Mute', 'soft sm', function (e) { v.muted = !v.muted; e.currentTarget.textContent = v.muted ? 'Unmute' : 'Mute'; }), P.btn('Speaker', 'soft sm', function (e) { v.speaker = !v.speaker; e.currentTarget.textContent = v.speaker ? 'Speaker on' : 'Speaker'; }), P.btn('Keypad', 'soft sm', function () { UI.toast('Keypad tones are not simulated.', 'info'); })]));
      body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn('End call', 'danger', function () { v.ended = true; UI.toast('Call ended (' + UI.q('.p-ctimer', v.body).textContent + ').', 'info'); UI.back('R12'); }));
    },
    tick: function (v) { var t = UI.q('.p-ctimer', v.body); if (!t || v.ended) return; var s = Math.floor((Date.now() - v.t0) / 1000); t.textContent = s < 2 ? 'Calling...' : 'Connected ' + P.pad(Math.floor((s - 2) / 60)) + ':' + P.pad((s - 2) % 60); }
  });
  var chats = {};
  var REPLIES = [[/where|reach|how far|eta|long/i, function (x) { return 'I am about ' + Math.max(1, Math.round(Math.random() * 3 + 1)) + ' minutes away.'; }], [/wait|minute|coming|hurry/i, function () { return 'Sure, no problem. I will wait.'; }], [/gate|blue|red|building|opposite|landmark/i, function () { return 'Got it, I will look for that landmark.'; }], [/call/i, function () { return 'Okay, I will call you in a moment.'; }], [/thank/i, function () { return 'You are welcome!'; }]];
  P.screen('R14', {
    title: 'Chat with driver', back: 'R12', right: function () { return h('a', { class: 'ib', href: '#/R13', 'data-go': 'R13', 'aria-label': 'Call driver' }, ic('phone')); },
    build: function (body, v) {
      var x = rideAndDriver();
      if (!x) { body.appendChild(P.empty('Chat opens when a driver is assigned.', 'info')); return; }
      var key = x.r.id + '@' + x.r.requestedAt, log = chats[key] = chats[key] || [{ from: 'sys', text: x.d.short + ' is your driver. Messages are masked.', at: Date.now() }];
      var box = h('div', { class: 'p-chat' }), typing = false;
      function draw() { P.clear(box); log.forEach(function (m) { box.appendChild(h('div', { class: 'bubble ' + m.from }, [m.text, h('time', null, P.ftime(m.at))])); }); if (typing) box.appendChild(h('div', { class: 'bubble them p-typing' }, x.d.short.split(' ')[0] + ' is typing...')); box.scrollTop = box.scrollHeight; }
      function send(text) {
        text = String(text || '').trim(); if (!text) return; log.push({ from: 'me', text: text, at: Date.now() }); typing = true; draw();
        setTimeout(function () { var hit = REPLIES.filter(function (r) { return r[0].test(text); })[0]; typing = false; log.push({ from: 'them', text: hit ? hit[1](x) : 'Okay, noted.', at: Date.now() }); if (UI.sid === 'R14') draw(); }, 1200 + Math.random() * 1200);
      }
      body.appendChild(box);
      body.appendChild(h('div', { class: 'chips' }, ['I\'m on my way', 'Please wait', 'Call me', 'Where are you?'].map(function (t) { return h('button', { type: 'button', class: 'chip', on: { click: function () { send(t); } } }, t); })));
      var input = h('input', { class: 'p-search', type: 'text', maxlength: 140, placeholder: 'Message', 'aria-label': 'Message' });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { send(input.value); input.value = ''; } });
      body.appendChild(h('div', { class: 'p-compose' }, [h('div', { class: 'inp' }, h('div', { class: 'box' }, input)), h('button', { type: 'button', class: 'p-send', 'aria-label': 'Send', on: { click: function () { if (!input.value.trim()) { UI.toast('Type a message first.', 'warn'); input.focus(); return; } send(input.value); input.value = ''; input.focus(); } } }, ic('send', 18))]));
      draw();
    }
  });

  // ------------------------------------------------------------ R17 trip complete, R19 invoice, R55 money breakdown
  P.screen('R17', {
    title: 'Trip complete', hideBar: true, needUser: true,
    build: function (body, v) {
      var r = UI.engine.lastRide(); v.r = r;
      if (!r || ['TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'CLOSED'].indexOf(r.state) < 0) {
        if (r && !K.rideFinal(r)) { K.follow(v.ctx, RN.engineLib.rideScreen(r)); return; }
        body.appendChild(P.empty('No completed ride yet. Finish a ride to see its receipt here.', 'car')); body.appendChild(P.btn('Book a ride', '', function () { UI.go('R07'); })); body.appendChild(P.btn('Back to home', 'ghost', function () { UI.go('R29'); })); return;
      }
      body.appendChild(h('div', { class: 'center' }, [h('span', { class: 'ic brand xl p-bigic' }, ic('check', 30)), h('div', { class: 'h1' }, 'You\'ve arrived'), h('div', { class: 'sub' }, r.drop + ' \u00B7 ' + P.ftime(r.endedAt || Date.now()))]));
      var card = h('div', { class: 'card-m' }); (r.fare || []).forEach(function (f) { card.appendChild(f[0].indexOf('High demand') === 0 ? h('a', { class: 'kv', href: '#/R55', 'data-go': 'R55' }, [h('span', null, f[0]), h('span', null, rs(f[1]))]) : P.kv(f[0], rs(f[1]), f[1] < 0 ? 'x-color-0b7a68' : '')); });
      card.appendChild(h('div', { class: 'hr' })); card.appendChild(h('div', { class: 'kv' }, [h('b', null, 'Total'), h('b', { class: 'x-font-size-18px' }, rs(r.finalPaise))]));
      card.appendChild(h('div', { class: 'kv p-payline' }, [h('span', { class: 'p-paytxt' }), h('span', { class: 'tag p-paytag' })]));
      body.appendChild(card); body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn('Rate your ride', '', function () { UI.go('R18'); }));
      body.appendChild(h('div', { class: 'p-sticky-actions' }, [P.btn('View invoice', 'soft sm', function () { P.nav.invoice = null; UI.go('R19'); }), P.btn('Report an issue', 'ghost sm', function () { UI.go('R27'); })]));
      v.paint = function (rr) {
        var m = rr.payment.method, t = UI.q('.p-paytxt', v.body), tag = UI.q('.p-paytag', v.body); if (!t) return;
        if (rr.state === 'TRIP_COMPLETED' || rr.state === 'PAYMENT_PENDING') { t.textContent = m === 'Cash' ? 'Pay ' + rs(rr.finalPaise) + ' in cash to the driver' : 'Charging ' + m + '...'; K.setTag(tag, 'Pending', 'warn'); }
        else if (rr.state === 'PAYMENT_FAILED') { t.textContent = m + ' payment failed'; K.setTag(tag, 'Failed', 'err'); }
        else { t.textContent = 'Paid by ' + m; K.setTag(tag, rr.payment.state === 'REFUNDED' ? 'Refunded' : 'Paid', 'ok'); }
      };
    },
    update: function (v, s) {
      var r = UI.engine.lastRide(); if (!r || !v.paint) return; v.paint(r);
      if (r.state === 'PAYMENT_FAILED') {
        var pay = function (method) { return { label: 'Pay by ' + method, primary: method === 'UPI', onClick: function (b) { exec('payment.payOther', { method: method }, b).then(function (x) { if (x.ok) UI.toast('Paid ' + rs(r.finalPaise) + ' by ' + method + ' (simulated).', 'info'); }); } }; };
        UI.state('Payment failed', ['The gateway declined twice. Nothing was charged.', 'Settle ' + rs(r.finalPaise) + ' to book again.'], [pay('UPI'), pay('Wallet'), pay('Cash')], 'err');
      } else if (r.state === 'TRIP_COMPLETED' || r.state === 'PAYMENT_PENDING') UI.state('Payment pending', [r.payment.method === 'Cash' ? 'The driver confirms when cash is received.' : 'Waiting for the payment gateway (simulated).'], null, 'info');
      else UI.state(null);
    }
  });
  function invoiceBooking() { var u = S.user(), id = P.nav.invoice; return (id && S.booking(id)) || u.bookings.filter(function (b) { return b.type === 'ride' && b.status === 'Completed'; })[0] || null; }
  P.screen('R19', {
    title: 'Invoice', back: 'R17',
    build: function (body, v) {
      var u = S.user(), b = invoiceBooking(), r = b ? null : UI.engine.lastRide();
      if (!b && !r) { body.appendChild(P.empty('No invoice yet. Complete a ride first.', 'info')); return; }
      var no = 'RN-HYD-' + (b ? String(b.rideId || b.id).replace(/\D/g, '').slice(-9) : r.id.replace(/\D/g, '').slice(-9)), when = b ? b.when : r.endedAt, fare = b ? b.fare : r.fare, total = b ? b.paise : r.finalPaise;
      var det = b ? b.details : [];
      var tax = (fare || []).filter(function (f) { return /Taxes/.test(f[0]); })[0];
      var card = h('div', { class: 'card-m' }, [P.kv('Invoice', no), P.kv('Date', P.fdt(when || Date.now())), P.kv('Billed to', u.name), h('div', { class: 'hr' }), h('div', { class: 'loc' }, [h('span', { class: 'd' }), h('span', { class: 'tx' }, [h('b', null, b ? b.title.split(' \u2192 ')[0] : 'Pickup'), h('span', null, 'Pickup')])]), h('div', { class: 'loc' }, [h('span', { class: 'd sq' }), h('span', { class: 'tx' }, [h('b', null, b ? b.title.split(' \u2192 ')[1] : r.drop), h('span', null, 'Drop \u00B7 ' + P.ftime(when || Date.now()))])]), h('div', { class: 'hr' })]);
      (fare || []).forEach(function (f) { card.appendChild(P.kv(f[0], rs(f[1]))); });
      card.appendChild(h('div', { class: 'hr' })); card.appendChild(h('div', { class: 'kv' }, [h('b', null, 'Total paid'), h('b', null, rs(total))])); det.forEach(function (d) { if (/Driver|Vehicle|Paid/.test(d[0])) card.appendChild(P.kv(d[0], String(d[1]))); });
      card.appendChild(P.kv('Tax ID', '36AAxxxxxx1Z5 (demo)'));
      body.appendChild(card);
      function text() { var L = ['RideNova invoice ' + no, 'Date: ' + P.fdt(when || Date.now()), 'Customer: ' + u.name, '']; (fare || []).forEach(function (f) { L.push(f[0] + ': ' + rs(f[1])); }); L.push('', 'Total: ' + rs(total)); return L.join('\r\n'); }
      body.appendChild(h('div', { class: 'row2' }, [P.btn('Download', 'soft sm', function () { try { var a = h('a', { href: URL.createObjectURL(new Blob([text()], { type: 'text/plain' })), download: no + '.txt' }); document.body.appendChild(a); a.click(); a.remove(); UI.toast('Invoice downloaded.', 'info'); } catch (e) { UI.toast('Download is not available here.', 'error'); } }),
        P.btn('Email', 'ghost sm', function () { if (!u.email) { UI.toast('Add an email in Account > Edit profile to receive invoices.', 'warn'); return; } UI.toast('Invoice sent to ' + u.email + ' (simulated).', 'sim'); })]));
    }
  });
  P.screen('R55', {
    title: 'Where your money went', back: 'R09',
    build: function (body) {
      var r = UI.engine.lastRide(), t = P.trip, q = r && r.fare ? { total: r.finalPaise, tax: r.finalPaise - r.driverEarnPaise, veh: r.vehicle } : (t.drop ? (function () { var x = P.quote(t, t.vehicle || 'Cab'); return { total: x.total, tax: x.tax, veh: t.vehicle || 'Cab' }; })() : null);
      if (!q) { body.appendChild(P.empty('Book or finish a ride to see the breakdown.', 'info')); return; }
      var drv = q.total - q.tax, pct = Math.round(drv * 100 / q.total);
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('span', { class: 'xs' }, q.veh + ' \u00B7 Hyderabad zone'), h('span', { class: 'tag ok' }, r ? 'Your ride' : 'Estimate')]), h('div', { class: 'big-num' }, rs(q.total)), h('span', { class: 'xs' }, 'The price you saw before booking. Nothing was added.'), h('div', { class: 'p-split' }, [h('i', { class: 'p-s1' }), h('i', { class: 'p-s2' })])]));
      var s1 = UI.q('.p-s1', document.querySelector('#mock')), s2 = UI.q('.p-s2', document.querySelector('#mock')); if (s1) s1.style.width = pct + '%'; if (s2) s2.style.width = (100 - pct) + '%';
      body.appendChild(h('div', { class: 'card-m' }, [P.kv('Driver (' + pct + '% of the fare)', rs(drv)), h('span', { class: 'xs' }, 'The whole fare goes to your driver. Tips go 100% to the driver too.'), h('div', { class: 'hr' }), P.kv('GST 5% (government)', rs(q.tax)), h('div', { class: 'hr' }), P.kv('RideNova commission', rs(0)), h('span', { class: 'xs' }, 'We take nothing from your ride.')]));
      body.appendChild(h('div', { class: 'card-m' }, [h('b', { class: 'x-font-size-13px' }, 'How is the app paid for?'), h('span', { class: 'xs' }, 'Drivers pay one flat fee of \u20B910-15 a day, only on days they drive. You never pay it.')]));
      body.appendChild(P.banner('ok', rs(drv) + ' + ' + rs(q.tax) + ' = ' + rs(q.total) + '. No booking fee, no card surcharge.', 'check'));
      body.appendChild(P.btn('Report a wrong charge', 'ghost sm', function () { UI.go('R27'); }));
    }
  });

  // ------------------------------------------------------------ R23 schedule a ride
  P.screen('R23', {
    title: 'Schedule a ride', back: 'R07',
    reset: function (v) { v.day = 0; v.veh = 'Cab'; v.drop = P.trip.drop; },
    build: function (body, v) {
      var days = []; for (var i = 0; i < 7; i++) { var t = P.startOfDay(Date.now() + i * 86400000); days.push([String(i), i === 0 ? 'Today' : P.fdate(t).replace(/ [A-Z][a-z]+$/, '')]); }
      body.appendChild(h('div', { class: 'inp' }, [h('label', null, 'Date'), P.chips(days, '0', function (d) { v.day = +d; })]));
      var slots = []; for (var m = 0; m < 24 * 4; m++) { var hh = Math.floor(m / 4), mm = (m % 4) * 15; slots.push([hh * 60 + mm, (hh % 12 || 12) + ':' + P.pad(mm) + (hh < 12 ? ' AM' : ' PM')]); }
      var d0 = new Date(Date.now() + 3600000); var def = d0.getHours() * 60 + Math.ceil(d0.getMinutes() / 15) * 15;
      body.appendChild(P.field({ name: 'time', label: 'Pick-up time', select: slots, value: Math.min(def, 24 * 60 - 15) }));
      var dstBox = h('div'); body.appendChild(dstBox);
      function drawDest() {
        P.clear(dstBox);
        if (v.drop) dstBox.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'loc' }, [h('span', { class: 'd sq' }), h('span', { class: 'tx' }, [h('b', null, v.drop.n), h('span', null, legOf(v.drop).km + ' km')])]), h('button', { type: 'button', class: 'chip', on: { click: function () { v.drop = null; drawDest(); drawOpts(); } } }, 'Change destination')]));
        else { dstBox.appendChild(h('div', { class: 'err-wrap' }, [P.placePicker({ placeholder: 'Where to?', onPick: function (p) { v.drop = p; drawDest(); drawOpts(); } }), h('span', { class: 'rn-err', 'data-err': 'drop', hidden: true })])); }
      }
      body.appendChild(P.sec('VEHICLE'));
      var opts = h('div', { class: 'p-opts' }); body.appendChild(opts);
      function drawOpts() {
        P.clear(opts); ['Bike', 'Auto', 'Cab', 'Premium'].forEach(function (name) {
          var est = v.drop ? (function () { var tr = { drop: v.drop }; var q = P.quote(tr, name); return rs(Math.round(q.total * 0.95 / 1000) * 1000 || q.total) + '-' + rs(Math.round(q.total * 1.1 / 1000) * 1000 || q.total); })() : 'Choose a destination';
          opts.appendChild(P.opt({ icon: VEH[name].icon, title: name, sub: 'Estimated ' + est, on: name === v.veh, onClick: function () { v.veh = name; drawOpts(); } }));
        });
      }
      drawDest(); drawOpts();
      body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn('Schedule ride', '', function () {
        P.clearErrors(); var mins = +UI.val('time'), when = P.startOfDay(Date.now() + v.day * 86400000) + mins * 60000;
        if (!v.drop) { UI.fieldError('drop', 'Choose a destination.'); var er = UI.q('[data-err=drop]'); if (er) { er.textContent = 'Choose a destination first.'; er.hidden = false; } return; }
        if (when < Date.now() + 30 * 60000) { UI.fieldError('time', 'Pick a time at least 30 minutes from now.'); return; }
        var q = P.quote({ drop: v.drop }, v.veh), u = S.user();
        S.addBooking({ type: 'scheduled', title: P.pickup().a.split(',')[0] + ' \u2192 ' + v.drop.n, sub: v.veh + ' \u00B7 ' + legOf(v.drop).km + ' km', paise: q.total, status: 'Scheduled', when: when, pay: 'Pay after the ride', details: [['Vehicle', v.veh], ['Pickup', P.pickup().a], ['Drop', v.drop.n], ['Estimated fare', rs(q.total)], ['Driver assigned', '15 minutes before pickup']] });
        S.notify(u, 'Ride scheduled', v.veh + ' to ' + v.drop.n + ' on ' + P.fdt(when), 'Rides', 'R54');
        UI.toast('Scheduled for ' + P.fdt(when) + '. A driver is assigned 15 minutes before.', 'sim'); P.nav.tripTab = 'Upcoming'; UI.go('R54');
      }));
    }
  });
})();