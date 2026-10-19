/* RideNova Customer app – screen controllers (behaviour of the screens of this application only).
   Each def('ID', {...}) adds behaviour to one screen: init on entry, update on every state change, tick every 400 ms,
   actions.name for data-do="x.name" controls. Uses the helpers in kit.js. DOM APIs and textContent only. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.screens;
  var el = UI.el, q = UI.q, qa = UI.qa;
  var exec = K.exec, text = K.text, find = K.find, hide = K.hide, secsLeft = K.secsLeft, follow = K.follow, setTag = K.setTag, rideFinal = K.rideFinal, loadScenarioButton = K.loadScenarioButton, navButton = K.navButton, def = K.def, ctl = K.ctl, COMMON = K.COMMON, rupees = K.rupees, extend = K.extend, ago = K.ago, clock = K.clock, label = K.label, tagKind = K.tagKind, tbodyOf = K.tbodyOf, tdCell = K.tdCell, stSpan = K.stSpan, rowsSig = K.rowsSig, fillTable = K.fillTable, bubbles = K.bubbles, liveRideRows = K.liveRideRows, prependLive = K.prependLive;

  // ================================================================== rider: get started
  def('R01', { init: function (ctx) {
    setTimeout(function () { if (UI.sid !== 'R01') return; var s = ctx.engine.state; UI.go(s.session.rider.status === 'signed_in' ? 'R29' : 'R02', { replace: true }); }, 1600);
  } });

  // R03 behaviour (terms checkbox, country + location) lives in product-core.js (loaded after this file).

  var resendAt = 0;
  def('R04', {
    init: function (ctx) {
      resendAt = Date.now() + 24000;
      UI.toast('Demo code: ' + D.DEMO_CODES.riderOtp + ' (simulated SMS).', 'info');
      if (ctx.engine.state.session.rider.status !== 'otp_sent') UI.toast('No code requested yet in this demo – enter your number first, or use the demo code.', 'warn');
      var i = UI.q('#mock .rn-otp-input'); if (i) i.focus();
    },
    tick: function () { var left = secsLeft(resendAt, Date.now()); UI.bind('resend', left ? 'Resend code in 0:' + String(left).padStart(2, '0') + ' · Get code on WhatsApp' : 'Resend code now · Get code on WhatsApp'); },
    actions: {
      verifyOtp: function (n, a, ctx) {
        UI.clearErrors();
        var code = UI.q('#mock .rn-otp-input').value;
        if (code.length !== 6) { UI.fieldError('riderOtp', 'Enter all 6 digits.'); return { ok: false }; }
        if (ctx.engine.state.session.rider.status !== 'otp_sent') return exec('auth.sendOtp', { phone: ctx.engine.state.session.rider.phone }, null, { instant: true }).then(function () { return S.R04.actions.verifyOtp(n, a, ctx); });
        return exec('auth.verifyOtp', { code: code }, n).then(function (r) { if (r.ok) UI.go(r.newUser ? 'R05' : 'R29'); else UI.fieldError('riderOtp', r.error); return r; });
      },
      resendOtp: function (n, a, ctx) {
        if (Date.now() < resendAt) { UI.toast('You can request a new code when the timer ends.', 'info'); return { ok: false }; }
        return exec('auth.sendOtp', { phone: ctx.engine.state.session.rider.phone }, n).then(function (r) { if (r.ok) { resendAt = Date.now() + 24000; UI.toast('New code sent (simulated). Demo code: ' + D.DEMO_CODES.riderOtp, 'info'); } return r; });
      }
    } });

  def('R05', { actions: { profile: function (n) {
    UI.clearErrors();
    return exec('rider.profile', { name: UI.field('name').value, email: UI.field('email').value }, n).then(function (r) { if (r.ok) UI.go('R06'); return r; });
  } } });

  def('R06', { actions: { permissions: function (n) {
    var loc = UI.q('#mock [role="switch"]');
    var granted = loc && loc.classList.contains('on');
    return exec('rider.permission', { location: granted ? 'granted' : 'denied' }, n).then(function (r) {
      if (r.ok) { UI.toast(granted ? 'Location allowed (simulated OS dialog). No real location is read.' : 'Location denied: you will choose the pickup point by search.', granted ? 'sim' : 'warn'); UI.go('R29'); }
      return r;
    });
  } } });

  // ================================================================== rider: home, priorities
  function priority(n) { var label = n.textContent.trim().split(/\s|·/)[0]; return exec('rider.priority', { arg: label }, n, { instant: true }); }
  def('R29', { actions: { priority: priority } });
  def('R30', { actions: { priorityOpt: priority } });

  def('R51', { actions: { emergencyRide: function (n) {
    return exec('ride.request', { vehicle: 'Cab', plan: 'happy' }, n).then(function (r) { if (r.ok) { UI.toast('Emergency ride: nearest driver, priority dispatch, no surge (simulated).', 'warn'); UI.go('R11'); } return r; });
  } } });

  // ================================================================== rider: booking
  function destination(n, arg, ctx) {
    var name = (UI.q('b', n) || n).textContent.trim();
    UI.toast('Destination: ' + (arg || name) + '. Routes and prices are sample data.', 'info');
    UI.go(ctx.engine.state.rider.priority !== 'bal' && ctx.sid === 'R08' ? 'R31' : 'R09');
  }
  function vehicleOf(n) { var b = UI.q('.tx b', n) || UI.q('b', n); return b ? b.textContent.replace(/\s+(CHEAPEST|FAST|ECO|BEST VALUE).*$/, '').trim() : ''; }
  def('R07', { actions: { destination: destination, vehicle: function (n, a, ctx) {
    var label = (UI.q('.xs', n.parentElement) || {}).textContent || '';
    return exec('ride.quote', { vehicle: label || 'Cab' }, null, { instant: true });
  } } });
  def('R08', { actions: { destination: destination } });

  def('R09', {
    init: function (ctx) { var r = ctx.engine.activeRide(); if (r) UI.state('You already have an active ride', [r.id + ' · ' + r.state], [navButton('Open it', RN.engineLib.rideScreen(r), true)]); },
    actions: {
      vehicle: function (n) {
        var v = vehicleOf(n), price = (UI.q('.pr', n) || {}).textContent || '';
        UI.bind('book', 'Book ' + v + (price ? ' · ' + price : ''));
        return exec('ride.quote', { vehicle: v }, null, { instant: true });
      },
      book: function (n, a, ctx) {
        var r = ctx.engine.activeRide();
        if (r) { UI.toast('You already have an active ride (' + r.state + ').', 'error'); UI.go(RN.engineLib.rideScreen(r)); return { ok: false }; }
        if (ctx.engine.state.rider.debtPaise > 0) { UI.toast('Settle your unpaid fare first.', 'error'); UI.go('R17'); return { ok: false }; }
        UI.go('R10'); return { ok: true };
      }
    } });
  def('R31', { actions: { book: function (n, arg) { return exec('ride.quote', { vehicle: arg }, null, { instant: true }).then(function () { UI.go('R10'); return { ok: true }; }); } } });

  def('R10', {
    init: function (ctx) {
      if (ctx.engine.state.rider.location === 'denied') UI.toast('Location is off (simulated), so the pickup was set from search, not GPS.', 'warn');
      var pay = ctx.engine.state.quotePay || 'UPI';
      UI.qa('#mock [data-do="x.pay"]').forEach(function (li) { var on = li.textContent.indexOf(pay === 'Card' ? 'Visa' : pay) >= 0; li.classList.toggle('on', on); li.setAttribute('aria-pressed', String(on)); });
    },
    actions: {
      pay: function (n) { var t = n.textContent; var m = /Visa/.test(t) ? 'Card' : /Wallet/.test(t) ? 'Wallet' : /Cash/.test(t) ? 'Cash' : 'UPI'; return exec('ride.quote', { payMethod: m }, null, { instant: true }); },
      request: function (n) { return exec('ride.request', {}, n).then(function (r) { if (r.ok) UI.go('R11'); return r; }); }
    } });

  function cancelRide(n, a, ctx) {
    return exec('ride.cancel', { reason: 'Rider cancelled' }, n).then(function (r) {
      if (r.ok) { UI.toast(r.feePaise ? 'Ride cancelled. Cancellation fee ' + rupees(r.feePaise) + ' (example amount, policy not final).' : 'Ride cancelled. No fee.', r.feePaise ? 'warn' : 'info'); UI.later('R07', 1200); }
      return r;
    });
  }

  def('R11', {
    update: function (ctx, s) {
      var e = ctx.engine, r = e.ride();
      if (!r || r.state === 'CANCELLED' || r.state === 'CLOSED' || ['PAYMENT_COMPLETED', 'PAYMENT_FAILED'].indexOf(r.state) >= 0 && ctx.sid === 'R11') {
        UI.state(r && r.state === 'CANCELLED' ? 'Request cancelled' : 'No ride request in progress', ['Book a ride to see the driver search.'], [navButton('Book a ride', 'R09', true)]);
        return;
      }
      if (r.state === 'NO_DRIVER_FOUND') {
        UI.state('No drivers available right now', ['We searched for ' + Math.round((r.searchDeadline - r.requestedAt) / 1000) + ' s (2 → 4 → 6 km).', 'Nothing was charged.'], [
          { label: 'Try again', primary: true, onClick: function (b) { exec('ride.retry', {}, b).then(function (x) { if (x.ok) UI.toast('Searching again…', 'info'); }); } },
          navButton('Choose another vehicle', 'R09'), navButton('Close', 'R07')], 'warn');
        hide(find('.btn', 'Cancel request'), true);
        return;
      }
      hide(find('.btn', 'Cancel request'), false);
      var target = RN.engineLib.rideScreen(r);
      if (target !== 'R11') { follow(ctx, target, r.driverId ? D.DRIVERS[r.driverId].short + ' accepted your ride.' : null); return; }
      var lines = r.offers.map(function (o) {
        var d = D.DRIVERS[o.driverId].short;
        return o.state === 'PENDING' ? 'Offer sent to ' + d + ' · ' + secsLeft(o.expiresAt, Date.now()) + ' s to answer' : o.state === 'DECLINED' ? d + ' declined – trying the next driver' : o.state === 'EXPIRED' ? d + ' did not answer – trying the next driver' : d + ' ' + o.state.toLowerCase();
      });
      if (!r.offers.length || r.offers[r.offers.length - 1].state !== 'PENDING') lines.push('Widening the search… ' + secsLeft(r.searchDeadline, Date.now()) + ' s left');
      UI.state('Searching · ' + r.state, lines, null, 'info');
    },
    tick: function (ctx, s) { S.R11.update(ctx, s); },
    actions: { cancelRide: cancelRide } });

  var etaBase = 0;
  def('R12', {
    update: function (ctx, s) {
      var r = ctx.engine.ride();
      if (!r || rideFinal(r) && r.state !== 'CLOSED') { UI.state(r && r.state === 'CANCELLED' ? 'This ride was cancelled' : 'No driver assigned yet', [r && r.cancel ? 'Cancelled by ' + r.cancel.by + '.' : 'Book a ride first.'], [navButton('Book a ride', 'R09', true)]); return; }
      var target = RN.engineLib.rideScreen(r);
      if (target !== 'R12') { follow(ctx, target, target === 'R15' ? 'Trip started.' : null); return; }
      UI.state(null);
      var d = D.DRIVERS[r.driverId];
      if (d) { var li = UI.q('#mock .li .tx b'); text(li, d.short + ' · ★ ' + d.rating); }
      UI.bind('otp', 'OTP ' + r.otp);
      if (r.state === 'DRIVER_ARRIVED') { UI.bind('eta', 'Your driver has arrived'); UI.bind('dist', 'Waiting is free for 3 min, then ₹1/min'); }
    },
    tick: function (ctx) {
      var r = ctx.engine.ride(); if (!r || !r.acceptedAt || r.state === 'DRIVER_ARRIVED' || RN.engineLib.rideScreen(r) !== 'R12') return;
      var total = ctx.engine.dur('arrive'), left = Math.max(0, total - (Date.now() - r.acceptedAt));
      var min = Math.max(1, Math.ceil(4 * left / total));
      UI.bind('eta', 'Arriving in ' + min + ' min'); UI.bind('dist', (1.1 * left / total).toFixed(1) + ' km away');
    },
    actions: { cancelRide: cancelRide } });

  def('R13', { init: function (ctx) {
    var r = ctx.engine.activeRide();
    var bound = r && ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_IN_PROGRESS'].indexOf(r.state) >= 0;
    UI.toast(bound ? 'Masked call (simulated): no audio, no real numbers.' : 'Masked calling works only while a driver is assigned (until 30 min after the trip).', bound ? 'sim' : 'warn');
  } });
  def('R14', { actions: { quickReply: function (n) { UI.toast('Message “' + n.textContent.trim() + '” sent (simulated).', 'sim'); } } });

  def('R15', {
    update: function (ctx) {
      var r = ctx.engine.ride();
      if (!r || rideFinal(r)) { UI.state('No trip in progress', ['Start one from Scenario A or G.'], [navButton('Book a ride', 'R09', true), loadScenarioButton('G', 'Load a trip in progress')]); return; }
      var target = RN.engineLib.rideScreen(r);
      if (target !== 'R15') { follow(ctx, target, target === 'R17' ? 'You have arrived.' : null); return; }
      UI.state(null);
    } });

  def('R16', {
    update: function (ctx) {
      var inc = ctx.engine.incident();
      var mine = inc && inc.by === 'rider' ? inc : null;
      if (!mine) { UI.state('SOS not sent yet', ['Press and hold the red button for 2 seconds.', 'Keyboard: focus it and press Enter.', 'Simulated – nobody is contacted.'], null, 'warn'); return; }
      var label = { OPEN: 'Safety team alerted – waiting for an agent', ACKNOWLEDGED: 'Agent ' + (mine.agent || '') + ' is handling your alert', IN_PROGRESS: 'Agent is working on it', ESCALATED: 'Emergency services contact recorded by the agent', RESOLVED: 'Resolved by the safety team', CLOSED: 'Closed', FALSE_ALARM: 'Closed as false alarm' }[mine.state];
      var btns = [];
      if (['CLOSED', 'FALSE_ALARM', 'RESOLVED'].indexOf(mine.state) < 0 && !mine.riderSafe) btns.push({ label: "I'm safe", primary: true, onClick: function (b) { exec('sos.safe', {}, b).then(function (r) { if (r.ok) UI.toast('Thanks. The safety team sees that you are safe.', 'info'); }); } });
      UI.state(mine.id + ' · ' + mine.state, [label, mine.riderSafe ? 'You confirmed you are safe.' : 'Live location every second (simulated).'], btns, mine.state === 'OPEN' ? 'err' : 'info');
    },
    actions: {} });

  def('R17', {
    update: function (ctx) {
      var r = ctx.engine.lastRide(), row = UI.q('#mock [data-bind="payline"]');
      var label = row && row.firstElementChild, tag = row && UI.q('.tag', row);
      if (!r || ['TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'CLOSED'].indexOf(r.state) < 0) {
        text(label, 'No completed ride in this demo yet'); setTag(tag, '—', 'info');
        if (r && !rideFinal(r)) follow(ctx, RN.engineLib.rideScreen(r));
        else UI.state('Sample receipt', ['Finish a ride (Scenario A or E) to see its real payment status.'], [navButton('Book a ride', 'R09', true)]);
        return;
      }
      var m = r.payment.method;
      if (r.state === 'TRIP_COMPLETED' || r.state === 'PAYMENT_PENDING') {
        text(label, m === 'Cash' ? 'Pay ' + rupees(r.finalPaise) + ' in cash to the driver' : 'Charging ' + m + '…'); setTag(tag, 'Pending', 'warn');
        UI.state('Payment pending', [m === 'Cash' ? 'The driver confirms when cash is received.' : 'Waiting for the payment gateway (simulated webhook).'], null, 'info');
      } else if (r.state === 'PAYMENT_FAILED') {
        text(label, m + ' payment failed'); setTag(tag, 'Failed', 'err');
        var pay = function (method) { return { label: 'Pay by ' + method, primary: method === 'UPI', onClick: function (b) { exec('payment.payOther', { method: method }, b).then(function (x) { if (x.ok) UI.toast('Paid ' + rupees(r.finalPaise) + ' by ' + method + ' (simulated).', 'info'); }); } }; };
        UI.state('Payment failed', ['The gateway declined twice. Nothing was charged.', 'Settle ' + rupees(r.finalPaise) + ' to book again.'], [pay('UPI'), pay('Wallet'), pay('Cash')], 'err');
      } else {
        text(label, 'Paid by ' + m); setTag(tag, r.payment.state === 'REFUNDED' ? 'Refunded' : 'Paid', 'ok'); UI.state(null);
      }
    } });

  var stars = 5;
  def('R18', {
    init: function (ctx) {
      var box = UI.q('#mock .stars'); if (!box) return;
      box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', 'Rating');
      Array.prototype.slice.call(box.children).forEach(function (st, i) {
        st.setAttribute('role', 'radio'); st.setAttribute('tabindex', '0'); st.setAttribute('aria-label', (i + 1) + ' star' + (i ? 's' : ''));
        var choose = function () { stars = i + 1; Array.prototype.slice.call(box.children).forEach(function (o, j) { o.classList.toggle('rn-star-off', j > i); o.setAttribute('aria-checked', String(j === i)); }); };
        st.addEventListener('click', choose); st.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      });
      stars = 4; Array.prototype.slice.call(box.children).forEach(function (o, j) { o.setAttribute('aria-checked', String(j === 3)); });
      var r = ctx.engine.lastRide(); if (r && r.rating) UI.state('Already rated', [r.rating.stars + '★ · thank you'], [navButton('Home', 'R29', true)]);
    },
    actions: { rate: function (n) {
      var tags = UI.qa('#mock .chip.on').map(function (c) { return c.textContent.trim(); });
      var tip = tags.filter(function (t) { return /^₹\d+$/.test(t); })[0];
      return exec('ride.rate', { stars: stars, tags: tags, tipPaise: tip ? Number(tip.slice(1)) * 100 : 0 }, n).then(function (r) { if (r.ok) { UI.toast('Thanks for rating ' + stars + '★' + (tip ? ' and tipping ' + tip + ' (simulated – no money moves)' : '') + '.', 'info'); UI.go('R29'); } return r; });
    } } });

  def('R22', { actions: { coupon: function (n) { return exec('sim.note', { arg: 'Coupon RIDE50 applied (simulated)', event: 'coupon.applied' }, n).then(function (r) { if (r.ok) { UI.toast('Coupon RIDE50 applied. The driver still earns the full fare.', 'sim'); UI.go('R09'); } return r; }); } } });
  def('R23', { actions: { schedule: function (n) { return exec('sim.note', { arg: 'Ride scheduled for Tue 7:30 AM (simulated)', event: 'ride.scheduled' }, n).then(function (r) { if (r.ok) { UI.toast('Scheduled for Tue 7:30 AM. A driver is assigned 15 minutes before (simulated).', 'sim'); UI.go('R20'); } return r; }); } } });

  // ================================================================== rider: food
  var delivery = 'Saver';
  def('R45', { actions: {
    delivery: function (n) { delivery = vehicleOf(n) || 'Saver'; },
    placeOrder: function (n) { return exec('order.place', { delivery: delivery }, n).then(function (r) { if (r.ok) { UI.toast('Order #' + r.orderId + ' placed. ₹458 authorised (simulated – nothing charged).', 'sim'); UI.go('R46'); } return r; }); }
  } });
  def('R46', { update: function (ctx) {
    var o = ctx.engine.order(), steps = UI.qa('#mock .steps-m .s');
    if (!o) { UI.state('No food order yet', ['Order from Biryani House to follow it here.'], [navButton('Open the menu', 'R45', true), loadScenarioButton('H')]); return; }
    if (o.state === 'REJECTED' || o.state === 'CANCELLED') { UI.state('Order #' + o.id + ' ' + o.state.toLowerCase(), ['Refund of ' + rupees(o.totalPaise) + ' issued automatically (simulated).'], [navButton('Food home', 'R44', true)], 'warn'); return; }
    var done = { PLACED: 0, ACCEPTED: 1, PREPARING: 1, READY: 2, PICKED_UP: 3, DELIVERED: 4 }[o.state];
    steps.forEach(function (st, i) { var dot = UI.q('.dot', st); if (dot) { dot.classList.toggle('ok', i < done); dot.classList.toggle('now', i === done); } st.classList.toggle('rn-pending', i > done); });
    UI.bind('eta', { PLACED: 'Waiting for the restaurant', ACCEPTED: 'Restaurant accepted', PREPARING: 'Being prepared · ' + (o.prepMin || 15) + ' min', READY: 'Ready · waiting for ' + (o.courier ? D.DRIVERS[o.courier.id].short : 'a partner'), PICKED_UP: 'On the way · about 8 min', DELIVERED: 'Delivered' }[o.state]);
    UI.state(o.state === 'DELIVERED' ? null : 'Order #' + o.id + ' · ' + o.state, o.state === 'DELIVERED' ? [] : ['Share code ' + o.otp + ' with the delivery partner at the door.'], null, 'info');
    if (o.state === 'DELIVERED' && !UI.q('#mock .rn-state')) UI.state('Delivered', ['Enjoy your meal.'], [navButton('Rate the order', 'R18', true)]);
  } });

  // ================================================================== customer: sign-in choice, notifications, history
  def('R58', { actions: {
    authMode: function (n, mode) { UI.mem.authMode = mode; UI.mem.demoPhone = null; UI.go('R03'); },
    demoAccount: function (n, kind) {
      UI.mem.authMode = kind === 'new' ? 'register' : 'login';
      UI.mem.demoPhone = kind === 'new' ? '90000 00001' : '98480 04321';
      UI.go('R03');
    }
  } });

  var notifFilter = 'All';
  function riderNotifications(s) {
    var map = {
      'ride.offer.accepted': ['car', 'Driver assigned', 'Rides'], 'ride.driver.arrived': ['pin', 'Your driver has arrived', 'Rides'],
      'ride.trip.end': ['car', 'Trip completed', 'Rides'], 'ride.payment.failed': ['card', 'Payment failed – pay another way', 'Rides'],
      'payment.captured': ['card', 'Payment received', 'Rides'], 'ride.ride.cancel': ['x', 'Ride cancelled', 'Rides'],
      'ride.search.exhausted': ['alert', 'No driver found', 'Rides'], 'order.placed': ['bag', 'Order placed', 'Orders'],
      'order.accept': ['bag', 'Restaurant accepted your order', 'Orders'], 'order.pickup': ['bike', 'Order picked up', 'Orders'],
      'order.deliver': ['bag', 'Order delivered', 'Orders'], 'refund.issued': ['wallet', 'Refund issued', 'Orders'],
      'ticket.created': ['doc', 'Support ticket created', 'Support'], 'ticket.message': ['chat', 'New reply on your ticket', 'Support'],
      'ticket.resolve': ['doc', 'Ticket resolved', 'Support']
    };
    return s.events.filter(function (e) { return map[e.type] && (e.actor !== 'agent' || e.type !== 'ticket.message' || true); })
      .filter(function (e) { return !(e.type === 'ticket.message' && e.actor !== 'agent'); })
      .slice(-25).reverse().map(function (e) { var m = map[e.type]; return { title: m[1], sub: e.note || e.ref, right: clock(e.at), kind: m[2] }; });
  }
  def('R56', {
    update: function (ctx, s) {
      var box = q('#mock [data-list="notifications"]'); if (!box) return;
      box.setAttribute('data-empty', 'No notifications in this category yet.');
      var live = riderNotifications(s).filter(function (x) { return notifFilter === 'All' || x.kind === notifFilter; });
      var sig = rowsSig([notifFilter, live.length, live[0] && live[0].right]);
      if (box.getAttribute('data-sig') === sig) return;
      box.setAttribute('data-sig', sig);
      UI.list(box, live.map(function (x) { return { title: x.title, sub: x.sub, right: x.right, tone: 'brand' }; }));
    },
    actions: { notifFilter: function (n) { notifFilter = n.textContent.trim(); S.R56.update(UI.ctx, UI.engine.state); } }
  });

  def('R20', { update: function (ctx, s) { prependLive('.list', liveRideRows(s, false)); } });

})();
