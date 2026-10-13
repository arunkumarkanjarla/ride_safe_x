/* RideNova Driver app - working screens: login + OTP, registration, onboarding progress, earnings, wallet, incentives, trips,
   account, publish-a-trip. Uses lite.js. Synthetic data kept in localStorage "ridenova.driver.v1" (in-memory fallback). */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, K = RN.kit, L = RN.lite, D = RN.data, h = L.h, rs = L.rs, exec = K.exec;
  var DEMO_PHONE = '9000012345';
  var ST = L.store('ridenova.driver.v1', {
    signedIn: false, phone: '', stage: 'active', submittedAt: 0, docs: {},
    profile: { name: 'Arjun Kumar', city: 'Hyderabad', vehicle: 'Cab', own: 'Yes, my own', langs: 'Telugu, Hindi, English', model: 'White Swift Dzire', plate: 'TS 09 EA 4521' },
    known: {}, wallet: 648000, history: [{ id: 'W-1', at: Date.now() - 4 * 86400000, paise: -500000, note: 'Cash out to bank' }], claimed: [], trips: [], prefs: { sound: true, nightMode: false, lang: 'English' }
  });
  var S = ST.data; RN.driverStore = ST;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function initials(n) { return n.trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }

  // ---------------------------------------------------------------- engine <-> onboarding stage
  function prime(stage) {
    var e = UI.engine; if (!e) return; var s = e.state, dr = s.drivers[s.persona];
    if (stage === 'active') return;
    var base = { state: 'DRAFT', docs: clone(D.KYC_TEMPLATE.docs).map(function (d) { d.state = S.docs[d.key] === 'uploaded' ? 'uploaded' : 'missing'; d.reason = ''; return d; }), reason: '' };
    if (stage === 'submitted') { base.state = 'IN_REVIEW'; base.docs.forEach(function (d) { d.state = 'in_review'; }); base.submittedAt = Date.now(); }
    if (stage === 'approved') { base.state = 'APPROVED'; base.docs.forEach(function (d) { d.state = 'approved'; }); }
    s.kyc = base; dr.kyc = { DRAFT: 'DRAFT', IN_REVIEW: 'IN_REVIEW', APPROVED: 'APPROVED' }[base.state]; if (stage !== 'approved') dr.avail = 'OFFLINE'; e._emit();
  }
  function watch() {
    var e = UI.engine; if (!e) return; var s = e.state, k = s.kyc, ch = false;
    if (S.stage !== 'active' && S.stage !== 'none') {
      if (k.state === 'IN_REVIEW' && S.stage !== 'submitted') { S.stage = 'submitted'; S.submittedAt = Date.now(); ch = true; }
      if (k.state === 'ACTIVE' && S.stage !== 'active') { S.stage = 'active'; ch = true; UI.toast('Welcome aboard! Your driver account is active.', 'info'); }
      // KYC decision comes from the admin portal (Platform control > Drivers & KYC) via RNPC; falls back to a 15 s simulated review
      var dec = S.stage === 'submitted' && k.state === 'IN_REVIEW' ? (RN.kycDecision ? RN.kycDecision(S) : { status: Date.now() - S.submittedAt > 15000 ? 'approved' : '', auto: true }) : { status: '' };
      if (dec.status === 'rejected') { S.stage = 'registered'; S.kycReject = dec.reason || 'Please re-upload your documents.'; Object.keys(S.docs).forEach(function (x) { S.docs[x] = 'missing'; }); ST.save(); prime('registered'); ch = true; UI.toast('Documents not approved: ' + S.kycReject, 'error'); if (UI.sid === 'D04') UI.go('D03'); }
      if (dec.status === 'approved') {
        S.kycReject = ''; k.state = 'APPROVED'; k.docs.forEach(function (d) { d.state = 'approved'; }); s.drivers[s.persona].kyc = 'APPROVED'; S.stage = 'approved'; ch = true; e._emit(); UI.toast(dec.auto ? 'Your documents were approved (simulated review).' : 'Your documents were approved by RideNova.', 'info');
      }
      if (k.state === 'DRAFT') k.docs.forEach(function (d) { if (S.docs[d.key] !== d.state) { S.docs[d.key] = d.state; ch = true; } });
    }
    if (ch) ST.save();
  }
  L.every(watch);

  // ---------------------------------------------------------------- session restore
  var ready = false, wait = setInterval(function () {
    if (!UI.engine || !UI.sid) return; clearInterval(wait);
    if (S.signedIn) {
      exec('auth.sendOtp', { phone: S.phone }, null, { instant: true }).then(function () { return exec('auth.verifyOtp', { code: D.DEMO_CODES.driverOtp }, null, { instant: true }); }).then(function () {
        prime(S.stage); ready = true;
        if (UI.sid === 'D01') UI.go(S.stage === 'active' ? 'D05' : S.stage === 'submitted' || S.stage === 'approved' ? 'D04' : S.stage === 'none' ? 'D02' : 'D03', { replace: true });
      });
    } else ready = true;
  }, 150);
  L.every(function () { if (!ready || !UI.engine) return; var st = UI.engine.state.session.driver.status; if (S.signedIn && st === 'signed_out') { S.signedIn = false; ST.save(); } });

  // ---------------------------------------------------------------- D01 login with OTP step
  function otpSheet(phone) {
    var left = 30, timer = null;
    L.sheet('Verify your number', function (b, api) {
      b.appendChild(L.banner('info', 'We sent a 6-digit code to +91 ' + phone.slice(0, 5) + ' ' + phone.slice(5) + '. Demo code: ' + D.DEMO_CODES.driverOtp + '.'));
      b.appendChild(L.field({ name: 'dotp', label: '6-digit code', type: 'tel', inputmode: 'numeric', maxlength: 6, placeholder: '------' }));
      var resend = h('button', { type: 'button', class: 'chip', disabled: true }, 'Resend in 30s');
      timer = setInterval(function () { left--; if (!document.body.contains(resend)) { clearInterval(timer); return; } if (left <= 0) { clearInterval(timer); resend.disabled = false; resend.textContent = 'Resend code'; } else resend.textContent = 'Resend in ' + left + 's'; }, 1000);
      resend.addEventListener('click', function () { left = 30; resend.disabled = true; UI.toast('New code sent (demo: ' + D.DEMO_CODES.driverOtp + ').', 'info'); timer = setInterval(function () { left--; if (left <= 0) { clearInterval(timer); resend.disabled = false; resend.textContent = 'Resend code'; } else resend.textContent = 'Resend in ' + left + 's'; }, 1000); });
      b.appendChild(L.btn('Verify and continue', '', function () {
        UI.clearErrors(); var c = UI.val('dotp').replace(/\D/g, '');
        if (c.length !== 6) { UI.fieldError('dotp', 'Enter all 6 digits.'); return; }
        exec('auth.verifyOtp', { code: c }, null).then(function (r) {
          if (!r.ok) { UI.fieldError('dotp', 'That code is not right. Try ' + D.DEMO_CODES.driverOtp + ' for the demo.'); return; }
          api.close(); clearInterval(timer); S.accounts = S.accounts || {}; if (S.phone && S.known[S.phone]) S.accounts[S.phone] = { profile: S.profile, stage: S.stage, docs: S.docs };
          if (S.accounts[phone] && phone !== S.phone) { S.profile = S.accounts[phone].profile; S.stage = S.accounts[phone].stage; S.docs = S.accounts[phone].docs || {}; }
          S.phone = phone; S.signedIn = true;
          if (phone === DEMO_PHONE) { S.stage = 'active'; S.profile = { name: 'Arjun Kumar', city: 'Hyderabad', vehicle: 'Cab', own: 'Yes, my own', langs: 'Telugu, Hindi, English', model: 'White Swift Dzire', plate: 'TS 09 EA 4521' }; S.known[phone] = true; }
          else if (!S.known[phone]) { S.stage = 'none'; S.docs = {}; S.profile = { name: '', city: 'Hyderabad', vehicle: 'Cab', own: 'Yes, my own', langs: 'English', model: '', plate: '' }; prime('none'); }
          if (S.stage !== 'active' && S.known[phone]) prime(S.stage); ST.save(); UI.toast(S.known[phone] ? 'Welcome back, ' + S.profile.name.split(' ')[0] + '!' : 'Verified. Let\u2019s set up your driver profile.', 'info');
          UI.go(S.stage === 'active' ? 'D05' : S.stage === 'submitted' || S.stage === 'approved' ? 'D04' : S.stage === 'none' ? 'D02' : 'D03');
        });
      }));
      b.appendChild(h('div', { class: 'row2' }, [resend]));
    });
  }
  K.extend('D01', { init: function () { var f = UI.field('phone'); if (f && f.value && f.value.replace(/\D/g, '') === DEMO_PHONE && !S.phone) f.value = ''; }, actions: { driverLogin: function (n) {
    UI.clearErrors(); var f = UI.field('phone'), digits = f.value.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) { UI.fieldError('phone', 'Enter a valid 10-digit mobile number starting with 6-9.'); return { ok: false }; }
    return exec('auth.sendOtp', { phone: f.value }, n).then(function (r) { if (r.ok) otpSheet(digits); return r; });
  } } });

  // ---------------------------------------------------------------- D02 registration (step 1)
  var CITIES = ['Hyderabad', 'Bengaluru', 'Chennai', 'Mysuru', 'Kochi', 'Kozhikode', 'Pune', 'Vijayawada'];
  L.screen('D02', function (body) {
    var vehicle = S.profile.vehicle || 'Cab', own = S.profile.own || 'Yes, my own';
    body.appendChild(h('div', { class: 'xs p-sec' }, 'STEP 1 OF 4 \u00B7 ABOUT YOU'));
    body.appendChild(L.field({ name: 'fullname', label: 'Full name (as on licence)', value: S.profile.name, maxlength: 50 }));
    body.appendChild(L.field({ name: 'city', label: 'City', select: CITIES, value: S.profile.city }));
    body.appendChild(h('b', { class: 'xs' }, 'What will you drive?')); body.appendChild(L.chips(['Bike', 'Auto', 'Cab'], vehicle, function (v) { vehicle = v; }));
    body.appendChild(L.field({ name: 'model', label: 'Vehicle model', value: S.profile.model, maxlength: 30, placeholder: 'e.g. Maruti Dzire' }));
    body.appendChild(L.field({ name: 'plate', label: 'Registration number', value: S.profile.plate, maxlength: 13, placeholder: 'TS 09 AB 1234' }));
    body.appendChild(h('b', { class: 'xs' }, 'Do you own the vehicle?')); body.appendChild(L.chips(['Yes, my own', 'Fleet vehicle'], own, function (v) { own = v; }));
    body.appendChild(L.field({ name: 'langs', label: 'Languages you speak', value: S.profile.langs, maxlength: 60 }));
    body.appendChild(L.btn('Next', '', function () {
      UI.clearErrors(); var bad = false, n = UI.val('fullname').trim(), pl = UI.val('plate').toUpperCase().replace(/\s+/g, ' ').trim();
      if (!/^[\p{L}][\p{L} .'-]{2,49}$/u.test(n)) { UI.fieldError('fullname', 'Enter your name as on your licence (letters only).'); bad = true; }
      if (UI.val('model').trim().length < 3) { UI.fieldError('model', 'Enter the vehicle model.'); bad = true; }
      if (!/^[A-Z]{2}\s?\d{2}\s?[A-Z]{1,3}\s?\d{4}$/.test(pl)) { UI.fieldError('plate', 'Registration looks like TS 09 AB 1234.'); bad = true; }
      if (UI.val('langs').trim().length < 2) { UI.fieldError('langs', 'Tell us at least one language.'); bad = true; }
      if (bad) return;
      S.profile = { name: n, city: UI.val('city'), vehicle: vehicle, own: own, langs: UI.val('langs').trim(), model: UI.val('model').trim(), plate: pl }; S.stage = 'registered'; S.known[S.phone] = true; ST.save();
      exec('sim.note', { arg: 'Driver registration step 1 saved: ' + n, event: 'driver.registered' }, null, { instant: true }); UI.go('D03');
    }));
  });

  // ---------------------------------------------------------------- earnings data (seeded, plus live rides)
  var PLACES = ['Banjara Hills', 'Hitec City', 'Gachibowli', 'Madhapur', 'Secunderabad', 'Jubilee Hills', 'Kondapur', 'Begumpet', 'Airport', 'Charminar', 'Kukatpally', 'Miyapur'];
  function liveRides() {
    var e = UI.engine, out = []; if (!e) return out; var s = e.state;
    s.rideOrder.forEach(function (id) { var r = s.rides[id]; if (r && r.driverEarnPaise && /COMPLETE|PAID|SETTLED/.test(r.state)) out.push({ id: r.id, at: r.completedAt || r.createdAt || Date.now(), paise: r.driverEarnPaise, tip: 0, a: 'Pickup', b: 'Drop', live: true }); });
    return out;
  }
  function genTrips(period) {
    var n = { today: 9, week: 68, month: 276 }[period], span = { today: 1, week: 7, month: 30 }[period], rnd = L.seeded('drv-' + S.profile.name + period), out = [], now = Date.now();
    for (var i = 0; i < n; i++) { var a = Math.floor(rnd() * PLACES.length), b = (a + 1 + Math.floor(rnd() * (PLACES.length - 1))) % PLACES.length; out.push({ id: 'T-' + (9000 - i - (period === 'week' ? 0 : period === 'month' ? 100 : 300)), at: now - Math.floor(rnd() * span * 86400000 * 0.98) - 600000, paise: Math.round((80 + rnd() * 340) * 100), tip: rnd() < 0.2 ? 2000 + Math.round(rnd() * 3000) : 0, a: PLACES[a], b: PLACES[b] }); }
    out = out.concat(liveRides().filter(function (r) { return now - r.at < span * 86400000; })); return out.sort(function (x, y) { return y.at - x.at; });
  }
  var per = { earn: 'week', trips: 'week' };
  L.screen('D13', function (body, v) {
    var tr = genTrips(per.earn), gross = tr.reduce(function (s, t) { return s + t.paise; }, 0), tips = tr.reduce(function (s, t) { return s + t.tip; }, 0), quest = S.claimed.length * 50000, fees = 1500 * ({ today: 1, week: 6, month: 24 }[per.earn]), net = gross + tips + quest - fees;
    body.appendChild(L.chips([['today', 'Today'], ['week', 'This week'], ['month', 'This month']], per.earn, function (p) { per.earn = p; v.redraw(); }));
    body.appendChild(h('div', { class: 'card-m brand' }, [h('span', { class: 'xs' }, 'You keep (no commission)'), h('b', { class: 'big-num', role: 'link', tabindex: 0, 'data-go': 'D14' }, rs(net)), h('span', { class: 'xs' }, 'Tap for wallet & payouts')]));
    var buckets = per.earn === 'today' ? 8 : per.earn === 'week' ? 7 : 10, sums = new Array(buckets).fill(0), now = Date.now(), span = { today: 1, week: 7, month: 30 }[per.earn] * 86400000;
    tr.forEach(function (t) { var i = Math.min(buckets - 1, Math.floor((1 - (now - t.at) / span) * buckets)); sums[Math.max(0, i)] += t.paise; });
    var mx = Math.max.apply(null, sums) || 1; body.appendChild(h('div', { class: 'p-bar', 'aria-label': 'Earnings chart' }, sums.map(function (s) { var i = h('i', { title: rs(s) }); i.style.height = Math.max(5, Math.round(s / mx * 100)) + '%'; return i; })));
    body.appendChild(h('div', { class: 'row3' }, [['Trips', String(tr.length)], ['Online', Math.round(tr.length * 0.6) + 'h'], ['Tips', rs(tips)]].map(function (x) { return h('div', { class: 'card-m' }, [h('span', { class: 'xs' }, x[0]), h('b', null, x[1])]); })));
    body.appendChild(L.list([
      L.row({ title: 'Trip earnings', sub: tr.length + ' trips', right: rs(gross), onClick: function () { UI.go('D16'); } }),
      L.row({ title: 'Quests & bonuses', sub: S.claimed.length + ' claimed', right: rs(quest), onClick: function () { UI.go('D15'); } }),
      L.row({ title: 'Tips', sub: tr.filter(function (t) { return t.tip; }).length + ' riders', right: rs(tips) }),
      L.row({ title: 'Daily fees', sub: fees / 1500 + ' driving days x \u20B915 \u00B7 no commission', right: rs(-fees), onClick: function () { UI.go('D27'); } })]));
  });

  // ---------------------------------------------------------------- D16 trips
  RN.screens.D16 = undefined;
  L.screen('D16', function (body, v) {
    var tr = genTrips(per.trips);
    body.appendChild(L.chips([['today', 'Today'], ['week', 'Week'], ['month', 'Month']], per.trips, function (p) { per.trips = p; v.redraw(); }));
    body.appendChild(L.sec(tr.length + ' TRIPS \u00B7 ' + rs(tr.reduce(function (s, t) { return s + t.paise; }, 0))));
    var rows = tr.slice(0, 40).map(function (t) { return L.row({ title: t.a + ' \u2192 ' + t.b, sub: L.fdt(t.at) + ' \u00B7 ' + t.id + (t.live ? ' \u00B7 just now' : ''), right: rs(t.paise), onClick: function () { tripSheet(t); } }); });
    body.appendChild(L.list(rows)); if (tr.length > 40) body.appendChild(h('div', { class: 'xs p-hint' }, 'Showing the latest 40 of ' + tr.length + '.'));
  }, { update: function () { if (UI.sid === 'D16') { var c = RN.screens.D16; } } });
  function tripSheet(t) {
    L.sheet('Trip ' + t.id, function (b, api) {
      var fare = t.paise, tax = Math.round(fare * 0.05);
      b.appendChild(h('div', { class: 'card-m' }, [h('b', null, t.a + ' \u2192 ' + t.b), h('span', { class: 'xs' }, L.fdt(t.at))]));
      b.appendChild(h('div', { class: 'card-m' }, [L.kv('Rider paid', rs(fare + tax)), L.kv('GST 5% (to government)', rs(-tax)), L.kv('Tip', rs(t.tip)), L.kv('You keep', rs(fare + t.tip))]));
      b.appendChild(L.btn('Report an issue with this trip', 'ghost', function () { api.close(); UI.go('D20'); }));
    });
  }

  // ---------------------------------------------------------------- D14 wallet
  L.screen('D14', function (body, v) {
    body.appendChild(h('div', { class: 'card-m brand' }, [h('span', { class: 'xs' }, 'Available to pay out'), h('b', { class: 'big-num' }, rs(S.wallet)), h('span', { class: 'xs' }, 'Bank \u00B7 HDFC 4521 \u00B7 weekly auto payout on Monday')]));
    body.appendChild(L.btn('Cash out now \u00B7 \u20B910 fee', '', function () { cashSheet(v); }));
    body.appendChild(L.sec('HISTORY')); body.appendChild(L.list(S.history.map(function (x) { return L.row({ title: x.note, sub: L.fdt(x.at), right: rs(x.paise), kind: x.paise < 0 ? 'info' : 'ok' }); })));
    body.appendChild(L.row({ title: 'Daily fees & GST', sub: 'See how today\u2019s earnings are split', onClick: function () { UI.go('D27'); } }));
  });
  function cashSheet(v) {
    var fee = RN.payoutFee ? RN.payoutFee() : 10, minA = RN.payoutMin ? RN.payoutMin() : 100;
    L.sheet('Cash out', function (b, api) {
      b.appendChild(L.banner('info', 'Balance ' + rs(S.wallet) + '. A flat ' + rs(fee * 100) + ' fee applies. Money reaches your bank in minutes (simulated).'));
      b.appendChild(L.field({ name: 'camt', label: 'Amount (\u20B9)', type: 'tel', inputmode: 'numeric', prefix: '\u20B9', maxlength: 6, value: Math.floor(S.wallet / 100) }));
      b.appendChild(L.btn('Cash out', '', function () {
        UI.clearErrors(); var a = parseInt(UI.val('camt'), 10);
        if (!a || a < minA) { UI.fieldError('camt', 'Minimum cash out is ' + rs(minA * 100) + '.'); return; } if ((a + fee) * 100 > S.wallet) { UI.fieldError('camt', 'Amount plus the ' + rs(fee * 100) + ' fee is above your balance.'); return; }
        S.wallet -= (a + fee) * 100; S.history.unshift({ id: 'W-' + (S.history.length + 1), at: Date.now(), paise: -(a + fee) * 100, note: 'Cash out to bank' }); ST.save(); api.close(); UI.toast(rs(a * 100) + ' is on its way to your bank.', 'info'); v.redraw();
      }));
    });
  }

  // ---------------------------------------------------------------- D15 incentives
  var QUESTS = [{ id: 'q1', t: 'Weekend quest', d: 'Complete 30 trips Sat-Sun', goal: 30, base: 18, paise: 100000 }, { id: 'q2', t: 'Peak hours', d: 'Do 10 trips between 6-10 PM', goal: 10, base: 6, paise: 50000 }, { id: 'q3', t: 'Five-star streak', d: 'Get 15 five-star ratings in a row', goal: 15, base: 15, paise: 30000 }, { id: 'q4', t: 'Early bird', d: 'Complete 5 trips before 9 AM', goal: 5, base: 2, paise: 25000 }];
  L.screen('D15', function (body, v) {
    var live = liveRides().length;
    body.appendChild(L.banner('info', 'Every trip you finish now counts towards your quests.'));
    (RN.questList ? RN.questList(QUESTS) : QUESTS).forEach(function (q) {
      var cur = Math.min(q.goal, q.base + (q.id === 'q3' ? 0 : live)), done = cur >= q.goal, claimed = S.claimed.indexOf(q.id) >= 0;
      var bar = h('div', { class: 'bar' }, h('i')); bar.firstChild.style.width = Math.round(cur / q.goal * 100) + '%';
      body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('b', null, q.t), h('span', { class: 'tag ' + (claimed ? 'ok' : done ? 'ok' : 'info') }, claimed ? 'Claimed' : done ? 'Completed' : 'Active')]), h('span', { class: 'xs' }, q.d), bar, h('div', { class: 'kv' }, [h('span', { class: 'xs' }, cur + ' / ' + q.goal), h('b', null, 'Bonus ' + rs(q.paise))]),
        done && !claimed ? L.btn('Claim ' + rs(q.paise), 'sm', function () { S.claimed.push(q.id); S.wallet += q.paise; S.history.unshift({ id: 'W-Q' + q.id, at: Date.now(), paise: q.paise, note: q.t + ' bonus' }); ST.save(); UI.toast(rs(q.paise) + ' added to your wallet.', 'info'); v.redraw(); }) : null]));
    });
  }, { init: function () { } });

  // ---------------------------------------------------------------- D28 account
  RN.screens.D28 = undefined;
  L.screen('D28', function (body, v) {
    var p = S.profile; body.appendChild(h('div', { class: 'card-m' }, [h('div', { class: 'kv' }, [h('span', { class: 'av' }, initials(p.name || 'DR')), h('span', { class: 'tx' }, [h('b', null, p.name), h('span', { class: 'xs' }, (S.stage === 'active' ? '\u2605 4.9 \u00B7 ' + (1240 + liveRides().length) + ' trips \u00B7 since 2024' : 'New partner \u00B7 onboarding ' + S.stage) + ' \u00B7 +91 ' + (S.phone || DEMO_PHONE))]), h('span', { class: 'tag ' + (S.stage === 'active' ? 'ok' : 'info') }, S.stage === 'active' ? 'Active' : 'Onboarding')])]));
    body.appendChild(h('div', { class: 'row3' }, [['Rating', '4.9'], ['Acceptance', '92%'], ['Cancellation', '2%']].map(function (x) { return h('div', { class: 'card-m' }, [h('span', { class: 'xs' }, x[0]), h('b', null, x[1])]); })));
    body.appendChild(L.list([
      L.row({ title: p.model || 'Add vehicle', sub: (p.plate || '-') + ' \u00B7 ' + p.vehicle + ' \u00B7 ' + p.city, onClick: function () { vehSheet(v); } }),
      L.row({ title: 'Documents', sub: S.stage === 'active' ? 'Insurance expires in 12 days' : 'Finish verification', right: 'Check', onClick: function () { UI.go(S.stage === 'active' ? 'D17' : 'D04'); } }),
      L.row({ title: 'Services', sub: 'City rides, food, parcels', onClick: function () { UI.go('D21'); } }),
      L.row({ title: 'Publish a long trip', sub: S.trips.length + ' published', onClick: function () { UI.go('D24'); } }),
      L.row({ title: 'Driver support', sub: 'Tickets, chat and call-back', onClick: function () { UI.go('D20'); } })]));
    body.appendChild(L.sec('PREFERENCES'));
    body.appendChild(L.list([L.row({ title: 'Ride sounds', trail: L.toggle(S.prefs.sound, function (o) { S.prefs.sound = o; ST.save(); UI.toast('Ride sounds ' + (o ? 'on' : 'off') + '.', 'info'); }, 'Ride sounds') }), L.row({ title: 'Night map', trail: L.toggle(S.prefs.nightMode, function (o) { S.prefs.nightMode = o; ST.save(); UI.toast('Night map ' + (o ? 'on' : 'off') + '.', 'info'); }, 'Night map') }), L.row({ title: 'App language', sub: S.prefs.lang, onClick: function () { langSheet(v); } })]));
    body.appendChild(h('button', { type: 'button', class: 'btn rn-blk danger', 'data-do': 'x.signOut', 'data-arg': 'driver', 'data-confirm': 'Log out of the driver app?', 'data-next': 'D01' }, 'Log out'));
  });
  function langSheet(v) { L.sheet('App language', function (b, api) { ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam'].forEach(function (l) { b.appendChild(L.row({ title: l, right: S.prefs.lang === l ? 'Selected' : '', kind: 'ok', onClick: function () { S.prefs.lang = l; ST.save(); api.close(); UI.toast('Language set to ' + l + ' (labels stay English in this demo).', 'info'); v.redraw(); } })); }); }); }
  function vehSheet(v) {
    L.sheet('Vehicle details', function (b, api) {
      b.appendChild(L.field({ name: 'vmodel', label: 'Model', value: S.profile.model, maxlength: 30 })); b.appendChild(L.field({ name: 'vplate', label: 'Registration number', value: S.profile.plate, maxlength: 13 })); b.appendChild(L.banner('warn', 'Changing the vehicle needs a re-inspection before you can go online with it.'));
      b.appendChild(L.btn('Save', '', function () { UI.clearErrors(); var m = UI.val('vmodel').trim(), pl = UI.val('vplate').toUpperCase().replace(/\s+/g, ' ').trim(), bad = false; if (m.length < 3) { UI.fieldError('vmodel', 'Enter the vehicle model.'); bad = true; } if (!/^[A-Z]{2}\s?\d{2}\s?[A-Z]{1,3}\s?\d{4}$/.test(pl)) { UI.fieldError('vplate', 'Registration looks like TS 09 AB 1234.'); bad = true; } if (bad) return; S.profile.model = m; S.profile.plate = pl; ST.save(); api.close(); UI.toast('Vehicle updated. Re-inspection booked (simulated).', 'info'); v.redraw(); }));
    });
  }

  // ---------------------------------------------------------------- D24 / D25 publish a long trip
  var CITY = { Kozhikode: [11.25, 75.78], Mysuru: [12.3, 76.64], Bengaluru: [12.97, 77.59], Hyderabad: [17.39, 78.49], Vijayawada: [16.51, 80.65], Chennai: [13.08, 80.27], Kochi: [9.93, 76.27], Pune: [18.52, 73.86], Goa: [15.5, 73.83] };
  function km(a, b) { var A = CITY[a], B = CITY[b], r = Math.PI / 180, dl = (B[0] - A[0]) * r, dn = (B[1] - A[1]) * r, x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(A[0] * r) * Math.cos(B[0] * r) * Math.sin(dn / 2) * Math.sin(dn / 2); return Math.round(12742 * Math.asin(Math.sqrt(x)) * 1.3); }
  function days() { var out = [], d = new Date(); for (var i = 1; i <= 7; i++) { var x = new Date(d.getTime() + i * 86400000); out.push([x.toISOString().slice(0, 10), x.toDateString().slice(0, 10)]); } return out; }
  L.screen('D24', function (body, v) {
    var names = Object.keys(CITY), time = '07:00', seats = 3;
    body.appendChild(L.field({ name: 'tfrom', label: 'From', select: names, value: S.profile.city && CITY[S.profile.city] ? S.profile.city : 'Kozhikode' }));
    body.appendChild(L.field({ name: 'tto', label: 'To', select: names, value: 'Mysuru' }));
    body.appendChild(L.field({ name: 'tdate', label: 'Date', select: days() })); body.appendChild(h('b', { class: 'xs' }, 'Leaves at')); body.appendChild(L.chips(['05:00', '07:00', '10:00', '16:00', '21:00'], time, function (t) { time = t; }));
    body.appendChild(h('b', { class: 'xs' }, 'Seats to offer')); body.appendChild(L.chips([1, 2, 3, 4].map(function (n) { return [n, String(n)]; }), seats, function (n) { seats = n; }));
    body.appendChild(L.field({ name: 'tprice', label: 'Price per seat (\u20B9)', type: 'tel', inputmode: 'numeric', prefix: '\u20B9', maxlength: 4 }));
    var parcels = true; body.appendChild(h('div', { class: 'kv' }, [h('span', null, 'Carry parcels too'), L.toggle(true, function (o) { parcels = o; }, 'Carry parcels')]));
    var hint = h('div', { class: 'xs p-hint' }, 'Pick the cities and we suggest a price.'); body.appendChild(hint);
    var upd = function () { var a = UI.val('tfrom'), b = UI.val('tto'); if (a === b) { hint.textContent = 'Choose two different cities.'; return; } var d = km(a, b); hint.textContent = d + ' km \u00B7 about ' + Math.floor(d / 55) + 'h ' + Math.round((d / 55 % 1) * 60) + 'm \u00B7 suggested ' + rs(Math.round(d * 2.2 / 10) * 1000) + ' per seat.'; };
    ['tfrom', 'tto'].forEach(function (n) { UI.field(n).addEventListener('change', upd); }); upd();
    body.appendChild(L.btn('Publish trip', '', function () {
      UI.clearErrors(); var a = UI.val('tfrom'), b = UI.val('tto'), p = parseInt(UI.val('tprice'), 10), bad = false;
      if (a === b) { UI.fieldError('tto', 'Pick a different destination.'); bad = true; }
      if (!(p >= 100 && p <= 3000)) { UI.fieldError('tprice', 'Price must be between \u20B9100 and \u20B93,000.'); bad = true; }
      if (S.stage !== 'active') { UI.toast('Finish verification before publishing trips.', 'error'); bad = true; }
      if (bad) return;
      S.trips.unshift({ id: 'LT-' + (5100 + S.trips.length), from: a, to: b, date: UI.val('tdate'), time: time, seats: seats, booked: 0, price: p, parcels: parcels, km: km(a, b), at: Date.now(), state: 'Open' }); ST.save(); UI.toast('Trip published. Riders can book seats now.', 'info'); UI.go('D25');
    }));
  });
  L.screen('D25', function (body, v) {
    body.appendChild(L.btn('Publish another trip', 'soft sm', function () { UI.go('D24'); }));
    if (!S.trips.length) { body.appendChild(L.empty('No published trips yet. Publish one and riders can book seats.')); return; }
    S.trips.forEach(function (t) {
      var bar = h('div', { class: 'bar' }, h('i')); bar.firstChild.style.width = Math.round(t.booked / t.seats * 100) + '%';
      body.appendChild(h('div', { class: 'card-m', 'data-trip': t.id }, [h('div', { class: 'kv' }, [h('b', null, t.from + ' \u2192 ' + t.to), h('span', { class: 'tag ' + (t.state === 'Open' ? 'ok' : 'info') }, t.state)]), h('span', { class: 'xs' }, t.date + ' \u00B7 ' + t.time + ' \u00B7 ' + t.km + ' km \u00B7 ' + rs(t.price * 100) + '/seat' + (t.parcels ? ' \u00B7 parcels' : '')), bar, h('div', { class: 'kv' }, [h('span', { class: 'xs', 'data-b': '1' }, t.booked + ' of ' + t.seats + ' seats booked'), h('b', null, 'Earns ' + rs(t.booked * t.price * 100))]),
        h('div', { class: 'row2' }, [L.btn('Offline pack', 'ghost sm', function () { UI.go('D26'); }), t.state === 'Open' ? L.btn('Cancel trip', 'danger sm', function () { UI.confirm('Cancel ' + t.from + ' to ' + t.to + '? Booked riders are refunded.', 'Cancel trip').then(function (y) { if (y) { t.state = 'Cancelled'; ST.save(); v.redraw(); UI.toast('Trip cancelled. Riders will be refunded.', 'info'); } }); }) : null])]));
    });
  });
  L.every(function () { // seats fill up over time
    var ch = false; S.trips.forEach(function (t) { if (t.state === 'Open' && t.booked < t.seats && Date.now() - t.at > 12000 * (t.booked + 1)) { t.booked++; ch = true; UI.toast('New booking on ' + t.from + ' \u2192 ' + t.to + ' (' + t.booked + '/' + t.seats + ').', 'info'); if (t.booked === t.seats) t.state = 'Full'; } });
    if (ch) { ST.save(); if (UI.sid === 'D25' && RN.screens.D25 && RN.screens.D25.init) RN.screens.D25.init({}); }
  });
  // D03: describe each document for the signed-in driver (not the demo driver's numbers)
  var DOC_SUB = { licence: 'Front and back, valid for your vehicle class', rc: 'Registration certificate of ', insurance: 'Valid commercial insurance', permit: 'Commercial permit (cab / auto)', fitness: 'Vehicles older than 8 years', police: 'Certificate or consent to verify', photo: 'Clear selfie, no sunglasses' };
  K.extend('D03', { update: function (ctx, s) {
    if (S.stage === 'active' && S.phone === DEMO_PHONE) return;
    s.kyc.docs.forEach(function (d) { var li = UI.q('#mock [data-do="x.uploadDoc"][data-arg="' + d.key + '"]'); var sub = li && UI.q('.tx span', li); if (!sub) return;
      sub.textContent = d.state === 'rejected' && d.reason ? d.reason : d.state === 'missing' ? (DOC_SUB[d.key] || '') + (d.key === 'rc' ? (S.profile.plate || 'your vehicle') : '') + ' \u00B7 tap to upload' : d.state === 'uploaded' ? 'Uploaded \u00B7 synthetic file, nothing leaves the browser' : d.title; });
  } });
})();