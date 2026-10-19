/* RideNova Partner app - working screens: session, onboarding form, menu, payouts & reviews, settings, home counts.
   P08 sign-in (kept, now remembered), P01 onboarding, P03 menu, P07 payouts, P10 settings, P09 live counts.
   Uses lite.js. Data is synthetic and kept in localStorage "ridenova.partner.v1". */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, K = RN.kit, L = RN.lite, h = L.h, rs = L.rs, exec = K.exec;
  var ST = L.store('ridenova.partner.v1', {
    signedIn: false, email: '',
    menu: [
      { id: 1, n: 'Chicken dum biryani', p: 289, veg: false, on: true, note: 'bestseller' }, { id: 2, n: 'Paneer biryani', p: 249, veg: true, on: true, note: '' },
      { id: 3, n: 'Mutton biryani', p: 389, veg: false, on: false, note: 'out until 8 PM' }, { id: 4, n: 'Double ka meetha', p: 99, veg: true, on: true, note: '' }, { id: 5, n: 'Lunch combo', p: 199, veg: false, on: true, note: '12-3 PM only' }],
    nextId: 6, pausedUntil: 0, hours: { open: '11:00', close: '23:30', days: 'daily' }, offer: { on: true, pct: 40, cap: 80, ends: 'Sunday' },
    bank: { holder: 'Biryani House', acct: '50100123458812', ifsc: 'HDFC0001234' }, alerts: { sound: true, vibrate: true, orders: true },
    payouts: [{ id: 'PO-2041', at: Date.now() - 7 * 86400000, paise: 3920000, state: 'Paid' }, { id: 'PO-2012', at: Date.now() - 14 * 86400000, paise: 4105000, state: 'Paid' }], paidOut: 0,
    reviews: [{ id: 1, name: 'Ananya', stars: 5, text: 'Hot and on time', reply: '' }, { id: 2, name: 'Rahul', stars: 3, text: 'Biryani was cold (saver delivery)', reply: '' }, { id: 3, name: 'Divya', stars: 5, text: 'Best dum biryani in the area', reply: 'Thank you Divya!' }],
    app: null
  });
  var D = ST.data; RN.partnerStore = ST;
  function t12(t) { var p = t.split(':'), hh = +p[0]; return (hh % 12 || 12) + ':' + p[1] + (hh < 12 ? ' AM' : ' PM'); }
  function pick(sel, o) { var x = UI.val(sel); return x; }

  // ---- P08 session is remembered
  var restoring = false, ready = false;
  var wait = setInterval(function () {
    if (!UI.engine || !UI.sid) return; clearInterval(wait);
    if (D.signedIn && UI.engine.state.session.partner.status !== 'signed_in') {
      exec('partner.signIn', { email: D.email || 'owner@biryanihouse.example', code: RN.data.DEMO_CODES.riderOtp }, null, { actor: 'partner', instant: true }).then(function (r) { if (r && r.ok && UI.sid === 'P08') UI.go('P09', { replace: true }); ready = true; });
    } else ready = true;
  }, 150);
  L.every(function () { if (!ready || !UI.engine) return; var on = UI.engine.state.session.partner.status === 'signed_in'; if (on !== D.signedIn) { D.signedIn = on; ST.save(); } });
  K.extend('P08', { init: function () {
    var f = UI.field('email'); if (f && !f.value && D.email) f.value = D.email;
    if (f) f.addEventListener('change', function () { D.email = f.value.trim(); ST.save(); });
  } });

  // ---- P01 onboarding: a real application form
  var TYPES = ['Restaurant', 'Hotel or homestay', 'Car / bike rental', 'Bus operator', 'Fleet owner', 'Parcel point', 'Fuel / EV stop', 'Store'];
  var STAGES = ['Application submitted', 'Documents checked', 'Business verified', 'Approved and live'];
  L.screen('P01', function (body, v) {
    if (D.app) { drawStatus(body, v); return; }
    var type = 'Restaurant';
    body.appendChild(h('b', null, 'What kind of business?'));
    body.appendChild(L.chips(TYPES, type, function (t) { type = t; }));
    body.appendChild(L.field({ name: 'biz', label: 'Business name', maxlength: 60 }));
    body.appendChild(L.field({ name: 'owner', label: 'Owner name', maxlength: 40 }));
    body.appendChild(h('div', { class: 'row2' }, [L.field({ name: 'bphone', label: 'Mobile', type: 'tel', inputmode: 'numeric', maxlength: 10 }), L.field({ name: 'bcity', label: 'City', select: ['Hyderabad', 'Bengaluru', 'Chennai', 'Mysuru', 'Kochi', 'Kozhikode', 'Pune', 'Goa'] })]));
    body.appendChild(L.field({ name: 'bemail', label: 'Business e-mail', type: 'email', maxlength: 60 }));
    body.appendChild(L.field({ name: 'gst', label: 'GST number (optional)', maxlength: 15, placeholder: '36ABCDE1234F1Z5' }));
    body.appendChild(L.field({ name: 'baddr', label: 'Address with pin code', area: true, rows: 2, maxlength: 140 }));
    body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'I accept the partner terms'), L.toggle(false, function (on) { v.terms = on; }, 'Accept terms')]));
    body.appendChild(L.btn('Start application', '', function () {
      UI.clearErrors(); var bad = false, g = function (n) { return UI.val(n).trim(); };
      if (g('biz').length < 3) { UI.fieldError('biz', 'Enter the business name.'); bad = true; }
      if (g('owner').length < 3) { UI.fieldError('owner', 'Enter the owner name.'); bad = true; }
      if (!/^[6-9]\d{9}$/.test(g('bphone'))) { UI.fieldError('bphone', 'Enter a valid 10-digit mobile.'); bad = true; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g('bemail'))) { UI.fieldError('bemail', 'Enter a valid business e-mail.'); bad = true; }
      if (g('gst') && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(g('gst').toUpperCase())) { UI.fieldError('gst', 'GST numbers look like 36ABCDE1234F1Z5.'); bad = true; }
      if (g('baddr').length < 10) { UI.fieldError('baddr', 'Enter the full address with pin code.'); bad = true; }
      if (!v.terms) { UI.toast('Please accept the partner terms to continue.', 'error'); bad = true; }
      if (bad) return;
      D.app = { id: 'APP-' + (7000 + Math.floor(Math.random() * 900)), type: type, biz: g('biz'), email: g('bemail'), at: Date.now() }; D.email = D.app.email; ST.save();
      exec('sim.note', { arg: 'Partner application ' + D.app.id + ': ' + g('biz') + ' (' + type + ')', event: 'partner.applied' }, null, { instant: true });
      UI.toast('Application ' + D.app.id + ' submitted.', 'info'); v.redraw();
    }));
  });
  // approval comes from the admin portal (Platform control > Partners) via RNPC; -1 = rejected. Fallback: 15 s per stage
  function appStage() { if (RN.partnerStage) return RN.partnerStage(D); return D.app ? Math.min(3, Math.floor((Date.now() - D.app.at) / 15000)) : 0; }
  function drawStatus(body, v) {
    var s = appStage(); body.appendChild(h('div', { class: 'card-m' }, [h('b', null, D.app.biz), h('span', { class: 'xs' }, D.app.type + ' \u00B7 ' + D.app.id + ' \u00B7 submitted ' + L.fdt(D.app.at))]));
    if (s < 0) { body.appendChild(L.banner('warn', 'Application not approved: ' + (D.app.reason || 'Please contact partner support.'))); body.appendChild(L.btn('Edit and apply again', '', function () { D.app = null; ST.save(); v.redraw(); })); return; }
    STAGES.forEach(function (t, i) { body.appendChild(L.row({ title: t, sub: i <= s ? (i === 3 ? 'Done' : 'Completed') : 'Pending', right: i <= s ? 'Done' : 'Waiting', kind: i <= s ? 'ok' : 'info' })); });
    if (s === 3) { body.appendChild(L.banner('info', 'Your business is approved. Sign in with ' + D.app.email + '.')); body.appendChild(L.btn('Go to sign in', '', function () { UI.go('P08'); })); }
    else body.appendChild(L.banner('info', 'An admin reviews this on the admin console. This usually takes a few minutes (demo: under a minute).'));
    body.appendChild(L.btn('Start over', 'ghost sm', function () { UI.confirm('Discard this application and start again?', 'Start over').then(function (y) { if (y) { D.app = null; ST.save(); v.redraw(); } }); }));
    v.shown = s;
  }
  L.every(function () { var sec = document.querySelector('.rn-screen[data-sid="P01"]'); if (!sec || sec.hidden || !D.app || UI.sid !== 'P01') return; var s = appStage(), body = UI.q('.body', sec); if (body && body.__s !== s) { body.__s = s; L.clear(body); drawStatus(body, { redraw: function () { L.clear(body); } }); } });

  // ---- P03 menu & availability
  L.screen('P03', function (body, v) {
    var live = D.pausedUntil > Date.now();
    var top = h('div', { class: 'row2' }, [L.btn(live ? 'Resume orders' : 'Pause 30 min', live ? '' : 'soft sm', function () { D.pausedUntil = live ? 0 : Date.now() + 30 * 60000; ST.save(); UI.toast(live ? 'Orders resumed.' : 'New orders paused for 30 minutes.', 'info'); v.redraw(); }), L.btn('Add item', 'soft sm', function () { itemSheet(null, v); })]);
    body.appendChild(top);
    if (live) body.appendChild(L.banner('warn', 'Paused until ' + L.ftime(D.pausedUntil) + '. Customers cannot order from you right now.'));
    body.appendChild(L.sec('MENU (' + D.menu.filter(function (m) { return m.on; }).length + ' of ' + D.menu.length + ' available)'));
    var rows = D.menu.map(function (m) {
      return L.row({ title: m.n, sub: rs(m.p * 100) + (m.note ? ' \u00B7 ' + m.note : '') + (m.veg ? ' \u00B7 veg' : ''), onClick: function () { itemSheet(m, v); }, trail: L.toggle(m.on, function (on) { m.on = on; if (!on && !m.note) m.note = 'unavailable'; if (on && /unavailable/.test(m.note)) m.note = ''; ST.save(); UI.toast(m.n + (on ? ' is available.' : ' marked unavailable.'), 'info'); }, m.n + ' available') });
    });
    body.appendChild(L.list(rows));
    body.appendChild(L.sec('OPENING HOURS'));
    body.appendChild(L.list([L.row({ title: t12(D.hours.open) + ' - ' + t12(D.hours.close) + ' ' + D.hours.days, sub: 'Tap to change', onClick: function () { hoursSheet(v); } })]));
    body.appendChild(L.sec('OFFERS YOU FUND'));
    body.appendChild(L.list([L.row({ title: D.offer.pct + '% off up to ' + rs(D.offer.cap * 100), sub: 'Ends ' + D.offer.ends, onClick: function () { offerSheet(v); }, trail: L.toggle(D.offer.on, function (on) { D.offer.on = on; ST.save(); UI.toast('Offer ' + (on ? 'switched on' : 'switched off') + '.', 'info'); }, 'Offer on') })]));
  });
  function itemSheet(m, v) {
    L.sheet(m ? 'Edit item' : 'Add item', function (b, api) {
      b.appendChild(L.field({ name: 'iname', label: 'Item name', value: m ? m.n : '', maxlength: 40 }));
      b.appendChild(L.field({ name: 'iprice', label: 'Price (\u20B9)', type: 'tel', inputmode: 'numeric', value: m ? m.p : '', maxlength: 4, prefix: '\u20B9' }));
      b.appendChild(L.field({ name: 'inote', label: 'Note (optional)', value: m ? m.note : '', maxlength: 40 }));
      var veg = m ? m.veg : true; b.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Vegetarian'), L.toggle(veg, function (on) { veg = on; }, 'Vegetarian')]));
      b.appendChild(L.btn(m ? 'Save' : 'Add to menu', '', function () {
        UI.clearErrors(); var n = UI.val('iname').trim(), p = parseInt(UI.val('iprice'), 10), bad = false;
        if (n.length < 3) { UI.fieldError('iname', 'Enter at least 3 characters.'); bad = true; } else if (D.menu.some(function (x) { return x !== m && x.n.toLowerCase() === n.toLowerCase(); })) { UI.fieldError('iname', 'This item is already on the menu.'); bad = true; }
        if (!(p >= 10 && p <= 5000)) { UI.fieldError('iprice', 'Price must be between \u20B910 and \u20B95,000.'); bad = true; }
        if (bad) return; if (m) Object.assign(m, { n: n, p: p, note: UI.val('inote').trim(), veg: veg }); else D.menu.push({ id: D.nextId++, n: n, p: p, veg: veg, on: true, note: UI.val('inote').trim() });
        ST.save(); api.close(); UI.toast(m ? 'Item updated.' : n + ' added to your menu.', 'info'); v.redraw();
      }));
      if (m) b.appendChild(L.btn('Remove item', 'danger', function () { api.close(); UI.confirm('Remove ' + m.n + ' from your menu?', 'Remove').then(function (y) { if (y) { var at = D.menu.indexOf(m); D.menu.splice(at, 1); ST.save(); v.redraw(); var f = function () { D.menu.splice(at, 0, m); ST.save(); v.redraw(); }; if (RN.ux && RN.ux.undoToast) RN.ux.undoToast(m.n + ' removed.', f); else UI.toast('Removed.', 'info'); } }); }));
    });
  }
  function hoursSheet(v) {
    var times = []; for (var i = 6; i <= 23; i++) for (var m = 0; m < 60; m += 30) times.push([L.pad(i) + ':' + L.pad(m), t12(L.pad(i) + ':' + L.pad(m))]);
    L.sheet('Opening hours', function (b, api) {
      b.appendChild(h('div', { class: 'row2' }, [L.field({ name: 'hopen', label: 'Opens', select: times, value: D.hours.open }), L.field({ name: 'hclose', label: 'Closes', select: times, value: D.hours.close })]));
      b.appendChild(L.field({ name: 'hdays', label: 'Days', select: ['daily', 'Mon-Fri', 'Mon-Sat', 'Weekends only'], value: D.hours.days }));
      b.appendChild(L.btn('Save hours', '', function () { UI.clearErrors(); var o = UI.val('hopen'), c = UI.val('hclose'); if (c <= o) { UI.fieldError('hclose', 'Closing time must be after opening time.'); return; } D.hours = { open: o, close: c, days: UI.val('hdays') }; ST.save(); api.close(); UI.toast('Opening hours saved.', 'info'); v.redraw(); }));
    });
  }
  function offerSheet(v) {
    L.sheet('Offer you fund', function (b, api) {
      b.appendChild(L.field({ name: 'opct', label: 'Discount % (5-60)', type: 'tel', inputmode: 'numeric', value: D.offer.pct, maxlength: 2 })); b.appendChild(L.field({ name: 'ocap', label: 'Maximum discount (\u20B9)', type: 'tel', inputmode: 'numeric', value: D.offer.cap, maxlength: 4 })); b.appendChild(L.field({ name: 'oend', label: 'Ends', select: ['Today', 'Sunday', 'End of month', 'No end date'], value: D.offer.ends }));
      b.appendChild(L.btn('Save offer', '', function () { UI.clearErrors(); var p = parseInt(UI.val('opct'), 10), c = parseInt(UI.val('ocap'), 10), bad = false; if (!(p >= 5 && p <= 60)) { UI.fieldError('opct', 'Choose between 5 and 60.'); bad = true; } if (!(c >= 10 && c <= 1000)) { UI.fieldError('ocap', 'Choose between \u20B910 and \u20B91,000.'); bad = true; } if (bad) return; D.offer.pct = p; D.offer.cap = c; D.offer.ends = UI.val('oend'); ST.save(); api.close(); UI.toast('Offer saved. It shows in the rider app.', 'info'); v.redraw(); }));
    });
  }

  // ---- P07 payouts and reviews
  function ledger() {
    var s = UI.engine ? UI.engine.state : { orders: {} }, extra = 0, n = 0;
    Object.keys(s.orders || {}).forEach(function (k) { var o = s.orders[k]; if (o.state === 'DELIVERED') { extra += o.itemsPaise || 0; n++; } });
    var gross = 5890000 + extra, comm = Math.round(gross * (RN.partnerCommission ? RN.partnerCommission() : 18) / 100), offers = 394000, tds = Math.round(gross * 0.0336);
    return { gross: gross, comm: comm, offers: offers, tds: tds, net: gross - comm - offers - tds - D.paidOut, n: n };
  }
  L.screen('P07', function (body, v) {
    var l = ledger();
    body.appendChild(h('div', { class: 'card-m brand' }, [h('span', { class: 'xs' }, 'Available balance' + (l.n ? ' (includes ' + l.n + ' new order' + (l.n > 1 ? 's' : '') + ')' : '')), h('b', { class: 'big-num' }, rs(l.net)), h('span', { class: 'xs' }, 'Weekly to ' + D.bank.ifsc.slice(0, 4) + ' ' + D.bank.acct.slice(-4) + ' \u00B7 next payout Monday')]));
    body.appendChild(L.btn('Request instant payout', '', function () { payoutSheet(l, v); }));
    body.appendChild(L.sec('THIS WEEK')); body.appendChild(h('div', { class: 'card-m' }, [L.kv('Gross sales', rs(l.gross)), L.kv('Commission (' + (RN.partnerCommission ? RN.partnerCommission() : 18) + '%)', rs(-l.comm)), L.kv('Offers you funded', rs(-l.offers)), L.kv('Tax deducted at source', rs(-l.tds)), L.kv('Already paid out', rs(-D.paidOut))]));
    body.appendChild(L.sec('PAYOUT HISTORY')); body.appendChild(L.list(D.payouts.map(function (p) { return L.row({ title: p.id + ' \u00B7 ' + rs(p.paise), sub: L.fdt(p.at), right: p.state, kind: p.state === 'Paid' ? 'ok' : 'info' }); })));
    var avg = D.reviews.reduce(function (s, r) { return s + r.stars; }, 0) / D.reviews.length;
    body.appendChild(L.sec('REVIEWS \u00B7 ' + avg.toFixed(1) + ' \u2605 (' + D.reviews.length + ')'));
    body.appendChild(L.list(D.reviews.map(function (r) { return L.row({ title: '\u2605'.repeat(r.stars) + ' "' + r.text + '"', sub: r.name + (r.reply ? ' \u00B7 You replied: ' + r.reply : ''), right: r.reply ? 'Replied' : 'Reply', kind: r.reply ? 'ok' : 'info', onClick: function () { replySheet(r, v); } }); })));
  });
  function payoutSheet(l, v) {
    L.sheet('Instant payout', function (b, api) {
      b.appendChild(L.banner('info', 'Available ' + rs(l.net) + '. A 1% fee applies. Money reaches ' + D.bank.ifsc.slice(0, 4) + ' ' + D.bank.acct.slice(-4) + ' in minutes (simulated).'));
      b.appendChild(L.field({ name: 'pamt', label: 'Amount (\u20B9)', type: 'tel', inputmode: 'numeric', prefix: '\u20B9', maxlength: 6 }));
      b.appendChild(L.btn('Request payout', '', function () {
        UI.clearErrors(); var a = parseInt(UI.val('pamt'), 10);
        if (!a || a < 500) { UI.fieldError('pamt', 'Minimum payout is \u20B9500.'); return; } if (a * 100 > l.net) { UI.fieldError('pamt', 'You can take at most ' + rs(l.net) + '.'); return; }
        D.paidOut += a * 100; D.payouts.unshift({ id: 'PO-' + (2100 + D.payouts.length), at: Date.now(), paise: a * 100, state: 'Processing' }); ST.save(); api.close(); UI.toast('Payout of ' + rs(a * 100) + ' requested.', 'info'); v.redraw();
      }));
    });
  }
  L.every(function () { var ch = false; D.payouts.forEach(function (p) { if (p.state === 'Processing' && Date.now() - p.at > 20000) { p.state = 'Paid'; ch = true; } }); if (ch) { ST.save(); if (UI.sid === 'P07') { var b = UI.q('#mock .body'), ctl = RN.screens.P07; if (ctl && ctl.init) ctl.init({}); } } });
  function replySheet(r, v) {
    L.sheet('Reply to ' + r.name, function (b, api) {
      b.appendChild(h('div', { class: 'card-m' }, [h('b', null, '\u2605'.repeat(r.stars)), h('span', { class: 'xs' }, '"' + r.text + '"')]));
      b.appendChild(L.field({ name: 'rtext', label: 'Your reply', area: true, rows: 3, maxlength: 200, value: r.reply }));
      b.appendChild(L.btn('Post reply', '', function () { UI.clearErrors(); var t = UI.val('rtext').trim(); if (t.length < 5) { UI.fieldError('rtext', 'Write at least 5 characters.'); return; } r.reply = t; ST.save(); api.close(); UI.toast('Reply posted.', 'info'); v.redraw(); }));
    });
  }

  // ---- P10 settings
  L.screen('P10', function (body, v) {
    body.appendChild(h('div', { class: 'card-m' }, [h('b', { class: 'h2' }, (D.app && D.app.biz) || D.menu && 'Biryani House'), h('span', { class: 'xs' }, D.email || 'owner@biryanihouse.example')]));
    body.appendChild(L.list([
      L.row({ title: 'Opening hours', sub: t12(D.hours.open) + ' - ' + t12(D.hours.close) + ' ' + D.hours.days, onClick: function () { hoursSheet(v); } }),
      L.row({ title: 'Bank account', sub: D.bank.ifsc.slice(0, 4) + ' ' + D.bank.acct.slice(-4) + ' \u00B7 weekly payouts', onClick: function () { bankSheet(v); } })]));
    body.appendChild(L.sec('ORDER ALERTS'));
    body.appendChild(L.list([['orders', 'New order alerts'], ['sound', 'Sound'], ['vibrate', 'Vibration']].map(function (a) { return L.row({ title: a[1], trail: L.toggle(D.alerts[a[0]], function (on) { D.alerts[a[0]] = on; ST.save(); UI.toast(a[1] + (on ? ' on.' : ' off.'), 'info'); }, a[1]) }); })));
    body.appendChild(L.list([L.row({ title: 'Support & complaints', sub: 'Disputes, payouts, listings', onClick: function () { UI.go('P11'); } }), L.row({ title: 'Help centre', sub: 'Articles, chat, calls and e-mail', onClick: function () { UI.go('P11'); } })]));
    body.appendChild(h('button', { type: 'button', class: 'btn rn-blk danger', 'data-do': 'x.signOut', 'data-arg': 'partner' }, 'Log out'));
  });
  function bankSheet(v) {
    L.sheet('Bank account', function (b, api) {
      b.appendChild(L.field({ name: 'bholder', label: 'Account holder', value: D.bank.holder, maxlength: 50 })); b.appendChild(L.field({ name: 'bacct', label: 'Account number', type: 'tel', inputmode: 'numeric', value: D.bank.acct, maxlength: 18 })); b.appendChild(L.field({ name: 'bifsc', label: 'IFSC', value: D.bank.ifsc, maxlength: 11 }));
      b.appendChild(L.btn('Save bank details', '', function () { UI.clearErrors(); var bad = false, hd = UI.val('bholder').trim(), ac = UI.val('bacct').replace(/\D/g, ''), fs = UI.val('bifsc').toUpperCase().trim(); if (hd.length < 3) { UI.fieldError('bholder', 'Enter the account holder name.'); bad = true; } if (ac.length < 9 || ac.length > 18) { UI.fieldError('bacct', 'Account numbers have 9 to 18 digits.'); bad = true; } if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(fs)) { UI.fieldError('bifsc', 'IFSC looks like HDFC0001234.'); bad = true; } if (bad) return; D.bank = { holder: hd, acct: ac, ifsc: fs }; ST.save(); api.close(); UI.toast('Bank details saved. The next payout goes here.', 'info'); v.redraw(); }));
    });
  }

  // ---- P09 live counts
  K.extend('P09', { update: function (ctx, s) {
    var o = Object.keys(s.orders || {}).length, bk = Object.keys(s.bookings || {}).length, tiles = UI.qa('#mock .body b, #mock .body .big-num');
    UI.qa('#mock .body *').forEach(function (n) { if (n.children.length === 0 && /^\d+$/.test(n.textContent.trim())) { var lab = (n.parentElement && n.parentElement.textContent) || ''; if (/Orders today/.test(lab)) n.textContent = String(o + 23); else if (/Bookings today/.test(lab)) n.textContent = String(bk + 6); } });
  } });
})();