/* RideNova prototype – connected demo (connected-demo/index.html).
   Owns ONE in-memory engine and shows several apps in frames of this page. Each app finds window.parent.RN_HUB
   (possible only when this page and the apps share an origin, e.g. a local web server) and uses this engine,
   so a ride booked in the customer app is the same ride in the driver app and the admin portal.
   Nothing is stored: reloading this page resets the shared demo. */
(function () {
  'use strict';
  var RN = window.RN, LIB = RN.engineLib;
  var DIR = { rider: 'customer-app', driver: 'driver-app', partner: 'patner-app', admin: 'admin', support: 'agent-portal' };
  var URLS = (window.RN_CONFIG && window.RN_CONFIG.apps) || {};
  function appUrl(app) { return URLS[app] || '../' + DIR[app] + '/index.html'; }
  var ENTRY = { rider: 'R01', driver: 'D01', partner: 'P08', admin: 'A01', support: 'G01' };
  var engine = new RN.Engine({ storage: LIB.memoryStorage(), fresh: true });
  var registered = [];
  function q(s) { return document.querySelector(s); }
  function qa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function el(tag, attrs, text) { var n = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text != null) n.textContent = text; return n; }

  var panes = [{ app: 'rider' }, { app: 'driver' }, { app: 'admin' }];
  var used = [0, 1, 2];   // least recently used pane order

  function load(i, app, sid) {
    panes[i].app = app;
    q('[data-pane-app="' + i + '"]').value = app;
    q('[data-pane-frame="' + i + '"]').setAttribute('src', appUrl(app) + '#/' + (sid || ENTRY[app]));
    used = used.filter(function (x) { return x !== i; }).concat([i]);
  }

  window.RN_HUB = {
    engine: engine,
    register: function (app, win) { registered.push(win); q('[data-hub="warning"]').hidden = true; },
    unregister: function (app, win) { registered = registered.filter(function (w) { return w !== win; }); },
    open: function (app, sid) {
      // show the app in the pane that already has it, otherwise in the least recently used pane
      var count = Number(q('[data-hub="layout"]').getAttribute('data-count'));
      var i = panes.map(function (p) { return p.app; }).indexOf(app);
      if (i < 0 || i >= count) i = used.filter(function (x) { return x < count; })[0];
      var frame = q('[data-pane-frame="' + i + '"]');
      if (panes[i].app === app && frame.contentWindow) { frame.contentWindow.location.hash = '#/' + sid; used = used.filter(function (x) { return x !== i; }).concat([i]); }
      else load(i, app, sid);
      frame.focus();
    }
  };

  function renderLog(s) {
    var log = q('[data-hub="log"]'); if (!log || !log.parentElement.open) return;
    while (log.firstChild) log.removeChild(log.firstChild);
    s.events.slice(-30).reverse().forEach(function (ev) {
      var d = new Date(ev.at), li = el('li');
      li.appendChild(el('time', null, [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (x) { return String(x).padStart(2, '0'); }).join(':')));
      li.appendChild(document.createTextNode(ev.type + ' · ' + ev.actor + (ev.note ? ' · ' + ev.note : '')));
      log.appendChild(li);
    });
  }
  function renderBar(s) {
    var sel = q('[data-hub="scenario"]');
    if (!sel.options.length) RN.data.SCENARIOS.forEach(function (sc) { sel.appendChild(el('option', { value: sc.id }, sc.id + ' · ' + sc.title)); });
    sel.value = s.scenario;
    q('[data-hub="auto"]').value = s.opts.auto.driver ? 'auto' : 'manual';
    var role = q('[data-hub="role"]');
    if (!role.options.length) RN.rbac.ROLES.forEach(function (r) { role.appendChild(el('option', { value: r }, RN.rbac.LABELS[r])); });
    role.value = s.session.admin.role;
    q('[data-hub="speed"]').value = s.opts.fast ? 'fast' : 'spec';
    q('[data-hub="payment"]').value = s.opts.payment;
    q('[data-hub="net-rider"]').value = s.net.rider;
    q('[data-hub="net-driver"]').value = s.net.driver;
    q('[data-hub="chat"]').value = s.opts.chatAgents;
    q('[data-hub="call"]').value = s.opts.callOutcome;
  }

  function boot() {
    for (var i = 0; i < 3; i++) {
      (function (i) {
        q('[data-pane-app="' + i + '"]').addEventListener('change', function (e) { load(i, e.target.value); });
        q('[data-pane-reload="' + i + '"]').addEventListener('click', function () { load(i, panes[i].app); });
      })(i);
      load(i, panes[i].app);
    }
    q('[data-hub="panes"]').addEventListener('change', function (e) { q('[data-hub="layout"]').setAttribute('data-count', e.target.value); });
    q('[data-hub="scenario"]').addEventListener('change', function (e) {
      var sc = RN.data.SCENARIOS.filter(function (x) { return x.id === e.target.value; })[0];
      engine.reset(sc.id);
      sc.apps.slice(0, 3).forEach(function (app, k) { load(k, app, app === RN_SCREENS[sc.start].app ? sc.start : null); });
    });
    q('[data-hub="reset"]').addEventListener('click', function () { engine.reset('A', true); for (var k = 0; k < 3; k++) load(k, panes[k].app); });
    q('[data-hub="auto"]').addEventListener('change', function (e) { ['driver', 'partner', 'courier', 'support'].forEach(function (k) { engine.setOption('auto.' + k, e.target.value === 'auto'); }); });
    var on = function (k, fn) { q('[data-hub="' + k + '"]').addEventListener('change', function (e) { fn(e.target.value); }); };
    on('speed', function (v) { engine.setOption('fast', v === 'fast'); });
    on('payment', function (v) { engine.setOption('payment', v); });
    on('role', function (v) { engine.run('admin', 'admin.setRole', { role: v }); });
    on('net-rider', function (v) { engine.run('system', 'demo.network', { app: 'rider', mode: v }); });
    on('net-driver', function (v) { engine.run('system', 'demo.network', { app: 'driver', mode: v }); });
    on('chat', function (v) { engine.setOption('chatAgents', v); });
    on('call', function (v) { engine.setOption('callOutcome', v); });
    q('.hub-log').addEventListener('toggle', function () { renderLog(engine.state); });
    engine.subscribe(function (s) { renderBar(s); renderLog(s); });
    renderBar(engine.state);
    setInterval(function () { engine.tick(); }, 400);
    // if no app has connected after a few seconds, the browser isolated the frames (pages opened as files)
    setTimeout(function () { if (!registered.length) q('[data-hub="warning"]').hidden = false; }, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
