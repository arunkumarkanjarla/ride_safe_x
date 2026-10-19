/* RideNova Admin portal - working back-office screens built on synthetic data (no backend).
   Adds: password step + remembered session on A01, and live, filterable, persistent screens for
   A05 A08 A09 A29 A10 A11 A14 A16 A17 A18 A21 A22 A23 A25 A26 A28 A30. Every change goes through
   the engine's permission check (admin.action, page 10 RBAC) and lands in the audit log (A19).
   Data lives in localStorage "ridenova.admin.v1" (in-memory fallback). */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, K = RN.kit, L = RN.lite, D = RN.data, h = L.h, rs = L.rs, exec = K.exec;
  var NAMES = ['Ananya Rao', 'Rahul Verma', 'Divya Nair', 'Karthik Reddy', 'Meera Iyer', 'Vikram Singh', 'Sneha Patil', 'Arjun Mehta', 'Pooja Shah', 'Rohan Das', 'Kavya Menon', 'Imran Khan', 'Lakshmi Pillai', 'Siddharth Rao', 'Neha Gupta', 'Aditya Kulkarni', 'Fatima Sheikh', 'Harish Babu', 'Priyanka Joshi', 'Suresh Kumar', 'Anjali Desai', 'Manoj Yadav', 'Ritu Sharma', 'Gautam Bose'];
  var CITIES = ['Hyderabad', 'Bengaluru', 'Chennai', 'Mysuru', 'Kochi', 'Dubai'];
  function rng(seed) { return L.seeded(seed); }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function mask(p) { return p.slice(0, 2) + 'XXXXX' + p.slice(-3); }
  function genRiders() { var r = rng('riders'), out = []; for (var i = 0; i < 48; i++) { var ph = String(6 + Math.floor(r() * 4)) + String(Math.floor(r() * 1e9)).padStart(9, '0'); out.push({ id: 'U-' + (1001 + i), name: NAMES[i % NAMES.length], phone: ph, city: pick(r, CITIES), rides: Math.floor(r() * 240), rating: (4 + r()).toFixed(1), wallet: Math.floor(r() * 900) * 100, status: r() < 0.08 ? 'Flagged' : 'Active', since: 2021 + Math.floor(r() * 5) }); } return out; }
  function genVehicles() { var r = rng('veh'), M = [['Swift Dzire', 'Cab'], ['WagonR', 'Cab'], ['Bajaj RE', 'Auto'], ['Honda Activa', 'Bike'], ['Innova Crysta', 'Premium'], ['Tata Nexon EV', 'Cab'], ['TVS Jupiter', 'Bike']], out = []; for (var i = 0; i < 36; i++) { var m = pick(r, M), due = Date.now() + Math.round((r() * 120 - 20) * 86400000); out.push({ plate: 'TS ' + String(Math.floor(r() * 30) + 1).padStart(2, '0') + ' ' + String.fromCharCode(65 + Math.floor(r() * 26)) + String.fromCharCode(65 + Math.floor(r() * 26)) + ' ' + String(Math.floor(r() * 9000) + 1000), model: m[0], type: m[1], owner: r() < 0.4 ? 'Fleet \u00B7 Ride Easy Rentals' : NAMES[Math.floor(r() * NAMES.length)], due: due, susp: false }); } return out; }
  function genTx() { var r = rng('tx'), out = [], now = Date.now(), M = ['UPI', 'UPI', 'Card', 'Wallet', 'Cash', 'UPI']; for (var i = 0; i < 60; i++) { var amt = Math.round((60 + r() * 900)) * 100, st = r() < 0.07 ? 'Failed' : r() < 0.06 ? 'Refunded' : r() < 0.05 ? 'Disputed' : 'Captured', m = pick(r, M); out.push({ id: 'pay_' + (0x9f00 + 60 - i).toString(16), ride: 'RN-' + String(125 - i).padStart(5, '0'), method: m, paise: amt, refunded: st === 'Refunded' ? amt : 0, status: m === 'Cash' && st === 'Captured' && r() < 0.5 ? 'Cash owed' : st, at: now - i * 4 * 60000 - Math.floor(r() * 120000), ref: m === 'Card' ? 'pi_' + Math.floor(r() * 1e6).toString(36) : m === 'Wallet' || m === 'Cash' ? 'internal' : 'pay_' + Math.floor(r() * 1e6).toString(36), rider: NAMES[i % NAMES.length] }); } return out; }
  var ST = L.store('ridenova.admin.v1', {
    session: { on: false, until: 0, role: 'OPS_MANAGER', trust: false },
    riders: genRiders(), vehicles: genVehicles(), tx: genTx(),
    fares: { v: 14, rows: [['Bike', 20, 6, 1.0, 35, 20, 1], ['Auto', 30, 12, 1.5, 45, 30, 1], ['Cab', 50, 14, 1.5, 90, 50, 2], ['Premium', 90, 20, 2.5, 160, 75, 3]], history: [{ v: 14, at: Date.now() - 6 * 86400000, by: 'Priya K.', note: 'Cab per-km 13 \u2192 14' }, { v: 13, at: Date.now() - 30 * 86400000, by: 'Rakesh M.', note: 'Night surcharge removed' }] },
    surge: [['HYD-HITEC-01', 2.1, 1.3, 1.8, 'Auto'], ['HYD-BH-04', 1.6, 1.2, 1.8, 'Auto'], ['HYD-AIRPORT', 0.9, 1.0, 1.5, 'Auto'], ['HYD-OLDCITY-02', 1.2, 1.0, 1.5, 'Manual']],
    fees: [['Bike', 10, 5], ['Auto', 12, 5], ['Cab', 15, 5], ['Premium', 25, 12]],
    zones: [{ id: 'HYD-HITEC-01', city: 'Hyderabad', type: 'Surge', km: 3.5, on: true }, { id: 'HYD-AIRPORT', city: 'Hyderabad', type: 'Airport pickup', km: 4, on: true }, { id: 'HYD-CHARMINAR-NP', city: 'Hyderabad', type: 'No pickup', km: 0.6, on: true }, { id: 'BLR-MG-01', city: 'Bengaluru', type: 'Service', km: 6, on: true }, { id: 'DXB-MARINA', city: 'Dubai', type: 'Service', km: 5, on: false }],
    coupons: [{ code: 'FIRST50', kind: '%', val: 50, cap: 100, min: 0, uses: 1840, limit: 5000, on: true, ends: '2026-12-31' }, { code: 'SAVER40', kind: '%', val: 40, cap: 80, min: 199, uses: 920, limit: 2000, on: true, ends: '2026-10-31' }, { code: 'FLAT75', kind: 'flat', val: 75, cap: 75, min: 299, uses: 310, limit: 1000, on: false, ends: '2026-11-15' }],
    disputes: (function () { var r = rng('disp'), T = ['Driver took a longer route', 'Charged after cancelling', 'Item missing from order', 'Driver asked for extra cash', 'Toll charged twice', 'AC was not working'], out = []; for (var i = 0; i < 14; i++) out.push({ id: 'DSP-' + (3300 + i), rider: NAMES[(i * 5) % NAMES.length], ride: 'RN-' + String(90 - i * 3).padStart(5, '0'), reason: T[i % T.length], paise: Math.round(40 + r() * 400) * 100, opened: Date.now() - Math.floor(r() * 46 * 3600000), state: i < 9 ? 'Open' : i < 12 ? 'Resolved' : 'Rejected', outcome: '' }); return out; })(),
    fraud: (function () { var r = rng('fraud'), S = ['GPS spoofing pattern', 'Many accounts, one device', 'Promo abuse (12 new accounts)', 'Fake trips between two accounts', 'Card testing - 9 failed payments', 'Collusion: same rider & driver 30x'], out = []; for (var i = 0; i < 12; i++) out.push({ id: 'FR-' + (710 + i), who: (i % 2 ? 'Driver ' : 'Rider ') + NAMES[(i * 7) % NAMES.length], signal: S[i % S.length], score: Math.round(55 + r() * 44), at: Date.now() - Math.floor(r() * 30 * 3600000), state: 'Open' }); return out; })(),
    gov: [{ id: 'GR-2026-09', title: 'Monthly trip summary - Telangana Transport Dept.', period: 'Sep 2026', state: 'Submitted', by: 'Safety manager', at: Date.now() - 9 * 86400000 }, { id: 'GR-2026-Q3', title: 'Quarterly safety incidents - Hyderabad', period: 'Q3 2026', state: 'Pending approval', by: 'Safety manager', at: Date.now() - 86400000 }],
    campaigns: [{ id: 'CMP-88', title: 'Diwali rides 20% off', channel: 'Push', audience: 'All riders - Hyderabad', reach: 182000, sent: 182000, opened: 40210, state: 'Sent', at: Date.now() - 3 * 86400000 }],
    flags: { Hyderabad: { women_driver_preference: true, ai_support_assistant: true, bike_taxi: true, night_ride_checkin: true, cash_payments: true }, Bengaluru: { women_driver_preference: true, ai_support_assistant: true, bike_taxi: false, night_ride_checkin: true, cash_payments: true }, Dubai: { women_driver_preference: false, ai_support_assistant: true, bike_taxi: false, night_ride_checkin: false, cash_payments: false }, Global: { women_driver_preference: true, ai_support_assistant: true, bike_taxi: false, night_ride_checkin: true, cash_payments: true } },
    adapters: [['Maps', 'Google Maps', 'Mapbox', 'Primary'], ['Payments', 'Razorpay', 'Cashfree', 'Primary'], ['SMS', 'Provider A', 'Provider B', 'Primary'], ['WhatsApp', 'Meta Cloud API', '-', 'Primary'], ['LLM', 'Hosted LLM API', 'Rules only', 'Primary'], ['SIP trunk', 'Trunk A', 'Trunk B', 'Primary']],
    services: { 'City rides': { Hyderabad: 1, Bengaluru: 1, Chennai: 1, Mysuru: 1, Kochi: 1, Dubai: 1 }, 'Bike taxi': { Hyderabad: 1, Bengaluru: 0, Chennai: 1, Mysuru: 1, Kochi: 0, Dubai: 0 }, 'Food delivery': { Hyderabad: 1, Bengaluru: 1, Chennai: 1, Mysuru: 0, Kochi: 1, Dubai: 0 }, Parcels: { Hyderabad: 1, Bengaluru: 1, Chennai: 1, Mysuru: 1, Kochi: 1, Dubai: 1 }, Hotels: { Hyderabad: 1, Bengaluru: 1, Chennai: 1, Mysuru: 1, Kochi: 1, Dubai: 1 }, 'Intercity & bus': { Hyderabad: 1, Bengaluru: 1, Chennai: 1, Mysuru: 1, Kochi: 1, Dubai: 0 }, Rentals: { Hyderabad: 1, Bengaluru: 1, Chennai: 0, Mysuru: 1, Kochi: 1, Dubai: 1 } },
    routes: [{ id: 'LR-501', kind: 'Shared cab', from: 'Kozhikode', to: 'Mysuru', dep: 'Fri 07:00', seats: 3, booked: 3, on: true }, { id: 'BUS-77', kind: 'Bus', from: 'Hyderabad', to: 'Bengaluru', dep: 'Daily 21:30', seats: 40, booked: 31, on: true }, { id: 'BUS-81', kind: 'Bus', from: 'Chennai', to: 'Kochi', dep: 'Daily 20:00', seats: 36, booked: 18, on: true }, { id: 'LR-512', kind: 'Shared cab', from: 'Bengaluru', to: 'Mysuru', dep: 'Sat 06:30', seats: 4, booked: 1, on: true }, { id: 'LR-520', kind: 'Self-drive', from: 'Kochi', to: 'Munnar', dep: 'Sun 08:00', seats: 1, booked: 0, on: false }],
    coverage: [['Kozhikode - Mysuru (NH766)', 'Thamarassery ghat', 38, 'Offline pack'], ['Hyderabad - Srisailam', 'Nallamala forest', 22, 'Offline pack'], ['Bengaluru - Ooty', 'Bandipur', 41, 'SMS fallback'], ['Kochi - Munnar', 'Adimali', 56, 'SMS fallback'], ['Chennai - Pondicherry (ECR)', 'Marakkanam', 81, 'Live']],
    published: false
  });
  var S = ST.data;
  function save() { ST.save(); }
  function role() { return UI.engine ? UI.engine.state.session.admin.role : S.session.role; }
  function can(perm) { return RN.rbac && RN.rbac.can ? RN.rbac.can(role(), perm) : true; }
  // permission-checked, audit-logged change; resolves true when allowed
  function act(perm, label, event, target, btn) { return exec('admin.action', { perm: perm, label: label, event: event, target: target, id: target + ':' + label + ':' + Date.now() }, btn || null).then(function (r) { return !!(r && r.ok); }); }

  /* Bridge legacy A-screen mutations into canonical RNPC ops (ridenova.ops.v1).
     Keeps admin.v1 samples for offline demo tables; does not reset or overwrite unrelated ops data. */
  function who() { return (S.session && (S.session.email || S.session.role)) || role() || 'admin'; }
  function opsOk() { return !!(window.RNPC && typeof RNPC.opsUpdate === 'function'); }
  function pushWallet(phone, name, paise, note, kind, booking, source) {
    if (!opsOk() || !phone || !paise) return null;
    var id = null;
    RNPC.opsUpdate(function (o) {
      id = RNPC.uid('WA');
      var c = o.customers[phone] = o.customers[phone] || {};
      c.name = name || c.name || '';
      c.seen = Date.now();
      if (typeof c.walletPaise !== 'number') c.walletPaise = 0;
      c.walletPaise += paise;
      o.wallet.unshift({ id: id, phone: phone, paise: paise, note: note, kind: kind || 'Adjustment', booking: booking || '', at: Date.now(), by: who(), source: source || 'admin-portal', applied: false });
    }, { by: who(), role: role(), action: kind === 'Refund' ? 'wallet.refund' : 'wallet.adjust', detail: note || '' });
    return id;
  }
  function pushBlock(phone, name, blocked, reason) {
    if (!opsOk() || !phone) return;
    RNPC.opsUpdate(function (o) {
      var c = o.customers[phone] = o.customers[phone] || {};
      c.name = name || c.name || '';
      c.blocked = !!blocked;
      c.reason = blocked ? (reason || 'Blocked from Admin riders (A05)') : '';
      c.seen = Date.now();
    }, { by: who(), role: role(), action: blocked ? 'customer.block' : 'customer.unblock', detail: (blocked ? 'Blocked ' : 'Unblocked ') + phone });
  }
  function overlayOps(r) {
    if (!opsOk() || !RNPC.ops.customers) return;
    var c = RNPC.ops.customers[r.phone]; if (!c) return;
    if (c.blocked) r.status = 'Blocked';
    else if (r.status === 'Blocked' && c.blocked === false) r.status = 'Active';
  }
  function liveRiders() {
    if (!opsOk()) return [];
    var syn = {}; S.riders.forEach(function (r) { syn[r.phone] = 1; });
    return Object.keys(RNPC.ops.customers).filter(function (ph) { return !syn[ph]; }).map(function (ph) {
      var c = RNPC.ops.customers[ph];
      return { id: 'LIVE-' + String(ph).slice(-4), name: c.name || 'Customer', phone: ph, city: 'Live', rides: c.bookings || 0, rating: '—', wallet: c.walletPaise || 0, status: c.blocked ? 'Blocked' : 'Active', since: new Date(c.seen || Date.now()).getFullYear(), live: true };
    });
  }
  function allRiders() { S.riders.forEach(overlayOps); return S.riders.concat(liveRiders()); }
  function phoneForRiderName(name) { var r = S.riders.filter(function (x) { return x.name === name; })[0]; return r ? r.phone : ''; }

  // ---------------------------------------------------------------- building blocks
  function btn(label, cls, fn) { return h('button', { type: 'button', class: 'dbtn ' + (cls || ''), on: { click: fn } }, label); }
  function st(t, kind) { return h('span', { class: 'st ' + (kind || '') }, t); }
  function card(title, right, kids, cls) { return h('div', { class: 'dcard ' + (cls || '') }, [h('div', { class: 'hd' }, [h('b', null, title), h('span', { class: 'sp' }), right || null]), kids]); }
  function kpis(list) { return h('div', { class: 'a-kpis' }, list.map(function (k) { return h('div', { class: 'a-kpi' }, [h('span', null, k[0]), h('b', null, k[1]), k[2] ? h('span', null, k[2]) : null]); })); }
  function chips(opts, cur, fn) { return h('div', { class: 'a-bar', role: 'tablist' }, opts.map(function (o) { return h('button', { type: 'button', role: 'tab', class: 'a-chip' + (o === cur ? ' on' : ''), 'aria-selected': String(o === cur), on: { click: function () { fn(o); } } }, o); })); }
  function tog(on, fn, label) { var b = h('button', { type: 'button', class: 'a-tog' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on), 'aria-label': label }); b.addEventListener('click', function () { fn(!b.classList.contains('on'), function (ok) { if (ok) { b.classList.toggle('on'); b.setAttribute('aria-checked', String(b.classList.contains('on'))); } }); }); return b; }
  function table(cols, rows, onRow) {
    var tb = h('tbody'); rows.forEach(function (r) { var tr = h('tr', onRow ? { class: 'a-click', tabindex: 0 } : null, cols.map(function (c) { return h('td', null, c[1](r)); })); if (onRow) { tr.addEventListener('click', function (e) { if (e.target.closest('button,input,select')) return; onRow(r); }); tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') onRow(r); }); } tb.appendChild(tr); });
    return h('table', { class: 'dt' }, [h('thead', null, h('tr', null, cols.map(function (c) { return h('th', null, c[0]); }))), tb]);
  }
  function drawer(title, build) {
    var desk = UI.q('#mock .desk'); if (!desk) return; var old = UI.q('.a-scrim', desk); if (old) old.remove();
    var body = h('div', { class: 'a-drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }), scrim = h('div', { class: 'a-scrim' }, body);
    var close = function () { scrim.remove(); document.removeEventListener('keydown', esc); }, esc = function (e) { if (e.key === 'Escape') close(); };
    body.appendChild(h('div', { class: 'a-hd' }, [h('b', null, title), h('button', { type: 'button', class: 'a-x', 'aria-label': 'Close', on: { click: close } }, '\u00D7')]));
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); }); document.addEventListener('keydown', esc); desk.appendChild(scrim);
    build(body, close); var f = UI.q('input,select,textarea', body); if (f) f.focus();
  }
  function kv(a, b) { return h('div', { class: 'kv' }, [h('span', null, a), h('b', null, b)]); }
  function download(name, rows) { var csv = rows.map(function (r) { return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n'); var a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: name }); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function search(ph, val, fn) { var i = h('input', { type: 'search', class: 'rn-input a-search', placeholder: ph, 'aria-label': ph, value: val || '' }); i.addEventListener('input', function () { fn(i.value); }); return h('span', { class: 'srch' }, i); }
  var views = {};
  function screen(sid, build) {
    var c = { init: function () { var sec = document.querySelector('.rn-screen[data-sid="' + sid + '"]'), dc = sec && UI.q('.dc', sec); if (!dc) return; views[sid] = { dc: dc, build: build }; draw(sid); } };
    if (RN.screens[sid]) K.extend(sid, c); else K.def(sid, c);
  }
  function draw(sid) { var v = views[sid]; if (!v) return; var foot = UI.q('.dfoot, footer', v.dc); var keepFocus = document.activeElement && document.activeElement.classList.contains('a-search') ? document.activeElement.value : null; L.clear(v.dc); v.build(v.dc, function () { draw(sid); }); if (keepFocus !== null) { var s = UI.q('.a-search', v.dc); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } } }
  var filt = {};
  function f(sid, key, def) { filt[sid] = filt[sid] || {}; if (filt[sid][key] === undefined) filt[sid][key] = def; return filt[sid][key]; }
  function setf(sid, key, v) { filt[sid][key] = v; draw(sid); }
  function money(p) { return rs(p); }

  // ---------------------------------------------------------------- A01: password + MFA, remembered session
  K.extend('A01', { init: function () {
    var sec = document.querySelector('.rn-screen[data-sid="A01"]'), otp = sec && UI.q('[data-otp]', sec); if (!otp || UI.q('.a-pw', sec)) return;
    var mfaCard = otp.parentElement; mfaCard.hidden = true;
    var pw = h('div', { class: 'a-pw', 'data-step': 'password' }, [h('div', { class: 'h2' }, 'Sign in'), h('div', { class: 'a-note' }, 'Company account (SSO). Demo password: ' + D.DEMO_CODES.adminPassword + '.'),
      L.field({ name: 'aemail', label: 'Work e-mail', type: 'email', value: 'priya.k@ridenova.example', maxlength: 80 }), L.field({ name: 'apass', label: 'Password', type: 'password', maxlength: 40 }),
      h('button', { type: 'button', class: 'btn rn-blk p-primary', on: { click: function () {
        UI.clearErrors(); var e = UI.val('aemail').trim(), p = UI.val('apass'), bad = false;
        if (!/^[^\s@]+@ridenova\.example$/.test(e)) { UI.fieldError('aemail', 'Use your @ridenova.example work e-mail.'); bad = true; }
        if (p !== D.DEMO_CODES.adminPassword) { UI.fieldError('apass', p ? 'Wrong password.' : 'Enter your password.'); bad = true; }
        if (bad) return; pw.hidden = true; mfaCard.hidden = false; var i = UI.q('.rn-otp-input', sec); if (i) i.focus(); UI.toast('Password OK. Demo MFA code: ' + D.DEMO_CODES.adminMfa + '.', 'info');
      } } }, 'Continue')]);
    mfaCard.parentElement.insertBefore(pw, mfaCard);
  } });
  var restored = false;
  var wait = setInterval(function () {
    if (!UI.engine || !UI.sid) return; clearInterval(wait);
    var ses = S.session;
    if (ses.on && ses.until > Date.now()) {
      exec('admin.mfa', { code: D.DEMO_CODES.adminMfa }, null, { instant: true }).then(function () { return exec('admin.setRole', { role: ses.role }, null, { instant: true }); }).then(function () { restored = true; if (UI.sid === 'A01') UI.go('A02', { replace: true }); });
    } else restored = true;
  }, 150);
  L.every(function () {
    if (!restored || !UI.engine) return; var a = UI.engine.state.session.admin, on = a.status === 'signed_in', ch = false;
    if (on && !S.session.on) { var tr = UI.q('#mock [data-sid="A01"] input[type=checkbox]') || UI.q('.rn-screen[data-sid="A01"] input[type=checkbox]'); S.session = { on: true, trust: !!(tr && tr.checked), role: a.role, until: Date.now() + (tr && tr.checked ? 12 : 8) * 3600000 }; ch = true; }
    else if (!on && S.session.on) { S.session.on = false; ch = true; }
    else if (on && S.session.role !== a.role) { S.session.role = a.role; ch = true; }
    if (ch) save();
  });

  // ---------------------------------------------------------------- A05 riders
  screen('A05', function (dc, redraw) {
    var pool = allRiders(), q = f('A05', 'q', ''), fl = f('A05', 'f', 'All'), rows = pool.filter(function (r) { return (fl === 'All' || r.status === fl) && (!q || (r.name + r.id + r.city + r.phone).toLowerCase().indexOf(q.toLowerCase()) >= 0); });
    dc.appendChild(kpis([['Riders', pool.length.toLocaleString('en-IN'), 'sample + live ops'], ['Active', String(pool.filter(function (r) { return r.status === 'Active'; }).length)], ['Flagged', String(pool.filter(function (r) { return r.status === 'Flagged'; }).length)], ['Blocked', String(pool.filter(function (r) { return r.status === 'Blocked'; }).length)]]));
    dc.appendChild(h('div', { class: 'a-bar' }, [chips(['All', 'Active', 'Flagged', 'Blocked'], fl, function (o) { setf('A05', 'f', o); }), h('span', { class: 'sp' }), search('Search name, ID, city or phone', q, function (v) { filt.A05.q = v; draw('A05'); })]));
    dc.appendChild(card('Riders (' + rows.length + ')', null, rows.length ? table([['ID', function (r) { return r.id; }], ['Name', function (r) { return r.name; }], ['Phone', function (r) { return r.reveal ? '+91 ' + r.phone : mask(r.phone); }], ['City', function (r) { return r.city; }], ['Rides', function (r) { return String(r.rides); }], ['Rating', function (r) { return r.rating === '—' ? '—' : '\u2605 ' + r.rating; }], ['Wallet', function (r) { return money(r.wallet); }], ['Status', function (r) { return st(r.status, r.status === 'Active' ? 'ok' : r.status === 'Blocked' ? 'bad' : 'warn'); }]], rows, riderDrawer) : h('div', { class: 'a-empty' }, 'No riders match. Clear the search or filter.')));
  });
  function riderDrawer(r) {
    overlayOps(r);
    drawer(r.name + ' \u00B7 ' + r.id, function (b, close) {
      b.appendChild(h('div', { class: 'dcard' }, [kv('Phone', r.reveal ? '+91 ' + r.phone : mask(r.phone)), kv('City', r.city), kv('Member since', String(r.since)), kv('Rides', String(r.rides)), kv('Rating', r.rating === '—' ? '—' : '\u2605 ' + r.rating), kv('Wallet', money(r.wallet)), kv('Status', r.status), r.live ? kv('Source', 'Live ops (Platform control)') : null]));
      b.appendChild(btn(r.reveal ? 'Hide full number' : 'Reveal full number (logged)', 'g', function () { if (r.reveal) { r.reveal = false; if (!r.live) save(); close(); draw('A05'); return; } act('user.pii.view_full', 'view a full phone number', 'pii.viewed', r.id).then(function (ok) { if (ok) { r.reveal = true; if (!r.live) save(); close(); draw('A05'); riderDrawer(r); } }); }));
      b.appendChild(L.field({ name: 'credit', label: 'Goodwill credit (\u20B9)', type: 'tel', inputmode: 'numeric', maxlength: 4 }));
      b.appendChild(btn('Credit wallet', '', function () {
        UI.clearErrors(); var a = parseInt(UI.val('credit'), 10); if (!(a >= 10 && a <= 2000)) { UI.fieldError('credit', 'Enter \u20B910 to \u20B92,000.'); return; }
        if (r._mutBusy) return; r._mutBusy = true;
        act('payment.refund', 'credit a customer', 'refund.issued', r.id).then(function (ok) {
          r._mutBusy = false; if (!ok) return;
          var paise = a * 100; r.wallet += paise; if (!r.live) save();
          pushWallet(r.phone, r.name, paise, 'Goodwill credit from Admin riders (A05)', 'Adjustment', '', 'admin-A05');
          close(); draw('A05'); UI.toast(money(paise) + ' credited to ' + r.name + ' (ops ledger updated).', 'info');
        }, function () { r._mutBusy = false; });
      }));
      b.appendChild(btn(r.status === 'Blocked' ? 'Unblock account' : 'Block account', r.status === 'Blocked' ? 'g' : 'bad', function () {
        var to = r.status === 'Blocked' ? 'Active' : 'Blocked';
        UI.confirm((to === 'Blocked' ? 'Block ' : 'Unblock ') + r.name + '? This updates the shared ops record and audit log.', to === 'Blocked' ? 'Block' : 'Unblock').then(function (y) {
          if (!y) return; if (r._mutBusy) return; r._mutBusy = true;
          act('fraud.block_account', to === 'Blocked' ? 'block an account' : 'unblock an account', to === 'Blocked' ? 'account.blocked' : 'account.unblocked', r.id).then(function (ok) {
            r._mutBusy = false; if (!ok) return;
            r.status = to; if (!r.live) save();
            pushBlock(r.phone, r.name, to === 'Blocked', to === 'Blocked' ? 'Blocked from Admin riders (A05)' : '');
            close(); draw('A05'); UI.toast(r.name + ' ' + to.toLowerCase() + ' (ops synced).', 'info');
          }, function () { r._mutBusy = false; });
        });
      }));
    });
  }

  // ---------------------------------------------------------------- A08 vehicles
  function vstate(v) { if (v.susp) return 'Suspended'; var d = (v.due - Date.now()) / 86400000; return d < 0 ? 'Expired' : d < 15 ? 'Due soon' : 'OK'; }
  screen('A08', function (dc) {
    var fl = f('A08', 'f', 'All'), q = f('A08', 'q', ''), rows = S.vehicles.filter(function (v) { return (fl === 'All' || vstate(v) === fl) && (!q || (v.plate + v.model + v.owner).toLowerCase().indexOf(q.toLowerCase()) >= 0); });
    var cnt = function (s) { return S.vehicles.filter(function (v) { return vstate(v) === s; }).length; };
    dc.appendChild(kpis([['Vehicles', String(S.vehicles.length)], ['Inspection OK', String(cnt('OK'))], ['Due in 15 days', String(cnt('Due soon'))], ['Expired / suspended', String(cnt('Expired') + cnt('Suspended'))]]));
    dc.appendChild(h('div', { class: 'a-bar' }, [chips(['All', 'OK', 'Due soon', 'Expired', 'Suspended'], fl, function (o) { setf('A08', 'f', o); }), h('span', { class: 'sp' }), search('Search plate, model or owner', q, function (v) { filt.A08.q = v; draw('A08'); })]));
    dc.appendChild(card('Fleet (' + rows.length + ')', null, rows.length ? table([['Plate', function (v) { return v.plate; }], ['Model', function (v) { return v.model; }], ['Type', function (v) { return v.type; }], ['Owner', function (v) { return v.owner; }], ['Inspection due', function (v) { return new Date(v.due).toDateString().slice(4); }], ['Status', function (v) { var s = vstate(v); return st(s, s === 'OK' ? 'ok' : s === 'Due soon' ? 'warn' : 'bad'); }]], rows, function (v) {
      drawer(v.plate, function (b, close) {
        b.appendChild(h('div', { class: 'dcard' }, [kv('Model', v.model), kv('Type', v.type), kv('Owner', v.owner), kv('Inspection due', new Date(v.due).toDateString()), kv('Status', vstate(v))]));
        b.appendChild(btn('Record inspection passed (+1 year)', '', function () { act('driver.verify', 'record a vehicle inspection', 'vehicle.inspected', v.plate).then(function (ok) { if (!ok) return; v.due = Date.now() + 365 * 86400000; v.susp = false; save(); close(); draw('A08'); UI.toast(v.plate + ' inspection recorded.', 'info'); }); }));
        b.appendChild(btn(v.susp ? 'Lift suspension' : 'Suspend vehicle', v.susp ? 'g' : 'bad', function () { act('driver.verify', v.susp ? 'lift a vehicle suspension' : 'suspend a vehicle', 'vehicle.status_changed', v.plate).then(function (ok) { if (!ok) return; v.susp = !v.susp; save(); close(); draw('A08'); UI.toast(v.plate + (v.susp ? ' suspended.' : ' back in service.'), 'info'); }); }));
      });
    }) : h('div', { class: 'a-empty' }, 'No vehicles match.')));
  });

  // ---------------------------------------------------------------- A09 pricing & surge (editable + simulator)
  var FH = ['Vehicle', 'Base', 'Per km', 'Per min', 'Minimum', 'Cancel fee', 'Waiting / min'];
  function quote(row, km, min, surge) { var f = row[1] + row[2] * km + row[3] * min; return Math.max(row[4], f) * surge; }
  screen('A09', function (dc) {
    var edit = f('A09', 'edit', false), sim = f('A09', 'sim', { v: 'Cab', km: 9.8, min: 27, zone: 'HYD-HITEC-01' });
    dc.appendChild(h('div', { class: 'banner info' }, 'Changes to fare rules apply from the next quote. Government fare caps are enforced as hard limits.'));
    var tb = table(FH.map(function (hd, i) { return [hd, function (r) { if (i === 0) return r[0]; if (!edit) return i === 3 || i === 6 ? '\u20B9' + r[i].toFixed(1) : '\u20B9' + r[i]; var inp = h('input', { class: 'a-cell', type: 'number', step: i === 3 ? '0.1' : '1', min: 0, max: 999, value: r[i], 'aria-label': r[0] + ' ' + hd, 'data-r': r[0], 'data-i': i }); return inp; }]; }), S.fares.rows);
    dc.appendChild(card('Fare rules \u00B7 Hyderabad \u00B7 v' + S.fares.v, h('span', { class: 'a-bar' }, edit ? [btn('Save as v' + (S.fares.v + 1), '', function () {
      var vals = UI.qa('#mock .a-cell[data-r]'), next = JSON.parse(JSON.stringify(S.fares.rows)), bad = null, changes = [];
      vals.forEach(function (i) { var r = next.filter(function (x) { return x[0] === i.dataset.r; })[0], k = +i.dataset.i, v = parseFloat(i.value); if (!(v >= 0 && v <= 999)) bad = i; else { if (v !== r[k]) changes.push(r[0] + ' ' + FH[k].toLowerCase() + ' ' + r[k] + ' \u2192 ' + v); r[k] = v; } });
      if (bad) { bad.focus(); UI.toast('Enter a number between 0 and 999.', 'error'); return; } if (!changes.length) { UI.toast('Nothing changed.', 'info'); filt.A09.edit = false; draw('A09'); return; }
      act('pricing.edit', 'change fare rules', 'pricing.rules_changed', 'fares:HYD').then(function (ok) { if (!ok) return; S.fares.rows = next; S.fares.v++; S.fares.history.unshift({ v: S.fares.v, at: Date.now(), by: 'Priya K.', note: changes.slice(0, 3).join('; ') }); save(); filt.A09.edit = false; draw('A09'); UI.toast('Fare rules v' + S.fares.v + ' published.', 'info'); });
    }), btn('Cancel', 'g', function () { setf('A09', 'edit', false); })] : [btn('Edit rules', '', function () { setf('A09', 'edit', true); }), btn('Version history', 'g', function () { drawer('Fare rule versions', function (b) { S.fares.history.forEach(function (x) { b.appendChild(h('div', { class: 'dcard' }, [h('b', null, 'v' + x.v + ' \u00B7 ' + L.fdt(x.at)), h('span', { class: 'a-note' }, x.by + ' \u00B7 ' + x.note)])); }); }); })]), tb));
    // simulator
    var out = h('b', { class: 'big-num' }), brk = h('div', { class: 'a-note' });
    var vSel = h('select', { class: 'rn-input', 'aria-label': 'Vehicle' }, S.fares.rows.map(function (r) { return h('option', { value: r[0] }, r[0]); })); vSel.value = sim.v;
    var zSel = h('select', { class: 'rn-input', 'aria-label': 'Zone' }, S.surge.map(function (z) { return h('option', { value: z[0] }, z[0] + ' (' + z[2] + 'x)'); })); zSel.value = sim.zone;
    var kmI = h('input', { class: 'a-cell', type: 'number', min: 0.5, max: 300, step: 0.1, value: sim.km, 'aria-label': 'Distance km' }), mnI = h('input', { class: 'a-cell', type: 'number', min: 1, max: 600, value: sim.min, 'aria-label': 'Minutes' });
    var calc = function () { sim.v = vSel.value; sim.zone = zSel.value; sim.km = +kmI.value || 0; sim.min = +mnI.value || 0; var r = S.fares.rows.filter(function (x) { return x[0] === sim.v; })[0], z = S.surge.filter(function (x) { return x[0] === sim.zone; })[0], fare = quote(r, sim.km, sim.min, z[2]); out.textContent = '\u20B9' + fare.toFixed(2); brk.textContent = 'Base \u20B9' + r[1] + ' + ' + sim.km + ' km \u00D7 \u20B9' + r[2] + ' + ' + sim.min + ' min \u00D7 \u20B9' + r[3] + ' (min \u20B9' + r[4] + ') \u00D7 surge ' + z[2] + 'x \u00B7 rider also pays 5% GST'; };
    [vSel, zSel, kmI, mnI].forEach(function (i) { i.addEventListener('input', calc); });
    dc.appendChild(h('div', { class: 'dgrid x-grid-template-columns-1fr-1fr' }, [card('Simulate a trip', null, [h('div', { class: 'a-bar' }, [vSel, zSel, kmI, h('span', { class: 'a-note' }, 'km'), mnI, h('span', { class: 'a-note' }, 'min')]), out, brk]),
      card('Surge zones', h('span', { class: 'a-live' }, 'live'), table([['Zone', function (z) { return z[0]; }], ['Demand / supply', function (z) { return z[1].toFixed(1); }], ['Current', function (z) { return z[2].toFixed(1) + 'x'; }], ['Cap', function (z) { return z[3] + 'x'; }], ['Mode', function (z) { return h('button', { type: 'button', class: 'a-chip' + (z[4] === 'Auto' ? ' on' : ''), on: { click: function () { act('pricing.edit', 'change surge mode', 'pricing.surge_mode', z[0]).then(function (ok) { if (!ok) return; z[4] = z[4] === 'Auto' ? 'Manual' : 'Auto'; if (z[4] === 'Manual') z[2] = 1.0; save(); draw('A09'); UI.toast(z[0] + ' surge ' + z[4].toLowerCase() + '.', 'info'); }); } } }, z[4]); }]], S.surge))]));
    calc(); dc.appendChild(btn('Daily fees, taxes & zone rates \u2192', 'g', function () { UI.go('A29'); }));
  });
  L.every(function () { // surge drifts with demand
    if (Math.random() > 0.2) return; S.surge.forEach(function (z) { z[1] = Math.max(0.5, Math.min(3, +(z[1] + (Math.random() - 0.5) * 0.3).toFixed(2))); if (z[4] === 'Auto') z[2] = Math.min(z[3], Math.max(1, +(1 + (z[1] - 1) * 0.3).toFixed(1))); });
    if (UI.sid === 'A09' && !filt.A09.edit && !UI.q('#mock .a-scrim') && document.activeElement && !/INPUT|SELECT/.test(document.activeElement.tagName)) draw('A09');
  });

  // ---------------------------------------------------------------- A29 daily fees & taxes
  screen('A29', function (dc) {
    dc.appendChild(h('div', { class: 'banner info' }, 'Drivers keep 100% of the fare and pay a flat daily fee only on days they drive. GST is collected from riders and passed to the government.'));
    dc.appendChild(card('Daily fee & GST by vehicle', btn('Save changes', '', function () {
      var bad = false, nx = S.fees.map(function (r) { var a = parseFloat(UI.q('#mock [data-fee="' + r[0] + '"]').value), g = parseFloat(UI.q('#mock [data-gst="' + r[0] + '"]').value); if (!(a >= 0 && a <= 200) || [0, 5, 12, 18].indexOf(g) < 0) bad = true; return [r[0], a, g]; });
      if (bad) { UI.toast('Fee must be \u20B90-200 and GST one of 0, 5, 12 or 18%.', 'error'); return; }
      act('pricing.edit', 'change daily fees and taxes', 'pricing.fees_changed', 'fees:HYD').then(function (ok) { if (!ok) return; S.fees = nx; save(); draw('A29'); UI.toast('Daily fees saved.', 'info'); });
    }), table([['Vehicle', function (r) { return r[0]; }], ['Daily fee (\u20B9)', function (r) { return h('input', { class: 'a-cell', type: 'number', min: 0, max: 200, value: r[1], 'data-fee': r[0], 'aria-label': r[0] + ' daily fee' }); }], ['GST %', function (r) { return h('input', { class: 'a-cell', type: 'number', value: r[2], 'data-gst': r[0], 'aria-label': r[0] + ' GST' }); }], ['Driver keeps on \u20B9500 fare', function (r) { return '\u20B9500 (fee \u20B9' + r[1] + '/day)'; }]], S.fees)));
  });

  // ---------------------------------------------------------------- A10 zones
  screen('A10', function (dc) {
    var city = f('A10', 'c', 'All'), rows = S.zones.filter(function (z) { return city === 'All' || z.city === city; });
    dc.appendChild(h('div', { class: 'a-bar' }, [chips(['All'].concat(CITIES), city, function (o) { setf('A10', 'c', o); }), h('span', { class: 'sp' }), btn('Add zone', '', zoneDrawer)]));
    dc.appendChild(card('Zones & geofences (' + rows.length + ')', null, rows.length ? table([['Zone', function (z) { return z.id; }], ['City', function (z) { return z.city; }], ['Type', function (z) { return z.type; }], ['Radius', function (z) { return z.km + ' km'; }], ['Active', function (z) { return tog(z.on, function (v, done) { act('coverage.publish', (v ? 'activate' : 'pause') + ' a zone', 'zone.changed', z.id).then(function (ok) { done(ok); if (ok) { z.on = v; save(); UI.toast(z.id + (v ? ' active.' : ' paused.'), 'info'); } }); }, z.id + ' active'); }]], rows) : h('div', { class: 'a-empty' }, 'No zones in ' + city + ' yet. Add one.')));
  });
  function zoneDrawer() {
    drawer('Add zone', function (b, close) {
      b.appendChild(L.field({ name: 'zid', label: 'Zone ID', placeholder: 'HYD-KONDAPUR-01', maxlength: 24 })); b.appendChild(L.field({ name: 'zcity', label: 'City', select: CITIES })); b.appendChild(L.field({ name: 'ztype', label: 'Type', select: ['Service', 'Surge', 'Airport pickup', 'No pickup', 'Women safety priority'] })); b.appendChild(L.field({ name: 'zkm', label: 'Radius (km)', type: 'number', value: 2, maxlength: 4 }));
      b.appendChild(btn('Create zone', '', function () { UI.clearErrors(); var id = UI.val('zid').trim().toUpperCase(), km = parseFloat(UI.val('zkm')), bad = false; if (!/^[A-Z]{3}-[A-Z0-9-]{2,20}$/.test(id)) { UI.fieldError('zid', 'Use CITY-NAME format, e.g. HYD-KONDAPUR-01.'); bad = true; } else if (S.zones.some(function (z) { return z.id === id; })) { UI.fieldError('zid', 'This zone already exists.'); bad = true; } if (!(km >= 0.2 && km <= 50)) { UI.fieldError('zkm', 'Radius 0.2 to 50 km.'); bad = true; } if (bad) return; act('coverage.publish', 'create a zone', 'zone.created', id).then(function (ok) { if (!ok) return; S.zones.unshift({ id: id, city: UI.val('zcity'), type: UI.val('ztype'), km: km, on: true }); save(); close(); draw('A10'); UI.toast('Zone ' + id + ' created.', 'info'); }); }));
    });
  }

  // ---------------------------------------------------------------- A11 payments & refunds
  screen('A11', function (dc) {
    var fl = f('A11', 'f', 'All'), q = f('A11', 'q', ''), tx = S.tx, rows = tx.filter(function (t) { return (fl === 'All' || (fl === 'Refunds' ? t.status === 'Refunded' : fl === 'Disputes' ? t.status === 'Disputed' : t.status === fl)) && (!q || (t.id + t.ride + t.rider).toLowerCase().indexOf(q.toLowerCase()) >= 0); });
    var col = tx.filter(function (t) { return t.status === 'Captured'; }).reduce(function (s, t) { return s + t.paise; }, 0), ref = tx.reduce(function (s, t) { return s + t.refunded; }, 0), fails = tx.filter(function (t) { return t.status === 'Failed'; }).length;
    dc.appendChild(kpis([['Collected (sample)', money(col), h('span', { class: 'a-live' }, 'live')], ['Refunded', money(ref), tx.filter(function (t) { return t.refunded; }).length + ' refunds'], ['Failed payments', (fails / tx.length * 100).toFixed(1) + '%', fails + ' of ' + tx.length], ['Cash owed by drivers', money(tx.filter(function (t) { return t.status === 'Cash owed'; }).reduce(function (s, t) { return s + t.paise; }, 0))]]));
    dc.appendChild(h('div', { class: 'a-bar' }, [chips(['All', 'Captured', 'Failed', 'Refunds', 'Disputes', 'Cash owed'], fl, function (o) { setf('A11', 'f', o); }), h('span', { class: 'sp' }), search('Search payment, ride or rider', q, function (v) { filt.A11.q = v; draw('A11'); }), btn('Reconciliation report (CSV)', 'g', function () { act('report.export', 'export a report', 'report.exported', 'payments').then(function (ok) { if (!ok) return; download('reconciliation-' + new Date().toISOString().slice(0, 10) + '.csv', [['payment', 'ride', 'rider', 'method', 'amount_inr', 'refunded_inr', 'status', 'gateway_ref', 'time']].concat(rows.map(function (t) { return [t.id, t.ride, t.rider, t.method, t.paise / 100, t.refunded / 100, t.status, t.ref, new Date(t.at).toISOString()]; }))); UI.toast('Report downloaded (' + rows.length + ' rows).', 'info'); }); })]));
    dc.appendChild(card('Transactions (' + rows.length + ')', null, rows.length ? table([['Payment', function (t) { return t.id; }], ['Ride', function (t) { return t.ride; }], ['Rider', function (t) { return t.rider; }], ['Method', function (t) { return t.method; }], ['Amount', function (t) { return money(t.paise) + (t.refunded ? ' (-' + money(t.refunded) + ')' : ''); }], ['Status', function (t) { return st(t.status, t.status === 'Captured' ? 'ok' : t.status === 'Failed' ? 'bad' : 'warn'); }], ['Gateway ref', function (t) { return t.ref; }], ['Time', function (t) { return L.ftime(t.at); }]], rows.slice(0, 50), refundDrawer) : h('div', { class: 'a-empty' }, 'No transactions match.')));
  });
  function refundDrawer(t) {
    drawer('Payment ' + t.id, function (b, close) {
      b.appendChild(h('div', { class: 'dcard' }, [kv('Ride', t.ride), kv('Rider', t.rider), kv('Method', t.method), kv('Amount', money(t.paise)), kv('Already refunded', money(t.refunded)), kv('Status', t.status), kv('Time', L.fdt(t.at))]));
      if (t.status === 'Failed') { b.appendChild(btn('Retry collection', '', function () { act('payment.refund', 'retry a payment', 'payment.retried', t.id).then(function (ok) { if (!ok) return; t.status = Math.random() < 0.8 ? 'Captured' : 'Failed'; save(); close(); draw('A11'); UI.toast(t.status === 'Captured' ? 'Payment captured on retry.' : 'Retry failed again. Rider was notified.', t.status === 'Captured' ? 'info' : 'error'); }); })); return; }
      var left = t.paise - t.refunded; if (left <= 0) { b.appendChild(h('div', { class: 'a-empty' }, 'Fully refunded.')); return; }
      b.appendChild(L.field({ name: 'ramt', label: 'Refund amount (\u20B9, up to ' + (left / 100) + ')', type: 'number', value: Math.min(left / 100, 120) }));
      b.appendChild(L.field({ name: 'rwhy', label: 'Reason', select: ['Driver took longer route', 'Charged after cancelling', 'Service not delivered', 'Duplicate charge', 'Goodwill'] }));
      b.appendChild(h('div', { class: 'a-note' }, 'Refunds above \u20B9500 need a finance manager (switch role on A20 to try).'));
      b.appendChild(btn('Issue refund', '', function () { UI.clearErrors(); var a = Math.round(parseFloat(UI.val('ramt')) * 100); if (!(a > 0 && a <= left)) { UI.fieldError('ramt', 'Enter up to ' + money(left) + '.'); return; } if (a > 50000 && ['FINANCE_MANAGER', 'SUPER_ADMIN'].indexOf(role()) < 0) { UI.fieldError('ramt', 'Above \u20B9500 needs a finance manager.'); return; }
        if (t._mutBusy) return; t._mutBusy = true;
        act('payment.refund', 'issue a refund', 'refund.issued', t.id).then(function (ok) {
          t._mutBusy = false; if (!ok) return;
          t.refunded += a; if (t.refunded >= t.paise) t.status = 'Refunded'; save();
          var ph = phoneForRiderName(t.rider); if (ph) pushWallet(ph, t.rider, a, 'Refund for ' + t.ride + ' (' + UI.val('rwhy') + ')', 'Refund', t.ride, 'admin-A11');
          close(); draw('A11'); UI.toast(money(a) + ' refunded to ' + t.method + (ph ? ' · ops ledger updated' : '') + '. Rider notified (simulated).', 'info');
        }, function () { t._mutBusy = false; }); }));
    });
  }
  L.every(function () { if (Math.random() > 0.15) return; var r = Math.random(), m = ['UPI', 'Card', 'UPI', 'Wallet'][Math.floor(r * 4)]; S.tx.unshift({ id: 'pay_' + Math.floor(Date.now() / 1000 % 1e6).toString(16), ride: 'RN-' + String(126 + Math.floor(Math.random() * 900)).padStart(5, '0'), method: m, paise: Math.round(80 + Math.random() * 600) * 100, refunded: 0, status: Math.random() < 0.06 ? 'Failed' : 'Captured', at: Date.now(), ref: 'pay_' + Math.floor(Math.random() * 1e6).toString(36), rider: NAMES[Math.floor(Math.random() * NAMES.length)] }); if (S.tx.length > 120) S.tx.length = 120; save(); if (UI.sid === 'A11' && !UI.q('#mock .a-scrim') && !(document.activeElement && document.activeElement.classList.contains('a-search'))) draw('A11'); });

  // ---------------------------------------------------------------- A14 fraud
  screen('A14', function (dc) {
    var fl = f('A14', 'f', 'Open'), rows = S.fraud.filter(function (x) { return fl === 'All' || x.state === fl; }).sort(function (a, b) { return b.score - a.score; });
    dc.appendChild(kpis([['Open cases', String(S.fraud.filter(function (x) { return x.state === 'Open'; }).length)], ['High risk (80+)', String(S.fraud.filter(function (x) { return x.state === 'Open' && x.score >= 80; }).length)], ['Blocked', String(S.fraud.filter(function (x) { return x.state === 'Blocked'; }).length)], ['Cleared', String(S.fraud.filter(function (x) { return x.state === 'Cleared'; }).length)]]));
    dc.appendChild(chips(['Open', 'Blocked', 'Cleared', 'All'], fl, function (o) { setf('A14', 'f', o); }));
    dc.appendChild(card('Fraud review queue', h('span', { class: 'a-live' }, 'model v7 scoring'), rows.length ? table([['Case', function (x) { return x.id; }], ['Account', function (x) { return x.who; }], ['Signal', function (x) { return x.signal; }], ['Risk', function (x) { return st(String(x.score), x.score >= 80 ? 'bad' : x.score >= 65 ? 'warn' : ''); }], ['Raised', function (x) { return L.fdt(x.at); }], ['State', function (x) { return x.state; }], ['', function (x) { return x.state !== 'Open' ? '' : h('span', { class: 'a-bar' }, [btn('Block', 'bad', function () { decide(x, 'Blocked'); }), btn('Clear', 'g', function () { decide(x, 'Cleared'); })]); }]], rows) : h('div', { class: 'a-empty' }, 'Queue is empty. Nice work.')));
  });
  function decide(x, to) { act(to === 'Blocked' ? 'fraud.block_account' : 'incident.view', to === 'Blocked' ? 'block an account' : 'clear a fraud case', 'fraud.' + to.toLowerCase(), x.id).then(function (ok) { if (!ok) return; var prev = x.state; x.state = to; save(); draw('A14'); UI.toast(x.id + ' ' + to.toLowerCase() + '. Undo?', 'info'); undoBar('Undo ' + to.toLowerCase(), function () { x.state = prev; save(); draw('A14'); }); }); }
  function undoBar(label, fn) { var desk = UI.q('#mock .desk'); if (!desk) return; var old = UI.q('.a-undo', desk); if (old) old.remove(); var b = h('div', { class: 'a-undo', role: 'status' }, [h('span', null, 'Done.'), h('button', { type: 'button', class: 'dbtn g', on: { click: function () { fn(); b.remove(); UI.toast('Undone.', 'info'); } } }, label)]); desk.appendChild(b); setTimeout(function () { b.remove(); }, 6000); }

  // ---------------------------------------------------------------- A16 AI insights
  var ZONES = ['Hitec City', 'Banjara Hills', 'Airport', 'Gachibowli', 'Secunderabad', 'Old City'];
  screen('A16', function (dc) {
    var now = new Date(), r = rng('ai' + now.getHours() + Math.floor(now.getMinutes() / 2)), fc = ZONES.map(function (z) { return [z, Math.round(40 + r() * 160), Math.round(30 + r() * 120)]; });
    dc.appendChild(h('div', { class: 'a-bar' }, [h('span', { class: 'a-live' }, 'Forecast refreshed ' + L.ftime(Date.now())), h('span', { class: 'sp' }), h('span', { class: 'a-note' }, 'Suggestions only - a person approves every change.')]));
    var chart = h('div', { class: 'a-chart', 'aria-label': 'Demand vs supply next hour' }); fc.forEach(function (x) { var a = h('i', { title: x[0] + ' demand ' + x[1] }), b = h('i', { class: 'b', title: x[0] + ' drivers ' + x[2] }); a.style.height = x[1] / 2 + '%'; b.style.height = x[2] / 2 + '%'; chart.appendChild(a); chart.appendChild(b); });
    dc.appendChild(card('Next-hour demand (teal) vs drivers (purple)', null, [chart, h('div', { class: 'a-bar a-note' }, ZONES.map(function (z) { return h('span', null, z); }))]));
    var sug = fc.filter(function (x) { return x[1] > x[2] * 1.3; }).map(function (x) { return { id: 'AI-' + x[0], text: 'Send a driver nudge to ' + x[0] + ': demand ' + x[1] + ' vs ' + x[2] + ' drivers', perm: 'campaign.send' }; });
    sug.push({ id: 'AI-churn', text: '1,240 riders inactive 30 days - offer SAVER40', perm: 'coupon.create' }); sug.push({ id: 'AI-eta', text: 'Pickup ETA rising at Airport (+3 min) - open 2 more pickup bays', perm: 'ride.dispatch' });
    S.applied = S.applied || [];
    dc.appendChild(card('Suggestions', null, table([['Suggestion', function (s) { return s.text; }], ['', function (s) { return S.applied.indexOf(s.id) >= 0 ? st('Applied', 'ok') : h('span', { class: 'a-bar' }, [btn('Apply', '', function () { act(s.perm, 'apply an AI suggestion', 'ai.suggestion_applied', s.id).then(function (ok) { if (!ok) return; S.applied.push(s.id); save(); draw('A16'); UI.toast('Applied. Logged in the audit trail.', 'info'); }); }), btn('Dismiss', 'g', function () { S.applied.push(s.id); save(); draw('A16'); })]); }]], sug)));
  });
  L.every(function () { if (UI.sid === 'A16' && new Date().getSeconds() % 20 === 0 && !UI.q('#mock .a-scrim')) draw('A16'); });

  // ---------------------------------------------------------------- A17 reports
  screen('A17', function (dc) {
    var p = f('A17', 'p', '7 days'), n = { 'Today': 24, '7 days': 7, '30 days': 30, '90 days': 13 }[p], r = rng('rep' + p), vals = []; for (var i = 0; i < n; i++) vals.push(Math.round(800 + r() * 900) * (p === 'Today' ? 0.1 : p === '90 days' ? 7 : 1));
    var tot = vals.reduce(function (s, v) { return s + v; }, 0), mx = Math.max.apply(null, vals);
    dc.appendChild(h('div', { class: 'a-bar' }, [chips(['Today', '7 days', '30 days', '90 days'], p, function (o) { setf('A17', 'p', o); }), h('span', { class: 'sp' }), btn('Export CSV', '', function () { act('report.export', 'export a report', 'report.exported', 'trips:' + p).then(function (ok) { if (!ok) return; download('trips-' + p.replace(' ', '') + '.csv', [['bucket', 'trips', 'gmv_inr']].concat(vals.map(function (v, i) { return [i + 1, Math.round(v), Math.round(v * 214)]; }))); UI.toast('Report exported.', 'info'); }); })]));
    dc.appendChild(kpis([['Trips', Math.round(tot).toLocaleString('en-IN')], ['GMV', money(Math.round(tot * 21400))], ['Avg pickup', (4 + r() * 2).toFixed(1) + ' min'], ['Completion', (92 + r() * 5).toFixed(1) + '%'], ['Rider rating', (4.6 + r() * 0.3).toFixed(2)]]));
    var ch = h('div', { class: 'a-chart' }); vals.forEach(function (v, i) { var b = h('i', { title: Math.round(v) + ' trips' }); b.style.height = Math.round(v / mx * 100) + '%'; ch.appendChild(b); });
    dc.appendChild(card('Trips per ' + (p === 'Today' ? 'hour' : p === '90 days' ? 'week' : 'day'), null, ch));
  });

  // ---------------------------------------------------------------- A18 government reports (maker-checker)
  var GSTEP = ['Draft', 'Pending approval', 'Approved', 'Submitted'];
  screen('A18', function (dc) {
    dc.appendChild(h('div', { class: 'a-bar' }, [h('span', { class: 'a-note' }, 'Reports are created by safety managers and approved by a super admin before they leave the company.'), h('span', { class: 'sp' }), btn('New report', '', function () {
      drawer('New government report', function (b, close) {
        b.appendChild(L.field({ name: 'gtitle', label: 'Report', select: ['Monthly trip summary - Transport Dept.', 'Safety incidents - Police liaison', 'Driver verification status', 'Women safety measures (quarterly)'] })); b.appendChild(L.field({ name: 'gper', label: 'Period', select: ['Oct 2026', 'Sep 2026', 'Q3 2026'] })); b.appendChild(L.field({ name: 'gnote', label: 'Notes (optional)', area: true, rows: 3 }));
        b.appendChild(btn('Create draft', '', function () { act('government_report.create', 'create a government report', 'gov_report.created', 'gov').then(function (ok) { if (!ok) return; S.gov.unshift({ id: 'GR-' + Date.now().toString(36).toUpperCase().slice(-5), title: UI.val('gtitle'), period: UI.val('gper'), state: 'Draft', by: RN.rbac.LABELS[role()], at: Date.now() }); save(); close(); draw('A18'); UI.toast('Draft created.', 'info'); }); }));
      });
    })]));
    dc.appendChild(card('Reports', null, table([['ID', function (g) { return g.id; }], ['Report', function (g) { return g.title; }], ['Period', function (g) { return g.period; }], ['Created by', function (g) { return g.by; }], ['State', function (g) { return st(g.state, g.state === 'Submitted' || g.state === 'Approved' ? 'ok' : 'warn'); }], ['', function (g) {
      var i = GSTEP.indexOf(g.state); if (i >= 3) return btn('Download', 'g', function () { download(g.id + '.csv', [['report', 'period', 'trips', 'incidents', 'verified_drivers'], [g.title, g.period, 184220, 37, 9412]]); });
      var perm = i === 1 ? 'government_report.approve' : 'government_report.create', lab = ['Send for approval', 'Approve', 'Submit to authority'][i];
      return btn(lab, '', function () { act(perm, lab.toLowerCase(), 'gov_report.' + GSTEP[i + 1].toLowerCase().replace(' ', '_'), g.id).then(function (ok) { if (!ok) return; g.state = GSTEP[i + 1]; save(); draw('A18'); UI.toast(g.id + ': ' + g.state + '.', 'info'); }); });
    }]], S.gov)));
  });

  // ---------------------------------------------------------------- A21 campaigns
  screen('A21', function (dc) {
    dc.appendChild(h('div', { class: 'a-bar' }, [h('span', { class: 'sp' }), btn('New campaign', '', campaignDrawer)]));
    dc.appendChild(card('Campaigns', h('span', { class: 'a-live' }, 'delivery live'), S.campaigns.length ? table([['Campaign', function (c) { return c.title; }], ['Channel', function (c) { return c.channel; }], ['Audience', function (c) { return c.audience; }], ['Sent', function (c) { return c.sent.toLocaleString('en-IN') + ' / ' + c.reach.toLocaleString('en-IN'); }], ['Opened', function (c) { return c.sent ? Math.round(c.opened / c.sent * 100) + '%' : '-'; }], ['State', function (c) { return st(c.state, c.state === 'Sent' ? 'ok' : 'warn'); }], ['', function (c) { return c.state === 'Scheduled' ? btn('Cancel', 'g', function () { c.state = 'Cancelled'; save(); draw('A21'); }) : ''; }]], S.campaigns) : h('div', { class: 'a-empty' }, 'No campaigns yet.')));
  });
  var AUD = { 'All riders - Hyderabad': 182000, 'Inactive 30 days': 1240 * 10, 'New riders this week': 6400, 'Drivers online now': 3120, 'Partners - restaurants': 940 };
  function campaignDrawer() {
    drawer('New campaign', function (b, close) {
      var ch = 'Push'; b.appendChild(L.field({ name: 'ctitle', label: 'Title', maxlength: 50 })); b.appendChild(L.field({ name: 'cmsg', label: 'Message', area: true, rows: 3, maxlength: 160 }));
      var cnt = h('div', { class: 'a-note' }, '0 / 160'); b.appendChild(cnt); UI.q('textarea', b).addEventListener('input', function (e) { cnt.textContent = e.target.value.length + ' / 160'; });
      b.appendChild(h('b', null, 'Channel')); b.appendChild(chips(['Push', 'SMS', 'WhatsApp', 'E-mail'], ch, function (o) { ch = o; UI.qa('.a-drawer .a-chip').forEach(function (x) { x.classList.toggle('on', x.textContent === o); }); }));
      b.appendChild(L.field({ name: 'caud', label: 'Audience', select: Object.keys(AUD) })); var est = h('div', { class: 'a-note' }); b.appendChild(est); var upd = function () { est.textContent = 'Estimated reach: ' + AUD[UI.val('caud')].toLocaleString('en-IN') + ' people (opted in only)'; }; UI.q('select[name=caud]', b).addEventListener('change', upd); upd();
      b.appendChild(L.field({ name: 'cwhen', label: 'Send', select: ['Now', 'In 1 hour', 'Tomorrow 9 AM'] }));
      b.appendChild(btn('Schedule campaign', '', function () { UI.clearErrors(); var t = UI.val('ctitle').trim(), m = UI.val('cmsg').trim(), bad = false; if (t.length < 4) { UI.fieldError('ctitle', 'Give the campaign a title.'); bad = true; } if (m.length < 10) { UI.fieldError('cmsg', 'Write at least 10 characters.'); bad = true; } if (bad) return;
        act('campaign.send', 'send a campaign', 'campaign.scheduled', t).then(function (ok) { if (!ok) return; S.campaigns.unshift({ id: 'CMP-' + (89 + S.campaigns.length), title: t, channel: ch, audience: UI.val('caud'), reach: AUD[UI.val('caud')], sent: 0, opened: 0, state: UI.val('cwhen') === 'Now' ? 'Sending' : 'Scheduled', at: Date.now() }); save(); close(); draw('A21'); UI.toast('Campaign ' + (UI.val('cwhen') === 'Now' ? 'sending.' : 'scheduled.'), 'info'); }); }));
    });
  }
  L.every(function () { var ch = false; S.campaigns.forEach(function (c) { if (c.state === 'Sending') { c.sent = Math.min(c.reach, c.sent + Math.ceil(c.reach / 12)); c.opened = Math.round(c.sent * 0.21); if (c.sent >= c.reach) c.state = 'Sent'; ch = true; } }); if (ch) { save(); if (UI.sid === 'A21' && !UI.q('#mock .a-scrim')) draw('A21'); } });

  // ---------------------------------------------------------------- A22 system configuration
  screen('A22', function (dc) {
    var city = f('A22', 'c', 'Hyderabad');
    dc.appendChild(h('div', { class: 'a-bar' }, [chips(Object.keys(S.flags), city, function (o) { setf('A22', 'c', o); }), h('span', { class: 'sp' }), h('span', { class: 'a-note' }, 'Changes need the Super admin role.')]));
    dc.appendChild(h('div', { class: 'dgrid x-grid-template-columns-1fr-1fr' }, [
      card('Provider adapters', h('span', { class: 'a-live' }, 'health checks'), table([['Capability', function (a) { return a[0]; }], ['Primary', function (a) { return a[1]; }], ['Fallback', function (a) { return a[2]; }], ['Serving', function (a) { return st(a[3], a[3] === 'Primary' ? 'ok' : 'warn'); }], ['', function (a) { return a[2] === '-' ? '' : btn(a[3] === 'Primary' ? 'Fail over' : 'Restore', 'g', function () { act('config.edit', 'switch a provider', 'config.provider_switched', a[0]).then(function (ok) { if (!ok) return; a[3] = a[3] === 'Primary' ? 'Fallback' : 'Primary'; save(); draw('A22'); UI.toast(a[0] + ' now served by ' + (a[3] === 'Primary' ? a[1] : a[2]) + '.', 'info'); }); }); }]], S.adapters)),
      card('Feature flags \u00B7 ' + city, null, table([['Flag', function (k) { return k; }], ['State', function (k) { return tog(S.flags[city][k], function (v, done) { act('config.edit', 'change a feature flag', 'config.flag_changed', city + ':' + k).then(function (ok) { done(ok); if (ok) { S.flags[city][k] = v; save(); UI.toast(k + ' ' + (v ? 'on' : 'off') + ' in ' + city + '.', 'info'); } }); }, k); }]], Object.keys(S.flags[city])))]));
  });

  // ---------------------------------------------------------------- A23 services & countries
  screen('A23', function (dc) {
    var cities = CITIES; dc.appendChild(h('div', { class: 'banner info' }, 'Turn services on or off per city. Riders see the change on their home screen within a minute.'));
    dc.appendChild(card('Service availability', null, table([['Service', function (s) { return s; }]].concat(cities.map(function (c) { return [c, function (s) { return tog(!!S.services[s][c], function (v, done) { act('config.edit', 'change service availability', 'service.toggled', s + ':' + c).then(function (ok) { done(ok); if (ok) { S.services[s][c] = v ? 1 : 0; save(); UI.toast(s + ' ' + (v ? 'launched' : 'paused') + ' in ' + c + '.', 'info'); } }); }, s + ' in ' + c); }]; })), Object.keys(S.services))));
  });

  // ---------------------------------------------------------------- A26 long distance & sharing
  screen('A26', function (dc) {
    var fl = f('A26', 'f', 'All'), rows = S.routes.filter(function (r) { return fl === 'All' || r.kind === fl; });
    dc.appendChild(kpis([['Routes', String(S.routes.length)], ['Seats sold', String(S.routes.reduce(function (s, r) { return s + r.booked; }, 0))], ['Occupancy', Math.round(S.routes.reduce(function (s, r) { return s + r.booked; }, 0) / S.routes.reduce(function (s, r) { return s + r.seats; }, 0) * 100) + '%', h('span', { class: 'a-live' }, 'live')]]));
    dc.appendChild(chips(['All', 'Bus', 'Shared cab', 'Self-drive'], fl, function (o) { setf('A26', 'f', o); }));
    dc.appendChild(card('Long-distance trips', null, table([['ID', function (r) { return r.id; }], ['Type', function (r) { return r.kind; }], ['Route', function (r) { return r.from + ' \u2192 ' + r.to; }], ['Departs', function (r) { return r.dep; }], ['Booked', function (r) { return r.booked + ' / ' + r.seats; }], ['Selling', function (r) { return tog(r.on, function (v, done) { act('ride.dispatch', (v ? 'resume' : 'pause') + ' a route', 'route.changed', r.id).then(function (ok) { done(ok); if (ok) { r.on = v; save(); UI.toast(r.id + (v ? ' on sale.' : ' paused.'), 'info'); } }); }, r.id + ' on sale'); }]], rows)));
  });
  L.every(function () { if (Math.random() > 0.1) return; var r = S.routes.filter(function (x) { return x.on && x.booked < x.seats; }); if (!r.length) return; r[Math.floor(Math.random() * r.length)].booked++; save(); if (UI.sid === 'A26' && !UI.q('#mock .a-scrim')) draw('A26'); });

  // ---------------------------------------------------------------- A25 coverage
  screen('A25', function (dc) {
    dc.appendChild(h('div', { class: 'banner ' + (S.published ? 'info' : 'warn') }, S.published ? 'Coverage zones published ' + L.fdt(S.published) + '. Riders download offline packs before these stretches.' : 'Draft changes are not yet published to the apps.'));
    dc.appendChild(card('Weak-signal stretches', btn('Publish coverage zones', '', function () { act('coverage.publish', 'publish coverage zones', 'coverage.zones_published', 'coverage').then(function (ok) { if (!ok) return; S.published = Date.now(); save(); draw('A25'); UI.toast('Coverage published to rider and driver apps.', 'info'); }); }), table([['Route', function (c) { return c[0]; }], ['Weakest point', function (c) { return c[1]; }], ['Signal', function (c) { return st(c[2] + '%', c[2] < 30 ? 'bad' : c[2] < 60 ? 'warn' : 'ok'); }], ['Fallback', function (c) { var s = h('select', { class: 'rn-input', 'aria-label': 'Fallback for ' + c[0] }, ['Live', 'SMS fallback', 'Offline pack'].map(function (o) { return h('option', { value: o }, o); })); s.value = c[3]; s.addEventListener('change', function () { c[3] = s.value; S.published = false; save(); draw('A25'); }); return s; }]], S.coverage)));
  });

  // ---------------------------------------------------------------- A28 deals & loyalty
  screen('A28', function (dc) {
    dc.appendChild(h('div', { class: 'a-bar' }, [h('span', { class: 'a-note' }, 'Coupons appear in the rider app offers carousel.'), h('span', { class: 'sp' }), btn('New coupon', '', function () { couponDrawer(null); })]));
    dc.appendChild(card('Coupons', null, table([['Code', function (c) { return h('b', null, c.code); }], ['Offer', function (c) { return c.kind === '%' ? c.val + '% off up to \u20B9' + c.cap : '\u20B9' + c.val + ' off'; }], ['Min order', function (c) { return c.min ? '\u20B9' + c.min : '-'; }], ['Used', function (c) { return c.uses.toLocaleString('en-IN') + ' / ' + c.limit.toLocaleString('en-IN'); }], ['Ends', function (c) { return c.ends; }], ['Live', function (c) { return tog(c.on, function (v, done) { act('coupon.create', (v ? 'activate' : 'pause') + ' a coupon', 'coupon.changed', c.code).then(function (ok) { done(ok); if (ok) { c.on = v; save(); UI.toast(c.code + (v ? ' live.' : ' paused.'), 'info'); } }); }, c.code + ' live'); }]], S.coupons, couponDrawer)));
    dc.appendChild(card('Loyalty tiers', null, table([['Tier', function (t) { return t[0]; }], ['Rides / month', function (t) { return t[1]; }], ['Members', function (t) { return t[2]; }], ['Perk', function (t) { return t[3]; }]], [['Silver', '5+', '64,210', '5% back in wallet'], ['Gold', '15+', '12,940', 'Priority pickup + 8% back'], ['Platinum', '30+', '2,118', 'Free cancellations + 12% back']])));
  });
  function couponDrawer(c) {
    drawer(c ? 'Edit ' + c.code : 'New coupon', function (b, close) {
      b.appendChild(L.field({ name: 'kcode', label: 'Code', value: c ? c.code : '', maxlength: 12 })); b.appendChild(L.field({ name: 'kkind', label: 'Type', select: [['%', 'Percent off'], ['flat', 'Flat amount']], value: c ? c.kind : '%' })); b.appendChild(L.field({ name: 'kval', label: 'Value', type: 'number', value: c ? c.val : 20 })); b.appendChild(L.field({ name: 'kcap', label: 'Max discount (\u20B9)', type: 'number', value: c ? c.cap : 100 })); b.appendChild(L.field({ name: 'kmin', label: 'Min order (\u20B9)', type: 'number', value: c ? c.min : 0 })); b.appendChild(L.field({ name: 'klimit', label: 'Total uses', type: 'number', value: c ? c.limit : 1000 })); b.appendChild(L.field({ name: 'kends', label: 'Ends', type: 'date', value: c ? c.ends : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }));
      b.appendChild(btn(c ? 'Save coupon' : 'Create coupon', '', function () { UI.clearErrors(); var code = UI.val('kcode').trim().toUpperCase(), kind = UI.val('kkind'), val = +UI.val('kval'), cap = +UI.val('kcap'), bad = false; if (!/^[A-Z0-9]{4,12}$/.test(code)) { UI.fieldError('kcode', '4-12 letters or digits.'); bad = true; } else if (S.coupons.some(function (x) { return x !== c && x.code === code; })) { UI.fieldError('kcode', 'Code already exists.'); bad = true; } if (kind === '%' ? !(val >= 5 && val <= 80) : !(val >= 10 && val <= 500)) { UI.fieldError('kval', kind === '%' ? '5 to 80 percent.' : '\u20B910 to \u20B9500.'); bad = true; } if (!(cap >= 10)) { UI.fieldError('kcap', 'At least \u20B910.'); bad = true; } if (!UI.val('kends') || UI.val('kends') < new Date().toISOString().slice(0, 10)) { UI.fieldError('kends', 'Pick a future date.'); bad = true; } if (bad) return;
        act('coupon.create', c ? 'edit a coupon' : 'create a coupon', c ? 'coupon.changed' : 'coupon.created', code).then(function (ok) { if (!ok) return; var o = { code: code, kind: kind, val: val, cap: kind === 'flat' ? val : cap, min: +UI.val('kmin') || 0, limit: +UI.val('klimit') || 1000, ends: UI.val('kends') }; if (c) Object.assign(c, o); else S.coupons.unshift(Object.assign(o, { uses: 0, on: true })); save(); close(); draw('A28'); UI.toast('Coupon ' + code + (c ? ' saved.' : ' created and live.'), 'info'); }); }));
    });
  }
  L.every(function () { if (Math.random() > 0.2) return; S.coupons.forEach(function (c) { if (c.on && c.uses < c.limit) c.uses += Math.floor(Math.random() * 3); }); if (UI.sid === 'A28' && !UI.q('#mock .a-scrim')) draw('A28'); });

  // ---------------------------------------------------------------- A30 disputes
  screen('A30', function (dc) {
    var fl = f('A30', 'f', 'Open'), rows = S.disputes.filter(function (d) { return fl === 'All' || d.state === fl; });
    dc.appendChild(chips(['Open', 'Resolved', 'Rejected', 'All'], fl, function (o) { setf('A30', 'f', o); }));
    dc.appendChild(card('Disputes (' + rows.length + ')', h('span', { class: 'a-note' }, 'SLA 48 h'), rows.length ? table([['ID', function (d) { return d.id; }], ['Rider', function (d) { return d.rider; }], ['Ride', function (d) { return d.ride; }], ['Reason', function (d) { return d.reason; }], ['Amount', function (d) { return money(d.paise); }], ['SLA left', function (d) { var left = 48 - (Date.now() - d.opened) / 3600000; return d.state !== 'Open' ? d.outcome : st(left > 0 ? Math.floor(left) + 'h ' + Math.floor(left % 1 * 60) + 'm' : 'Breached', left < 6 ? 'bad' : left < 24 ? 'warn' : 'ok'); }]], rows, disputeDrawer) : h('div', { class: 'a-empty' }, 'No ' + fl.toLowerCase() + ' disputes.')));
  });
  function disputeDrawer(d) {
    drawer(d.id, function (b, close) {
      b.appendChild(h('div', { class: 'dcard' }, [kv('Rider', d.rider), kv('Ride', d.ride), kv('Reason', d.reason), kv('Disputed amount', money(d.paise)), kv('Opened', L.fdt(d.opened)), kv('State', d.state + (d.outcome ? ' \u00B7 ' + d.outcome : ''))]));
      if (d.state !== 'Open') return; b.appendChild(L.field({ name: 'dnote', label: 'Note to rider', area: true, rows: 3, maxlength: 300 }));
      [['Refund rider in full', 'Resolved', 'payment.refund'], ['Refund half', 'Resolved', 'payment.refund'], ['Reject with reason', 'Rejected', 'ticket.resolve']].forEach(function (o) { b.appendChild(btn(o[0], o[1] === 'Rejected' ? 'g' : '', function () { UI.clearErrors(); if (UI.val('dnote').trim().length < 10) { UI.fieldError('dnote', 'Explain the decision to the rider (10+ characters).'); return; } act(o[2], 'decide a dispute', 'dispute.' + o[1].toLowerCase(), d.id).then(function (ok) { if (!ok) return; d.state = o[1]; d.outcome = o[0]; save(); close(); draw('A30'); UI.toast(d.id + ': ' + o[0].toLowerCase() + '. Rider notified.', 'info'); }); })); });
    });
  }
})();