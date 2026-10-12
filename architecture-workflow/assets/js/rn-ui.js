/* RideNova static applications – runtime shared by the generated apps
   (customer-app, driver-app, patner-app, admin). The agent portal (agent-portal/) has its own page script.

   * One HTML document per app; every screen is a <section class="rn-screen" data-sid="…">. Navigation changes the
     hash route (#/R07), so the in-memory demo state survives navigation inside the app and resets on reload.
   * State lives only in memory (no localStorage, sessionStorage, IndexedDB or cookies).
   * Connected demo: when an app runs inside connected-demo/index.html (same origin, e.g. a local HTTP server), it
     uses the hub's engine, so all apps on that page share one scenario. Otherwise it creates its own engine.
   * Interprets the data-* attributes written by source/proto_wiring.py. Text is set with textContent only. */
(function () {
  'use strict';
  var RN = window.RN = window.RN || {};
  var REG = window.RN_SCREENS || {};
  var LIB = RN.engineLib;
  var ACTOR = { rider: 'rider', driver: 'driver', partner: 'partner', admin: 'admin', support: 'rider' };
  var APP_NAME = { rider: 'customer app', driver: 'driver app', partner: 'partner app', admin: 'admin portal', support: 'agent portal' };
  var OFFLINE_OK = { 'x.endTrip': 1, 'x.arrive': 1, 'x.startTrip': 1, 'x.sos': 1, 'x.driverSos': 1, 'x.sync': 1 };

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (attrs[k] === true) n.setAttribute(k, '');
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtTime(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function fmtClock(t) { var d = new Date(t); return d.getHours() % 12 === 0 ? '12:' + pad(d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM') : (d.getHours() % 12) + ':' + pad(d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM'); }

  var UI = RN.ui = { el: el, clear: clear, q: q, qa: qa, fmtTime: fmtTime, fmtClock: fmtClock, rupees: LIB ? LIB.rupees : String, mem: {} };

  // ---------------------------------------------------------------- navigation
  UI.appOf = function (sid) { return REG[sid] ? REG[sid].app : null; };
  // where the other applications live: assets/js/config.js of this app (edit it when the apps run on different servers)
  var CONFIG = window.RN_CONFIG || {};
  // each application runs on its own server: no fallback to a neighbouring folder
  UI.appUrl = function (sid) {
    var base = CONFIG.apps && CONFIG.apps[UI.appOf(sid)];
    return base ? base + '#/' + sid : null;
  };
  UI.later = function (sid, ms) {
    // navigate after a short pause only if the user is still on the screen that asked for it
    var seq = UI.navSeq; setTimeout(function () { if (UI.navSeq === seq) UI.go(sid); }, ms);
  };
  UI.go = function (sid, opts) {
    opts = opts || {};
    if (!REG[sid]) return;
    if (UI.appOf(sid) !== UI.app) {                       // another application
      if (UI.hub) { UI.hub.open(UI.appOf(sid), sid); return; }
      var url = UI.appUrl(sid);
      if (url) location.assign(url); else UI.toast('The ' + APP_NAME[UI.appOf(sid)] + ' address is not set in assets/js/config.js.', 'error');
      return;
    }
    if (sid === UI.sid && !opts.reload) return;
    if (opts.replace) location.replace('#/' + sid); else location.hash = '#/' + sid;
  };
  UI.back = function (fallback) {
    if (UI.stack.length > 1) { history.back(); return; }
    var target = (fallback || '').replace(/^#\//, '');
    if (REG[target]) UI.go(target, { replace: true });
    else { var from = (REG[UI.sid] || {}).from || []; UI.go(from[0] || UI.entry, { replace: true }); }
  };

  // ---------------------------------------------------------------- toasts and dialogs
  UI.toast = function (text, kind) {
    var box = q('[data-rn="toasts"]'); if (!box || !text) return;
    var t = el('div', { class: 'rn-toast ' + (kind || 'info'), role: kind === 'error' ? 'alert' : 'status' });
    if (kind === 'sim') t.appendChild(el('b', null, 'Simulated · '));
    t.appendChild(document.createTextNode(String(text).replace(/^Simulated in the prototype: /, '')));
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, kind === 'error' ? 6000 : 4200);
  };
  function dialog(text, build, ok, cancel) {
    return new Promise(function (resolve) {
      var d = el('dialog', { class: 'rn-dialog', 'aria-labelledby': 'rn-dlg-t' });
      d.appendChild(el('p', { id: 'rn-dlg-t' }, text));
      var value = build ? build(d) : null;
      var row = el('div', { class: 'rn-dialog-row' });
      var no = el('button', { type: 'button', class: 'rn-dbtn' }, cancel || 'Cancel');
      var yes = el('button', { type: 'button', class: 'rn-dbtn primary' }, ok || 'Yes, continue');
      row.appendChild(no); row.appendChild(yes); d.appendChild(row);
      document.body.appendChild(d);
      function done(v) { d.close(); d.remove(); resolve(v); }
      no.addEventListener('click', function () { done(value ? null : false); });
      yes.addEventListener('click', function () { done(value ? value() : true); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); done(value ? null : false); });
      d.showModal(); (q('input,select,textarea', d) || yes).focus();
    });
  }
  UI.confirm = function (text, okLabel) { return dialog(text, null, okLabel || 'Yes, continue', 'Keep'); };
  UI.prompt = function (text, label, value) {
    return dialog(text, function (d) {
      var lab = el('label', { class: 'rn-f block' }, label), inp = el('input', { type: 'text', value: value || '', maxlength: '200' });
      lab.appendChild(inp); d.appendChild(lab);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); q('.primary', d).click(); } });
      return function () { return inp.value; };
    }, 'OK', 'Cancel');
  };

  // ---------------------------------------------------------------- bindings, fields, state panels (scoped to the active screen = #mock)
  UI.bind = function (name, text) { qa('#mock [data-bind="' + name + '"]').forEach(function (n) { if (n.textContent !== text) n.textContent = text; }); };
  UI.field = function (name) { return q('#mock [name="' + name + '"]'); };
  UI.val = function (name) { var f = UI.field(name); return f ? f.value : ''; };
  UI.fieldError = function (name, msg) {
    var input = UI.field(name) || q('#mock [data-otp="' + name + '"] input');
    var err = q('#mock [data-err="' + name + '"]');
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); if (msg) input.focus(); }
    if (err) { err.textContent = msg || ''; err.hidden = !msg; }
  };
  UI.clearErrors = function () { qa('#mock [data-err]').forEach(function (e) { e.hidden = true; e.textContent = ''; }); qa('#mock [aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); }); };
  UI.options = function (name, list, selected) {
    var s = UI.field(name); if (!s) return;
    var cur = selected != null ? selected : s.value;
    clear(s);
    list.forEach(function (o) { var v = typeof o === 'string' ? o : o[0], t = typeof o === 'string' ? o : o[1]; s.appendChild(el('option', { value: v }, t)); });
    if (cur && list.some(function (o) { return (typeof o === 'string' ? o : o[0]) === cur; })) s.value = cur;
  };
  UI.state = function (title, lines, buttons, kind) {
    // a status panel on top of the mock for states the approved screen does not draw (no driver, payment failed …)
    var host = q('#mock .phone .scr') || q('#mock .desk .dc') || q('#mock');
    var old = q('#mock .rn-state');
    var sig = JSON.stringify([title, lines, (buttons || []).map(function (b) { return b.label; }), kind]);
    if (old && title && old.getAttribute('data-sig') === sig) return old;
    if (old) old.remove();
    if (!title) return null;
    var p = el('div', { class: 'rn-state ' + (kind || ''), role: 'status', 'data-sig': sig });
    p.appendChild(el('b', null, title));
    (lines || []).forEach(function (l) { p.appendChild(el('span', null, l)); });
    if (buttons && buttons.length) {
      var row = el('div', { class: 'rn-state-row' });
      buttons.forEach(function (b) {
        var btn = el('button', { type: 'button', class: 'rn-sbtn' + (b.primary ? ' primary' : '') }, b.label);
        btn.addEventListener('click', function () { if (!btn.disabled) b.onClick(btn); });
        row.appendChild(btn);
      });
      p.appendChild(row);
    }
    host.appendChild(p);
    return p;
  };
  UI.list = function (container, rows) {
    // rebuilds a list with the approved .li row design; rows: {icon class, title, sub, right, tone, do, arg, go}
    clear(container);
    rows.forEach(function (r) {
      var attrs = { class: 'li' + (r.on ? ' on' : ''), tabindex: '0', role: 'button' };
      if (r.do) attrs['data-do'] = r.do; if (r.arg) attrs['data-arg'] = r.arg; if (r.go) attrs['data-go'] = r.go; if (r.ui) attrs['data-ui'] = r.ui;
      if (!r.do && !r.go && !r.ui) { delete attrs.tabindex; delete attrs.role; }
      var row = el('div', attrs);
      var ic = el('span', { class: 'ic ' + (r.tone || '') }, r.badge || '');
      var tx = el('span', { class: 'tx' }); tx.appendChild(el('b', null, r.title)); if (r.sub) tx.appendChild(el('span', null, r.sub));
      row.appendChild(ic); row.appendChild(tx);
      if (r.right) row.appendChild(el('span', { class: 'tag ' + (r.rightKind || '') }, r.right));
      container.appendChild(row);
    });
    if (!rows.length && container.getAttribute('data-empty')) container.appendChild(el('div', { class: 'rn-empty' }, container.getAttribute('data-empty')));
  };

  // ---------------------------------------------------------------- running commands
  var LATENCY = 300;   // simulated network latency (ms)
  UI.exec = function (cmd, payload, opts) {
    opts = opts || {};
    var e = UI.engine, ctrl = opts.el;
    payload = payload || {};
    if (!payload.key) payload.key = UI.sid + ':' + cmd + ':' + (payload.arg || payload.id || '') + ':' + e.state.rev;
    if (ctrl) { ctrl.setAttribute('aria-busy', 'true'); ctrl.classList.add('rn-busy'); if (ctrl.tagName === 'BUTTON') ctrl.disabled = true; }
    return new Promise(function (resolve) {
      setTimeout(function () {
        var res = e.run(opts.actor || UI.actor, cmd, payload);
        if (ctrl) { ctrl.removeAttribute('aria-busy'); ctrl.classList.remove('rn-busy'); if (ctrl.tagName === 'BUTTON') ctrl.disabled = false; }
        if (res.duplicate) { resolve(res); return; }
        if (!res.ok) {
          UI.toast(res.error, 'error');
          if (res.fields) Object.keys(res.fields).forEach(function (f) { UI.fieldError(f, res.fields[f]); });
          if (res.go && !opts.noRedirect) UI.later(res.go, 900);
        } else if (res.queued) UI.toast(res.message, 'warn');
        resolve(res);
      }, opts.instant ? 0 : LATENCY);
    });
  };

  function pick(n) {
    var cls = ['chip', 'opt', 'li', 'mode', 'place', 'st', 'svc'].filter(function (c) { return n.classList.contains(c); })[0];
    qa(':scope > [data-ui="pick"]', n.parentElement).forEach(function (s) {
      if (!cls || s.classList.contains(cls) || s.tagName === n.tagName) { s.classList.remove('on'); s.classList.remove('ok'); s.setAttribute('aria-pressed', 'false'); }
    });
    n.classList.add(n.classList.contains('st') ? 'ok' : 'on'); n.setAttribute('aria-pressed', 'true');
    if (n.hasAttribute('data-filter')) filterTables(n.getAttribute('data-filter'), 'chip');
  }
  function toggle(n) {
    var on = !n.classList.contains('on');
    n.classList.toggle('on', on);
    n.setAttribute(n.getAttribute('role') === 'switch' ? 'aria-checked' : 'aria-pressed', String(on));
  }

  // admin / agent console: header search, filter chips and sortable columns act on the tables of the active screen
  var filters = { chip: '', text: '' };
  function filterTables(value, kind) {
    filters[kind] = value === 'All' ? '' : String(value || '').toLowerCase();
    qa('#mock table.dt tbody tr').forEach(function (tr) {
      var t = tr.textContent.toLowerCase();
      tr.hidden = !!((filters.chip && t.indexOf(filters.chip) < 0) || (filters.text && t.indexOf(filters.text) < 0));
    });
    qa('#mock table.dt').forEach(function (tb) {
      var shown = qa('tbody tr', tb).filter(function (r) { return !r.hidden; }).length, note = tb.nextElementSibling;
      if (note && note.classList.contains('rn-empty')) note.remove();
      if (!shown && (filters.chip || filters.text)) tb.insertAdjacentElement('afterend', el('div', { class: 'rn-empty' }, 'No rows match this filter.'));
    });
  }
  UI.filterTables = filterTables;
  function sortable(th) {
    th.setAttribute('role', 'button'); th.setAttribute('tabindex', '0'); th.setAttribute('aria-sort', 'none'); th.title = 'Sort';
    var sort = function () {
      var table = th.closest('table'), idx = Array.prototype.indexOf.call(th.parentElement.children, th), tbody = table.tBodies[0];
      if (!tbody) return;
      var dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
      qa('th', table).forEach(function (h) { h.setAttribute('aria-sort', 'none'); });
      th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
      var key = function (tr) { var c = tr.children[idx]; var t = c ? c.textContent.trim() : ''; var n = parseFloat(t.replace(/[₹,%\s]/g, '').replace(/^[^\d-]+/, '')); return isNaN(n) ? t.toLowerCase() : n; };
      qa('tr', tbody).sort(function (a, b) { var x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; }).forEach(function (r) { tbody.appendChild(r); });
    };
    th.addEventListener('click', sort);
    th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
  }

  function typeKey(key) {
    var a = document.activeElement;
    var input = a && a.matches && a.matches('#mock input') ? a : q('#mock .rn-otp-input') || q('#mock .rn-input');
    if (!input) return;
    if (key === '⌫') input.value = input.value.slice(0, -1);
    else if (!input.maxLength || input.maxLength < 0 || input.value.length < input.maxLength) input.value += key;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }

  UI.activate = function (n, ev) {
    if (n.hasAttribute('data-key')) { typeKey(n.getAttribute('data-key')); return; }
    if (n.getAttribute('aria-disabled') === 'true') { if (ev) ev.preventDefault(); UI.toast('Not available while this device is offline (simulated).', 'error'); return; }
    var go = n.getAttribute('data-go'), act = n.getAttribute('data-do'), ui = n.getAttribute('data-ui'), msg = n.getAttribute('data-msg');
    if (ev) ev.preventDefault();
    if (go && !act && !ui && !msg) {
      if (n.getAttribute('data-home') === 'driver' && UI.engine) { var d = UI.engine.persona(); UI.go(d && d.avail !== 'OFFLINE' ? 'D06' : 'D05'); return; }
      UI.go(go); return;
    }
    if (n.hasAttribute('data-back')) { UI.back(n.getAttribute('data-back-to')); return; }
    if (ui === 'pick') pick(n); else if (ui === 'toggle') toggle(n);
    var chain = Promise.resolve(true), conf = n.getAttribute('data-confirm');
    if (conf) chain = UI.confirm(conf);
    chain.then(function (yes) {
      if (!yes) return;
      if (msg && !act) UI.toast(msg, 'sim');
      if (!act) { if (go) UI.go(go); return; }
      var arg = n.getAttribute('data-arg'), p;
      if (act.indexOf('x.') === 0) {
        var c = UI.controller, fn = c && c.actions && c.actions[act.slice(2)];
        if (!fn) { UI.toast('This action has no simulation yet: ' + act, 'error'); return; }
        p = Promise.resolve(fn(n, arg, UI.ctx));
      } else p = UI.exec(act, { arg: arg, target: arg, id: arg }, { el: n });
      p.then(function (res) {
        if (res && res.ok === false) return;
        if (msg) UI.toast(msg, 'sim');
        if (go && res !== false) UI.go(go);
      });
    });
  };

  function setupHold(n) {
    var ms = Number(n.getAttribute('data-hold')) || 2000, timer = null;
    function fire() { var c = UI.controller, f = c && c.actions && c.actions[n.getAttribute('data-do').slice(2)]; if (f) f(n, null, UI.ctx); }
    function start(e) { if (e.button && e.button !== 0) return; n.classList.add('rn-holding'); n.style.setProperty('--rn-hold', ms + 'ms'); timer = setTimeout(function () { timer = null; n.classList.remove('rn-holding'); fire(); }, ms); }
    function stop() { if (timer) { clearTimeout(timer); timer = null; n.classList.remove('rn-holding'); UI.toast('Keep holding for 2 seconds to send SOS.', 'info'); } }
    n.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { n.addEventListener(t, stop); });
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); UI.confirm('Send an SOS alert to the safety team and your emergency contacts? (Simulated – nobody is contacted.)', 'Send SOS').then(function (y) { if (y) fire(); }); } });
  }
  function setupOtp(box) {
    var input = q('input', box), cells = qa(':scope > span', box);
    function paint() {
      var v = input.value.replace(/\D/g, '').slice(0, cells.length);
      if (v !== input.value) input.value = v;
      cells.forEach(function (c, i) { c.textContent = v[i] || ''; c.classList.toggle('f', i === Math.min(v.length, cells.length - 1) && document.activeElement === input); });
    }
    input.addEventListener('input', paint); input.addEventListener('focus', paint); input.addEventListener('blur', paint);
    paint();
  }

  // ---------------------------------------------------------------- demo bar
  function renderBar(s) {
    var e = UI.engine;
    var sel = q('[data-rn="scenario"]');
    if (sel && !sel.options.length) RN.data.SCENARIOS.forEach(function (sc) { sel.appendChild(el('option', { value: sc.id }, sc.id + ' · ' + sc.title)); });
    if (sel) sel.value = s.scenario;
    var net = q('[data-rn="network"]'); if (net) net.value = s.net[ACTOR[UI.app] === 'rider' && UI.app !== 'rider' ? 'rider' : UI.app] || 'online';
    var auto = q('[data-rn="auto"]'); if (auto) auto.value = s.opts.auto.driver ? 'auto' : 'manual';
    var speed = q('[data-rn="speed"]'); if (speed) speed.value = s.opts.fast ? 'fast' : 'spec';
    var pay = q('[data-rn="payment"]'); if (pay) pay.value = s.opts.payment;
    var chatA = q('[data-rn="chat-agents"]'); if (chatA) chatA.value = s.opts.chatAgents;
    var callO = q('[data-rn="call-outcome"]'); if (callO) callO.value = s.opts.callOutcome;
    var role = q('[data-rn="role"]');
    if (role) { if (!role.options.length) RN.rbac.ROLES.forEach(function (r) { role.appendChild(el('option', { value: r }, RN.rbac.LABELS[r])); }); role.value = s.session.admin.role; }
    var st = q('[data-rn="status"]');
    if (st) {
      var r = e.ride(), o = e.order(), parts = [UI.hub ? 'Connected demo' : 'Standalone demo', 'scenario ' + s.scenario];
      if (r) parts.push('ride ' + r.id.slice(-5) + ' ' + r.state);
      if (o) parts.push('order #' + o.id + ' ' + o.state);
      var tk = s.support.ticketOrder.filter(function (id) { return !s.support.tickets[id].sample; }).length;
      if (tk) parts.push(tk + ' new ticket(s)');
      if (UI.app === 'admin') parts.push('mock role ' + RN.rbac.LABELS[s.session.admin.role]);
      if (s.queue.length) parts.push(s.queue.length + ' action(s) waiting to sync');
      st.textContent = parts.join(' · ');
    }
    var route = q('[data-rn="route"]'); if (route && REG[UI.sid]) route.textContent = UI.sid + ' · ' + REG[UI.sid].title;
    var log = q('[data-rn="log"]'), det = q('.rn-db-log');
    if (log && det && det.open) {
      clear(log);
      s.events.slice(-15).reverse().forEach(function (ev) {
        var li = el('li'); li.appendChild(el('time', null, fmtTime(ev.at))); li.appendChild(el('code', null, ev.type));
        li.appendChild(document.createTextNode(' ' + ev.actor + (ev.note ? ' · ' + ev.note : '') + (ev.to ? ' → ' + ev.to : ''))); log.appendChild(li);
      });
    }
    var off = s.net[UI.netKey] === 'offline';
    var ob = q('[data-rn="offline"]'); if (ob) ob.hidden = !off;
    document.body.classList.toggle('rn-is-offline', off);
    qa('#mock [data-do]').forEach(function (n) {
      var cmd = n.getAttribute('data-do'), allowed = !off || OFFLINE_OK[cmd] || (LIB && LIB.QUEUEABLE[cmd]);
      if (allowed) n.removeAttribute('aria-disabled'); else n.setAttribute('aria-disabled', 'true');
    });
  }

  function setupBar() {
    var e = UI.engine;
    var on = function (k, fn) { var n = q('[data-rn="' + k + '"]'); if (n) n.addEventListener(n.tagName === 'SELECT' ? 'change' : 'click', fn); };
    on('scenario', function (ev) {
      var id = ev.target.value, sc = RN.data.SCENARIOS.filter(function (x) { return x.id === id; })[0];
      UI.confirm('Load scenario ' + id + ' (' + sc.title + ')? This replaces the in-memory demo state' + (UI.hub ? ' for every app on the connected demo page.' : '.'), 'Load scenario').then(function (y) {
        if (!y) { ev.target.value = e.state.scenario; return; }
        e.reset(id); UI.toast('Scenario ' + id + ' loaded: ' + sc.steps[0], 'info');
        var start = UI.appOf(sc.start) === UI.app ? sc.start : UI.entryAfterLogin;
        UI.go(start, { reload: true });
      });
    });
    on('reset', function () {
      UI.confirm('Reset the demo? Everyone is signed out and all simulated rides, orders, tickets and chats are cleared.', 'Reset').then(function (y) {
        if (!y) return; e.reset('A', true); UI.stack = []; UI.go(UI.entry, { replace: true, reload: true }); UI.toast('Demo reset.', 'info');
      });
    });
    on('network', function (ev) { UI.exec('demo.network', { app: UI.netKey, mode: ev.target.value }, { actor: 'system', instant: true }).then(function (r) { if (r.ok && r.replayed) UI.toast(r.replayed + ' saved action(s) synced.', 'info'); }); });
    on('auto', function (ev) {
      var a = ev.target.value === 'auto';
      ['driver', 'partner', 'courier', 'support'].forEach(function (k) { e.setOption('auto.' + k, a); });
      UI.toast(a ? 'Drivers, restaurant, couriers and support agents act automatically.' : 'Other parties wait for you: play them in their app (connected demo).', 'info');
    });
    on('speed', function (ev) { e.setOption('fast', ev.target.value === 'fast'); });
    on('payment', function (ev) { e.setOption('payment', ev.target.value); });
    on('chat-agents', function (ev) { e.setOption('chatAgents', ev.target.value); });
    on('call-outcome', function (ev) { e.setOption('callOutcome', ev.target.value); });
    on('role', function (ev) { UI.exec('admin.setRole', { role: ev.target.value }, { actor: 'admin', instant: true }).then(function () { UI.toast('Mock role: ' + RN.rbac.LABELS[ev.target.value] + '. ' + RN.rbac.DISCLAIMER, 'warn'); }); });
    on('collapse', function (ev) { var bar = q('.rn-demobar'), open = !bar.classList.contains('open'); bar.classList.toggle('open', open); ev.currentTarget.setAttribute('aria-expanded', String(open)); });
    var log = q('.rn-db-log'); if (log) log.addEventListener('toggle', function () { renderBar(e.state); });
  }

  // ---------------------------------------------------------------- responsive scaling of the active screen
  function fit() {
    // the application fills the window; narrower windows scale it down (CSSOM, allowed by the CSP)
    var holder = q('#mock'), m = holder && holder.firstElementChild; if (!m) return;
    document.body.classList.toggle('rn-desk', m.classList.contains('desk'));
    m.style.zoom = ''; m.style.height = '';
    if (m.classList.contains('phone')) {
      // the whole device stays visible: scaled down to the window in both directions (full-screen on real phones)
      if (window.matchMedia('(max-width:480px)').matches) return;
      var pz = Math.min(1, holder.clientWidth / m.offsetWidth, holder.clientHeight / m.offsetHeight);
      if (pz > 0 && pz < 1) m.style.zoom = pz.toFixed(4);
      return;
    }
    var natural = m.offsetWidth, avail = holder.clientWidth;
    if (natural && avail && avail < natural) {
      var z = avail / natural;
      m.style.zoom = z.toFixed(4);
      m.style.height = Math.floor(holder.clientHeight / z) + 'px';   // still the full window height after scaling
    }
  }

  // ---------------------------------------------------------------- router
  UI.stack = [];
  // screens reachable without signing in; everything else redirects to the app's sign-in screen (simulated sessions)
  var AUTH = {
    rider: { free: ['R01', 'R02', 'R58', 'R57', 'R03', 'R04', 'R53'], login: 'R58', ok: function (s) { return s.session.rider.status === 'signed_in'; } },
    driver: { free: ['D01'], login: 'D01', ok: function (s) { return s.session.driver.status === 'signed_in'; } },
    partner: { free: ['P08', 'P01'], login: 'P08', ok: function (s) { return s.session.partner.status === 'signed_in'; } },
    admin: { free: ['A01'], login: 'A01', ok: function (s) { return s.session.admin.status === 'signed_in'; } },
    support: { free: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S20'], login: 'S20', ok: function (s) { return s.support.agent.signedIn; } }
  };
  UI.needsSignIn = function (sid) { var a = AUTH[UI.app]; return a && a.free.indexOf(sid) < 0 && !a.ok(UI.engine.state); };
  function show(sid, opts) {
    if (!REG[sid] || UI.appOf(sid) !== UI.app || !q('.rn-screen[data-sid="' + sid + '"]')) sid = UI.entry;
    if (UI.needsSignIn(sid)) {
      UI.toast('Sign in first (simulated).', 'info');
      sid = AUTH[UI.app].login; history.replaceState(null, '', '#/' + sid);
    }
    var prev = q('#mock'); if (prev) prev.removeAttribute('id');
    qa('.rn-screen').forEach(function (sc) { sc.hidden = sc.getAttribute('data-sid') !== sid; });
    var section = q('.rn-screen[data-sid="' + sid + '"]');
    q('.mock-holder', section).id = 'mock';
    UI.sid = sid; UI.ctx.sid = sid; UI.navSeq = (UI.navSeq || 0) + 1;
    var i = UI.stack.lastIndexOf(sid);
    if (i >= 0 && i === UI.stack.length - 2) UI.stack.pop(); else if (UI.stack[UI.stack.length - 1] !== sid) UI.stack.push(sid);
    UI.controller = (RN.screens || {})[sid] || null;
    filters.chip = ''; filters.text = '';
    var s = q('#mock .rn-search'); if (s) s.value = '';
    document.title = REG[sid].title + ' · ' + (CONFIG.brand || 'RideNova') + ' ' + UI.appLabel;
    fit();
    if (UI.controller && UI.controller.init) UI.controller.init(UI.ctx);
    render(UI.engine.state);
    if (!(opts && opts.initial)) { var stage = q('#app-stage'); if (stage) stage.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  }
  function render(s) { renderBar(s); if (UI.controller && UI.controller.update) UI.controller.update(UI.ctx, s); }
  function route() { var sid = (location.hash.match(/^#\/([A-Z]\d\d)/) || [])[1]; show(sid || UI.entry); }

  // ---------------------------------------------------------------- boot
  function boot() {
    var b = document.body;
    UI.app = b.getAttribute('data-app'); UI.entry = b.getAttribute('data-entry'); UI.entryAfterLogin = b.getAttribute('data-home') || UI.entry;
    UI.appLabel = b.getAttribute('data-label') || UI.app;
    UI.actor = ACTOR[UI.app]; UI.netKey = UI.app === 'support' ? 'rider' : UI.app;
    if (!UI.app || !RN.Engine || !document.querySelector('.rn-screen')) return;   // only the single-document apps use this runtime
    if (CONFIG.brand) qa('.brandname').forEach(function (n) { n.textContent = CONFIG.brand; });
    try { if (window.parent !== window && window.parent.RN_HUB) UI.hub = window.parent.RN_HUB; } catch (err) { UI.hub = null; /* file:// or other origin: standalone */ }
    var e = UI.engine = UI.hub ? UI.hub.engine : new RN.Engine({ storage: LIB.memoryStorage(), fresh: true });
    UI.ctx = { engine: e, ui: UI, sid: null, app: UI.app };
    if (UI.hub) { UI.hub.register(UI.app, window); document.body.classList.add('rn-in-hub'); }

    var stage = q('#app-stage');
    stage.addEventListener('click', function (ev) {
      var mock = q('#mock'); var n = ev.target.closest('[data-go],[data-do],[data-ui],[data-msg],[data-back],[data-key]');
      if (!n || !mock || !mock.contains(n) || n.hasAttribute('data-hold')) return;
      UI.activate(n, ev);
    });
    stage.addEventListener('keydown', function (ev) {
      var n = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && n.matches('[role="button"],[role="switch"],[role="link"]') && !n.hasAttribute('data-hold') && !n.matches('th')) { ev.preventDefault(); UI.activate(n, ev); }
      if (ev.key === 'Enter' && n.matches('input.rn-input:not(.rn-search), input.rn-otp-input')) {
        var primary = q('#mock button[data-do]:not([data-do="x.attach"])'); if (primary) { ev.preventDefault(); primary.click(); }
      }
    });
    stage.addEventListener('change', function (ev) {
      var n = ev.target, act = n.getAttribute && n.getAttribute('data-change');
      if (act && act.indexOf('x.') === 0 && UI.controller && UI.controller.actions && UI.controller.actions[act.slice(2)]) UI.controller.actions[act.slice(2)](n, n.value, UI.ctx);
    });
    stage.addEventListener('input', function (ev) {
      var n = ev.target;
      if (n.matches && n.matches('.rn-search')) filterTables(n.value, 'text');
      else if (n.matches && n.matches('.rn-input')) UI.fieldError(n.name, '');
      if (UI.controller && UI.controller.input) UI.controller.input(UI.ctx, n);
    });
    // links to the other applications take their address from assets/js/config.js
    qa('.rn-screen a[data-go]').forEach(function (a) {
      var sid = a.getAttribute('data-go'), url = UI.appOf(sid) !== UI.app && UI.appUrl(sid);
      if (url) a.setAttribute('href', url);
    });
    qa('.rn-screen [data-hold]').forEach(setupHold);
    qa('.rn-screen .rn-otp').forEach(setupOtp);
    qa('.rn-screen table.dt th').forEach(sortable);

    setupBar();
    window.addEventListener('resize', fit);
    window.addEventListener('hashchange', route);
    var off = e.subscribe(function (s) { render(s); });
    window.addEventListener('pagehide', function () { off(); if (UI.hub) UI.hub.unregister(UI.app, window); });
    route();
    if (!UI.hub) setInterval(function () { e.tick(); }, 400);
    setInterval(function () { if (UI.controller && UI.controller.tick) UI.controller.tick(UI.ctx, e.state); }, 400);
  }
  if (document.readyState === 'complete') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
