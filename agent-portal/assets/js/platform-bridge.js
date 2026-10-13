/* RideNova agent portal <- admin Platform control (RNPC): broadcasts and maintenance come from shared/platform.js;
   this adds a live "Ops desk" chip with open SOS and support tickets raised or managed in admin, plus the admin FAQs. */
(function () {
  'use strict';
  var PC = window.RNPC; if (!PC) return;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x != null) n.textContent = x; return n; }
  var chip, panel;
  function counts() { var o = PC.ops; return { sos: Object.keys(o.sos).filter(function (k) { return o.sos[k].status !== 'Resolved'; }).length, tix: o.tickets.filter(function (t) { return t.status !== 'Resolved'; }).length }; }
  function draw() {
    if (!document.body) return; var c = counts();
    if (!chip) { chip = el('button', 'rnpc-desk'); chip.type = 'button'; chip.setAttribute('aria-haspopup', 'dialog'); chip.addEventListener('click', toggle); document.body.appendChild(chip); }
    chip.textContent = 'Ops desk \u00B7 ' + c.sos + ' SOS \u00B7 ' + c.tix + ' tickets'; chip.classList.toggle('hot', c.sos > 0);
    if (panel) fill();
  }
  function fill() {
    panel.innerHTML = ''; var o = PC.ops, hd = el('div', 'rnpc-dh'); hd.appendChild(el('b', null, 'Ops desk (from admin)')); var x = el('button', 'rnpc-x', '\u00D7'); x.type = 'button'; x.setAttribute('aria-label', 'Close ops desk'); x.addEventListener('click', toggle); hd.appendChild(x); panel.appendChild(hd);
    var sos = Object.keys(o.sos).map(function (k) { return o.sos[k]; }).filter(function (s) { return s.status !== 'Resolved'; });
    panel.appendChild(el('h4', null, 'Open SOS (' + sos.length + ')')); if (!sos.length) panel.appendChild(el('p', 'rnpc-mut', 'No open SOS.'));
    sos.forEach(function (s) { panel.appendChild(el('div', 'rnpc-li', s.id + ' \u00B7 ' + s.status + ' \u00B7 ' + (s.from || ''))); });
    var tix = o.tickets.filter(function (t) { return t.status !== 'Resolved'; });
    panel.appendChild(el('h4', null, 'Open tickets (' + tix.length + ')')); if (!tix.length) panel.appendChild(el('p', 'rnpc-mut', 'No open tickets.'));
    tix.forEach(function (t) { panel.appendChild(el('div', 'rnpc-li', t.priority + ' \u00B7 ' + t.subject + ' \u00B7 ' + (t.assignee || 'Unassigned'))); });
    panel.appendChild(el('h4', null, 'FAQs to share'));
    (PC.cfg.content.faqs || []).forEach(function (f) { var d = el('details', 'rnpc-li'); d.appendChild(el('summary', null, f.q)); d.appendChild(el('p', null, f.a)); panel.appendChild(d); });
    panel.appendChild(el('p', 'rnpc-mut', 'Support line: ' + PC.cfg.content.supportPhone));
  }
  function toggle() { if (panel) { panel.remove(); panel = null; chip.setAttribute('aria-expanded', 'false'); chip.focus(); return; } panel = el('div', 'rnpc-dpanel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Ops desk'); document.body.appendChild(panel); chip.setAttribute('aria-expanded', 'true'); fill(); var b = panel.querySelector('button'); if (b) b.focus(); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel) toggle(); });
  PC.on(draw);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', draw); else draw();
  /* styles live in shared/platform.css (CSP style-src self) */

})();
