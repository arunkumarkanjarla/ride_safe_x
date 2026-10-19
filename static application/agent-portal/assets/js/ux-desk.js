/* RideNova desktop UX layer (admin + agent portal): dark mode + language, prefs shared in ridenova.ux.v1 */
(function () {
  'use strict';
  var KEY = 'ridenova.ux.v1', P = {};
  try { P = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { P = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} }
  var D = {
    hi: { 'Dashboard': 'डैशबोर्ड', 'Command center': 'कमांड सेंटर', 'Live map': 'लाइव मैप', 'Rides': 'राइड्स', 'Riders': 'राइडर्स', 'Drivers': 'ड्राइवर्स', 'Partners': 'पार्टनर्स', 'Payments & refunds': 'भुगतान और रिफंड', 'Support tickets': 'सपोर्ट टिकट', 'Reports': 'रिपोर्ट', 'Audit log': 'ऑडिट लॉग', 'Notifications': 'सूचनाएं', 'Configuration': 'कॉन्फ़िगरेशन', 'Settings': 'सेटिंग्स', 'Search': 'खोजें', 'Save': 'सहेजें', 'Cancel': 'रद्द करें', 'Close': 'बंद करें', 'Sign in': 'साइन इन', 'Sign out': 'साइन आउट', 'Continue': 'जारी रखें', 'Verify': 'सत्यापित करें', 'Export CSV': 'CSV निर्यात', 'Approve': 'स्वीकृत करें', 'Reject': 'अस्वीकार करें', 'Conversations': 'बातचीत', 'Calls': 'कॉल', 'Queue': 'कतार', 'Send': 'भेजें', 'Resolve': 'हल करें', 'Undo': 'पूर्ववत करें', 'Dark mode': 'डार्क मोड', 'Language': 'भाषा' },
    te: { 'Dashboard': 'డాష్‌బోర్డ్', 'Command center': 'కమాండ్ సెంటర్', 'Live map': 'లైవ్ మ్యాప్', 'Rides': 'రైడ్‌లు', 'Riders': 'రైడర్లు', 'Drivers': 'డ్రైవర్లు', 'Partners': 'భాగస్వాములు', 'Payments & refunds': 'చెల్లింపులు & రీఫండ్‌లు', 'Support tickets': 'సపోర్ట్ టికెట్లు', 'Reports': 'నివేదికలు', 'Audit log': 'ఆడిట్ లాగ్', 'Notifications': 'నోటిఫికేషన్లు', 'Configuration': 'కాన్ఫిగరేషన్', 'Settings': 'సెట్టింగ్‌లు', 'Search': 'వెతకండి', 'Save': 'సేవ్ చేయండి', 'Cancel': 'రద్దు చేయండి', 'Close': 'మూసివేయండి', 'Sign in': 'సైన్ ఇన్', 'Sign out': 'సైన్ అవుట్', 'Continue': 'కొనసాగించండి', 'Verify': 'ధృవీకరించండి', 'Export CSV': 'CSV ఎగుమతి', 'Approve': 'ఆమోదించండి', 'Reject': 'తిరస్కరించండి', 'Conversations': 'సంభాషణలు', 'Calls': 'కాల్స్', 'Queue': 'క్యూ', 'Send': 'పంపండి', 'Resolve': 'పరిష్కరించండి', 'Undo': 'రద్దు', 'Dark mode': 'డార్క్ మోడ్', 'Language': 'భాష' }
  };
  var orig = new WeakMap(), busy = false;
  function walk(root) {
    var dict = D[P.lang] || null, w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || p.isContentEditable) continue;
      var base = orig.has(n) ? orig.get(n) : n.nodeValue, key = base.trim(); if (!key) continue;
      var want = dict && dict[key] ? base.replace(key, dict[key]) : base;
      if (want !== n.nodeValue) { if (!orig.has(n)) orig.set(n, base); n.nodeValue = want; }
    }
  }
  function apply() {
    document.documentElement.classList.toggle('rn-dark', !!P.dark);
    document.documentElement.lang = P.lang || 'en';
    busy = true; walk(document.body); busy = false;
    var t = document.getElementById('rnux-dark'); if (t) { t.setAttribute('aria-pressed', P.dark ? 'true' : 'false'); t.textContent = P.dark ? '☀' : '☾'; }
    var s = document.getElementById('rnux-lang'); if (s) s.value = P.lang || 'en';
  }
  var ux = window.RNUX = {
    prefs: P,
    setDark: function (v) { P.dark = !!v; save(); apply(); },
    setLang: function (l) { P.lang = D[l] ? l : 'en'; save(); apply(); },
    undoToast: undoToast
  };
  function undoToast(msg, onUndo, ms) {
    var old = document.querySelector('.rnux-undo'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'rnux-undo'; d.setAttribute('role', 'status'); d.setAttribute('aria-live', 'polite');
    var sp = document.createElement('span'); sp.textContent = msg; var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo';
    var timer = setTimeout(function () { d.remove(); }, ms || 6000);
    b.addEventListener('click', function () { clearTimeout(timer); d.remove(); try { onUndo && onUndo(); } catch (e) { console.error(e); } });
    d.appendChild(sp); d.appendChild(b); document.body.appendChild(d); return d;
  }
  function bar() {
    if (document.getElementById('rnux-bar')) return;
    var w = document.createElement('div'); w.id = 'rnux-bar'; w.setAttribute('role', 'group'); w.setAttribute('aria-label', 'Display and language');
    var b = document.createElement('button'); b.id = 'rnux-dark'; b.type = 'button'; b.title = 'Dark mode'; b.setAttribute('aria-label', 'Dark mode');
    b.addEventListener('click', function () { ux.setDark(!P.dark); });
    var s = document.createElement('select'); s.id = 'rnux-lang'; s.setAttribute('aria-label', 'Language');
    [['en', 'English'], ['hi', 'हिन्दी'], ['te', 'తెలుగు']].forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
    s.addEventListener('change', function () { ux.setLang(s.value); });
    w.appendChild(b); w.appendChild(s); document.body.appendChild(w);
  }
  var q = null;
  new MutationObserver(function () { if (busy || !P.lang || P.lang === 'en') return; clearTimeout(q); q = setTimeout(function () { busy = true; walk(document.body); busy = false; }, 60); })
    .observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  function boot() { bar(); apply(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('storage', function (e) { if (e.key === KEY) { try { var n = JSON.parse(e.newValue || '{}'); P.dark = n.dark; P.lang = n.lang; apply(); } catch (x) {} } });
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