/* RideNova admin - Platform control (round 3).
   Single place where ops/pricing/growth teams manage everything the other apps read through RNPC (shared/platform.js).
   Every write: permission check (role matrix in config.roles) -> RNPC.update/opsUpdate -> audit entry -> live push to apps. */
(function () {
  'use strict';
  var PC = window.RNPC, main, nav, tab = (location.hash || '').replace('#', '') || 'overview';
  var ADMIN_KEY = 'ridenova.admin.v1', ROLE_KEY = 'ridenova.pc.role';
  // ---------------------------------------------------------------- helpers
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'on') Object.keys(v).forEach(function (e) { n.addEventListener(e, v[e]); });
      else if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
      else if (k === 'value') n.value = v; else if (k === 'checked') n.checked = !!v; else if (k === 'disabled') n.disabled = !!v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function (c) { if (c == null || c === false) return; n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return n;
  }
  var rs = PC.rs;
  function fdt(t) { if (!t) return '-'; var d = new Date(t); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
  function toast(msg, kind) { var box = document.getElementById('pc-toasts'), t = h('div', { class: 'pc-toast ' + (kind || 'info') }, msg); box.appendChild(t); setTimeout(function () { t.remove(); }, 3600); }
  function session() { try { var s = JSON.parse(localStorage.getItem(ADMIN_KEY) || '{}'); return s.session || {}; } catch (e) { return {}; } }
  var sess = session();
  function realRole() { return sess.role || 'OPS_MANAGER'; }
  function role() { var r = sessionStorage.getItem(ROLE_KEY); return r && PC.cfg.roles[r] ? r : realRole(); }
  function perms(r) { return PC.cfg.roles[r || role()] || []; }
  function can(p) { var ps = perms(); return ps.indexOf('*') >= 0 || ps.indexOf(p) >= 0; }
  function who() { return (sess.email || 'ops@ridenova.example') + ' (' + role() + ')'; }
  function denied(p) { toast('Your role (' + role() + ') cannot change ' + p + '. Ask a Super admin.', 'error'); }
  function cfgWrite(perm, action, detail, fn) {
    if (!can(perm)) { denied(perm); return false; }
    var v = PC.update(fn, { by: who(), role: role(), action: action, detail: detail, area: perm });
    toast(detail + ' \u00B7 live as v' + v, 'ok'); return true;
  }
  function opsWrite(perm, action, detail, fn) {
    if (!can(perm)) { denied(perm); return false; }
    PC.opsUpdate(fn, { by: who(), role: role(), action: action, detail: detail, area: perm }); toast(detail, 'ok'); return true;
  }
  function card(title, right, kids, cls) { return h('section', { class: 'pc-card ' + (cls || ''), 'aria-label': title }, [h('div', { class: 'pc-hd' }, [h('h2', null, title), h('span', { class: 'pc-sp' }), right || null]), h('div', { class: 'pc-bd' }, kids)]); }
  function btn(label, cls, fn, attrs) { return h('button', Object.assign({ type: 'button', class: 'pc-btn ' + (cls || ''), on: { click: fn } }, attrs || {}), label); }
  function tog(on, fn, label, perm) { var b = h('button', { type: 'button', class: 'pc-tog' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on), 'aria-label': label, 'data-perm': perm || '' }); b.addEventListener('click', function () { fn(!on); }); return b; }
  function badge(t, kind) { return h('span', { class: 'pc-st ' + (kind || '') }, t); }
  function num(val, attrs) { return h('input', Object.assign({ type: 'number', class: 'pc-in num', value: val, step: 'any', min: 0 }, attrs || {})); }
  function txt(val, attrs) { return h('input', Object.assign({ type: 'text', class: 'pc-in', value: val == null ? '' : val }, attrs || {})); }
  function sel(opts, cur, attrs) { return h('select', Object.assign({ class: 'pc-in' }, attrs || {}), opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o; return h('option', { value: v, selected: String(v) === String(cur) ? 'selected' : null }, l); })); }
  function field(label, input, hint) { input.id = input.id || 'f-' + Math.random().toString(36).slice(2, 8); return h('div', { class: 'pc-field' }, [h('label', { for: input.id }, label), input, hint ? h('span', { class: 'pc-hint' }, hint) : null, h('span', { class: 'pc-err', 'data-err-for': input.id, 'aria-live': 'polite' })]); }
  function ferr(input, msg) { var e = main.querySelector('[data-err-for="' + input.id + '"]'); if (e) e.textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (msg) input.focus(); return !!msg; }
  function table(cols, rows, empty) {
    if (!rows.length) return h('div', { class: 'pc-empty' }, empty || 'Nothing here yet.');
    return h('div', { class: 'pc-tw' }, h('table', { class: 'pc-t' }, [h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { scope: 'col' }, c[0]); }))), h('tbody', null, rows.map(function (r, i) { return h('tr', null, cols.map(function (c) { var v = c[1](r, i); return h('td', null, v == null ? '' : v); })); }))]));
  }
  function chips(opts, cur, fn) { return h('div', { class: 'pc-chips', role: 'tablist' }, opts.map(function (o) { return h('button', { type: 'button', role: 'tab', class: 'pc-chip pc-ro-ok' + (o === cur ? ' on' : ''), 'aria-selected': String(o === cur), on: { click: function () { fn(o); } } }, o); })); }
  function download(name, text, type) { var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'application/json' })), download: name }); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); X.lastDownload = { name: name, text: text }; }
  function csv(name, cols, rows) {
    var q = function (s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    download(name, [cols.map(function (c) { return q(c[0]); }).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(c[1](r)); }).join(','); })).join('\n'), 'text/csv'); toast('Exported ' + rows.length + ' rows to ' + name, 'ok');
  }
  // accessible dialog: fields = [{name,label,type,options,value,required}]
  function ask(title, fields, onOk, okLabel) {
    var old = document.querySelector('.pc-dlg-scrim'); if (old) old.remove();
    var form = h('form', { class: 'pc-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, novalidate: true }), ins = {};
    var scrim = h('div', { class: 'pc-dlg-scrim' }, form), escK = function (e) { if (e.key === 'Escape') close(); };
    function close() { scrim.remove(); document.removeEventListener('keydown', escK); }
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    form.appendChild(h('h3', null, title));
    fields.forEach(function (f) {
      var i = f.type === 'select' ? sel(f.options, f.value, { name: f.name }) : f.type === 'textarea' ? h('textarea', { class: 'pc-in', name: f.name, rows: 3 }, f.value || '') : h('input', { class: 'pc-in', name: f.name, type: f.type || 'text', value: f.value == null ? '' : f.value, step: 'any' });
      i.id = 'dlg-' + f.name; ins[f.name] = i; form.appendChild(h('div', { class: 'pc-field' }, [h('label', { for: i.id }, f.label), i, h('span', { class: 'pc-err', 'aria-live': 'polite' })]));
    });
    form.appendChild(h('div', { class: 'pc-row' }, [h('button', { type: 'submit', class: 'pc-btn' }, okLabel || 'Confirm'), btn('Cancel', 'g', close)]));
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var vals = {}, bad = false;
      fields.forEach(function (f) { var i = ins[f.name], v = i.value.trim(), er = i.parentNode.querySelector('.pc-err'); er.textContent = ''; if (f.required && !v) { er.textContent = f.label + ' is required.'; bad = true; } else if (f.type === 'number' && v && isNaN(+v)) { er.textContent = 'Enter a number.'; bad = true; } vals[f.name] = f.type === 'number' ? +v : v; });
      if (bad) return; if (onOk(vals) !== false) close();
    });
    document.addEventListener('keydown', escK); document.body.appendChild(scrim); var first = form.querySelector('input,select,textarea'); if (first) first.focus();
  }
  var X = window.RNPCX = { ask: ask };

  var TABS = [
    ['overview', 'Overview', null], ['services', 'Services & vehicles', 'services'], ['pricing', 'Pricing & surge', 'pricing'], ['zones', 'Cities & zones', 'zones'],
    ['offers', 'Offers & wallet', 'offers'], ['drivers', 'Drivers & KYC', 'drivers'], ['partners', 'Partners', 'partners'], ['customers', 'Customers', 'customers'],
    ['liveops', 'Live ops', 'liveops'], ['broadcasts', 'Broadcasts', 'broadcasts'], ['flags', 'Flags & maintenance', 'flags'], ['content', 'App content', 'content'],
    ['roles', 'Roles & permissions', 'config'], ['audit', 'Audit log', 'audit'], ['config', 'Config & export', 'config']
  ];
  var VIEW = {}, state = { pricingCity: null, bookingsFilter: 'All', bq: '', auditQ: '' };
  function counts() {
    var o = PC.ops, n = function (obj, f) { return Object.keys(obj).filter(function (k) { return f(obj[k]); }).length; };
    return { drivers: n(o.kyc, function (x) { return x.status === 'pending'; }), partners: n(o.partnerApps, function (x) { return x.status === 'pending'; }), liveops: n(o.sos, function (x) { return x.status !== 'Resolved'; }) + o.tickets.filter(function (t) { return t.status !== 'Resolved'; }).length };
  }
  function drawNav() {
    var c = counts(); nav.innerHTML = '';
    nav.appendChild(h('ul', null, TABS.map(function (t) { var n = c[t[0]]; return h('li', null, h('a', { href: '#' + t[0], class: t[0] === tab ? 'on' : '', 'aria-current': t[0] === tab ? 'page' : null, 'data-tab': t[0] }, [t[1], n ? h('span', { class: 'pc-cnt', 'aria-label': n + ' pending' }, String(n)) : null, t[2] && !can(t[2]) ? h('span', { class: 'pc-lock', title: 'Read only for your role', 'aria-label': 'read only' }, '\uD83D\uDD12') : null])); })));
  }
  var dirty = false;
  function render() { dirty = false;
    if (!main) return; var t = TABS.filter(function (x) { return x[0] === tab; })[0] || TABS[0]; tab = t[0];
    document.getElementById('pc-ver').textContent = 'Config v' + PC.cfg.version + (PC.cfg.updatedAt ? ' \u00B7 updated ' + fdt(PC.cfg.updatedAt) + ' by ' + String(PC.cfg.updatedBy).split(' (')[0] : ' \u00B7 bundled default');
    drawNav(); var y = window.scrollY; main.innerHTML = ''; main.appendChild(h('h1', { class: 'pc-h1' }, t[1]));
    var ro = t[2] && !can(t[2]);
    if (ro) main.appendChild(h('div', { class: 'pc-banner warn', role: 'note' }, 'Read only: your role (' + role() + ') does not have the "' + t[2] + '" permission. Controls are disabled.'));
    VIEW[tab](main);
    if (ro) main.querySelectorAll('.pc-bd input, .pc-bd select, .pc-bd textarea, .pc-bd button, .pc-hd button, .pc-hd input').forEach(function (n) { if (!n.classList.contains('pc-ro-ok')) n.disabled = true; });
    window.scrollTo(0, y);
  }
  function go(t) { tab = t; if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t); render(); main.focus({ preventScroll: true }); }
  function auditTable(rows) { return table([['When', function (a) { return fdt(a.at); }], ['Who', function (a) { return String(a.by || '').split(' (')[0]; }], ['Role', function (a) { return a.role || '-'; }], ['Action', function (a) { return h('code', null, a.action); }], ['Detail', function (a) { return (a.detail || '') + (a.v ? ' (v' + a.v + ')' : ''); }]], rows, 'No changes yet.'); }
  function kpis(list, cls) { return h('div', { class: 'pc-kpis ' + (cls || '') }, list.map(function (x) { return h('div', { class: 'pc-kpi' }, [h('span', null, x[0]), h('b', x[2] ? { 'data-k': x[2] } : null, x[1])]); })); }
  function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function zoneOf(d, id) { var r = null; d.cities.forEach(function (c) { c.zones.forEach(function (z) { if (z.id === id) r = z; }); }); return r; }
  function move(list, id, dir) { list.sort(function (a, b) { return a.order - b.order; }); var i = list.findIndex(function (x) { return x.id === id; }), j = i + dir; if (j < 0 || j >= list.length) return; var a = list[i]; list[i] = list[j]; list[j] = a; list.forEach(function (x, k) { x.order = k + 1; }); }
  function editIn(input, perm, action, detailFn, apply, validate) { input.addEventListener('change', function () { var v = input.value.trim(), er = validate ? validate(v) : ''; if (er) { toast(er, 'error'); render(); return; } cfgWrite(perm, action, detailFn(v), function (d) { apply(d, v); }); }); return input; }

  // ---------------------------------------------------------------- overview
  VIEW.overview = function (m) {
    var c = PC.cfg, o = PC.ops, cn = counts();
    m.appendChild(kpis([['Config version', 'v' + c.version], ['Services live', PC.services().length + ' / ' + c.services.length], ['Vehicle types live', c.vehicles.filter(function (v) { return v.on; }).length + ' / ' + c.vehicles.length], ['Active coupons', String(PC.coupons().length)], ['KYC waiting', String(cn.drivers)], ['Partner apps waiting', String(cn.partners)], ['Open SOS + tickets', String(cn.liveops)], ['Broadcasts live', String(PC.broadcastsFor('customer').length)]]));
    var mt = Object.keys(c.maintenance).filter(function (a) { return a !== 'message' && c.maintenance[a]; });
    if (mt.length) m.appendChild(h('div', { class: 'pc-banner warn', role: 'alert' }, 'Maintenance mode is ON for: ' + mt.join(', ') + '.'));
    m.appendChild(h('div', { class: 'pc-banner info' }, 'Changes here reach every open RideNova app in this browser within a second. Serve the repo root (py -m http.server 8080) so all apps share one origin; use Config & export to move settings to another machine.'));
    m.appendChild(card('Needs attention', null, h('div', { class: 'pc-row wrap' }, [btn('Review KYC (' + cn.drivers + ')', cn.drivers ? '' : 'g', function () { go('drivers'); }), btn('Partner applications (' + cn.partners + ')', cn.partners ? '' : 'g', function () { go('partners'); }), btn('SOS & tickets (' + cn.liveops + ')', cn.liveops ? 'danger' : 'g', function () { go('liveops'); }), btn('Fare preview', 'g', function () { go('pricing'); })])));
    m.appendChild(card('Recent changes', btn('Full audit log', 'g', function () { go('audit'); }), auditTable(o.audit.slice(0, 8))));
  };

  // ---------------------------------------------------------------- services & vehicles
  var ICONS = ['car', 'bike', 'auto', 'car2', 'map', 'users', 'bus', 'key', 'bed', 'food', 'box', 'sparkle', 'percent', 'bolt', 'pin', 'wallet'];
  VIEW.services = function (m) {
    var c = PC.cfg, svc = c.services.slice().sort(function (a, b) { return a.order - b.order; });
    m.appendChild(h('div', { class: 'pc-banner info' }, 'Home-screen tiles of the customer super-app. Turning a tile off hides it for every rider immediately; the order sets its grid position.'));
    m.appendChild(card('Home-screen services', null, table([
      ['#', function (s, i) { return String(i + 1); }],
      ['Service', function (s) { return editIn(txt(s.label, { 'aria-label': 'Label for ' + s.id, maxlength: 18 }), 'services', 'service.rename', function (v) { return 'Renamed tile ' + s.label + ' \u2192 ' + v; }, function (d, v) { byId(d.services, s.id).label = v; }, function (v) { return v ? '' : 'Label cannot be empty.'; }); }],
      ['Icon', function (s) { return editIn(sel(ICONS, s.icon, { 'aria-label': 'Icon for ' + s.label }), 'services', 'service.icon', function (v) { return s.label + ' icon \u2192 ' + v; }, function (d, v) { byId(d.services, s.id).icon = v; }); }],
      ['Badge', function (s) { return editIn(txt(s.badge, { 'aria-label': 'Badge for ' + s.label, maxlength: 5, class: 'pc-in sm' }), 'services', 'service.badge', function (v) { return s.label + ' badge \u2192 "' + v + '"'; }, function (d, v) { byId(d.services, s.id).badge = v; }); }],
      ['Opens', function (s) { return h('code', null, s.go + (s.arg ? ' \u00B7 ' + s.arg : '')); }],
      ['Order', function (s, i) { return h('span', { class: 'pc-row' }, [btn('\u2191', 'g sm', function () { cfgWrite('services', 'service.order', 'Moved ' + s.label + ' up', function (d) { move(d.services, s.id, -1); }); }, { 'aria-label': 'Move ' + s.label + ' up', disabled: i === 0 }), btn('\u2193', 'g sm', function () { cfgWrite('services', 'service.order', 'Moved ' + s.label + ' down', function (d) { move(d.services, s.id, 1); }); }, { 'aria-label': 'Move ' + s.label + ' down', disabled: i === svc.length - 1 })]); }],
      ['Live', function (s) { return tog(s.on, function (v) { cfgWrite('services', v ? 'service.enable' : 'service.disable', (v ? 'Enabled ' : 'Disabled ') + s.label + ' tile', function (d) { byId(d.services, s.id).on = v; }); }, s.label + ' live', 'services'); }]
    ], svc)));
    var veh = c.vehicles.slice().sort(function (a, b) { return a.order - b.order; });
    m.appendChild(card('Vehicle types (ride options)', null, table([
      ['Vehicle', function (v) { return h('b', null, v.label); }],
      ['Note shown to riders', function (v) { return editIn(txt(v.note, { 'aria-label': 'Note for ' + v.label, maxlength: 40 }), 'services', 'vehicle.note', function () { return v.label + ' note updated'; }, function (d, x) { byId(d.vehicles, v.id).note = x; }); }],
      ['Seats', function (v) { return String(v.seats); }],
      ['ETA (min)', function (v) { return editIn(num(v.eta, { 'aria-label': 'ETA for ' + v.label, class: 'pc-in num sm', min: 1, max: 30 }), 'services', 'vehicle.eta', function (x) { return v.label + ' ETA \u2192 ' + x + ' min'; }, function (d, x) { byId(d.vehicles, v.id).eta = +x; }, function (x) { return +x >= 1 && +x <= 30 ? '' : 'ETA must be 1-30 minutes.'; }); }],
      ['Order', function (v, i) { return h('span', { class: 'pc-row' }, [btn('\u2191', 'g sm', function () { cfgWrite('services', 'vehicle.order', 'Moved ' + v.label + ' up', function (d) { move(d.vehicles, v.id, -1); }); }, { 'aria-label': 'Move ' + v.label + ' up', disabled: i === 0 }), btn('\u2193', 'g sm', function () { cfgWrite('services', 'vehicle.order', 'Moved ' + v.label + ' down', function (d) { move(d.vehicles, v.id, 1); }); }, { 'aria-label': 'Move ' + v.label + ' down', disabled: i === veh.length - 1 })]); }],
      ['Live', function (v) { return tog(v.on, function (on) { if (!on && c.vehicles.filter(function (x) { return x.on; }).length === 1) { toast('At least one vehicle type must stay live.', 'error'); return; } cfgWrite('services', on ? 'vehicle.enable' : 'vehicle.disable', (on ? 'Enabled ' : 'Disabled ') + v.label, function (d) { byId(d.vehicles, v.id).on = on; }); }, v.label + ' live', 'services'); }]
    ], veh)));
  };

  // ---------------------------------------------------------------- pricing
  var RF = [['base', 'Base \u20B9'], ['perKm', 'Per km \u20B9'], ['perMin', 'Per min \u20B9'], ['minFare', 'Min fare \u20B9'], ['bookingFee', 'Booking fee \u20B9'], ['freeWaitMin', 'Free wait min'], ['waitPerMin', 'Wait \u20B9/min'], ['cancelFee', 'Cancel fee \u20B9'], ['nightPct', 'Night %'], ['commissionPct', 'Commission %']];
  VIEW.pricing = function (m) {
    var c = PC.cfg, p = c.pricing, cities = Object.keys(p.cities), city = state.pricingCity && p.cities[state.pricingCity] ? state.pricingCity : (p.cities[c.defaultCity] ? c.defaultCity : cities[0]); state.pricingCity = city;
    m.appendChild(h('div', { class: 'pc-row wrap' }, [chips(cities, city, function (o) { state.pricingCity = o; render(); }), h('span', { class: 'pc-sp' }), h('span', { class: 'pc-hint' }, 'Rate cards are per city and vehicle. Riders see new fares on their next quote; open apps refresh live.')]));
    var inputs = [];
    var tb = table([['Vehicle', function (id) { return h('b', null, id); }]].concat(RF.map(function (f) {
      return [f[1], function (id) { var r = p.cities[city][id] || {}; var i = num(r[f[0]] != null ? r[f[0]] : 0, { 'aria-label': id + ' ' + f[1], class: 'pc-in num sm', 'data-veh': id, 'data-k': f[0], max: f[0] === 'commissionPct' || f[0] === 'nightPct' ? 100 : 5000 }); inputs.push(i); return i; }];
    })), c.vehicles.map(function (v) { return v.id; }));
    var note = txt('', { name: 'pnote', placeholder: 'Why are you changing fares? (required, goes to the audit log)', maxlength: 120 });
    m.appendChild(card('Rate card \u00B7 ' + city, h('span', { class: 'pc-row' }, [btn('Save rate card', '', function () {
      var bad = null, changes = [], next = JSON.parse(JSON.stringify(p.cities[city]));
      inputs.forEach(function (i) { var v = +i.value, k = i.dataset.k, id = i.dataset.veh; i.removeAttribute('aria-invalid'); if (i.value === '' || isNaN(v) || v < 0 || v > +i.max) { bad = bad || i; i.setAttribute('aria-invalid', 'true'); return; } next[id] = next[id] || {}; if (next[id][k] !== v) { changes.push(id + ' ' + k + ' ' + next[id][k] + '\u2192' + v); next[id][k] = v; } });
      if (bad) { bad.focus(); toast('Fix the highlighted value (0 - ' + bad.max + ').', 'error'); return; }
      if (!changes.length) { toast('Nothing changed.', 'info'); return; }
      if (ferr(note, note.value.trim().length < 4 ? 'Add a short reason (4+ characters).' : '')) return;
      cfgWrite('pricing', 'pricing.rate_card', city + ': ' + changes.slice(0, 4).join(', ') + (changes.length > 4 ? ' +' + (changes.length - 4) + ' more' : '') + ' \u2014 ' + note.value.trim(), function (d) { d.pricing.cities[city] = next; });
    }), btn('Discard', 'g', function () { render(); })]), [tb, field('Change reason', note)]));
    var tax = num(p.taxPct, { max: 28, 'aria-label': 'GST %' }), nf = num(p.night.from, { min: 0, max: 23 }), nt = num(p.night.to, { min: 0, max: 23 }), cap = num(p.surge.cap, { min: 1, max: 5 });
    m.appendChild(card('Taxes, night window & surge cap', btn('Save', '', function () {
      var t = +tax.value, a = +nf.value, b = +nt.value, cp = +cap.value;
      if (ferr(tax, !(t >= 0 && t <= 28) ? 'GST must be 0-28%.' : '') || ferr(nf, !(a >= 0 && a <= 23) ? 'Hour 0-23.' : '') || ferr(nt, !(b >= 0 && b <= 23) ? 'Hour 0-23.' : '') || ferr(cap, !(cp >= 1 && cp <= 5) ? 'Cap must be 1-5x (regulators cap surge).' : '')) return;
      cfgWrite('pricing', 'pricing.globals', 'GST ' + t + '%, night ' + a + ':00-' + b + ':00, surge cap ' + cp + 'x', function (d) { d.pricing.taxPct = t; d.pricing.night = { from: a, to: b }; d.pricing.surge.cap = cp; });
    }), h('div', { class: 'pc-grid4' }, [field('GST on rides %', tax), field('Night from (hour)', nf), field('Night to (hour)', nt), field('Surge cap (x)', cap, 'Hard limit on any multiplier')])));
    var zones = ['*'].concat([].concat.apply([], c.cities.map(function (ci) { return ci.zones.map(function (z) { return z.id; }); })));
    m.appendChild(card('Surge rules', btn('Add rule', 'g', function () {
      ask('New surge rule', [{ name: 'zone', label: 'Zone (* = whole city)', type: 'select', options: zones, value: '*' }, { name: 'mult', label: 'Multiplier (e.g. 1.3)', type: 'number', value: 1.2, required: true }, { name: 'from', label: 'From hour (0-23)', type: 'number', value: 18, required: true }, { name: 'to', label: 'To hour (0-23)', type: 'number', value: 21, required: true }], function (v) {
        if (!(v.mult > 1 && v.mult <= p.surge.cap)) { toast('Multiplier must be above 1 and at most the cap (' + p.surge.cap + 'x).', 'error'); return false; }
        if (!(v.from >= 0 && v.from <= 23 && v.to >= 0 && v.to <= 23)) { toast('Hours must be 0-23.', 'error'); return false; }
        cfgWrite('pricing', 'surge.add', 'Surge ' + v.mult + 'x in ' + v.zone + ' ' + v.from + '-' + v.to + 'h', function (d) { d.pricing.surge.rules.push({ id: PC.uid('SR'), zone: v.zone, mult: v.mult, from: v.from, to: v.to, on: true }); });
      }, 'Add rule');
    }), table([['Zone', function (r) { return r.zone === '*' ? 'Whole city' : r.zone; }], ['Multiplier', function (r) { return r.mult + 'x'; }], ['Hours', function (r) { return r.from + ':00 - ' + r.to + ':00'; }], ['Live', function (r) { return tog(r.on, function (v) { cfgWrite('pricing', 'surge.toggle', (v ? 'Enabled' : 'Paused') + ' surge ' + r.zone + ' ' + r.mult + 'x', function (d) { byId(d.pricing.surge.rules, r.id).on = v; }); }, 'Surge rule ' + r.zone + ' ' + r.from + '-' + r.to + ' live', 'pricing'); }], ['', function (r) { return btn('Delete', 'g sm', function () { cfgWrite('pricing', 'surge.delete', 'Deleted surge rule ' + r.zone + ' ' + r.mult + 'x', function (d) { d.pricing.surge.rules = d.pricing.surge.rules.filter(function (x) { return x.id !== r.id; }); }); }, { 'aria-label': 'Delete surge rule ' + r.zone + ' ' + r.from + '-' + r.to }); }]], p.surge.rules, 'No surge rules. Fares are flat all day.')));
    var cv = sel(c.vehicles.map(function (v) { return v.id; }), 'Cab', { name: 'cveh' }), ck = num(9.8, { name: 'ckm', max: 500 }), cm = num(27, { name: 'cmin', max: 600 }), chr = num(new Date().getHours(), { name: 'chour', min: 0, max: 23 });
    var zl = (byId(c.cities, city) || { zones: [] }).zones.filter(function (z) { return z.match; }).map(function (z) { return [z.match, z.name]; }), cpl = sel([['', 'City (no zone)']].concat(zl), '', { name: 'cplace' });
    var out = h('div', { class: 'pc-calc-out', 'aria-live': 'polite', id: 'pc-calc-out' });
    function calc() {
      var km = Math.max(0, +ck.value || 0), mins = Math.max(0, +cm.value || 0), q = PC.fare(cv.value, km, mins, { city: city, hour: Math.min(23, Math.max(0, +chr.value || 0)), places: cpl.value ? [cpl.value] : [] });
      out.innerHTML = ''; if (!q) { out.appendChild(h('div', { class: 'pc-empty' }, 'No rate card for ' + cv.value + ' in ' + city + '.')); return; }
      var tax = PC.tax(q.prePaise), comm = Math.round(q.prePaise * q.commissionPct / 100);
      out.appendChild(table([['Line', function (l) { return l[0]; }], ['Amount', function (l) { return rs(l[1]); }]], q.lines.concat([['GST ' + q.taxPct + '%', tax]])));
      out.appendChild(kpis([['Rider pays', rs(q.prePaise + tax), 'total'], ['Platform commission ' + q.commissionPct + '%', rs(comm), 'comm'], ['Driver earns', rs(q.prePaise - comm), 'driver'], ['Surge', q.surge + 'x' + (q.night ? ' + night' : ''), 'surge']], 'sm'));
    }
    [cv, ck, cm, chr, cpl].forEach(function (i) { i.addEventListener('input', calc); i.addEventListener('change', calc); i.classList.add('pc-ro-ok'); });
    m.appendChild(card('Fare preview calculator', h('span', { class: 'pc-hint' }, 'Same formula the customer app uses'), [h('div', { class: 'pc-grid5' }, [field('Vehicle', cv), field('Distance km', ck), field('Duration min', cm), field('Hour of day', chr), field('Pickup / drop zone', cpl)]), out]));
    calc();
  };

  // ---------------------------------------------------------------- cities & zones
  VIEW.zones = function (m) {
    var c = PC.cfg, V = c.vehicles.map(function (v) { return v.id; });
    m.appendChild(h('div', { class: 'pc-banner info' }, 'Geofences are a static list in this demo. A zone applies to a trip when its match text appears in the pickup or drop name (for example "Airport"). Zones add their fee and can block vehicle types.'));
    c.cities.forEach(function (ci) {
      var add = btn('Add zone', 'g sm', function () {
        ask('New zone in ' + ci.name, [{ name: 'id', label: 'Zone id (e.g. HYD-KPHB)', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['standard', 'surge', 'airport', 'no-pickup'], value: 'standard' }, { name: 'match', label: 'Match text in place names (optional)' }, { name: 'fee', label: 'Zone fee \u20B9', type: 'number', value: 0 }], function (v) {
          var id = v.id.toUpperCase().replace(/[^A-Z0-9-]/g, ''); if (!id) { toast('Enter a zone id.', 'error'); return false; }
          if (c.cities.some(function (x) { return x.zones.some(function (z) { return z.id === id; }); })) { toast('Zone id ' + id + ' already exists.', 'error'); return false; }
          if (!(v.fee >= 0 && v.fee <= 1000)) { toast('Fee must be 0-1000.', 'error'); return false; }
          var svc = {}; V.forEach(function (x) { svc[x] = true; });
          cfgWrite('zones', 'zone.add', 'Added zone ' + id + ' (' + v.type + ')', function (d) { byId(d.cities, ci.id).zones.push({ id: id, name: v.name, type: v.type, on: true, fee: v.fee, match: v.match || '', services: svc }); });
        }, 'Add zone');
      }, { 'aria-label': 'Add zone in ' + ci.name });
      m.appendChild(card(ci.name + ' (' + ci.id + ')', h('span', { class: 'pc-row' }, [h('span', { class: 'pc-hint' }, ci.on ? 'Live' : 'Paused'), tog(ci.on, function (v) { if (!v && ci.id === c.defaultCity) { toast('The default city cannot be paused.', 'error'); return; } cfgWrite('zones', 'city.toggle', (v ? 'Opened ' : 'Paused ') + ci.name, function (d) { byId(d.cities, ci.id).on = v; }); }, ci.name + ' live', 'zones'), add]),
        table([['Zone', function (z) { return h('span', null, [h('b', null, z.name), h('div', { class: 'pc-hint' }, z.id + (z.match ? ' \u00B7 matches "' + z.match + '"' : ''))]); }], ['Type', function (z) { return badge(z.type, z.type === 'airport' ? 'info' : z.type === 'no-pickup' ? 'bad' : z.type === 'surge' ? 'warn' : ''); }],
          ['Fee \u20B9', function (z) { return editIn(num(z.fee || 0, { class: 'pc-in num sm', max: 1000, 'aria-label': z.name + ' fee' }), 'zones', 'zone.fee', function (v) { return z.id + ' fee \u2192 \u20B9' + v; }, function (d, v) { zoneOf(d, z.id).fee = +v; }, function (v) { return +v >= 0 && +v <= 1000 ? '' : 'Fee must be 0-1000.'; }); }]]
          .concat(V.map(function (vid) { return [vid, function (z) { return tog(!z.services || z.services[vid] !== false, function (on) { cfgWrite('zones', 'zone.service', vid + (on ? ' allowed in ' : ' blocked in ') + z.id, function (d) { var zz = zoneOf(d, z.id); zz.services = zz.services || {}; zz.services[vid] = on; }); }, vid + ' in ' + z.name, 'zones'); }]; }))
          .concat([['Live', function (z) { return tog(z.on, function (v) { cfgWrite('zones', 'zone.toggle', (v ? 'Enabled ' : 'Disabled ') + z.id, function (d) { zoneOf(d, z.id).on = v; }); }, z.name + ' live', 'zones'); }]]), ci.zones, 'No zones yet.')));
    });
  };

  // ---------------------------------------------------------------- offers & wallet
  var CATS = ['ride', 'food', 'parcel', 'hotel', 'bus', 'share', 'rental'];
  function used(cp) { return (cp.used || 0) + ((PC.ops.couponUse || {})[cp.code] || 0); }
  function couponDlg(cp) {
    var isNew = !cp; cp = cp || { code: '', title: '', sub: '', cat: 'ride', pct: 20, cap: 10000, min: 0, limit: 1000, used: 0, ends: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), on: true };
    ask(isNew ? 'New coupon' : 'Edit ' + cp.code, [{ name: 'code', label: 'Code (4-12 letters or digits)', value: cp.code, required: true }, { name: 'title', label: 'Title shown to customers', value: cp.title, required: true }, { name: 'sub', label: 'Terms line', value: cp.sub }, { name: 'cat', label: 'Category', type: 'select', options: CATS, value: cp.cat }, { name: 'kind', label: 'Discount type', type: 'select', options: [['pct', 'Percent'], ['flat', 'Flat \u20B9']], value: cp.flat ? 'flat' : 'pct' }, { name: 'val', label: 'Percent or flat \u20B9', type: 'number', value: cp.flat ? cp.flat / 100 : cp.pct, required: true }, { name: 'cap', label: 'Max discount \u20B9 (percent only)', type: 'number', value: (cp.cap || 0) / 100 }, { name: 'min', label: 'Minimum order \u20B9', type: 'number', value: (cp.min || 0) / 100 }, { name: 'limit', label: 'Total redemptions allowed', type: 'number', value: cp.limit, required: true }, { name: 'ends', label: 'Valid until', type: 'date', value: cp.ends, required: true }], function (v) {
      var code = v.code.toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9]{4,12}$/.test(code)) { toast('Code must be 4-12 letters or digits.', 'error'); return false; }
      if ((isNew || code !== cp.code) && PC.cfg.offers.coupons.some(function (x) { return x.code === code; })) { toast(code + ' already exists.', 'error'); return false; }
      if (v.kind === 'pct' && !(v.val > 0 && v.val <= 100)) { toast('Percent must be 1-100.', 'error'); return false; }
      if (v.kind === 'flat' && !(v.val > 0 && v.val <= 5000)) { toast('Flat discount must be \u20B91-5000.', 'error'); return false; }
      if (!(v.limit >= 1)) { toast('Redemption limit must be at least 1.', 'error'); return false; }
      var rec = { code: code, title: v.title, sub: v.sub, cat: v.cat, min: Math.round((v.min || 0) * 100), limit: Math.round(v.limit), used: cp.used || 0, ends: v.ends, on: cp.on !== false, tone: cp.tone || 'brand' };
      if (v.kind === 'flat') rec.flat = Math.round(v.val * 100); else { rec.pct = v.val; rec.cap = Math.round((v.cap || 0) * 100) || 1000000; }
      cfgWrite('offers', isNew ? 'coupon.create' : 'coupon.edit', (isNew ? 'Created coupon ' : 'Edited coupon ') + code, function (d) { if (isNew) d.offers.coupons.unshift(rec); else d.offers.coupons = d.offers.coupons.map(function (x) { return x.code === cp.code ? rec : x; }); });
    }, isNew ? 'Create coupon' : 'Save coupon');
  }
  function cpOf(d, code) { return d.offers.coupons.filter(function (z) { return z.code === code; })[0]; }
  VIEW.offers = function (m) {
    var o = PC.cfg.offers;
    m.appendChild(card('Coupons', btn('New coupon', '', function () { couponDlg(null); }), table([
      ['Code', function (x) { return h('b', null, x.code); }], ['Offer', function (x) { return h('span', null, [x.title, h('div', { class: 'pc-hint' }, x.cat + ' \u00B7 ' + (x.flat ? rs(x.flat) + ' off' : x.pct + '% up to ' + rs(x.cap)) + (x.min ? ' \u00B7 min ' + rs(x.min) : ''))]); }],
      ['Used', function (x) { var u = used(x); return h('span', null, [u + ' / ' + x.limit, h('div', { class: 'pc-bar' }, h('i', { style: 'width:' + Math.min(100, Math.round(u / x.limit * 100)) + '%' }))]); }],
      ['Ends', function (x) { return x.ends; }], ['State', function (x) { var s = PC.couponState(Object.assign({}, x, { used: used(x) })); return badge(s, s === 'active' ? 'ok' : s === 'paused' ? '' : 'bad'); }],
      ['Live', function (x) { return tog(x.on, function (v) { cfgWrite('offers', 'coupon.toggle', (v ? 'Resumed ' : 'Paused ') + x.code, function (d) { cpOf(d, x.code).on = v; }); }, x.code + ' live', 'offers'); }],
      ['', function (x) { return h('span', { class: 'pc-row' }, [btn('Edit', 'g sm', function () { couponDlg(x); }, { 'aria-label': 'Edit ' + x.code }), btn('Expire now', 'g sm', function () { var y = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10); cfgWrite('offers', 'coupon.expire', 'Expired coupon ' + x.code, function (d) { cpOf(d, x.code).ends = y; }); }, { 'aria-label': 'Expire ' + x.code })]); }]
    ], o.coupons)));
    var rr = num(o.referral.referrerPaise / 100, { max: 2000 }), re = num(o.referral.refereePaise / 100, { max: 2000 }), cb = num(o.cashback.pct, { max: 50 }), cbc = num(o.cashback.capPaise / 100, { max: 5000 });
    m.appendChild(card('Referral & cashback', btn('Save', '', function () {
      if (ferr(rr, !(+rr.value >= 0 && +rr.value <= 2000) ? '0-2000' : '') || ferr(re, !(+re.value >= 0 && +re.value <= 2000) ? '0-2000' : '') || ferr(cb, !(+cb.value >= 0 && +cb.value <= 50) ? '0-50%' : '') || ferr(cbc, !(+cbc.value >= 0 && +cbc.value <= 5000) ? '0-5000' : '')) return;
      cfgWrite('offers', 'offers.wallet_rules', 'Referral \u20B9' + rr.value + ' / \u20B9' + re.value + ', cashback ' + cb.value + '% cap \u20B9' + cbc.value, function (d) { d.offers.referral.referrerPaise = Math.round(rr.value * 100); d.offers.referral.refereePaise = Math.round(re.value * 100); d.offers.cashback.pct = +cb.value; d.offers.cashback.capPaise = Math.round(cbc.value * 100); d.offers.cashback.on = +cb.value > 0; });
    }), h('div', { class: 'pc-grid4' }, [field('Referrer gets \u20B9', rr), field('New friend gets \u20B9', re), field('Wallet cashback %', cb, '0 = off'), field('Cashback cap \u20B9', cbc)])));
  };

  // ---------------------------------------------------------------- drivers
  var REJECT = ['Licence photo is blurred', 'RC does not match the vehicle number', 'Insurance has expired', 'Selfie does not match the ID', 'Name mismatch across documents', 'Other'];
  var SUSPEND = ['Safety complaint under review', 'Fraud / GPS spoofing', 'Documents expired', 'Repeated cancellations', 'Payment dispute', 'Other'];
  function decide(kind, rec, fields) { return function (s) { var t = s[kind][rec]; Object.assign(t, fields, { by: who(), decidedAt: Date.now() }); }; }
  VIEW.drivers = function (m) {
    var c = PC.cfg, o = PC.ops, kyc = Object.keys(o.kyc).map(function (k) { return Object.assign({ phone: k }, o.kyc[k]); }).sort(function (a, b) { return (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (b.at || 0) - (a.at || 0); });
    var auto = num(c.drivers.kycAutoApproveSecs, { max: 3600, id: 'pc-auto' });
    m.appendChild(card('KYC review queue', h('span', { class: 'pc-row' }, [h('label', { class: 'pc-hint', for: 'pc-auto' }, 'Auto-approve after (s, 0 = manual only)'), auto, btn('Save', 'g sm', function () { var v = +auto.value; if (!(v >= 0 && v <= 3600)) { toast('0-3600 seconds.', 'error'); return; } cfgWrite('drivers', 'kyc.auto', v ? 'KYC auto-approve after ' + v + 's' : 'KYC is manual review only', function (d) { d.drivers.kycAutoApproveSecs = v; }); }, { 'aria-label': 'Save KYC auto-approve' })]), table([
      ['Driver', function (k) { return h('span', null, [h('b', null, k.name || 'New driver'), h('div', { class: 'pc-hint' }, '+91 ' + k.phone + ' \u00B7 ' + (k.city || '-') + ' \u00B7 ' + (k.vehicle || '-'))]); }],
      ['Documents', function (k) { return (k.docs || []).join(', ') || '-'; }], ['Submitted', function (k) { return fdt(k.at); }],
      ['Status', function (k) { return h('span', null, [badge(k.status, k.status === 'approved' ? 'ok' : k.status === 'rejected' ? 'bad' : 'warn'), k.reason ? h('div', { class: 'pc-hint' }, k.reason) : null]); }],
      ['', function (k) { if (k.status !== 'pending') return h('span', { class: 'pc-hint' }, k.by ? 'by ' + String(k.by).split(' (')[0] : ''); var nm = k.name || k.phone; return h('span', { class: 'pc-row' }, [btn('Approve', 'sm', function () { opsWrite('drivers', 'kyc.approve', 'Approved KYC for ' + nm, decide('kyc', k.phone, { status: 'approved', reason: '' })); }, { 'aria-label': 'Approve ' + nm }), btn('Reject', 'danger sm', function () {
        ask('Reject documents of ' + nm, [{ name: 'reason', label: 'Reason (shown to the driver)', type: 'select', options: REJECT, value: REJECT[0] }, { name: 'note', label: 'Extra note (optional)' }], function (v) { var r = v.reason === 'Other' ? (v.note || 'Please re-upload your documents.') : v.reason + (v.note ? ' - ' + v.note : ''); opsWrite('drivers', 'kyc.reject', 'Rejected KYC for ' + nm + ': ' + r, decide('kyc', k.phone, { status: 'rejected', reason: r })); }, 'Reject');
      }, { 'aria-label': 'Reject ' + nm })]); }]
    ], kyc, 'No applications yet. New drivers appear here when they submit documents in the driver app.')));
    var dr = Object.keys(o.drivers).map(function (k) { return Object.assign({ phone: k }, o.drivers[k]); });
    m.appendChild(card('Drivers', null, table([
      ['Driver', function (d) { return h('span', null, [h('b', null, d.name || '-'), h('div', { class: 'pc-hint' }, '+91 ' + d.phone + ' \u00B7 ' + (d.vehicle || '') + ' ' + (d.plate || ''))]); }], ['City', function (d) { return d.city || '-'; }], ['Onboarding', function (d) { return d.stage || '-'; }], ['Last seen', function (d) { return fdt(d.seen); }],
      ['Status', function (d) { var s = d.status === 'suspended'; return h('span', null, [badge(s ? 'Suspended' : 'Active', s ? 'bad' : 'ok'), s && d.reason ? h('div', { class: 'pc-hint' }, d.reason) : null]); }],
      ['', function (d) { var nm = d.name || d.phone; return d.status === 'suspended' ? btn('Reactivate', 'sm', function () { opsWrite('drivers', 'driver.reactivate', 'Reactivated driver ' + nm, decide('drivers', d.phone, { status: 'active', reason: '' })); }, { 'aria-label': 'Reactivate ' + nm }) : btn('Suspend', 'danger sm', function () {
        ask('Suspend ' + nm, [{ name: 'reason', label: 'Reason (shown to the driver)', type: 'select', options: SUSPEND, value: SUSPEND[0] }, { name: 'note', label: 'Internal note (optional)' }], function (v) { opsWrite('drivers', 'driver.suspend', 'Suspended driver ' + nm + ': ' + v.reason + (v.note ? ' (' + v.note + ')' : ''), decide('drivers', d.phone, { status: 'suspended', reason: v.reason })); }, 'Suspend');
      }, { 'aria-label': 'Suspend ' + nm }); }]
    ], dr, 'No drivers have opened the driver app yet.')));
    m.appendChild(card('Incentives & quests', btn('Add quest', 'g', function () {
      ask('New quest', [{ name: 'title', label: 'Title (shown to drivers)', required: true }, { name: 'target', label: 'Trips needed', type: 'number', value: 10, required: true }, { name: 'reward', label: 'Reward \u20B9', type: 'number', value: 150, required: true }], function (v) { if (!(v.target >= 1 && v.target <= 500) || !(v.reward > 0 && v.reward <= 10000)) { toast('Trips 1-500 and reward \u20B91-10000.', 'error'); return false; } cfgWrite('drivers', 'quest.add', 'Added quest "' + v.title + '"', function (d) { d.drivers.quests.push({ id: PC.uid('Q'), title: v.title, target: Math.round(v.target), rewardPaise: Math.round(v.reward * 100), on: true }); }); }, 'Add quest');
    }), table([['Quest', function (q) { return q.title; }], ['Target', function (q) { return q.target + ' trips'; }], ['Reward', function (q) { return rs(q.rewardPaise); }], ['Live', function (q) { return tog(q.on, function (v) { cfgWrite('drivers', 'quest.toggle', (v ? 'Enabled ' : 'Paused ') + 'quest ' + q.title, function (d) { byId(d.drivers.quests, q.id).on = v; }); }, q.title + ' live', 'drivers'); }]], c.drivers.quests)));
    var pm = num(c.drivers.payout.minPaise / 100, { max: 10000 }), pf = num(c.drivers.payout.instantFeePaise / 100, { max: 100 });
    m.appendChild(card('Driver payouts', btn('Save', '', function () { if (ferr(pm, !(+pm.value >= 0 && +pm.value <= 10000) ? '0-10000' : '') || ferr(pf, !(+pf.value >= 0 && +pf.value <= 100) ? '0-100' : '')) return; cfgWrite('drivers', 'payout.rules', 'Driver payout min \u20B9' + pm.value + ', instant fee \u20B9' + pf.value, function (d) { d.drivers.payout.minPaise = Math.round(pm.value * 100); d.drivers.payout.instantFeePaise = Math.round(pf.value * 100); }); }), h('div', { class: 'pc-grid4' }, [field('Minimum cash-out \u20B9', pm), field('Instant payout fee \u20B9', pf), h('div', { class: 'pc-field' }, [h('span', { class: 'pc-lbl' }, 'Cycle'), h('b', null, c.drivers.payout.cycle)])])));
  };

  // ---------------------------------------------------------------- partners
  var PREJECT = ['FSSAI licence missing or invalid', 'GST details do not match', 'Address could not be verified', 'Duplicate listing', 'Other'];
  VIEW.partners = function (m) {
    var c = PC.cfg, o = PC.ops, apps = Object.keys(o.partnerApps).map(function (k) { return Object.assign({ id: k }, o.partnerApps[k]); }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    m.appendChild(card('Partner applications', null, table([
      ['Business', function (a) { return h('span', null, [h('b', null, a.biz), h('div', { class: 'pc-hint' }, a.id + ' \u00B7 ' + a.type + ' \u00B7 ' + a.email)]); }], ['Submitted', function (a) { return fdt(a.at); }],
      ['Status', function (a) { return h('span', null, [badge(a.status, a.status === 'approved' ? 'ok' : a.status === 'rejected' ? 'bad' : 'warn'), a.reason ? h('div', { class: 'pc-hint' }, a.reason) : null]); }],
      ['', function (a) { return a.status !== 'pending' ? '' : h('span', { class: 'pc-row' }, [btn('Approve', 'sm', function () { opsWrite('partners', 'partner.approve', 'Approved partner ' + a.biz, decide('partnerApps', a.id, { status: 'approved', reason: '' })); }, { 'aria-label': 'Approve ' + a.biz }), btn('Reject', 'danger sm', function () { ask('Reject ' + a.biz, [{ name: 'reason', label: 'Reason (shown to the partner)', type: 'select', options: PREJECT, value: PREJECT[0] }, { name: 'note', label: 'Note (optional)' }], function (v) { var r = v.reason === 'Other' ? (v.note || 'Please contact partner support.') : v.reason; opsWrite('partners', 'partner.reject', 'Rejected partner ' + a.biz + ': ' + r, decide('partnerApps', a.id, { status: 'rejected', reason: r })); }, 'Reject'); }, { 'aria-label': 'Reject ' + a.biz })]); }]
    ], apps, 'No applications yet. They appear when a business applies in the partner app.')));
    m.appendChild(card('Menu moderation', h('span', { class: 'pc-hint' }, 'Hidden items are switched off in the partner app and cannot be ordered'), table([
      ['Item', function (i) { return h('span', null, [h('b', null, i.n), h('div', { class: 'pc-hint' }, (i.veg ? 'Veg' : 'Non-veg') + ' \u00B7 ' + rs(i.p * 100))]); }],
      ['State', function (i) { var r = o.menuHidden[i.n]; return r ? h('span', null, [badge('Hidden', 'bad'), h('div', { class: 'pc-hint' }, r)]) : badge(i.on ? 'Listed' : 'Paused by partner', i.on ? 'ok' : ''); }],
      ['', function (i) { return o.menuHidden[i.n] ? btn('Restore', 'sm', function () { opsWrite('partners', 'menu.restore', 'Restored menu item ' + i.n, function (s) { delete s.menuHidden[i.n]; }); }, { 'aria-label': 'Restore ' + i.n }) : btn('Hide', 'danger sm', function () { ask('Hide ' + i.n, [{ name: 'reason', label: 'Reason', type: 'select', options: ['Misleading photo or name', 'Price looks wrong', 'Restricted item', 'Food safety complaint'], value: 'Price looks wrong' }], function (v) { opsWrite('partners', 'menu.hide', 'Hid menu item ' + i.n + ': ' + v.reason, function (s) { s.menuHidden[i.n] = v.reason; }); }, 'Hide item'); }, { 'aria-label': 'Hide ' + i.n }); }]
    ], o.partnerMenu || [], 'The partner menu appears here once the partner app has been opened.')));
    var cm = num(c.partners.commissionPct, { max: 40 }), aa = num(c.partners.autoApproveSecs, { max: 3600 });
    m.appendChild(card('Commission & payouts', btn('Save', '', function () { if (ferr(cm, !(+cm.value >= 0 && +cm.value <= 40) ? 'Commission must be 0-40%.' : '') || ferr(aa, !(+aa.value >= 0 && +aa.value <= 3600) ? '0-3600' : '')) return; cfgWrite('partners', 'partner.rules', 'Partner commission ' + cm.value + '%, auto-approve ' + (+aa.value ? aa.value + 's per stage' : 'off'), function (d) { d.partners.commissionPct = +cm.value; d.partners.autoApproveSecs = +aa.value; }); }), h('div', { class: 'pc-grid4' }, [field('Commission %', cm, 'On gross food sales'), field('Auto-approve (s per stage, 0 = manual)', aa), h('div', { class: 'pc-field' }, [h('span', { class: 'pc-lbl' }, 'Payout cycle'), h('b', null, c.partners.payoutCycle)])])));
  };

  // ---------------------------------------------------------------- customers
  VIEW.customers = function (m) {
    var o = PC.ops, list = Object.keys(o.customers).map(function (k) { return Object.assign({ phone: k }, o.customers[k]); }).sort(function (a, b) { return (b.seen || 0) - (a.seen || 0); });
    m.appendChild(card('Customers', null, table([
      ['Customer', function (u) { return h('span', null, [h('b', null, u.name || 'Customer'), h('div', { class: 'pc-hint' }, '+91 ' + u.phone)]); }], ['Wallet', function (u) { return u.walletPaise != null ? rs(u.walletPaise) : '-'; }], ['Bookings', function (u) { return String(u.bookings || 0); }], ['Last seen', function (u) { return fdt(u.seen); }],
      ['Status', function (u) { return u.blocked ? h('span', null, [badge('Blocked', 'bad'), h('div', { class: 'pc-hint' }, u.reason || '')]) : badge('Active', 'ok'); }],
      ['', function (u) { return h('span', { class: 'pc-row' }, [u.blocked ? btn('Unblock', 'sm', function () { opsWrite('customers', 'customer.unblock', 'Unblocked customer ' + u.phone, decide('customers', u.phone, { blocked: false, reason: '' })); }, { 'aria-label': 'Unblock ' + u.phone }) : btn('Block', 'danger sm', function () { ask('Block +91 ' + u.phone, [{ name: 'reason', label: 'Reason (shown to the customer)', type: 'select', options: ['Payment fraud suspected', 'Abusive behaviour reported by drivers', 'Promo abuse (multiple accounts)', 'Chargeback under review'], value: 'Payment fraud suspected' }], function (v) { opsWrite('customers', 'customer.block', 'Blocked customer ' + u.phone + ': ' + v.reason, decide('customers', u.phone, { blocked: true, reason: v.reason })); }, 'Block'); }, { 'aria-label': 'Block ' + u.phone }), btn('Wallet', 'g sm', function () { walletDlg(u, 'adjust'); }, { 'aria-label': 'Adjust wallet of ' + u.phone }), btn('Refund', 'g sm', function () { walletDlg(u, 'refund'); }, { 'aria-label': 'Refund ' + u.phone })]); }]
    ], list, 'No customers yet. They appear after signing in to the customer app.')));
    var W = [['id', function (w) { return w.id; }], ['phone', function (w) { return w.phone; }], ['kind', function (w) { return w.kind; }], ['amount_inr', function (w) { return (w.paise / 100).toFixed(2); }], ['note', function (w) { return w.note; }], ['at', function (w) { return new Date(w.at).toISOString(); }], ['delivered', function (w) { return w.applied ? 'yes' : 'pending'; }]];
    m.appendChild(card('Wallet ledger (admin credits & refunds)', btn('Export CSV', 'g pc-ro-ok', function () { csv('wallet-ledger.csv', W, o.wallet); }), table([['When', function (w) { return fdt(w.at); }], ['Customer', function (w) { return '+91 ' + w.phone; }], ['Kind', function (w) { return w.kind; }], ['Amount', function (w) { return h('b', { class: w.paise < 0 ? 'neg' : 'pos' }, rs(w.paise)); }], ['Note', function (w) { return w.note; }], ['Delivered', function (w) { return w.applied ? badge('In wallet', 'ok') : badge('Waiting for app', 'warn'); }]], o.wallet.slice(0, 50), 'No adjustments yet.')));
  };
  function walletDlg(u, kind) {
    var bk = Object.keys(PC.ops.bookings).map(function (k) { return PC.ops.bookings[k]; }).filter(function (b) { return b.phone === u.phone; });
    var f = [{ name: 'amt', label: kind === 'refund' ? 'Refund amount \u20B9' : 'Amount \u20B9 (negative to debit)', type: 'number', required: true }, { name: 'note', label: 'Reason (shown in the customer wallet)', required: true }];
    if (kind === 'refund') f.unshift({ name: 'bk', label: 'Booking', type: 'select', options: [['', 'Goodwill (no booking)']].concat(bk.map(function (b) { return [b.id, b.id + ' \u00B7 ' + b.title + ' \u00B7 ' + rs(b.paise || 0)]; })), value: '' });
    ask(kind === 'refund' ? 'Refund to wallet' : 'Adjust wallet', f, function (v) {
      var p = Math.round(v.amt * 100); if (!p || Math.abs(p) > 2000000) { toast('Enter a non-zero amount up to \u20B920,000.', 'error'); return false; }
      if (kind === 'refund' && p < 0) { toast('Refunds must be positive.', 'error'); return false; }
      if (kind === 'refund' && v.bk) { var b = PC.ops.bookings[v.bk]; if (b && p > (b.paise || 0)) { toast('Refund cannot exceed the booking amount ' + rs(b.paise) + '.', 'error'); return false; } }
      if (Math.abs(p) >= 500000 && role() !== 'SUPER_ADMIN' && role() !== 'FINANCE_MANAGER') { toast('Credits of \u20B95,000 or more need a Finance manager (maker-checker).', 'error'); return false; }
      opsWrite('customers', kind === 'refund' ? 'wallet.refund' : 'wallet.adjust', (kind === 'refund' ? 'Refund ' : 'Wallet adjustment ') + rs(p) + ' to ' + u.phone + ' \u2014 ' + v.note, function (s) { s.wallet.unshift({ id: PC.uid('WA'), phone: u.phone, paise: p, note: (kind === 'refund' ? 'Refund' + (v.bk ? ' for ' + v.bk : '') + ': ' : '') + v.note, kind: kind === 'refund' ? 'Refund' : 'Adjustment', booking: v.bk || '', at: Date.now(), by: who() }); });
    }, kind === 'refund' ? 'Refund' : 'Apply');
  }

  // ---------------------------------------------------------------- live ops
  var DRIVERS = ['Arjun Kumar \u00B7 TS 09 EA 4521', 'Ravi Teja \u00B7 TS 10 UB 2231', 'Salma Begum \u00B7 TS 07 HK 9910', 'Prakash N \u00B7 TS 08 GT 5532'];
  function isAct(b) { return !/complet|deliver|cancel|refund|paid|done/i.test(b.status || ''); }
  function searchBox(key, ph) {
    var q = h('input', { type: 'search', class: 'pc-in pc-ro-ok', placeholder: ph, 'aria-label': ph, value: state[key] });
    q.addEventListener('input', function () { state[key] = q.value; clearTimeout(q.t); q.t = setTimeout(function () { render(); var s = main.querySelector('input[type=search]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 250); });
    return q;
  }
  VIEW.liveops = function (m) {
    var o = PC.ops, all = Object.keys(o.bookings).map(function (k) { return o.bookings[k]; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); }), fl = state.bookingsFilter;
    var rows = all.filter(function (b) { return fl === 'All' || (fl === 'Active' ? isAct(b) : fl === 'Completed' ? /complet|deliver|paid|done/i.test(b.status) : /cancel/i.test(b.status)); }).filter(function (b) { var q = state.bq.toLowerCase(); return !q || (b.id + ' ' + b.title + ' ' + b.phone + ' ' + (b.driver || '')).toLowerCase().indexOf(q) >= 0; });
    var BC = [['id', function (b) { return b.id; }], ['type', function (b) { return b.type; }], ['title', function (b) { return b.title; }], ['customer', function (b) { return b.phone; }], ['status', function (b) { return b.status; }], ['amount_inr', function (b) { return ((b.paise || 0) / 100).toFixed(2); }], ['driver', function (b) { return b.driver || ''; }], ['created', function (b) { return b.at ? new Date(b.at).toISOString() : ''; }]];
    m.appendChild(card('Bookings', h('span', { class: 'pc-row' }, [searchBox('bq', 'Search booking, customer, driver'), btn('Export CSV', 'g pc-ro-ok', function () { csv('bookings.csv', BC, rows); })]), [chips(['All', 'Active', 'Completed', 'Cancelled'], fl, function (x) { state.bookingsFilter = x; render(); }), table([
      ['Booking', function (b) { return h('span', null, [h('b', null, b.id), h('div', { class: 'pc-hint' }, b.type + ' \u00B7 ' + fdt(b.at))]); }], ['Details', function (b) { return h('span', null, [b.title, b.sub ? h('div', { class: 'pc-hint' }, b.sub) : null]); }], ['Customer', function (b) { return '+91 ' + b.phone; }], ['Amount', function (b) { return rs(b.paise || 0); }],
      ['State', function (b) { return badge(b.status, isAct(b) ? 'warn' : /cancel/i.test(b.status) ? 'bad' : 'ok'); }], ['Driver', function (b) { return b.driver || '-'; }],
      ['', function (b) { if (!isAct(b)) return ''; if (o.cmds.some(function (c) { return c.booking === b.id && !c.applied; })) return badge('Sent to app', 'info'); return h('span', { class: 'pc-row' }, [btn('Reassign', 'g sm', function () { ask('Reassign ' + b.id, [{ name: 'driver', label: 'New driver', type: 'select', options: DRIVERS, value: DRIVERS[1] }, { name: 'reason', label: 'Reason', value: 'Driver not moving towards pickup', required: true }], function (v) { opsWrite('liveops', 'booking.reassign', 'Reassigned ' + b.id + ' to ' + v.driver.split(' \u00B7')[0], function (s) { s.cmds.push({ id: PC.uid('CMD'), booking: b.id, phone: b.phone, action: 'reassign', driver: v.driver, reason: v.reason, at: Date.now() }); }); }, 'Reassign'); }, { 'aria-label': 'Reassign ' + b.id }), btn('Cancel', 'danger sm', function () { ask('Cancel ' + b.id, [{ name: 'reason', label: 'Reason (shown to the customer)', type: 'select', options: ['No drivers available nearby', 'Safety concern', 'Duplicate booking', 'Requested by customer via support'], value: 'No drivers available nearby' }, { name: 'refund', label: 'Refund to wallet', type: 'select', options: [['yes', 'Yes, full refund'], ['no', 'No refund']], value: 'yes' }], function (v) { opsWrite('liveops', 'booking.cancel', 'Cancelled ' + b.id + ': ' + v.reason, function (s) { s.cmds.push({ id: PC.uid('CMD'), booking: b.id, phone: b.phone, action: 'cancel', reason: v.reason, refund: v.refund === 'yes', at: Date.now() }); }); }, 'Cancel booking'); }, { 'aria-label': 'Cancel ' + b.id })]); }]
    ], rows, all.length ? 'No bookings match.' : 'No bookings yet. Bookings made in the customer app show up here live.')]));
    var sos = Object.keys(o.sos).map(function (k) { return o.sos[k]; }).sort(function (a, b) { return b.at - a.at; });
    m.appendChild(card('SOS incidents', null, table([['Incident', function (s) { return h('span', null, [h('b', null, s.id), h('div', { class: 'pc-hint' }, (s.from || 'rider') + ' \u00B7 ' + fdt(s.at))]); }], ['Details', function (s) { return s.text || '-'; }], ['State', function (s) { return badge(s.status, s.status === 'Resolved' ? 'ok' : s.status === 'Acknowledged' ? 'info' : 'bad'); }], ['', function (s) { return s.status === 'Resolved' ? '' : h('span', { class: 'pc-row' }, [s.status === 'Open' ? btn('Acknowledge', 'sm', function () { opsWrite('liveops', 'sos.ack', 'Acknowledged ' + s.id, function (x) { x.sos[s.id].status = 'Acknowledged'; x.sos[s.id].by = who(); }); }, { 'aria-label': 'Acknowledge ' + s.id }) : null, btn('Resolve', 'g sm', function () { opsWrite('liveops', 'sos.resolve', 'Resolved ' + s.id, function (x) { x.sos[s.id].status = 'Resolved'; x.sos[s.id].resolvedAt = Date.now(); }); }, { 'aria-label': 'Resolve ' + s.id })]); }]], sos, 'No SOS incidents. Raising SOS in the customer or driver app creates one here.')));
    m.appendChild(card('Support tickets', btn('New ticket', 'g', function () { ask('New support ticket', [{ name: 'subject', label: 'Subject', required: true }, { name: 'phone', label: 'Customer phone (optional)' }, { name: 'priority', label: 'Priority', type: 'select', options: ['P1', 'P2', 'P3'], value: 'P2' }], function (v) { opsWrite('liveops', 'ticket.create', 'Created ticket "' + v.subject + '"', function (s) { s.tickets.unshift({ id: PC.uid('TK'), subject: v.subject, phone: v.phone, priority: v.priority, status: 'Open', at: Date.now(), assignee: '' }); }); }, 'Create'); }), table([['Ticket', function (t) { return h('span', null, [h('b', null, t.subject), h('div', { class: 'pc-hint' }, t.id + ' \u00B7 ' + fdt(t.at) + (t.phone ? ' \u00B7 +91 ' + t.phone : ''))]); }], ['Priority', function (t) { return badge(t.priority, t.priority === 'P1' ? 'bad' : t.priority === 'P2' ? 'warn' : ''); }], ['Assignee', function (t) { return t.assignee || 'Unassigned'; }], ['State', function (t) { return badge(t.status, t.status === 'Resolved' ? 'ok' : 'warn'); }], ['', function (t) { return t.status === 'Resolved' ? '' : h('span', { class: 'pc-row' }, [btn(t.assignee ? 'Reassign' : 'Assign', 'g sm', function () { ask('Assign ' + t.id, [{ name: 'who', label: 'Agent', type: 'select', options: ['Priya K. (L1)', 'Rahul S. (L1)', 'Fatima Z. (L2)', 'Safety desk'], value: 'Priya K. (L1)' }], function (v) { opsWrite('liveops', 'ticket.assign', 'Assigned ' + t.id + ' to ' + v.who, function (s) { byId(s.tickets, t.id).assignee = v.who; }); }, 'Assign'); }, { 'aria-label': 'Assign ' + t.id }), btn('Resolve', 'sm', function () { opsWrite('liveops', 'ticket.resolve', 'Resolved ticket ' + t.id, function (s) { byId(s.tickets, t.id).status = 'Resolved'; }); }, { 'aria-label': 'Resolve ' + t.id })]); }]], o.tickets, 'No tickets.')));
  };

  // ---------------------------------------------------------------- broadcasts
  var APPS = [['customer', 'Customer'], ['driver', 'Driver'], ['partner', 'Partner'], ['agent', 'Agent portal']];
  VIEW.broadcasts = function (m) {
    var c = PC.cfg, text = h('textarea', { class: 'pc-in', name: 'bctext', rows: 2, maxlength: 140, placeholder: 'e.g. Heavy rain in Hyderabad: expect longer pickup times.' });
    var tone = sel([['info', 'Info (blue)'], ['warn', 'Warning (orange)'], ['ok', 'Good news (green)'], ['promo', 'Promotion (purple)']], 'info', { name: 'bctone' });
    var hrs = sel([['1', '1 hour'], ['6', '6 hours'], ['24', '24 hours'], ['168', '7 days'], ['0', 'Until I end it']], '24', { name: 'bchrs' });
    var boxes = APPS.map(function (a) { return h('label', { class: 'pc-check' }, [h('input', { type: 'checkbox', value: a[0], checked: a[0] === 'customer', name: 'bcapp' }), ' ' + a[1]]); });
    var cnt = h('span', { class: 'pc-hint', 'aria-live': 'polite' }, '0 / 140'); text.addEventListener('input', function () { cnt.textContent = text.value.length + ' / 140'; });
    m.appendChild(card('New broadcast banner', null, [field('Message', text), cnt, h('div', { class: 'pc-grid4' }, [h('fieldset', { class: 'pc-field' }, [h('legend', { class: 'pc-lbl' }, 'Apps'), h('div', { class: 'pc-row wrap' }, boxes)]), field('Style', tone), field('Show for', hrs)]), btn('Publish banner', '', function () {
      var apps = boxes.map(function (b) { return b.querySelector('input'); }).filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
      if (ferr(text, text.value.trim().length < 8 ? 'Write at least 8 characters.' : '')) return;
      if (!apps.length) { toast('Pick at least one app.', 'error'); return; }
      var hh = +hrs.value, ends = hh ? new Date(Date.now() + hh * 3600e3).toISOString() : '';
      cfgWrite('broadcasts', 'broadcast.publish', 'Broadcast to ' + apps.join(', ') + ': "' + text.value.trim().slice(0, 40) + '"', function (d) { d.broadcasts = (d.broadcasts || []).concat([{ id: PC.uid('BC'), text: text.value.trim(), apps: apps, tone: tone.value, on: true, ends: ends, at: Date.now() }]); });
    }, { 'data-act': 'publish-broadcast' })]));
    m.appendChild(card('Banners', null, table([['Message', function (b) { return b.text; }], ['Apps', function (b) { return (b.apps || []).join(', '); }], ['Style', function (b) { return badge(b.tone, b.tone === 'warn' ? 'warn' : b.tone === 'ok' ? 'ok' : 'info'); }], ['Ends', function (b) { return b.ends ? fdt(new Date(b.ends).getTime()) : 'Manual'; }], ['State', function (b) { var live = b.on && (!b.ends || new Date(b.ends).getTime() > Date.now()); return badge(live ? 'Live' : 'Ended', live ? 'ok' : ''); }], ['', function (b) { return b.on ? btn('End now', 'g sm', function () { cfgWrite('broadcasts', 'broadcast.end', 'Ended broadcast "' + b.text.slice(0, 30) + '"', function (d) { byId(d.broadcasts, b.id).on = false; }); }, { 'aria-label': 'End broadcast ' + b.text.slice(0, 20) }) : ''; }]], (c.broadcasts || []).slice().reverse(), 'No broadcasts yet.')));
  };

  // ---------------------------------------------------------------- flags & maintenance
  var FLAG_USE = { cash_payments: 'Customer pay sheet (Cash option)', tipping: 'Customer trip complete (tips)', referral_program: 'Customer home (Refer & earn)', scheduled_rides: 'Customer ride scheduling', women_driver_preference: 'Ride options', night_ride_checkin: 'Safety check-ins', ai_support_assistant: 'Help & support' };
  VIEW.flags = function (m) {
    var c = PC.cfg, mt = c.maintenance;
    var msg = editIn(txt(mt.message, { maxlength: 140, name: 'mmsg' }), 'flags', 'maintenance.message', function () { return 'Maintenance message updated'; }, function (d, v) { d.maintenance.message = v; }, function (v) { return v.length >= 8 ? '' : 'Message must be at least 8 characters.'; });
    m.appendChild(card('Maintenance mode', h('span', { class: 'pc-hint' }, 'Shows a maintenance screen in the selected app'), [table([['App', function (a) { return a[1]; }], ['Maintenance', function (a) { return tog(!!mt[a[0]], function (v) { cfgWrite('flags', v ? 'maintenance.on' : 'maintenance.off', 'Maintenance ' + (v ? 'ON' : 'OFF') + ' for ' + a[1], function (d) { d.maintenance[a[0]] = v; }); }, 'Maintenance for ' + a[1], 'flags'); }]], APPS), field('Message shown', msg)]));
    m.appendChild(card('Feature flags', btn('Add flag', 'g', function () { ask('New feature flag', [{ name: 'key', label: 'Key (snake_case)', required: true }], function (v) { var k = v.key.toLowerCase().replace(/[^a-z0-9_]/g, '_'); if (k in c.flags) { toast('That flag already exists.', 'error'); return false; } cfgWrite('flags', 'flag.add', 'Added flag ' + k + ' (off)', function (d) { d.flags[k] = false; }); }, 'Add'); }), table([['Flag', function (k) { return h('code', null, k); }], ['Used by', function (k) { return FLAG_USE[k] || '-'; }], ['State', function (k) { return tog(c.flags[k], function (v) { cfgWrite('flags', 'flag.toggle', 'Flag ' + k + ' ' + (v ? 'ON' : 'OFF'), function (d) { d.flags[k] = v; }); }, 'Flag ' + k, 'flags'); }]], Object.keys(c.flags))));
  };

  // ---------------------------------------------------------------- content
  VIEW.content = function (m) {
    var c = PC.cfg.content, ph = txt(c.supportPhone, { maxlength: 20 }), terms = h('textarea', { class: 'pc-in', rows: 4, maxlength: 2000 }, c.terms);
    m.appendChild(card('Support & terms', btn('Save', '', function () { if (ferr(ph, !/^[0-9 +-]{8,20}$/.test(ph.value.trim()) ? 'Enter a valid phone number.' : '') || ferr(terms, terms.value.trim().length < 20 ? 'Terms look too short.' : '')) return; cfgWrite('content', 'content.terms', 'Updated support phone and terms', function (d) { d.content.supportPhone = ph.value.trim(); d.content.terms = terms.value.trim(); }); }), [field('Support phone', ph), field('Terms summary', terms)]));
    m.appendChild(card('FAQs', btn('Add FAQ', 'g', function () { ask('New FAQ', [{ name: 'q', label: 'Question', required: true }, { name: 'a', label: 'Answer', type: 'textarea', required: true }], function (v) { cfgWrite('content', 'faq.add', 'Added FAQ "' + v.q.slice(0, 40) + '"', function (d) { d.content.faqs.push({ q: v.q, a: v.a }); }); }, 'Add'); }), table([['Question', function (f) { return h('b', null, f.q); }], ['Answer', function (f) { return f.a; }], ['', function (f, i) { return btn('Remove', 'g sm', function () { cfgWrite('content', 'faq.remove', 'Removed FAQ "' + f.q.slice(0, 40) + '"', function (d) { d.content.faqs.splice(i, 1); }); }, { 'aria-label': 'Remove FAQ ' + f.q }); }]], c.faqs)));
  };

  // ---------------------------------------------------------------- roles
  var PERMS = ['services', 'pricing', 'zones', 'offers', 'drivers', 'partners', 'customers', 'liveops', 'broadcasts', 'flags', 'content', 'audit', 'config'];
  VIEW.roles = function (m) {
    var R = PC.cfg.roles, su = role() === 'SUPER_ADMIN';
    m.appendChild(h('div', { class: 'pc-banner info' }, 'Who can change what in Platform control. Only a Super admin can edit the matrix. Use "Role" at the top right to preview the console as another role.'));
    m.appendChild(card('Permission matrix', null, table([['Role', function (r) { return h('b', null, r); }]].concat(PERMS.map(function (p) { return [p, function (r) { var all = R[r].indexOf('*') >= 0, b = h('input', { type: 'checkbox', checked: all || R[r].indexOf(p) >= 0, disabled: !su || all, 'aria-label': r + ' ' + p }); b.addEventListener('change', function () { cfgWrite('config', 'roles.edit', (b.checked ? 'Granted ' : 'Revoked ') + p + (b.checked ? ' to ' : ' from ') + r, function (d) { var l = d.roles[r]; if (b.checked) { if (l.indexOf(p) < 0) l.push(p); } else d.roles[r] = l.filter(function (x) { return x !== p; }); }); }); return b; }]; })), Object.keys(R))));
  };

  // ---------------------------------------------------------------- audit
  VIEW.audit = function (m) {
    var rows = PC.ops.audit.filter(function (a) { var s = state.auditQ.toLowerCase(); return !s || (a.action + ' ' + a.by + ' ' + a.detail).toLowerCase().indexOf(s) >= 0; });
    var AC = [['at', function (a) { return new Date(a.at).toISOString(); }], ['by', function (a) { return a.by; }], ['role', function (a) { return a.role; }], ['action', function (a) { return a.action; }], ['detail', function (a) { return a.detail; }], ['config_version', function (a) { return a.v || ''; }]];
    m.appendChild(card('Audit log (' + rows.length + ')', h('span', { class: 'pc-row' }, [searchBox('auditQ', 'Filter by action, person or detail'), btn('Export CSV', 'g pc-ro-ok', function () { csv('audit-log.csv', AC, rows); })]), auditTable(rows.slice(0, 200))));
  };

  // ---------------------------------------------------------------- config & export
  VIEW.config = function (m) {
    var c = PC.cfg;
    m.appendChild(kpis([['Version', 'v' + c.version], ['Last change', c.updatedAt ? fdt(c.updatedAt) : 'Bundled default'], ['By', String(c.updatedBy).split(' (')[0]], ['Storage key', PC.KEY]]));
    var file = h('input', { type: 'file', accept: 'application/json,.json', class: 'pc-in' }), paste = h('textarea', { class: 'pc-in', rows: 4, placeholder: 'or paste exported JSON here', name: 'cfgpaste', 'aria-label': 'Paste exported JSON' }), msg = h('div', { class: 'pc-err', 'aria-live': 'polite', id: 'pc-import-msg' });
    function doImport(text) { if (!can('config')) { denied('config'); return; } var r = PC.import(text, { by: who(), role: role() }); if (r.ok) toast('Imported. Config is now v' + r.version + ' and live in all apps.', 'ok'); else { msg.textContent = r.error; toast('Import failed: ' + r.error, 'error'); } }
    file.addEventListener('change', function () { var f = file.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { doImport(String(rd.result)); }; rd.readAsText(f); });
    m.appendChild(card('Export / import', null, [h('p', { class: 'pc-hint' }, 'Export downloads platform-config-v' + c.version + '.json. Import checks the file (schema, required sections) before anything goes live. Every app also ships with the bundled default in shared/platform-config.js.'),
      h('div', { class: 'pc-row wrap' }, [btn('Export JSON', 'pc-ro-ok', function () { download('platform-config-v' + c.version + '.json', PC.export()); toast('Downloaded platform-config-v' + c.version + '.json', 'ok'); }), btn('Reset to bundled default', 'danger', function () { ask('Reset all platform settings?', [{ name: 'confirm', label: 'Type RESET to confirm', required: true }], function (v) { if (v.confirm !== 'RESET') { toast('Type RESET in capitals.', 'error'); return false; } if (!can('config')) { denied('config'); return; } toast('Reset done. Now v' + PC.reset({ by: who(), role: role() }) + '.', 'ok'); }, 'Reset'); })]),
      field('Import from file', file), paste, btn('Import pasted JSON', 'g', function () { if (!paste.value.trim()) { msg.textContent = 'Paste a config first.'; return; } doImport(paste.value); }), msg]));
    m.appendChild(card('Version history', null, table([['Version', function (x) { return 'v' + x.v; }], ['When', function (x) { return fdt(x.at); }], ['By', function (x) { return String(x.by).split(' (')[0]; }], ['Change', function (x) { return x.note; }]], c.history || [], 'No changes yet.')));
  };

  // ---------------------------------------------------------------- boot
  function gate() {
    if (sess.on && sess.until > Date.now()) return true;
    var w = document.querySelector('.pc-wrap'); w.innerHTML = '';
    w.appendChild(h('main', { class: 'pc-gate', id: 'pc-main' }, [h('h1', null, 'Sign in required'), h('p', null, 'Platform control is part of the admin portal. Sign in with your work e-mail and MFA code first.'), h('a', { class: 'pc-btn', href: 'index.html#/A01' }, 'Go to admin sign-in')]));
    return false;
  }
  function boot() {
    main = document.getElementById('pc-main'); nav = document.getElementById('pc-nav'); main.addEventListener('input', function () { dirty = true; });
    if (!gate()) return;
    var rsel = document.getElementById('pc-role'), canPreview = realRole() === 'SUPER_ADMIN' || realRole() === 'OPS_MANAGER';
    Object.keys(PC.cfg.roles).forEach(function (r) { rsel.appendChild(h('option', { value: r, selected: r === role() ? 'selected' : null }, r + (r === realRole() ? ' (you)' : ''))); });
    rsel.disabled = !canPreview; rsel.title = canPreview ? 'Preview the console as another role' : 'Only ops managers and super admins can preview roles';
    rsel.addEventListener('change', function () { if (rsel.value === realRole()) sessionStorage.removeItem(ROLE_KEY); else sessionStorage.setItem(ROLE_KEY, rsel.value); toast('Previewing as ' + rsel.value + '.', 'info'); render(); });
    nav.addEventListener('click', function (e) { var a = e.target.closest('a[data-tab]'); if (!a) return; e.preventDefault(); go(a.dataset.tab); });
    window.addEventListener('hashchange', function () { var t = location.hash.replace('#', ''); if (t && t !== tab && VIEW[t]) { tab = t; render(); } });
    PC.on(function (c, o, src) { var f = document.activeElement; if (src === 'remote' && (dirty || (f && main.contains(f) && /INPUT|TEXTAREA|SELECT/.test(f.tagName)) || document.querySelector('.pc-dlg-scrim'))) { drawNav(); return; } render(); });
    X.go = go; X.render = render;
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
