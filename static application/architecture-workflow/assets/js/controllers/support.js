/* RideNova Support portal – screen controllers (behaviour of the screens of this application only).
   Each def('ID', {...}) adds behaviour to one screen: init on entry, update on every state change, tick every 400 ms,
   actions.name for data-do="x.name" controls. Uses the helpers in kit.js. DOM APIs and textContent only. */
(function () {
  'use strict';
  var RN = window.RN, UI = RN.ui, D = RN.data, K = RN.kit, S = RN.screens;
  var el = UI.el, q = UI.q, qa = UI.qa;
  var exec = K.exec, text = K.text, find = K.find, hide = K.hide, secsLeft = K.secsLeft, follow = K.follow, setTag = K.setTag, rideFinal = K.rideFinal, loadScenarioButton = K.loadScenarioButton, navButton = K.navButton, def = K.def, ctl = K.ctl, COMMON = K.COMMON, rupees = K.rupees, extend = K.extend, ago = K.ago, clock = K.clock, label = K.label, tagKind = K.tagKind, tbodyOf = K.tbodyOf, tdCell = K.tdCell, stSpan = K.stSpan, rowsSig = K.rowsSig, fillTable = K.fillTable, bubbles = K.bubbles, liveRideRows = K.liveRideRows, prependLive = K.prependLive;

  // ================================================================== support portal – user side
  function who() { return UI.mem.userType || 'rider'; }
  var USER_LABEL = { rider: 'Customer', driver: 'Driver', partner: 'Partner' };
  function sexec(cmd, payload, n, opts) { return exec(cmd, payload, n, Object.assign({ actor: who() }, opts || {})); }
  function catOf(key) { return D.SUPPORT_CATEGORIES.filter(function (c) { return c.key === key; })[0] || D.SUPPORT_CATEGORIES[3]; }
  function setTitle(t) { var n = q('#mock .ab .t'); if (n) n.textContent = t; }

  def('S01', {
    init: function () { var cur = who(); qa('#mock [data-do="x.userType"]').forEach(function (o) { var on = o.getAttribute('data-arg') === cur; o.classList.toggle('on', on); o.setAttribute('aria-pressed', String(on)); }); },
    actions: { userType: function (n, kind) { UI.mem.userType = kind; } }
  });
  function renderCategories(query) {
    var box = q('#mock [data-list="categories"]'); if (!box) return;
    box.setAttribute('data-empty', 'No articles match. Try another word or raise a ticket.');
    var qy = String(query || '').trim().toLowerCase();
    if (!qy) UI.list(box, D.SUPPORT_CATEGORIES.map(function (c) { return { title: c.title, sub: c.issues.slice(0, 2).join(' · '), do: 'x.category', arg: c.key, tone: c.key === 'safety' ? 'red' : '' }; }));
    else UI.list(box, D.HELP_ARTICLES.filter(function (a) { return (a.title + ' ' + a.body).toLowerCase().indexOf(qy) >= 0; })
      .map(function (a) { return { title: a.title, sub: catOf(a.cat).title, do: 'x.openArticle', arg: a.id }; }));
  }
  function openArticle(n, id) { UI.mem.article = id; UI.go('S04'); }
  def('S02', {
    init: function () { var chip = find('.chip', ''); var c = q('#mock .ab .chip'); if (c) c.textContent = USER_LABEL[who()]; var f = UI.field('q'); renderCategories(f ? f.value : ''); },
    input: function (ctx, n) { if (n.name === 'q') renderCategories(n.value); },
    actions: { category: function (n, key) { UI.mem.category = key; UI.go('S03'); }, openArticle: openArticle,
      newTicket: function () { UI.mem.issue = null; UI.mem.category = UI.mem.category || 'booking'; UI.go('S05'); } }
  });
  def('S03', {
    init: function () {
      var c = catOf(UI.mem.category || 'payments'); setTitle(c.title);
      UI.list(q('#mock [data-list="issues"]'), c.issues.map(function (i) { return { title: i, do: 'x.pickIssue', arg: i, tone: c.key === 'safety' ? 'red' : '' }; }));
      var arts = D.HELP_ARTICLES.filter(function (a) { return a.cat === c.key; });
      var ab = q('#mock [data-list="articles"]'); ab.setAttribute('data-empty', 'No articles for this topic yet.');
      UI.list(ab, arts.map(function (a) { return { title: a.title, do: 'x.openArticle', arg: a.id }; }));
      if (c.key === 'safety') UI.state('In danger? Call 112 now.', ['The prototype does not place calls.'], null, 'err'); else UI.state(null);
    },
    actions: { pickIssue: function (n, issue) { UI.mem.issue = issue; UI.go('S05'); }, openArticle: openArticle,
      newTicket: function () { UI.mem.issue = null; UI.go('S05'); } }
  });
  def('S04', {
    init: function () {
      var a = D.HELP_ARTICLES.filter(function (x) { return x.id === UI.mem.article; })[0] || D.HELP_ARTICLES[0];
      UI.mem.category = a.cat;
      text(q('#mock .h2'), a.title); text(q('#mock .body > .sub'), a.body);
    },
    actions: { articleFeedback: function (n, v) { UI.toast(v === 'yes' ? 'Thanks for the feedback.' : 'Sorry it did not help. You can raise a ticket below.', 'info'); },
      newTicket: function () { UI.mem.issue = null; UI.go('S05'); } }
  });
  var recordType = 'Rides';
  function records(s) {
    var out = [];
    if (recordType === 'Rides') {
      s.rideOrder.slice().reverse().forEach(function (id) { var r = s.rides[id]; out.push({ title: r.drop, sub: r.id + ' · ' + label(r.state) + ' · this session', arg: r.id }); });
      out.push({ title: 'Banjara Hills → Hitec City', sub: 'RN-20260927-00125 · sample · ₹248', arg: 'RN-20260927-00125' }, { title: 'Home → Work', sub: 'RN-20260924-00031 · sample · ₹212', arg: 'RN-20260924-00031' });
    } else if (recordType === 'Orders') {
      s.orderOrder.slice().reverse().forEach(function (id) { var o = s.orders[id]; out.push({ title: o.restaurant, sub: 'Order #' + o.id + ' · ' + label(o.state) + ' · this session', arg: 'Order #' + o.id }); });
      out.push({ title: 'Biryani House', sub: 'Order #4412 · sample · ₹380', arg: 'Order #4412' });
    } else {
      s.rideOrder.slice().reverse().forEach(function (id) { var r = s.rides[id]; if (r.payment.attempts) out.push({ title: r.payment.method + ' payment', sub: rupees(r.finalPaise) + ' · ' + label(r.payment.state) + ' · ' + r.id, arg: 'Payment for ' + r.id }); });
      out.push({ title: 'UPI payment', sub: '₹248 · sample · ananya@okbank', arg: 'Payment ₹248 UPI' });
    }
    out.push({ title: 'None of these', sub: 'A general question', arg: '' });
    return out;
  }
  def('S05', {
    init: function () { UI.mem.ref = undefined; S.S05.update(UI.ctx, UI.engine.state); },
    update: function (ctx, s) {
      var box = q('#mock [data-list="records"]'); var rows = records(s);
      var sig = rowsSig([recordType, rows.length]); if (box.getAttribute('data-sig') === sig) return; box.setAttribute('data-sig', sig);
      UI.list(box, rows.map(function (r) { return { title: r.title, sub: r.sub, do: 'x.pickRecord', arg: r.arg || 'none', ui: 'pick', on: UI.mem.ref === (r.arg || 'none') }; }));
    },
    actions: {
      recordType: function (n) { recordType = n.textContent.trim(); S.S05.update(UI.ctx, UI.engine.state); },
      pickRecord: function (n, arg) { UI.mem.ref = arg; },
      recordContinue: function () { if (UI.mem.ref === undefined) { UI.toast('Choose a trip, order or payment, or "None of these".', 'error'); return { ok: false }; } UI.go('S06'); }
    }
  });
  var PRIORITY = { Urgent: 'P1', High: 'P2', Normal: 'P3' };
  def('S06', {
    init: function () {
      var c = catOf(UI.mem.category || 'booking');
      UI.options('category', D.SUPPORT_CATEGORIES.map(function (x) { return [x.key, x.title]; }), c.key);
      UI.options('issue', c.issues, UI.mem.issue || c.issues[0]);
      var ref = UI.field('ref'); if (ref) ref.value = UI.mem.ref && UI.mem.ref !== 'none' ? UI.mem.ref : 'None';
      var d = UI.field('description'); if (d) d.value = '';
      UI.mem.attachment = null; var up = q('#mock .upload .tx b'); if (up) up.textContent = 'Add a screenshot';
    },
    actions: {
      categoryChanged: function (n, key) { UI.options('issue', catOf(key).issues); },
      attach: function () { UI.mem.attachment = 'screenshot-' + String(Date.now()).slice(-4) + '.png'; var up = q('#mock .upload .tx b'); if (up) up.textContent = UI.mem.attachment + ' attached (synthetic)'; UI.toast('A synthetic file name was attached. No file is read or sent.', 'sim'); },
      submitTicket: function (n) {
        UI.clearErrors();
        var p = q('#mock .chip.on'); var pr = PRIORITY[p ? p.textContent.trim() : 'Normal'] || 'P3';
        return sexec('ticket.create', { category: UI.val('category'), issue: UI.val('issue'), ref: UI.mem.ref && UI.mem.ref !== 'none' ? UI.mem.ref : null,
          priority: pr, description: UI.val('description'), attachment: UI.mem.attachment }, n).then(function (r) {
          if (r.ok) { UI.mem.ticketId = r.ticketId; UI.toast('Ticket #' + r.ticketId + ' created (simulated).', 'info'); UI.go('S08'); }
          return r;
        });
      }
    }
  });
  var ticketFilter = 'Open';
  def('S07', {
    update: function (ctx, s) {
      var box = q('#mock [data-list="tickets"]'); box.setAttribute('data-empty', 'No tickets here. Raise one if you need help.');
      var mine = s.support.ticketOrder.map(function (id) { return s.support.tickets[id]; }).filter(function (t) { return t.by === who(); })
        .filter(function (t) { return ticketFilter === 'All' || (ticketFilter === 'Resolved' ? ['RESOLVED', 'CLOSED'].indexOf(t.state) >= 0 : ['RESOLVED', 'CLOSED'].indexOf(t.state) < 0); }).reverse();
      var sig = rowsSig([ticketFilter, who(), mine.map(function (t) { return t.id + t.state; })]); if (box.getAttribute('data-sig') === sig) return; box.setAttribute('data-sig', sig);
      UI.list(box, mine.map(function (t) { return { title: '#' + t.id + ' · ' + t.issue, sub: label(t.state) + ' · ' + ago(t.openedAt), right: t.state === 'WAITING_ON_USER' ? 'Reply' : label(t.state), rightKind: tagKind(t.state), do: 'x.openTicket', arg: t.id }; }));
    },
    actions: { ticketFilter: function (n) { ticketFilter = n.textContent.trim(); S.S07.update(UI.ctx, UI.engine.state); },
      openTicket: function (n, id) { UI.mem.ticketId = id; UI.go('S08'); }, newTicket: function () { UI.mem.issue = null; UI.go('S05'); } }
  });
  function currentTicket(s) {
    var t = s.support.tickets[UI.mem.ticketId];
    if (!t) { var mine = s.support.ticketOrder.filter(function (id) { return s.support.tickets[id].by === who(); }); t = s.support.tickets[mine[mine.length - 1]]; }
    return t || null;
  }
  def('S08', {
    update: function (ctx, s) {
      var t = currentTicket(s);
      if (!t) { UI.state('No ticket selected', ['Raise a ticket or open one from My tickets.'], [navButton('My tickets', 'S07', true)]); return; }
      UI.mem.ticketId = t.id; UI.state(null);
      setTitle('#' + t.id + ' · ' + t.issue);
      var head = q('#mock .body > div'); var tg = head && q('.tag', head), info = head && q('.xs', head);
      if (tg) { tg.textContent = label(t.state); tg.className = 'tag ' + tagKind(t.state); }
      if (info) info.textContent = (t.assignee ? 'Assigned to ' + t.assignee : 'Waiting for an agent') + ' · priority ' + t.priority + (t.ref ? ' · ' + t.ref : '');
      bubbles(q('#mock [data-list="messages"]'), t.messages, null);
      var closeBtn = q('#mock [data-do="x.ticketCloseToggle"]'); if (closeBtn) closeBtn.textContent = ['RESOLVED', 'CLOSED'].indexOf(t.state) >= 0 ? 'Reopen ticket' : 'Close ticket';
      var rate = q('#mock [data-do="x.rateGo"]'); if (rate) rate.disabled = !(['RESOLVED', 'CLOSED'].indexOf(t.state) >= 0 && !t.feedback);
      var send = q('#mock [data-do="x.ticketSend"]'); if (send) send.disabled = t.state === 'CLOSED';
    },
    actions: {
      ticketSend: function (n) {
        UI.clearErrors(); var t = currentTicket(UI.engine.state); if (!t) return;
        return sexec('ticket.message', { id: t.id, text: UI.val('message') }, n).then(function (r) { if (r.ok) UI.field('message').value = ''; return r; });
      },
      ticketAttach: function (n) { var t = currentTicket(UI.engine.state); if (!t) return; var name = 'photo-' + String(Date.now()).slice(-4) + '.jpg';
        return sexec('ticket.message', { id: t.id, text: 'Attached a file (synthetic)', attachment: name }, n); },
      ticketCloseToggle: function (n) {
        var t = currentTicket(UI.engine.state); if (!t) return;
        if (['RESOLVED', 'CLOSED'].indexOf(t.state) >= 0) return UI.prompt('Why are you reopening ticket #' + t.id + '?', 'Reason', '').then(function (reason) { if (reason == null) return { ok: false }; return sexec('ticket.reopen', { id: t.id, reason: reason }, n); });
        return UI.confirm('Close ticket #' + t.id + '? You can reopen it later.', 'Close ticket').then(function (y) { if (!y) return { ok: false }; return sexec('ticket.close', { id: t.id }, n); });
      },
      rateGo: function () { var t = currentTicket(UI.engine.state); if (!t || ['RESOLVED', 'CLOSED'].indexOf(t.state) < 0) { UI.toast('You can rate support once the ticket is resolved.', 'error'); return { ok: false }; } UI.go('S11'); }
    }
  });
  function myChat(s) { var ids = s.support.chatOrder.filter(function (id) { return s.support.chats[id].by === who(); }); return s.support.chats[ids[ids.length - 1]] || null; }
  def('S09', {
    init: function (ctx) {
      var c = myChat(ctx.engine.state);
      if (!c) sexec('chat.start', { topic: UI.mem.issue || 'General question', ref: UI.mem.ref && UI.mem.ref !== 'none' ? UI.mem.ref : null }, null, { instant: true });
    },
    update: function (ctx, s) {
      var c = myChat(s), banner = q('#mock .banner'), log = q('#mock [data-list="chat"]');
      if (!c) return;
      var line = { QUEUED: 'In the queue · an agent joins shortly (simulated)', ACTIVE: 'Chatting with ' + c.agent + ' (simulated agent)', ENDED: 'Chat ended', UNAVAILABLE: 'No agents available' }[c.state];
      if (banner) { var tn = Array.prototype.slice.call(banner.childNodes).filter(function (x) { return x.nodeType === 3; })[0]; if (tn) tn.textContent = line; else banner.appendChild(document.createTextNode(line)); }
      bubbles(log, c.messages, c.typing ? c.agent : null);
      if (c.state === 'UNAVAILABLE') UI.state('No agents available right now', ['Leave a ticket and we reply by message.'], [{ label: 'Raise a ticket', primary: true, onClick: function () { UI.go('S05'); } }, { label: 'Try chat again', onClick: function (b) { sexec('chat.start', { topic: c.topic }, b); } }], 'warn');
      else if (c.state === 'ENDED') UI.state('Chat ended', [c.ticketId ? 'Ticket #' + c.ticketId + ' was created from this chat.' : 'The transcript stays in this demo session only.'], [{ label: 'Start a new chat', primary: true, onClick: function (b) { sexec('chat.start', { topic: c.topic }, b); } }], 'info');
      else UI.state(null);
      ['x.chatSend', 'x.chatEnd', 'x.chatEscalate'].forEach(function (a) { var b = q('#mock [data-do="' + a + '"]'); if (b) b.disabled = ['ENDED', 'UNAVAILABLE'].indexOf(c.state) >= 0 && a !== 'x.chatEscalate'; });
    },
    actions: {
      chatSend: function (n) { UI.clearErrors(); var c = myChat(UI.engine.state); if (!c) return;
        return sexec('chat.send', { id: c.id, text: UI.val('message') }, n, { instant: true }).then(function (r) { if (r.ok) UI.field('message').value = ''; return r; }); },
      chatEnd: function (n) { var c = myChat(UI.engine.state); if (!c) return;
        return UI.confirm('End this chat?', 'End chat').then(function (y) { if (!y) return { ok: false }; return sexec('chat.end', { id: c.id }, n); }); },
      chatEscalate: function (n) { var c = myChat(UI.engine.state); if (!c) return;
        return sexec('chat.escalate', { id: c.id, category: UI.mem.category || 'booking' }, n).then(function (r) { if (r.ok) { UI.mem.ticketId = r.ticketId; UI.toast('Ticket #' + r.ticketId + ' created from the chat.', 'info'); UI.go('S08'); } return { ok: false }; }); }
    }
  });
  function myCall(s) { var ids = s.support.callOrder.filter(function (id) { return s.support.calls[id].by === who(); }); return s.support.calls[ids[ids.length - 1]] || null; }
  function dur(c) { var t = Math.max(0, Math.round(((c.endedAt || Date.now()) - c.connectedAt) / 1000)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
  function callCard(c) {
    var card = q('#mock [data-list="call"]'); if (!card) return;
    var b = q('b', card), sub = q('.xs', card);
    var map = { QUEUED: ['You are number ' + c.position + ' in the queue', 'An agent calls you back from a masked number.'], RINGING: ['Support is calling you…', 'Answer to talk to an agent (simulated).'],
      CONNECTED: ['Connected · ' + dur(c), 'Talking to ' + (c.agent || 'an agent') + ' (simulated, no audio).'], ENDED: ['Call ended · ' + dur(c), 'Summary: ' + c.issue + '.'],
      BUSY: ['All agents are busy', 'Try again later or leave a ticket.'], MISSED: ['Missed call', 'We could not reach you.'], FAILED: ['The call could not be placed', 'Simulated network failure.'], CANCELLED: ['Call-back cancelled', ''] }[c.state];
    if (b) b.textContent = map[0]; if (sub) sub.textContent = map[1];
  }
  def('S10', {
    init: function () { var opts = []; D.SUPPORT_CATEGORIES.forEach(function (c) { opts.push(c.title); }); UI.options('issue', opts, UI.mem.category ? catOf(UI.mem.category).title : opts[3]); },
    update: function (ctx, s) {
      var c = myCall(s), req = q('#mock [data-do="x.callRequest"]');
      if (!c || ['ENDED', 'BUSY', 'MISSED', 'FAILED', 'CANCELLED'].indexOf(c.state) >= 0) { if (req) req.disabled = false; }
      else if (req) req.disabled = true;
      if (!c) { UI.state(null); return; }
      callCard(c);
      var id = c.id, btn = function (lbl, cmd, primary, after) { return { label: lbl, primary: primary, onClick: function (b) { sexec(cmd, { id: id }, b).then(function (r) { if (r.ok && after) after(r); }); } }; };
      var toTicket = btn('Turn into a ticket', 'call.escalate', false, function (r) { UI.mem.ticketId = r.ticketId; UI.go('S08'); });
      var panels = {
        QUEUED: ['Call-back requested · ' + id, ['Simulated queue. No phone call is made.'], [btn('Cancel request', 'call.cancel')], 'info'],
        RINGING: ['Incoming call from RideNova support', ['Simulated ringing. No microphone is used.'], [btn('Answer', 'call.answer', true), btn('Decline', 'call.decline')], 'warn'],
        CONNECTED: ['Connected', ['Call time ' + dur(c) + ' (browser timer)'], [btn('Hang up', 'call.hangUp', true)], 'ok'],
        ENDED: ['Call ended', ['Duration ' + dur(c) + ' · ' + c.issue], c.ticketId ? [] : [toTicket], 'info'],
        BUSY: ['All agents are busy', ['Try again in a few minutes or leave a ticket.'], [toTicket], 'warn'],
        MISSED: ['Missed call', ['You did not answer. Request another call-back when you are ready.'], [toTicket], 'warn'],
        FAILED: ['Call failed', ['The simulated call could not be placed.'], [toTicket], 'err'],
        CANCELLED: ['Call-back cancelled', [], [], 'info']
      }[c.state];
      var cur = q('#mock .rn-state b');
      if (c.state === 'CONNECTED' && cur && cur.textContent === 'Connected') { var p = q('#mock .rn-state span'); if (p) p.textContent = 'Call time ' + dur(c) + ' (browser timer)'; return; }
      UI.state(panels[0], panels[1], panels[2], panels[3]);
    },
    tick: function (ctx, s) { var c = myCall(s); if (c && c.state === 'CONNECTED') { callCard(c); var p = q('#mock .rn-state span'); if (p) p.textContent = 'Call time ' + dur(c) + ' (browser timer)'; } },
    actions: { callRequest: function (n) {
      UI.clearErrors();
      return UI.confirm('Request a call-back about "' + UI.val('issue') + '"? (Simulated – nobody will call you.)', 'Request call-back').then(function (y) {
        if (!y) return { ok: false };
        return sexec('call.request', { issue: UI.val('issue') }, n);
      });
    } }
  });
  var csat = 4;
  def('S11', {
    init: function () {
      var box = q('#mock .stars'); if (!box || box.getAttribute('role')) return;
      box.setAttribute('role', 'radiogroup'); box.setAttribute('aria-label', 'Rating');
      Array.prototype.slice.call(box.children).forEach(function (st, i) {
        st.setAttribute('role', 'radio'); st.setAttribute('tabindex', '0'); st.setAttribute('aria-label', (i + 1) + ' star' + (i ? 's' : ''));
        var choose = function () { csat = i + 1; Array.prototype.slice.call(box.children).forEach(function (o, j) { o.classList.toggle('rn-star-off', j > i); o.setAttribute('aria-checked', String(j === i)); }); };
        st.addEventListener('click', choose); st.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      });
    },
    update: function (ctx, s) { var t = currentTicket(s); var sub = q('#mock .center .sub'); if (t && sub) sub.textContent = 'Ticket #' + t.id + ' · ' + t.issue; },
    actions: { ticketFeedback: function (n) {
      var t = currentTicket(UI.engine.state); if (!t) return;
      var tags = qa('#mock .chip.on').map(function (c) { return c.textContent.trim(); });
      return sexec('ticket.feedback', { id: t.id, score: csat, comment: [UI.val('comment')].concat(tags).filter(Boolean).join(' · ') }, n).then(function (r) { if (r.ok) { UI.toast('Thank you for rating our support.', 'info'); UI.go('S07'); } return { ok: false }; });
    } }
  });

  // ================================================================== support portal – agent console
  function aexec(cmd, payload, n, opts) { return exec(cmd, payload, n, Object.assign({ actor: 'agent' }, opts || {})); }
  function slaText(t) { if (['RESOLVED', 'CLOSED'].indexOf(t.state) >= 0) return ['Met', 'ok']; var m = Math.round((t.slaDue - Date.now()) / 60000); return m < 0 ? ['Past SLA', 'err'] : m < 120 ? [m + ' min left', 'warn'] : [Math.round(m / 60) + ' h left', 'ok']; }
  function agentName() { return UI.engine.state.support.agent.name; }
  def('S20', {
    init: function (ctx) {
      UI.options('agent', D.AGENTS, ctx.engine.state.support.agent.name);
      if (ctx.engine.state.support.agent.signedIn) UI.state('Signed in as ' + agentName(), ['Simulated session.'], [navButton('Open the queue', 'S21', true), { label: 'Sign out', onClick: function (b) { aexec('agent.signOut', {}, b); } }], 'info');
      else { UI.state(null); UI.toast('Demo agent code: ' + D.DEMO_CODES.agentCode + ' (simulated sign-in).', 'info'); }
    },
    update: function (ctx, s) { if (!s.support.agent.signedIn) UI.state(null); },
    actions: { agentSignIn: function (n) {
      UI.clearErrors();
      return aexec('agent.signIn', { name: UI.val('agent'), code: UI.val('code') }, n).then(function (r) { if (r.ok) UI.go('S21'); return r; });
    } }
  });
  function kpiSet(title, value) { var k = qa('#mock .kpi').filter(function (x) { return q('.l', x).textContent.indexOf(title) === 0; })[0]; if (k) text(q('.v', k), String(value)); }
  def('S21', {
    update: function (ctx, s) {
      var sup = s.support, me = sup.agent.name;
      qa('#mock [data-do="x.agentStatus"]').forEach(function (c) { var on = c.getAttribute('data-arg') === sup.agent.status; c.classList.toggle('ok', on); c.setAttribute('aria-pressed', String(on)); });
      var chats = sup.chatOrder.map(function (id) { return sup.chats[id]; }).filter(function (c) { return c.state === 'QUEUED'; });
      var calls = sup.callOrder.map(function (id) { return sup.calls[id]; }).filter(function (c) { return ['QUEUED', 'RINGING'].indexOf(c.state) >= 0; });
      var cases = sup.ticketOrder.map(function (id) { return sup.tickets[id]; }).filter(function (t) { return t.state !== 'CLOSED' && (t.assignee === me || !t.assignee); });
      kpiSet('Chats waiting', chats.length); kpiSet('Call-backs waiting', calls.length); kpiSet('My open cases', cases.filter(function (t) { return t.assignee === me; }).length);
      kpiSet('Past SLA', cases.filter(function (t) { return slaText(t)[0] === 'Past SLA'; }).length);
      var inc = chats.map(function (c) {
        var b = el('button', { type: 'button', class: 'dbtn', 'data-do': 'x.acceptChat', 'data-arg': c.id }, 'Accept');
        return { cells: ['Chat', c.user, c.topic, ago(c.startedAt), b] };
      }).concat(calls.map(function (c) { return { cells: ['Call-back', c.user, c.issue, ago(c.requestedAt), stSpan(label(c.state), 'info')] }; }));
      if (!inc.length) inc = [{ cells: ['—', 'Nobody waiting', '', '', ''] }];
      fillTable(tbodyOf('Incoming'), inc, inc.map(function (r) { return r.cells.slice(0, 4); }));
      var rows = cases.map(function (t) { var sl = slaText(t); return { do: 'x.openCase', arg: t.id, cells: ['#' + t.id, t.user, t.issue, t.priority, stSpan(sl[0], sl[1]), label(t.state)] }; });
      fillTable(tbodyOf('My cases'), rows, cases.map(function (t) { return t.id + t.state + t.priority + t.assignee + slaText(t)[0]; }));
    },
    actions: {
      agentStatus: function (n, st) { return aexec('agent.status', { status: st }, n, { instant: true }); },
      acceptChat: function (n, id) {
        var chat = id || (UI.engine.state.support.chatOrder.filter(function (x) { return UI.engine.state.support.chats[x].state === 'QUEUED'; })[0]);
        if (!chat) { UI.toast('No chat is waiting.', 'info'); return { ok: false }; }
        if (UI.engine.state.support.agent.status !== 'AVAILABLE') { UI.toast('Set yourself Available to accept chats.', 'error'); return { ok: false }; }
        return aexec('chat.accept', { id: chat }, n).then(function (r) { if (r.ok) { UI.mem.chatId = chat; UI.go('S24'); } return r; });
      },
      openCase: function (n, id) { UI.mem.caseId = id; UI.go('S22'); }
    }
  });
  var RESOLUTIONS = ['Information given', 'Refund issued', 'Fare adjusted', 'Lost item returned', 'Driver or rider coached', 'Escalated to safety team', 'Duplicate', 'Could not reproduce'];
  function currentCase(s) { var t = s.support.tickets[UI.mem.caseId]; if (!t) { var open = s.support.ticketOrder.filter(function (id) { return s.support.tickets[id].state !== 'CLOSED'; }); t = s.support.tickets[open[open.length - 1]]; } return t; }
  function setField(lab, value) { var f = qa('#mock .dfield').filter(function (x) { return q('label', x).textContent.indexOf(lab) === 0; })[0]; var b = f && q('.box', f); if (b && !q('input,select,textarea', b)) text(b, value); }
  def('S22', {
    init: function (ctx) {
      UI.options('reassign', [['', 'Reassign to…']].concat(D.AGENTS.map(function (a) { return [a, a]; })), '');
      UI.options('priority', [['P1', 'P1 · urgent'], ['P2', 'P2 · high'], ['P3', 'P3 · normal']]);
      UI.options('rescat', [['', 'Choose a category']].concat(RESOLUTIONS.map(function (r) { return [r, r]; })), '');
    },
    update: function (ctx, s) {
      var t = currentCase(s); if (!t) { UI.state('No case selected', ['Open a case from the queue or All tickets.'], [navButton('All tickets', 'S23', true)]); return; }
      UI.mem.caseId = t.id;
      var dc = q('#mock .dc'); if (dc) dc.classList.toggle('rn-case-closed', t.state === 'CLOSED');
      var cards = qa('#mock .dcard');
      var titles = cards.map(function (c) { return q('.hd b', c); });
      if (titles[1]) text(titles[1], '#' + t.id + ' · ' + t.issue + ' · ' + label(t.state) + ' · ' + t.priority);
      setField('Name', t.user + ' · ' + ({ rider: 'customer', driver: 'driver', partner: 'partner' }[t.by] || t.by));
      setField('Phone', t.by === 'partner' ? 'orders@biryanihouse.example (masked)' : '+91 9••• ••' + String(t.id).slice(-3) + ' (masked)');
      setField('Reference', t.ref || 'No linked trip or order');
      setField('Previous tickets', (s.support.ticketOrder.filter(function (id) { return s.support.tickets[id].user === t.user; }).length - 1) + ' other ticket(s) in this demo');
      var conv = cards[1] && q('div', cards[1].children[1] ? cards[1] : cards[1]);
      var log = cards[1] && cards[1].querySelector(':scope > div:nth-of-type(2)');
      if (log) {
        var sig = rowsSig([t.id, t.messages.length, t.notes.length]);
        if (log.getAttribute('data-sig') !== sig) {
          log.setAttribute('data-sig', sig); UI.clear(log);
          var all = t.messages.map(function (m) { return { at: m.at, who: m.from === 'agent' ? (m.name || 'Agent') : m.from === 'system' ? 'System' : (m.name || t.user), text: m.text + (m.attachment ? ' [' + m.attachment + ']' : ''), note: false }; })
            .concat(t.notes.map(function (n2) { return { at: n2.at, who: 'Internal note · ' + n2.by, text: n2.text, note: true }; })).sort(function (a, b) { return a.at - b.at; });
          all.forEach(function (m) { var d = el('div', { class: m.note ? 'rn-note' : '' }); d.appendChild(el('b', null, m.who + ': ')); d.appendChild(document.createTextNode(m.text)); d.appendChild(el('time', null, ' ' + UI.fmtTime(m.at))); log.appendChild(d); });
          log.scrollTop = log.scrollHeight;
        }
      }
      var tl = q('#mock .dcard .tl');
      if (tl) {
        var hs = rowsSig([t.id, t.history.length]);
        if (tl.getAttribute('data-sig') !== hs) { tl.setAttribute('data-sig', hs); UI.clear(tl);
          t.history.forEach(function (h) { var row = el('div', { class: 'e' }); row.appendChild(el('span', { class: 'tm' }, UI.fmtTime(h.at))); row.appendChild(el('span', { class: 'dt2' })); row.appendChild(el('span', null, (h.from ? label(h.from) + ' → ' : '') + label(h.to) + ' · ' + h.actor)); tl.appendChild(row); });
        }
      }
      var pr = UI.field('priority'); if (pr && document.activeElement !== pr) pr.value = t.priority;
      var closed = t.state === 'CLOSED';
      qa('#mock [data-do^="x.case"]').forEach(function (b) { var act = b.getAttribute('data-do'); b.disabled = closed ? act !== 'x.caseReopen' && act !== 'x.caseNote' : act === 'x.caseReopen' && ['RESOLVED'].indexOf(t.state) < 0; });
      UI.state(null);
    },
    actions: {
      caseReply: function (n) { var t = currentCase(UI.engine.state); UI.clearErrors(); return aexec('ticket.message', { id: t.id, text: UI.val('reply') }, n).then(function (r) { if (r.ok) UI.field('reply').value = ''; return r; }); },
      caseNote: function (n) { var t = currentCase(UI.engine.state); UI.clearErrors(); return aexec('ticket.message', { id: t.id, text: UI.val('reply'), internal: true }, n).then(function (r) { if (r.ok) { UI.field('reply').value = ''; UI.toast('Internal note added (visible only in the agent console).', 'info'); } return r; }); },
      caseWait: function (n) { var t = currentCase(UI.engine.state); UI.clearErrors(); if (!UI.val('reply').trim()) { UI.fieldError('reply', 'Write the question for the customer first.'); return { ok: false }; }
        return aexec('ticket.message', { id: t.id, text: UI.val('reply'), waitForUser: true }, n).then(function (r) { if (r.ok) UI.field('reply').value = ''; return r; }); },
      caseAssign: function (n) { var t = currentCase(UI.engine.state); return aexec('ticket.assign', { id: t.id }, n); },
      caseReassign: function (n, to) { var t = currentCase(UI.engine.state); if (!to) return; return aexec('ticket.assign', { id: t.id, agent: to }, null).then(function (r) { if (r.ok) UI.toast('Reassigned to ' + to + '.', 'info'); n.value = ''; }); },
      casePriority: function (n, p) { var t = currentCase(UI.engine.state); return aexec('ticket.priority', { id: t.id, priority: p }, null, { instant: true }); },
      caseEscalate: function (n) { var t = currentCase(UI.engine.state); return UI.prompt('Escalate ticket #' + t.id + ' – reason', 'Reason', '').then(function (reason) { if (reason == null) return { ok: false }; return aexec('ticket.escalate', { id: t.id, reason: reason }, n); }); },
      caseResolve: function (n) { var t = currentCase(UI.engine.state); UI.clearErrors(); return aexec('ticket.resolve', { id: t.id, category: UI.val('rescat'), notes: UI.val('resnotes') }, n).then(function (r) { if (r.ok) UI.toast('Ticket #' + t.id + ' resolved.', 'info'); else if (r.fields) { if (r.fields.category) UI.fieldError('rescat', r.fields.category); if (r.fields.notes) UI.fieldError('resnotes', r.fields.notes); } return r; }); },
      caseClose: function (n) { var t = currentCase(UI.engine.state); return aexec('ticket.close', { id: t.id }, n); },
      caseReopen: function (n) { var t = currentCase(UI.engine.state); return aexec('ticket.reopen', { id: t.id, reason: 'Reopened by agent' }, n); }
    }
  });
  def('S23', {
    update: function (ctx, s) {
      var sup = s.support, list = sup.ticketOrder.slice().reverse().map(function (id) { return sup.tickets[id]; });
      var rows = list.map(function (t) { var sl = slaText(t);
        return { do: 'x.openCase', arg: t.id, cells: ['#' + t.id, ({ rider: 'Rider', driver: 'Driver', partner: 'Partner' }[t.by] || '') + ' · ' + t.user, (D.SUPPORT_CATEGORIES.filter(function (c) { return c.key === t.category; })[0] || {}).title || t.category, t.issue, t.priority, t.assignee || '—', stSpan(sl[0], sl[1]), label(t.state)] }; });
      fillTable(q('#mock table.dt tbody'), rows, list.map(function (t) { return t.id + t.state + t.priority + t.assignee; }));
    },
    actions: { openCase: function (n, id) { UI.mem.caseId = id; UI.go('S22'); } }
  });
  function currentChat(s) { var c = s.support.chats[UI.mem.chatId]; if (!c) { var ids = s.support.chatOrder; c = s.support.chats[ids[ids.length - 1]]; } return c || null; }
  def('S24', {
    update: function (ctx, s) {
      var sup = s.support, chats = sup.chatOrder.slice().reverse().map(function (id) { return sup.chats[id]; });
      fillTable(tbodyOf('Chats'), chats.length ? chats.map(function (c) { return { do: 'x.pickChat', arg: c.id, cells: [c.id, c.user, c.topic, stSpan(label(c.state), c.state === 'ACTIVE' ? 'ok' : c.state === 'QUEUED' ? 'warn' : '')] }; }) : [{ cells: ['—', 'No chats yet', '', ''] }],
        chats.map(function (c) { return c.id + c.state; }));
      var c = currentChat(s), cards = qa('#mock .dcard');
      if (!c) { UI.state('No live chats', ['Customers start chats from the support portal (S09).'], null, 'info'); return; }
      UI.state(null); UI.mem.chatId = c.id;
      if (cards[1]) text(q('.hd b', cards[1]), c.id + ' · ' + c.user + ' · ' + label(c.state) + (c.agent ? ' · ' + c.agent : ''));
      var log = cards[1] && cards[1].querySelector(':scope > div:nth-of-type(2)');
      if (log) { var sig = rowsSig([c.id, c.messages.length]); if (log.getAttribute('data-sig') !== sig) { log.setAttribute('data-sig', sig); UI.clear(log);
        c.messages.forEach(function (m) { var d = el('div'); d.appendChild(el('b', null, (m.from === 'system' ? 'System' : m.name || m.from) + ': ')); d.appendChild(document.createTextNode(m.text)); d.appendChild(el('time', null, ' ' + UI.fmtTime(m.at))); log.appendChild(d); }); } }
      var mine = c.state === 'ACTIVE' && c.agent === sup.agent.name;
      var bs = { 'x.agentChatSend': !mine, 'x.agentChatAccept': c.state !== 'QUEUED', 'x.agentChatEnd': ['ENDED', 'UNAVAILABLE'].indexOf(c.state) >= 0, 'x.agentChatTicket': !!c.ticketId };
      Object.keys(bs).forEach(function (a) { var b = q('#mock [data-do="' + a + '"]'); if (b) b.disabled = bs[a]; });
    },
    actions: {
      pickChat: function (n, id) { UI.mem.chatId = id; S.S24.update(UI.ctx, UI.engine.state); },
      agentChatSend: function (n) { var c = currentChat(UI.engine.state); UI.clearErrors(); return aexec('chat.send', { id: c.id, text: UI.val('reply') }, n, { instant: true }).then(function (r) { if (r.ok) UI.field('reply').value = ''; return r; }); },
      agentChatAccept: function (n) { var c = currentChat(UI.engine.state); return aexec('chat.accept', { id: c.id }, n); },
      agentChatEnd: function (n) { var c = currentChat(UI.engine.state); return aexec('chat.end', { id: c.id }, n); },
      agentChatTicket: function (n) { var c = currentChat(UI.engine.state); return aexec('chat.escalate', { id: c.id }, n).then(function (r) { if (r.ok) { UI.mem.caseId = r.ticketId; UI.toast('Ticket #' + r.ticketId + ' created from the chat.', 'info'); UI.go('S22'); } return { ok: false }; }); }
    }
  });
})();
