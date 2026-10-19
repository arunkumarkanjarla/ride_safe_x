/* RideNova Admin portal – Partner onboarding review (A24).
   Every application from restaurants, hotels, rental fleets and bus operators, with filters and a working review flow:
     Submitted → Document review → (More information requested ↔ partner re-submits) → Site visit (restaurants, hotels)
     → Agreement → Approved → Live;  Rejected (reopen possible) and Suspended (reinstate possible) on the side.
   Documents are verified or rejected one by one, automatic checks can be overridden with a note, and the next step only
   unlocks when the rules of the current one are met. Permission-checked (partner.approve) and audited. Synthetic data. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, OD = RN.opsData, U = RN.opsUI, OPS = RN.ops, K = RN.kit;
  var h = U.h, btn = U.btn, st = U.st, card = U.card;
  var PERM = 'partner.approve', SLA_H = 48;
  var STAGE = { SUBMITTED: ['New', 'warn'], IN_REVIEW: ['In review', 'info'], INFO_REQUESTED: ['Waiting for partner', 'warn'], SITE_VISIT: ['Site visit', 'info'],
    AGREEMENT: ['Agreement', 'info'], APPROVED: ['Ready to go live', 'ok'], LIVE: ['Live', 'ok'], REJECTED: ['Rejected', 'err'], SUSPENDED: ['Suspended', 'err'] };
  var OPEN = ['SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED', 'SITE_VISIT', 'AGREEMENT', 'APPROVED'];
  var FILTERS = [['open', 'Open'], ['SUBMITTED', 'New'], ['IN_REVIEW', 'In review'], ['INFO_REQUESTED', 'Waiting for partner'], ['SITE_VISIT', 'Site visit'], ['AGREEMENT', 'Agreement'],
    ['APPROVED', 'Ready to go live'], ['LIVE', 'Live'], ['REJECTED', 'Rejected'], ['SUSPENDED', 'Suspended'], ['overdue', 'Overdue'], ['all', 'All']];
  var M = { stage: 'open', type: '', who: '', q: '', sel: null, table: { sort: 'waiting', dir: -1, page: 0 } };

  function overdue(p) { return OPEN.indexOf(p.stage) >= 0 && Date.now() - p.submittedAt > SLA_H * 3600000; }
  function match(p, f) { return f === 'all' ? true : f === 'open' ? OPEN.indexOf(p.stage) >= 0 : f === 'overdue' ? overdue(p) : p.stage === f; }
  function myName() { return (UI.engine.state.session.admin.name || 'Priya K.'); }
  function log(p, text) { p.history.push({ at: Date.now(), text: text, by: myName() }); }
  function steps(p) { var visit = OD.PARTNER_TYPES[p.type].visit; return [['SUBMITTED', 'Submitted'], ['IN_REVIEW', 'Document review']].concat(visit ? [['SITE_VISIT', 'Site visit']] : []).concat([['AGREEMENT', 'Agreement'], ['APPROVED', 'Approved'], ['LIVE', 'Live']]); }
  function docsDone(p) { return p.docs.every(function (d) { return d.state === 'VERIFIED'; }); }
  function checksOk(p) { return p.checks.every(function (c) { return c.state !== 'fail'; }); }

  function rows() {
    return OD.partners.filter(function (p) {
      if (!OD.inGeo(p.city, OPS.geo) || !match(p, M.stage)) return false;
      if (M.type && p.type !== M.type) return false;
      if (M.who === 'me' && p.assignee !== myName()) return false;
      if (M.who === 'none' && p.assignee !== 'Unassigned') return false;
      if (M.q && (p.id + ' ' + p.name + ' ' + p.owner.name + ' ' + OD.CITIES[p.city].name).toLowerCase().indexOf(M.q) < 0) return false;
      return true;
    });
  }

  function render() {
    if (OPS.nav.partnerStage) { M.stage = OPS.nav.partnerStage; M.table.page = 0; delete OPS.nav.partnerStage; }
    var root = U.mount('ops-a24'); if (!root) return;
    var inGeo = OD.partners.filter(function (p) { return OD.inGeo(p.city, OPS.geo); });
    root.appendChild(h('div', { class: 'ops-bar' }, [U.geoBar(function () { M.table.page = 0; render(); }), h('span', { class: 'sp' }),
      U.select('Partner type', [['', 'Type: all']].concat(Object.keys(OD.PARTNER_TYPES).map(function (t) { return [t, t]; })), M.type, function (v) { M.type = v; M.table.page = 0; render(); }),
      U.select('Reviewer', [['', 'Reviewer: anyone'], ['me', 'Assigned to me'], ['none', 'Unassigned']], M.who, function (v) { M.who = v; M.table.page = 0; render(); }),
      U.search('Search partner, owner, city or ID', M.q, function (q) { M.q = q; M.table.page = 0; drawList(); })]));
    root.appendChild(h('div', { class: 'ops-bar' }, [U.chips('Stage', FILTERS.map(function (f) { return [f[0], f[1], String(inGeo.filter(function (p) { return match(p, f[0]); }).length)]; }), M.stage, function (v) { M.stage = v; M.table.page = 0; render(); })]));
    var split = h('div', { class: 'ops-split' }), left = h('div', { class: 'ops-split-l' }), right = h('div', { class: 'ops-split-r', 'aria-live': 'polite' });
    split.appendChild(left); split.appendChild(right); root.appendChild(split);
    M.left = left; M.right = right;
    drawList(); drawDetail();
  }
  function drawList() {
    var left = M.left; if (!left) return; UI.clear(left);
    left.appendChild(U.table({ rows: rows(), pageSize: 15, state: M.table, selected: function (p) { return p.id === M.sel; }, empty: 'No applications match these filters.',
      columns: [
        { key: 'name', label: 'Partner', get: function (p) { return h('span', null, [h('b', { text: p.name }), h('div', { class: 'ops-muted', text: p.id + ' · ' + p.type })]); }, sort: function (p) { return p.name; } },
        { key: 'city', label: 'City', get: function (p) { return OD.CITIES[p.city].name; }, sort: function (p) { return OD.CITIES[p.city].name; } },
        { key: 'stage', label: 'Stage', get: function (p) { return st(STAGE[p.stage][0], STAGE[p.stage][1]); }, sort: function (p) { return OD.STAGES.indexOf(p.stage); } },
        { key: 'waiting', label: 'Waiting', cls: 'num', get: function (p) { return h('span', null, [U.since(p.submittedAt), overdue(p) ? st('SLA', 'err') : null]); }, sort: function (p) { return Date.now() - p.submittedAt; } },
        { key: 'docs', label: 'Docs', cls: 'num', get: function (p) { return p.docs.filter(function (d) { return d.state === 'VERIFIED'; }).length + '/' + p.docs.length; }, sort: function (p) { return p.docs.filter(function (d) { return d.state === 'VERIFIED'; }).length; } },
        { key: 'risk', label: 'Risk', get: function (p) { return st(p.risk, p.risk === 'High' ? 'err' : p.risk === 'Medium' ? 'warn' : 'ok'); }, sort: function (p) { return ['Low', 'Medium', 'High'].indexOf(p.risk); } },
        { key: 'who', label: 'Reviewer', get: function (p) { return p.assignee; }, sort: function (p) { return p.assignee; } }],
      onRow: function (p) { M.sel = p.id; drawList(); drawDetail(); } }));
  }

  // ---------------------------------------------------------------- detail and workflow
  function drawDetail() {
    var right = M.right; if (!right) return; UI.clear(right);
    var p = M.sel && OD.partner(M.sel);
    if (!p) { right.appendChild(h('div', { class: 'ops-placeholder' }, [h('b', { text: 'Select an application' }), h('p', { text: 'Pick a partner on the left to review its documents, checks and next step.' })])); return; }
    var city = OD.CITIES[p.city];
    right.appendChild(h('div', { class: 'ops-dhead' }, [h('h2', { text: p.name }), st(STAGE[p.stage][0], STAGE[p.stage][1]), st('Risk ' + p.risk.toLowerCase(), p.risk === 'High' ? 'err' : p.risk === 'Medium' ? 'warn' : 'ok'), overdue(p) ? st('Over ' + SLA_H + ' h', 'err') : null]));
    right.appendChild(h('p', { class: 'ops-muted', text: p.id + ' · ' + p.type + ' · ' + city.name + ', ' + city.stateName + ', ' + city.countryName + ' · submitted ' + U.clock(p.submittedAt) + ' (' + U.since(p.submittedAt) + ' ago) · reviewer ' + p.assignee }));
    // progress
    var ol = h('ol', { class: 'ops-steps', 'aria-label': 'Onboarding progress' }), list = steps(p), at = list.map(function (s) { return s[0]; }).indexOf(p.stage === 'INFO_REQUESTED' ? 'IN_REVIEW' : p.stage);
    list.forEach(function (s, i) { ol.appendChild(h('li', { class: p.stage === 'REJECTED' || p.stage === 'SUSPENDED' ? (i <= Math.max(0, at) ? 'done' : '') : i < at ? 'done' : i === at ? 'now' : '', text: s[1] })); });
    right.appendChild(ol);
    right.appendChild(nextStep(p));
    right.appendChild(card('Documents', [docs(p)]));
    right.appendChild(card('Automatic checks', [checks(p)]));
    var det = Object.keys(p.details).map(function (k) { return [k, p.details[k]]; });
    right.appendChild(h('div', { class: 'ops-grid ops-grid-2' }, [
      card('Business', [U.kv([['Type', p.type]].concat(det).concat([['Commission', p.commission + '%'], p.visit ? ['Site visit', U.clock(p.visit.at) + ' · ' + p.visit.by + (p.visit.result ? ' · ' + p.visit.result : '')] : null]))]),
      card('Owner', [U.kv([['Name', p.owner.name], ['Phone', p.owner.phone], ['E-mail', p.owner.email]]), h('div', { class: 'ops-actions' }, [
        btn('Message partner', function (b) { message(p, b); }, 'g'), btn('Call', function (b) { U.act(PERM, 'call partner ' + p.id, p.id, 'telephony.call', b).then(function (y) { if (y) { log(p, 'Called the owner (masked number)'); UI.toast('Calling ' + p.owner.name + ' (simulated).', 'info'); drawDetail(); } }); }, 'g')])])]));
    right.appendChild(card('History', [U.timeline(p.history)], [btn('Add note', function (b) { note(p, b); }, 'g')]));
  }

  function nextStep(p) {
    var box = h('section', { class: 'ops-next', 'aria-label': 'Next step' }), acts = h('div', { class: 'ops-actions' });
    var say = function (t) { box.appendChild(h('p', null, [h('b', { text: 'Next step: ' }), t])); };
    var a = function (label, fn, cls, enabled, why) { var b = btn(label, function () { fn(b); }, cls); if (enabled === false) { b.disabled = true; b.title = why || ''; } acts.appendChild(b); };
    var pending = p.docs.filter(function (d) { return d.state === 'PENDING'; }).length, rejected = p.docs.filter(function (d) { return d.state === 'REJECTED'; }).length;
    switch (p.stage) {
      case 'SUBMITTED':
        say('assign the application and start the document review.');
        a('Assign to me & start review', function (b) { move(p, 'IN_REVIEW', 'Review started', b, function () { p.assignee = myName(); }); });
        break;
      case 'IN_REVIEW':
        if (pending) say('verify or reject the ' + pending + ' pending document' + (pending > 1 ? 's' : '') + '.');
        else if (rejected) say(rejected + ' document' + (rejected > 1 ? 's were' : ' was') + ' rejected – ask the partner for new ones, or reject the application.');
        else if (!checksOk(p)) say('a failed automatic check must be resolved (override with a note) before continuing.');
        else say(OD.PARTNER_TYPES[p.type].visit ? 'all documents are verified – book the site visit.' : 'all documents are verified – send the agreement.');
        a('Request more information', function (b) { requestInfo(p, b); }, 'g', rejected + pending > 0, 'All documents are verified');
        a(OD.PARTNER_TYPES[p.type].visit ? 'Send to site visit' : 'Send agreement', function (b) { move(p, OD.PARTNER_TYPES[p.type].visit ? 'SITE_VISIT' : 'AGREEMENT', OD.PARTNER_TYPES[p.type].visit ? 'All documents verified · site visit needed' : 'All documents verified · agreement sent (commission ' + p.commission + '%)', b); }, '', docsDone(p) && checksOk(p), 'Verify every document and resolve failed checks first');
        if (p.assignee !== myName()) a('Assign to me', function (b) { U.act(PERM, 'assign application ' + p.id, p.id, 'partner.assigned', b).then(function (y) { if (y) { p.assignee = myName(); log(p, 'Reassigned to ' + myName()); refresh(); } }); }, 'g');
        break;
      case 'INFO_REQUESTED':
        say('waiting for the partner to upload: ' + p.requested.map(function (k) { return p.docs.filter(function (d) { return d.key === k; })[0].title; }).join(', ') + '.');
        a('Send reminder', function (b) { U.act(PERM, 'remind partner ' + p.id, p.id, 'partner.reminded', b).then(function (y) { if (y) { log(p, 'Reminder sent to the partner'); UI.toast('Reminder sent in the partner app and by e-mail (simulated).', 'info'); refresh(); } }); }, 'g');
        a('Partner re-submitted (simulate)', function (b) {
          U.act(PERM, 'receive documents for ' + p.id, p.id, 'partner.resubmitted', b).then(function (y) {
            if (!y) return;
            p.docs.forEach(function (d) { if (p.requested.indexOf(d.key) >= 0) { d.state = 'PENDING'; d.note = 'New upload'; } });
            p.history.push({ at: Date.now(), text: 'Partner uploaded ' + p.requested.length + ' new document(s)', by: p.owner.name });
            p.requested = []; p.stage = 'IN_REVIEW'; refresh();
          });
        }, 'g');
        break;
      case 'SITE_VISIT':
        if (!p.visit) { say('book a site visit with the field team.'); a('Schedule visit', function (b) { schedule(p, b); }); }
        else if (!p.visit.result) {
          say('record the result of the visit on ' + U.clock(p.visit.at) + ' (' + p.visit.by + ').');
          a('Visit passed', function (b) { move(p, 'AGREEMENT', 'Site visit passed · agreement sent (commission ' + p.commission + '%)', b, function () { p.visit.result = 'Passed'; }); });
          a('Visit failed', function (b) { reject(p, b, 'Failed site visit'); }, 'r');
          a('Reschedule', function (b) { schedule(p, b); }, 'g');
        }
        break;
      case 'AGREEMENT':
        say('the partner signs the agreement (commission ' + p.commission + '%).');
        a('Change commission', function (b) { commission(p, b); }, 'g');
        a('Mark agreement signed', function (b) { move(p, 'APPROVED', 'Agreement signed · application approved', b); });
        break;
      case 'APPROVED':
        say('switch the partner live: they appear to customers and get access to the partner app.');
        a('Go live', function (b) { move(p, 'LIVE', 'Partner is live · partner app access created', b); });
        break;
      case 'LIVE':
        say('none – the partner is live. Suspend only for serious issues.');
        a('Suspend', function (b) { suspend(p, b); }, 'r');
        break;
      case 'SUSPENDED':
        say('reinstate when the issue is resolved.');
        a('Reinstate', function (b) { move(p, 'LIVE', 'Reinstated', b); });
        break;
      case 'REJECTED':
        say('none – rejected (' + (p.rejection || 'see history') + '). Reopen if the partner appeals with new information.');
        a('Reopen application', function (b) { move(p, 'IN_REVIEW', 'Application reopened', b, function () { p.rejection = null; }); }, 'g');
        break;
    }
    if (OPEN.indexOf(p.stage) >= 0) a('Reject application', function (b) { reject(p, b); }, 'r');
    if (!U.can(PERM)) box.appendChild(h('p', { class: 'ops-warn', text: 'Your role (' + RN.rbac.LABELS[UI.engine.state.session.admin.role] + ') cannot approve partners (needs ' + PERM + '). Attempts are recorded in the audit log.' }));
    box.appendChild(acts);
    return box;
  }
  function docs(p) {
    var grid = h('div', { class: 'ops-docs' }), editable = p.stage === 'IN_REVIEW';
    p.docs.forEach(function (d) {
      var tile = h('div', { class: 'ops-doc ' + d.state.toLowerCase() }, [h('div', { class: 'ops-docimg', 'aria-hidden': 'true', text: d.title.charAt(0) }),
        h('b', { text: d.title }), st(d.state === 'VERIFIED' ? 'Verified' : d.state === 'REJECTED' ? 'Rejected' : 'Pending', d.state === 'VERIFIED' ? 'ok' : d.state === 'REJECTED' ? 'err' : 'warn'),
        d.note ? h('span', { class: 'ops-muted', text: d.note }) : null]);
      if (editable) {
        var row = h('div', { class: 'ops-acts' });
        if (d.state !== 'VERIFIED') row.appendChild(btn('Verify', function (b) { U.act(PERM, 'verify ' + d.title + ' of ' + p.id, p.id, 'partner.document_verified', b).then(function (y) { if (y) { d.state = 'VERIFIED'; d.note = ''; log(p, d.title + ' verified'); refresh(); } }); }, ''));
        if (d.state !== 'REJECTED') row.appendChild(btn('Reject', function (b) {
          U.form('Reject “' + d.title + '”', [{ name: 'why', label: 'Reason shown to the partner', type: 'select', options: [['Image blurred, please re-upload', 'Image blurred'], ['Name does not match registration', 'Name mismatch'], ['Document expired', 'Expired'], ['Page missing', 'Page missing'], ['Wrong document', 'Wrong document']] }], 'Reject document').then(function (f) {
            if (!f) return;
            U.act(PERM, 'reject ' + d.title + ' of ' + p.id, p.id, 'partner.document_rejected', b).then(function (y) { if (y) { d.state = 'REJECTED'; d.note = f.why; log(p, d.title + ' rejected · ' + f.why); refresh(); } });
          });
        }, 'g'));
        tile.appendChild(row);
      }
      grid.appendChild(tile);
    });
    if (!editable) grid.appendChild(h('p', { class: 'ops-muted ops-docnote', text: 'Documents can be verified or rejected while the application is in review.' }));
    return grid;
  }
  function checks(p) {
    return h('table', { class: 'dt ops-dt' }, [h('thead', null, [h('tr', null, ['Check', 'Result', '', ''].map(function (t) { return h('th', { text: t }); }))]),
      h('tbody', null, p.checks.map(function (c) {
        var b = c.state !== 'pass' && OPEN.indexOf(p.stage) >= 0 ? btn('Override', function (el) {
          U.form('Override “' + c.name + '”', [{ name: 'why', label: 'Why is this acceptable?', type: 'textarea', required: true }], 'Override').then(function (f) {
            if (!f) return;
            U.act(PERM, 'override check ' + c.name + ' of ' + p.id, p.id, 'partner.check_overridden', el).then(function (y) { if (y) { c.state = 'pass'; c.result = 'Overridden: ' + f.why; log(p, 'Check “' + c.name + '” overridden · ' + f.why); refresh(); } });
          });
        }, 'g') : null;
        return h('tr', null, [h('td', { text: c.name }), h('td', { class: 'w', text: c.result }), h('td', null, [st(c.state === 'pass' ? 'Pass' : c.state === 'warn' ? 'Check' : 'Fail', c.state === 'pass' ? 'ok' : c.state === 'warn' ? 'warn' : 'err')]), h('td', null, [b])]);
      }))]);
  }

  function refresh() { drawList(); drawDetail(); }
  function move(p, stage, text, b, before) {
    U.act(PERM, text.toLowerCase() + ' · ' + p.id, p.id, 'partner.' + stage.toLowerCase(), b).then(function (y) {
      if (!y) return;
      if (before) before(); p.stage = stage; log(p, text);
      if (stage === 'SITE_VISIT') p.visit = null;
      UI.toast(p.name + ': ' + STAGE[stage][0].toLowerCase() + '.', 'info'); refresh();
    });
  }
  function requestInfo(p, b) {
    var need = p.docs.filter(function (d) { return d.state !== 'VERIFIED'; });
    U.form('Ask ' + p.name + ' for more information', [{ name: 'docs', label: 'Documents to upload again', type: 'checks', options: need.map(function (d) { return [d.key, d.title]; }), value: need.map(function (d) { return d.key; }), required: true },
      { name: 'text', label: 'Message to the partner', type: 'textarea', required: true, value: 'Please upload clear, valid copies of the documents listed.' }], 'Send request').then(function (f) {
      if (!f) return;
      U.act(PERM, 'request information from ' + p.id, p.id, 'partner.info_requested', b).then(function (y) {
        if (!y) return;
        p.requested = f.docs; p.stage = 'INFO_REQUESTED'; log(p, 'More information requested (' + f.docs.length + ' document(s)): “' + f.text + '”');
        UI.toast('Request sent to the partner app (simulated).', 'info'); refresh();
      });
    });
  }
  function schedule(p, b) {
    var d = new Date(Date.now() + 2 * 86400000), iso = d.toISOString().slice(0, 10);
    U.form('Schedule the site visit', [{ name: 'date', label: 'Date', type: 'date', value: iso, required: true, check: function (v) { return new Date(v + 'T10:00') < new Date() ? 'Pick a date in the future.' : null; } },
      { name: 'team', label: 'Field team', type: 'select', options: [['Field team North', 'Field team North'], ['Field team South', 'Field team South'], ['Partner success · remote video', 'Remote video call']] }], 'Schedule').then(function (f) {
      if (!f) return;
      U.act(PERM, 'schedule a site visit for ' + p.id, p.id, 'partner.visit_scheduled', b).then(function (y) { if (y) { p.visit = { at: new Date(f.date + 'T10:00').getTime(), by: f.team }; log(p, 'Site visit scheduled for ' + U.clock(p.visit.at) + ' · ' + f.team); refresh(); } });
    });
  }
  function commission(p, b) {
    U.form('Commission for ' + p.name, [{ name: 'c', label: 'Commission (%)', type: 'number', value: String(p.commission), required: true, check: function (v) { var n = Number(v); return !(n >= 5 && n <= 30) ? 'Commission must be between 5 and 30%.' : null; } }], 'Save').then(function (f) {
      if (!f) return;
      U.act(PERM, 'change commission of ' + p.id, p.id, 'partner.commission_changed', b).then(function (y) { if (y) { log(p, 'Commission changed from ' + p.commission + '% to ' + Number(f.c) + '% · new agreement sent'); p.commission = Number(f.c); refresh(); } });
    });
  }
  function reject(p, b, preset) {
    U.form('Reject ' + p.name + '?', [{ name: 'why', label: 'Reason', type: 'select', value: preset || '', options: [['Documents not valid', 'Documents not valid'], ['Failed site visit', 'Failed site visit'], ['Duplicate listing', 'Duplicate listing'], ['Outside service area', 'Outside service area'], ['Failed background check', 'Failed background check']] },
      { name: 'note', label: 'Message to the partner', type: 'textarea', required: true, value: 'We are unable to approve your application at this time.' }], 'Reject', 'The partner is told in the partner app and by e-mail. The application can be reopened later.').then(function (f) {
      if (!f) return;
      U.act(PERM, 'reject partner ' + p.id, p.id, 'partner.rejected', b).then(function (y) { if (y) { p.stage = 'REJECTED'; p.rejection = f.why; if (p.visit && f.why === 'Failed site visit') p.visit.result = 'Failed'; log(p, 'Rejected · ' + f.why + ': “' + f.note + '”'); refresh(); } });
    });
  }
  function suspend(p, b) {
    U.form('Suspend ' + p.name + '?', [{ name: 'why', label: 'Reason', type: 'select', options: [['Repeated customer complaints', 'Repeated customer complaints'], ['Food safety issue', 'Food safety issue'], ['Fraud investigation', 'Fraud investigation'], ['Partner request', 'Partner request']] }], 'Suspend', 'The partner is hidden from customers until reinstated.').then(function (f) {
      if (!f) return;
      U.act(PERM, 'suspend partner ' + p.id, p.id, 'partner.suspended', b).then(function (y) { if (y) { p.stage = 'SUSPENDED'; log(p, 'Suspended · ' + f.why); refresh(); } });
    });
  }
  function message(p, b) {
    U.form('Message to ' + p.owner.name, [{ name: 'text', label: 'Message', type: 'textarea', required: true }], 'Send').then(function (f) {
      if (!f) return;
      U.act(PERM, 'message partner ' + p.id, p.id, 'partner.messaged', b).then(function (y) { if (y) { log(p, 'Message to the partner: “' + f.text + '”'); UI.toast('Sent in the partner app (simulated).', 'info'); refresh(); } });
    });
  }
  function note(p, b) {
    U.form('Internal note on ' + p.id, [{ name: 'text', label: 'Note (not shown to the partner)', type: 'textarea', required: true }], 'Add').then(function (f) {
      if (!f) return;
      U.act(PERM, 'note on ' + p.id, p.id, 'partner.note', b).then(function (y) { if (y) { log(p, 'Note: ' + f.text); refresh(); } });
    });
  }

  K.def('A24', { init: render, update: function (ctx, s) {
    var ses = s.session.admin, dc = UI.q('#mock .dc');
    if (dc && dc.getAttribute('data-ops') !== ses.status + ses.role) render();
  } });
  RN.opsPartners = { state: M, render: render };
})();
