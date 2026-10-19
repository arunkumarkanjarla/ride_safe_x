/* RideNova Customer app - persistent store (synthetic data only).
   Keeps registered customers, the signed-in phone and each customer's wallet, bookings, notifications, contacts and
   preferences in localStorage under "ridenova.customer.v1". If storage is blocked (private mode, file restrictions) the
   same data lives in memory for the page. Nothing here is secure: phone numbers and profiles are demo data. */
(function () {
  'use strict';
  var RN = window.RN = window.RN || {};
  var KEY = 'ridenova.customer.v1';
  var mem = null, memOnly = false;

  function blank() { return { v: 1, users: {}, session: null, onboarded: false, lang: 'English', currency: 'INR', nextId: 1000 }; }
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw); if (o && o.v === 1 && o.users) return o; }
    } catch (e) { memOnly = true; }
    return blank();
  }
  var db = load();
  function save() {
    if (memOnly) { mem = db; return; }
    try { window.localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { memOnly = true; mem = db; }
  }

  function digits(p) { return String(p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''); }
  function pretty(d) { d = digits(d); return d.length === 10 ? '+91 ' + d.slice(0, 5) + ' ' + d.slice(5) : String(d); }
  function validPhone(p) { return /^[6-9]\d{9}$/.test(digits(p)); }
  function uid(prefix) { db.nextId += 1; return prefix + db.nextId; }
  function initials(name) { var p = String(name || '').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase(); }
  function shortName(name) { var p = String(name || '').trim().split(/\s+/); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); }

  function newUser(phone, profile) {
    var now = Date.now();
    var u = {
      phone: digits(phone), name: profile.name, gender: profile.gender || '', email: profile.email || '', photo: profile.photo || '',
      createdAt: now, emergency: profile.emergency || [],
      walletPaise: 0, txns: [], bookings: [], notifications: [], history: [], saved: { home: null, work: null, other: [] },
      coupon: '', savedPaise: 0, prefs: { rides: true, offers: true, food: true, safety: true, sms: false, share: true },
      plan: [], alerts: [], kyc: { state: 'none' }, tickets: [], chat: [], plus: false, seen: {}, perms: {}, offline: {}
    };
    return u;
  }

  var S = {
    digits: digits, pretty: pretty, validPhone: validPhone, initials: initials, shortName: shortName,
    persistent: function () { return !memOnly; },
    save: save,
    get db() { return db; },
    uid: uid,
    user: function () { return db.session && db.users[db.session] || null; },
    find: function (phone) { return db.users[digits(phone)] || null; },
    isRegistered: function (phone) { return !!db.users[digits(phone)]; },
    create: function (phone, profile) {
      var u = newUser(phone, profile); db.users[u.phone] = u;
      S.credit(u, 10000, 'Welcome bonus', 'Bonus');
      S.notify(u, 'Welcome to RideNova, ' + shortName(u.name), '\u20B9100 welcome bonus is in your wallet. Try code RIDE50 on your first ride.', 'Offers');
      save(); return u;
    },
    signIn: function (phone) { db.session = digits(phone); db.onboarded = true; save(); },
    signOut: function () { db.session = null; save(); },
    remove: function (phone) { delete db.users[digits(phone)]; if (db.session === digits(phone)) db.session = null; save(); },
    setPref: function (k, v) { db[k] = v; save(); },
    // wallet
    credit: function (u, paise, title, kind) { u = u || S.user(); if (!u) return; u.walletPaise += paise; u.txns.unshift({ id: uid('TX'), at: Date.now(), title: title, paise: paise, kind: kind || 'Top-up' }); save(); },
    debit: function (u, paise, title, kind) {
      u = u || S.user(); if (!u || u.walletPaise < paise) return false;
      u.walletPaise -= paise; u.txns.unshift({ id: uid('TX'), at: Date.now(), title: title, paise: -paise, kind: kind || 'Payment' }); save(); return true;
    },
    notify: function (u, title, sub, kind, go) {
      u = u || S.user(); if (!u) return;
      u.notifications.unshift({ id: uid('N'), at: Date.now(), title: title, sub: sub || '', kind: kind || 'Updates', read: false, go: go || '' });
      if (u.notifications.length > 80) u.notifications.length = 80;
      save();
      try { if (RN.product && RN.product.onNotify) RN.product.onNotify(title); } catch (e) { /* ignore */ }
    },
    addBooking: function (b) {
      var u = S.user(); if (!u) return null;
      b = Object.assign({ id: uid('BK'), createdAt: Date.now(), status: 'Confirmed', paise: 0, type: 'misc', title: '', sub: '' }, b);
      u.bookings.unshift(b); save(); return b;
    },
    booking: function (id) { var u = S.user(); return u && u.bookings.filter(function (b) { return b.id === id; })[0] || null; },
    reset: function () { db = blank(); save(); }
  };

  // demo customer from the approved screens, so "I already have an account" works out of the box
  if (!db.users['9848004321']) {
    var a = newUser('9848004321', { name: 'Ananya Rao', gender: 'Female', email: 'ananya@example.com', emergency: [
      { id: 'EC1', name: 'Mom', phone: '9821000011', relation: 'Mother', share: true }, { id: 'EC2', name: 'Rahul', phone: '9987600022', relation: 'Brother', share: true }] });
    a.walletPaise = 12000; a.savedPaise = 124000;
    a.txns = [{ id: 'TX1', at: Date.now() - 86400000 * 3, title: 'Added via UPI', paise: 20000, kind: 'Top-up' }, { id: 'TX2', at: Date.now() - 86400000 * 2, title: 'Ride to Hitec City', paise: -8000, kind: 'Payment' }];
    a.saved.home = { name: 'Home', area: 'Road 12, Banjara Hills' }; a.saved.work = { name: 'Work', area: 'Hitec City, Madhapur' };
    a.notifications = [{ id: 'N1', at: Date.now() - 3600000, title: 'RIDE50 is live', sub: '50% off your next 2 rides', kind: 'Offers', read: false, go: 'R22' }];
    db.users[a.phone] = a; save();
  }
  RN.store = S;
})();