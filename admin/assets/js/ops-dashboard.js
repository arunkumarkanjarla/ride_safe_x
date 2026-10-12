/* RideNova Admin portal – Operations command center (A02) and Live map (A03).
   A02: country → state → city filter (all data by default), compact KPI cards that open the page behind each number,
   a world map with vehicle groups and counts, safety alerts, items needing attention, rides per hour and a breakdown
   by country, state or city. A03: the map on the whole screen with status, location and vehicle filters, a search,
   and the driver card on hover (click to keep it open). */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, OD = RN.opsData, U = RN.opsUI, OPS = RN.ops, K = RN.kit;
  var h = U.h, btn = U.btn, st = U.st, card = U.card;
  var ACTIVE = ['DRIVER_ASSIGNED', 'ARRIVED', 'IN_PROGRESS'], WAITING = ['SEARCHING', 'OFFER'];
  var ORDER_OPEN = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'ON_THE_WAY'];
  var PARTNER_OPEN = ['SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED', 'SITE_VISIT', 'AGREEMENT', 'APPROVED'];

  function geo() { return OPS.geo; }
  function vehiclesIn(g) { return OD.vehicles.filter(function (v) { return OD.inGeo(v.city, g); }); }
  function ridesIn(g) { return OD.rides.filter(function (r) { return OD.inGeo(r.city, g); }); }
  function ordersIn(g) { return OD.orders.filter(function (o) { return OD.inGeo(o.city, g); }); }
  function count(list, f) { return list.filter(f).length; }
  function openRide(id) { OPS.nav.ride = id; UI.go('A04'); }
  function callDriver(v, b) { U.act('ride.view', 'call driver ' + v.driver.name, v.id, 'telephony.call', b).then(function (ok) { if (ok) UI.toast('Calling ' + v.driver.name + ' through a masked number (simulated – no call is placed).', 'info'); }); }
  function messageDriver(v, b) {
    U.form('Message to ' + v.driver.name, [{ name: 'text', label: 'Message', type: 'textarea', required: true, value: '' }], 'Send').then(function (f) {
      if (!f) return;
      U.act('ride.view', 'message driver ' + v.driver.name, v.id, 'driver.messaged', b).then(function (ok) { if (ok) UI.toast('Message sent to ' + v.driver.name + ' in the driver app (simulated).', 'info'); });
    });
  }
  function openFromMap(v, r, o) { if (r) openRide(r.id); else if (o) { OPS.nav.order = o.id; UI.go('A27'); } }

  // ================================================================== A02
  var A02 = { map: null, timer: null };
  function kpi(label, value, sub, sid, preset, kind, subKind) {
    var a = h('a', { class: 'kpi ops-kpi' + (kind ? ' ' + kind : ''), href: '#/' + sid, 'aria-label': label + ': ' + value + '. Open ' + (RN_SCREENS[sid] ? RN_SCREENS[sid].title : sid) },
      [h('span', { class: 'l', text: label }), h('span', { class: 'v', text: value }), h('span', { class: 'd' + (subKind ? ' ' + subKind : ''), text: sub })]);
    a.addEventListener('click', function () { if (preset) Object.assign(OPS.nav, preset); });
    return a;
  }
  function renderA02() {
    var root = U.mount('ops-a02'); if (!root) return;
    var g = geo(), vs = vehiclesIn(g), rs = ridesIn(g), os = ordersIn(g);
    var online = vs.filter(function (v) { return v.status !== 'OFFLINE'; }), busy = count(online, function (v) { return v.status === 'ON_TRIP' || v.status === 'OFFER'; });
    var active = rs.filter(function (r) { return ACTIVE.indexOf(r.state) >= 0; }), waiting = count(rs, function (r) { return WAITING.indexOf(r.state) >= 0; });
    var sos = vs.filter(function (v) { return v.status === 'SOS'; }), payFail = count(rs, function (r) { return r.payment.state === 'FAILED'; });
    var pickup = active.length ? (active.reduce(function (t, r) { return t + r.pickupEta; }, 0) / active.length).toFixed(1) : '—';
    var openOrders = os.filter(function (o) { return ORDER_OPEN.indexOf(o.state) >= 0; }), late = count(openOrders, function (o) { return o.lateMin > 0; });
    var apps = OD.partners.filter(function (p) { return OD.inGeo(p.city, g) && PARTNER_OPEN.indexOf(p.stage) >= 0; }), overdue = count(apps, function (p) { return Date.now() - p.submittedAt > 48 * 3600000; });

    // toolbar: location masters and links
    var bar = h('div', { class: 'ops-bar' }, [U.geoBar(function () { renderA02(); }), h('span', { class: 'sp' }),
      h('span', { class: 'ops-live' }, [h('i'), 'Live · ' + OD.geoLabel(g) + ' · updated ' + U.clock(Date.now())]),
      btn('Open live map', function () { UI.go('A03'); }, 'g')]);
    root.appendChild(bar);

    root.appendChild(h('div', { class: 'kpis ops-kpis' }, [
      kpi('Active rides', U.fmtN(active.length), waiting + ' waiting for a driver', 'A04', { rideStatus: 'active' }),
      kpi('Online drivers', U.fmtN(online.length), (online.length ? Math.round(busy / online.length * 100) : 0) + '% busy', 'A03', { mapStatus: 'online' }),
      kpi('Waiting requests', U.fmtN(waiting), 'p50 match ' + (20 + waiting % 17) + ' s', 'A04', { rideStatus: 'waiting' }),
      kpi('Open SOS', String(sos.length), sos.length ? 'oldest ' + Math.floor((sos.length * 47 + 30) / 60) + ':' + String((sos.length * 47 + 30) % 60).padStart(2, '0') : 'none open', 'A13', null, sos.length ? 'alert' : '', sos.length ? 'bad' : ''),
      kpi('Payment failures', String(payFail), 'today', 'A11', null, '', payFail ? 'bad' : ''),
      kpi('Avg pickup', pickup === '—' ? '—' : pickup + ' min', 'active rides', 'A17'),
      kpi('Food & parcel live', U.fmtN(openOrders.length), late + ' running late', 'A27', { orderTab: 'board' }, '', late ? 'bad' : ''),
      kpi('Partner apps', String(apps.length), overdue + ' waiting > 48 h', 'A24', { partnerStage: 'open' }, '', overdue ? 'bad' : '')
    ]));

    // map + alerts
    var mapHost = h('div', { class: 'ops-map ops-map-s' });
    var types = {}; vs.forEach(function (v) { if (v.status !== 'OFFLINE') types[v.type] = (types[v.type] || 0) + 1; });
    var legend = h('div', { class: 'ops-legend' }, RN.opsMap.TYPE_ORDER.filter(function (t) { return types[t]; }).map(function (t) {
      return h('span', null, [h('img', { src: 'assets/img/vehicles/' + t + '.svg', alt: '' }), OD.TYPES[t].label + ' ', h('b', { text: U.fmtN(types[t]) })]);
    }));
    var mapCard = card('Live operations · ' + OD.geoLabel(g), [mapHost, legend], [btn('Full map', function () { UI.go('A03'); }, 'g')], 'ops-mapcard');

    var alerts = [];
    sos.forEach(function (v) { alerts.push({ ride: v.rideId, type: ['SOS', 'err'], age: v.ping * 9 + 40, who: v.driver.name, city: v.city }); });
    rs.filter(function (r) { return ACTIVE.indexOf(r.state) >= 0 && r.flags.indexOf('Route deviation') >= 0; }).slice(0, 6).forEach(function (r) {
      var v = OD.vehicle(r.vehicleId); alerts.push({ ride: r.id, type: ['Route deviation', 'warn'], age: Math.round((Date.now() - r.requestedAt) / 1000) % 400, who: v ? v.driver.name : '—', city: r.city });
    });
    var alertTable = h('table', { class: 'dt ops-dt' }, [h('thead', null, [h('tr', null, ['Ride', 'Type', 'City', 'Age', 'Driver'].map(function (t) { return h('th', { text: t }); }))])]);
    var tb = h('tbody');
    alerts.slice(0, 7).forEach(function (a) {
      var tr = h('tr', { class: 'ops-row', tabindex: '0' }, [h('td', { text: a.ride || 'Driver SOS' }), h('td', null, [st(a.type[0], a.type[1])]), h('td', { text: OD.CITIES[a.city].name }), h('td', { text: Math.floor(a.age / 60) + ':' + String(a.age % 60).padStart(2, '0') }), h('td', { text: a.who })]);
      var go = function () { if (a.ride) openRide(a.ride); else UI.go('A13'); };
      tr.addEventListener('click', go); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      tb.appendChild(tr);
    });
    if (!alerts.length) tb.appendChild(h('tr', null, [h('td', { colspan: '5', class: 'ops-empty', text: 'No safety alerts in ' + OD.geoLabel(g) + '.' })]));
    alertTable.appendChild(tb);
    var need = [
      ['KYC documents waiting', 12, 'A07'], ['Payment failures today', payFail, 'A11'], ['Orders running late', late, 'A27', { orderLate: true }],
      ['Partner applications > 48 h', overdue, 'A24', { partnerStage: 'overdue' }], ['Tickets past SLA', 7, 'A12'], ['Fraud cases high risk', 5, 'A14']
    ];
    var needTable = h('table', { class: 'dt ops-dt' }, [h('thead', null, [h('tr', null, [h('th', { text: 'Item' }), h('th', { text: 'Count', class: 'num' })])]),
      h('tbody', null, need.map(function (n) {
        var tr = h('tr', { class: 'ops-row', tabindex: '0' }, [h('td', { text: n[0] }), h('td', { class: 'num' }, [h('b', { text: String(n[1]) })])]);
        var go = function () { if (n[3]) Object.assign(OPS.nav, n[3]); UI.go(n[2]); };
        tr.addEventListener('click', go); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        return tr;
      }))]);
    root.appendChild(h('div', { class: 'ops-grid ops-grid-a02' }, [mapCard, h('div', { class: 'ops-col' }, [
      card('Safety alerts', [alertTable], [btn('Open console', function () { UI.go('A13'); }, 'r')]),
      card('Needs attention', [needTable])])]));

    // rides per hour and breakdown
    var hours = []; for (var i = 0; i < 24; i++) hours.push(0);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    rs.forEach(function (r) { if (r.requestedAt >= today.getTime()) hours[new Date(r.requestedAt).getHours()]++; });
    var level = g.city ? null : g.state ? 'city' : g.country ? 'state' : 'country';
    var groups = {};
    OD.citiesIn(g).forEach(function (c) {
      var key = level === 'country' ? c.country : level === 'state' ? c.state : c.id, name = level === 'country' ? c.countryName : level === 'state' ? c.stateName : c.name;
      groups[key] = groups[key] || { key: key, name: name, cities: [] }; groups[key].cities.push(c.id);
    });
    var rows = Object.keys(groups).map(function (k) {
      var grp = groups[k], inG = function (id) { return grp.cities.indexOf(id) >= 0; };
      var on = count(OD.vehicles, function (v) { return inG(v.city) && v.status !== 'OFFLINE'; }), act = count(OD.rides, function (r) { return inG(r.city) && ACTIVE.indexOf(r.state) >= 0; });
      var wait = count(OD.rides, function (r) { return inG(r.city) && WAITING.indexOf(r.state) >= 0; }), ratio = on ? wait / on : 1;
      return { g: grp, active: act, online: on, waiting: wait, health: ratio > 0.3 ? ['Critical', 'err'] : ratio > 0.18 ? ['Slow', 'warn'] : ['OK', 'ok'] };
    });
    var breakdown = level ? U.table({
      rows: rows, pageSize: 8, state: { sort: 'active', dir: -1, page: 0 },
      columns: [{ key: 'name', label: level === 'country' ? 'Country' : level === 'state' ? 'State' : 'City', get: function (r) { return r.g.name; }, sort: function (r) { return r.g.name; } },
        { key: 'active', label: 'Active', cls: 'num', get: function (r) { return U.fmtN(r.active); }, sort: function (r) { return r.active; } },
        { key: 'online', label: 'Online', cls: 'num', get: function (r) { return U.fmtN(r.online); }, sort: function (r) { return r.online; } },
        { key: 'waiting', label: 'Waiting', cls: 'num', get: function (r) { return U.fmtN(r.waiting); }, sort: function (r) { return r.waiting; } },
        { key: 'health', label: 'Health', get: function (r) { return st(r.health[0], r.health[1]); } }],
      onRow: function (r) {
        if (level === 'country') { OPS.geo.country = r.g.key; OPS.geo.state = ''; OPS.geo.city = ''; }
        else if (level === 'state') { OPS.geo.state = r.g.key; OPS.geo.city = ''; }
        else OPS.geo.city = r.g.key;
        renderA02();
      }
    }) : U.kv([['City', OD.CITIES[g.city].name], ['State', OD.CITIES[g.city].stateName], ['Country', OD.CITIES[g.city].countryName],
      ['Active rides', U.fmtN(active.length)], ['Online vehicles', U.fmtN(online.length)], ['Restaurants', String(count(OD.restaurants, function (x) { return x.city === g.city; }))]]);
    root.appendChild(h('div', { class: 'ops-grid ops-grid-2' }, [
      card('Rides per hour · today', [chart(hours)]),
      card(level ? 'By ' + level + (level === 'country' ? '' : ' · ' + OD.geoLabel(g)) : OD.geoLabel(g), [breakdown])]));

    A02.map = OPS.map = RN.opsMap.create(mapHost, { vehicles: function () { return vehiclesIn(geo()).filter(function (v) { return v.status !== 'OFFLINE'; }); }, live: true, label: 'Vehicles in ' + OD.geoLabel(g),
      onOpen: openFromMap, onCall: callDriver, onMessage: messageDriver, fullscreen: false });
    requestAnimationFrame(function () { if (A02.map) A02.map.focusGeo(g); });
  }
  function chart(values) {
    var NS = 'http://www.w3.org/2000/svg', w = 480, hh = 120, max = Math.max.apply(null, values.concat([1])), now = new Date().getHours();
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' ' + (hh + 18)); s.setAttribute('class', 'ops-chart'); s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'Rides per hour today: ' + values.map(function (v, i) { return i + ':00 ' + v; }).join(', '));
    values.forEach(function (v, i) {
      var bw = w / 24, bh = Math.max(1, v / max * hh), r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', (i * bw + 2).toFixed(1)); r.setAttribute('y', (hh - bh).toFixed(1)); r.setAttribute('width', (bw - 4).toFixed(1)); r.setAttribute('height', bh.toFixed(1));
      r.setAttribute('class', i === now ? 'now' : i > now ? 'later' : ''); s.appendChild(r);
      var tt = document.createElementNS(NS, 'title'); tt.textContent = i + ':00 – ' + v + ' rides'; r.appendChild(tt);
      if (i % 3 === 0) { var t = document.createElementNS(NS, 'text'); t.setAttribute('x', (i * bw + bw / 2).toFixed(1)); t.setAttribute('y', String(hh + 14)); t.textContent = String(i).padStart(2, '0'); s.appendChild(t); }
    });
    return s;
  }

  K.def('A02', { init: renderA02, update: function (ctx, s) {
    // re-render when the session changes (sign in / role switch); the map refreshes itself
    var sig = s.session.admin.status + s.session.admin.role, dc = UI.q('#mock .dc');
    if (dc && dc.getAttribute('data-ops') !== sig) { dc.setAttribute('data-ops', sig); renderA02(); }
  } });

  // ================================================================== A03
  var A03 = { status: 'all', type: '', q: '', map: null };
  var STATUS_CHIPS = [['all', 'All'], ['AVAILABLE', 'Available'], ['ON_TRIP', 'On trip'], ['OFFER', 'Offer pending'], ['SOS', 'SOS'], ['OFFLINE', 'Offline']];
  function a03Vehicles() {
    return vehiclesIn(geo()).filter(function (v) {
      if (A03.status === 'online' ? v.status === 'OFFLINE' : A03.status !== 'all' && v.status !== A03.status) return false;
      if (A03.type && v.type !== A03.type) return false;
      if (A03.q && (v.plate + ' ' + v.driver.name + ' ' + v.id + ' ' + (v.rideId || '')).toLowerCase().indexOf(A03.q) < 0) return false;
      return true;
    });
  }
  function renderA03() {
    if (OPS.nav.mapStatus) { A03.status = OPS.nav.mapStatus; delete OPS.nav.mapStatus; }
    var root = U.mount('ops-a03'); if (!root) return;
    var dc = UI.q('#mock .dc'); if (dc) dc.classList.add('ops-full');
    var g = geo(), vs = vehiclesIn(g), counts = { all: vs.length, online: 0 };
    vs.forEach(function (v) { counts[v.status] = (counts[v.status] || 0) + 1; if (v.status !== 'OFFLINE') counts.online++; });
    var types = [['', 'Vehicle: all']].concat(RN.opsMap.TYPE_ORDER.map(function (t) { return [t, 'Vehicle: ' + OD.TYPES[t].label]; }));
    var chips = U.chips('Driver status', STATUS_CHIPS.map(function (c) { return [c[0], c[1], U.fmtN(counts[c[0]] || 0)]; }), A03.status === 'online' ? 'all' : A03.status, function (v) { A03.status = v; renderA03(); });
    var find = U.search('Find plate, driver or ride', A03.q, function (q) { A03.q = q; if (A03.map) A03.map.render(); updateCount(); });
    var bar = h('div', { class: 'ops-bar ops-mapbar' }, [chips, h('span', { class: 'sp' }), U.geoBar(function () { renderA03(); }, { label: 'Area' }),
      U.select('Vehicle type', types, A03.type, function (v) { A03.type = v; if (A03.map) A03.map.render(); updateCount(); }), find]);
    var mapHost = h('div', { class: 'ops-map ops-map-full' });
    var legend = h('div', { class: 'ops-maplegend' }, [['AVAILABLE', 'Available'], ['ON_TRIP', 'On trip'], ['OFFER', 'Offer pending'], ['SOS', 'SOS'], ['OFFLINE', 'Offline']].map(function (s) {
      return h('span', null, [h('i', { class: 'ops-dot ' + s[0].toLowerCase() }), s[1] + ' ', h('b', { text: U.fmtN(counts[s[0]] || 0) })]);
    }));
    var found = h('span', { class: 'ops-found', 'aria-live': 'polite' });
    function updateCount() { var n = a03Vehicles().length; found.textContent = U.fmtN(n) + ' vehicle' + (n === 1 ? '' : 's') + ' match' + (A03.status === 'online' ? ' (online only)' : ''); }
    root.appendChild(bar);
    root.appendChild(h('div', { class: 'ops-mapwrap' }, [mapHost, h('div', { class: 'ops-mapfoot' }, [legend, found])]));
    A03.map = OPS.map = RN.opsMap.create(mapHost, { vehicles: a03Vehicles, live: true, label: 'Live map of vehicles in ' + OD.geoLabel(g), fullscreenTarget: root,
      onOpen: openFromMap, onCall: callDriver, onMessage: messageDriver });
    updateCount();
    requestAnimationFrame(function () { if (A03.map) A03.map.focusGeo(g); });
  }
  K.def('A03', { init: renderA03, update: function (ctx, s) {
    var sig = s.session.admin.status + s.session.admin.role, dc = UI.q('#mock .dc');
    if (dc && dc.getAttribute('data-ops') !== sig) { dc.setAttribute('data-ops', sig); renderA03(); }
  } });

  RN.opsDashboard = { renderA02: renderA02, renderA03: renderA03, a03: A03 };
})();
