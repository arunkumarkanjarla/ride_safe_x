/* RideNova Partner app – screen controllers (behaviour of the screens of this application only).
   Each def('ID', {...}) adds behaviour to one screen: init on entry, update on every state change, tick every 400 ms,
   actions.name for data-do="x.name" controls. Uses the helpers in kit.js. DOM APIs and textContent only. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.screens;
  var el = UI.el, q = UI.q, qa = UI.qa;
  var exec = K.exec, text = K.text, find = K.find, hide = K.hide, secsLeft = K.secsLeft, follow = K.follow, setTag = K.setTag, rideFinal = K.rideFinal, loadScenarioButton = K.loadScenarioButton, navButton = K.navButton, def = K.def, ctl = K.ctl, COMMON = K.COMMON, rupees = K.rupees, extend = K.extend, ago = K.ago, clock = K.clock, label = K.label, tagKind = K.tagKind, tbodyOf = K.tbodyOf, tdCell = K.tdCell, stSpan = K.stSpan, rowsSig = K.rowsSig, fillTable = K.fillTable, bubbles = K.bubbles, liveRideRows = K.liveRideRows, prependLive = K.prependLive;

  // ================================================================== partner
  def('P01', { actions: { partnerApply: function (n) {
    var on = UI.q('#mock a[data-ui="pick"].on'), t = on ? on.textContent : 'Restaurant';
    var go = /Hotel/.test(t) ? 'P04' : /rental/i.test(t) ? 'P05' : /Bus/.test(t) ? 'P06' : 'P02';
    return exec('sim.note', { arg: 'Partner application started: ' + t.trim(), event: 'partner.applied' }, n).then(function (r) { if (r.ok) { UI.toast('Application started (simulated). An admin reviews it on A24.', 'sim'); UI.go(go); } return r; });
  } } });
  def('P02', {
    update: function (ctx) {
      var o = ctx.engine.order(), accept = find('button', 'Accept'), card = accept && accept.closest('div[class]') && accept.parentElement.parentElement;
      if (!o) { hide(card, true); UI.state('No new orders', ['Place one from the rider app (R45).'], [loadScenarioButton('H')]); return; }
      hide(card, o.state !== 'PLACED');
      var h = find('b', 'New order #'); if (h) text(h, 'New order #' + o.id);
      if (o.state === 'PLACED') { UI.state(null); return; }
      var btns = o.state === 'PREPARING' ? [{ label: 'Mark ready', primary: true, onClick: function (b) { exec('order.ready', {}, b).then(function (r) { if (r.ok) UI.toast('Marked ready. The delivery partner is on the way.', 'info'); }); } }] : [];
      var line = { ACCEPTED: 'Accepted', PREPARING: 'Preparing · ' + (o.prepMin || 15) + ' min', READY: 'Ready · waiting for ' + (o.courier ? D.DRIVERS[o.courier.id].short : 'pickup'), PICKED_UP: 'Picked up', DELIVERED: 'Delivered', REJECTED: 'Rejected · customer refunded automatically', CANCELLED: 'Cancelled · customer refunded' }[o.state];
      UI.state('Order #' + o.id + ' · ' + o.state, [line], btns, o.state === 'REJECTED' ? 'warn' : 'info');
    },
    actions: {
      orderAccept: function (n) { var p = UI.q('#mock .chip.on'); var prep = p ? parseInt(p.textContent, 10) : 15; return exec('order.accept', { prep: prep }, n).then(function (r) { if (r.ok) UI.toast('Accepted with ' + prep + ' min prep time.', 'info'); return r; }); },
      orderReject: function (n) { return UI.prompt('Why are you rejecting this order?', 'Reason', 'Item out of stock').then(function (reason) { if (reason == null) return { ok: false }; return exec('order.reject', { reason: reason }, n); }); }
    } });

  // ================================================================== partner: sign-in and bookings
  def('P08', { actions: { partnerSignIn: function (n) {
    UI.clearErrors();
    return exec('partner.signIn', { email: UI.val('email'), code: UI.val('code') }, n, { actor: 'partner' }).then(function (r) { if (r.ok) UI.go('P09'); return r; });
  } } });
  function bookingPanel(kind, title, extra) {
    return function (ctx, s) {
      var list = Object.keys(s.bookings).map(function (k) { return s.bookings[k]; }).filter(function (b) { return b.kind === kind; });
      var btns = [];
      var act = function (b, ev, lbl, primary) {
        btns.push({ label: lbl + ' · ' + b.guest.split(' ')[0], primary: primary, onClick: function (btn) {
          var payload = { id: b.id, event: ev };
          if (extra && ev === 'check_in') { var missing = extra(); if (missing) { UI.toast(missing, 'error'); return; } payload.photos = true; }
          exec('booking.act', payload, btn, { actor: 'partner' }).then(function (r) { if (r.ok) UI.toast(b.id + ': ' + label(r.to) + ' (simulated)', 'info'); });
        } });
      };
      list.forEach(function (b) {
        if (b.state === 'PENDING') { act(b, 'confirm', 'Confirm', true); act(b, 'decline', 'Decline'); }
        else if (b.state === 'CONFIRMED') act(b, 'check_in', kind === 'rental' ? 'Hand over' : 'Check in', true);
        else if (b.state === 'CHECKED_IN') act(b, 'complete', kind === 'hotel' ? 'Check out' : kind === 'rental' ? 'Vehicle returned' : 'Trip completed');
      });
      UI.state(title, list.map(function (b) { return b.id + ' · ' + b.guest + ' · ' + b.detail + ' · ' + label(b.state); }), btns, 'info');
    };
  }
  def('P04', { update: bookingPanel('hotel', 'Bookings (simulated)') });
  def('P05', { update: bookingPanel('rental', 'Handovers (simulated)', function () {
    var need = ['Front', 'Back', 'Left', 'Right', 'Fuel'].filter(function (lab) { var c = find('.chip', lab); return c && !c.classList.contains('on'); });
    return need.length ? 'Take the handover photos first: ' + need.join(', ') + ' (tap each chip – simulated camera).' : null;
  }) });
  def('P06', { update: bookingPanel('bus', 'Boarding list (simulated)') });

})();
