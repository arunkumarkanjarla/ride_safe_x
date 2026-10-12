/* RideNova Customer app - view toolkit for the working screens (product-*.js).
   Builds screens with the existing design classes (.ab .body .list .li .opt .chip .btn .inp .card-m ...) using DOM calls and
   textContent only (CSP safe). A screen is registered with P.screen(sid, {...}); it is (re)drawn on entry. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, K = RN.kit, S = RN.store;
  var P = RN.product = { nav: {}, tickers: [], ICON: {} };
  var NS = 'http://www.w3.org/2000/svg';
  var RUP = '\u20B9';

  // ------------------------------------------------------------ small helpers
  function add(n, k) {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(function (c) { add(n, c); });
    else if (k.nodeType) n.appendChild(k);
    else n.appendChild(document.createTextNode(String(k)));
  }
  function h(tag, a, kids) {
    var n = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k]; if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { n.addEventListener(ev, v[ev]); });
      else if (k === 'value') n.value = v;
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    });
    add(n, kids); return n;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); return n; }
  function rs(paise) { var r = paise / 100; return (paise < 0 ? '-' : '') + RUP + Math.abs(r).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: r % 1 ? 2 : 0 }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fdate(t) { var d = new Date(t); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function ftime(t) { var d = new Date(t), hh = d.getHours() % 12 || 12; return hh + ':' + pad(d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM'); }
  function fdt(t) { return fdate(t) + ', ' + ftime(t); }
  function isoDate(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0).getTime() : NaN; }
  function startOfDay(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function seeded(str) { var s = 0; for (var i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function esc(s) { return String(s == null ? '' : s); }
  function mins(m) { return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min'; }
  Object.assign(P, { h: h, add: add, clear: clear, rs: rs, fdate: fdate, ftime: ftime, fdt: fdt, isoDate: isoDate, parseIso: parseIso, startOfDay: startOfDay, seeded: seeded, mins: mins, pad: pad, RUP: RUP });

  // ------------------------------------------------------------ icons
  var PATHS = {
    pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
    chev: 'M9 6l6 6-6 6', back: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6L6 18',
    bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
    wallet: 'M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l2-3h12v3M16 13.5h2', car: 'M5 16v-5l2-5h10l2 5v5M3 16h18M7.5 16v2.5M16.5 16v2.5M7 12h10',
    bike: 'M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15l4-7h5l3 7M9 8H7', auto: 'M3 16V9l4-4h8l3 4h3v7M3 16h18M7 18.5a2 2 0 1 0 0-4M17 18.5a2 2 0 1 0 0-4',
    bus: 'M5 5h14v12H5zM5 11h14M8 17v3M16 17v3M8.5 14h.01M15.5 14h.01', bed: 'M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6M7 11.5a1.5 1.5 0 1 0 0-3',
    food: 'M7 3v8a2 2 0 0 0 2 2v8M7 3v6M11 3v6M16 3c-2 2-2 6 0 8v10', box: 'M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z', tag: 'M3 12V4h8l10 10-8 8zM7.5 8h.01',
    clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2l-5.5 3 1-6.2L3 9.6l6.2-.9z',
    home: 'M3 11l9-8 9 8M5 10v10h14V10', calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-5 7-5s7 1.5 7 5M17 4.5a3.5 3.5 0 0 1 0 6.5M22 20c0-2.5-1.5-4-4-4.7',
    camera: 'M4 8h3l2-3h6l2 3h3v12H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01', percent: 'M19 5L5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    download: 'M12 4v11M7 11l5 5 5-5M4 20h16', globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    idcard: 'M3 6h18v12H3zM8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5.5 16c.5-1.5 5.5-1.5 6 0M14 10h4M14 14h4', bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
    logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9', send: 'M3 11l18-8-8 18-2-8z', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
    card: 'M3 6h18v12H3zM3 10h18M7 15h4', key: 'M14 10a4 4 0 1 0-2.9 3.8L13 16h2v2h2v2h3v-3l-6.1-6.2', car2: 'M5 15v-4l2-4h10l2 4v4M5 15h14M8 18v-3M16 18v-3', heart: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5', info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01', repeat: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 5v4h-4M4 19v-4h4'
  };
  function ic(name, size) {
    var s = document.createElementNS(NS, 'svg'); size = size || 18;
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.9'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(NS, 'path'); p.setAttribute('d', PATHS[name] || PATHS.info); s.appendChild(p); return s;
  }
  P.ic = ic;

  // ------------------------------------------------------------ building blocks
  P.btn = function (label, cls, fn, attrs) { return h('button', Object.assign({ type: 'button', class: 'btn rn-blk ' + (cls || '') + (/ghost|soft|danger|sm/.test(cls || '') ? '' : ' p-primary'), on: fn ? { click: fn } : null }, attrs || {}), label); };
  P.sec = function (t) { return h('div', { class: 'xs p-sec' }, t); };
  P.banner = function (kind, text, icon) { return h('div', { class: 'banner ' + (kind || 'info'), role: 'status' }, [ic(icon || 'info'), h('span', null, text)]); };
  P.empty = function (text, icon) { return h('div', { class: 'p-empty' }, [ic(icon || 'info', 26), h('span', null, text)]); };
  P.kv = function (a, b, cls) { return h('div', { class: 'kv' + (cls ? ' ' + cls : '') }, [h('span', null, a), h('span', null, b)]); };
  P.card = function (kids, cls) { return h('div', { class: 'card-m ' + (cls || '') }, kids); };
  P.avatar = function (u, size) {
    var a = h('div', { class: 'av ' + (size || '') });
    if (u && u.photo) a.appendChild(h('img', { src: u.photo, alt: '', class: 'p-avimg' })); else a.textContent = u ? S.initials(u.name) : '?';
    return a;
  };
  P.field = function (o) {
    var id = 'p-' + o.name + '-' + Math.random().toString(36).slice(2, 6), box = h('div', { class: 'box' });
    var input;
    if (o.select) {
      input = h('select', { id: id, name: o.name, class: 'rn-input', 'aria-describedby': id + '-e' }, o.select.map(function (s) { var v = Array.isArray(s) ? s[0] : s, t = Array.isArray(s) ? s[1] : s; return h('option', { value: v }, t); }));
      if (o.value != null) input.value = o.value;
    } else if (o.area) {
      box.classList.add('rn-textarea');
      input = h('textarea', { id: id, name: o.name, class: 'rn-input', rows: o.rows || 3, maxlength: o.maxlength || 500, placeholder: o.placeholder || '', 'aria-describedby': id + '-e' }); input.value = o.value || '';
    } else {
      input = h('input', { id: id, name: o.name, class: 'rn-input', type: o.type || 'text', value: o.value == null ? '' : o.value, placeholder: o.placeholder || '', maxlength: o.maxlength, inputmode: o.inputmode, autocomplete: o.autocomplete || 'off', min: o.min, max: o.max, step: o.step, 'aria-describedby': id + '-e', readonly: o.readonly });
    }
    if (o.prefix) box.appendChild(h('span', { class: 'p-prefix' }, o.prefix));
    box.appendChild(input);
    if (o.on) Object.keys(o.on).forEach(function (ev) { input.addEventListener(ev, o.on[ev]); });
    if (!o.area && !o.select) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var pb = UI.q('#mock .p-sheet .p-primary') || UI.q('#mock .p-primary'); if (pb) { e.preventDefault(); pb.click(); } } });
    var f = h('div', { class: 'inp rn-field' + (o.cls ? ' ' + o.cls : '') }, [h('label', { for: id }, o.label), box, h('span', { class: 'rn-err', id: id + '-e', 'data-err': o.name, hidden: true })]);
    f.input = input; return f;
  };
  // a plain search box that does not trigger the primary button on Enter
  P.search = function (placeholder, onInput) {
    var i = h('input', { class: 'p-search', type: 'search', placeholder: placeholder, 'aria-label': placeholder, autocomplete: 'off' });
    i.addEventListener('input', function () { onInput(i.value); });
    return h('div', { class: 'inp' }, h('div', { class: 'box p-searchbox' }, [ic('search', 18), i]));
  };
  P.chips = function (options, selected, onPick, multi) {
    var box = h('div', { class: 'chips', role: multi ? 'group' : 'radiogroup' }), cur = multi ? (selected || []).slice() : selected;
    options.forEach(function (o) {
      var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      var on = multi ? cur.indexOf(v) >= 0 : cur === v;
      var b = h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-v': v }, t);
      b.addEventListener('click', function () {
        if (multi) { var i = cur.indexOf(v); if (i >= 0) cur.splice(i, 1); else cur.push(v); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); onPick && onPick(cur.slice(), v); }
        else { cur = v; Array.prototype.forEach.call(box.children, function (c) { var s = c === b; c.classList.toggle('on', s); c.setAttribute('aria-pressed', String(s)); }); onPick && onPick(v); }
      });
      box.appendChild(b);
    });
    box.get = function () { return cur; };
    box.set = function (v) { cur = v; Array.prototype.forEach.call(box.children, function (c) { var s = multi ? v.indexOf(c.getAttribute('data-v')) >= 0 : c.getAttribute('data-v') === v; c.classList.toggle('on', s); c.setAttribute('aria-pressed', String(s)); }); };
    return box;
  };
  P.toggle = function (on, onChange, label) {
    var t = h('button', { type: 'button', class: 'toggle' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on), 'aria-label': label || 'toggle' });
    t.addEventListener('click', function () { var v = !t.classList.contains('on'); t.classList.toggle('on', v); t.setAttribute('aria-checked', String(v)); onChange && onChange(v); });
    t.get = function () { return t.classList.contains('on'); };
    return t;
  };
  P.row = function (o) {
    var attrs = { class: 'li' + (o.on ? ' on' : '') };
    if (o.go) { attrs['data-go'] = o.go; }
    var tag = (o.onClick || o.go) ? 'button' : 'div';
    if (tag === 'button') attrs.type = 'button';
    var r = h(tag, attrs, [
      o.icon ? h('span', { class: 'ic ' + (o.tone || '') }, ic(o.icon)) : (o.lead || null),
      h('span', { class: 'tx' }, [h('b', null, o.title), o.sub ? h('span', null, o.sub) : null]),
      o.right ? h('span', { class: 'tag ' + (o.rightKind || '') }, o.right) : null, o.trail || null, (o.chev && ic('chev', 16)) || null]);
    if (o.onClick) r.addEventListener('click', o.onClick);
    return r;
  };
  P.list = function (rows) { return h('div', { class: 'list' }, rows); };
  P.opt = function (o) {
    var b = h('button', { type: 'button', class: 'opt p-optb' + (o.on ? ' on' : ''), 'aria-pressed': String(!!o.on) }, [
      o.icon ? h('span', { class: 'veh' }, ic(o.icon, 22)) : null,
      h('span', { class: 'tx' }, [h('b', null, o.title), o.sub ? h('span', null, o.sub) : null, o.sub2 ? h('span', null, o.sub2) : null]),
      o.price ? h('span', { class: 'pr' }, o.price) : null]);
    if (o.onClick) b.addEventListener('click', o.onClick);
    return b;
  };
  P.pickGroup = function (container) {   // single selection among .opt / .li buttons inside a container
    return function (btn) { Array.prototype.forEach.call(container.querySelectorAll('[aria-pressed]'), function (c) { c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); }); btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); };
  };
  P.stepper = function (qty, onChange, min, max) {
    var val = qty, out = h('span', { class: 'p-qty', 'aria-live': 'polite' }, String(val));
    var minus = h('button', { type: 'button', class: 'p-step', 'aria-label': 'Decrease' }, ic('minus', 14)), plus = h('button', { type: 'button', class: 'p-step', 'aria-label': 'Increase' }, ic('plus', 14));
    function set(v) { val = Math.max(min == null ? 0 : min, Math.min(max == null ? 99 : max, v)); out.textContent = String(val); onChange(val); }
    minus.addEventListener('click', function () { set(val - 1); }); plus.addEventListener('click', function () { set(val + 1); });
    var w = h('div', { class: 'p-stepper' }, [minus, out, plus]); w.set = set; w.get = function () { return val; }; return w;
  };
  P.progress = function (pct) { var i = h('i'); i.style.width = Math.max(0, Math.min(100, pct)) + '%'; var p = h('div', { class: 'progress' }, i); p.set = function (v) { i.style.width = Math.max(0, Math.min(100, v)) + '%'; }; return p; };
  P.setWidth = function (n, pct) { var i = n.firstElementChild && n.classList.contains('progress') ? n.firstElementChild : n; i.style.width = Math.max(0, Math.min(100, pct)) + '%'; };
  P.err = function (name, msg) { UI.fieldError(name, msg); };
  P.clearErr = P.clearErrors = function () { UI.clearErrors(); };

  // ------------------------------------------------------------ sheets (bottom dialogs inside the phone)
  P.sheet = function (title, build) {
    var scr = UI.q('#mock .scr'); if (!scr) return null;
    var old = UI.q('.p-scrim', scr); if (old) old.remove();
    var body = h('div', { class: 'p-sheet-body' });
    var close = function () { scrim.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    var sheet = h('div', { class: 'p-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [h('div', { class: 'grab' }), h('div', { class: 'p-sheet-hd' }, [h('b', { class: 'h2' }, title), h('button', { type: 'button', class: 'ib p-x', 'aria-label': 'Close', on: { click: close } }, ic('x', 16))]), body]);
    var scrim = h('div', { class: 'p-scrim' }, sheet);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    document.addEventListener('keydown', onKey);
    scr.appendChild(scrim);
    var api = { close: close, body: body, sheet: sheet };
    build(body, api);
    var first = UI.q('input,select,textarea,button.btn', body); if (first && first.tagName !== 'BUTTON') first.focus();
    return api;
  };
  // payment chooser. opts: {title, paise, allow:[...], note, onPaid(method)}
  P.pay = function (opts) {
    var u = S.user(), allow = opts.allow || ['Wallet', 'UPI', 'Card'], choice = null;
    P.sheet(opts.title || 'Pay', function (body, api) {
      body.appendChild(h('div', { class: 'p-total' }, [h('span', { class: 'xs' }, 'Amount to pay'), h('b', { class: 'big-num' }, rs(opts.paise))]));
      if (opts.note) body.appendChild(h('div', { class: 'xs' }, opts.note));
      var list = h('div', { class: 'list p-paylist' });
      var defs = { Wallet: ['wallet', 'RideNova wallet', rs(u.walletPaise) + ' available'], UPI: ['bolt', 'UPI', (u.methods || []).filter(function (m) { return m.type === 'upi'; }).map(function (m) { return m.value; })[0] || 'Pay with any UPI app'], Card: ['card', 'Debit / credit card', (u.methods || []).filter(function (m) { return m.type === 'card'; }).map(function (m) { return m.brand + ' ending ' + m.last4; })[0] || 'Enter card at checkout (simulated)'], Cash: ['wallet', 'Pay in cash', 'Pay when you receive'] };
      allow.forEach(function (m) {
        var d = defs[m], low = m === 'Wallet' && u.walletPaise < opts.paise;
        var row = P.row({ icon: d[0], tone: 'brand', title: d[1], sub: low ? 'Balance too low: add money first' : d[2], onClick: function () { if (low) { UI.toast('Add money to your wallet first.', 'warn'); return; } choice = m; P.pickGroup(list)(row); } });
        row.setAttribute('aria-pressed', 'false'); if (low) row.classList.add('p-disabled'); list.appendChild(row);
      });
      body.appendChild(list);
      var go = P.btn('Pay ' + rs(opts.paise), '', function () {
        if (!choice) { UI.toast('Choose how you want to pay.', 'error'); return; }
        go.disabled = true; go.textContent = 'Processing payment...';
        setTimeout(function () {
          var cur = S.user();
          if (choice === 'Wallet' && !S.debit(cur, opts.paise, opts.title || 'Payment', 'Payment')) { go.disabled = false; go.textContent = 'Pay ' + rs(opts.paise); UI.toast('Wallet balance changed. Choose another method.', 'error'); return; }
          api.close(); opts.onPaid(choice);
        }, 900);
      });
      body.appendChild(go);
    });
  };

  // ------------------------------------------------------------ bottom navigation
  var NAVS = [['home', 'R29', 'Home', 'home'], ['trips', 'R54', 'Trips', 'calendar'], ['savings', 'R49', 'Savings', 'percent'], ['wallet', 'R21', 'Wallet', 'wallet'], ['account', 'R28', 'Account', 'user']];
  var NAV_OF = { R29: 'home', R07: 'home', R54: 'trips', R20: 'trips', R49: 'savings', R22: 'savings', R21: 'wallet', R28: 'account', R24: 'account', R25: 'account', R26: 'account', R53: 'account' };
  function navFor(active) {
    var n = h('nav', { class: 'bnav', 'aria-label': 'App navigation' });
    NAVS.forEach(function (x) { var a = h('a', { class: 'bn' + (x[0] === active ? ' on' : ''), href: '#/' + x[1], 'data-go': x[1], 'aria-current': x[0] === active ? 'page' : null }, [ic(x[3]), x[2]]); n.appendChild(a); });
    return n;
  }
  P.navFor = navFor;
  function fixNavs() {   // every bottom bar of the app becomes the same five items
    UI.qa('.rn-screen').forEach(function (sec) {
      var bar = UI.q('.bnav', sec); if (!bar) return;
      var sid = sec.getAttribute('data-sid'); bar.parentNode.replaceChild(navFor(NAV_OF[sid] || 'home'), bar);
    });
  }

  // ------------------------------------------------------------ screen registry
  var stage = null;
  function ensureSection(sid, title) {
    stage = stage || UI.q('#app-stage') || document.getElementById('app-stage');
    var sec = document.querySelector('.rn-screen[data-sid="' + sid + '"]');
    if (!sec) {
      sec = h('section', { class: 'rn-screen', 'data-sid': sid, 'aria-label': title, hidden: true }, [h('h1', { class: 'rn-vh' }, title), h('div', { class: 'mock-holder' }, h('div', { class: 'phone' }, h('div', { class: 'scr' })))]);
      stage.appendChild(sec);
    }
    var reg = window.RN_SCREENS;
    if (!reg[sid]) reg[sid] = { app: 'rider', title: title, to: [], from: ['R29'] };
    return sec;
  }
  function statusBar() { return h('div', { class: 'sb' }, [h('span', { class: 'p-clock' }, clockText()), h('span', { class: 'isl' }), h('span', { class: 'ico' }, ['5G ', h('i')])]); }
  function clockText() { var d = new Date(); return d.getHours() + ':' + pad(d.getMinutes()); }

  // cfg: title, back (sid), nav (bool|string), right (fn->nodes), needUser (default true), reset(), build(body, view), update(view, state), tick(view), actions
  P.screen = function (sid, cfg) {
    var sec = ensureSection(sid, typeof cfg.title === 'function' ? sid : cfg.title), view = { sid: sid, sec: sec, cfg: cfg, body: null, ab: null, scr: UI.q('.scr', sec) };
    view.draw = function () {
      var scr = view.scr = UI.q('.scr', sec), titleText = typeof cfg.title === 'function' ? cfg.title(view) : cfg.title;
      clear(scr);
      var kids = [statusBar()];
      var back = cfg.back ? h('button', { class: 'ib', type: 'button', 'aria-label': 'Back', 'data-back': true, 'data-back-to': '#/' + (typeof cfg.back === 'function' ? cfg.back(view) : cfg.back) }, ic('back', 18)) : null;
      view.ab = h('div', { class: 'ab' }, [back, h('span', { class: 't' }, titleText), cfg.right ? cfg.right(view) : null]);
      if (!cfg.hideBar) kids.push(view.ab);
      view.body = h('div', { class: 'body' + (cfg.nopad ? ' nopad' : '') + (cfg.cls ? ' ' + cfg.cls : '') });
      kids.push(view.body);
      if (cfg.nav) kids.push(navFor(typeof cfg.nav === 'string' ? cfg.nav : NAV_OF[sid] || 'home'));
      kids.forEach(function (k) { scr.appendChild(k); });
      cfg.build(view.body, view);
    };
    var base = {
      init: function (ctx) {
        view.ctx = ctx;
        if (cfg.needUser !== false && !S.user()) { UI.go(P.nav.pendingPhone ? 'R05' : 'R58', { replace: true }); return; }
        if (cfg.reset) cfg.reset(view);
        view.draw();
        if (cfg.onShow) cfg.onShow(view);
      },
      update: function (ctx, s) { if (cfg.update && view.body) cfg.update(view, s); },
      tick: function (ctx, s) { if (cfg.tick && view.body) cfg.tick(view, s); },
      actions: cfg.actions || {}
    };
    K.def(sid, base);
    P.views = P.views || {}; P.views[sid] = view;
    return view;
  };

  // ------------------------------------------------------------ global ticker (clock, background simulations)
  P.every = function (fn) { P.tickers.push(fn); };
  setInterval(function () {
    var t = clockText(); UI.qa('.p-clock').forEach(function (n) { if (n.textContent !== t) n.textContent = t; });
    P.tickers.forEach(function (fn) { try { fn(); } catch (e) { /* a simulation must never break the app */ } });
  }, 1000);

  document.addEventListener('DOMContentLoaded', fixNavs);
  if (document.readyState !== 'loading') fixNavs();
})();