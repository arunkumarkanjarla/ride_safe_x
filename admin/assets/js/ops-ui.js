/* RideNova Admin portal – shared building blocks for the operations screens (A02, A03, A04, A24, A27):
   DOM helpers (no HTML strings), the country → state → city filter shared by all screens, a sortable paged table,
   a timeline, and permission-checked actions that are written to the audit log (A19) through the engine. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, OD = RN.opsData;

  // filters shared between the screens (in memory, reset on reload)
  var OPS = RN.ops = RN.ops || {};
  OPS.geo = OPS.geo || { country: '', state: '', city: '' };
  OPS.nav = OPS.nav || {};

  function h(tag, attrs, kids) {
    var a = attrs || {}, t = a.text, n;
    if (t != null) { a = Object.assign({}, a); delete a.text; }
    n = UI.el(tag, a, t != null ? String(t) : null);
    [].concat(kids == null ? [] : kids).forEach(function (k) { if (k == null || k === false) return; n.appendChild(k.nodeType ? k : document.createTextNode(String(k))); });
    return n;
  }
  function btn(label, fn, cls, attrs) {
    var b = h('button', Object.assign({ type: 'button', class: 'dbtn ' + (cls || '') }, attrs || {}), [label]);
    b.addEventListener('click', function (ev) { ev.stopPropagation(); if (!b.disabled) fn(b); });
    return b;
  }
  function st(text, kind) { return h('span', { class: 'st ' + (kind || ''), text: text }); }
  function card(title, body, right, cls) {
    return h('section', { class: 'dcard ' + (cls || ''), 'aria-label': typeof title === 'string' ? title : null },
      [h('div', { class: 'hd' }, [h('b', null, [title]), h('span', { class: 'sp' }, right ? [].concat(right) : null)])].concat(body || []));
  }
  function select(label, options, value, fn, cls) {
    var s = h('select', { class: 'ops-sel ' + (cls || ''), 'aria-label': label });
    options.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    s.value = value;
    s.addEventListener('change', function () { fn(s.value); });
    return s;
  }
  function search(placeholder, value, fn) {
    var i = h('input', { type: 'search', class: 'ops-search', placeholder: placeholder, 'aria-label': placeholder, value: value || '' });
    var t = null;
    i.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { fn(i.value.trim().toLowerCase()); }, 160); });
    return i;
  }
  function chips(label, options, value, fn) {
    var g = h('div', { class: 'ops-chips', role: 'group', 'aria-label': label });
    options.forEach(function (o) {
      var c = h('button', { type: 'button', class: 'ops-chip' + (o[0] === value ? ' on' : ''), 'aria-pressed': String(o[0] === value) }, [o[1], o[2] != null ? h('span', { class: 'ops-n', text: o[2] }) : null]);
      c.addEventListener('click', function () { fn(o[0]); });
      g.appendChild(c);
    });
    return g;
  }
  function kv(rows) {
    return h('dl', { class: 'ops-kv' }, [].concat.apply([], rows.filter(Boolean).map(function (r) { return [h('dt', { text: r[0] }), h('dd', null, [r[1]])]; })));
  }
  function timeline(events) {
    var ol = h('ol', { class: 'ops-tl' });
    events.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (e) {
      ol.appendChild(h('li', { class: e.kind === 'a' ? 'a' : '' }, [h('time', { text: clock(e.at) }), h('span', null, [e.text, e.by ? h('em', { text: ' · ' + e.by }) : null])]));
    });
    if (!events.length) ol.appendChild(h('li', { class: 'ops-empty', text: 'Nothing yet.' }));
    return ol;
  }
  function clock(t) {
    var d = new Date(t), today = new Date(); var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return d.toDateString() === today.toDateString() ? hm : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + hm;
  }
  function since(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min'; if (m < 48 * 60) return Math.floor(m / 60) + ' h ' + (m % 60 ? (m % 60) + ' min' : ''); return Math.floor(m / 1440) + ' d';
  }
  function fmtN(n) { return Number(n).toLocaleString('en-IN'); }

  // ---------------------------------------------------------------- country → state → city filter (shared)
  function geoBar(onChange, opts) {
    opts = opts || {};
    var g = OPS.geo, bar = h('div', { class: 'ops-geo', role: 'group', 'aria-label': 'Location' });
    var countries = [['', 'All countries']].concat(OD.COUNTRIES.map(function (c) { return [c.code, c.name]; }));
    var c = OD.country(g.country);
    var states = [['', c ? 'All states' : 'State']].concat(c ? c.states.map(function (s) { return [s.code, s.name]; }) : []);
    var s = c && OD.state(g.country, g.state);
    var cities = [['', s ? 'All cities' : 'City']].concat((s ? s.cities : c ? [].concat.apply([], c.states.map(function (x) { return x.cities; })) : []).map(function (x) { return [x.id, x.name]; }));
    var set = function (k, v) {
      if (k === 'country') { g.country = v; g.state = ''; g.city = ''; }
      if (k === 'state') { g.state = v; g.city = ''; }
      if (k === 'city') { g.city = v; if (v && !g.state) g.state = OD.CITIES[v].state; }
      onChange(g);
    };
    bar.appendChild(h('span', { class: 'ops-geo-l', text: opts.label || 'Location' }));
    bar.appendChild(select('Country', countries, g.country, function (v) { set('country', v); }));
    var ss = select('State', states, g.state, function (v) { set('state', v); }); ss.disabled = !c; bar.appendChild(ss);
    var cs = select('City', cities, g.city, function (v) { set('city', v); }); cs.disabled = !c; bar.appendChild(cs);
    if (g.country) bar.appendChild(btn('Clear', function () { g.country = g.state = g.city = ''; onChange(g); }, 'g ops-clear'));
    return bar;
  }

  // ---------------------------------------------------------------- table with sorting, paging and row click
  function table(cfg) {
    // cfg: {columns: [{key, label, get(row) -> node|text, sort(row) -> value, cls}], rows, onRow(row), pageSize, empty, state: {sort, dir, page}}
    var stt = cfg.state || { sort: null, dir: 1, page: 0 };
    var wrap = h('div', { class: 'ops-table' });
    function draw() {
      UI.clear(wrap);
      var rows = cfg.rows.slice();
      var col = cfg.columns.filter(function (c) { return c.key === stt.sort; })[0];
      if (col && col.sort) rows.sort(function (a, b) { var x = col.sort(a), y = col.sort(b); return (x > y ? 1 : x < y ? -1 : 0) * stt.dir; });
      var size = cfg.pageSize || 25, pages = Math.max(1, Math.ceil(rows.length / size));
      if (stt.page >= pages) stt.page = pages - 1;
      var view = rows.slice(stt.page * size, stt.page * size + size);
      var t = h('table', { class: 'dt ops-dt' }), tr = h('tr');
      cfg.columns.forEach(function (c) {
        var th = h('th', { class: c.cls || '', scope: 'col' }, [c.label]);
        if (c.sort) {
          th.setAttribute('aria-sort', stt.sort === c.key ? (stt.dir > 0 ? 'ascending' : 'descending') : 'none');
          th.tabIndex = 0; th.classList.add('ops-sortable');
          var go = function () { if (stt.sort === c.key) stt.dir = -stt.dir; else { stt.sort = c.key; stt.dir = 1; } draw(); };
          th.addEventListener('click', go); th.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
        }
        tr.appendChild(th);
      });
      t.appendChild(h('thead', null, [tr]));
      var tb = h('tbody');
      view.forEach(function (r) {
        var row = h('tr', cfg.onRow ? { tabindex: '0', class: 'ops-row' + (cfg.selected && cfg.selected(r) ? ' on' : '') } : null);
        cfg.columns.forEach(function (c) { var v = c.get(r); row.appendChild(h('td', { class: c.cls || '' }, [v == null ? '—' : v])); });
        if (cfg.onRow) {
          row.addEventListener('click', function () { cfg.onRow(r); });
          row.addEventListener('keydown', function (e) { if (e.key === 'Enter') cfg.onRow(r); });
        }
        tb.appendChild(row);
      });
      if (!view.length) tb.appendChild(h('tr', null, [h('td', { colspan: String(cfg.columns.length), class: 'ops-empty', text: cfg.empty || 'Nothing matches these filters.' })]));
      t.appendChild(tb);
      wrap.appendChild(h('div', { class: 'ops-scroll' }, [t]));
      var pager = h('div', { class: 'ops-pager' }, [h('span', { text: rows.length ? (stt.page * size + 1) + '–' + Math.min(rows.length, stt.page * size + size) + ' of ' + fmtN(rows.length) : '0 results' }), h('span', { class: 'sp' })]);
      var prev = btn('‹ Previous', function () { stt.page--; draw(); }, 'g'), next = btn('Next ›', function () { stt.page++; draw(); }, 'g');
      prev.disabled = stt.page === 0; next.disabled = stt.page >= pages - 1;
      pager.appendChild(prev); pager.appendChild(h('span', { class: 'ops-page', text: 'Page ' + (stt.page + 1) + ' of ' + pages })); pager.appendChild(next);
      wrap.appendChild(pager);
    }
    draw();
    wrap.redraw = draw;
    return wrap;
  }

  // ---------------------------------------------------------------- permission-checked, audited actions
  var seq = 0;
  function act(perm, label, target, event, el) {
    // resolves true when the mock role may do it; the engine writes allowed and denied attempts to the audit log
    return UI.exec('admin.action', { perm: perm, label: label, event: event || 'admin.action', target: target, id: target + ':' + (++seq) }, { el: el }).then(function (r) { return !!(r && r.ok); });
  }
  function can(perm) { return RN.rbac.can(UI.engine.state.session.admin.role, perm); }
  function signedIn() { return UI.engine.state.session.admin.status === 'signed_in'; }
  function me() { var s = UI.engine.state.session.admin; return (s.name || 'Priya K.') + ' (' + RN.rbac.LABELS[s.role] + ')'; }

  // modal form: fields [{name, label, type: text|textarea|select|checks|date, value, options, required}] → Promise(values|null)
  function form(title, fields, okLabel, note) {
    return new Promise(function (resolve) {
      var d = h('dialog', { class: 'rn-dialog ops-dialog', 'aria-label': title });
      d.appendChild(h('p', { class: 'ops-dtitle', text: title }));
      if (note) d.appendChild(h('p', { class: 'ops-dnote', text: note }));
      var get = {};
      fields.forEach(function (f) {
        var lab = h('label', { class: 'rn-f block' }, [f.label]), input;
        if (f.type === 'textarea') { input = h('textarea', { rows: '3', maxlength: String(f.max || 500) }); input.value = f.value || ''; }
        else if (f.type === 'select') { input = h('select'); f.options.forEach(function (o) { input.appendChild(h('option', { value: o[0], text: o[1] })); }); input.value = f.value || f.options[0][0]; }
        else if (f.type === 'checks') {
          input = h('span', { class: 'ops-checks' });
          f.options.forEach(function (o) { var c = h('input', { type: 'checkbox', value: o[0] }); c.checked = (f.value || []).indexOf(o[0]) >= 0; input.appendChild(h('label', null, [c, ' ' + o[1]])); });
          get[f.name] = function () { return Array.prototype.filter.call(input.querySelectorAll('input'), function (c) { return c.checked; }).map(function (c) { return c.value; }); };
        } else input = h('input', { type: f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text', maxlength: String(f.max || 120), value: f.value == null ? '' : String(f.value) });
        if (!get[f.name]) get[f.name] = function () { return input.value.trim(); };
        lab.appendChild(input); d.appendChild(lab);
      });
      var err = h('p', { class: 'ops-err', role: 'alert' }); err.hidden = true; d.appendChild(err);
      var no = h('button', { type: 'button', class: 'rn-dbtn', text: 'Cancel' }), yes = h('button', { type: 'button', class: 'rn-dbtn primary', text: okLabel || 'Save' });
      d.appendChild(h('div', { class: 'rn-dialog-row' }, [no, yes]));
      document.body.appendChild(d);
      function done(v) { d.close(); d.remove(); resolve(v); }
      no.addEventListener('click', function () { done(null); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); done(null); });
      yes.addEventListener('click', function () {
        var v = {}; Object.keys(get).forEach(function (k) { v[k] = get[k](); });
        var missing = fields.filter(function (f) { return f.required && (!v[f.name] || (Array.isArray(v[f.name]) && !v[f.name].length)); })[0];
        if (missing) { err.textContent = missing.label + ' is required.'; err.hidden = false; return; }
        var bad = fields.filter(function (f) { return f.check && f.check(v[f.name]); })[0];
        if (bad) { err.textContent = bad.check(v[bad.name]); err.hidden = false; return; }
        done(v);
      });
      d.showModal(); var first = d.querySelector('input,select,textarea'); if (first) first.focus();
    });
  }

  // replaces the screen's sample content with a live view; returns the content area or null when signed out
  function mount(cls) {
    var dc = UI.q('#mock .dc'); if (!dc) return null;
    var ses = UI.engine.state.session.admin;
    UI.clear(dc); dc.setAttribute('data-ops', ses.status + ses.role);
    if (RN.ops.map) { RN.ops.map.destroy(); RN.ops.map = null; }
    if (!signedIn()) { UI.state('Signed out', ['Sign in with MFA on A01.'], [{ label: 'Sign in', primary: true, onClick: function () { UI.go('A01'); } }], 'warn'); return null; }
    UI.state(null);
    var root = h('div', { class: 'ops ' + (cls || '') });
    dc.appendChild(root);
    return root;
  }

  RN.opsUI = { h: h, btn: btn, st: st, card: card, select: select, search: search, chips: chips, kv: kv, timeline: timeline, clock: clock, since: since, fmtN: fmtN,
    geoBar: geoBar, table: table, act: act, can: can, me: me, form: form, mount: mount };
})();
