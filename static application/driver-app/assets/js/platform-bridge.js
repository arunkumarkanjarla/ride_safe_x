/* RideNova driver app <- admin Platform control (RNPC).
   KYC decisions (approve / reject with reason) and suspensions come from admin; quests and payout rules follow admin config;
   the driver profile, onboarding stage and SOS are published to ops so admin sees them live. */
(function () {
  'use strict';
  var RN = window.RN, PC = window.RNPC; if (!RN || !PC || !RN.driverStore) return;
  var UI = RN.ui, ST = RN.driverStore, S = ST.data;
  var DOCS = { dl: 'Driving licence', rc: 'Vehicle RC', ins: 'Insurance', id: 'Aadhaar / PAN', selfie: 'Selfie', pan: 'PAN', aadhaar: 'Aadhaar', permit: 'Permit', puc: 'PUC' };
  // KYC: returns {status: ''|'approved'|'rejected', reason, auto}
  RN.kycDecision = function (s) {
    var rec = PC.ops.kyc[s.phone], fresh = rec && rec.at >= (s.submittedAt || 0) - 2000;
    if (!fresh) { submit(s); return { status: '' }; }
    if (rec.status === 'approved' || rec.status === 'rejected') return { status: rec.status, reason: rec.reason, auto: /auto/.test(rec.by || '') };
    var secs = +PC.cfg.drivers.kycAutoApproveSecs || 0;
    if (secs > 0 && Date.now() - (s.submittedAt || rec.at) > secs * 1000) {
      PC.opsUpdate(function (o) { var r = o.kyc[s.phone]; if (r && r.status === 'pending') { r.status = 'approved'; r.by = 'auto (simulated review)'; r.decidedAt = Date.now(); } }, { by: 'system', role: 'AUTO', action: 'kyc.auto_approve', detail: 'Auto-approved KYC for ' + (s.profile.name || s.phone) + ' after ' + secs + 's', area: 'drivers' });
      return { status: 'approved', auto: true };
    }
    return { status: '' };
  };
  function submit(s) {
    PC.opsUpdate(function (o) { o.kyc[s.phone] = { status: 'pending', name: s.profile.name, city: s.profile.city, vehicle: s.profile.vehicle + (s.profile.plate ? ' \u00B7 ' + s.profile.plate : ''), docs: Object.keys(s.docs || {}).map(function (k) { return DOCS[k] || k; }), at: s.submittedAt || Date.now(), reason: '' }; });
  }
  RN.questList = function (orig) { var q = PC.cfg.drivers.quests || []; if (!q.length) return orig; return q.filter(function (x) { return x.on; }).map(function (x) { return { id: x.id, t: x.title, d: x.desc || 'Complete ' + x.target + ' trips', goal: x.target, base: Math.min(x.target, x.progress || 0), paise: x.rewardPaise }; }); };
  RN.payoutFee = function () { return Math.round((PC.cfg.drivers.payout.instantFeePaise || 0) / 100); };
  RN.payoutMin = function () { return Math.max(1, Math.round((PC.cfg.drivers.payout.minPaise || 100) / 100)); };
  // suspension -> engine 'blocked' (driver.online refuses), forced offline, banner
  var wasSusp = null;
  function enforce() {
    var e = UI.engine; if (!e || !S.signedIn || !S.phone) return;
    var rec = PC.ops.drivers[S.phone] || {}, susp = rec.status === 'suspended', s = e.state, d = s.drivers && s.drivers[s.persona]; if (!d) return;
    if (susp) { var ch = !d.blocked || d.avail !== 'OFFLINE'; d.blocked = true; if (d.avail === 'ONLINE') d.avail = 'OFFLINE'; if (ch) { e._emit(); if (wasSusp === false || wasSusp === null) UI.toast('Your account is suspended: ' + (rec.reason || 'contact driver support') + '. You cannot go online.', 'error'); if (UI.sid === 'D06') UI.go('D05'); } }
    else if (d.blocked && wasSusp) { d.blocked = false; e._emit(); UI.toast('Your account is active again. You can go online.', 'info'); }
    wasSusp = susp;
    var host = document.querySelector('#mock .scr'), b = host && host.querySelector('.rnpc-susp');
    if (susp && host && !b) { b = document.createElement('div'); b.className = 'rnpc-bc rnpc-susp'; b.innerHTML = '<div class="rnpc-b warn" role="alert"><span class="rnpc-t"></span></div>'; b.querySelector('.rnpc-t').textContent = 'Account suspended: ' + (rec.reason || 'contact driver support') + '. Call ' + PC.cfg.content.supportPhone + '.'; b.style.top = '96px'; host.appendChild(b); }
    else if (!susp && b) b.remove();
  }
  // rejected KYC reason on the documents screen
  function rejectNote() {
    var sec = document.querySelector('.rn-screen[data-sid="D03"]'), n = sec && sec.querySelector('.rnpc-kyc');
    if (S.kycReject && S.stage === 'registered' && sec && !n) { var body = sec.querySelector('.body') || sec; n = document.createElement('div'); n.className = 'banner warn rnpc-kyc'; n.setAttribute('role', 'alert'); n.textContent = 'Not approved: ' + S.kycReject + ' Upload your documents again and resubmit.'; body.insertBefore(n, body.firstChild); }
    else if (n && !(S.kycReject && S.stage === 'registered')) n.remove();
  }
  var pubSig = '', seenAt = 0;
  function publish() {
    if (!S.signedIn || !S.phone) return; var e = UI.engine, s = e && e.state, inc = [];
    if (s && s.incidents) Object.keys(s.incidents).forEach(function (k) { var i = s.incidents[k]; if (i.by === 'driver' || /driver/i.test(i.by || '')) inc.push({ id: i.id || k, state: i.state, at: i.at || i.createdAt || 0 }); });
    var p = S.profile, sig = JSON.stringify([p.name, p.city, p.vehicle, p.plate, S.stage, inc]), now = Date.now();
    if (sig === pubSig && now - seenAt < 60000) return; pubSig = sig; seenAt = now;
    PC.opsUpdate(function (o) {
      var d = o.drivers[S.phone] = o.drivers[S.phone] || { status: 'active' }; d.name = p.name; d.city = p.city; d.vehicle = p.vehicle; d.plate = p.plate; d.stage = S.stage; d.seen = now;
      inc.forEach(function (i) { if (!o.sos[i.id]) o.sos[i.id] = { id: i.id, from: 'Driver ' + p.name + ' +91 ' + S.phone, text: 'Driver SOS', status: 'Open', at: i.at || now }; });
    });
  }
  function tick() { try { enforce(); rejectNote(); publish(); } catch (e) { console.error(e); } }
  PC.on(tick);
  var wait = setInterval(function () { if (!UI.engine || !UI.sid) return; clearInterval(wait); tick(); setInterval(tick, 1000); }, 100);
})();
