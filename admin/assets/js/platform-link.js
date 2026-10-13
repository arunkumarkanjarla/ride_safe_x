/* Admin portal: entry points into Platform control (control.html) - a nav item and a "managed live" note on the
   screens whose settings now flow to the other apps through RNPC. */
(function () {
  'use strict';
  var MAP = { A05: 'customers', A06: 'drivers', A07: 'drivers', A08: 'services', A09: 'pricing', A10: 'zones', A11: 'customers', A12: 'liveops', A13: 'liveops', A04: 'liveops', A21: 'broadcasts', A22: 'flags', A23: 'services', A24: 'partners', A28: 'offers', A20: 'roles', A19: 'audit' };
  function addNav() {
    if (document.querySelector('.rnpc-navlink')) return;
    var a = document.querySelector('#mock [data-go="A22"]') || document.querySelector('#mock nav a[data-go]'); if (!a) return;
    var n = document.createElement('a'); n.href = 'control.html#overview'; n.className = (a.className || '') + ' rnpc-navlink'; n.textContent = 'Platform control \u2197'; n.title = 'Live settings for all RideNova apps';
    a.parentNode.insertBefore(n, a.nextSibling);
  }
  function note() {
    var sid = window.RN && RN.ui && RN.ui.sid, tab = MAP[sid]; if (!tab) return;
    var sec = document.querySelector('.rn-screen[data-sid="' + sid + '"]'), dc = sec && (sec.querySelector('.dc') || sec.querySelector('.desk-body') || sec.querySelector('.body')); if (!dc || dc.querySelector('.rnpc-live')) return;
    var b = document.createElement('div'); b.className = 'banner info rnpc-live'; b.setAttribute('role', 'note');
    b.appendChild(document.createTextNode('Settings that reach the customer, driver, partner and agent apps are managed live in Platform control. '));
    var l = document.createElement('a'); l.href = 'control.html#' + tab; l.textContent = 'Open ' + tab + ' in Platform control'; b.appendChild(l);
    dc.insertBefore(b, dc.firstChild);
  }
  function tick() { try { addNav(); note(); } catch (e) {} }
  setInterval(tick, 700); window.addEventListener('hashchange', function () { setTimeout(tick, 60); });
})();
