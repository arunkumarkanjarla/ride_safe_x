/* RideNova partner app <- admin Platform control (RNPC).
   Application approval/rejection, commission %, menu moderation and payouts follow admin; the application and menu are published to ops. */
(function () {
  'use strict';
  var RN = window.RN, PC = window.RNPC; if (!RN || !PC || !RN.partnerStore) return;
  var UI = RN.ui, ST = RN.partnerStore, D = ST.data;
  // stage 0..3 = progress, -1 = rejected
  RN.partnerStage = function (d) {
    if (!d.app) return 0; var rec = PC.ops.partnerApps[d.app.id];
    if (!rec) { PC.opsUpdate(function (o) { o.partnerApps[d.app.id] = { biz: d.app.biz, type: d.app.type, email: d.app.email, status: 'pending', at: d.app.at, reason: '' }; }); rec = { status: 'pending' }; }
    if (rec.status === 'approved') return 3;
    if (rec.status === 'rejected') { if (d.app.reason !== rec.reason) { d.app.reason = rec.reason; ST.save(); } return -1; }
    var secs = +PC.cfg.partners.autoApproveSecs || 0, el = Date.now() - d.app.at;
    if (secs > 0) { var s = Math.floor(el / (secs * 1000)); if (s >= 3) { PC.opsUpdate(function (o) { var r = o.partnerApps[d.app.id]; if (r && r.status === 'pending') { r.status = 'approved'; r.by = 'auto (simulated review)'; r.decidedAt = Date.now(); } }, { by: 'system', role: 'AUTO', action: 'partner.auto_approve', detail: 'Auto-approved partner ' + d.app.biz, area: 'partners' }); return 3; } return s; }
    return Math.min(2, Math.floor(el / 5000)); // manual: progress to "Business verified" and wait for admin
  };
  RN.partnerCommission = function () { return PC.cfg.partners.commissionPct; };
  var lastStage = null, menuSig = '';
  function tick() {
    try {
      if (D.app) { var s = RN.partnerStage(D); if (lastStage !== null && s !== lastStage) { if (s === 3) UI.toast('Your business is approved by RideNova. You can sign in now.', 'info'); if (s === -1) UI.toast('Application not approved: ' + (D.app.reason || ''), 'error'); if (UI.sid === 'P01') UI.go('P01', { replace: true }); } lastStage = s; }
      var hid = PC.ops.menuHidden || {}, ch = false, hits = [];
      (D.menu || []).forEach(function (m) { var r = hid[m.n]; if (r && (m.on || m.mod !== r)) { m.on = false; m.mod = r; m.note = 'Hidden by RideNova: ' + r; ch = true; hits.push(m.n); } else if (!r && m.mod) { delete m.mod; m.note = ''; ch = true; } });
      if (ch) { ST.save(); if (hits.length) UI.toast('RideNova hid ' + hits.join(', ') + ' from your menu. See the note on the item.', 'warn'); if (UI.sid === 'P03') UI.go('P03', { replace: true }); }
      var sig = JSON.stringify((D.menu || []).map(function (m) { return [m.n, m.p, m.veg, m.on]; }));
      if (sig !== menuSig) { menuSig = sig; PC.opsUpdate(function (o) { o.partnerMenu = (D.menu || []).map(function (m) { return { n: m.n, p: m.p, veg: !!m.veg, on: !!m.on }; }); }); }
    } catch (e) { console.error(e); }
  }
  PC.on(tick);
  var wait = setInterval(function () { if (!UI.engine || !UI.sid) return; clearInterval(wait); tick(); setInterval(tick, 1000); }, 100);
})();
