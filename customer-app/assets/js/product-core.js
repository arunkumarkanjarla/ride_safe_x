/* RideNova Customer app - onboarding and home (working screens). Uses product-kit.js and store.js.
   R01 splash, R03 phone, R04 OTP, R05 profile setup / edit profile, R29 home. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.store, P = RN.product, h = P.h, ic = P.ic, rs = P.rs;
  var exec = K.exec, secsLeft = K.secsLeft;

  // ------------------------------------------------------------ session <-> engine
  P.applyUser = function (u) {
    var e = UI.engine; if (!e || !u) return;
    var r = e.state.rider;
    r.name = u.name; r.short = S.shortName(u.name); r.initials = S.initials(u.name); r.phone = S.pretty(u.phone); r.email = u.email || '';
    r.walletPaise = u.walletPaise; r.profileDone = true;
    r.contacts = (u.emergency || []).map(function (c) { return { name: c.name, phone: c.phone }; });
    r.upi = S.shortName(u.name).toLowerCase().replace(/[^a-z]/g, '') + '@okbank';
  };
  P.user = function () { return S.user(); };
  P.hello = function () { var hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'; };
  P.firstName = function (u) { return String((u && u.name) || '').trim().split(/\s+/)[0] || 'there'; };
  P.unread = function () { var u = S.user(); return u ? u.notifications.filter(function (n) { return !n.read; }).length : 0; };
  P.signedIn = function () { return !!S.user() && UI.engine && UI.engine.state.session.rider.status === 'signed_in'; };
  function restore(ctx) {
    // a customer who signed in earlier on this browser is signed in again without OTP (simulated "remember me")
    var u = S.user(); if (!u) return Promise.resolve(false);
    var e = ctx.engine;
    if (e.state.session.rider.status === 'signed_in') { P.applyUser(u); return Promise.resolve(true); }
    return UI.exec('auth.sendOtp', { phone: u.phone }, { instant: true }).then(function (r) {
      if (!r.ok) return false;
      return UI.exec('auth.verifyOtp', { code: D.DEMO_CODES.riderOtp }, { instant: true }).then(function (v) { if (v.ok) P.applyUser(u); return !!v.ok; });
    });
  }
  P.restore = restore;
  function leaveIfSignedIn() { if (P.signedIn()) { UI.go('R29', { replace: true }); return true; } return false; }

  // ------------------------------------------------------------ R01 splash
  K.def('R01', { init: function (ctx) {
    setTimeout(function () {
      if (UI.sid !== 'R01') return;
      restore(ctx).then(function (ok) {
        if (UI.sid !== 'R01') return;
        UI.go(ok ? 'R29' : S.db.onboarded ? 'R58' : 'R02', { replace: true });
      });
    }, 1300);
  } });
  K.extend('R02', { init: function () { S.db.onboarded = true; S.save(); leaveIfSignedIn(); } });

  // ------------------------------------------------------------ R03 phone
  K.def('R03', {
    init: function () {
      if (leaveIfSignedIn()) return;
      var f = UI.field('phone'); if (!f) return;
      f.value = UI.mem.demoPhone || P.nav.phoneDraft || ''; UI.mem.demoPhone = null; UI.clearErrors();
      var body = UI.q('#mock .body');
      if (!UI.q('.p-hint', body)) body.insertBefore(h('div', { class: 'xs p-hint' }, 'Demo: use any valid 10-digit mobile starting 6-9. New number = new account; ' + S.pretty('9848004321') + ' is the demo customer. Code: ' + D.DEMO_CODES.riderOtp), UI.q('button[data-do="x.sendOtp"]', body));
      var t = UI.q('#mock .h1'); if (t) t.textContent = UI.mem.authMode === 'register' ? 'Create your account' : 'Enter your phone number';
      setTimeout(function () { f.focus(); }, 60);
    },
    actions: { sendOtp: function (n) {
      UI.clearErrors();
      var v = UI.field('phone').value, d = S.digits(v);
      if (!d) { UI.fieldError('phone', 'Enter your 10-digit mobile number.'); return { ok: false }; }
      if (!S.validPhone(d)) { UI.fieldError('phone', d.length !== 10 ? 'A mobile number has 10 digits (you entered ' + d.length + ').' : 'Indian mobile numbers start with 6, 7, 8 or 9.'); return { ok: false }; }
      P.nav.phoneDraft = v;
      return exec('auth.sendOtp', { phone: d }, n).then(function (r) {
        if (!r.ok) return r;
        P.nav.phone = d;
        var known = S.isRegistered(d);
        if (UI.mem.authMode === 'login' && !known) UI.toast('No account for this number yet: we will set one up after you verify.', 'info');
        if (UI.mem.authMode === 'register' && known) UI.toast('This number already has an account: signing you in.', 'info');
        UI.go('R04'); return r;
      });
    } }
  });

  // ------------------------------------------------------------ R04 OTP
  var resendAt = 0;
  K.def('R04', {
    init: function (ctx) {
      if (leaveIfSignedIn()) return;
      resendAt = Date.now() + 24000;
      var inp = UI.q('#mock .rn-otp-input'); if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input')); inp.focus(); }
      var ses = ctx.engine.state.session.rider, sub = UI.q('#mock .sub');
      if (sub) { P.clear(sub); sub.appendChild(document.createTextNode('Sent to ' + (ses.phone || S.pretty(P.nav.phone)) + ' \u00B7 ')); sub.appendChild(h('b', { class: 'x-color-0b7a68 p-link', role: 'link', tabindex: '0', 'data-go': 'R03' }, 'Edit')); }
      var body = UI.q('#mock .body');
      if (!UI.q('.p-hint', body)) body.insertBefore(h('div', { class: 'xs p-hint' }, 'Simulated SMS. Demo code: ' + D.DEMO_CODES.riderOtp), UI.q('[data-do="x.verifyOtp"]', body));
      UI.toast('Demo code: ' + D.DEMO_CODES.riderOtp + ' (simulated SMS).', 'info');
    },
    tick: function () { var left = secsLeft(resendAt, Date.now()); UI.bind('resend', left ? 'Resend code in 0:' + String(left).padStart(2, '0') + ' \u00B7 Get code on WhatsApp' : 'Resend code now \u00B7 Get code on WhatsApp'); },
    actions: {
      verifyOtp: function (n, a, ctx) {
        UI.clearErrors();
        var code = UI.q('#mock .rn-otp-input').value;
        if (code.length !== 6) { UI.fieldError('riderOtp', code.length ? 'Enter all 6 digits (' + code.length + ' so far).' : 'Enter the 6-digit code.'); return { ok: false }; }
        if (ctx.engine.state.session.rider.status !== 'otp_sent') {
          if (!P.nav.phone) { UI.toast('Enter your mobile number first.', 'warn'); UI.go('R03', { replace: true }); return { ok: false }; }
          return exec('auth.sendOtp', { phone: P.nav.phone }, null, { instant: true }).then(function () { return RN.screens.R04.actions.verifyOtp(n, a, ctx); });
        }
        return exec('auth.verifyOtp', { code: code }, n).then(function (r) {
          if (!r.ok) { UI.fieldError('riderOtp', r.error); return r; }
          var d = S.digits(ctx.engine.state.session.rider.phone);
          if (S.isRegistered(d)) {
            var u = S.find(d); S.signIn(d); P.applyUser(u); P.nav.pendingPhone = null;
            UI.toast('Welcome back, ' + P.firstName(u) + '.', 'info'); UI.go('R29', { replace: true });
          } else { P.nav.pendingPhone = d; UI.toast('Phone verified. Tell us a little about you.', 'info'); UI.go('R05'); }
          return r;
        });
      },
      resendOtp: function (n, a, ctx) {
        if (Date.now() < resendAt) { UI.toast('You can request a new code when the timer ends.', 'info'); return { ok: false }; }
        return exec('auth.sendOtp', { phone: P.nav.phone || ctx.engine.state.session.rider.phone }, n).then(function (r) { if (r.ok) { resendAt = Date.now() + 24000; UI.toast('New code sent (simulated). Demo code: ' + D.DEMO_CODES.riderOtp, 'info'); } return r; });
      }
    }
  });

  // ------------------------------------------------------------ R05 profile setup / edit
  function readPhoto(file, cb) {
    if (!/^image\//.test(file.type)) { cb(null, 'Please choose an image file (JPG or PNG).'); return; }
    if (file.size > 8 * 1024 * 1024) { cb(null, 'That photo is larger than 8 MB. Choose a smaller one.'); return; }
    var fr = new FileReader();
    fr.onerror = function () { cb(null, 'The photo could not be read.'); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { cb(null, 'The photo could not be opened.'); };
      img.onload = function () {
        var sc = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  P.readPhoto = readPhoto;
  var RELATIONS = ['Mother', 'Father', 'Spouse / partner', 'Brother', 'Sister', 'Friend', 'Other'];
  var GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
  P.RELATIONS = RELATIONS;

  P.screen('R05', {
    title: function (v) { return v.edit ? 'Edit profile' : 'Create your profile'; }, needUser: false,
    back: function (v) { return v.edit ? 'R28' : 'R04'; },
    reset: function (v) { v.edit = !!P.nav.editProfile; P.nav.editProfile = false; v.photo = null; v.gender = ''; },
    build: function (body, v) {
      var u = v.edit ? S.user() : null;
      if (!v.edit && !P.nav.pendingPhone) { UI.go(S.user() ? 'R29' : 'R58', { replace: true }); return; }
      if (u) { v.photo = u.photo || ''; v.gender = u.gender || ''; } else v.photo = '';
      var av = h('div', { class: 'av lg p-avbtn' }), photoErr = h('span', { class: 'rn-err', hidden: true });
      function paintAv() { P.clear(av); var nm = (UI.val('name') || (u && u.name) || ''); if (v.photo) av.appendChild(h('img', { src: v.photo, alt: 'Profile photo preview', class: 'p-avimg' })); else av.appendChild(h('span', null, nm ? S.initials(nm) : ic('user', 28))); }
      var file = h('input', { type: 'file', accept: 'image/*', class: 'p-file', 'aria-label': 'Choose a profile photo', tabindex: '-1' });
      file.addEventListener('change', function () {
        photoErr.hidden = true; var f = file.files && file.files[0]; if (!f) return;
        readPhoto(f, function (data, err) { if (err) { photoErr.textContent = err; photoErr.hidden = false; return; } v.photo = data; paintAv(); rm.hidden = false; });
      });
      var add = h('button', { type: 'button', class: 'chip', on: { click: function () { file.click(); } } }, [ic('camera', 14), ' Add photo (optional)']);
      var rm = h('button', { type: 'button', class: 'chip p-rm', hidden: !v.photo, on: { click: function () { v.photo = ''; file.value = ''; paintAv(); rm.hidden = true; } } }, 'Remove');
      body.appendChild(h('div', { class: 'center' }, [av, h('div', { class: 'row2 p-photo-row' }, [add, rm]), photoErr, file]));
      var name = P.field({ name: 'name', label: 'Full name *', value: u ? u.name : '', maxlength: 50, autocomplete: 'name', on: { input: paintAv } });
      body.appendChild(name);
      var gErr = h('span', { class: 'rn-err', 'data-err': 'gender', hidden: true });
      var gch = P.chips(GENDERS, v.gender, function (g) { v.gender = g; gErr.hidden = true; });
      body.appendChild(h('div', { class: 'inp' }, [h('label', null, 'Gender *'), gch, gErr]));
      body.appendChild(P.field({ name: 'email', label: 'Email for receipts (optional)', type: 'email', value: u ? u.email : '', maxlength: 80, autocomplete: 'email' }));
      if (!v.edit) {
        body.appendChild(P.sec('EMERGENCY CONTACT (OPTIONAL)'));
        body.appendChild(P.banner('info', 'We share your live trip with this person if you press SOS. You can add or change contacts later in Account.', 'shield'));
        body.appendChild(P.field({ name: 'ecname', label: 'Contact name', maxlength: 40 }));
        body.appendChild(h('div', { class: 'row2' }, [P.field({ name: 'ecphone', label: 'Contact mobile', type: 'tel', inputmode: 'numeric', maxlength: 12, placeholder: '10-digit number' }), P.field({ name: 'ecrel', label: 'Relation', select: RELATIONS })]));
      }
      function collect(skipEc) {
        P.clearErrors(); var bad = false, nm = UI.val('name').trim();
        if (!/^[\p{L}][\p{L} .'-]{1,49}$/u.test(nm)) { UI.fieldError('name', nm ? 'Use letters only, 2 to 50 characters.' : 'Please enter your full name.'); bad = true; }
        if (!v.gender) { gErr.textContent = 'Please choose a gender (or "Prefer not to say").'; gErr.hidden = false; if (!bad) gch.firstChild.focus(); bad = true; }
        var em = UI.val('email').trim();
        if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { UI.fieldError('email', 'Enter a valid email or leave it empty.'); bad = true; }
        var ec = null;
        if (!v.edit && !skipEc) {
          var en = UI.val('ecname').trim(), ep = UI.val('ecphone'), any = en || S.digits(ep);
          if (any) {
            if (en.length < 2) { UI.fieldError('ecname', 'Enter the contact\'s name.'); bad = true; }
            if (!S.validPhone(ep)) { UI.fieldError('ecphone', 'Enter a valid 10-digit mobile number.'); bad = true; }
            else if (S.digits(ep) === P.nav.pendingPhone) { UI.fieldError('ecphone', 'This is your own number. Add someone else.'); bad = true; }
            if (!bad) ec = { id: S.uid('EC'), name: en, phone: S.digits(ep), relation: UI.val('ecrel'), share: true };
          }
        }
        return bad ? null : { name: nm.replace(/\s+/g, ' '), gender: v.gender, email: em, photo: v.photo || '', ec: ec };
      }
      function save(skipEc) {
        var c = collect(skipEc); if (!c) return;
        if (v.edit) {
          var cur = S.user(); cur.name = c.name; cur.gender = c.gender; cur.email = c.email; cur.photo = c.photo; S.save(); P.applyUser(cur);
          UI.toast('Profile updated.', 'info'); UI.go('R28', { replace: true }); return;
        }
        var phone = P.nav.pendingPhone, nu = S.create(phone, { name: c.name, gender: c.gender, email: c.email, photo: c.photo, emergency: c.ec ? [c.ec] : [] });
        S.signIn(phone); P.nav.pendingPhone = null; P.applyUser(nu);
        UI.exec('rider.profile', { name: c.name, email: c.email }, { instant: true });
        UI.toast(c.ec ? 'Profile saved. ' + c.ec.name + ' is your emergency contact.' : 'Profile saved. You can add an emergency contact later in Account.', 'info');
        UI.go('R06');
      }
      body.appendChild(h('div', { class: 'fill' }));
      body.appendChild(P.btn(v.edit ? 'Save changes' : 'Continue', '', function () { save(false); }, { 'data-do': null }));
      if (!v.edit) body.appendChild(P.btn('Skip emergency contact for now', 'ghost', function () { save(true); }));
      paintAv();
    }
  });

  // ------------------------------------------------------------ R29 home
  var MODES = [['urgent', 'Urgent', 'bolt'], ['bal', 'Balanced', 'sparkle'], ['saver', 'Saver', 'wallet'], ['flex', 'Flexible', 'clock'], ['deals', 'Deals', 'percent']];
  function priorityOf(n) { return n.textContent.trim().split(/\s/)[0]; }
  function liveCards(box) {
    var e = UI.engine, u = S.user(), cards = [];
    var r = e.activeRide();
    if (r) cards.push({ icon: 'car', title: 'Ride ' + K.label(r.state), sub: r.drop + ' \u00B7 ' + r.vehicle, go: RN.engineLib.rideScreen(r), tag: 'Live' });
    var o = e.order();
    if (o && ['DELIVERED', 'REJECTED', 'CANCELLED'].indexOf(o.state) < 0) cards.push({ icon: 'food', title: o.restaurant + ' \u00B7 ' + K.label(o.state), sub: 'Order #' + o.id + ' \u00B7 ' + rs(o.totalPaise), go: 'R46', tag: 'Live' });
    (u.bookings || []).filter(function (b) { return b.type === 'parcel' && P.parcelStage && P.parcelStage(b) < 5; }).slice(0, 1).forEach(function (b) { cards.push({ icon: 'box', title: 'Parcel ' + b.code + ' \u00B7 ' + P.parcelLabel(b), sub: b.sub, go: 'R48', tag: 'Live', book: b.id }); });
    var sig = JSON.stringify(cards); if (box.getAttribute('data-sig') === sig) return; box.setAttribute('data-sig', sig); P.clear(box);
    cards.forEach(function (c) {
      var row = P.row({ icon: c.icon, tone: 'amber', title: c.title, sub: c.sub, right: c.tag, rightKind: 'warn', chev: true, onClick: function () { if (c.book) P.nav.booking = c.book; UI.go(c.go); } });
      box.appendChild(h('div', { class: 'list p-live' }, row));
    });
  }
  var SVC = [
    ['Ride', 'car', 'R07'], ['Bike taxi', 'bike', 'R59', 'Bike'], ['Auto', 'auto', 'R59', 'Auto'], ['Long trip', 'map', 'R32', null, 'NEW'],
    ['Share seat', 'users', 'R33', 'share', '-40%'], ['Bus', 'bus', 'R33', 'bus'], ['Rentals', 'key', 'R43'], ['Hotels', 'bed', 'R41'],
    ['Food', 'food', 'R44'], ['Parcel', 'box', 'R47'], ['Plan trip', 'sparkle', 'R52', null, 'AI'], ['Deals', 'percent', 'R49']
  ];
  P.SVC = SVC; // home tiles; the platform bridge rebuilds this list from the admin service catalog
  P.screen('R29', {
    title: 'Home', nav: 'home', hideBar: true,
    build: function (body, v) {
      var u = S.user(), e = UI.engine;
      // header (replaces the generic app bar)
      var pickup = (u.saved.home && u.saved.home.area) || 'Road 12, Banjara Hills';
      var hdr = h('div', { class: 'ab' }, [
        h('span', { class: 'ic brand' }, ic('pin')),
        h('span', { class: 'p-pick' }, [h('span', { class: 'xs' }, 'Pickup'), h('b', { role: 'link', tabindex: '0', 'data-go': 'R08' }, pickup + ' \u25BE')]),
        h('a', { class: 'chip', href: '#/R53', 'data-go': 'R53' }, S.db.currency),
        h('a', { class: 'ib p-bell', href: '#/R56', 'data-go': 'R56', 'aria-label': 'Notifications' }, [ic('bell'), h('em', { class: 'p-badge', hidden: !P.unread() }, String(P.unread()))])
      ]);
      v.scr.insertBefore(hdr, v.body); v.hdr = hdr;
      body.appendChild(h('div', { class: 'p-hello' }, [P.avatar(u), h('div', { class: 'x-flex-1' }, [h('div', { class: 'xs' }, P.hello()), h('b', { class: 'h2 p-name' }, P.firstName(u))]), h('a', { class: 'chip', href: '#/R21', 'data-go': 'R21' }, [ic('wallet', 14), ' ' + rs(u.walletPaise)])]));
      body.appendChild(h('div', { class: 'inp' }, h('a', { class: 'box p-where', href: '#/R08', 'data-go': 'R08' }, [ic('search', 18), h('b', { class: 'x-flex-1' }, 'Where to, or what do you need?'), ic('chev', 16)])));
      var modes = h('div', { class: 'modes' });
      MODES.forEach(function (m) { modes.appendChild(h('span', { class: 'mode ' + m[0] + (e.state.rider.priority === m[0] ? ' on' : ''), role: 'button', tabindex: '0', 'data-go': 'R30', 'data-do': 'x.priority' }, [ic(m[2], 16), m[1]])); });
      body.appendChild(modes);
      v.live = h('div', { class: 'p-livebox' }); body.appendChild(v.live);
      var svc = h('div', { class: 'svc' });
      SVC.forEach(function (s) {
        var a = h('a', { href: '#/' + s[2], 'data-go': s[2], 'data-do': s[3] ? 'x.openService' : null, 'data-arg': s[3] ? s[0] + '|' + s[2] + '|' + s[3] : null }, [h('i', null, [ic(s[1], 24), s[4] ? h('em', null, s[4]) : null]), s[0]]);
        if (s[3]) a.removeAttribute('data-go');
        svc.appendChild(a);
      });
      body.appendChild(svc);
      var next = (u.bookings || []).filter(function (b) { return b.when && b.when > Date.now() && /Confirmed|Scheduled/.test(b.status); }).sort(function (a, b) { return a.when - b.when; })[0];
      if (next) body.appendChild(h('button', { type: 'button', class: 'card-m p-next', on: { click: function () { P.nav.booking = next.id; UI.go('R62'); } } }, [h('span', { class: 'ic blue' }, ic(P.iconOf(next.type))), h('span', { class: 'x-flex-1 p-left' }, [h('b', null, next.title), h('div', { class: 'xs' }, P.fdt(next.when) + ' \u00B7 ' + next.sub)]), h('span', { class: 'tag info' }, 'Upcoming')]));
      else body.appendChild(h('a', { class: 'card-m p-next', href: '#/R52', 'data-go': 'R52' }, [h('span', { class: 'ic blue' }, ic('sparkle')), h('span', { class: 'x-flex-1 p-left' }, [h('b', null, 'Plan your next trip'), h('div', { class: 'xs' }, 'Ask the AI planner for buses, stays and rentals')]), h('span', { class: 'tag info' }, 'AI')]));
      var goal = 200000, pct = Math.min(100, Math.round(u.savedPaise * 100 / goal));
      body.appendChild(h('a', { class: 'card-m', href: '#/R49', 'data-go': 'R49' }, [h('div', { class: 'kv' }, [h('b', null, 'You saved ' + rs(u.savedPaise) + ' so far'), h('span', { class: 'xs' }, 'Goal ' + rs(goal))]), P.progress(pct), h('span', { class: 'xs' }, u.savedPaise ? 'Coupons and shared rides add up.' : 'Use a coupon on your first booking to start saving.')]));
      v.sync = function () { liveCards(v.live); };
      v.sync();
    },
    update: function (v) { if (v.sync) v.sync(); var b = UI.q('.p-badge', v.hdr); if (b) { var n = P.unread(); b.hidden = !n; b.textContent = String(n); } },
    tick: function (v) { if (v.sync) v.sync(); },
    actions: {
      priority: function (n) { return exec('rider.priority', { arg: priorityOf(n) }, n, { instant: true }); },
      openService: function (n, arg) {
        var p = String(arg).split('|'), name = p[0], sid = p[1], mode = p[2];
        P.nav.service = { name: name, mode: mode };
        if (sid === 'R59') P.nav.quick = mode; else P.nav.longMode = mode;
        UI.go(sid); return false;
      }
    }
  });
  P.iconOf = function (t) { return { ride: 'car', scheduled: 'calendar', food: 'food', parcel: 'box', hotel: 'bed', rental: 'key', bus: 'bus', share: 'users', cab: 'car', quick: 'bike', alert: 'bell' }[t] || 'tag'; };
})();