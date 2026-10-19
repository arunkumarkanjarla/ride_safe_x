/* RideNova customer app - extra product touches on top of product-*.js:
   home offers carousel, recent activity, refer & earn (copy/share), and driver tips on the rating screen (R18). */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, K = RN.kit, P = RN.product, S = RN.store;
  if (!P || !S) return;
  var h = P.h || function (tag, a, kids) { var n = document.createElement(tag); if (a) Object.keys(a).forEach(function (k) { if (k === 'class') n.className = a[k]; else if (k === 'on') Object.keys(a.on).forEach(function (e) { n.addEventListener(e, a.on[e]); }); else if (a[k] != null) n.setAttribute(k, a[k]); }); (Array.isArray(kids) ? kids : [kids]).forEach(function (c) { if (c == null || c === false) return; n.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }); return n; };
  function rs(p) { return '\u20B9' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function body(sid) { var s = document.querySelector('.rn-screen[data-sid="' + sid + '"]'); return s && s.querySelector('.body'); }
  var OFFERS = [['RIDE50', '50% off 2 rides', 'Cabs, autos, bikes \u00B7 up to \u20B9100', 'brand'], ['BIRYANI40', '40% off biryani', 'Min \u20B9199 \u00B7 up to \u20B980', 'amber'], ['PARCEL25', '\u20B925 off parcels', 'Same-day city delivery', 'blue'], ['STAY15', '15% off hotels', 'Kochi, Mysuru, Goa and more', 'brand']];

  function refCode(u) { return 'RN' + (S.initials ? S.initials(u.name) : 'RN') + u.phone.slice(-4); }
  function copyText(t) { try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return false; }); } catch (e) { /* fall through */ } return Promise.resolve(false); }
  function referSheet() {
    var u = S.user(); if (!u) return; u.referrals = u.referrals || [];
    P.sheet('Refer & earn', function (b, api) {
      var code = refCode(u);
      b.appendChild(h('div', { class: 'card-m brand' }, [h('span', { class: 'xs' }, (RN.referralText ? RN.referralText() : 'Give \u20B9100, get \u20B9100')), h('b', { class: 'big-num' }, code), h('span', { class: 'xs' }, 'Friends get \u20B9100 off their first ride. You get \u20B9100 when they finish it.')]));
      b.appendChild(h('div', { class: 'row2' }, [P.btn('Copy code', 'soft sm', function () { copyText(code).then(function (ok) { UI.toast(ok ? 'Code copied.' : 'Your code: ' + code, 'info'); }); }), P.btn('Share invite', 'sm', function () {
        var msg = 'Ride with me on RideNova! Use ' + code + ' for \u20B9100 off your first ride.';
        if (navigator.share) navigator.share({ title: 'RideNova', text: msg }).catch(function () { /* cancelled */ }); else copyText(msg).then(function () { UI.toast('Invite message copied. Paste it in any chat.', 'info'); });
      })]));
      b.appendChild(P.field ? P.field({ name: 'refphone', label: 'Or invite by mobile number', type: 'tel', inputmode: 'numeric', maxlength: 10, prefix: '+91' }) : h('span'));
      b.appendChild(P.btn('Send invite (simulated SMS)', 'ghost', function () {
        var v = (UI.val('refphone') || '').replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(v)) { UI.fieldError('refphone', 'Enter a valid 10-digit mobile number.'); return; }
        if (v === u.phone || u.referrals.some(function (r) { return r.phone === v; })) { UI.fieldError('refphone', 'Already invited.'); return; }
        u.referrals.unshift({ phone: v, at: Date.now(), state: 'Invited' }); S.save(); api.close(); UI.toast('Invite sent to +91 ' + v.slice(0, 5) + ' ' + v.slice(5) + '.', 'info');
        setTimeout(function () { var me = S.user(); if (!me || !me.referrals) return; var r = me.referrals.filter(function (x) { return x.phone === v; })[0]; if (!r || r.state !== 'Invited') return; r.state = 'Joined \u00B7 first ride done'; S.credit(me, RN.referralPaise ? RN.referralPaise() : 10000, 'Referral reward', 'Bonus'); S.notify(me, 'You earned ' + P.rs(RN.referralPaise ? RN.referralPaise() : 10000), 'Your friend finished their first ride.', 'Offers', 'R21'); }, 15000);
      }));
      if (u.referrals.length) { b.appendChild(h('div', { class: 'xs p-sec' }, 'YOUR INVITES')); b.appendChild(h('div', { class: 'list' }, u.referrals.map(function (r) { return h('div', { class: 'li' }, [h('span', { class: 'tx' }, [h('b', null, '+91 ' + r.phone.slice(0, 5) + ' ' + r.phone.slice(5)), h('span', null, r.state)])]); }))); }
    });
  }

  K.extend('R29', { init: function () {
    var b = body('R29'), u = S.user(); if (!b || !u) return;
    var pick = b.querySelector('.ab b[data-go="R08"], .ab b[role="link"]');
    function paintPickup() {
      if (!pick || !P.pickup) return;
      var a = P.pickup().a || P.pickup().n || 'Current location';
      pick.textContent = a.split(',')[0] + (a.indexOf(',') >= 0 ? ' ▾' : ' ▾');
    }
    paintPickup();
    if (P.requestGeo && !P.livePickup) P.requestGeo(function () { paintPickup(); });
    if (b.querySelector('.p-home-extra')) return;
    var box = h('div', { class: 'p-home-extra' });
    box.appendChild(h('div', { class: 'xs p-sec' }, 'OFFERS FOR YOU'));
    box.appendChild(h('div', { class: 'p-carousel', role: 'list', 'aria-label': 'Offers' }, (RN.offersCarousel ? RN.offersCarousel(OFFERS) : OFFERS).map(function (o) { return h('button', { type: 'button', role: 'listitem', class: 'p-offer ' + o[3], on: { click: function () { UI.go('R22'); } } }, [h('b', null, o[1]), h('span', null, o[2]), h('span', { class: 'p-offcode' }, 'Code ' + o[0])]); })));
    var rec = (u.bookings || []).slice(0, 3);
    if (rec.length) { box.appendChild(h('div', { class: 'xs p-sec' }, 'RECENT')); box.appendChild(h('div', { class: 'list' }, rec.map(function (r) { return h('button', { type: 'button', class: 'li', on: { click: function () { UI.go('R54'); } } }, [h('span', { class: 'tx' }, [h('b', null, r.title || r.type), h('span', null, (r.sub || '') + (r.paise ? ' \u00B7 ' + rs(r.paise) : ''))]), h('span', { class: 'tag ' + (/Cancel/.test(r.status) ? 'err' : 'ok') }, r.status)]); }))); }
    box.appendChild(h('button', { type: 'button', class: 'card-m p-refer', on: { click: referSheet } }, [h('b', null, 'Refer & earn \u20B9100'), h('span', { class: 'xs' }, 'Invite friends. You both get ride credit.')]));
    b.appendChild(box);
  } });

  // R18: tip the driver (100% goes to the driver)
  K.extend('R18', { init: function () {
    var b = body('R18'); if (!b || b.querySelector('.p-tip')) return; var amt = 0;
    var box = h('div', { class: 'card-m p-tip' }, [h('b', null, 'Add a tip for your driver'), h('span', { class: 'xs' }, '100% of the tip goes to the driver.')]);
    var chips = h('div', { class: 'chips' }); [0, 20, 30, 50, 100].forEach(function (v) { var c = h('button', { type: 'button', class: 'chip' + (v === 0 ? ' on' : ''), 'aria-pressed': String(v === 0), on: { click: function () { amt = v; Array.prototype.forEach.call(chips.children, function (x) { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); }); tipBtn.hidden = !v; tipBtn.textContent = 'Tip \u20B9' + v; } } }, v ? '\u20B9' + v : 'No tip'); chips.appendChild(c); });
    var tipBtn = P.btn('Tip', 'sm', function () { if (!amt) return; P.pay({ title: 'Tip for your driver', paise: amt * 100, allow: ['Wallet', 'UPI'], onPaid: function (m) { var u = S.user(); S.notify(u, 'Tip sent: \u20B9' + amt, 'Thanks for tipping. Your driver has been notified.', 'Rides'); S.addBooking({ type: 'tip', title: 'Tip for driver', sub: 'Paid by ' + m, paise: amt * 100, status: 'Paid' }); box.replaceChildren(h('b', null, '\u2713 \u20B9' + amt + ' tip sent'), h('span', { class: 'xs' }, 'Your driver says thank you!')); } }); });
    tipBtn.hidden = true; box.appendChild(chips); box.appendChild(tipBtn);
    var anchor = b.querySelector('textarea, .stars'); var at = anchor ? (anchor.closest('.inp') || anchor).nextSibling : null; if (at && at.parentElement === b) b.insertBefore(box, at); else b.appendChild(box);
  } });
})();