/* RideNova - small view toolkit shared by the hand-written screens of the driver, partner and admin apps (copy kept in each
   app folder so every folder stays standalone). Builds DOM with textContent only (CSP safe); persists demo data in localStorage
   (synthetic data only) with an in-memory fallback. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, K = RN.kit;
  var L = RN.lite = { tickers: [] };
  function add(n, k) { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(function (c) { add(n, c); }); else if (k.nodeType) n.appendChild(k); else n.appendChild(document.createTextNode(String(k))); }
  function h(tag, a, kids) {
    var n = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k]; if (v == null || v === false) return;
      if (k === 'class') n.className = v; else if (k === 'on') Object.keys(v).forEach(function (ev) { n.addEventListener(ev, v[ev]); }); else if (k === 'value') n.value = v; else if (v === true) n.setAttribute(k, ''); else n.setAttribute(k, v);
    });
    add(n, kids); return n;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); return n; }
  function pad(n) { return String(n).padStart(2, '0'); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function rs(paise) { var r = paise / 100; return (paise < 0 ? '-' : '') + '\u20B9' + Math.abs(r).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: r % 1 ? 2 : 0 }); }
  function ftime(t) { var d = new Date(t), hh = d.getHours() % 12 || 12; return hh + ':' + pad(d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM'); }
  function fdt(t) { var d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()] + ', ' + ftime(t); }
  function seeded(str) { var s = 0; for (var i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  Object.assign(L, { h: h, clear: clear, rs: rs, ftime: ftime, fdt: fdt, pad: pad, seeded: seeded });

  // persistent store
  L.store = function (key, init) {
    var data = null, memOnly = false;
    try { data = JSON.parse(window.localStorage.getItem(key)); } catch (e) { memOnly = true; }
    if (!data || typeof data !== 'object') data = JSON.parse(JSON.stringify(init));
    Object.keys(init).forEach(function (k) { if (data[k] === undefined) data[k] = JSON.parse(JSON.stringify(init[k])); });
    return { data: data, save: function () { if (memOnly) return; try { window.localStorage.setItem(key, JSON.stringify(data)); } catch (e) { memOnly = true; } }, reset: function () { try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ } } };
  };

  // building blocks
  L.btn = function (label, cls, fn) { return h('button', { type: 'button', class: 'btn rn-blk ' + (cls || '') + (/ghost|soft|danger|sm/.test(cls || '') ? '' : ' p-primary'), on: fn ? { click: fn } : null }, label); };
  L.sec = function (t) { return h('div', { class: 'xs p-sec' }, t); };
  L.empty = function (t) { return h('div', { class: 'p-empty' }, t); };
  L.kv = function (a, b) { return h('div', { class: 'kv' }, [h('span', null, a), h('span', null, b)]); };
  L.banner = function (kind, text) { return h('div', { class: 'banner ' + (kind || 'info'), role: 'status' }, text); };
  L.field = function (o) {
    var id = 'l-' + o.name + '-' + Math.random().toString(36).slice(2, 6), box = h('div', { class: 'box' }), input;
    if (o.select) { input = h('select', { id: id, name: o.name, class: 'rn-input' }, o.select.map(function (s) { var v = Array.isArray(s) ? s[0] : s, t = Array.isArray(s) ? s[1] : s; return h('option', { value: v }, t); })); if (o.value != null) input.value = o.value; }
    else if (o.area) { box.classList.add('rn-textarea'); input = h('textarea', { id: id, name: o.name, class: 'rn-input', rows: o.rows || 3, maxlength: o.maxlength || 300, placeholder: o.placeholder || '' }); input.value = o.value || ''; }
    else input = h('input', { id: id, name: o.name, class: 'rn-input', type: o.type || 'text', value: o.value == null ? '' : o.value, placeholder: o.placeholder || '', maxlength: o.maxlength, inputmode: o.inputmode, autocomplete: 'off', min: o.min, max: o.max });
    if (o.prefix) box.appendChild(h('span', { class: 'p-prefix' }, o.prefix));
    box.appendChild(input);
    if (!o.area && !o.select) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var pb = UI.q('#mock .p-sheet .p-primary') || UI.q('#mock .p-primary'); if (pb) { e.preventDefault(); pb.click(); } } });
    return h('div', { class: 'inp rn-field' }, [h('label', { for: id }, o.label), box, h('span', { class: 'rn-err', id: id + '-e', 'data-err': o.name, hidden: true })]);
  };
  L.chips = function (options, selected, onPick) {
    var box = h('div', { class: 'chips', role: 'radiogroup' }), cur = selected;
    options.forEach(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; var b = h('button', { type: 'button', class: 'chip' + (cur === v ? ' on' : ''), 'aria-pressed': String(cur === v) }, t); b.addEventListener('click', function () { cur = v; Array.prototype.forEach.call(box.children, function (c) { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', String(c === b)); }); onPick && onPick(v); }); box.appendChild(b); });
    return box;
  };
  L.toggle = function (on, onChange, label) {
    var t = h('button', { type: 'button', class: 'toggle' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on), 'aria-label': label || 'toggle' });
    t.addEventListener('click', function () { var v = !t.classList.contains('on'); t.classList.toggle('on', v); t.setAttribute('aria-checked', String(v)); onChange && onChange(v); }); return t;
  };
  L.row = function (o) {
    var tag = o.onClick && !o.trail ? 'button' : 'div', r = h(tag, { class: 'li', type: tag === 'button' ? 'button' : null }, [o.icon ? h('span', { class: 'ic ' + (o.tone || '') }, o.icon) : null, h('span', { class: 'tx' }, [h('b', null, o.title), o.sub ? h('span', null, o.sub) : null]), o.right ? h('span', { class: 'tag ' + (o.kind || '') }, o.right) : null, o.trail || null]);
    if (o.onClick) { r.addEventListener('click', function (e) { if (e.target.closest('.toggle,.chip,input,select') && e.target.closest('.toggle,.chip,input,select') !== r) return; o.onClick(e); }); if (tag === 'div') { r.setAttribute('role', 'button'); r.setAttribute('tabindex', '0'); r.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === r) { e.preventDefault(); o.onClick(e); } }); } } return r;
  };
  L.list = function (rows) { return h('div', { class: 'list' }, rows); };
  L.sheet = function (title, build) {
    var scr = UI.q('#mock .scr'); if (!scr) return null; var old = UI.q('.p-scrim', scr); if (old) old.remove();
    var body = h('div', { class: 'p-sheet-body' }), onKey = function (e) { if (e.key === 'Escape') close(); };
    var close = function () { scrim.remove(); document.removeEventListener('keydown', onKey); };
    var sheet = h('div', { class: 'p-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [h('div', { class: 'grab' }), h('div', { class: 'p-sheet-hd' }, [h('b', { class: 'h2' }, title), h('button', { type: 'button', class: 'ib p-x', 'aria-label': 'Close', on: { click: close } }, '\u00D7')]), body]);
    var scrim = h('div', { class: 'p-scrim' }, sheet); scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    document.addEventListener('keydown', onKey); scr.appendChild(scrim);
    var api = { close: close, body: body }; build(body, api); var f = UI.q('input,select,textarea', body); if (f) f.focus(); return api;
  };
  // define or extend a screen: build(body, ctx) draws into the screen's .body (status bar, app bar and bottom nav are kept)
  L.screen = function (sid, build, more) {
    var sec = function () { return document.querySelector('.rn-screen[data-sid="' + sid + '"]'); };
    var cfg = Object.assign({}, more || {}, { init: function (ctx) { var body = UI.q('.body', sec()); if (!body) return; clear(body); body.classList.remove('x-gap-10px'); body.classList.add('p-lite'); var v = { ctx: ctx, redraw: function () { clear(body); build(body, v); } }; build(body, v); if (more && more.init) more.init(ctx); } });
    if (RN.screens[sid]) K.extend(sid, cfg); else K.def(sid, cfg);
  };
  L.every = function (fn) { L.tickers.push(fn); };
  setInterval(function () { L.tickers.forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } }); }, 1000);
})();