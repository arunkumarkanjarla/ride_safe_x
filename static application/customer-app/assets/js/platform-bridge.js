/* RideNova customer app <- admin Platform control (RNPC).
   Fares (P.quote) use the shared admin rate card; vehicle options, home tiles, coupons and offers follow the admin catalog;
   blocked accounts, wallet credits/refunds and booking commands from admin are applied; bookings and SOS are published to ops. */
(function () {
  'use strict';
  var RN = window.RN, PC = window.RNPC; if (!RN || !PC || !RN.product) return;
  var UI = RN.ui, P = RN.product, S = RN.store, K = RN.kit;
  var EXTRA = { 'Extra luggage': 4000, 'Pet friendly': 3000, 'Prefer woman driver': 0, 'Trip insurance': 500 };
  function leg(trip) { var from = (trip && trip.pickup) || P.pickup(), to = trip && trip.drop || from; var km = Math.max(1.2, Math.round(P.hav(from, to) * 1.3 * 10) / 10); return { from: from, to: to, km: km, mins: Math.max(6, Math.round(km / 24 * 60 + 4)) }; }
  // ------------------------------------------------ fares: one formula shared with the admin fare calculator
  var baseQuote = P.quote;
  P.quote = function (trip, vehicle, extras, opts) {
    opts = opts || {}; var l = leg(trip), f = PC.fare(vehicle, l.km, l.mins, { places: [l.from, l.to], factor: opts.factor });
    if (!f) return baseQuote.apply(this, arguments);
    var lines = f.lines.slice(), pre = f.prePaise;
    (extras || []).forEach(function (x) { var a = EXTRA[x] || 0; if (a) { lines.push([x, a]); pre += a; } });
    var d = P.discount('ride', pre), disc = 0, code = ''; if (d.paise) { disc = d.paise; code = d.code; lines.push(['Coupon ' + code, -disc]); }
    var tax = PC.tax(pre - disc); lines.push(['Taxes (GST ' + f.taxPct + '%)', tax]);
    var v = PC.vehicle(vehicle) || {};
    return { total: pre - disc + tax, lines: lines, km: l.km, mins: l.mins, eta: v.eta || 3, surge: f.surge, discount: disc, code: code, why: d.why, tax: tax, version: PC.cfg.version };
  };
  // ------------------------------------------------ catalog sync (vehicles, tiles, coupons)
  var lastSig = '';
  function syncCatalog() {
    var t = P.trip || {}, places = [P.pickup(), t.drop].filter(Boolean), sig = PC.cfg.version + '|' + (t.drop ? t.drop.n : '');
    if (sig === lastSig) return false; lastSig = sig;
    var V = P.VEH, live = PC.vehicles({ places: places });
    if (!live.length) live = PC.vehicles();
    Object.keys(V).forEach(function (k) { delete V[k]; });
    live.forEach(function (v) { var r = PC.rate(v.id) || {}; V[v.id] = { icon: v.icon, base: r.base, km: r.perKm, min: r.perMin, eta: v.eta, seats: v.seats, note: v.note, label: v.label || v.id }; });
    if (P.SVC) { P.SVC.length = 0; PC.services().forEach(function (s) { P.SVC.push([s.label, s.icon, s.go, s.arg || null, s.badge || null]); }); }
    if (P.COUPONS) { P.COUPONS.length = 0; PC.coupons().forEach(function (c) { P.COUPONS.push(c); }); }
    var root = document.documentElement; Object.keys(PC.cfg.flags || {}).forEach(function (k) { root.classList.toggle('rnpc-off-' + k, !PC.cfg.flags[k]); });
    return true;
  }
  RN.offersCarousel = function (orig) { var c = PC.coupons(); return c.length ? c.slice(0, 6).map(function (x) { return [x.code, x.title, x.sub || '', x.tone || 'brand']; }) : orig.filter(function () { return false; }); };
  RN.referralPaise = function () { return PC.cfg.offers.referral.referrerPaise; };
  RN.referralText = function () { var r = PC.cfg.offers.referral; return 'Give ' + P.rs(r.refereePaise) + ', get ' + P.rs(r.referrerPaise); };
  var baseUse = P.useCoupon;
  P.useCoupon = function (paise) { var u = S.user(), code = u && u.coupon; baseUse.apply(this, arguments); if (code && paise) PC.opsUpdate(function (o) { o.couponUse = o.couponUse || {}; o.couponUse[code] = (o.couponUse[code] || 0) + 1; }); };
  // ------------------------------------------------ account: registry, block, wallet credits, booking commands
  function me() { var u = S.user && S.user(); return u && u.phone ? u : null; }
  var pubSig = '', lastSeen = 0;
  function rideOpsRow(u, ride) {
    var d = ride.driverId && RN.data && RN.data.DRIVERS ? RN.data.DRIVERS[ride.driverId] : null;
    var label = K && K.label ? K.label(ride.state) : ride.state;
    var terminal = /CANCELLED|CLOSED|PAYMENT_COMPLETED/.test(ride.state);
    return {
      id: ride.id, phone: u.phone, type: 'ride',
      title: (ride.vehicle || 'Ride') + (ride.drop || ride.dropName ? ' to ' + (ride.dropName || ride.drop) : ''),
      sub: terminal ? (ride.state === 'CANCELLED' ? 'Cancelled' : 'Completed') : 'Live · ' + label,
      status: label, state: ride.state,
      paise: ride.finalPaise || ride.farePaise || ride.quotePaise || ride.totalPaise || 0,
      at: ride.endedAt || ride.requestedAt || ride.createdAt || Date.now(),
      driver: d ? (d.name + ' · ' + d.vehicle + ' · ' + d.plate) : (ride.driverName || ride.driverId || ''),
      driverId: ride.driverId || '', rev: (UI.engine.state && UI.engine.state.rev) || 0
    };
  }
  function publish(u) {
    var bk = (u.bookings || []).slice(0, 40).map(function (b) { return { id: b.id, phone: u.phone, type: b.type, title: b.title || b.type, sub: b.sub || '', status: b.status || 'Confirmed', paise: b.paise || 0, at: b.createdAt || b.at || 0, driver: b.driver || '' }; });
    var s = UI.engine && UI.engine.state;
    if (s && s.rideOrder) {
      s.rideOrder.slice(-12).forEach(function (id) {
        var ride = s.rides[id]; if (!ride) return;
        bk.unshift(rideOpsRow(u, ride));
      });
    }
    var inc = []; if (s && s.incidents) Object.keys(s.incidents).forEach(function (k) { var i = s.incidents[k]; inc.push({ id: i.id || k, from: 'Rider +91 ' + u.phone, text: (i.kind || 'SOS') + (i.rideId ? ' on ' + i.rideId : ''), state: i.state, at: i.at || i.createdAt || 0 }); });
    var sig = JSON.stringify([u.name, u.walletPaise, bk, inc, s && s.rev]), now = Date.now();
    if (sig === pubSig && now - lastSeen < 60000) return; pubSig = sig; lastSeen = now;
    PC.opsUpdate(function (o) {
      var c = o.customers[u.phone] = o.customers[u.phone] || {}; c.name = u.name || c.name || ''; c.walletPaise = u.walletPaise; c.bookings = (u.bookings || []).length; c.seen = now;
      bk.forEach(function (b) { var old = o.bookings[b.id]; if (old && /RideNova/.test(old.status || '') && !/RideNova/.test(b.status || '')) return; o.bookings[b.id] = Object.assign({}, old || {}, b); });
      inc.forEach(function (i) { var old = o.sos[i.id]; if (!old) o.sos[i.id] = { id: i.id, from: i.from, text: i.text, status: 'Open', at: i.at || now }; else if (/RESOLVED|CLOSED|FALSE/.test(i.state) && old.status !== 'Resolved') old.status = 'Resolved'; });
    });
  }
  function applyAdmin(u) {
    var o = PC.ops, ch = false, done = u.pcApplied = u.pcApplied || [];
    o.wallet.filter(function (w) { return w.phone === u.phone && done.indexOf(w.id) < 0; }).reverse().forEach(function (w) {
      done.push(w.id); ch = true; S.credit(u, w.paise, w.note, w.kind === 'Refund' ? 'Refund' : 'Adjustment');
      if (S.notify) S.notify(u, w.paise >= 0 ? 'Wallet credited ' + P.rs(w.paise) : 'Wallet debited ' + P.rs(-w.paise), w.note, 'Updates');
      UI.toast((w.paise >= 0 ? P.rs(w.paise) + ' added to your wallet: ' : P.rs(-w.paise) + ' deducted: ') + w.note, 'info');
    });
    var cmds = o.cmds.filter(function (c) { return c.phone === u.phone && done.indexOf(c.id) < 0; });
    cmds.forEach(function (c) {
      done.push(c.id); ch = true; var b = (u.bookings || []).filter(function (x) { return x.id === c.booking; })[0];
      if (c.action === 'cancel') {
        if (b) { b.status = 'Cancelled by RideNova'; b.sub = c.reason; if (c.refund && b.paise) S.credit(u, b.paise, 'Refund for ' + b.id + ' (cancelled by RideNova)', 'Refund'); }
        if (S.notify) S.notify(u, 'Booking cancelled', c.reason + (c.refund ? ' Full refund to your wallet.' : ''), 'Updates');
        UI.toast('RideNova cancelled ' + c.booking + ': ' + c.reason + (c.refund ? '. Refunded to wallet.' : '.'), 'warn');
      } else if (c.action === 'reassign') {
        if (b) { b.driver = c.driver; b.sub = 'New driver: ' + c.driver; }
        UI.toast('Your driver was changed to ' + String(c.driver).split(' \u00B7')[0] + '.', 'info');
      }
    });
    if (ch) { S.save(); if (P.applyUser) P.applyUser(u); var ids = done.slice(); PC.opsUpdate(function (s) { s.wallet.forEach(function (w) { if (ids.indexOf(w.id) >= 0) w.applied = true; }); s.cmds.forEach(function (c) { if (ids.indexOf(c.id) >= 0) { c.applied = true; var bb = s.bookings[c.booking]; if (bb && c.action === 'cancel') bb.status = 'Cancelled by RideNova'; if (bb && c.action === 'reassign') bb.driver = c.driver; } }); }); }
    return ch;
  }
  function blockScreen(u) {
    var rec = PC.ops.customers[u.phone], on = !!(rec && rec.blocked), host = document.querySelector('#mock .scr') || document.body, ov = document.querySelector('.rnpc-block');
    if (!on) { if (ov) ov.remove(); return; }
    if (ov && ov.parentNode === host) return; if (ov) ov.remove();
    ov = document.createElement('div'); ov.className = 'rnpc-maint rnpc-block'; ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Account blocked');
    var box = document.createElement('div'); box.className = 'rnpc-mbox';
    box.innerHTML = '<div class="rnpc-ic">\u26D4</div><b>Your account is on hold</b><p></p><p class="rnpc-sup"></p>';
    box.querySelector('p').textContent = (rec.reason || 'Our trust & safety team paused this account.') + ' You cannot book until this is resolved.';
    box.querySelector('.rnpc-sup').textContent = 'Call support: ' + PC.cfg.content.supportPhone;
    var out = document.createElement('button'); out.type = 'button'; out.className = 'rnpc-retry'; out.textContent = 'Sign out';
    out.addEventListener('click', function () { if (S.signOut) S.signOut(); ov.remove(); UI.go('R03'); });
    box.appendChild(out); ov.appendChild(box); host.appendChild(ov);
  }
  // ------------------------------------------------ live refresh
  var REDRAW = { R29: 1, R07: 1, R09: 1, R10: 1, R22: 1, R49: 1, R59: 1, R21: 1 };
  function redraw() { if (!UI.sid || !REDRAW[UI.sid]) return; var f = document.activeElement; if (f && /INPUT|TEXTAREA|SELECT/.test(f.tagName) && document.querySelector('#mock').contains(f)) return; if (document.querySelector('#mock .sheet, #mock .p-sheet, #mock [role=dialog]:not(.rnpc-maint)')) return; try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) {} }
  function tick(remote) {
    var catCh = syncCatalog(), u = me(), ch = false;
    if (u) { blockScreen(u); ch = applyAdmin(u); publish(u); } else { var ov = document.querySelector('.rnpc-block'); if (ov) ov.remove(); }
    if (catCh || ch) redraw();
  }
  syncCatalog();
  PC.on(function (c, o, src) { tick(src === 'remote'); });
  var wait = setInterval(function () { if (!UI.engine || !UI.sid) return; clearInterval(wait); tick(true); setInterval(function () { tick(false); }, 1500); }, 100);
  /* styles live in shared/platform.css (CSP style-src self) */
})();
