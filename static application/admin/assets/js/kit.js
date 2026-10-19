/* RideNova – shared helpers for the screen controllers of this application (copied into each app).
   Exposes RN.kit; the app's controllers file registers one controller per screen with kit.def(). */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data;
  var S = RN.screens = RN.screens || {};
  var rupees = RN.engineLib.rupees;

  function exec(cmd, payload, el, opts) { return UI.exec(cmd, payload, Object.assign({ el: el }, opts || {})); }
  function text(n, t) { if (n && n.textContent !== t) n.textContent = t; }
  function find(sel, needle) { return UI.qa('#mock ' + sel).filter(function (n) { return n.textContent.indexOf(needle) >= 0; })[0]; }
  function hide(n, h) { if (n) n.classList.toggle('rn-hidden', !!h); }
  function secsLeft(t, now) { return Math.max(0, Math.ceil((t - now) / 1000)); }
  var pendingFollow = null;
  function follow(ctx, target, msg) {
    // state-driven move to the screen that matches the shared state; replaces the history entry so Back cannot loop
    if (!target || target === ctx.sid || pendingFollow) return;
    if (msg) UI.toast(msg, 'info');
    var seq = UI.navSeq;
    pendingFollow = setTimeout(function () { pendingFollow = null; if (UI.navSeq === seq) UI.go(target, { replace: true }); }, msg ? 900 : 0);
  }
  function setTag(tag, label, kind) { if (!tag) return; text(tag, label); tag.className = 'tag ' + kind; }
  function rideFinal(r) { return !r || ['CANCELLED', 'NO_DRIVER_FOUND', 'CLOSED'].indexOf(r.state) >= 0; }
  function loadScenarioButton(id, label) {
    return { label: label || 'Load scenario ' + id, onClick: function () {
      var sc = D.SCENARIOS.filter(function (x) { return x.id === id; })[0];
      UI.confirm('Load scenario ' + id + ' (' + sc.title + ')? This resets the in-memory demo.', 'Load').then(function (y) {
        if (!y) return;
        UI.engine.reset(id);
        if (UI.appOf(sc.start) === UI.app) UI.go(sc.start, { reload: true });
        else { UI.toast('Scenario ' + id + ' loaded. It starts in another app (' + sc.start + '); use the connected demo to follow it across apps.', 'info'); UI.go(UI.entryAfterLogin, { reload: true }); }
      });
    } };
  }
  function navButton(label, sid, primary) { return { label: label, primary: primary, onClick: function () { if (document.querySelector('.rn-screen[data-sid="' + sid + '"]')) return UI.go(sid); var app = { R: 'customer-app', D: 'driver-app', P: 'patner-app', G: 'agent-portal' }[sid.charAt(0)]; if (app) { window.open('../' + app + '/index.html#' + sid, '_blank'); UI.toast('Opened ' + sid + ' in the ' + app + ' demo (new tab).', 'info'); } else UI.toast('Screen ' + sid + ' is not available here.', 'warn'); } }; }

  // shared actions used by many screens
  var COMMON = {
    simBook: function (n, arg) { return exec('sim.note', { arg: arg }, n).then(function (r) { if (r.ok) UI.toast(arg, 'sim'); return r; }); },
    ticket: function (n, arg) {
      var cat = { partner: 'partner', driver: 'payments' }[UI.app] || 'booking';
      return exec('support.ticket', { arg: arg, category: cat }, n).then(function (r) { if (r.ok) UI.toast('Ticket #' + r.ticketId + ' created: ' + arg + '. A support agent replies here by message, call or email.', 'sim'); return r; });
    },
    signOut: function (n, arg) {
      return exec('auth.signOut', {}, n, { actor: arg }).then(function (r) { if (r.ok) { UI.stack = []; UI.go({ rider: 'R58', driver: 'D01', partner: 'P08' }[arg] || UI.entry, { replace: true }); } return r; });
    },
    sos: function (n) { return exec('sos.raise', {}, n, { instant: true }).then(function (r) { if (r.ok && !r.queued) UI.toast(r.existing ? 'Your SOS ' + r.incidentId + ' is already open.' : 'SOS sent: ' + r.incidentId + '. Safety team alerted (simulated – nobody is actually contacted).', 'warn'); return r; }); },
    adminAction: function (n, arg) {
      var p = String(arg || '').split('|');
      return exec('admin.action', { perm: p[0], label: p[1], event: p[2], target: UI.sid }, n).then(function (r) { if (r.ok) UI.toast('Done: ' + p[1] + ' (simulated, recorded in the audit log).', 'sim'); return r; });
    }
  };
  function ctl(def) { def.actions = Object.assign({}, COMMON, def.actions || {}); return def; }
  // every screen gets the common actions even without its own controller
  Object.keys(window.RN_SCREENS || {}).forEach(function (sid) { S[sid] = ctl({}); });
  function def(sid, d) { S[sid] = ctl(d); }

  function extend(sid, more) {
    // adds behaviour to a controller defined in rn-screens.js without replacing it
    var c = S[sid], baseUpdate = c.update, baseInit = c.init;
    if (more.update) c.update = function (ctx, s) { if (baseUpdate) baseUpdate(ctx, s); more.update(ctx, s); };
    if (more.init) c.init = function (ctx) { if (baseInit) baseInit(ctx); more.init(ctx); };
    if (more.tick) c.tick = more.tick;
    Object.keys(more.actions || {}).forEach(function (k) { c.actions[k] = more.actions[k]; });
  }
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }
  function clock(t) { return UI.fmtClock(t); }
  function label(stateName) { return String(stateName || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, function (c) { return c.toUpperCase(); }); }
  function tagKind(st) { return { OPEN: 'info', IN_PROGRESS: 'info', WAITING_ON_USER: 'warn', ESCALATED: 'err', RESOLVED: 'ok', CLOSED: '', REOPENED: 'warn' }[st] || 'info'; }
  function tbodyOf(cardTitle) {
    var hd = qa('#mock .dcard .hd b').filter(function (b) { return b.textContent.indexOf(cardTitle) === 0; })[0];
    var card = hd && hd.closest('.dcard'), tb = card && q('table tbody', card);
    return tb;
  }
  function tdCell(content, cls) { var td = el('td', cls ? { class: cls } : null); if (content && content.nodeType) td.appendChild(content); else td.textContent = content == null ? '' : content; return td; }
  function stSpan(t, k) { return el('span', { class: 'st ' + (k || '') }, t); }
  function rowsSig(list) { return JSON.stringify(list); }
  function fillTable(tb, rows, key) {
    if (!tb) return;
    var sig = rowsSig(key);
    if (tb.getAttribute('data-sig') === sig) return;
    tb.setAttribute('data-sig', sig);
    while (tb.firstChild) tb.removeChild(tb.firstChild);
    rows.forEach(function (r) {
      var tr = el('tr', r.do ? { 'data-do': r.do, 'data-arg': r.arg, role: 'button', tabindex: '0', class: 'rn-row-link' } : null);
      r.cells.forEach(function (c) { tr.appendChild(c.nodeType ? c : tdCell(c)); });
      tb.appendChild(tr);
    });
    var chip = q('#mock [data-filter][aria-pressed="true"]'), search = q('#mock .rn-search');
    if (chip) UI.filterTables(chip.getAttribute('data-filter'), 'chip');
    if (search && search.value) UI.filterTables(search.value, 'text');
  }
  function bubbles(container, msgs, typingName) {
    var sig = rowsSig([msgs.length, msgs.length && msgs[msgs.length - 1].at, typingName]);
    if (container.getAttribute('data-sig') === sig) return;
    container.setAttribute('data-sig', sig);
    while (container.firstChild) container.removeChild(container.firstChild);
    container.classList.add('rn-chatlog');
    msgs.forEach(function (m) {
      var who = m.from === 'user' ? 'me' : m.from === 'system' ? 'sys' : 'them';
      var b = el('div', { class: 'bubble ' + who });
      if (m.from === 'agent' && m.name) b.appendChild(el('b', null, m.name.split(' ')[0] + ': '));
      b.appendChild(document.createTextNode(m.text));
      if (m.attachment) b.appendChild(el('span', { class: 'tag info' }, ' ' + m.attachment));
      b.appendChild(el('time', { datetime: new Date(m.at).toISOString() }, clock(m.at)));
      container.appendChild(b);
    });
    if (typingName) container.appendChild(el('div', { class: 'bubble them rn-typing', 'aria-live': 'polite' }, typingName.split(' ')[0] + ' is typing…'));
    container.scrollTop = container.scrollHeight;
  }

  function liveRideRows(s, forDriver) {
    return s.rideOrder.slice().reverse().map(function (id) { return s.rides[id]; })
      .filter(function (r) { return !forDriver || r.driverId === s.persona; })
      .filter(function (r) { return ['CLOSED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'CANCELLED', 'NO_DRIVER_FOUND', 'PAYMENT_PENDING', 'TRIP_COMPLETED'].indexOf(r.state) >= 0; })
      .map(function (r) {
        var done = ['CLOSED', 'PAYMENT_COMPLETED'].indexOf(r.state) >= 0;
        return { title: (r.pickupArea || 'Banjara Hills').split(',')[0] + ' → ' + r.drop + ' · this session', sub: r.id + ' · ' + clock(r.requestedAt) + ' · ' + label(r.state),
          right: r.state === 'CANCELLED' ? (r.cancel && r.cancel.feePaise ? rupees(r.cancel.feePaise) : '₹0') : r.state === 'NO_DRIVER_FOUND' ? '₹0' : rupees(forDriver ? r.driverEarnPaise : r.finalPaise),
          rightKind: done ? 'ok' : r.state === 'PAYMENT_FAILED' ? 'err' : 'warn', go: forDriver ? 'D11' : 'R19' };
      });
  }
  function prependLive(listSel, rows) {
    var list = q('#mock ' + listSel); if (!list) return;
    var old = qa('[data-live]', list); var sig = rowsSig(rows.map(function (r) { return r.sub + r.right; }));
    if (list.getAttribute('data-sig') === sig) return;
    list.setAttribute('data-sig', sig);
    old.forEach(function (o) { o.remove(); });
    rows.slice().reverse().forEach(function (r) {
      var row = el('div', { class: 'li', 'data-live': '', role: 'button', tabindex: '0', 'data-go': r.go });
      row.appendChild(el('span', { class: 'ic brand' }));
      var tx = el('span', { class: 'tx' }); tx.appendChild(el('b', null, r.title)); tx.appendChild(el('span', null, r.sub)); row.appendChild(tx);
      row.appendChild(el('span', { class: 'tag ' + r.rightKind }, r.right));
      list.insertBefore(row, list.firstChild);
    });
  }
  var el = UI.el, q = UI.q, qa = UI.qa;
  RN.kit = { exec: exec, text: text, find: find, hide: hide, secsLeft: secsLeft, follow: follow, setTag: setTag, rideFinal: rideFinal, loadScenarioButton: loadScenarioButton, navButton: navButton, def: def, ctl: ctl, COMMON: COMMON, rupees: rupees, extend: extend, ago: ago, clock: clock, label: label, tagKind: tagKind, tbodyOf: tbodyOf, tdCell: tdCell, stSpan: stSpan, rowsSig: rowsSig, fillTable: fillTable, bubbles: bubbles, liveRideRows: liveRideRows, prependLive: prependLive };
})();
