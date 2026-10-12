/* RideNova Driver app – screen controllers (behaviour of the screens of this application only).
   Each def('ID', {...}) adds behaviour to one screen: init on entry, update on every state change, tick every 400 ms,
   actions.name for data-do="x.name" controls. Uses the helpers in kit.js. DOM APIs and textContent only. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.screens;
  var el = UI.el, q = UI.q, qa = UI.qa;
  var exec = K.exec, text = K.text, find = K.find, hide = K.hide, secsLeft = K.secsLeft, follow = K.follow, setTag = K.setTag, rideFinal = K.rideFinal, loadScenarioButton = K.loadScenarioButton, navButton = K.navButton, def = K.def, ctl = K.ctl, COMMON = K.COMMON, rupees = K.rupees, extend = K.extend, ago = K.ago, clock = K.clock, label = K.label, tagKind = K.tagKind, tbodyOf = K.tbodyOf, tdCell = K.tdCell, stSpan = K.stSpan, rowsSig = K.rowsSig, fillTable = K.fillTable, bubbles = K.bubbles, liveRideRows = K.liveRideRows, prependLive = K.prependLive;

  // ================================================================== driver
  def('D01', { actions: { driverLogin: function (n) {
    UI.clearErrors();
    var v = UI.field('phone').value, digits = v.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) { UI.fieldError('phone', 'Enter a valid 10-digit mobile number starting with 6–9.'); return { ok: false }; }
    return exec('auth.sendOtp', { phone: v }, n).then(function (r) {
      if (!r.ok) return r;
      UI.toast('Demo: code ' + D.DEMO_CODES.driverOtp + ' read automatically (simulated SMS).', 'sim');
      return exec('auth.verifyOtp', { code: D.DEMO_CODES.driverOtp }, null, { instant: true }).then(function (x) {
        // 90000 12345 is the demo driver (Arjun K.); any other number starts registration
        if (x.ok) UI.go(digits === '9000012345' ? 'D05' : 'D02');
        return x;
      });
    });
  } } });
  def('D02', { actions: { register: function (n) {
    UI.clearErrors();
    var name = UI.field('fullname').value.trim();
    if (!/^[\p{L}][\p{L} .'-]{1,49}$/u.test(name)) { UI.fieldError('fullname', 'Enter your name as on your licence (letters only).'); return { ok: false }; }
    return exec('sim.note', { arg: 'Driver registration step 1 saved: ' + name, event: 'driver.registered' }, n).then(function (r) { if (r.ok) UI.go('D03'); return r; });
  } } });

  var DOC_TAG = { missing: ['Upload', 'info'], uploaded: ['Uploaded', 'ok'], rejected: ['Rejected', 'err'], in_review: ['In review', 'warn'], approved: ['Approved', 'ok'] };
  def('D03', {
    update: function (ctx, s) {
      s.kyc.docs.forEach(function (d) {
        var li = UI.q('#mock [data-do="x.uploadDoc"][data-arg="' + d.key + '"]'); if (!li) return;
        setTag(UI.q('.tag', li), DOC_TAG[d.state][0], DOC_TAG[d.state][1]);
        var sub = UI.q('.tx span', li); if (sub && d.state === 'rejected' && d.reason) text(sub, d.reason);
      });
      var open = ['DRAFT', 'REUPLOAD_REQUESTED'].indexOf(s.kyc.state) >= 0;
      if (!open) UI.state('Documents locked · ' + s.kyc.state.replace('_', ' '), s.kyc.state === 'ACTIVE' ? ['This driver is already verified. Load scenario F to try onboarding.'] : ['Waiting for the admin decision (A07).'], s.kyc.state === 'ACTIVE' ? [loadScenarioButton('F')] : [navButton('Verification status', 'D04', true)]);
      else UI.state(s.kyc.state === 'REUPLOAD_REQUESTED' ? 'Please re-upload: ' + (s.kyc.reason || '') : null, [], null, 'warn');
    },
    actions: {
      uploadDoc: function (n, key) { return exec('kyc.upload', { doc: key }, n).then(function (r) { if (r.ok) UI.toast('Synthetic document attached (no file is read or sent).', 'sim'); return r; }); },
      submitKyc: function (n) { return exec('kyc.submit', {}, n).then(function (r) { if (r.ok) { UI.toast('Submitted for review. An admin reviews it on A07.', 'info'); UI.go('D04'); } return r; }); }
    } });

  def('D04', {
    update: function (ctx, s) {
      var k = s.kyc, msg = {
        DRAFT: ['Not submitted yet', 'Upload your documents first.'], IN_REVIEW: ['In review', 'An admin is checking your documents (A07).'],
        REUPLOAD_REQUESTED: ['Action needed', 'Re-upload: ' + (k.reason || 'see documents')], REJECTED: ['Application rejected', k.reason || 'See the email for details.'],
        APPROVED: ['Approved', 'Watch the training video to activate your account.'], ACTIVE: ['Account active', 'You can go online.']
      }[k.state];
      var btns = k.state === 'DRAFT' || k.state === 'REUPLOAD_REQUESTED' ? [navButton('Upload documents', 'D03', true)] : k.state === 'ACTIVE' ? [navButton('Go to home', 'D05', true)] : [];
      UI.state('Verification · ' + msg[0], [msg[1]], btns, k.state === 'REJECTED' ? 'err' : k.state === 'ACTIVE' || k.state === 'APPROVED' ? 'ok' : 'info');
    },
    actions: { training: function (n, a, ctx) {
      var k = ctx.engine.state.kyc.state;
      if (k === 'ACTIVE') { UI.go('D05'); return; }
      if (k !== 'APPROVED') { UI.toast('Training unlocks after your documents are approved.', 'error'); return { ok: false }; }
      return exec('kyc.activate', {}, n).then(function (r) { if (r.ok) { UI.toast('Training complete (simulated). Your account is active.', 'info'); UI.go('D05'); } return r; });
    } } });

  function driverFollow(ctx) {
    var e = ctx.engine, s = e.state;
    if (e.pendingOfferFor(s.persona)) return 'D07';
    var r = e.activeRide(), t = RN.engineLib.driverScreen(r, s.persona);
    if (t && ['D08', 'D09', 'D10'].indexOf(t) >= 0) return t;
    var o = e.order();
    if (o && o.courier && o.courier.state === 'PENDING' && !s.opts.auto.courier) return 'D22';
    return null;
  }
  def('D05', {
    update: function (ctx, s) {
      var d = ctx.engine.persona();
      if (d.avail !== 'OFFLINE') { follow(ctx, driverFollow(ctx) || 'D06'); return; }
      if (!d.docsValid) UI.state('Going online is blocked', ['Your PUC certificate has expired.'], [navButton('Upload new PUC', 'D17', true)], 'err');
      else if (d.kyc !== 'ACTIVE' && d.kyc !== 'APPROVED') UI.state('Not verified yet', ['KYC: ' + d.kyc], [navButton('Verification status', 'D04', true)], 'warn');
      else UI.state(null);
    },
    actions: { goOnline: function (n) { return exec('driver.online', {}, n).then(function (r) { if (r.ok) UI.go('D06'); return r; }); } } });
  def('D21', { actions: { goOnline: function (n) { return exec('driver.online', {}, n).then(function (r) { if (r.ok) UI.go('D06'); return r; }); } } });
  def('D06', {
    update: function (ctx) {
      var d = ctx.engine.persona();
      if (d.avail === 'OFFLINE') { UI.state('You are offline', [], [navButton('Go online', 'D05', true)]); return; }
      var t = driverFollow(ctx);
      if (t) { follow(ctx, t, t === 'D07' ? 'New ride request!' : t === 'D22' ? 'New delivery job!' : null); return; }
      UI.state(ctx.engine.state.opts.auto.driver ? 'Waiting for requests' : null, ctx.engine.state.opts.auto.driver ? ['Tip: set "Other parties" to “Played by me” to answer offers yourself.'] : [], null, 'info');
    },
    actions: { goOffline: function (n) { return exec('driver.offline', {}, n).then(function (r) { if (r.ok) UI.go('D05'); return r; }); } } });

  def('D07', {
    update: function (ctx) {
      var e = ctx.engine, po = e.pendingOfferFor(e.state.persona);
      if (!po) {
        var t = RN.engineLib.driverScreen(e.activeRide(), e.state.persona);
        if (t) { follow(ctx, t); return; }
        UI.state('No ride request right now', ['Book a ride from the rider app (R09) with “Other parties” set to “Played by me”.'], [navButton('Back to online', 'D06', true)]);
        UI.qa('#mock button[data-do]').forEach(function (b) { b.disabled = true; });
        return;
      }
      UI.qa('#mock button[data-do]').forEach(function (b) { b.disabled = false; });
      UI.state(null);
    },
    tick: function (ctx) {
      var e = ctx.engine, po = e.pendingOfferFor(e.state.persona), ring = UI.q('#mock .ring span');
      if (po && ring) text(ring, String(secsLeft(po.offer.expiresAt, Date.now())));
      if (!po && UI.q('#mock button[data-do]:not([disabled])')) S.D07.update(ctx);
    },
    actions: {
      accept: function (n) { return exec('offer.accept', {}, n).then(function (r) { if (r.ok) UI.go('D08'); return r; }); },
      decline: function (n) { return exec('offer.decline', {}, n).then(function (r) { if (r.ok) { UI.toast('Declined. You will not get this ride again; short cool-down.', 'info'); UI.go('D06'); } return r; }); }
    } });

  function personaRideGuard(ctx, here) {
    var e = ctx.engine, r = e.activeRide(), t = RN.engineLib.driverScreen(r, e.state.persona);
    if (!t) { var last = e.lastRide(); if (here === 'D11' && last && last.driverId === e.state.persona) return last; UI.state('No assigned trip', ['Accept a ride first.'], [navButton('Online', 'D06', true)]); return null; }
    if (t !== here && !(here === 'D10' && e.state.queue.length)) { follow(ctx, t); return null; }
    UI.state(null); return r;
  }
  def('D08', { update: function (ctx) { var r = personaRideGuard(ctx, 'D08'); if (r) UI.bind('title', 'Picking up ' + D.RIDER.short.split(' ')[0]); },
    actions: { arrive: function (n) { return exec('ride.arrive', {}, n).then(function (r) { if (r.ok && !r.queued) UI.go('D09'); return r; }); } } });
  def('D09', {
    init: function () { UI.toast('Ask the rider for the 4-digit code (demo: ' + D.DEMO_CODES.tripOtp + ').', 'info'); var i = UI.q('#mock .rn-otp-input'); if (i) { i.value = ''; i.dispatchEvent(new Event('input')); } },
    update: function (ctx) { personaRideGuard(ctx, 'D09'); },
    tick: function (ctx) { var r = ctx.engine.activeRide(); if (r && r.arrivedAt) { var s = Math.floor((Date.now() - r.arrivedAt) / 1000); UI.bind('waiting', 'Waiting ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')); } },
    actions: { startTrip: function (n) {
      UI.clearErrors();
      var code = UI.q('#mock .rn-otp-input').value;
      if (code.length !== 4) { UI.fieldError('tripOtp', 'Enter the 4-digit code.'); return { ok: false }; }
      return exec('ride.start', { otp: code }, n).then(function (r) { if (r.ok && !r.queued) UI.go('D10'); else if (!r.ok) UI.fieldError('tripOtp', r.error); return r; });
    } } });
  def('D10', { update: function (ctx) { personaRideGuard(ctx, 'D10'); },
    actions: { endTrip: function (n) {
      return UI.confirm('End the trip at Hitec City Metro Station?', 'End trip').then(function (y) {
        if (!y) return { ok: false };
        return exec('ride.end', {}, n).then(function (r) { if (r.ok && r.queued) UI.toast('No connection: trip end saved on this phone and will sync (see D19).', 'warn'); else if (r.ok) UI.go('D11'); return r; });
      });
    } } });
  def('D11', { update: function (ctx) {
    var r = ctx.engine.lastRide();
    if (!r || r.driverId !== ctx.engine.state.persona) { UI.state('No completed trip', [], [navButton('Online', 'D06', true)]); return; }
    if (r.state === 'PAYMENT_PENDING' && r.payment.method === 'Cash') UI.state('Collect ' + rupees(r.finalPaise) + ' in cash', [], [{ label: 'Cash collected', primary: true, onClick: function (b) { exec('payment.cashCollected', {}, b); } }], 'warn');
    else if (r.state === 'PAYMENT_PENDING' || r.state === 'TRIP_COMPLETED') UI.state('Rider payment pending', ['Gateway confirmation expected shortly (simulated).'], null, 'info');
    else if (r.state === 'PAYMENT_FAILED') UI.state('Rider payment failed', ['The rider must pay another way. Your earning is credited when it is settled (assumption – policy not final).'], null, 'warn');
    else UI.state(null);
  } });
  def('D12', { actions: { rateRider: function (n) { return exec('ride.rate', { stars: 5, tags: UI.qa('#mock .chip.on').map(function (c) { return c.textContent; }) }, n).then(function (r) { if (r.ok || r.code === 'already_rated' || r.code === 'not_completed') UI.go('D06'); return r; }); } } });
  def('D17', {
    update: function (ctx) { var d = ctx.engine.persona(); UI.state(d.docsValid ? 'All documents valid in this demo' : 'PUC expired – going online is blocked', d.docsValid ? ['Use the button below to simulate an expired PUC.'] : [], d.docsValid ? [{ label: 'Simulate expired PUC', onClick: function (b) { exec('driver.expireDoc', { expired: true }, b); } }] : [], d.docsValid ? 'info' : 'err'); },
    actions: { renewDoc: function (n) { return exec('driver.expireDoc', { expired: false }, n).then(function (r) { if (r.ok) { UI.toast('New PUC uploaded and approved (simulated).', 'sim'); UI.go('D05'); } return r; }); } } });
  def('D18', { actions: { driverSos: function (n) {
    return exec('sos.raise', {}, n, { instant: true }).then(function (r) { if (r.ok && !r.queued) UI.toast('Driver SOS ' + r.incidentId + ' sent to the safety team (simulated).', 'warn'); return r; });
  } } });
  def('D19', {
    update: function (ctx, s) {
      var q = s.queue.filter(function (x) { return x.actor === 'driver'; });
      var off = s.net.driver === 'offline';
      UI.state(off ? 'Offline · ' + q.length + ' action(s) saved on this phone' : q.length ? q.length + ' action(s) to sync' : 'Everything is synced',
        q.map(function (x) { return x.cmd + ' at ' + UI.fmtTime(x.at); }),
        [{ label: off ? 'Network is back' : 'Simulate losing network', primary: !off, onClick: function (b) {
          exec('demo.network', { app: 'driver', mode: off ? 'online' : 'offline' }, b, { actor: 'system', instant: true }).then(function (r) { if (r.ok && r.replayed) UI.toast(r.replayed + ' saved action(s) synced.', 'info'); });
        } }], off ? 'warn' : 'ok');
    },
    init: function (ctx) { S.D19.update(ctx, ctx.engine.state); },
    actions: { sync: function (n, a, ctx) {
      if (ctx.engine.state.net.driver === 'offline') { UI.toast('Still offline. Switch “This device” to Online in the demo bar to reconnect.', 'warn'); return { ok: false }; }
      UI.toast('Up to date.', 'info');
    } } });

  // deliveries
  def('D22', {
    update: function (ctx) {
      var o = ctx.engine.order();
      if (!o || !o.courier || o.courier.state !== 'PENDING') {
        if (o && o.courier && o.courier.state === 'ACCEPTED' && o.state !== 'DELIVERED') { follow(ctx, 'D23'); return; }
        UI.state('No delivery job right now', ['Place a food order on R45 (scenario H).'], [navButton('Online', 'D06', true), loadScenarioButton('H')]);
        UI.qa('#mock button[data-do]').forEach(function (b) { b.disabled = true; });
        return;
      }
      UI.qa('#mock button[data-do]').forEach(function (b) { b.disabled = false; });
      UI.state('Order #' + o.id + ' · ' + o.restaurant, ['For ' + D.DRIVERS[o.courier.id].short + ' · restaurant status ' + o.state], null, 'info');
    },
    actions: {
      acceptDelivery: function (n) { return exec('delivery.accept', {}, n).then(function (r) { if (r.ok) UI.go('D23'); return r; }); },
      declineDelivery: function (n) { return exec('delivery.decline', {}, n).then(function (r) { if (r.ok) { UI.toast('Declined. The job goes to another partner.', 'info'); UI.go('D06'); } return r; }); }
    } });
  def('D23', { update: function (ctx) {
    var o = ctx.engine.order();
    if (!o || !o.courier || o.courier.state !== 'ACCEPTED') { UI.state('No accepted delivery', [], [navButton('Online', 'D06', true)]); return; }
    var head = find('b', 'Order #'); if (head) text(head, 'Order #' + o.id + ' · ' + o.restaurant);
    if (o.state === 'DELIVERED') { UI.state('Delivered · order #' + o.id, ['Payment split recorded (simulated).'], [navButton('Back online', 'D06', true)], 'ok'); return; }
    var btns = [];
    if (o.state !== 'PICKED_UP') {
      if (!o.sealPhoto) btns.push({ label: 'Take sealed-bag photo', primary: true, onClick: function (b) { exec('order.sealPhoto', {}, b).then(function (r) { if (r.ok) UI.toast('Photo taken (simulated camera).', 'sim'); }); } });
      btns.push({ label: 'Confirm pickup', primary: !!o.sealPhoto, onClick: function (b) { exec('order.pickup', {}, b); } });
    } else {
      btns.push({ label: 'Enter customer code', primary: true, onClick: function (b) { UI.prompt('Ask the customer for the 4-digit code (demo: ' + D.DEMO_CODES.foodOtp + ').', 'Delivery code', '').then(function (code) { if (code != null) exec('order.deliver', { otp: code }, b); }); } });
    }
    UI.state('Order #' + o.id + ' · ' + o.state, [o.state === 'PREPARING' ? 'Food not ready yet – wait at the restaurant.' : o.sealPhoto ? 'Sealed-bag photo taken.' : 'Photo of the sealed bag is required.'], btns, 'info');
  } });

  def('D16', { update: function (ctx, s) { prependLive('.list', liveRideRows(s, true)); } });
  // ================================================================== driver: call rider
  var callStart = 0;
  def('D29', {
    init: function (ctx) {
      var r = ctx.engine.activeRide();
      var ok = r && r.driverId === ctx.engine.state.persona && ['DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_IN_PROGRESS'].indexOf(r.state) >= 0;
      callStart = Date.now();
      UI.toast(ok ? 'Masked call to the rider (simulated – no audio, no real numbers).' : 'Masked calling works only while you have an assigned ride.', ok ? 'sim' : 'warn');
    },
    tick: function () {
      var t = qa('#mock div').filter(function (d) { return /^\d\d:\d\d$/.test(d.textContent.trim()) && !d.children.length; })[0];
      var sec = Math.floor((Date.now() - callStart) / 1000);
      if (t) t.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }
  });

})();
