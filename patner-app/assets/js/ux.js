/* RideNova - shared UX layer for the phone apps (customer, driver, partner). Same file in each app folder.
   Adds, without touching screen logic: dark mode, language toggle (common labels), offline banner, skeleton
   shimmer on first visit to a screen, pull-to-refresh, toast with Undo, bigger tap targets, and a
   "Display & language" block on the account/settings screen. Preferences: localStorage "ridenova.ux.v1". */
(function () {
  'use strict';
  var RN = window.RN = window.RN || {}, UI = RN.ui;
  var KEY = 'ridenova.ux.v1', P = { dark: false, lang: 'en' };
  try { var sv = JSON.parse(localStorage.getItem(KEY)); if (sv) P = Object.assign(P, sv); } catch (e) { /* memory only */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  var ux = RN.ux = { prefs: P };

  // ---------------------------------------------------------------- dark mode
  ux.setDark = function (on) { P.dark = !!on; save(); apply(); };
  function apply() { document.documentElement.classList.toggle('rn-dark', P.dark); Array.prototype.forEach.call(document.querySelectorAll('.phone .scr'), function (s) { s.classList.toggle('dark', P.dark); }); }

  // ---------------------------------------------------------------- language (common UI labels)
  var DICT = {
    hi: { Home: '\u0939\u094B\u092E', Trips: '\u092F\u093E\u0924\u094D\u0930\u093E\u090F\u0901', Savings: '\u092C\u091A\u0924', Wallet: '\u0935\u0949\u0932\u0947\u091F', Account: '\u0916\u093E\u0924\u093E', Earnings: '\u0915\u092E\u093E\u0908', Orders: '\u0911\u0930\u094D\u0921\u0930', Listings: '\u0932\u093F\u0938\u094D\u091F\u093F\u0902\u0917', Payouts: '\u092D\u0941\u0917\u0924\u093E\u0928', Settings: '\u0938\u0947\u091F\u093F\u0902\u0917\u094D\u0938', Continue: '\u091C\u093E\u0930\u0940 \u0930\u0916\u0947\u0902', Next: '\u0906\u0917\u0947', Cancel: '\u0930\u0926\u094D\u0926 \u0915\u0930\u0947\u0902', Save: '\u0938\u0939\u0947\u091C\u0947\u0902', Search: '\u0916\u094B\u091C\u0947\u0902', 'Log out': '\u0932\u0949\u0917 \u0906\u0909\u091F', 'Sign in': '\u0938\u093E\u0907\u0928 \u0907\u0928', Offers: '\u0911\u092B\u093C\u0930', Notifications: '\u0938\u0942\u091A\u0928\u093E\u090F\u0901', Help: '\u092E\u0926\u0926', Rides: '\u0938\u0935\u093E\u0930\u0940', Food: '\u0916\u093E\u0928\u093E', Parcel: '\u092A\u093E\u0930\u094D\u0938\u0932', Hotels: '\u0939\u094B\u091F\u0932', Rentals: '\u0915\u093F\u0930\u093E\u090F', Done: '\u0939\u094B \u0917\u092F\u093E', Back: '\u0935\u093E\u092A\u0938' },
    te: { Home: '\u0C39\u0C4B\u0C2E\u0C4D', Trips: '\u0C2A\u0C4D\u0C30\u0C2F\u0C3E\u0C23\u0C3E\u0C32\u0C41', Savings: '\u0C2A\u0C4A\u0C26\u0C41\u0C2A\u0C41', Wallet: '\u0C35\u0C3E\u0C32\u0C46\u0C1F\u0C4D', Account: '\u0C16\u0C3E\u0C24\u0C3E', Earnings: '\u0C38\u0C02\u0C2A\u0C3E\u0C26\u0C28', Orders: '\u0C06\u0C30\u0C4D\u0C21\u0C30\u0C4D\u0C32\u0C41', Listings: '\u0C1C\u0C3E\u0C2C\u0C3F\u0C24\u0C3E\u0C32\u0C41', Payouts: '\u0C1A\u0C46\u0C32\u0C4D\u0C32\u0C3F\u0C02\u0C2A\u0C41\u0C32\u0C41', Settings: '\u0C38\u0C46\u0C1F\u0C4D\u0C1F\u0C3F\u0C02\u0C17\u0C4D\u0C38\u0C4D', Continue: '\u0C15\u0C4A\u0C28\u0C38\u0C3E\u0C17\u0C3F\u0C02\u0C1A\u0C41', Next: '\u0C24\u0C30\u0C4D\u0C35\u0C3E\u0C24', Cancel: '\u0C30\u0C26\u0C4D\u0C26\u0C41', Save: '\u0C38\u0C47\u0C35\u0C4D', Search: '\u0C35\u0C46\u0C24\u0C15\u0C02\u0C21\u0C3F', 'Log out': '\u0C32\u0C3E\u0C17\u0C4D \u0C05\u0C35\u0C41\u0C1F\u0C4D', 'Sign in': '\u0C38\u0C48\u0C28\u0C4D \u0C07\u0C28\u0C4D', Offers: '\u0C06\u0C2B\u0C30\u0C4D\u0C32\u0C41', Notifications: '\u0C28\u0C4B\u0C1F\u0C3F\u0C2B\u0C3F\u0C15\u0C47\u0C37\u0C28\u0C4D\u0C32\u0C41', Help: '\u0C38\u0C39\u0C3E\u0C2F\u0C02', Rides: '\u0C30\u0C48\u0C21\u0C4D\u0C32\u0C41', Food: '\u0C06\u0C39\u0C3E\u0C30\u0C02', Parcel: '\u0C2A\u0C3E\u0C30\u0C4D\u0C38\u0C3F\u0C32\u0C4D', Hotels: '\u0C39\u0C4B\u0C1F\u0C32\u0C4D\u0C38\u0C4D', Rentals: '\u0C05\u0C26\u0C4D\u0C26\u0C46', Done: '\u0C2A\u0C42\u0C30\u0C4D\u0C24\u0C2F\u0C3F\u0C02\u0C26\u0C3F', Back: '\u0C35\u0C46\u0C28\u0C41\u0C15\u0C15\u0C41' }
  };
  var ORIG = new WeakMap();
  function translate(root) {
    var d = DICT[P.lang]; if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) {
      var o = ORIG.get(t), cur = t.nodeValue, key = (o || cur).trim();
      if (!d) { if (o != null && cur !== o) t.nodeValue = o; return; }
      if (d[key]) { if (o == null) ORIG.set(t, cur); var want = cur.replace(key, d[key]); if (o != null) want = o.replace(key, d[key]); if (t.nodeValue !== want) t.nodeValue = want; }
    });
  }
  ux.setLang = function (l) { P.lang = l; save(); var m = document.getElementById('mock'); translate(m); };

  // ---------------------------------------------------------------- toast with undo
  ux.undoToast = function (msg, undo) {
    var scr = document.querySelector('#mock .scr'); if (!scr) return; var old = scr.querySelector('.rn-undo'); if (old) old.remove();
    var t = el('div', 'rn-undo'); t.setAttribute('role', 'status'); t.appendChild(el('span', null, msg)); var b = el('button', null, 'Undo'); b.type = 'button';
    var timer = setTimeout(function () { t.remove(); }, 5000);
    b.addEventListener('click', function () { clearTimeout(timer); t.remove(); undo(); }); t.appendChild(b); scr.appendChild(t);
  };

  // ---------------------------------------------------------------- offline banner
  function netBanner() {
    var scr = document.querySelector('#mock .scr'); if (!scr) return; var b = scr.querySelector('.rn-offline');
    var off = navigator.onLine === false || ux.forceOffline;
    if (off && !b) { b = el('div', 'rn-offline', 'You are offline. Showing saved data; actions sync when you are back online.'); b.setAttribute('role', 'alert'); scr.appendChild(b); }
    else if (!off && b) b.remove();
  }
  window.addEventListener('online', function () { netBanner(); if (UI && UI.toast) UI.toast('Back online. Everything is synced.', 'info'); });
  window.addEventListener('offline', netBanner);

  // ---------------------------------------------------------------- skeleton on first visit + pull-to-refresh
  var seen = {}, lastSid = null;
  function onScreen(sid) {
    var sec = document.querySelector('.rn-screen[data-sid="' + sid + '"]'), body = sec && sec.querySelector('.body');
    if (body && !seen[sid] && !window.RN_NO_SKELETON) { seen[sid] = 1; body.classList.add('rn-skel'); setTimeout(function () { body.classList.remove('rn-skel'); }, 420); }
    if (body && !body.__ptr) { body.__ptr = 1; ptr(body, sid); }
    apply(); netBanner(); if (P.lang !== 'en') translate(document.getElementById('mock'));
    settingsBlock(sid);
  }
  function scrollerOf(n, body) { while (n && n !== body.parentElement) { if (n.scrollHeight > n.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n; n = n.parentElement; } return body; }
  function ptr(body, sid) {
    var y0 = null, dy = 0, ind = null, sc = null;
    body.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; sc = scrollerOf(e.target, body); if (sc.scrollTop > 0 || e.target.closest('input,textarea,select,.p-sheet,.map,canvas')) { y0 = null; return; } y0 = e.clientY; dy = 0; });
    body.addEventListener('pointermove', function (e) { if (y0 == null) return; dy = e.clientY - y0; if (dy > 8) { if (!ind) { ind = el('div', 'rn-ptr'); ind.setAttribute('aria-hidden', 'true'); body.parentElement.appendChild(ind); } ind.style.transform = 'translate(-50%,' + Math.min(70, dy / 2) + 'px) rotate(' + dy * 3 + 'deg)'; ind.classList.toggle('ready', dy > 90); } });
    var end = function () { if (y0 == null) return; y0 = null; if (!ind) return; var go = dy > 90, i = ind; ind = null; if (!go) { i.remove(); return; } i.classList.add('spin'); setTimeout(function () { i.remove(); try { if (UI && UI.sid === sid) UI.go(sid, { reload: true, replace: true }); } catch (e) { /* ignore */ } if (UI && UI.toast) UI.toast('Updated just now', 'info'); }, 650); };
    body.addEventListener('pointerup', end); body.addEventListener('pointercancel', end); body.addEventListener('pointerleave', end);
  }

  // ---------------------------------------------------------------- display & language block on settings screens
  var SETTINGS = { R28: 1, D28: 1, P10: 1 };
  function settingsBlock(sid) {
    if (!SETTINGS[sid]) return; var sec = document.querySelector('.rn-screen[data-sid="' + sid + '"]'), body = sec && sec.querySelector('.body'); if (!body) return;
    setTimeout(function () {
      if (body.querySelector('.rn-display')) return;
      var box = el('div', 'list rn-display'); box.setAttribute('aria-label', 'Display and language');
      var row = el('div', 'li'); var tx = el('span', 'tx'); tx.appendChild(el('b', null, 'Dark mode')); tx.appendChild(el('span', null, 'Easier on the eyes at night')); row.appendChild(tx);
      var t = el('button', 'toggle' + (P.dark ? ' on' : '')); t.type = 'button'; t.setAttribute('role', 'switch'); t.setAttribute('aria-checked', String(P.dark)); t.setAttribute('aria-label', 'Dark mode');
      t.addEventListener('click', function () { ux.setDark(!P.dark); t.classList.toggle('on', P.dark); t.setAttribute('aria-checked', String(P.dark)); if (UI && UI.toast) UI.toast('Dark mode ' + (P.dark ? 'on' : 'off') + '.', 'info'); }); row.appendChild(t); box.appendChild(row);
      var r2 = el('div', 'li'); var tx2 = el('span', 'tx'); tx2.appendChild(el('b', null, 'Language')); tx2.appendChild(el('span', null, 'Menus and buttons')); r2.appendChild(tx2);
      var chips = el('span', 'chips rn-lang'); [['en', 'English'], ['hi', '\u0939\u093F\u0902\u0926\u0940'], ['te', '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41']].forEach(function (l) { var c = el('button', 'chip' + (P.lang === l[0] ? ' on' : ''), l[1]); c.type = 'button'; c.setAttribute('aria-pressed', String(P.lang === l[0])); c.addEventListener('click', function () { Array.prototype.forEach.call(chips.children, function (x) { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); }); ux.setLang(l[0]); if (UI && UI.toast) UI.toast('Language: ' + l[1], 'info'); }); chips.appendChild(c); });
      r2.appendChild(chips); box.appendChild(r2);
      var head = el('div', 'xs p-sec', 'DISPLAY & LANGUAGE'); var logout = body.querySelector('[data-do="x.signOut"], .danger');
      if (logout && logout.parentElement === body) { body.insertBefore(head, logout); body.insertBefore(box, logout); } else { body.appendChild(head); body.appendChild(box); }
    }, 60);
  }

  // ---------------------------------------------------------------- watch screen changes
  setInterval(function () { UI = RN.ui; if (!UI || !UI.sid) return; if (UI.sid !== lastSid) { lastSid = UI.sid; onScreen(UI.sid); } else if (P.lang !== 'en') translate(document.querySelector('.rn-screen[data-sid="' + UI.sid + '"]')); if (SETTINGS[UI.sid]) settingsBlock(UI.sid); }, 120);
  apply();
})();
/* OTP helper (round 2): digits only, paste-anywhere, auto-continue when the code is complete (real user input only) */
(function () {
  'use strict';
  var SEL = 'input[autocomplete="one-time-code"], input.rn-otp-input, input[name="dotp"], input[name="code"], input[name$="Otp"], input[id$="Otp"]';
  function isOtp(n) { return n && n.matches && n.matches(SEL); }
  function len(n) { var m = parseInt(n.getAttribute('maxlength'), 10); return m >= 4 && m <= 8 ? m : 6; }
  function prep(n) { if (n.dataset.rnOtp) return; n.dataset.rnOtp = '1'; n.setAttribute('inputmode', 'numeric'); n.setAttribute('autocomplete', 'one-time-code'); if (!n.getAttribute('pattern')) n.setAttribute('pattern', '[0-9]*'); }
  function submitFor(n) {
    var scope = n.closest('.sheet, .rn-sheet, [role="dialog"], form, .rn-screen, .ag-login, section, main') || document.body;
    var bs = [].slice.call(scope.querySelectorAll('button, [role="button"]')).filter(function (b) { return !b.disabled && b.offsetParent !== null && /verify|continue|confirm|sign in|submit|start trip|log in|unlock/i.test(b.textContent || ''); });
    return bs[0] || null;
  }
  function done(n, trusted) {
    var L = len(n), v = n.value.replace(/\D/g, '').slice(0, L);
    if (v !== n.value) { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }
    if (!trusted || v.length !== L || n.dataset.rnOtpSent === v) return;
    n.dataset.rnOtpSent = v;
    setTimeout(function () { if (n.value !== v || !document.contains(n)) return; var b = submitFor(n); if (b) b.click(); else n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }, 250);
  }
  document.addEventListener('focusin', function (e) { if (isOtp(e.target)) prep(e.target); }, true);
  document.addEventListener('input', function (e) { var n = e.target; if (!isOtp(n)) return; prep(n); if (n.value.replace(/\D/g, '').length < len(n)) delete n.dataset.rnOtpSent; done(n, e.isTrusted); }, true);
  document.addEventListener('paste', function (e) {
    var n = e.target; if (!isOtp(n)) return; var txt = (e.clipboardData || window.clipboardData); txt = txt ? txt.getData('text') : '';
    var d = (txt || '').replace(/\D/g, ''); if (!d) return; e.preventDefault(); prep(n);
    var m = d.match(new RegExp('\\d{' + len(n) + '}')); n.value = (m ? m[0] : d).slice(0, len(n));
    n.dispatchEvent(new Event('input', { bubbles: true })); done(n, e.isTrusted);
  }, true);
})();