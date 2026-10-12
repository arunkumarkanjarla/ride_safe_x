/* RideNova Admin portal – Food & parcel orders (A27).
   Live board (orders by stage, problems first), all orders with filters, restaurants and late orders. Each order opens
   in a side panel with its progress, items, totals, partner, customer, courier and timeline, and the actions an
   operations team needs: move to the next stage, assign or reassign the courier, call or message, credit the customer,
   mark delivered, cancel with refund, escalate to the partner, add a note. Restaurants can be paused and resumed.
   Permission-checked (order.manage, payment.refund) and audited. Synthetic data only. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, OD = RN.opsData, U = RN.opsUI, OPS = RN.ops, K = RN.kit;
  var h = U.h, btn = U.btn, st = U.st, card = U.card;
  var OPEN = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'ON_THE_WAY'];
  var TAG = { PLACED: 'warn', ACCEPTED: 'info', PREPARING: 'info', READY: 'warn', PICKED_UP: 'info', ON_THE_WAY: 'info', DELIVERED: 'ok', CANCELLED: '', FAILED: 'err' };
  var COLUMNS = [['problems', 'Needs action', function (o) { return OPEN.indexOf(o.state) >= 0 && (o.lateMin >= 10 || (o.state === 'READY' && !o.courierId)); }],
    ['PLACED', 'New', function (o) { return o.state === 'PLACED'; }], ['ACCEPTED', 'Accepted', function (o) { return o.state === 'ACCEPTED'; }],
    ['PREPARING', 'Preparing', function (o) { return o.state === 'PREPARING'; }], ['READY', 'Ready for pickup', function (o) { return o.state === 'READY'; }],
    ['OUT', 'Out for delivery', function (o) { return o.state === 'PICKED_UP' || o.state === 'ON_THE_WAY'; }]];
  var M = { tab: 'board', kind: '', state: '', q: '', late: false, sel: null, table: { sort: 'placed', dir: -1, page: 0 }, rtable: { sort: 'open', dir: -1, page: 0 } };

  function money(o, v) { return OD.money(v, o.currency); }
  function flow(o) { return o.kind === 'Food' ? OD.ORDER_FLOW : OD.PARCEL_FLOW; }
  function label(s) { return OD.LABEL_ORDER[s] || s; }
  function add(o, text, kind) { o.timeline.push({ at: Date.now(), text: text, kind: kind || '', by: U.me() }); }
  function inScope(o) {
    if (!OD.inGeo(o.city, OPS.geo)) return false;
    if (M.kind && o.kind !== M.kind) return false;
    if (M.late && !(o.lateMin > 0 && OPEN.indexOf(o.state) >= 0)) return false;
    if (M.q && (o.id + ' ' + o.partner.name + ' ' + o.customer.name + ' ' + o.customer.address).toLowerCase().indexOf(M.q) < 0) return false;
    return true;
  }

  function render() {
    if (OPS.nav.order) { M.sel = OPS.nav.order; delete OPS.nav.order; }
    if (OPS.nav.orderTab) { M.tab = OPS.nav.orderTab; delete OPS.nav.orderTab; }
    if (OPS.nav.orderLate) { M.late = true; M.tab = 'list'; delete OPS.nav.orderLate; }
    var root = U.mount('ops-a27'); if (!root) return;
    var all = OD.orders.filter(function (o) { return OD.inGeo(o.city, OPS.geo); }), today = new Date().toDateString();
    var c = function (f) { return all.filter(f).length; };
    var delivered = all.filter(function (o) { return o.state === 'DELIVERED' && new Date(o.placedAt).toDateString() === today; });
    var avg = delivered.length ? Math.round(delivered.reduce(function (t, o) { return t + (o.etaAt - o.placedAt); }, 0) / delivered.length / 60000) : 0;
    root.appendChild(h('div', { class: 'ops-bar' }, [U.geoBar(function () { M.table.page = 0; render(); }), h('span', { class: 'sp' }),
      U.select('Order type', [['', 'Food and parcel'], ['Food', 'Food only'], ['Parcel', 'Parcel only']], M.kind, function (v) { M.kind = v; render(); }),
      U.search('Search order, restaurant, customer', M.q, function (q) { M.q = q; drawTab(); })]));
    var kpi = function (l, v, d, bad, f) { var a = h('button', { type: 'button', class: 'kpi ops-kpi' + (bad ? ' alert' : '') }, [h('span', { class: 'l', text: l }), h('span', { class: 'v', text: U.fmtN(v) }), h('span', { class: 'd' + (bad ? ' bad' : ''), text: d })]); a.addEventListener('click', f); return a; };
    var late15 = c(function (o) { return OPEN.indexOf(o.state) >= 0 && o.lateMin > 15; });
    root.appendChild(h('div', { class: 'kpis ops-kpis' }, [
      kpi('Placed', c(function (o) { return o.state === 'PLACED'; }), 'waiting for the partner', false, function () { M.tab = 'list'; M.state = 'PLACED'; render(); }),
      kpi('Preparing', c(function (o) { return o.state === 'ACCEPTED' || o.state === 'PREPARING'; }), 'in kitchens', false, function () { M.tab = 'list'; M.state = 'PREPARING'; render(); }),
      kpi('Ready, waiting', c(function (o) { return o.state === 'READY'; }), c(function (o) { return o.state === 'READY' && !o.courierId; }) + ' without courier', c(function (o) { return o.state === 'READY' && !o.courierId; }) > 0, function () { M.tab = 'list'; M.state = 'READY'; render(); }),
      kpi('On the way', c(function (o) { return o.state === 'PICKED_UP' || o.state === 'ON_THE_WAY'; }), 'with couriers', false, function () { M.tab = 'list'; M.state = 'ON_THE_WAY'; render(); }),
      kpi('Delivered today', delivered.length, 'avg ' + avg + ' min', false, function () { M.tab = 'list'; M.state = 'DELIVERED'; render(); }),
      kpi('Late > 15 min', late15, all.length ? (late15 / Math.max(1, c(function (o) { return OPEN.indexOf(o.state) >= 0; })) * 100).toFixed(1) + '% of open' : '', late15 > 0, function () { M.tab = 'late'; render(); }),
      kpi('Cancelled / failed', c(function (o) { return o.state === 'CANCELLED' || o.state === 'FAILED'; }), 'today', false, function () { M.tab = 'list'; M.state = 'CANCELLED'; render(); }),
      kpi('Restaurants paused', OD.restaurants.filter(function (r) { return OD.inGeo(r.city, OPS.geo) && r.status === 'PAUSED'; }).length, 'tap to review', false, function () { M.tab = 'rest'; render(); })]));
    var tabs = [['board', 'Live board'], ['list', 'All orders'], ['late', 'Late & issues'], ['rest', 'Restaurants'], ['chart', 'Volume']];
    var tl = h('div', { class: 'dtabs ops-tabs', role: 'tablist', 'aria-label': 'Orders views' });
    tabs.forEach(function (t) {
      var s = h('button', { type: 'button', role: 'tab', class: M.tab === t[0] ? 'on' : '', 'aria-selected': String(M.tab === t[0]), text: t[1] });
      s.addEventListener('click', function () { M.tab = t[0]; render(); }); tl.appendChild(s);
    });
    root.appendChild(tl);
    var body = h('div', { class: 'ops-tabbody ops-fill' }); root.appendChild(body);
    var panel = h('aside', { class: 'ops-drawer', 'aria-label': 'Order details' }); panel.hidden = true; root.appendChild(panel);
    M.body = body; M.panel = panel;
    drawTab();
    if (M.sel && OD.order(M.sel)) openOrder(OD.order(M.sel));
  }

  function drawTab() {
    var body = M.body; if (!body) return; UI.clear(body);
    ({ board: board, list: list, late: late, rest: restaurantsTab, chart: volume })[M.tab](body);
  }

  function board(body) {
    var orders = OD.orders.filter(inScope);
    var cols = h('div', { class: 'ops-board' });
    COLUMNS.forEach(function (col) {
      var items = orders.filter(col[2]).sort(function (a, b) { return b.lateMin - a.lateMin || a.placedAt - b.placedAt; });
      var c = h('section', { class: 'ops-bcol' + (col[0] === 'problems' ? ' bad' : ''), 'aria-label': col[1] }, [h('header', null, [h('b', { text: col[1] }), h('span', { class: 'ops-n', text: U.fmtN(items.length) })])]);
      var list = h('div', { class: 'ops-bcards' });
      items.slice(0, 30).forEach(function (o) { list.appendChild(orderCard(o)); });
      if (items.length > 30) list.appendChild(btn('Show all ' + items.length, function () { M.tab = 'list'; M.state = col[0] === 'OUT' ? 'ON_THE_WAY' : col[0] === 'problems' ? '' : col[0]; M.late = col[0] === 'problems'; render(); }, 'g'));
      if (!items.length) list.appendChild(h('p', { class: 'ops-empty', text: 'Nothing here.' }));
      c.appendChild(list); cols.appendChild(c);
    });
    body.appendChild(cols);
  }
  function orderCard(o) {
    var c = h('button', { type: 'button', class: 'ops-ocard' + (M.sel === o.id ? ' on' : '') }, [
      h('span', { class: 'ops-orow' }, [h('b', { text: o.id }), h('span', { class: 'ops-kind ' + o.kind.toLowerCase(), text: o.kind }), h('span', { class: 'sp' }), o.lateMin > 0 && OPEN.indexOf(o.state) >= 0 ? st(o.lateMin + ' min', o.lateMin > 15 ? 'err' : 'warn') : null]),
      h('span', { class: 'ops-orow' }, [o.partner.name + ' → ' + o.customer.name]),
      h('span', { class: 'ops-orow ops-muted' }, [OD.CITIES[o.city].name + ' · ' + U.since(o.placedAt) + ' ago · ' + label(o.state) + (o.issue ? ' · ' + o.issue : '')])]);
    c.addEventListener('click', function () { openOrder(o); });
    return c;
  }
  function list(body) {
    var rows = OD.orders.filter(function (o) { return inScope(o) && (!M.state || o.state === M.state || (M.state === 'ON_THE_WAY' && o.state === 'PICKED_UP') || (M.state === 'PREPARING' && o.state === 'ACCEPTED') || (M.state === 'CANCELLED' && o.state === 'FAILED')); });
    body.appendChild(h('div', { class: 'ops-bar' }, [U.chips('Status', [['', 'All']].concat(['PLACED', 'PREPARING', 'READY', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'].map(function (s) { return [s, label(s)]; })), M.state, function (v) { M.state = v; M.table.page = 0; drawTab(); }),
      h('span', { class: 'sp' }), h('label', { class: 'ops-check' }, [(function () { var i = h('input', { type: 'checkbox' }); i.checked = M.late; i.addEventListener('change', function () { M.late = i.checked; M.table.page = 0; drawTab(); }); return i; })(), ' Late only'])]));
    body.appendChild(U.table({ rows: rows, pageSize: 20, state: M.table, selected: function (o) { return o.id === M.sel; },
      columns: [
        { key: 'id', label: 'Order', get: function (o) { return h('b', { text: o.id }); }, sort: function (o) { return o.id; } },
        { key: 'kind', label: 'Type', get: function (o) { return o.kind; }, sort: function (o) { return o.kind; } },
        { key: 'placed', label: 'Placed', get: function (o) { return U.clock(o.placedAt); }, sort: function (o) { return o.placedAt; } },
        { key: 'city', label: 'City', get: function (o) { return OD.CITIES[o.city].name; }, sort: function (o) { return OD.CITIES[o.city].name; } },
        { key: 'partner', label: 'Restaurant / sender', get: function (o) { return o.partner.name; }, sort: function (o) { return o.partner.name; } },
        { key: 'customer', label: 'Customer', get: function (o) { return o.customer.name; }, sort: function (o) { return o.customer.name; } },
        { key: 'courier', label: 'Courier', get: function (o) { var v = o.courierId && OD.vehicle(o.courierId); return v ? v.driver.name : '—'; } },
        { key: 'total', label: 'Total', cls: 'num', get: function (o) { return money(o, o.totals.total); }, sort: function (o) { return o.totals.total; } },
        { key: 'late', label: 'Late', cls: 'num', get: function (o) { return o.lateMin && OPEN.indexOf(o.state) >= 0 ? o.lateMin + ' min' : '—'; }, sort: function (o) { return OPEN.indexOf(o.state) >= 0 ? o.lateMin : -1; } },
        { key: 'state', label: 'Status', get: function (o) { return st(label(o.state), TAG[o.state]); }, sort: function (o) { return o.state; } }],
      onRow: openOrder }));
  }
  function late(body) {
    var rows = OD.orders.filter(function (o) { return inScope(o) && OPEN.indexOf(o.state) >= 0 && o.lateMin > 0; }).sort(function (a, b) { return b.lateMin - a.lateMin; });
    var reasons = {}; rows.forEach(function (o) { reasons[o.issue || 'Other'] = (reasons[o.issue || 'Other'] || 0) + 1; });
    body.appendChild(h('div', { class: 'ops-grid ops-grid-late' }, [
      card('Late orders · ' + rows.length, [U.table({ rows: rows, pageSize: 15, state: { sort: null, dir: 1, page: 0 }, onRow: openOrder,
        columns: [{ key: 'id', label: 'Order', get: function (o) { return h('b', { text: o.id }); } }, { key: 'k', label: 'Type', get: function (o) { return o.kind; } },
          { key: 'p', label: 'Restaurant / sender', get: function (o) { return o.partner.name; } }, { key: 'c', label: 'City', get: function (o) { return OD.CITIES[o.city].name; } },
          { key: 'l', label: 'Late by', cls: 'num', get: function (o) { return st(o.lateMin + ' min', o.lateMin > 15 ? 'err' : 'warn'); } }, { key: 'r', label: 'Reason', get: function (o) { return o.issue || '—'; } },
          { key: 'a', label: '', get: function (o) { return btn('Credit', function (b) { credit(o, b); }, 'g'); } }] })]),
      card('Reasons', [h('table', { class: 'dt ops-dt' }, [h('tbody', null, Object.keys(reasons).sort(function (a, b) { return reasons[b] - reasons[a]; }).map(function (k) {
        return h('tr', null, [h('td', { text: k }), h('td', { class: 'num' }, [h('b', { text: String(reasons[k]) })])]);
      }))])])]));
  }
  function restaurantsTab(body) {
    var rows = OD.restaurants.filter(function (r) { return OD.inGeo(r.city, OPS.geo) && (!M.q || r.name.toLowerCase().indexOf(M.q) >= 0); });
    var open = function (r) { return OD.orders.filter(function (o) { return o.partner.id === r.id && OPEN.indexOf(o.state) >= 0; }).length; };
    body.appendChild(U.table({ rows: rows, pageSize: 20, state: M.rtable,
      columns: [{ key: 'name', label: 'Restaurant', get: function (r) { return h('b', { text: r.name }); }, sort: function (r) { return r.name; } },
        { key: 'city', label: 'City', get: function (r) { return OD.CITIES[r.city].name; }, sort: function (r) { return OD.CITIES[r.city].name; } },
        { key: 'status', label: 'Status', get: function (r) { return st(r.status === 'PAUSED' ? 'Paused ' + (r.pausedFor ? r.pausedFor + ' min' : '') : r.status === 'BUSY' ? 'Busy' : 'Open', r.status === 'PAUSED' ? 'warn' : r.status === 'BUSY' ? 'info' : 'ok'); }, sort: function (r) { return r.status; } },
        { key: 'open', label: 'Open orders', cls: 'num', get: function (r) { return String(open(r)); }, sort: open },
        { key: 'prep', label: 'Avg prep', cls: 'num', get: function (r) { return r.prep + ' min'; }, sort: function (r) { return r.prep; } },
        { key: 'rej', label: 'Rejected today', cls: 'num', get: function (r) { return r.rejects ? st(String(r.rejects), r.rejects > 3 ? 'err' : 'warn') : '0'; }, sort: function (r) { return r.rejects; } },
        { key: 'rating', label: 'Rating', cls: 'num', get: function (r) { return '★ ' + r.rating; }, sort: function (r) { return Number(r.rating); } },
        { key: 'act', label: '', get: function (r) {
          return h('span', { class: 'ops-acts' }, [
            r.status === 'PAUSED' ? btn('Resume', function (b) { setRest(r, 'OPEN', b); }, '') : btn('Pause', function (b) { pauseRest(r, b); }, 'g'),
            btn('Call', function (b) { U.act('order.manage', 'call restaurant ' + r.name, r.id, 'telephony.call', b).then(function (y) { if (y) UI.toast('Calling ' + r.name + ' (simulated).', 'info'); }); }, 'g'),
            btn('Orders', function () { M.q = r.name.toLowerCase(); M.tab = 'list'; M.state = ''; render(); }, 'g')]); } }] }));
  }
  function pauseRest(r, b) {
    U.form('Pause ' + r.name, [{ name: 'min', label: 'Pause for', type: 'select', options: [['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour'], ['240', 'Rest of the day']] },
      { name: 'why', label: 'Reason', type: 'select', options: [['Too many late orders', 'Too many late orders'], ['Partner asked', 'Partner asked'], ['Quality complaints', 'Quality complaints'], ['Kitchen closed', 'Kitchen closed']] }], 'Pause').then(function (f) {
      if (!f) return;
      U.act('order.manage', 'pause restaurant ' + r.name, r.id, 'partner.paused', b).then(function (y) { if (y) { r.status = 'PAUSED'; r.pausedFor = Number(f.min); UI.toast(r.name + ' is paused for new orders (' + f.why + ').', 'info'); drawTab(); } });
    });
  }
  function setRest(r, s, b) { U.act('order.manage', 'resume restaurant ' + r.name, r.id, 'partner.resumed', b).then(function (y) { if (y) { r.status = s; r.pausedFor = 0; UI.toast(r.name + ' accepts orders again.', 'info'); drawTab(); } }); }
  function volume(body) {
    var NS = 'http://www.w3.org/2000/svg', slots = [], now = Date.now(), start = new Date(); start.setHours(0, 0, 0, 0);
    for (var i = 0; i < 96; i++) slots.push({ food: 0, parcel: 0 });
    OD.orders.filter(inScope).forEach(function (o) { if (o.placedAt >= start.getTime()) { var k = Math.floor((o.placedAt - start.getTime()) / 900000); if (slots[k]) slots[k][o.kind === 'Food' ? 'food' : 'parcel']++; } });
    var max = Math.max.apply(null, slots.map(function (s) { return s.food + s.parcel; }).concat([1])), W = 960, H = 200, bw = W / 96;
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + W + ' ' + (H + 20)); s.setAttribute('class', 'ops-chart ops-chart-wide'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'Orders per 15 minutes today, food and parcel');
    slots.forEach(function (x, i) {
      var hf = x.food / max * H, hp = x.parcel / max * H;
      [[hf, H - hf, 'food'], [hp, H - hf - hp, 'parcel']].forEach(function (b) { if (!b[0]) return; var r = document.createElementNS(NS, 'rect'); r.setAttribute('x', (i * bw + 1).toFixed(1)); r.setAttribute('y', b[1].toFixed(1)); r.setAttribute('width', (bw - 2).toFixed(1)); r.setAttribute('height', b[0].toFixed(1)); r.setAttribute('class', b[2]); s.appendChild(r); });
      if (i % 8 === 0) { var t = document.createElementNS(NS, 'text'); t.setAttribute('x', (i * bw).toFixed(1)); t.setAttribute('y', String(H + 15)); t.textContent = String(i / 4).padStart(2, '0') + ':00'; s.appendChild(t); }
    });
    body.appendChild(card('Orders per 15 min · today · ' + OD.geoLabel(OPS.geo), [s, h('div', { class: 'ops-legend' }, [h('span', null, [h('i', { class: 'ops-dot food' }), 'Food']), h('span', null, [h('i', { class: 'ops-dot parcel' }), 'Parcel'])])]));
  }

  // ---------------------------------------------------------------- order panel
  function openOrder(o) {
    M.sel = o.id; var p = M.panel; if (!p) return;
    UI.clear(p); p.hidden = false;
    var city = OD.CITIES[o.city], cour = o.courierId && OD.vehicle(o.courierId), fl = flow(o), idx = fl.indexOf(o.state), open = OPEN.indexOf(o.state) >= 0;
    var close = btn('×', function () { M.sel = null; p.hidden = true; drawTab(); }, 'g ops-x', { 'aria-label': 'Close order details' });
    p.appendChild(h('div', { class: 'ops-dhead' }, [h('h2', { text: 'Order ' + o.id }), st(label(o.state), TAG[o.state]), o.lateMin && open ? st(o.lateMin + ' min late', 'err') : null, h('span', { class: 'sp' }), close]));
    p.appendChild(h('p', { class: 'ops-muted', text: o.kind + ' · ' + city.name + ' · placed ' + U.clock(o.placedAt) + ' · promised by ' + U.clock(o.promisedAt) + (open ? ' · ETA ' + U.clock(o.etaAt) : '') }));
    var steps = h('ol', { class: 'ops-steps', 'aria-label': 'Progress' });
    fl.forEach(function (s, i) { steps.appendChild(h('li', { class: i < idx || o.state === 'DELIVERED' ? 'done' : i === idx ? 'now' : '' , text: label(s) })); });
    p.appendChild(steps);
    var acts = h('div', { class: 'ops-actions' });
    var a = function (label2, perm, fn, cls, enabled, why) { var b = btn(label2, function () { fn(b); }, cls); if (!enabled) { b.disabled = true; b.title = why; } acts.appendChild(b); };
    var next = idx >= 0 && idx < fl.length - 1 ? fl[idx + 1] : null;
    a(next ? 'Move to “' + label(next) + '”' : 'Advance', 'order.manage', function (b) { advance(o, b); }, '', open && !!next, 'The order is closed');
    a(cour ? 'Reassign courier' : 'Assign courier', 'order.manage', function (b) { assignCourier(o, b); }, 'g', open, 'The order is closed');
    a('Credit customer', 'payment.refund', function (b) { credit(o, b); }, 'g', o.state !== 'CANCELLED', 'Already refunded');
    a('Cancel & refund', 'order.manage', function (b) { cancelOrder(o, b); }, 'r', open, 'The order is closed');
    a('Escalate to partner', 'order.manage', function (b) { escalate(o, b); }, 'g', o.kind === 'Food' && open, 'Only open food orders');
    a('Call customer', 'order.manage', function (b) { call(o, 'customer', o.customer.name, b); }, 'g', true);
    a('Call courier', 'order.manage', function (b) { call(o, 'courier', cour.driver.name, b); }, 'g', !!cour, 'No courier yet');
    a('Add note', 'order.manage', function (b) { noteOrder(o, b); }, 'g', true);
    p.appendChild(acts);
    p.appendChild(card('Items', [h('table', { class: 'dt ops-dt' }, [h('tbody', null, o.items.map(function (x) { return h('tr', null, [h('td', { text: x.qty + ' × ' + x.name }), h('td', { class: 'num', text: money(o, x.qty * x.price) })]); })
      .concat([['Delivery', o.totals.delivery], ['Taxes', o.totals.tax]].map(function (x) { return h('tr', null, [h('td', { text: x[0] }), h('td', { class: 'num', text: money(o, x[1]) })]); }))
      .concat([h('tr', { class: 'ops-total' }, [h('td', { text: 'Total · ' + o.payment.method + ' · ' + o.payment.state.toLowerCase() }), h('td', { class: 'num', text: money(o, o.totals.total) })])])
      .concat(o.credits.map(function (x) { return h('tr', null, [h('td', { text: 'Credit · ' + x.reason }), h('td', { class: 'num', text: '−' + money(o, x.amount) })]); })))])]));
    p.appendChild(card('People', [U.kv([[o.kind === 'Food' ? 'Restaurant' : 'Sender', o.partner.name], ['Customer', o.customer.name + ' · ' + o.customer.phone], ['Deliver to', o.customer.address],
      ['Courier', cour ? cour.driver.name + ' · ' + OD.TYPES[cour.type].label + ' · ' + cour.plate + ' · ' + OD.STATUS[cour.status] : 'Not assigned'], o.issue ? ['Issue', o.issue] : null])]));
    if (o.notes.length) p.appendChild(card('Internal notes', [h('ul', { class: 'ops-notes' }, o.notes.map(function (n) { return h('li', null, [h('b', { text: n.by }), ' · ' + U.clock(n.at) + ' – ' + n.text]); }))]));
    p.appendChild(card('Timeline', [U.timeline(o.timeline)]));
    var first = p.querySelector('button.dbtn:not([disabled])'); if (first && !p.contains(document.activeElement)) first.focus({ preventScroll: true });
  }
  function refresh(o) { drawTab(); openOrder(o); }
  function advance(o, b) {
    var fl = flow(o), next = fl[fl.indexOf(o.state) + 1];
    if ((next === 'PICKED_UP') && !o.courierId) { UI.toast('Assign a courier before pickup.', 'error'); return; }
    U.act('order.manage', 'move ' + o.id + ' to ' + next, o.id, 'order.updated', b).then(function (y) {
      if (!y) return;
      o.state = next; add(o, label(next) + ' (set by operations)');
      if (next === 'DELIVERED') { o.payment.state = 'CAPTURED'; o.etaAt = Date.now(); o.lateMin = Math.max(0, Math.round((o.etaAt - o.promisedAt) / 60000)); var v = o.courierId && OD.vehicle(o.courierId); if (v) { v.orderId = null; v.status = 'AVAILABLE'; } }
      refresh(o);
    });
  }
  function assignCourier(o, b) {
    var pool = OD.vehicles.filter(function (v) { return v.city === o.city && (v.type === 'delivery' || v.type === 'van' || v.type === 'bike') && v.status === 'AVAILABLE' && v.id !== o.courierId; }).slice(0, 12);
    if (!pool.length) { UI.toast('No free courier in ' + OD.CITIES[o.city].name + ' right now.', 'error'); return; }
    U.form((o.courierId ? 'Reassign' : 'Assign') + ' courier for ' + o.id, [{ name: 'v', label: 'Free couriers nearby', type: 'select', options: pool.map(function (v) { return [v.id, v.driver.name + ' · ' + OD.TYPES[v.type].label + ' · ★ ' + v.driver.rating]; }) }], 'Assign').then(function (f) {
      if (!f) return;
      U.act('order.manage', 'assign courier to ' + o.id, o.id, 'order.courier_assigned', b).then(function (y) {
        if (!y) return;
        var old = o.courierId && OD.vehicle(o.courierId); if (old) { old.orderId = null; old.status = 'AVAILABLE'; }
        var v = OD.vehicle(f.v); v.status = 'ON_TRIP'; v.orderId = o.id; o.courierId = v.id;
        if (o.issue === 'Courier unassigned') o.issue = null;
        add(o, (old ? 'Courier changed from ' + old.driver.name + ' to ' : 'Courier assigned: ') + v.driver.name); refresh(o);
      });
    });
  }
  function credit(o, b) {
    U.form('Credit the customer for ' + o.id, [{ name: 'amount', label: 'Amount (' + o.currency + ')', type: 'number', value: String(Math.round(o.totals.total * 0.15)), required: true,
      check: function (x) { var n = Number(x); return !(n > 0 && n <= o.totals.total) ? 'Enter an amount up to the order total (' + o.totals.total + ').' : null; } },
      { name: 'reason', label: 'Reason', type: 'select', options: [['Late delivery', 'Late delivery'], ['Missing item', 'Missing item'], ['Wrong item', 'Wrong item'], ['Quality issue', 'Quality issue'], ['Goodwill', 'Goodwill']] }], 'Credit').then(function (f) {
      if (!f) return;
      U.act('payment.refund', 'credit customer of ' + o.id, o.id, 'refund.issued', b).then(function (y) { if (y) { var n = Math.round(Number(f.amount) * 100) / 100; o.credits.push({ amount: n, reason: f.reason, at: Date.now() }); add(o, 'Customer credited ' + money(o, n) + ' · ' + f.reason); UI.toast('Credit of ' + money(o, n) + ' added to the customer wallet (simulated).', 'info'); refresh(o); } });
    });
  }
  function cancelOrder(o, b) {
    U.form('Cancel order ' + o.id + ' and refund the customer?', [{ name: 'why', label: 'Reason', type: 'select', options: [['Restaurant cannot prepare', 'Restaurant cannot prepare'], ['No courier available', 'No courier available'], ['Customer request', 'Customer request'], ['Address not serviceable', 'Address not serviceable']] }], 'Cancel order', 'The full amount is refunded to the original payment method.').then(function (f) {
      if (!f) return;
      U.act('order.manage', 'cancel order ' + o.id, o.id, 'order.cancelled', b).then(function (y) {
        if (!y) return;
        o.state = 'CANCELLED'; o.payment.state = 'REFUNDED'; var v = o.courierId && OD.vehicle(o.courierId); if (v) { v.orderId = null; v.status = 'AVAILABLE'; }
        add(o, 'Cancelled by operations · ' + f.why + ' · full refund', 'a'); refresh(o);
      });
    });
  }
  function escalate(o, b) {
    U.form('Escalate ' + o.id + ' to ' + o.partner.name, [{ name: 'text', label: 'Message to the restaurant', type: 'textarea', required: true, value: 'Order ' + o.id + ' is running late. Please share an updated ready time.' }], 'Send').then(function (f) {
      if (!f) return;
      U.act('order.manage', 'escalate ' + o.id + ' to the partner', o.id, 'order.escalated', b).then(function (y) { if (y) { add(o, 'Escalated to ' + o.partner.name + ': “' + f.text + '”', 'a'); UI.toast('Sent to the partner app (simulated).', 'info'); refresh(o); } });
    });
  }
  function call(o, who, name, b) { U.act('order.manage', 'call ' + who + ' of ' + o.id, o.id, 'telephony.call', b).then(function (y) { if (y) { add(o, 'Operations called the ' + who); UI.toast('Calling ' + name + ' (simulated – no call is placed).', 'info'); refresh(o); } }); }
  function noteOrder(o, b) {
    U.form('Note on ' + o.id, [{ name: 'text', label: 'Note', type: 'textarea', required: true }], 'Add').then(function (f) {
      if (!f) return;
      U.act('order.manage', 'add a note to ' + o.id, o.id, 'order.note', b).then(function (y) { if (y) { o.notes.push({ at: Date.now(), by: U.me(), text: f.text }); refresh(o); } });
    });
  }

  K.def('A27', { init: render, update: function (ctx, s) {
    var ses = s.session.admin, dc = UI.q('#mock .dc');
    if (dc && dc.getAttribute('data-ops') !== ses.status + ses.role) render();
  } });
  RN.opsOrders = { state: M, render: render };
})();
