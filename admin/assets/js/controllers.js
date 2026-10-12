/* RideNova Admin portal – screen controllers (behaviour of the screens of this application only).
   Each def('ID', {...}) adds behaviour to one screen: init on entry, update on every state change, tick every 400 ms,
   actions.name for data-do="x.name" controls. Uses the helpers in kit.js. DOM APIs and textContent only. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.screens;
  var el = UI.el, q = UI.q, qa = UI.qa;
  var exec = K.exec, text = K.text, find = K.find, hide = K.hide, secsLeft = K.secsLeft, follow = K.follow, setTag = K.setTag, rideFinal = K.rideFinal, loadScenarioButton = K.loadScenarioButton, navButton = K.navButton, def = K.def, ctl = K.ctl, COMMON = K.COMMON, rupees = K.rupees, extend = K.extend, ago = K.ago, clock = K.clock, label = K.label, tagKind = K.tagKind, tbodyOf = K.tbodyOf, tdCell = K.tdCell, stSpan = K.stSpan, rowsSig = K.rowsSig, fillTable = K.fillTable, bubbles = K.bubbles, liveRideRows = K.liveRideRows, prependLive = K.prependLive;

  // ================================================================== admin
  function adminGuard(ctx) {
    var s = ctx.engine.state;
    if (s.session.admin.status !== 'signed_in' && ctx.sid !== 'A01') { UI.state('Signed out', ['Sign in with MFA on A01.'], [navButton('Sign in', 'A01', true)], 'warn'); return false; }
    return true;
  }
  Object.keys(window.RN_SCREENS || {}).forEach(function (sid) {
    if (sid[0] === 'A' && !S[sid].update) S[sid].update = function (ctx) { if (adminGuard(ctx)) UI.state(null); };
  });
  def('A01', {
    init: function (ctx) { UI.toast('Demo MFA code: ' + D.DEMO_CODES.adminMfa + ' (simulated authenticator).', 'info'); var i = UI.q('#mock .rn-otp-input'); if (i) { i.value = ''; i.dispatchEvent(new Event('input')); i.focus(); } },
    actions: { mfa: function (n) {
      UI.clearErrors();
      var code = UI.q('#mock .rn-otp-input').value;
      if (code.length !== 6) { UI.fieldError('adminMfa', 'Enter the 6-digit code.'); return { ok: false }; }
      return exec('admin.mfa', { code: code }, n).then(function (r) { if (r.ok) { UI.toast('Signed in (simulated). Mock role: ' + RN.rbac.LABELS[UI.engine.state.session.admin.role] + '.', 'info'); UI.go('A02'); } else UI.fieldError('adminMfa', r.error); return r; });
    } } });

  function timeline(events) {
    var tl = UI.q('#mock .tl'); if (!tl) return;
    UI.clear(tl);
    events.forEach(function (ev) {
      var row = UI.el('div', { class: 'e' });
      row.appendChild(UI.el('span', { class: 'tm' }, UI.fmtTime(ev.at)));
      row.appendChild(UI.el('span', { class: 'dt2' + (/declined|expired|failed|denied|sos|retry/.test(ev.type) ? ' a' : '') }));
      row.appendChild(UI.el('span', null, (ev.note || ev.type) + (ev.to && !ev.note ? ' → ' + ev.to : '')));
      tl.appendChild(row);
    });
  }
  function cell(label, value) {
    var td = UI.qa('#mock td').filter(function (t) { return t.textContent.trim() === label; })[0];
    if (td && td.nextElementSibling) text(td.nextElementSibling, value);
  }
  def('A04', {
    update: function (ctx, s) {
      if (!adminGuard(ctx)) return;
      var r = ctx.engine.ride();
      if (!r) { UI.state('Sample ride', ['No ride in this demo yet. Book one in the rider app to inspect it here.'], [navButton('Rider: book a ride', 'R09')], 'info'); return; }
      UI.state(null);
      UI.bind('state', r.state);
      var d = r.driverId && D.DRIVERS[r.driverId];
      var hb = find('b', 'Ride RN-'); if (hb) text(hb, 'Ride ' + r.id);
      cell('Driver', d ? d.short + ' · ★ ' + d.rating + ' · ' + d.phoneMasked : 'Not assigned (' + r.offers.length + ' offer(s) so far)');
      cell('Vehicle', d ? d.vehicle + ' · ' + d.plate : r.vehicle);
      cell('Fare', 'Quote ' + rupees(r.quotePaise) + (r.endedAt ? ' · final ' + rupees(r.finalPaise) : ''));
      cell('Payment', r.payment.method + ' · ' + r.payment.state.toLowerCase().replace('_', ' '));
      timeline(s.events.filter(function (ev) { return ev.ref === 'ride:' + r.id; }).slice(-14));
    },
    actions: {
      refund: function (n) { return UI.prompt('Refund amount in ₹ (simulated – no money moves)', 'Amount', '50').then(function (v) { if (v == null) return { ok: false }; return exec('admin.refund', { amount: v }, n).then(function (r) { if (r.ok) UI.toast('Refund of ₹' + v + ' recorded (simulated).', 'sim'); return r; }); }); },
      openIncident: function (n) { return exec('admin.openIncident', {}, n).then(function (r) { if (r.ok) UI.go('A13'); return r; }); }
    } });
  S.A11.actions.refund = S.A04.actions.refund;

  def('A07', {
    update: function (ctx, s) {
      if (!adminGuard(ctx)) return;
      var k = s.kyc;
      if (k.state === 'IN_REVIEW') UI.state('Arjun K. · application in review', ['Documents: ' + k.docs.map(function (d) { return d.title + ' ' + d.state.replace('_', ' '); }).join(', ')], null, 'info');
      else UI.state('No application waiting', ['Arjun K. is ' + k.state.replace('_', ' ').toLowerCase() + '. Scenario F: submit documents on D03 first.'], k.state === 'ACTIVE' ? [loadScenarioButton('F')] : [navButton('Driver: D03', 'D03')], 'info');
    },
    actions: {
      applicant: function () { var h = find('.hd b', 'Driving licence'); if (h) text(h, 'Insurance · Arjun K.'); UI.toast('Showing Arjun K.’s application (synthetic documents).', 'info'); },
      kyc: function (n, decision) {
        UI.clearErrors();
        var reason = UI.field('reason') ? UI.field('reason').value : '';
        return exec('kyc.decide', { decision: decision, reason: reason, doc: 'insurance' }, n).then(function (r) { if (r.ok) UI.toast('Decision recorded: ' + decision + '. The driver app (D04) shows it now.', 'info'); return r; });
      }
    } });

  def('A13', {
    update: function (ctx, s) {
      if (!adminGuard(ctx)) return;
      var inc = ctx.engine.incident();
      if (!inc) { UI.state('No live SOS', ['Raise one from the rider (R16) or driver (D18) app.'], [navButton('Rider SOS (R16)', 'R16'), loadScenarioButton('G')], 'info'); return; }
      var kpi = find('.kpi', 'Open SOS'); if (kpi) text(UI.q('.v', kpi), String(s.incidentOrder.filter(function (id) { return ['CLOSED', 'FALSE_ALARM', 'RESOLVED'].indexOf(s.incidents[id].state) < 0; }).length));
      var hd = find('.hd b', 'live'); if (hd) text(hd, (inc.rideId || 'No ride') + ' · ' + inc.id + ' · ' + inc.state);
      var cmd = function (label, c, primary) { return { label: label, primary: primary, onClick: function (b) { exec(c, { id: inc.id }, b); } }; };
      var btns = { OPEN: [cmd('Acknowledge', 'incident.ack', true)], ACKNOWLEDGED: [cmd('Start working', 'incident.work', true), cmd('Escalate', 'incident.escalate')], IN_PROGRESS: [cmd('Resolve', 'incident.resolve', true), cmd('Escalate', 'incident.escalate')],
        ESCALATED: [cmd('Resolve', 'incident.resolve', true)], RESOLVED: [cmd('Close after review', 'incident.close', true)], CLOSED: [], FALSE_ALARM: [] }[inc.state];
      if (inc.riderSafe && ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].indexOf(inc.state) >= 0) btns.push(cmd('Mark false alarm', 'incident.falseAlarm'));
      UI.state(inc.id + ' · ' + inc.state + ' · ' + inc.priority, [(inc.by === 'driver' ? 'Driver' : 'Rider') + ' SOS' + (inc.agent ? ' · owner ' + inc.agent : ' · unassigned'), inc.riderSafe ? 'Rider confirmed safe.' : 'Rider has not confirmed safe.'].concat(inc.notes || []), btns, inc.state === 'OPEN' ? 'err' : 'info');
      timeline(s.events.filter(function (ev) { return ev.ref === 'incident:' + inc.id; }).slice(-8));
    } });

  def('A19', { update: function (ctx, s) {
    if (!adminGuard(ctx)) return;
    var allowed = ctx.engine.can('audit.view'), dc = UI.q('#mock .dc');
    if (dc) dc.classList.toggle('rn-denied', !allowed);
    if (!allowed) { UI.state('Access denied (mock role check)', ['Your role (' + RN.rbac.LABELS[s.session.admin.role] + ') cannot view the audit log. Needs audit.view (Super admin, Auditor).', RN.rbac.DISCLAIMER], null, 'err'); return; }
    var tbody = UI.q('#mock table tbody');
    UI.qa('#mock tr.rn-live').forEach(function (r) { r.remove(); });
    s.audit.slice(-8).forEach(function (a) {
      var cols = tbody && tbody.rows[0] ? tbody.rows[0].cells.length : 5, tr = UI.el('tr', { class: 'rn-live' });
      [UI.fmtTime(a.at), RN.rbac.LABELS[a.role], a.action, a.target, a.result.toUpperCase()].slice(0, cols).forEach(function (v) { tr.appendChild(UI.el('td', null, v)); });
      if (tbody) tbody.insertBefore(tr, tbody.firstChild);
    });
    UI.state(s.audit.length ? s.audit.length + ' simulated admin action(s) recorded this demo' : null, ['Live rows are highlighted; the rest are sample data.'], null, 'info');
  } });
  // ================================================================== admin: manual dispatch, drivers, tickets, calls
  extend('A04', { update: function (ctx, s) {
    var r = ctx.engine.activeRide();
    if (!r || ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED'].indexOf(r.state) < 0) return;
    var online = Object.keys(s.drivers).map(function (k) { return s.drivers[k]; }).filter(function (d) { return d.avail === 'ONLINE' && !d.blocked && d.type === 'Cab'; });
    UI.state('Manual dispatch · ' + r.id + ' is ' + r.state, ['Assign an online driver directly (needs ride.dispatch: Super admin, Ops manager).'],
      online.map(function (d) { return { label: 'Assign ' + d.short, onClick: function (b) { exec('admin.assign', { driverId: d.id }, b, { actor: 'admin' }).then(function (x) { if (x.ok) UI.toast(d.short + ' assigned manually (simulated).', 'info'); }); } }; }), 'warn');
  } });
  def('A06', { update: function (ctx, s) {
    var ds = Object.keys(s.drivers).map(function (k) { return s.drivers[k]; });
    UI.state('Drivers in this demo', ds.map(function (d) { return d.short + ' · ' + d.vehicle + ' · ' + (d.blocked ? 'paused' : d.avail.toLowerCase().replace('_', ' ')); }),
      ds.map(function (d) { return { label: (d.blocked ? 'Reactivate ' : 'Pause ') + d.short, onClick: function (b) {
        UI.confirm((d.blocked ? 'Reactivate ' : 'Pause ') + d.short + '? Paused drivers receive no offers.').then(function (y) { if (y) exec('admin.driverStatus', { driverId: d.id, blocked: !d.blocked }, b, { actor: 'admin' }); });
      } }; }), 'info');
  } });
  def('A12', { update: function (ctx, s) {
    var mine = s.support.ticketOrder.filter(function (id) { return !s.support.tickets[id].sample; }).map(function (id) { return s.support.tickets[id]; });
    if (!mine.length) { UI.state(null); return; }
    UI.state(mine.length + ' ticket(s) from this demo session', mine.slice(-4).map(function (t) { return '#' + t.id + ' · ' + t.user + ' · ' + t.issue + ' · ' + label(t.state); }),
      [{ label: 'Agent portal control', primary: true, onClick: function () { UI.go('A31'); } }], 'info');
  } });
  def('A15', { update: function (ctx, s) {
    var calls = s.support.callOrder.map(function (id) { return s.support.calls[id]; });
    if (!calls.length) { UI.state(null); return; }
    UI.state('Support call-backs (simulated)', calls.slice(-4).map(function (c) {
      var dur = c.connectedAt ? Math.round(((c.endedAt || Date.now()) - c.connectedAt) / 1000) + ' s' : '—';
      return c.id + ' · ' + c.user + ' · ' + c.issue + ' · ' + label(c.state) + ' · ' + dur;
    }), null, 'info');
  } });

  // A20: try the permission model by acting as another role (simulated sign-in; the backend will enforce real roles)
  def('A20', { update: function (ctx, s) {
    var cur = s.session.admin.role;
    UI.state('Signed in as ' + RN.rbac.LABELS[cur] + ' (demo role)', ['Switch role to see which actions each role may perform. Denied attempts are written to the audit log (A19).'],
      RN.rbac.ROLES.filter(function (r) { return r !== cur; }).map(function (r) {
        return { label: RN.rbac.LABELS[r], onClick: function (b) { exec('admin.setRole', { role: r }, b, { actor: 'admin', instant: true }).then(function (x) { if (x.ok) UI.toast('Now acting as ' + RN.rbac.LABELS[r] + '.', 'info'); }); } };
      }), 'info');
  } });
})();
