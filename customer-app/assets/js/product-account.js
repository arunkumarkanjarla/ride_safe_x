/* RideNova Customer app - account, wallet, trips, notifications, offers (working screens).
   R28 account, R24 emergency contacts, R21 wallet, R54 trips & tickets, R62 booking detail, R56 notifications,
   R20 ride history, R22 offers & coupons, R49 deals & savings, R53 language/currency, R25 identity check. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.store, P = RN.product, h = P.h, ic = P.ic, rs = P.rs;
  var exec = K.exec;

  // ------------------------------------------------------------ coupons
  var COUPONS = [
    { code: 'RIDE50', title: '50% off your next 2 rides', sub: 'Up to \u20B9100 per ride \u00B7 cabs, autos and bikes', cat: 'ride', pct: 50, cap: 10000, min: 0, tone: 'brand' },
    { code: 'BIRYANI40', title: '40% off biryani orders', sub: 'Up to \u20B980 \u00B7 minimum \u20B9199', cat: 'food', pct: 40, cap: 8000, min: 19900, tone: 'amber' },
    { code: 'FIRST75', title: '\u20B975 off your first food order', sub: 'Orders above \u20B9299', cat: 'food', flat: 7500, min: 29900, tone: 'amber' },
    { code: 'STAY15', title: '15% off hotels', sub: 'Up to \u20B9600 \u00B7 stays of 1 night or more', cat: 'hotel', pct: 15, cap: 60000, min: 0, tone: 'blue' },
    { code: 'GOBUS10', title: '10% off bus tickets', sub: 'Up to \u20B9120 \u00B7 all operators', cat: 'bus', pct: 10, cap: 12000, min: 0, tone: 'blue' },
    { code: 'SHARE40', title: '40% off shared seats', sub: 'Long-distance shared cabs only', cat: 'share', pct: 40, cap: 40000, min: 0, tone: 'brand' },
    { code: 'SENDIT20', title: '\u20B920 off parcels', sub: 'Any parcel above \u20B9100', cat: 'parcel', flat: 2000, min: 10000, tone: 'amber' },
    { code: 'ROAD10', title: '10% off rentals', sub: 'Up to \u20B9300 \u00B7 scooters, bikes and cars', cat: 'rental', pct: 10, cap: 30000, min: 0, tone: 'blue' }
  ];
  P.COUPONS = COUPONS;
  P.coupon = function (code) { return COUPONS.filter(function (c) { return c.code === String(code || '').toUpperCase(); })[0] || null; };
  // discount for the coupon the customer applied, if it fits this category; returns {paise, code}
  P.discount = function (cat, amountPaise) {
    var u = S.user(), c = u && u.coupon && P.coupon(u.coupon);
    if (!c) return { paise: 0, code: '', why: '' };
    if (c.cat !== cat && !(c.cat === 'ride' && cat === 'quick')) return { paise: 0, code: c.code, why: c.code + ' is for ' + c.cat + ' only' };
    if (amountPaise < c.min) return { paise: 0, code: c.code, why: c.code + ' needs at least ' + rs(c.min) };
    var d = c.flat ? c.flat : Math.min(c.cap, Math.round(amountPaise * c.pct / 100));
    return { paise: Math.min(d, amountPaise), code: c.code, why: '' };
  };
  P.useCoupon = function (paise) { var u = S.user(); if (!u || !paise) return; u.savedPaise += paise; S.save(); };

  // ------------------------------------------------------------ bookings helpers
  P.statusOf = function (b) {
    var o = b.orderId && UI.engine && UI.engine.state.orders[b.orderId];
    if (o && b.orderKey === o.placedAt) return { DELIVERED: 'Delivered', REJECTED: 'Cancelled', CANCELLED: 'Cancelled' }[o.state] || K.label(o.state);
    if (b.type === 'parcel' && P.parcelStage && b.status !== 'Cancelled') return P.parcelLabel(b);
    if (b.status === 'Confirmed' && b.when && b.when < Date.now() - 3600000) return 'Completed';
    return b.status;
  };
  P.isUpcoming = function (b) {
    var st = P.statusOf(b);
    if (b.type === 'ride') return false;
    if (/Cancelled|Delivered|Completed|Expired/.test(st)) return false;
    return true;
  };
  P.refundPct = function (b) {
    if (!b.when) return 100; var left = b.when - Date.now();
    if (b.type === 'scheduled') return left > 15 * 60000 ? 100 : 0;
    return left >= 86400000 ? 100 : left >= 7200000 ? 50 : 0;
  };
  P.cancelBooking = function (b) {
    var pct = P.refundPct(b), refund = Math.round(b.paise * pct / 100);
    return UI.confirm('Cancel ' + b.title + '? ' + (b.paise ? (pct ? 'You get ' + rs(refund) + ' back in your wallet (' + pct + '%).' : 'It is too close to the start time for a refund.') : 'This is free.'), 'Cancel booking').then(function (yes) {
      if (!yes) return false;
      b.status = 'Cancelled'; b.cancelledAt = Date.now();
      if (refund) { S.credit(S.user(), refund, 'Refund: ' + b.title, 'Refund'); P.applyUser(S.user()); }
      S.save(); S.notify(S.user(), 'Booking cancelled', b.title + (refund ? ' \u00B7 ' + rs(refund) + ' refunded to wallet' : ''), 'Orders');
      UI.toast(refund ? 'Cancelled. ' + rs(refund) + ' refunded to your wallet.' : 'Booking cancelled.', 'info'); return true;
    });
  };

  // ------------------------------------------------------------ engine mirror: rides and food orders -> store
  var lastSeq = null, rec = {};
  var EVMAP = {
    'ride.offer.accepted': ['Driver assigned', 'Rides'], 'ride.driver.arrived': ['Your driver has arrived', 'Rides'], 'ride.trip.end': ['Trip completed', 'Rides'],
    'ride.payment.failed': ['Payment failed - pay another way', 'Rides'], 'payment.captured': ['Payment received', 'Rides'], 'ride.ride.cancel': ['Ride cancelled', 'Rides'],
    'ride.search.exhausted': ['No driver found', 'Rides'], 'order.placed': ['Order placed', 'Orders'], 'order.accept': ['Restaurant accepted your order', 'Orders'],
    'order.pickup': ['Order picked up', 'Orders'], 'order.deliver': ['Order delivered', 'Orders'], 'refund.issued': ['Refund issued', 'Orders'],
    'ticket.created': ['Support ticket created', 'Support'], 'ticket.resolve': ['Ticket resolved', 'Support']
  };
  function mirror(s) {
    var u = S.user(); if (!u) return;
    if (lastSeq == null) lastSeq = s.seq;
    s.events.forEach(function (ev) {
      if (ev.seq <= lastSeq) return;
      var m = EVMAP[ev.type] || (ev.type === 'ticket.message' && ev.actor === 'agent' ? ['New reply on your ticket', 'Support'] : null);
      if (m) S.notify(u, m[0], ev.note || '', m[1], m[1] === 'Orders' ? 'R46' : '');
    });
    lastSeq = s.seq;
    s.rideOrder.forEach(function (id) {
      var r = s.rides[id], key = id + '@' + r.requestedAt; if (rec[key]) return;
      var done = r.state === 'PAYMENT_COMPLETED' || r.state === 'CLOSED', canc = r.state === 'CANCELLED';
      if (!done && !canc) return;
      rec[key] = 1;
      var fee = canc && r.cancel && r.cancel.feePaise || 0, amount = canc ? fee : r.finalPaise;
      var pay = r.payment.method;
      if (done && pay === 'Wallet') { if (S.debit(u, amount, 'Ride to ' + r.drop, 'Payment')) P.applyUser(u); else pay = 'Wallet (low balance, settled by UPI)'; }
      if (canc && fee && pay === 'Wallet') { S.debit(u, fee, 'Cancellation fee', 'Fee'); P.applyUser(u); }
      var d = r.driverId && D.DRIVERS[r.driverId];
      S.addBooking({ type: 'ride', rideKey: key, rideId: r.id, title: String(r.pickupArea || 'Banjara Hills').split(',')[0] + ' \u2192 ' + r.drop, sub: r.vehicle + ' \u00B7 ' + r.km + ' km \u00B7 ' + pay, paise: amount, status: done ? 'Completed' : 'Cancelled', when: r.endedAt || r.requestedAt, pay: pay,
        details: [['Ride', r.id], ['Vehicle', r.vehicle], ['Driver', d ? d.name + ' \u00B7 ' + d.vehicle + ' \u00B7 ' + d.plate : '-'], ['Distance', r.km + ' km \u00B7 ' + r.mins + ' min'], ['Paid with', pay]], fare: r.fare, coupon: r.couponCode || '' });
    });
    s.orderOrder.forEach(function (id) {
      var o = s.orders[id];
      u.bookings.forEach(function (b) {
        if (b.orderId !== id || b.orderKey !== o.placedAt) return;
        if ((o.state === 'REJECTED' || o.state === 'CANCELLED') && !b.refunded) {
          b.refunded = true; b.status = 'Cancelled';
          if (b.payMethod && b.payMethod !== 'Cash') { S.credit(u, b.paise, 'Refund: ' + b.title, 'Refund'); P.applyUser(u); }
          S.save();
        }
        if (o.state === 'DELIVERED' && b.status !== 'Delivered') { b.status = 'Delivered'; b.when = Date.now(); S.save(); }
      });
    });
  }
  var poll = setInterval(function () { if (UI.engine) { clearInterval(poll); UI.engine.subscribe(mirror); } }, 200);

  // ------------------------------------------------------------ R28 account
  var ID_STATE = { none: ['Not verified', 'warn'], review: ['In review', 'info'], verified: ['Verified', 'ok'] };
  P.screen('R28', {
    title: 'Account & settings', nav: 'account',
    build: function (body, v) {
      var u = S.user(), rides = u.bookings.filter(function (b) { return b.type === 'ride' && b.status === 'Completed'; }).length;
      body.appendChild(h('div', { class: 'card-m p-profile' }, [h('div', { class: 'p-hello' }, [P.avatar(u, 'lg'), h('div', { class: 'x-flex-1 p-left' }, [h('b', { class: 'h2' }, u.name), h('div', { class: 'sub' }, S.pretty(u.phone)), u.email ? h('div', { class: 'xs' }, u.email) : null])]),
        h('div', { class: 'row2 p-stats' }, [h('div', { class: 'center' }, [h('b', null, String(rides)), h('span', { class: 'xs' }, 'Rides')]), h('div', { class: 'center' }, [h('b', null, rs(u.walletPaise)), h('span', { class: 'xs' }, 'Wallet')]), h('div', { class: 'center' }, [h('b', null, String(new Date(u.createdAt).getFullYear())), h('span', { class: 'xs' }, 'Member since')])]),
        P.btn('Edit profile', 'soft sm', function () { P.nav.editProfile = true; UI.go('R05'); })]));
      var idt = ID_STATE[u.kyc.state] || ID_STATE.none;
      body.appendChild(P.sec('ACCOUNT'));
      body.appendChild(P.list([
        P.row({ icon: 'pin', tone: 'brand', title: 'Saved places', sub: (u.saved.home ? 'Home' : 'Add home') + (u.saved.work ? ', Work' : '') + (u.saved.other.length ? ' +' + u.saved.other.length : ''), chev: true, onClick: function () { savedPlaces(v); } }),
        P.row({ icon: 'wallet', title: 'Payment methods', sub: 'Wallet ' + rs(u.walletPaise) + (u.methods && u.methods.length ? ' \u00B7 ' + u.methods.length + ' saved' : ''), chev: true, go: 'R21' }),
        P.row({ icon: 'shield', title: 'Safety & emergency contacts', sub: u.emergency.length ? u.emergency.length + ' contact' + (u.emergency.length > 1 ? 's' : '') : 'None added yet', right: u.emergency.length ? '' : 'Add', rightKind: 'warn', chev: true, go: 'R24' }),
        P.row({ icon: 'idcard', title: 'Verify identity', sub: 'Extra trust for long trips and rentals', right: idt[0], rightKind: idt[1], go: 'R25' })]));
      body.appendChild(P.sec('PREFERENCES'));
      body.appendChild(P.list([
        P.row({ icon: 'globe', title: 'Language & region', sub: S.db.lang + ' \u00B7 ' + S.db.currency, chev: true, go: 'R53' }),
        P.row({ icon: 'bell', title: 'Notifications', sub: 'Choose what we tell you about', chev: true, onClick: function () { notifPrefs(); } }),
        P.row({ icon: 'lock', title: 'Privacy & data', sub: 'Download your data or delete your account', chev: true, onClick: function () { privacy(v); } })]));
      body.appendChild(P.sec('SUPPORT'));
      body.appendChild(P.list([P.row({ icon: 'help', title: 'Help & support', sub: 'Chat, tickets, FAQs', chev: true, go: 'R26' }), P.row({ icon: 'logout', tone: 'red', title: 'Log out', sub: 'You can sign back in with your number', onClick: logout })]));
      body.appendChild(h('div', { class: 'xs p-foot' }, 'RideNova customer app \u00B7 prototype build \u00B7 data kept on this device only'));
    },
    update: function () {}
  });
  function logout() {
    UI.confirm('Log out of RideNova on this device?', 'Log out').then(function (yes) {
      if (!yes) return;
      exec('auth.signOut', {}, null, { actor: 'rider' }).then(function () { S.signOut(); UI.stack = []; UI.toast('Logged out. See you soon.', 'info'); UI.go('R58', { replace: true }); });
    });
  }
  function savedPlaces(v) {
    var u = S.user();
    P.sheet('Saved places', function (body, api) {
      body.appendChild(P.field({ name: 'home', label: 'Home', value: u.saved.home ? u.saved.home.area : '', maxlength: 60, placeholder: 'e.g. Road 12, Banjara Hills' }));
      body.appendChild(P.field({ name: 'work', label: 'Work', value: u.saved.work ? u.saved.work.area : '', maxlength: 60, placeholder: 'e.g. Hitec City, Madhapur' }));
      var others = h('div', { class: 'list' });
      function drawOthers() {
        P.clear(others);
        u.saved.other.forEach(function (o, i) { others.appendChild(P.row({ icon: 'pin', title: o.name, sub: o.area, trail: h('button', { type: 'button', class: 'ib', 'aria-label': 'Remove ' + o.name, on: { click: function (e) { e.stopPropagation(); u.saved.other.splice(i, 1); S.save(); drawOthers(); } } }, ic('trash', 16)) })); });
        others.hidden = !u.saved.other.length;
      }
      drawOthers(); body.appendChild(others);
      body.appendChild(h('div', { class: 'row2' }, [P.field({ name: 'pname', label: 'Other place name', maxlength: 20, placeholder: 'Gym' }), P.field({ name: 'parea', label: 'Address', maxlength: 60, placeholder: 'Area, city' })]));
      body.appendChild(P.btn('Save places', '', function () {
        P.clearErrors(); var hm = UI.val('home').trim(), wk = UI.val('work').trim(), pn = UI.val('pname').trim(), pa = UI.val('parea').trim();
        if ((pn && !pa) || (!pn && pa)) { UI.fieldError(pn ? 'parea' : 'pname', 'Enter both a name and an address, or leave both empty.'); return; }
        if (pn && u.saved.other.length >= 5) { UI.fieldError('pname', 'You can save up to 5 other places.'); return; }
        u.saved.home = hm ? { name: 'Home', area: hm } : null; u.saved.work = wk ? { name: 'Work', area: wk } : null;
        if (pn) u.saved.other.push({ name: pn, area: pa });
        S.save(); api.close(); UI.toast('Saved places updated.', 'info'); v.draw();
      }));
    });
  }
  function notifPrefs() {
    var u = S.user(), items = [['rides', 'Ride and trip updates', 'Driver arrival, trip status'], ['food', 'Food and parcel updates', 'Order and delivery status'], ['offers', 'Offers and coupons', 'Deals picked for you'], ['safety', 'Safety alerts', 'Always recommended'], ['sms', 'SMS fallback', 'When the app has no data']];
    P.sheet('Notifications', function (body, api) {
      var list = h('div', { class: 'list' });
      items.forEach(function (it) { list.appendChild(P.row({ title: it[1], sub: it[2], trail: P.toggle(u.prefs[it[0]], function (on) { u.prefs[it[0]] = on; S.save(); UI.toast(it[1] + (on ? ' on' : ' off'), 'info'); }, it[1]) })); });
      body.appendChild(list); body.appendChild(P.btn('Done', 'soft', api.close));
    });
  }
  function privacy(v) {
    var u = S.user();
    P.sheet('Privacy & data', function (body, api) {
      body.appendChild(h('div', { class: 'sub' }, 'Your profile, wallet and bookings are stored only in this browser (localStorage). Nothing is sent anywhere.'));
      body.appendChild(P.btn('Download my data (JSON)', 'soft', function () {
        try {
          var data = JSON.stringify(Object.assign({}, u, { photo: u.photo ? '[photo omitted]' : '' }), null, 2), blob = new Blob([data], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(blob), download: 'ridenova-my-data.json' });
          document.body.appendChild(a); a.click(); a.remove(); UI.toast('Your data was downloaded.', 'info');
        } catch (e) { UI.toast('Download is not available in this browser.', 'error'); }
      }));
      body.appendChild(P.btn('Delete my account', 'danger', function () {
        UI.confirm('Delete your account, wallet balance (' + rs(u.walletPaise) + ') and all bookings from this device? This cannot be undone.', 'Delete everything').then(function (yes) {
          if (!yes) return; api.close();
          exec('auth.signOut', {}, null, { actor: 'rider' }).then(function () { S.remove(u.phone); UI.stack = []; UI.toast('Account deleted from this device.', 'info'); UI.go('R58', { replace: true }); });
        });
      }));
    });
  }

  // ------------------------------------------------------------ R24 emergency contacts
  P.screen('R24', {
    title: 'Emergency contacts', back: 'R28',
    build: function (body, v) {
      var u = S.user();
      body.appendChild(P.banner('info', 'These people get your live trip link when you press SOS or share a trip. Up to 5 contacts.', 'shield'));
      var list = h('div', { class: 'list' });
      if (!u.emergency.length) body.appendChild(P.empty('No emergency contacts yet. Add someone you trust.', 'users'));
      u.emergency.forEach(function (c, i) {
        list.appendChild(h('div', { class: 'li p-contact' }, [h('span', { class: 'ic brand' }, S.initials(c.name)), h('span', { class: 'tx' }, [h('b', null, c.name), h('span', null, c.relation + ' \u00B7 +91 ' + c.phone.slice(0, 5) + ' ' + c.phone.slice(5))]),
          h('span', { class: 'p-actions' }, [P.toggle(c.share, function (on) { c.share = on; S.save(); UI.toast(on ? c.name + ' will get your live trip.' : c.name + ' will not get trip links.', 'info'); }, 'Share trips with ' + c.name),
            h('button', { type: 'button', class: 'ib', 'aria-label': 'Edit ' + c.name, on: { click: function () { form(c); } } }, ic('edit', 15)),
            h('button', { type: 'button', class: 'ib', 'aria-label': 'Delete ' + c.name, on: { click: function () { UI.confirm('Remove ' + c.name + ' from your emergency contacts?', 'Remove').then(function (y) { if (!y) return; u.emergency.splice(i, 1); S.save(); P.applyUser(u); UI.toast(c.name + ' removed.', 'info'); v.draw(); }); } } }, ic('trash', 15))])]));
      });
      if (u.emergency.length) body.appendChild(list);
      body.appendChild(P.btn(u.emergency.length >= 5 ? 'Contact limit reached (5)' : 'Add contact', u.emergency.length >= 5 ? 'ghost' : '', function () { if (u.emergency.length >= 5) { UI.toast('You can add up to 5 contacts. Remove one first.', 'warn'); return; } form(null); }));
      if (u.emergency.length) body.appendChild(P.btn('Send a test alert', 'ghost', function () { UI.toast('Test message sent to ' + u.emergency.filter(function (c) { return c.share; }).map(function (c) { return c.name; }).join(', ') + ' (simulated - nobody is contacted).', 'sim'); }));
      body.appendChild(P.btn('Call 112 (emergency services)', 'danger sm', function () { UI.toast('Dialling 112 (simulated). In a real emergency call 112 from your phone.', 'warn'); }));
      function form(c) {
        P.sheet(c ? 'Edit contact' : 'Add emergency contact', function (b, api) {
          b.appendChild(P.field({ name: 'cname', label: 'Name *', value: c ? c.name : '', maxlength: 40 }));
          b.appendChild(P.field({ name: 'cphone', label: 'Mobile number *', type: 'tel', inputmode: 'numeric', value: c ? c.phone : '', maxlength: 12, placeholder: '10-digit number' }));
          b.appendChild(P.field({ name: 'crel', label: 'Relation', select: P.RELATIONS, value: c ? c.relation : 'Friend' }));
          b.appendChild(P.btn(c ? 'Save contact' : 'Add contact', '', function () {
            P.clearErrors(); var nm = UI.val('cname').trim(), ph = S.digits(UI.val('cphone')), bad = false;
            if (nm.length < 2) { UI.fieldError('cname', 'Enter the contact\'s name.'); bad = true; }
            if (!S.validPhone(ph)) { UI.fieldError('cphone', 'Enter a valid 10-digit mobile number.'); bad = true; }
            else if (ph === u.phone) { UI.fieldError('cphone', 'This is your own number.'); bad = true; }
            else if (u.emergency.some(function (x) { return x !== c && x.phone === ph; })) { UI.fieldError('cphone', 'This number is already in your list.'); bad = true; }
            if (bad) return;
            if (c) { c.name = nm; c.phone = ph; c.relation = UI.val('crel'); } else u.emergency.push({ id: S.uid('EC'), name: nm, phone: ph, relation: UI.val('crel'), share: true });
            S.save(); P.applyUser(u); api.close(); UI.toast(c ? 'Contact updated.' : nm + ' added as an emergency contact.', 'info'); v.draw();
          }));
        });
      }
    }
  });

  // ------------------------------------------------------------ R21 wallet
  function luhn(n) { var s = 0, alt = false; for (var i = n.length - 1; i >= 0; i--) { var d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
  P.screen('R21', {
    title: 'Wallet', nav: 'wallet',
    reset: function (v) { v.filter = 'All'; },
    build: function (body, v) {
      var u = S.user();
      body.appendChild(h('div', { class: 'card-m brand p-wallet' }, [h('span', { class: 'xs' }, 'RideNova wallet balance'), h('b', { class: 'big-num p-bal' }, rs(u.walletPaise)), h('div', { class: 'row2' }, [P.btn('Add money', 'amber sm', function () { addMoney(v); }), P.btn('History', 'ghost sm', function () { var t = UI.q('.p-txns', v.body); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); })])]));
      body.appendChild(P.sec('PAYMENT METHODS'));
      var ml = h('div', { class: 'list' });
      ml.appendChild(P.row({ icon: 'wallet', tone: 'brand', title: 'Wallet', sub: rs(u.walletPaise) + ' available', right: 'Default', rightKind: 'ok' }));
      (u.methods || []).forEach(function (m, i) { ml.appendChild(P.row({ icon: m.type === 'upi' ? 'bolt' : 'card', title: m.type === 'upi' ? 'UPI \u00B7 ' + m.value : m.brand + ' \u00B7\u00B7\u00B7\u00B7 ' + m.last4, sub: m.type === 'upi' ? 'Linked UPI ID' : m.name + ' \u00B7 expires ' + m.exp, trail: h('button', { type: 'button', class: 'ib', 'aria-label': 'Remove', on: { click: function (e) { e.stopPropagation(); u.methods.splice(i, 1); S.save(); v.draw(); UI.toast('Payment method removed.', 'info'); } } }, ic('trash', 15)) })); });
      ml.appendChild(P.row({ icon: 'plus', title: 'Add card or UPI ID', sub: 'Saved on this device only (demo)', chev: true, onClick: function () { addMethod(v); } }));
      body.appendChild(ml);
      body.appendChild(P.sec('TRANSACTIONS'));
      body.appendChild(P.chips(['All', 'Credits', 'Payments'], v.filter, function (f) { v.filter = f; drawTx(); }));
      var tx = h('div', { class: 'list p-txns' }); body.appendChild(tx);
      function drawTx() {
        P.clear(tx);
        var rows = u.txns.filter(function (t) { return v.filter === 'All' || (v.filter === 'Credits' ? t.paise > 0 : t.paise < 0); });
        if (!rows.length) { tx.appendChild(P.empty('No transactions here yet.', 'wallet')); return; }
        rows.slice(0, 40).forEach(function (t) { tx.appendChild(P.row({ icon: t.paise > 0 ? 'plus' : 'minus', tone: t.paise > 0 ? 'brand' : '', title: t.title, sub: P.fdt(t.at) + ' \u00B7 ' + t.kind, right: (t.paise > 0 ? '+' : '') + rs(t.paise), rightKind: t.paise > 0 ? 'ok' : '' })); });
      }
      drawTx();
    },
    update: function (v) { var b = UI.q('.p-bal', v.body); var u = S.user(); if (b && u && b.textContent !== rs(u.walletPaise)) b.textContent = rs(u.walletPaise); }
  });
  function addMoney(v) {
    var u = S.user(), method = 'UPI';
    P.sheet('Add money', function (body, api) {
      var amt = P.field({ name: 'amount', label: 'Amount (\u20B910 - \u20B920,000)', type: 'tel', inputmode: 'numeric', prefix: P.RUP, maxlength: 5, placeholder: '500' });
      body.appendChild(amt);
      body.appendChild(P.chips([['100', '\u20B9100'], ['200', '\u20B9200'], ['500', '\u20B9500'], ['1000', '\u20B91,000']], '', function (x) { amt.input.value = x; P.clearErrors(); }));
      body.appendChild(h('div', { class: 'inp' }, [h('label', null, 'Pay with'), P.chips(['UPI', 'Card'], 'UPI', function (m) { method = m; })]));
      var go = P.btn('Add money', '', function () {
        P.clearErrors(); var raw = UI.val('amount').replace(/[^\d]/g, ''), n = parseInt(raw, 10);
        if (!raw) { UI.fieldError('amount', 'Enter an amount.'); return; }
        if (n < 10) { UI.fieldError('amount', 'The minimum top-up is \u20B910.'); return; }
        if (n > 20000) { UI.fieldError('amount', 'The maximum per top-up is \u20B920,000.'); return; }
        if (u.walletPaise + n * 100 > 5000000) { UI.fieldError('amount', 'Wallet balance cannot exceed \u20B950,000.'); return; }
        go.disabled = true; go.textContent = 'Contacting ' + method + ' (simulated)...';
        setTimeout(function () { S.credit(u, n * 100, 'Added via ' + method, 'Top-up'); P.applyUser(u); S.notify(u, 'Wallet topped up', rs(n * 100) + ' added via ' + method + '. Balance ' + rs(u.walletPaise), 'Updates'); api.close(); UI.toast(rs(n * 100) + ' added to your wallet.', 'info'); v.draw(); }, 1000);
      });
      body.appendChild(go);
    });
  }
  function addMethod(v) {
    var u = S.user(), type = 'UPI';
    P.sheet('Add payment method', function (body, api) {
      var upiBox = h('div', null, P.field({ name: 'upi', label: 'UPI ID', placeholder: 'name@bank', maxlength: 50 }));
      var cardBox = h('div', { class: 'p-form', hidden: true }, [P.field({ name: 'cardno', label: 'Card number', inputmode: 'numeric', maxlength: 19, placeholder: '16 digits' }), P.field({ name: 'cardname', label: 'Name on card', maxlength: 40 }), h('div', { class: 'row2' }, [P.field({ name: 'cardexp', label: 'Expiry (MM/YY)', maxlength: 5, placeholder: 'MM/YY' }), P.field({ name: 'cardcvv', label: 'CVV', type: 'password', inputmode: 'numeric', maxlength: 3, placeholder: '123' })])]);
      body.appendChild(P.chips(['UPI', 'Card'], 'UPI', function (t) { type = t; upiBox.hidden = t !== 'UPI'; cardBox.hidden = t === 'UPI'; P.clearErrors(); }));
      body.appendChild(upiBox); body.appendChild(cardBox);
      body.appendChild(h('div', { class: 'xs' }, 'Demo only: details are kept on this device and no payment is made.'));
      body.appendChild(P.btn('Save', '', function () {
        P.clearErrors(); u.methods = u.methods || [];
        if (type === 'UPI') {
          var id = UI.val('upi').trim().toLowerCase();
          if (!/^[a-z0-9.\-_]{2,}@[a-z]{2,}$/.test(id)) { UI.fieldError('upi', 'Enter a valid UPI ID like name@bank.'); return; }
          if (u.methods.some(function (m) { return m.value === id; })) { UI.fieldError('upi', 'This UPI ID is already saved.'); return; }
          u.methods.push({ type: 'upi', value: id });
        } else {
          var no = UI.val('cardno').replace(/\D/g, ''), nm = UI.val('cardname').trim(), ex = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(UI.val('cardexp').trim()), bad = false;
          if (no.length !== 16 || !luhn(no)) { UI.fieldError('cardno', 'Enter a valid 16-digit card number (try 4111 1111 1111 1111).'); bad = true; }
          if (nm.length < 2) { UI.fieldError('cardname', 'Enter the name on the card.'); bad = true; }
          if (!ex || (2000 + +ex[2]) * 12 + +ex[1] < new Date().getFullYear() * 12 + new Date().getMonth() + 1) { UI.fieldError('cardexp', ex ? 'This card has expired.' : 'Use the format MM/YY.'); bad = true; }
          if (!/^\d{3}$/.test(UI.val('cardcvv'))) { UI.fieldError('cardcvv', 'CVV is 3 digits.'); bad = true; }
          if (bad) return;
          u.methods.push({ type: 'card', brand: no[0] === '4' ? 'Visa' : no[0] === '5' ? 'Mastercard' : 'Card', last4: no.slice(-4), name: nm, exp: UI.val('cardexp').trim() });
        }
        S.save(); api.close(); UI.toast('Payment method saved.', 'info'); v.draw();
      }));
    });
  }

  // ------------------------------------------------------------ R54 trips & tickets, R62 booking detail
  P.screen('R54', {
    title: 'Trips & tickets', nav: 'trips', reset: function (v) { v.tab = P.nav.tripTab || 'Upcoming'; P.nav.tripTab = null; },
    build: function (body, v) {
      var u = S.user();
      body.appendChild(P.chips(['Upcoming', 'Past'], v.tab, function (t) { v.tab = t; drawList(); }));
      var list = h('div', { class: 'list' }); body.appendChild(list);
      var empty = h('div'); body.appendChild(empty);
      function drawList() {
        P.clear(list); P.clear(empty);
        var rows = u.bookings.filter(function (b) { return v.tab === 'Upcoming' ? P.isUpcoming(b) : !P.isUpcoming(b); });
        rows.sort(function (a, b) { return v.tab === 'Upcoming' ? (a.when || a.createdAt) - (b.when || b.createdAt) : (b.when || b.createdAt) - (a.when || a.createdAt); });
        if (!rows.length) { list.hidden = true; empty.appendChild(P.empty(v.tab === 'Upcoming' ? 'No upcoming trips or orders. Book something from Home.' : 'Nothing here yet. Completed rides, stays and orders show up here.', 'calendar')); empty.appendChild(P.btn('Go to Home', 'soft sm', function () { UI.go('R29'); })); return; }
        list.hidden = false;
        rows.forEach(function (b) { var st = P.statusOf(b); list.appendChild(P.row({ icon: P.iconOf(b.type), tone: /Cancel/.test(st) ? 'red' : 'brand', title: b.title, sub: (b.when ? P.fdt(b.when) + ' \u00B7 ' : '') + b.sub, right: st, rightKind: /Cancel/.test(st) ? 'err' : /Delivered|Completed/.test(st) ? 'ok' : 'info', chev: true, onClick: function () { P.nav.booking = b.id; UI.go('R62'); } })); });
      }
      drawList();
    },
    tick: function (v) { var s = JSON.stringify(S.user().bookings.map(function (b) { return P.statusOf(b); })); if (v.sig !== s) { if (v.sig) v.draw(); v.sig = s; } }
  });
  var ICON_STAGE = ['Booked', 'Rider assigned', 'Picked up', 'In transit', 'Out for delivery', 'Delivered'];
  P.screen('R62', {
    title: 'Booking details', back: 'R54',
    build: function (body, v) {
      var b = S.booking(P.nav.booking);
      if (!b) { body.appendChild(P.empty('This booking could not be found.', 'info')); body.appendChild(P.btn('Back to trips', 'soft', function () { UI.go('R54'); })); return; }
      var st = P.statusOf(b);
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'p-hello' }, [h('span', { class: 'ic brand' }, ic(P.iconOf(b.type))), h('div', { class: 'x-flex-1 p-left' }, [h('b', { class: 'h2' }, b.title), h('div', { class: 'sub' }, b.sub)]), h('span', { class: 'tag ' + (/Cancel/.test(st) ? 'err' : /Delivered|Completed/.test(st) ? 'ok' : 'info') }, st)]),
        b.when ? P.kv('When', P.fdt(b.when)) : null, b.paise ? P.kv('Amount', rs(b.paise)) : null, b.pay ? P.kv('Paid with', b.pay) : null, P.kv('Booked on', P.fdt(b.createdAt)), P.kv('Reference', b.code || b.id)]));
      if (b.details && b.details.length) body.appendChild(h('div', { class: 'card-m' }, b.details.map(function (d) { return P.kv(d[0], String(d[1])); })));
      if (b.fare && b.fare.length) body.appendChild(h('div', { class: 'card-m' }, [h('b', null, 'Fare breakdown')].concat(b.fare.map(function (f) { return P.kv(f[0], rs(f[1])); }))));
      if (/Confirmed|Scheduled/.test(st)) body.appendChild(h('div', { class: 'card-m center' }, [h('b', null, 'Show this code'), P.qr(b.code || b.id), h('span', { class: 'xs' }, (b.code || b.id))]));
      if (b.type === 'food') body.appendChild(P.btn('Track order', '', function () { UI.go('R46'); }));
      if (b.type === 'parcel') body.appendChild(P.btn('Track parcel', '', function () { UI.go('R48'); }));
      if (b.type === 'ride') body.appendChild(P.btn('View invoice', 'soft', function () { P.nav.invoice = b.id; UI.go('R19'); }));
      if (P.isUpcoming(b) && !/Cancel/.test(st) && b.type !== 'food' && b.type !== 'parcel') body.appendChild(P.btn('Cancel booking', 'ghost', function () { P.cancelBooking(b).then(function (ok) { if (ok) v.draw(); }); }));
      body.appendChild(P.btn('Get help with this booking', 'ghost sm', function () { P.nav.helpRef = b.code || b.id; UI.go('R26'); }));
    }
  });
  P.qr = function (text) {
    var rnd = P.seeded(String(text)), n = 21, g = h('div', { class: 'p-qr', role: 'img', 'aria-label': 'Booking QR code (simulated)' });
    for (var i = 0; i < n * n; i++) {
      var r = Math.floor(i / n), c = i % n, finder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
      var on = finder ? (r % 6 === 0 || c % 6 === 0 || (r > 1 && r < 5 && c > 1 && c < 5) || ((r > 13 ? r - 14 : r) % 6 === 0) || ((c > 13 ? c - 14 : c) % 6 === 0) || (((r > 13 ? r - 14 : r) > 1 && (r > 13 ? r - 14 : r) < 5) && ((c > 13 ? c - 14 : c) > 1 && (c > 13 ? c - 14 : c) < 5))) : rnd() > 0.5;
      g.appendChild(h('i', { class: on ? 'on' : '' }));
    }
    return g;
  };

  // ------------------------------------------------------------ R56 notifications
  P.screen('R56', {
    title: 'Notifications', back: 'R29', reset: function (v) { v.f = 'All'; },
    right: function () { return h('button', { type: 'button', class: 'chip', on: { click: function () { var u = S.user(); u.notifications.forEach(function (n) { n.read = true; }); S.save(); P.views.R56.draw(); } } }, 'Mark all read'); },
    build: function (body, v) {
      var u = S.user();
      body.appendChild(P.chips(['All', 'Rides', 'Orders', 'Offers', 'Support', 'Updates'], v.f, function (f) { v.f = f; draw(); }));
      var list = h('div', { class: 'list' }); body.appendChild(list); var empty = h('div'); body.appendChild(empty);
      function draw() {
        P.clear(list); P.clear(empty);
        var rows = u.notifications.filter(function (n) { return v.f === 'All' || n.kind === v.f; });
        list.hidden = !rows.length; if (!rows.length) empty.appendChild(P.empty('No notifications in this category yet.', 'bell'));
        rows.forEach(function (n) {
          var r = P.row({ icon: { Rides: 'car', Orders: 'food', Offers: 'percent', Support: 'help', Updates: 'bell' }[n.kind] || 'bell', tone: n.read ? '' : 'brand', title: n.title, sub: n.sub, right: P.ago(n.at), rightKind: n.read ? '' : 'info', onClick: function () { n.read = true; S.save(); if (n.go) UI.go(n.go); else draw(); } });
          if (!n.read) r.classList.add('p-unread'); list.appendChild(r);
        });
      }
      draw();
    },
    update: function (v) { var u = S.user(); var sig = u.notifications.length + ':' + u.notifications.filter(function (n) { return !n.read; }).length; if (v.nsig && v.nsig !== sig) v.draw(); v.nsig = sig; }
  });
  P.ago = function (t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
  P.onNotify = function (title) { var v = P.views.R29; if (v && UI.sid === 'R29') { var b = UI.q('.p-badge', v.hdr); if (b) { var n = P.unread(); b.hidden = !n; b.textContent = String(n); } } UI.toast(title, 'info'); };

  // ------------------------------------------------------------ R20 ride history
  P.screen('R20', {
    title: 'Ride history', nav: 'trips', back: 'R54', reset: function (v) { v.f = 'All'; },
    build: function (body, v) {
      var u = S.user();
      body.appendChild(P.chips(['All', 'Completed', 'Cancelled', 'Scheduled'], v.f, function (f) { v.f = f; draw(); }));
      var list = h('div', { class: 'list' }); body.appendChild(list); var empty = h('div'); body.appendChild(empty);
      function draw() {
        P.clear(list); P.clear(empty);
        var rows = u.bookings.filter(function (b) { return b.type === 'ride' || b.type === 'scheduled'; }).filter(function (b) { var st = P.statusOf(b); return v.f === 'All' || (v.f === 'Scheduled' ? b.type === 'scheduled' && P.isUpcoming(b) : st === v.f); });
        list.hidden = !rows.length; if (!rows.length) { empty.appendChild(P.empty('No rides in this view yet.', 'car')); empty.appendChild(P.btn('Book a ride', 'soft sm', function () { UI.go('R07'); })); }
        rows.forEach(function (b) { var st = P.statusOf(b); list.appendChild(P.row({ icon: 'car', tone: /Cancel/.test(st) ? 'red' : 'brand', title: b.title, sub: P.fdt(b.when || b.createdAt) + ' \u00B7 ' + b.sub, right: b.paise ? rs(b.paise) : st, rightKind: /Cancel/.test(st) ? 'err' : b.type === 'scheduled' ? 'info' : 'ok', chev: true, onClick: function () { P.nav.booking = b.id; P.nav.invoice = b.id; UI.go(b.type === 'ride' && st === 'Completed' ? 'R19' : 'R62'); } })); });
      }
      draw();
    }
  });

  // ------------------------------------------------------------ R22 offers & coupons
  P.screen('R22', {
    title: 'Offers & coupons', back: 'R49',
    build: function (body, v) {
      var u = S.user();
      var f = P.field({ name: 'code', label: 'Have a code?', placeholder: 'e.g. RIDE50', maxlength: 14 });
      var apply = P.btn('Apply', 'sm', function () {
        P.clearErrors(); var c = P.coupon(UI.val('code').trim());
        if (!UI.val('code').trim()) { UI.fieldError('code', 'Enter a coupon code.'); return; }
        if (!c) { UI.fieldError('code', 'That code is not valid or has expired.'); return; }
        u.coupon = c.code; S.save(); UI.toast(c.code + ' applied. ' + c.title + '.', 'info'); v.draw();
      });
      body.appendChild(h('div', { class: 'row2 p-code' }, [f, apply]));
      if (u.coupon) body.appendChild(P.banner('ok', 'Applied: ' + u.coupon + '. It is used automatically on a matching booking.', 'check'));
      var list = h('div', { class: 'list' });
      COUPONS.forEach(function (c) {
        var on = u.coupon === c.code;
        list.appendChild(P.row({ icon: 'percent', tone: c.tone, title: c.code + ' \u00B7 ' + c.title, sub: c.sub, trail: h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), on: { click: function () { u.coupon = on ? '' : c.code; S.save(); UI.toast(on ? c.code + ' removed.' : c.code + ' applied. Use it on a matching booking.', 'info'); v.draw(); } } }, on ? 'Applied' : 'Apply') }));
      });
      body.appendChild(list);
      var ref = 'RN' + u.phone.slice(-4) + S.initials(u.name);
      body.appendChild(h('div', { class: 'card-m' }, [h('b', null, 'Invite friends, earn \u20B950 each'), h('span', { class: 'xs' }, 'Your referral code: ' + ref), P.btn('Share invite', 'soft sm', function () {
        var msg = 'Join me on RideNova with code ' + ref;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(function () { UI.toast('Invite text copied: ' + msg, 'info'); }, function () { UI.toast(msg, 'info'); }); else UI.toast(msg, 'info');
      })]));
    }
  });

  // ------------------------------------------------------------ R49 deals & savings
  P.screen('R49', {
    title: 'Deals & savings', nav: 'savings',
    build: function (body, v) {
      var u = S.user();
      body.appendChild(h('div', { class: 'card-m brand' }, [h('span', { class: 'xs' }, 'Total saved with RideNova'), h('b', { class: 'big-num' }, rs(u.savedPaise)), h('span', { class: 'xs' }, u.coupon ? 'Active coupon: ' + u.coupon : 'No coupon applied right now')]));
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('b', null, 'RideNova Plus'), h('span', { class: 'tag ' + (u.plus ? 'ok' : 'info') }, u.plus ? 'Active' : '7 days free')]), h('span', { class: 'xs' }, 'Free delivery on food, 5% off rides, priority support.'),
        P.btn(u.plus ? 'Manage: cancel membership' : 'Try free for 7 days', u.plus ? 'ghost sm' : 'sm', function () { u.plus = !u.plus; S.save(); if (u.plus) S.notify(u, 'RideNova Plus is active', 'Free delivery and 5% off rides for 7 days.', 'Offers'); UI.toast(u.plus ? 'Plus trial started. Free delivery is on.' : 'Membership cancelled.', 'info'); v.draw(); })]));
      body.appendChild(P.sec('DEALS FOR YOU'));
      var deals = [
        ['users', 'Share a seat, save 40%', 'Long-distance shared cabs', function () { P.nav.longMode = 'share'; UI.go('R33'); }, 'brand'],
        ['clock', 'Off-peak rides 10% off', 'Weekdays 2-5 PM - set a price alert', function () { UI.go('R50'); }, 'blue'],
        ['food', 'BIRYANI40 \u00B7 40% off', 'Up to \u20B980 on biryani orders', function () { u.coupon = 'BIRYANI40'; S.save(); UI.toast('BIRYANI40 applied.', 'info'); UI.go('R44'); }, 'amber'],
        ['box', 'Parcel with a traveller', 'From \u20B960 within the state', function () { UI.go('R47'); }, 'amber'],
        ['bed', 'STAY15 \u00B7 15% off hotels', 'Up to \u20B9600 per stay', function () { u.coupon = 'STAY15'; S.save(); UI.toast('STAY15 applied.', 'info'); UI.go('R41'); }, 'blue'],
        ['bus', 'GOBUS10 \u00B7 10% off buses', 'All operators', function () { u.coupon = 'GOBUS10'; S.save(); UI.toast('GOBUS10 applied.', 'info'); P.nav.longMode = 'bus'; UI.go('R33'); }, 'blue']
      ];
      body.appendChild(P.list(deals.map(function (d) { return P.row({ icon: d[0], tone: d[4], title: d[1], sub: d[2], chev: true, onClick: d[3] }); })));
      body.appendChild(P.btn('All offers & coupons', 'soft', function () { UI.go('R22'); }));
    }
  });

  // ------------------------------------------------------------ R53 language, region
  var COUNTRIES = [['IN', 'India', 'INR', 'All 9 services'], ['AE', 'United Arab Emirates', 'AED', '7 services'], ['GB', 'United Kingdom', 'GBP', '5 services'], ['KE', 'Kenya', 'KES', '6 services'], ['BR', 'Brazil', 'BRL', '6 services']];
  P.screen('R53', {
    title: 'Country, language & currency', back: 'R28', needUser: false,
    build: function (body, v) {
      var country = S.db.country || 'IN', lang = S.db.lang, units = S.db.units || 'Kilometres', clock = S.db.clock || '12-hour';
      body.appendChild(P.sec('COUNTRY AND CURRENCY'));
      var cl = h('div', { class: 'list' });
      COUNTRIES.forEach(function (c) { var r = P.row({ icon: 'globe', title: c[1], sub: c[3] + ' \u00B7 ' + c[2], on: c[0] === country, onClick: function () { country = c[0]; P.pickGroup(cl)(r); } }); r.setAttribute('aria-pressed', String(c[0] === country)); cl.appendChild(r); });
      body.appendChild(cl);
      body.appendChild(P.sec('LANGUAGE'));
      body.appendChild(P.chips(['English', '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02', '\u0939\u093F\u0928\u094D\u0926\u0940', '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41', '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD', 'Espa\u00F1ol', 'Kiswahili'], lang, function (l) { lang = l; }));
      body.appendChild(P.sec('UNITS AND TIME'));
      body.appendChild(P.chips(['Kilometres', 'Miles'], units, function (x) { units = x; }));
      body.appendChild(P.chips(['24-hour', '12-hour'], clock, function (x) { clock = x; }));
      body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn('Save', '', function () {
        var c = COUNTRIES.filter(function (x) { return x[0] === country; })[0];
        S.db.country = country; S.db.currency = c[2]; S.db.lang = lang; S.db.units = units; S.db.clock = clock; S.save();
        UI.toast('Saved: ' + c[1] + ', ' + lang + ', ' + c[2] + '.' + (c[2] !== 'INR' ? ' Prices in this prototype stay in rupees.' : ''), 'info');
        UI.go(S.user() ? 'R29' : 'R58', { replace: true });
      }));
    }
  });

  // ------------------------------------------------------------ R25 identity check
  var ID_TYPES = { Aadhaar: [/^\d{12}$/, '12 digits'], PAN: [/^[A-Z]{5}\d{4}[A-Z]$/, 'format ABCDE1234F'], 'Driving licence': [/^[A-Z]{2}\d{2}\s?\d{11}$/, 'like TS0920110012345'], Passport: [/^[A-Z]\d{7}$/, 'like K1234567'] };
  P.screen('R25', {
    title: 'Verify identity', back: 'R28',
    build: function (body, v) {
      var u = S.user(), k = u.kyc;
      if (k.state === 'verified') { body.appendChild(P.banner('ok', 'Your identity is verified (' + k.type + ' ending ' + k.last + '). Thank you.', 'check')); body.appendChild(P.btn('Back to account', 'soft', function () { UI.go('R28'); })); return; }
      if (k.state === 'review') { body.appendChild(P.banner('info', 'We are checking your ' + k.type + '. This usually takes a few seconds in the demo.', 'clock')); body.appendChild(P.progress(60)); return; }
      body.appendChild(P.banner('info', 'Verified riders can book rentals and long trips faster. We only keep the last 4 characters of your ID (demo).', 'idcard'));
      var type = 'Aadhaar', hint = h('div', { class: 'xs' }, 'Enter 12 digits');
      body.appendChild(h('div', { class: 'inp' }, [h('label', null, 'ID type'), P.chips(Object.keys(ID_TYPES), type, function (t) { type = t; hint.textContent = 'Expected: ' + ID_TYPES[t][1]; P.clearErrors(); })]));
      body.appendChild(P.field({ name: 'idno', label: 'ID number', maxlength: 20, autocomplete: 'off' })); body.appendChild(hint);
      var selfie = null, st = h('span', { class: 'xs' }, 'Optional: a selfie speeds up the check.');
      var file = h('input', { type: 'file', accept: 'image/*', class: 'p-file', tabindex: '-1', 'aria-label': 'Choose a selfie' });
      file.addEventListener('change', function () { var f = file.files && file.files[0]; if (!f) return; P.readPhoto(f, function (d, e) { if (e) { st.textContent = e; return; } selfie = d; st.textContent = 'Selfie added.'; }); });
      body.appendChild(h('div', { class: 'upload' }, [ic('camera', 20), h('div', { class: 'x-flex-1' }, [h('b', null, 'Take a selfie'), h('div', null, st)]), h('button', { type: 'button', class: 'chip', on: { click: function () { file.click(); } } }, 'Choose'), file]));
      body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn('Submit for verification', '', function () {
        P.clearErrors(); var raw = UI.val('idno').toUpperCase().replace(/[\s-]/g, ''), rule = ID_TYPES[type];
        if (!raw) { UI.fieldError('idno', 'Enter your ' + type + ' number.'); return; }
        if (!rule[0].test(raw)) { UI.fieldError('idno', 'That does not look like a valid ' + type + ' (' + rule[1] + ').'); return; }
        u.kyc = { state: 'review', type: type, last: raw.slice(-4), at: Date.now(), selfie: !!selfie }; S.save(); UI.toast('Submitted. Checking...', 'info'); v.draw();
      }));
      body.appendChild(P.btn('Skip for now', 'ghost sm', function () { UI.go('R28'); }));
    },
    tick: function (v) { var u = S.user(); if (u.kyc.state === 'review' && Date.now() - u.kyc.at > 6000) { u.kyc.state = 'verified'; S.save(); S.notify(u, 'Identity verified', u.kyc.type + ' ending ' + u.kyc.last + ' was verified.', 'Updates'); v.draw(); } }
  });
  P.every(function () { var u = S.user(); if (u && u.kyc.state === 'review' && Date.now() - u.kyc.at > 6000 && UI.sid !== 'R25') { u.kyc.state = 'verified'; S.save(); S.notify(u, 'Identity verified', u.kyc.type + ' ending ' + u.kyc.last + ' was verified.', 'Updates'); } });
})();