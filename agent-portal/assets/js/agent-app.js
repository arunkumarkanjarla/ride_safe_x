/* RideNova Agent portal – application runtime (hand-written; plain HTML, CSS and JavaScript, no build step).
   One web workspace for support agents who help customers, drivers and partners on every channel:
   phone calls, e-mail, social media (WhatsApp, Facebook, Instagram, X), in-app chat and in-app tickets.

   * Controlled by the admin portal: accounts, roles, channels, user groups, routing, limits, templates, knowledge
     and announcements come from the policy (agent-policy.js, replaced live by agent-sync.js when the admin publishes).
   * Everything is simulated and kept in memory: reloading the page starts again. Nothing is sent anywhere; calls have
     no audio, e-mails and social replies are not delivered, numbers and addresses are masked.
   * Inside the connected demo (same site) it also picks up tickets and chats raised in the customer, driver and
     partner apps, and the agent's replies go back to them.
   * Text is always set with textContent; no HTML is built from strings. */
(function () {
  'use strict';
  var RN = window.RN = window.RN || {};
  var SYNC = RN.agentSync, DATA = window.RN_AGENT_DATA, CFG = window.RN_CONFIG || {};
  if (!SYNC || !DATA || !window.RN_AGENT_POLICY) return;
  var P = SYNC.cleanPolicy(window.RN_AGENT_POLICY, window.RN_AGENT_POLICY);
  var policySource = 'file';
  var BRAND = CFG.brand || 'RideNova';

  var CH_ORDER = ['call', 'email', 'chat', 'app', 'whatsapp', 'facebook', 'instagram', 'x'];
  var SOCIAL = ['whatsapp', 'facebook', 'instagram', 'x'];
  var LIVE = ['chat', 'whatsapp', 'facebook', 'instagram', 'x'];   // count towards the admin's live-conversation limit
  var SHORT = { call: 'Call', email: 'E-mail', chat: 'Chat', app: 'In-app', whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', x: 'X' };
  var AUD = { customer: 'Customer', driver: 'Driver', partner: 'Partner' };
  var STATE_LABEL = { NEW: 'New', OPEN: 'Open', PENDING: 'Waiting on user', ESCALATED: 'Escalated', RESOLVED: 'Resolved', CLOSED: 'Closed' };
  var STATE_KIND = { NEW: 'info', OPEN: 'ok', PENDING: 'warn', ESCALATED: 'err', RESOLVED: '', CLOSED: '' };
  var STATUS_LABEL = { AVAILABLE: 'Available', BREAK: 'On break', TRAINING: 'Training / meeting', AWAY: 'Away', OFFLINE: 'Offline' };
  var PRIORITY = [['P1', 'P1 · urgent'], ['P2', 'P2 · high'], ['P3', 'P3 · normal']];

  // ------------------------------------------------------------------ DOM helpers
  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, a, kids) {
    var n = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function text(n, t) { if (n && n.textContent !== t) n.textContent = t; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function hhmm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function mmss(ms) { var s = Math.max(0, Math.round(ms / 1000)); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function ago(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min ago'; }
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? String(iso || '—') : d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear() + ', ' + hhmm(d); }
  function rnd(list) { return list[Math.floor(Math.random() * list.length)]; }
  function rupees(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function initials(name) { return String(name || '?').split(/\s+/).map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase(); }
  function first(list, fn) { for (var i = 0; i < list.length; i++) if (fn(list[i])) return list[i]; return null; }

  function toast(msg, kind) {
    var box = q('[data-rn="toasts"]'); if (!box || !msg) return;
    var t = h('div', { class: 'rn-toast ' + (kind || 'info'), role: kind === 'error' ? 'alert' : 'status', text: msg });
    box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, kind === 'error' ? 6000 : 4200);
  }
  // modal form: fields [{name, label, type: text|number|select|textarea, options: [[value, label]], value}] → values or null
  function dialog(title, fields, okLabel) {
    return new Promise(function (resolve) {
      var d = h('dialog', { class: 'rn-dialog', 'aria-labelledby': 'ag-dlg-t' });
      d.appendChild(h('p', { id: 'ag-dlg-t', text: title }));
      var inputs = {};
      (fields || []).forEach(function (f) {
        var lab = h('label', { class: 'rn-f block' }, [f.label]), inp;
        if (f.type === 'select') { inp = h('select'); f.options.forEach(function (o) { inp.appendChild(h('option', { value: o[0], text: o[1] })); }); if (f.value != null) inp.value = f.value; }
        else if (f.type === 'textarea') { inp = h('textarea', { rows: '4', maxlength: '2000' }); inp.value = f.value || ''; }
        else { inp = h('input', { type: f.type || 'text', maxlength: '200' }); inp.value = f.value == null ? '' : f.value; }
        inputs[f.name] = inp; lab.appendChild(inp); d.appendChild(lab);
      });
      var row = h('div', { class: 'rn-dialog-row' });
      var no = h('button', { type: 'button', class: 'rn-dbtn', text: 'Cancel' });
      var yes = h('button', { type: 'button', class: 'rn-dbtn primary', text: okLabel || 'OK' });
      row.appendChild(no); row.appendChild(yes); d.appendChild(row); document.body.appendChild(d);
      function done(v) { d.close(); d.remove(); resolve(v); }
      no.addEventListener('click', function () { done(null); });
      yes.addEventListener('click', function () { var v = {}; Object.keys(inputs).forEach(function (k) { v[k] = inputs[k].value; }); done(v); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); done(null); });
      d.showModal(); (q('input,select,textarea', d) || yes).focus();
    });
  }
  function confirmBox(msg, ok) { return dialog(msg, [], ok || 'Yes, continue').then(function (v) { return !!v; }); }

  // small builders in the admin-portal design (base.css: .dcard, .dt, .st, .dbtn, .kpi)
  function btn(label, fn, cls, attrs) {
    var b = h('button', Object.assign({ type: 'button', class: 'dbtn' + (cls ? ' ' + cls : ''), text: label }, attrs || {}));
    b.addEventListener('click', function (e) { e.preventDefault(); if (!b.disabled) fn(b); });
    return b;
  }
  function chip(label, on, fn, extra) { var b = h('button', { type: 'button', class: 'ag-chip' + (on ? ' on' : '') + (extra ? ' ' + extra : ''), 'aria-pressed': String(!!on), text: label }); b.addEventListener('click', fn); return b; }
  function card(title, right, cls) { return h('div', { class: 'dcard' + (cls ? ' ' + cls : '') }, [h('div', { class: 'hd' }, [h('b', { text: title }), h('span', { class: 'sp' }, right || [])])]); }
  function badge(ch) { return h('span', { class: 'ag-ch ' + ch, text: SHORT[ch] || ch }); }
  function st(t, kind) { return h('span', { class: 'st ' + (kind || ''), text: t }); }
  function sel(options, value, label, cls) {
    var s = h('select', { class: 'ag-sel' + (cls ? ' ' + cls : ''), 'aria-label': label || null });
    options.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    if (value != null) s.value = value;
    return s;
  }
  function table(cols) {
    var tr = h('tr'); cols.forEach(function (c) { tr.appendChild(h('th', { text: c })); });
    var t = h('table', { class: 'dt' }, [h('thead', null, [tr]), h('tbody')]);
    t.cols = cols.length; return t;
  }
  // rows: [{key, cells: [text | node | {wrap: value}], open: fn, on: bool}]; rebuilt only when the keys change
  function fill(t, rows, empty) {
    var tb = q('tbody', t), sig = rows.map(function (r) { return r.key; }).join('|');
    if (tb.getAttribute('data-sig') === sig) return;
    tb.setAttribute('data-sig', sig); clear(tb);
    if (!rows.length) { tb.appendChild(h('tr', null, [h('td', { colspan: String(t.cols), class: 'ag-empty', text: empty || 'Nothing here.' })])); return; }
    rows.forEach(function (r) {
      var tr = h('tr', r.open ? { class: 'ag-click' + (r.on ? ' on' : ''), tabindex: '0' } : (r.on ? { class: 'on' } : null));
      r.cells.forEach(function (c) {
        var wrap = c && typeof c === 'object' && !c.nodeType, v = wrap ? c.wrap : c, td = h('td', wrap ? { class: 'ag-wrap' } : null);
        if (v && v.nodeType) td.appendChild(v); else td.textContent = v == null ? '' : String(v);
        tr.appendChild(td);
      });
      if (r.open) {
        tr.addEventListener('click', function (e) { if (!e.target.closest('button,select,input,a')) r.open(); });
        tr.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); r.open(); } });
      }
      tb.appendChild(tr);
    });
  }
  function kpiRow(host, items) {
    // items: [label, value, route, alert]
    var sig = JSON.stringify(items);
    if (host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig); clear(host);
    items.forEach(function (k) {
      var n = h('div', { class: 'kpi' + (k[3] ? ' alert' : ''), role: k[2] ? 'button' : null, tabindex: k[2] ? '0' : null }, [h('span', { class: 'l', text: k[0] }), h('span', { class: 'v', text: String(k[1]) })]);
      if (k[2]) { n.addEventListener('click', function () { go(k[2]); }); n.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(k[2]); }); }
      host.appendChild(n);
    });
  }

  // ------------------------------------------------------------------ state (memory only)
  var S = {
    me: null, status: 'OFFLINE', statusAt: Date.now(),
    convs: {}, order: [], seq: 5100,
    calls: { queue: [], active: null, log: [], callbacks: [], seq: 3100, missed: 0 },
    sel: { case: null, email: null, social: null, chat: null, contact: null },
    ui: { scope: 'mine', ch: 'all', aud: 'all', state: 'active', search: '', folder: 'inbox', social: 'all', chatTab: 'chat', kbTab: 'kb', kbAud: 'all', kbq: '', cq: '', caud: 'all', macro: null },
    stats: { replies: 0, resolved: 0, calls: 0, talkMs: 0, firstOk: 0, firstAll: 0, csat: [], out: 0 },
    peers: {}, adminAt: 0, presenceAt: 0, timers: [], nextIn: 0, route: 'G02', hubSeen: {}, annSeen: P.announcements.length
  };
  function contact(id) { return first(DATA.contacts, function (c) { return c.id === id; }) || { id: id, type: 'customer', name: id, phone: '—', email: '—', city: '—', records: [] }; }
  function agent(id) { return first(P.agents, function (a) { return a.id === id; }); }
  function agentName(id) { var a = agent(id); return a ? a.name : (id || '—'); }
  function chLabel(ch) { return (P.channels[ch] || {}).label || ch; }
  function R() { return (S.me && P.roles[S.me.role]) || P.roles.L1; }
  function chOn(ch) { return !!(P.channels[ch] && P.channels[ch].on); }
  function skill(ch) { return !!S.me && chOn(ch) && S.me.channels.indexOf(ch) >= 0; }
  function audOk(a) { return !!S.me && !!P.audiences[a] && S.me.audiences.indexOf(a) >= 0; }
  function canTake(c) { return skill(c.channel) && audOk(contact(c.contactId).type); }
  function canSee(c) { return !!S.me && (c.assignee === S.me.id || R().team || canTake(c)); }
  function mine(c) { return !!S.me && c.assignee === S.me.id; }
  function isOpen(c) { return c.state !== 'RESOLVED' && c.state !== 'CLOSED'; }
  function all() { return S.order.map(function (id) { return S.convs[id]; }); }
  function visible() { return all().filter(canSee); }
  function waiting(fn) { return visible().filter(function (c) { return c.state === 'NEW' && !c.assignee && canTake(c) && (!fn || fn(c)); }); }
  function myOpen() { return all().filter(function (c) { return mine(c) && isOpen(c); }); }
  function liveLoad() { return myOpen().filter(function (c) { return LIVE.indexOf(c.channel) >= 0 && c.state !== 'PENDING'; }).length; }
  function callsWaiting() { return S.calls.queue.filter(function (x) { return audOk(contact(x.contactId).type); }); }
  function peerFor(ch, aud) {
    var me = S.me ? S.me.id : '';
    var list = P.agents.filter(function (a) { return a.active && a.id !== me && a.channels.indexOf(ch) >= 0 && a.audiences.indexOf(aud) >= 0; });
    return list.length ? rnd(list).id : null;
  }
  function sla(c) {
    if (!isOpen(c)) return ['Done', ''];
    if (c.firstReplyAt) return ['Replied', 'ok'];
    var m = Math.round((c.slaDue - Date.now()) / 60000);
    if (m < 0) return ['Breached ' + (-m < 60 ? -m + ' min' : Math.floor(-m / 60) + ' h'), 'err'];
    return [m < 60 ? m + ' min left' : Math.floor(m / 60) + ' h left', m <= 5 ? 'warn' : 'ok'];
  }
  function breached(c) { return isOpen(c) && !c.firstReplyAt && Date.now() > c.slaDue; }
  function hist(c, t) { c.history.push({ at: Date.now(), text: t, by: S.me ? S.me.name : 'System' }); }
  function later(ms, fn) { S.timers.push({ at: Date.now() + ms, fn: fn }); }

  function newConv(o) {
    S.seq += 1;
    var at = o.at || Date.now(), id = 'CS-' + S.seq, ch = o.channel;
    var c = { id: id, channel: ch, contactId: o.contact, subject: o.subject, category: o.category || 'General', priority: o.priority || 'P3', state: o.state || 'NEW',
      assignee: o.assignee || null, createdAt: at, updatedAt: at, public: !!o.public, sentiment: o.sentiment || 'neutral', ref: o.ref || null,
      msgs: [], history: [], firstReplyAt: null, slaDue: at + ((P.channels[ch] || {}).slaMins || 60) * 60000, escalatedTo: o.escalatedTo || null,
      disposition: o.disposition || null, unread: o.state === 'NEW', hub: null, live: false, hidden: false };
    (o.msgs || []).forEach(function (m, i) {
      var t = Math.min(Date.now(), at + i * 4 * 60000);
      c.msgs.push({ from: m[0], text: m[1], at: t, via: ch, by: m[0] === 'agent' || m[0] === 'note' ? c.assignee : null, public: c.public && m[0] !== 'note' && m[0] !== 'system' });
      if (m[0] === 'agent' && !c.firstReplyAt) c.firstReplyAt = t;
    });
    c.history.push({ at: at, text: 'Created from ' + chLabel(ch), by: 'System' });
    S.convs[id] = c; S.order.push(id);
    return c;
  }
  function seed() {
    var now = Date.now();
    DATA.seed.forEach(function (x) {
      newConv({ channel: x.channel, contact: x.contact, subject: x.subject, category: x.category, priority: x.priority, state: x.state, at: now - x.ago * 60000,
        public: x.public, sentiment: x.sentiment, ref: x.ref, escalatedTo: x.escalatedTo, disposition: x.disposition, msgs: x.msgs,
        assignee: x.mine ? 'SELF' : x.state === 'NEW' ? null : peerFor(x.channel, contact(x.contact).type) || 'AG-104' });
    });
    DATA.callQueue.forEach(function (x) { S.calls.seq += 1; S.calls.queue.push({ id: 'CL-' + S.calls.seq, contactId: x.contact, ivr: x.ivr, since: now - x.ago * 60000 - 20000 }); });
  }

  // ------------------------------------------------------------------ conversation actions
  // persistence: the agent's workspace survives a reload (synthetic data only, this browser only)
  var STORE_KEY = 'ridenova.agent.v1', saveAt = 0;
  function persist() {
    try { var a = S.calls; window.localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, me: S.me ? S.me.id : null, status: S.status, convs: S.convs, order: S.order, seq: S.seq, calls: { queue: a.queue, log: a.log, callbacks: a.callbacks, seq: a.seq, missed: a.missed }, stats: S.stats, ui: S.ui, until: Date.now() + 8 * 3600000 })); } catch (err) { /* storage off: memory only */ }
  }
  function restore() {
    try { var d = JSON.parse(window.localStorage.getItem(STORE_KEY)); if (!d || d.v !== 1 || !d.order) return null; S.convs = d.convs; S.order = d.order; S.seq = d.seq; Object.assign(S.calls, d.calls); S.stats = d.stats; Object.assign(S.ui, d.ui); return d; } catch (err) { return null; }
  }
  function changed() { render(); if (Date.now() - S.presenceAt > 1500) presence(); if (Date.now() - saveAt > 700) { saveAt = Date.now(); persist(); } }
  function take(c, quiet) {
    if (!S.me || mine(c)) return !!S.me;
    if (c.assignee && !R().reassign) { toast(c.id + ' belongs to ' + agentName(c.assignee) + '. Only senior agents and supervisors may take it over.', 'error'); return false; }
    if (!canTake(c) && !R().team) { toast('The admin has not given you this channel or user group.', 'error'); return false; }
    if (LIVE.indexOf(c.channel) >= 0 && liveLoad() >= P.routing.maxChats) { toast('You already hold ' + P.routing.maxChats + ' live conversations (limit set by the admin). Finish one first.', 'error'); return false; }
    var prev = c.assignee;
    c.assignee = S.me.id; if (c.state === 'NEW') c.state = 'OPEN'; c.unread = false; c.updatedAt = Date.now();
    hist(c, prev ? 'Taken over from ' + agentName(prev) : 'Assigned to ' + S.me.name);
    if (!quiet) toast(c.id + ' is now assigned to you.', 'info');
    changed(); return true;
  }
  function viasFor(c) {
    // channels an agent may answer this conversation on: the original one (not for calls) plus e-mail, WhatsApp and in-app
    var type = contact(c.contactId).type, list = [];
    if (c.channel !== 'call') list.push(c.channel);
    ['email', 'whatsapp', 'app'].forEach(function (x) { if (list.indexOf(x) < 0 && !(x === 'whatsapp' && type === 'partner')) list.push(x); });
    return list;
  }
  function sendReply(c, body, via, opts) {
    opts = opts || {};
    body = String(body || '').trim();
    if (body.length < 2) { toast('Write a reply first.', 'error'); return false; }
    if (!chOn(via)) { toast(chLabel(via) + ' is switched off by the admin. Reply on another channel.', 'error'); return false; }
    if (S.me.channels.indexOf(via) < 0 && !R().team) { toast('The admin has not given you the ' + chLabel(via) + ' channel.', 'error'); return false; }
    if (opts.public && !R().publicReply) { toast('Your role (' + R().label + ') may not reply in public. Move the conversation to a private message.', 'error'); return false; }
    if (!mine(c) && !take(c, true)) return false;
    var now = Date.now();
    c.msgs.push({ from: 'agent', by: S.me.id, text: body.slice(0, 2000), at: now, via: via, public: !!opts.public });
    if (!c.firstReplyAt) { c.firstReplyAt = now; S.stats.firstAll++; if (now <= c.slaDue) S.stats.firstOk++; }
    S.stats.replies++;
    if (c.state !== 'ESCALATED') c.state = opts.pending ? 'PENDING' : 'OPEN';
    c.updatedAt = now; c.unread = false;
    hist(c, (opts.public ? 'Public reply' : 'Reply') + ' sent by ' + chLabel(via) + (opts.pending ? ' · waiting on user' : ''));
    hubReply(c, body);
    contactMayReply(c, via);
    changed(); return true;
  }
  function contactMayReply(c, via) {
    if (c.hub) return;   // a real person in the connected demo answers in their own app
    var p = { chat: [1, 5], whatsapp: [0.7, 9], facebook: [0.6, 12], instagram: [0.6, 12], x: [0.5, 12], email: [0.4, 18], app: [0.4, 18] }[via];
    if (!p || Math.random() > p[0]) return;
    later(p[1] * 1000 + Math.random() * 4000, function () {
      if (!isOpen(c)) return;
      c.msgs.push({ from: 'contact', text: rnd(DATA.replies), at: Date.now(), via: via, public: c.public });
      if (c.state === 'PENDING') { c.state = 'OPEN'; hist(c, 'Contact replied – back to open'); }
      c.unread = true; c.updatedAt = Date.now();
      if (mine(c)) toast(contact(c.contactId).name + ' replied on ' + SHORT[via] + ' (' + c.id + ').', 'info');
      changed();
    });
  }
  function addNote(c, body) {
    body = String(body || '').trim();
    if (body.length < 2) { toast('Write the note first.', 'error'); return false; }
    c.msgs.push({ from: 'note', by: S.me.id, text: body.slice(0, 2000), at: Date.now() });
    hist(c, 'Internal note added'); c.updatedAt = Date.now(); changed(); return true;
  }
  function setPriority(c, p) { if (c.priority === p) return; c.priority = p; hist(c, 'Priority set to ' + p); changed(); }
  function reassign(c, to) {
    if (!R().reassign) { toast('Your role (' + R().label + ') may not reassign conversations.', 'error'); return; }
    var a = agent(to); if (!a || !a.active) return;
    if (a.channels.indexOf(c.channel) < 0 && c.channel !== 'call') { toast(a.name + ' does not have the ' + chLabel(c.channel) + ' channel (set by the admin).', 'error'); return; }
    var prev = c.assignee; c.assignee = a.id; if (c.state === 'NEW') c.state = 'OPEN';
    hist(c, 'Reassigned' + (prev ? ' from ' + agentName(prev) : '') + ' to ' + a.name);
    c.msgs.push({ from: 'system', text: 'Reassigned to ' + a.name + ' by ' + S.me.name + '.', at: Date.now() });
    toast(c.id + ' reassigned to ' + a.name + '.', 'info'); changed();
  }
  function escalate(c, team, reason) {
    if (!team) { toast('Choose the team to escalate to.', 'error'); return false; }
    if (String(reason || '').trim().length < 5) { toast('Give a reason for the escalation (at least 5 characters).', 'error'); return false; }
    if (!mine(c) && !take(c, true)) return false;
    c.state = 'ESCALATED'; c.escalatedTo = team; if (team === 'Safety team') c.priority = 'P1';
    c.msgs.push({ from: 'system', text: 'Escalated to ' + team + ' by ' + S.me.name + ': ' + String(reason).trim().slice(0, 300), at: Date.now() });
    hist(c, 'Escalated to ' + team); toast(c.id + ' escalated to ' + team + ' (simulated hand-over).', 'warn'); changed(); return true;
  }
  function credit(c, amount, reason) {
    var n = Math.round(Number(amount));
    if (!isFinite(n) || n <= 0) { toast('Enter a credit amount in rupees.', 'error'); return false; }
    if (String(reason || '').trim().length < 3) { toast('Give a reason for the credit.', 'error'); return false; }
    if (!mine(c) && !take(c, true)) return false;
    var limit = R().refundLimit;
    if (n > limit) {
      escalate(c, 'Finance team', 'Goodwill credit of ' + rupees(n) + ' needs approval (above the ' + rupees(limit) + ' limit the admin set for ' + R().label + '). Reason: ' + reason);
      return true;
    }
    c.msgs.push({ from: 'system', text: 'Goodwill credit of ' + rupees(n) + ' added to the ' + AUD[contact(c.contactId).type].toLowerCase() + '’s wallet (simulated – no money moves). Reason: ' + String(reason).trim().slice(0, 200), at: Date.now() });
    hist(c, 'Goodwill credit ' + rupees(n)); toast('Credit of ' + rupees(n) + ' recorded (simulated).', 'info'); changed(); return true;
  }
  function resolve(c, dispo, notes) {
    if (!dispo) { toast('Choose a resolution (disposition).', 'error'); return false; }
    if (String(notes || '').trim().length < 5) { toast('Add resolution notes (at least 5 characters).', 'error'); return false; }
    if (!mine(c) && !take(c, true)) return false;
    c.state = 'RESOLVED'; c.disposition = dispo; c.updatedAt = Date.now();
    c.msgs.push({ from: 'note', by: S.me.id, text: 'Resolved · ' + dispo + ' · ' + String(notes).trim().slice(0, 500), at: Date.now() });
    hist(c, 'Resolved: ' + dispo); S.stats.resolved++;
    hubResolve(c, dispo, notes);
    later(6000, function () {
      if (c.state !== 'RESOLVED' && c.state !== 'CLOSED') return;
      var score = rnd([3, 4, 4, 5, 5, 5]); S.stats.csat.push(score);
      c.msgs.push({ from: 'system', text: contact(c.contactId).name + ' rated the help ' + score + ' of 5 (simulated survey).', at: Date.now() });
      changed();
    });
    toast(c.id + ' resolved.', 'info'); changed(); return true;
  }
  function closeCase(c) {
    if (!R().close) { toast('Your role may not close conversations.', 'error'); return; }
    if (c.state !== 'RESOLVED') { toast('Resolve the conversation before closing it.', 'error'); return; }
    c.state = 'CLOSED'; hist(c, 'Closed'); changed();
  }
  function reopen(c) { if (isOpen(c)) return; c.state = 'OPEN'; if (!c.assignee) c.assignee = S.me.id; hist(c, 'Reopened'); c.msgs.push({ from: 'system', text: 'Reopened by ' + S.me.name + '.', at: Date.now() }); changed(); }
  function movePrivate(c) {
    if (!c.public) return;
    if (!mine(c) && !take(c, true)) return;
    var m = first(P.macros, function (x) { return x.id === 'M5' && x.on; });
    c.msgs.push({ from: 'agent', by: S.me.id, text: m ? m.text : 'We have sent you a private message.', at: Date.now(), via: c.channel, public: true });
    if (!c.firstReplyAt) { c.firstReplyAt = Date.now(); S.stats.firstAll++; if (Date.now() <= c.slaDue) S.stats.firstOk++; }
    c.public = false;
    c.msgs.push({ from: 'system', text: 'Moved to a private message. Replies from here are not public.', at: Date.now() });
    hist(c, 'Moved to private message'); toast('Public reply posted and conversation moved to a private message (simulated).', 'info'); changed();
  }
  function hideComment(c) {
    if (!c.public || c.hidden) return;
    c.hidden = true; c.msgs.push({ from: 'system', text: 'Comment hidden from public view by ' + S.me.name + ' (simulated).', at: Date.now() });
    hist(c, 'Public comment hidden'); changed();
  }
  function openConv(c) {
    if (!c) return;
    c.unread = false; S.sel.case = c.id;
    if (c.channel === 'email') { S.sel.email = c.id; go('G05'); }
    else if (SOCIAL.indexOf(c.channel) >= 0) { S.sel.social = c.id; go('G06'); }
    else if (c.channel === 'chat' || c.channel === 'app') { S.sel.chat = c.id; S.ui.chatTab = c.channel; go('G07'); }
    else go('G08');
  }
  function nextBest() {
    var list = waiting().sort(function (a, b) { return a.priority.localeCompare(b.priority) || a.slaDue - b.slaDue; });
    if (!list.length) { toast('Nothing is waiting in your channels right now.', 'info'); return; }
    if (take(list[0], true)) { toast('Next conversation: ' + list[0].id + ' · ' + list[0].subject, 'info'); openConv(list[0]); }
  }

  // ------------------------------------------------------------------ calls (simulated: no audio, masked numbers)
  function setStatus(s, quiet) {
    if (!STATUS_LABEL[s]) return;
    S.status = s; S.statusAt = Date.now();
    if (!quiet) toast('Status: ' + STATUS_LABEL[s] + '.', 'info');
    changed();
  }
  function callCase(a) {
    if (a.convId && S.convs[a.convId]) return S.convs[a.convId];
    var ex = first(all(), function (c) { return c.channel === 'call' && c.contactId === a.contactId && isOpen(c); });
    if (ex) { if (!ex.assignee) ex.assignee = S.me.id; if (ex.state === 'NEW') ex.state = 'OPEN'; return ex; }
    return newConv({ channel: 'call', contact: a.contactId, subject: a.subject || a.ivr + ' call', category: a.ivr, priority: a.ivr === 'Safety' ? 'P1' : 'P2', state: 'OPEN', assignee: S.me.id });
  }
  function offerCall() {
    var C = S.calls;
    if (!S.me || C.active || S.status !== 'AVAILABLE' || !skill('call')) return;
    var list = callsWaiting().sort(function (a, b) { return (b.ivr === 'Safety') - (a.ivr === 'Safety') || a.since - b.since; });
    var nx = list[0]; if (!nx) return;
    C.queue.splice(C.queue.indexOf(nx), 1);
    C.active = { id: nx.id, contactId: nx.contactId, ivr: nx.ivr, subject: nx.subject, dir: 'in', state: 'RINGING', since: nx.since, at: Date.now(), ringUntil: Date.now() + P.routing.ringSecs * 1000, muted: false, holdMs: 0 };
    toast('Incoming call · ' + contact(nx.contactId).name + ' · ' + nx.ivr, nx.ivr === 'Safety' ? 'error' : 'warn');
    changed();
  }
  function answer() {
    var a = S.calls.active; if (!a || a.state !== 'RINGING' || a.dir !== 'in') return;
    a.state = 'CONNECTED'; a.connectedAt = Date.now(); S.stats.calls++;
    var c = callCase(a); a.convId = c.id;
    c.msgs.push({ from: 'system', text: 'Inbound call answered by ' + S.me.name + ' · IVR option "' + a.ivr + '" · waited ' + mmss(Date.now() - a.since) + (P.routing.recordCalls ? ' · recorded for quality (simulated)' : ''), at: Date.now(), via: 'call' });
    if (!c.firstReplyAt) { c.firstReplyAt = Date.now(); S.stats.firstAll++; S.stats.firstOk++; }
    hist(c, 'Call answered'); S.sel.case = c.id;
    if (a.ivr === 'Safety') toast('Safety call: follow the safety checklist and escalate to the Safety team at once.', 'error');
    changed();
  }
  function decline(missed) {
    var a = S.calls.active; if (!a || a.state !== 'RINGING') return;
    S.calls.queue.unshift({ id: a.id, contactId: a.contactId, ivr: a.ivr, subject: a.subject, since: a.since });
    S.calls.active = null;
    if (missed) S.calls.missed++;
    S.status = 'AWAY'; S.statusAt = Date.now();
    toast((missed ? 'Missed call' : 'Call declined') + ': it went back to the queue. Your status is now Away – set Available to take calls.', 'warn');
    changed();
  }
  function toggleMute() { var a = S.calls.active; if (!a || ['CONNECTED', 'HOLD'].indexOf(a.state) < 0) return; a.muted = !a.muted; changed(); }
  function toggleHold() {
    var a = S.calls.active; if (!a) return;
    if (a.state === 'CONNECTED') { a.state = 'HOLD'; a.holdAt = Date.now(); }
    else if (a.state === 'HOLD') { a.state = 'CONNECTED'; a.holdMs += Date.now() - a.holdAt; }
    changed();
  }
  function endCall(outcome) {
    var a = S.calls.active; if (!a) return;
    if (a.state === 'HOLD') a.holdMs += Date.now() - a.holdAt;
    a.endedAt = Date.now();
    var talk = a.connectedAt ? a.endedAt - a.connectedAt : 0; S.stats.talkMs += talk;
    S.calls.log.unshift({ at: a.at, contactId: a.contactId, dir: a.dir, talk: talk, outcome: outcome, convId: a.convId });
    var c = a.convId && S.convs[a.convId];
    if (c) { c.msgs.push({ from: 'system', text: 'Call ended · ' + outcome + ' · talk time ' + mmss(talk) + (a.holdMs ? ' · on hold ' + mmss(a.holdMs) : ''), at: Date.now(), via: 'call' }); c.updatedAt = Date.now(); }
    return a;
  }
  function hangUp() {
    var a = S.calls.active; if (!a || ['CONNECTED', 'HOLD'].indexOf(a.state) < 0) return;
    endCall('Completed');
    a.state = 'WRAP'; a.wrapUntil = Date.now() + P.routing.wrapUpSecs * 1000;
    if (!P.routing.wrapUpSecs) finishWrap('', '', false, true); else changed();
  }
  function finishWrap(dispo, notes, resolveIt, auto) {
    var a = S.calls.active; if (!a || a.state !== 'WRAP') return;
    var c = a.convId && S.convs[a.convId];
    if (!auto && resolveIt && c && !resolve(c, dispo, notes)) return;
    if (!auto && !resolveIt && c && String(notes || '').trim().length >= 2) addNote(c, 'Call notes: ' + String(notes).trim());
    S.calls.active = null;
    toast(auto ? 'Wrap-up time set by the admin has ended. You are ready for the next call.' : 'Wrap-up saved. You are ready for the next call.', 'info');
    changed();
  }
  function transfer() {
    var a = S.calls.active; if (!a || ['CONNECTED', 'HOLD'].indexOf(a.state) < 0) return;
    var opts = P.agents.filter(function (x) { return x.active && x.id !== S.me.id && x.channels.indexOf('call') >= 0; }).map(function (x) { return ['agent:' + x.id, x.name + ' · ' + (P.roles[x.role] || {}).label + ' · ' + x.team]; })
      .concat(P.escalations.map(function (t) { return ['team:' + t, t + ' (team queue)']; }));
    if (!opts.length) { toast('No one to transfer to.', 'error'); return; }
    dialog('Transfer the call (warm transfer, simulated)', [{ name: 'to', label: 'Transfer to', type: 'select', options: opts }, { name: 'note', label: 'Hand-over note', type: 'text' }], 'Transfer').then(function (v) {
      if (!v || S.calls.active !== a) return;
      var who = v.to.indexOf('agent:') === 0 ? agentName(v.to.slice(6)) : v.to.slice(5);
      var c = a.convId && S.convs[a.convId];
      endCall('Transferred to ' + who);
      if (c) {
        if (v.to.indexOf('agent:') === 0) { c.assignee = v.to.slice(6); hist(c, 'Call transferred to ' + who); }
        else { c.state = 'ESCALATED'; c.escalatedTo = who; hist(c, 'Call transferred to ' + who); }
        if (v.note) c.msgs.push({ from: 'note', by: S.me.id, text: 'Transfer note: ' + String(v.note).slice(0, 300), at: Date.now() });
      }
      S.calls.active = null; toast('Call transferred to ' + who + ' (simulated).', 'info'); changed();
    });
  }
  function conference() {
    var a = S.calls.active; if (!a || a.state !== 'CONNECTED' || a.conf) return;
    var sup = first(P.agents, function (x) { return x.active && x.role === 'SUP' && x.id !== S.me.id; });
    a.conf = true;
    var c = a.convId && S.convs[a.convId];
    if (c) c.msgs.push({ from: 'system', text: (sup ? sup.name + ' (supervisor)' : 'A supervisor') + ' joined the call (simulated three-way call).', at: Date.now(), via: 'call' });
    changed();
  }
  function dial(contactId, convId) {
    if (!S.me) return;
    if (!R().outbound) { toast('Your role may not place outbound calls (set by the admin).', 'error'); return; }
    if (!skill('call')) { toast('Voice calls are not enabled for you by the admin.', 'error'); return; }
    if (S.calls.active) { toast('Finish the current call first.', 'error'); return; }
    S.calls.seq += 1;
    var id = 'CL-' + S.calls.seq;
    S.calls.active = { id: id, contactId: contactId, dir: 'out', state: 'DIALING', at: Date.now(), convId: convId || null, ivr: 'Outbound', muted: false, holdMs: 0 };
    S.stats.out++;
    toast('Calling ' + contact(contactId).name + ' from a masked number (simulated).', 'info');
    later(3000, function () {
      var a = S.calls.active; if (!a || a.id !== id || a.state !== 'DIALING') return;
      if (Math.random() < 0.82) {
        a.state = 'CONNECTED'; a.connectedAt = Date.now();
        var c = callCase(a); a.convId = c.id; S.sel.case = c.id;
        c.msgs.push({ from: 'system', text: 'Outbound call connected by ' + S.me.name + ' (masked number' + (P.routing.recordCalls ? ', recorded for quality – simulated' : '') + ').', at: Date.now(), via: 'call' });
        hist(c, 'Outbound call connected');
      } else {
        S.calls.log.unshift({ at: a.at, contactId: a.contactId, dir: 'out', talk: 0, outcome: 'No answer', convId: a.convId });
        var cc = a.convId && S.convs[a.convId];
        if (cc) cc.msgs.push({ from: 'system', text: 'Outbound call – no answer.', at: Date.now(), via: 'call' });
        S.calls.active = null; toast(contact(contactId).name + ' did not answer. Schedule a call-back from the Calls page.', 'warn');
      }
      changed();
    });
    changed();
  }
  function cancelDial() { var a = S.calls.active; if (!a || a.state !== 'DIALING') return; S.calls.log.unshift({ at: a.at, contactId: a.contactId, dir: 'out', talk: 0, outcome: 'Cancelled', convId: a.convId }); S.calls.active = null; changed(); }
  function scheduleCallback(contactId, convId) {
    if (!R().outbound || !skill('call')) { toast('Call-backs need voice calls and outbound calling (set by the admin).', 'error'); return; }
    dialog('Schedule a call-back to ' + contact(contactId).name, [{ name: 'mins', label: 'Call back in', type: 'select', options: [['5', '5 minutes'], ['15', '15 minutes'], ['60', '1 hour'], ['240', '4 hours']], value: '15' }], 'Schedule').then(function (v) {
      if (!v) return;
      S.calls.seq += 1;
      S.calls.callbacks.push({ id: 'CB-' + S.calls.seq, contactId: contactId, convId: convId || null, due: Date.now() + Number(v.mins) * 60000 });
      var c = convId && S.convs[convId]; if (c) { hist(c, 'Call-back scheduled'); c.msgs.push({ from: 'system', text: 'Call-back scheduled for ' + hhmm(Date.now() + Number(v.mins) * 60000) + '.', at: Date.now() }); }
      toast('Call-back scheduled.', 'info'); changed();
    });
  }

  // ------------------------------------------------------------------ simulation: new contacts, teammates, connected demo
  function isPublicPost(subject) { return /^(Public post|Comment|Mention|Review)/.test(subject); }
  function spawn() {
    var chans = CH_ORDER.filter(chOn); if (!chans.length) return;
    var ch = rnd(chans);
    var pool = (DATA.incoming[ch] || []).filter(function (x) { return P.audiences[contact(x[0]).type]; });
    if (!pool.length) return;
    var x = rnd(pool);
    if (ch === 'call') { S.calls.seq += 1; S.calls.queue.push({ id: 'CL-' + S.calls.seq, contactId: x[0], ivr: x[1], subject: x[2], since: Date.now() }); changed(); return; }
    var c = newConv({ channel: ch, contact: x[0], subject: x[1], category: x[1].replace(/^(Public post|Comment|Mention|Review|Message): /, ''), priority: /safety|not moving|urgent/i.test(x[2]) ? 'P1' : 'P3',
      state: 'NEW', public: SOCIAL.indexOf(ch) >= 0 && isPublicPost(x[1]), sentiment: /crazy|cold|not|never|late/i.test(x[2]) ? 'negative' : /thanks|great|lovely|shout/i.test(x[2]) ? 'positive' : 'neutral', msgs: [['contact', x[2]]] });
    c.live = true;
    routeNew(c);
    changed();
  }
  function routeNew(c) {
    // routing rules set by the admin: offer it straight to me when I am available and have the skill
    if (P.routing.autoAssign && S.status === 'AVAILABLE' && canTake(c) && !S.calls.active && (LIVE.indexOf(c.channel) < 0 || liveLoad() < P.routing.maxChats)) {
      c.assignee = S.me.id; c.state = 'OPEN'; hist(c, 'Auto-assigned by routing (' + P.routing.strategy + ')');
      toast('New ' + SHORT[c.channel] + ' conversation assigned to you: ' + c.subject, 'info');
    } else if (canTake(c)) toast('New ' + SHORT[c.channel] + ' conversation waiting: ' + c.subject, 'info');
  }
  function teammates(now) {
    // conversations that wait too long are picked up by a teammate with the right skills (simulated colleagues)
    all().forEach(function (c) {
      if (!c.live || c.hub || c.state !== 'NEW' || c.assignee || now - c.createdAt < 4 * 60000) return;
      var p = peerFor(c.channel, contact(c.contactId).type); if (!p) return;
      c.assignee = p; c.state = 'OPEN'; hist(c, 'Picked up by ' + agentName(p) + ' (routing)');
    });
    S.calls.queue.slice().forEach(function (x) {
      if (now - x.since < 3 * 60000) return;
      var p = peerFor('call', contact(x.contactId).type); if (!p) return;
      S.calls.queue.splice(S.calls.queue.indexOf(x), 1);
      S.calls.log.unshift({ at: x.since, contactId: x.contactId, dir: 'in', talk: 0, outcome: 'Answered by ' + agentName(p), convId: null });
    });
  }
  function hubEngine() { try { var hb = window.parent !== window && window.parent.RN_HUB; return hb && hb.engine ? hb.engine : null; } catch (err) { return null; } }
  function hubContact(by, name) {
    var type = by === 'rider' ? 'customer' : by, id = 'H-' + type + '-' + String(name).replace(/[^A-Za-z]/g, '').slice(0, 12);
    if (!first(DATA.contacts, function (c) { return c.id === id; })) {
      DATA.contacts.push({ id: id, type: type, name: String(name).slice(0, 60), phone: '+91 9•••• ••' + String(Date.now()).slice(-3), email: 'us•••@mail.example', city: 'Hyderabad', since: 'Connected demo', tier: '—', rating: '—', stats: 'Person from the connected demo', records: [] });
    }
    return id;
  }
  function hubMsgs(c, msgs) {
    if (msgs.length <= c.hub.n) return false;
    msgs.slice(c.hub.n).forEach(function (m) {
      if (m.from !== 'user') return;
      c.msgs.push({ from: 'contact', text: String(m.text || '').slice(0, 2000), at: m.at || Date.now(), via: c.channel });
      if (c.state === 'PENDING') c.state = 'OPEN';
      c.unread = true; c.updatedAt = Date.now();
    });
    c.hub.n = msgs.length; return true;
  }
  function hubPoll() {
    var e = hubEngine(); if (!e || !e.state || !e.state.support) return;
    var sup = e.state.support, any = false;
    function take2(kind, id, item, ch, subject, at) {
      var key = kind + ':' + id, c = S.hubSeen[key] && S.convs[S.hubSeen[key]];
      if (!c) {
        if (!chOn(ch)) return;
        c = newConv({ channel: ch, contact: hubContact(item.by, item.user), subject: String(subject || 'Help request').slice(0, 120), category: String(item.category || subject || 'General').slice(0, 40), priority: item.priority || 'P2', state: 'NEW', at: at || Date.now() });
        c.hub = { kind: kind, id: id, n: 0 }; c.live = true; S.hubSeen[key] = c.id; routeNew(c); any = true;
      }
      if (hubMsgs(c, item.messages || [])) any = true;
    }
    (sup.ticketOrder || []).forEach(function (id) { var t = sup.tickets[id]; if (t && !t.sample) take2('ticket', id, t, 'app', t.issue, t.openedAt); });
    (sup.chatOrder || []).forEach(function (id) { var c = sup.chats[id]; if (c && ['QUEUED', 'ACTIVE'].indexOf(c.state) >= 0 || (c && S.hubSeen['chat:' + id])) take2('chat', id, c, 'chat', c.topic, c.startedAt); });
    if (any) changed();
  }
  function hubSignIn(a) {
    // in the connected demo the shared engine also needs a signed-in agent before it accepts replies from this portal
    var e = hubEngine(); if (!e) return;
    try {
      var d = window.parent.RN.data, r = hubRun('agent.signIn', { name: a.name, code: d.DEMO_CODES.agentCode });
      // agents the admin added after the demo data was written act under the first demo agent profile
      if (!r || !r.ok) hubRun('agent.signIn', { name: d.AGENTS[0], code: d.DEMO_CODES.agentCode });
    } catch (err) { /* not in the connected demo */ }
  }
  function hubRun(cmd, payload) { var e = hubEngine(); if (!e) return null; try { payload.key = 'agent-portal:' + cmd + ':' + Date.now() + ':' + Math.random(); return e.run('agent', cmd, payload); } catch (err) { return null; } }
  function hubReply(c, body) {
    if (!c.hub) return;
    if (c.hub.kind === 'ticket') { hubRun('ticket.message', { id: c.hub.id, text: body }); return; }
    var e = hubEngine(), chat = e && e.state.support.chats[c.hub.id];
    if (chat && chat.state === 'QUEUED') hubRun('chat.accept', { id: c.hub.id });
    hubRun('chat.send', { id: c.hub.id, text: body });
  }
  function hubResolve(c, dispo, notes) {
    if (!c.hub) return;
    if (c.hub.kind === 'ticket') hubRun('ticket.resolve', { id: c.hub.id, category: dispo, notes: notes });
    else hubRun('chat.end', { id: c.hub.id });
  }

  // ------------------------------------------------------------------ link with the admin portal
  function presence() {
    S.presenceAt = Date.now();
    if (!S.me) return;
    var a = S.calls.active;
    SYNC.send('presence', {
      agentId: S.me.id, name: S.me.name, role: S.me.role, team: S.me.team,
      status: a ? (a.state === 'WRAP' ? 'WRAP_UP' : a.state === 'RINGING' ? 'RINGING' : 'ON_CALL') : S.status,
      open: myOpen().length, live: liveLoad(), page: (PAGES[S.route] || {}).title || '', policyVersion: P.version,
      waiting: { call: callsWaiting().length, email: waiting(function (c) { return c.channel === 'email'; }).length, chat: waiting(function (c) { return c.channel === 'chat' || c.channel === 'app'; }).length, social: waiting(function (c) { return SOCIAL.indexOf(c.channel) >= 0; }).length },
      breached: visible().filter(breached).length, handled: S.stats.resolved, calls: S.stats.calls
    });
  }
  function applyPolicy(raw, by) {
    var np = SYNC.cleanPolicy(raw, P); if (!np) return;
    S.adminAt = Date.now();
    var same = JSON.stringify(np) === JSON.stringify(P);
    policySource = 'live';
    if (same) { renderChrome(); return; }
    var annBefore = S.annSeen;
    P = np;
    fillLogin();
    if (S.me) {
      var me = agent(S.me.id);
      if (!me || !me.active) { signOut(true); toast('An administrator suspended your agent account. Contact your supervisor.', 'error'); return; }
      var roleChanged = me.role !== S.me.role; S.me = me;
      toast('The admin updated your workspace (policy v' + P.version + (by ? ' by ' + String(by).slice(0, 60) : '') + ')' + (roleChanged ? ': your role is now ' + R().label : '') + '.', 'warn');
      if (P.announcements.length > annBefore) showBanner(P.announcements[P.announcements.length - 1]);
      S.annSeen = P.announcements.length;
      if (S.calls.active && S.calls.active.state === 'RINGING' && !skill('call')) decline(false);
      route();
    }
  }
  function showBanner(a) {
    var b = q('[data-bind="banner"]'); clear(b);
    b.className = 'ag-banner ' + (a.level || 'info'); b.hidden = false;
    b.appendChild(h('b', { text: 'Admin announcement: ' })); b.appendChild(document.createTextNode(a.text));
    b.appendChild(btn('Dismiss', function () { b.hidden = true; }, 'g'));
  }
  SYNC.on(function (type, d) {
    if (type === 'policy') applyPolicy(d.policy, d.by);
    else if (type === 'signout') { S.adminAt = Date.now(); if (S.me && d.agentId === S.me.id) { signOut(true); toast('An administrator signed you out' + (d.reason ? ': ' + String(d.reason).slice(0, 160) : '.'), 'error'); } }
    else if (type === 'presence-request') { S.adminAt = Date.now(); presence(); renderChrome(); }
    else if (type === 'presence' && d.agentId && (!S.me || d.agentId !== S.me.id)) S.peers[d.agentId] = { status: String(d.status || '').slice(0, 20), open: Number(d.open) || 0, at: Date.now() };
    else if (type === 'bye' && d.agentId) delete S.peers[d.agentId];
  });

  // ------------------------------------------------------------------ composer used on every channel page
  // opts: {vias: fn(c), buttons: [{label, cls, run(c, body, via, ctx) → true when done}], placeholder, mail}
  function composer(getConv, opts) {
    var box = h('div', { class: 'ag-composer' });
    var tpl = sel([['', 'Insert approved template…']].concat(P.macros.filter(function (m) { return m.on; }).map(function (m) { return [m.id, m.title]; })), '', 'Insert approved template');
    var via = sel([], null, 'Reply by');
    var dispo = sel([['', 'Resolution…']].concat(P.dispositions.map(function (d) { return [d, d]; })), '', 'Resolution');
    var ta = h('textarea', { class: 'ag-ta', maxlength: '2000', 'aria-label': 'Reply', placeholder: opts.placeholder || 'Write a reply…' });
    if (S.ui.macro) { ta.value = S.ui.macro; S.ui.macro = null; }
    tpl.addEventListener('change', function () { var m = first(P.macros, function (x) { return x.id === tpl.value; }); if (m) { ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + m.text; ta.focus(); } tpl.value = ''; });
    var top = h('div', { class: 'ag-row' }, [h('label', null, ['Reply by', via]), tpl]);
    if (opts.dispo) top.appendChild(h('label', null, ['Resolve as', dispo]));
    if (opts.mail) top.appendChild(btn('Attach file', function () { var n = 'document-' + String(Date.now()).slice(-4) + '.pdf'; ta.value = (ta.value ? ta.value + '\n' : '') + '[Attachment: ' + n + ' (synthetic – no file is read)]'; }, 'g'));
    var row = h('div', { class: 'ag-row' });
    var buttons = (opts.buttons || []).map(function (b) {
      var el = btn(b.label, function () {
        var c = getConv(); if (!c) return;
        if (b.run(c, ta.value, via.value, { dispo: dispo.value, ta: ta })) { ta.value = ''; dispo.value = ''; }
      }, b.cls);
      el.spec = b; row.appendChild(el); return el;
    });
    box.appendChild(top); box.appendChild(ta); box.appendChild(row);
    var lock = h('span', { class: 'ag-lock', hidden: true }); row.appendChild(lock);
    return {
      el: box, ta: ta,
      refresh: function (c) {
        var list = c ? (opts.vias ? opts.vias(c) : [c.channel]) : [];
        var sig = list.join(',') + '|' + list.map(chOn).join(',');
        if (via.getAttribute('data-sig') !== sig) {
          var cur = via.value; via.setAttribute('data-sig', sig); clear(via);
          list.forEach(function (x) { via.appendChild(h('option', { value: x, text: chLabel(x) + (chOn(x) ? '' : ' (off)'), disabled: !chOn(x) || (S.me.channels.indexOf(x) < 0 && !R().team) })); });
          if (list.indexOf(cur) >= 0) via.value = cur;
          if (via.selectedOptions[0] && via.selectedOptions[0].disabled) { var ok = first(qa('option', via), function (o) { return !o.disabled; }); if (ok) via.value = ok.value; }
        }
        via.parentElement.hidden = list.length < 2;
        var closed = !c || !isOpen(c), off = c && !chOn(c.channel) && c.channel !== 'call';
        buttons.forEach(function (b) { b.hidden = !!(c && b.spec.when && !b.spec.when(c)); b.disabled = !c || (closed && !b.spec.whenClosed); });
        ta.disabled = !c || closed;
        lock.hidden = !off; if (off) text(lock, chLabel(c.channel) + ' is switched off by the admin');
      }
    };
  }

  // ------------------------------------------------------------------ pages
  function page(host, cls) { var pg = h('div', { class: 'ag-page' + (cls ? ' ' + cls : '') }); host.appendChild(pg); return pg; }
  function convRow(c, opts) {
    var ct = contact(c.contactId), s = sla(c);
    var act = !c.assignee && canTake(c) ? btn('Take', function () { if (take(c)) openConv(c); }) : btn('Open', function () { openConv(c); }, 'g');
    var cells = [c.id, badge(c.channel), AUD[ct.type] + ' · ' + ct.name, { wrap: (c.public ? 'Public · ' : '') + c.subject }, c.priority, st(s[0], s[1]), st(STATE_LABEL[c.state], STATE_KIND[c.state]), c.assignee ? agentName(c.assignee) : '—', ago(c.updatedAt), act];
    if (opts && opts.short) cells = [c.id, badge(c.channel), ct.name, { wrap: c.subject }, st(s[0], s[1]), st(STATE_LABEL[c.state], STATE_KIND[c.state])];
    return { key: [c.id, c.state, c.assignee, c.priority, s[0], c.msgs.length, ago(c.updatedAt), !!(opts && opts.short), canTake(c)].join(':'), cells: cells, open: function () { openConv(c); } };
  }
  function greeting() { var hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'; }

  // G02 Home
  function buildHome(host) {
    var pg = page(host);
    var title = h('h2'), sub = h('div', { class: 'ag-small' });
    var hero = h('div', { class: 'dcard' }, [h('div', { class: 'ag-hero' }, [h('span', { class: 'av', 'data-bind': 'hero-av' }), h('div', { class: 'ag-fill' }, [title, sub]), btn('Get next conversation', nextBest), btn('Unified inbox', function () { go('G03'); }, 'g')])]);
    pg.appendChild(hero);
    var kpis = h('div', { class: 'kpis' }); pg.appendChild(kpis);
    var grid = h('div', { class: 'ag-grid g-21 ag-fill' }); pg.appendChild(grid);
    var work = card('My open conversations', [btn('All', function () { S.ui.scope = 'mine'; go('G03'); }, 'g')]); var t = table(['Case', 'Channel', 'From', 'Subject', 'SLA', 'State']);
    work.appendChild(h('div', null, [t])); grid.appendChild(work);
    var col = h('div', { class: 'ag-col' }); grid.appendChild(col);
    var ann = card('Announcements from the admin'); var annList = h('div', { class: 'ag-ann' }); ann.appendChild(annList); col.appendChild(ann);
    var acc = card('My channels and user groups', [btn('Details', function () { go('G13'); }, 'g')]); var accBody = h('div', { class: 'ag-row' }); acc.appendChild(accBody); col.appendChild(acc);
    return { update: function () {
      text(title, greeting() + ', ' + S.me.name.split(' ')[0]);
      text(q('[data-bind="hero-av"]', hero), initials(S.me.name));
      text(sub, R().label + ' · ' + S.me.team + ' · ' + STATUS_LABEL[S.status] + ' since ' + hhmm(S.statusAt) + ' · speaks ' + (S.me.langs || '—'));
      var mineOpen = myOpen();
      kpiRow(kpis, [['Calls waiting', skill('call') ? callsWaiting().length : '—', 'G04', skill('call') && callsWaiting().length > 2],
        ['New e-mails', waiting(function (c) { return c.channel === 'email'; }).length, 'G05'],
        ['Chats & in-app', waiting(function (c) { return c.channel === 'chat' || c.channel === 'app'; }).length, 'G07'],
        ['Social media', waiting(function (c) { return SOCIAL.indexOf(c.channel) >= 0; }).length, 'G06'],
        ['My open', mineOpen.length, 'G03'], ['Past SLA', visible().filter(breached).length, 'G03', visible().filter(breached).length > 0]]);
      fill(t, mineOpen.sort(function (a, b) { return b.updatedAt - a.updatedAt; }).slice(0, 12).map(function (c) { return convRow(c, { short: true }); }), 'Nothing assigned to you. Use "Get next conversation".');
      var asig = P.announcements.map(function (a) { return a.at + a.text; }).join('|');
      if (annList.getAttribute('data-sig') !== asig) {
        annList.setAttribute('data-sig', asig); clear(annList);
        if (!P.announcements.length) annList.appendChild(h('div', { text: 'No announcements.' }));
        P.announcements.slice().reverse().forEach(function (a) { annList.appendChild(h('div', { class: a.level }, [h('time', { text: fmtDate(a.at) }), a.text])); });
      }
      var csig = CH_ORDER.map(skill).join() + Object.keys(AUD).map(audOk).join();
      if (accBody.getAttribute('data-sig') !== csig) {
        accBody.setAttribute('data-sig', csig); clear(accBody);
        CH_ORDER.forEach(function (ch) { var b = badge(ch); if (!skill(ch)) { b.classList.add('ag-chip', 'off'); b.title = chOn(ch) ? 'Not in your skills' : 'Switched off by the admin'; } accBody.appendChild(b); });
        accBody.appendChild(h('span', { class: 'ag-small', text: ' · supports ' + Object.keys(AUD).filter(audOk).map(function (a) { return AUD[a].toLowerCase() + 's'; }).join(', ') }));
      }
    } };
  }

  // G03 Unified inbox
  function buildInbox(host) {
    var pg = page(host);
    var bar = h('div', { class: 'ag-row' }); pg.appendChild(bar);
    var scopes = h('span', { class: 'ag-row' });
    var chSel = sel([['all', 'All channels']].concat(CH_ORDER.map(function (c) { return [c, chLabel(c) + (chOn(c) ? '' : ' (off)')]; })), S.ui.ch, 'Channel');
    var audSel = sel([['all', 'Everyone'], ['customer', 'Customers'], ['driver', 'Drivers'], ['partner', 'Partners']], S.ui.aud, 'User group');
    var stSel = sel([['active', 'Active (not resolved)'], ['NEW', 'New'], ['OPEN', 'Open'], ['PENDING', 'Waiting on user'], ['ESCALATED', 'Escalated'], ['RESOLVED', 'Resolved'], ['CLOSED', 'Closed'], ['all', 'All states']], S.ui.state, 'State');
    var srch = h('input', { class: 'ag-inp', type: 'search', placeholder: 'Filter: ID, name, subject', 'aria-label': 'Filter conversations' }); srch.value = S.ui.search;
    bar.appendChild(scopes); bar.appendChild(chSel); bar.appendChild(audSel); bar.appendChild(stSel); bar.appendChild(srch);
    var exp = btn('Export CSV', function () { exportCsv(); }, 'g ag-sp'); bar.appendChild(exp);
    chSel.addEventListener('change', function () { S.ui.ch = chSel.value; upd(); });
    audSel.addEventListener('change', function () { S.ui.aud = audSel.value; upd(); });
    stSel.addEventListener('change', function () { S.ui.state = stSel.value; upd(); });
    srch.addEventListener('input', function () { S.ui.search = srch.value; upd(); });
    var c1 = card('Conversations', [], 'ag-fill'); var t = table(['Case', 'Channel', 'From', 'Subject', 'Priority', 'SLA', 'State', 'Assignee', 'Updated', '']);
    c1.appendChild(h('div', null, [t])); pg.appendChild(c1);
    var countEl = q('.hd b', c1);
    function rows() {
      var qy = S.ui.search.trim().toLowerCase();
      return visible().filter(function (c) {
        var ct = contact(c.contactId);
        if (S.ui.scope === 'mine' && !mine(c)) return false;
        if (S.ui.scope === 'queue' && (c.assignee || c.state !== 'NEW')) return false;
        if (S.ui.ch !== 'all' && c.channel !== S.ui.ch) return false;
        if (S.ui.aud !== 'all' && ct.type !== S.ui.aud) return false;
        if (S.ui.state === 'active' && !isOpen(c)) return false;
        if (S.ui.state !== 'active' && S.ui.state !== 'all' && c.state !== S.ui.state) return false;
        return !qy || (c.id + ' ' + ct.name + ' ' + ct.id + ' ' + c.subject + ' ' + c.category + ' ' + (c.ref || '')).toLowerCase().indexOf(qy) >= 0;
      }).sort(function (a, b) { return a.priority.localeCompare(b.priority) || b.updatedAt - a.updatedAt; });
    }
    function exportCsv() {
      if (!R().export) { toast('Your role may not export data (set by the admin).', 'error'); return; }
      var lines = [['Case', 'Channel', 'From type', 'From', 'Subject', 'Priority', 'State', 'Assignee', 'Created']].concat(rows().map(function (c) { var ct = contact(c.contactId); return [c.id, chLabel(c.channel), AUD[ct.type], ct.name, c.subject, c.priority, STATE_LABEL[c.state], agentName(c.assignee), new Date(c.createdAt).toISOString()]; }));
      var csv = lines.map(function (r) { return r.map(function (v) { v = String(v == null ? '' : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
      var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), a = h('a', { href: url, download: 'agent-conversations.csv' });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('Exported ' + (lines.length - 1) + ' synthetic conversations.', 'info');
    }
    function upd() {
      var ssig = S.ui.scope + waiting().length + myOpen().length;
      if (scopes.getAttribute('data-sig') !== ssig) {
        scopes.setAttribute('data-sig', ssig); clear(scopes);
        [['mine', 'Mine', myOpen().length], ['queue', 'Waiting', waiting().length], ['all', R().team ? 'Everyone' : 'All I can see', null]].forEach(function (s) {
          var b = chip(s[1], S.ui.scope === s[0], function () { S.ui.scope = s[0]; upd(); }); if (s[2] != null) b.appendChild(h('em', { text: String(s[2]) })); scopes.appendChild(b);
        });
      }
      exp.hidden = !R().export;
      var list = rows();
      text(countEl, 'Conversations · ' + list.length);
      fill(t, list.map(convRow), 'No conversations match these filters.');
    }
    return { update: upd };
  }

  // G04 Calls
  function buildCalls(host) {
    var pg = page(host);
    var lock = h('div', { class: 'rn-state warn', hidden: true }); pg.appendChild(lock);
    var grid = h('div', { class: 'ag-grid g-calls ag-fill' }); pg.appendChild(grid);
    var phone = card('Softphone'); var body = h('div', { class: 'ag-callcard' }); phone.appendChild(body); grid.appendChild(phone);
    var col = h('div', { class: 'ag-col' }); grid.appendChild(col);
    var qc = card('Call queue (IVR)'); var qt = table(['Caller', 'Type', 'IVR option', 'Waiting', '']); qc.appendChild(h('div', null, [qt])); col.appendChild(qc);
    var cb = card('Scheduled call-backs'); var cbt = table(['Contact', 'Due', 'Case', '']); cb.appendChild(h('div', null, [cbt])); col.appendChild(cb);
    var lg = card('Recent calls', [], 'ag-fill'); var lgt = table(['Time', 'Contact', 'Direction', 'Talk time', 'Outcome', 'Case']); lg.appendChild(h('div', null, [lgt])); col.appendChild(lg);
    var timerEl = null;
    function phoneView() {
      var a = S.calls.active, sig = a ? a.id + a.state + a.muted + !!a.conf : 'idle' + skill('call') + R().outbound + DATA.contacts.length + S.status;
      if (body.getAttribute('data-sig') === sig) return;
      body.setAttribute('data-sig', sig); clear(body); timerEl = null;
      if (!a) {
        body.appendChild(h('div', { class: 'ag-callstate', text: !skill('call') ? 'Voice calls are not enabled for you' : S.status === 'AVAILABLE' ? 'Ready · waiting for the next call' : 'Not taking calls · status ' + STATUS_LABEL[S.status] }));
        if (skill('call') && S.status !== 'AVAILABLE') body.appendChild(btn('Set me Available', function () { setStatus('AVAILABLE'); }));
        if (skill('call') && R().outbound) {
          var who = sel(DATA.contacts.filter(function (c) { return audOk(c.type) || R().team; }).map(function (c) { return [c.id, AUD[c.type] + ' · ' + c.name + ' · ' + c.phone]; }), null, 'Contact to call');
          body.appendChild(h('div', { class: 'ag-field' }, ['Call a customer, driver or partner (masked number)', who]));
          body.appendChild(btn('Call', function () { dial(who.value); }));
        }
        body.appendChild(h('p', { class: 'ag-muted', text: 'Numbers are always masked: the telephony provider connects the call (simulated, no audio). Ring time ' + P.routing.ringSecs + ' s and wrap-up time ' + P.routing.wrapUpSecs + ' s are set by the admin.' }));
        return;
      }
      var ct = contact(a.contactId);
      body.appendChild(h('div', { class: 'ag-callhead' }, [h('span', { class: 'av', text: initials(ct.name) }), h('div', null, [h('b', { text: ct.name }), h('div', { class: 'ag-small', text: AUD[ct.type] + ' · ' + ct.phone + ' · ' + ct.city }), h('div', { class: 'ag-small', text: (a.dir === 'in' ? 'Inbound · IVR ' : 'Outbound · ') + a.ivr + (a.subject ? ' · ' + a.subject : '') })])]));
      timerEl = h('div', { class: 'ag-bigtimer' }); body.appendChild(timerEl);
      var label = { RINGING: 'Ringing…', DIALING: 'Calling (masked)…', CONNECTED: a.muted ? 'Connected · muted' : 'Connected', HOLD: 'On hold', WRAP: 'Wrap-up' }[a.state];
      body.appendChild(h('div', { class: 'ag-callstate' + (a.state === 'RINGING' ? ' ag-pulse' : ''), text: label + (a.conf ? ' · supervisor on the call' : '') }));
      if (a.state === 'RINGING') body.appendChild(h('div', { class: 'ag-callbtns' }, [btn('Answer', answer), btn('Decline', function () { decline(false); }, 'g'), btn('Customer record', function () { S.sel.contact = a.contactId; go('G09'); }, 'g')]));
      else if (a.state === 'DIALING') body.appendChild(h('div', { class: 'ag-callbtns' }, [btn('Cancel', cancelDial, 'r')]));
      else if (a.state === 'CONNECTED' || a.state === 'HOLD') {
        body.appendChild(h('div', { class: 'ag-callbtns' }, [btn(a.muted ? 'Unmute' : 'Mute', toggleMute, a.muted ? 'on' : 'g'), btn(a.state === 'HOLD' ? 'Resume' : 'Hold', toggleHold, a.state === 'HOLD' ? 'on' : 'g'), btn('Transfer', transfer, 'g'),
          btn('Add supervisor', conference, 'g', { disabled: !!a.conf }), btn('Open case', function () { S.sel.case = a.convId; go('G08'); }, 'g'), btn('Hang up', hangUp, 'r')]));
        var notes = h('textarea', { class: 'ag-ta', placeholder: 'Call notes (saved to the case as an internal note)', 'aria-label': 'Call notes', maxlength: '1000' });
        body.appendChild(notes);
        body.appendChild(btn('Save note', function () { var c = S.convs[a.convId]; if (c && addNote(c, 'Call notes: ' + notes.value)) { notes.value = ''; toast('Note saved to ' + c.id + '.', 'info'); } }, 'g'));
      } else if (a.state === 'WRAP') {
        var d = sel([['', 'Choose…']].concat(P.dispositions.map(function (x) { return [x, x]; })), '', 'Call outcome');
        var n = h('textarea', { class: 'ag-ta', placeholder: 'What was agreed with the caller', 'aria-label': 'Wrap-up notes', maxlength: '1000' });
        var rs = h('input', { type: 'checkbox', id: 'ag-wrap-resolve' });
        body.appendChild(h('div', { class: 'ag-field' }, ['Outcome', d])); body.appendChild(n);
        body.appendChild(h('label', { class: 'ag-row ag-small', for: 'ag-wrap-resolve' }, [rs, 'Resolve the case now']));
        body.appendChild(btn('Save wrap-up', function () { finishWrap(d.value, n.value, rs.checked, false); }));
      }
    }
    function timers() {
      var a = S.calls.active; if (!a || !timerEl) return;
      var now = Date.now();
      text(timerEl, a.state === 'RINGING' ? mmss(a.ringUntil - now) : a.state === 'DIALING' ? mmss(now - a.at) : a.state === 'WRAP' ? mmss(a.wrapUntil - now) + ' left' : mmss(now - a.connectedAt));
    }
    return { update: function () {
      lock.hidden = skill('call');
      if (!skill('call')) { clear(lock); lock.appendChild(h('b', { text: chOn('call') ? 'Voice calls are not in your skills' : 'Voice calls are switched off by the admin' })); lock.appendChild(h('span', { text: 'The admin portal decides which channels each agent works on. You can still see your call history.' })); }
      phoneView(); timers();
      fill(qt, callsWaiting().sort(function (a, b) { return (b.ivr === 'Safety') - (a.ivr === 'Safety') || a.since - b.since; }).map(function (x) {
        var ct = contact(x.contactId);
        return { key: x.id + mmss(Date.now() - x.since), cells: [ct.name, AUD[ct.type], x.ivr === 'Safety' ? st('Safety', 'err') : x.ivr, mmss(Date.now() - x.since), x.ivr === 'Safety' ? st('First in line', 'err') : ''] };
      }), 'No callers waiting.');
      fill(cbt, S.calls.callbacks.map(function (x) {
        var ct = contact(x.contactId);
        return { key: x.id + (x.due < Date.now()), cells: [ct.name, x.due < Date.now() ? st('Due now', 'warn') : hhmm(x.due), x.convId || '—', h('span', { class: 'ag-row' }, [btn('Call now', function () { S.calls.callbacks.splice(S.calls.callbacks.indexOf(x), 1); dial(x.contactId, x.convId); }), btn('Remove', function () { var at = S.calls.callbacks.indexOf(x); S.calls.callbacks.splice(at, 1); changed(); if (window.RNUX) RNUX.undoToast('Callback removed.', function () { S.calls.callbacks.splice(at, 0, x); changed(); }); }, 'g')])] };
      }), 'No call-backs scheduled.');
      fill(lgt, S.calls.log.slice(0, 15).map(function (x, i) {
        return { key: i + x.at + x.outcome, cells: [hhmm(x.at), contact(x.contactId).name, x.dir === 'in' ? 'Inbound' : 'Outbound', mmss(x.talk), x.outcome, x.convId || '—'], open: x.convId ? function () { S.sel.case = x.convId; go('G08'); } : null };
      }), 'No calls yet in this session.');
    } };
  }

  // shared list + detail layout for e-mail, social and chat pages
  function itemList(host, list, selected, onPick) {
    var sig = list.map(function (c) { return c.id + c.state + c.msgs.length + c.unread + c.assignee + sla(c)[0] + (c.id === selected); }).join('|');
    if (host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig); clear(host);
    if (!list.length) { host.appendChild(h('div', { class: 'ag-empty', text: 'Nothing here.' })); return; }
    list.forEach(function (c) {
      var ct = contact(c.contactId), s = sla(c), last = c.msgs.filter(function (m) { return m.from !== 'note'; }).slice(-1)[0];
      var it = h('div', { class: 'ag-item' + (c.id === selected ? ' on' : '') + (c.unread ? ' unread' : ''), tabindex: '0', role: 'button', 'aria-pressed': String(c.id === selected) }, [
        h('div', { class: 'ag-row' }, [badge(c.channel), c.public ? h('span', { class: 'ag-pub', text: 'Public' }) : null, h('b', { text: ct.name }), h('span', { class: 'ag-small', text: AUD[ct.type] }), h('span', { class: 'ag-sp ag-small', text: ago(c.updatedAt) })]),
        h('div', { class: 'ag-row' }, [h('span', { text: c.subject }), h('span', { class: 'ag-sp' }, [st(s[0], s[1])])]),
        h('div', { class: 'ag-sub', text: last ? last.text : '' })]);
      it.addEventListener('click', function () { onPick(c); });
      it.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(c); } });
      host.appendChild(it);
    });
  }
  function convHeader(host, c, extra) {
    var sig = c ? [c.id, c.state, c.assignee, c.priority, c.public, c.hidden, c.sentiment, sla(c)[0], R().publicReply].join(':') : 'none';
    if (host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig); clear(host);
    if (!c) { host.appendChild(h('div', { class: 'ag-empty', text: 'Choose a conversation on the left.' })); return; }
    var ct = contact(c.contactId), s = sla(c);
    host.appendChild(h('div', { class: 'ag-row' }, [h('b', { text: c.subject }), h('span', { class: 'ag-sp' }, [badge(c.channel)])]));
    host.appendChild(h('div', { class: 'ag-row ag-small' }, [c.id + ' · ' + AUD[ct.type] + ' · ' + ct.name + ' · ' + (c.channel === 'email' ? ct.email : ct.phone) + ' · ', st(STATE_LABEL[c.state], STATE_KIND[c.state]), st(c.priority, c.priority === 'P1' ? 'err' : ''), st(s[0], s[1]),
      c.public ? h('span', { class: 'ag-pub', text: c.hidden ? 'Public · hidden' : 'Public' }) : null, c.sentiment !== 'neutral' ? st(c.sentiment === 'negative' ? 'Negative' : 'Positive', c.sentiment === 'negative' ? 'err' : 'ok') : null,
      c.assignee ? 'Assigned to ' + agentName(c.assignee) : 'Unassigned']));
    var acts = h('div', { class: 'ag-row' });
    if (!mine(c) && isOpen(c)) acts.appendChild(btn(c.assignee ? 'Take over' : 'Take', function () { take(c); }));
    if (S.route !== 'G08') acts.appendChild(btn('Case workspace', function () { S.sel.case = c.id; go('G08'); }, 'g'));
    acts.appendChild(btn('Call (masked)', function () { dial(c.contactId, c.id); }, 'g', { disabled: !skill('call') || !R().outbound }));
    (extra || []).forEach(function (b) { acts.appendChild(b); });
    host.appendChild(acts);
  }
  function threadView(host, c, mail) {
    var sig = c ? c.id + ':' + c.msgs.length : 'none';
    if (host.getAttribute('data-sig') === sig) return;
    host.setAttribute('data-sig', sig); clear(host);
    if (!c) return;
    var ct = contact(c.contactId);
    c.msgs.forEach(function (m) {
      var who = m.from === 'contact' ? ct.name : m.from === 'agent' ? agentName(m.by) + ' · ' + BRAND + ' support' : m.from === 'note' ? 'Internal note · ' + agentName(m.by) : '';
      if (mail && (m.from === 'contact' || m.from === 'agent')) {
        host.appendChild(h('div', { class: 'ag-mail ' + m.from }, [h('div', { class: 'who' }, [h('b', { text: who }), m.from === 'contact' ? ct.email : 'to ' + ct.email, h('span', { class: 'ag-sp', text: fmtDate(m.at) })]), m.text]));
        return;
      }
      var n = h('div', { class: 'ag-msg ' + m.from });
      if (m.from !== 'system') n.appendChild(h('div', { class: 'who' }, [who, m.via && m.via !== c.channel ? badge(m.via) : null, m.public ? h('span', { class: 'ag-pub', text: 'Public' }) : null, h('time', { text: hhmm(m.at) })]));
      n.appendChild(document.createTextNode(m.text));
      if (m.from === 'system') n.appendChild(h('time', { text: ' · ' + hhmm(m.at) }));
      host.appendChild(n);
    });
    host.scrollTop = host.scrollHeight;
    c.unread = false;
  }
  function detailPane(container, getConv, cmp, mail, extraButtons) {
    var head = h('div', { class: 'ag-col' }), th = h('div', { class: 'ag-thread' });
    container.appendChild(head); container.appendChild(th); container.appendChild(cmp.el);
    return function () { var c = getConv(); convHeader(head, c, c && extraButtons ? extraButtons(c) : null); threadView(th, c, mail); cmp.refresh(c); };
  }

  // G05 E-mail
  function buildEmail(host) {
    var pg = page(host);
    var lock = h('div', { class: 'rn-state warn', hidden: true }); pg.appendChild(lock);
    var grid = h('div', { class: 'ag-grid g-mail ag-fill' }); pg.appendChild(grid);
    var fcard = card('Mailboxes'); var folders = h('div', { class: 'ag-col' }); fcard.appendChild(folders);
    fcard.appendChild(btn('New e-mail', newEmail)); grid.appendChild(fcard);
    var lcard = card('Inbox'); var list = h('div', { class: 'ag-list' }); lcard.appendChild(list); grid.appendChild(lcard);
    var rcard = h('div', { class: 'dcard' }); grid.appendChild(rcard);
    var FOLDERS = [['inbox', 'Inbox', function (c) { return isOpen(c) && c.state !== 'PENDING' && c.state !== 'ESCALATED' && (mine(c) || (!c.assignee && c.state === 'NEW')); }],
      ['pending', 'Waiting on user', function (c) { return c.state === 'PENDING' && mine(c); }], ['escalated', 'Escalated', function (c) { return c.state === 'ESCALATED'; }],
      ['done', 'Resolved & closed', function (c) { return !isOpen(c); }], ['all', 'All e-mail', function () { return true; }]];
    function emails() { return visible().filter(function (c) { return c.channel === 'email'; }); }
    function cur() { var c = S.convs[S.sel.email]; return c && c.channel === 'email' && canSee(c) ? c : null; }
    var cmp = composer(cur, { mail: true, dispo: true, placeholder: 'Write your e-mail reply…', vias: function () { return ['email']; }, buttons: [
      { label: 'Send', run: function (c, b, v) { return sendReply(c, b, 'email'); } },
      { label: 'Send & wait for reply', cls: 'g', run: function (c, b) { return sendReply(c, b, 'email', { pending: true }); } },
      { label: 'Send & resolve', cls: 'g', run: function (c, b, v, x) { if (!x.dispo) { toast('Choose "Resolve as" first.', 'error'); return false; } return sendReply(c, b, 'email') && resolve(c, x.dispo, b); } },
      { label: 'Reopen', cls: 'g', whenClosed: true, when: function (c) { return !isOpen(c); }, run: function (c) { reopen(c); return false; } }] });
    var refresh = detailPane(rcard, cur, cmp, true);
    function newEmail() {
      if (!skill('email')) { toast('E-mail is not enabled for you by the admin.', 'error'); return; }
      dialog('New e-mail (sent from support@' + BRAND.toLowerCase() + '.example – simulated)', [
        { name: 'to', label: 'To', type: 'select', options: DATA.contacts.filter(function (c) { return audOk(c.type); }).map(function (c) { return [c.id, AUD[c.type] + ' · ' + c.name + ' · ' + c.email]; }) },
        { name: 'subject', label: 'Subject', type: 'text' }, { name: 'body', label: 'Message', type: 'textarea' }], 'Send').then(function (v) {
        if (!v) return;
        if (v.subject.trim().length < 3 || v.body.trim().length < 5) { toast('Write a subject and a message.', 'error'); return; }
        var c = newConv({ channel: 'email', contact: v.to, subject: v.subject.trim(), category: 'Outbound e-mail', priority: 'P3', state: 'OPEN', assignee: S.me.id });
        c.unread = false; sendReply(c, v.body, 'email', { pending: true }); S.sel.email = c.id; S.ui.folder = 'pending'; toast('E-mail sent (simulated).', 'info'); changed();
      });
    }
    return { update: function () {
      lock.hidden = skill('email');
      if (!skill('email')) { clear(lock); lock.appendChild(h('b', { text: chOn('email') ? 'E-mail is not in your skills' : 'E-mail is switched off by the admin' })); lock.appendChild(h('span', { text: 'You can still read e-mails assigned to you.' })); }
      var es = emails();
      var fsig = S.ui.folder + FOLDERS.map(function (f) { return es.filter(f[2]).length; }).join();
      if (folders.getAttribute('data-sig') !== fsig) {
        folders.setAttribute('data-sig', fsig); clear(folders);
        FOLDERS.forEach(function (f) { var b = h('button', { type: 'button', class: 'ag-folder' + (S.ui.folder === f[0] ? ' on' : ''), 'aria-pressed': String(S.ui.folder === f[0]) }, [f[1], h('em', { text: String(es.filter(f[2]).length) })]); b.addEventListener('click', function () { S.ui.folder = f[0]; changed(); }); folders.appendChild(b); });
      }
      var f = first(FOLDERS, function (x) { return x[0] === S.ui.folder; }) || FOLDERS[0];
      text(q('.hd b', lcard), f[1]);
      itemList(list, es.filter(f[2]).sort(function (a, b) { return b.updatedAt - a.updatedAt; }), S.sel.email, function (c) { S.sel.email = c.id; c.unread = false; changed(); });
      refresh();
    } };
  }

  // G06 Social media
  function buildSocial(host) {
    var pg = page(host);
    var tabs = h('div', { class: 'ag-row' }); pg.appendChild(tabs);
    var grid = h('div', { class: 'ag-grid g-12 ag-fill' }); pg.appendChild(grid);
    var lcard = card('Conversations, mentions and comments'); var list = h('div', { class: 'ag-list' }); lcard.appendChild(list); grid.appendChild(lcard);
    var rcard = h('div', { class: 'dcard' }); grid.appendChild(rcard);
    function socials() { return visible().filter(function (c) { return SOCIAL.indexOf(c.channel) >= 0; }); }
    function cur() { var c = S.convs[S.sel.social]; return c && SOCIAL.indexOf(c.channel) >= 0 && canSee(c) ? c : null; }
    var cmp = composer(cur, { dispo: true, placeholder: 'Write a reply…', vias: function (c) { return [c.channel]; }, buttons: [
      { label: 'Send private reply', when: function (c) { return !c.public; }, run: function (c, b) { return sendReply(c, b, c.channel); } },
      { label: 'Reply publicly', when: function (c) { return c.public && R().publicReply; }, run: function (c, b) { return sendReply(c, b, c.channel, { public: true }); } },
      { label: 'Move to private message', cls: 'g', when: function (c) { return c.public; }, run: function (c) { movePrivate(c); return false; } },
      { label: 'Resolve', cls: 'g', run: function (c, b, v, x) { return resolve(c, x.dispo, b || 'Handled on ' + chLabel(c.channel)); } },
      { label: 'Reopen', cls: 'g', whenClosed: true, when: function (c) { return !isOpen(c); }, run: function (c) { reopen(c); return false; } }] });
    var note = h('p', { class: 'ag-muted', hidden: true }); rcard.appendChild(note);
    var refresh = detailPane(rcard, cur, cmp, false, function (c) { return c.public && !c.hidden ? [btn('Hide comment', function () { hideComment(c); }, 'g')] : []; });
    return { update: function () {
      var ss = socials();
      var tsig = S.ui.social + SOCIAL.map(function (x) { return chOn(x) + ':' + skill(x) + ':' + ss.filter(function (c) { return c.channel === x && c.state === 'NEW'; }).length; }).join();
      if (tabs.getAttribute('data-sig') !== tsig) {
        tabs.setAttribute('data-sig', tsig); clear(tabs);
        [['all', 'All networks']].concat(SOCIAL.map(function (x) { return [x, chLabel(x)]; })).forEach(function (t) {
          var n = t[0] === 'all' ? ss.filter(function (c) { return c.state === 'NEW'; }).length : ss.filter(function (c) { return c.channel === t[0] && c.state === 'NEW'; }).length;
          var b = chip(t[1], S.ui.social === t[0], function () { S.ui.social = t[0]; changed(); }, t[0] !== 'all' && !skill(t[0]) ? 'off' : '');
          b.appendChild(h('em', { text: t[0] !== 'all' && !chOn(t[0]) ? 'off' : String(n) }));
          if (t[0] !== 'all' && !chOn(t[0])) b.title = 'Switched off by the admin';
          tabs.appendChild(b);
        });
        tabs.appendChild(h('span', { class: 'ag-sp ag-small', text: 'Live conversations: ' + liveLoad() + ' of ' + P.routing.maxChats + ' (limit set by the admin)' }));
      }
      itemList(list, ss.filter(function (c) { return S.ui.social === 'all' || c.channel === S.ui.social; }).sort(function (a, b) { return (isOpen(b) - isOpen(a)) || b.updatedAt - a.updatedAt; }), S.sel.social, function (c) { S.sel.social = c.id; c.unread = false; changed(); });
      var c = cur();
      note.hidden = !(c && c.public && !R().publicReply);
      text(note, 'Your role (' + R().label + ') may not reply in public. Use the approved "Move to private message" reply instead (set by the admin).');
      refresh();
    } };
  }

  // G07 Live chat and in-app tickets
  function buildChat(host) {
    var pg = page(host);
    var tabs = h('div', { class: 'ag-row' }); pg.appendChild(tabs);
    var grid = h('div', { class: 'ag-grid g-12 ag-fill' }); pg.appendChild(grid);
    var lcard = card('Conversations'); var list = h('div', { class: 'ag-list' }); lcard.appendChild(list); grid.appendChild(lcard);
    var rcard = h('div', { class: 'dcard' }); grid.appendChild(rcard);
    function items() { return visible().filter(function (c) { return c.channel === S.ui.chatTab; }); }
    function cur() { var c = S.convs[S.sel.chat]; return c && (c.channel === 'chat' || c.channel === 'app') && canSee(c) ? c : null; }
    var cmp = composer(cur, { dispo: true, placeholder: 'Type a message…', vias: function (c) { return c.channel === 'chat' ? ['chat'] : ['app', 'email']; }, buttons: [
      { label: 'Send', run: function (c, b, v) { return sendReply(c, b, v || c.channel); } },
      { label: 'Send & wait for reply', cls: 'g', when: function (c) { return c.channel === 'app'; }, run: function (c, b, v) { return sendReply(c, b, v || c.channel, { pending: true }); } },
      { label: 'End & resolve', cls: 'g', run: function (c, b, v, x) { return resolve(c, x.dispo, b || (c.channel === 'chat' ? 'Chat ended' : 'Ticket answered')); } },
      { label: 'Reopen', cls: 'g', whenClosed: true, when: function (c) { return !isOpen(c); }, run: function (c) { reopen(c); return false; } }] });
    var refresh = detailPane(rcard, cur, cmp, false, function (c) { return R().reassign && isOpen(c) ? [btn('Transfer', function () { pickAgent(c); }, 'g')] : []; });
    cmp.ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && cur() && cur().channel === 'chat') { e.preventDefault(); if (sendReply(cur(), cmp.ta.value, 'chat')) cmp.ta.value = ''; } });
    return { update: function () {
      var tsig = S.ui.chatTab + ['chat', 'app'].map(function (x) { return chOn(x) + ':' + waiting(function (c) { return c.channel === x; }).length; }).join() + liveLoad();
      if (tabs.getAttribute('data-sig') !== tsig) {
        tabs.setAttribute('data-sig', tsig); clear(tabs);
        [['chat', 'Live chat'], ['app', 'In-app tickets']].forEach(function (t) {
          var b = chip(t[1], S.ui.chatTab === t[0], function () { S.ui.chatTab = t[0]; changed(); }, skill(t[0]) ? '' : 'off');
          b.appendChild(h('em', { text: chOn(t[0]) ? String(waiting(function (c) { return c.channel === t[0]; }).length) : 'off' })); tabs.appendChild(b);
        });
        tabs.appendChild(h('span', { class: 'ag-sp ag-small', text: 'Live conversations: ' + liveLoad() + ' of ' + P.routing.maxChats + ' (limit set by the admin) · Enter sends, Shift+Enter adds a line' }));
      }
      text(q('.hd b', lcard), S.ui.chatTab === 'chat' ? 'Live chats from the apps' : 'Tickets raised in the apps');
      itemList(list, items().sort(function (a, b) { return (isOpen(b) - isOpen(a)) || b.updatedAt - a.updatedAt; }), S.sel.chat, function (c) { S.sel.chat = c.id; c.unread = false; changed(); });
      refresh();
    } };
  }
  function pickAgent(c) {
    var opts = P.agents.filter(function (a) { return a.active && a.id !== c.assignee && (a.channels.indexOf(c.channel) >= 0 || c.channel === 'call'); }).map(function (a) { return [a.id, a.name + ' · ' + (P.roles[a.role] || {}).label + ' · ' + a.team]; });
    if (!opts.length) { toast('No other agent has this channel.', 'error'); return; }
    dialog('Reassign ' + c.id, [{ name: 'to', label: 'Assign to', type: 'select', options: opts }], 'Reassign').then(function (v) { if (v) reassign(c, v.to); });
  }

  // G08 Case workspace
  function buildCase(host) {
    var pg = page(host);
    var picker = card('My open cases'); var pt = table(['Case', 'Channel', 'From', 'Subject', 'SLA', 'State']); picker.appendChild(h('div', null, [pt])); pg.appendChild(picker);
    var grid = h('div', { class: 'ag-grid g-case ag-fill' }); pg.appendChild(grid);
    var left = h('div', { class: 'dcard' }); grid.appendChild(left);
    var right = h('div', { class: 'ag-col' }); grid.appendChild(right);
    function cur() { var c = S.convs[S.sel.case]; return c && canSee(c) ? c : null; }
    var cmp = composer(cur, { placeholder: 'Reply to the person, or write an internal note…', vias: viasFor, buttons: [
      { label: 'Send', run: function (c, b, v) { return sendReply(c, b, v); } },
      { label: 'Send & wait for reply', cls: 'g', run: function (c, b, v) { return sendReply(c, b, v, { pending: true }); } },
      { label: 'Add internal note', cls: 'g', whenClosed: true, run: function (c, b) { return addNote(c, b); } }] });
    var refresh = detailPane(left, cur, cmp, false);
    var cc = card('Contact'); var cbody = h('div', { class: 'ag-col' }); cc.appendChild(cbody); right.appendChild(cc);
    var ac = card('Actions'); var abody = h('div', { class: 'ag-col' }); ac.appendChild(abody); right.appendChild(ac);
    var hc = card('History'); var tl = h('div', { class: 'tl' }); hc.appendChild(h('div', null, [tl])); right.appendChild(hc);
    function contactCard(c) {
      var ct = contact(c.contactId), sig = c.id + ct.id + DATA.contacts.length;
      if (cbody.getAttribute('data-sig') === sig) return;
      cbody.setAttribute('data-sig', sig); clear(cbody);
      cbody.appendChild(h('dl', { class: 'ag-kv' }, [h('dt', { text: 'Name' }), h('dd', { text: ct.name + ' · ' + AUD[ct.type] + ' · ' + ct.id }), h('dt', { text: 'Phone' }), h('dd', { text: ct.phone + ' (masked)' }),
        h('dt', { text: 'E-mail' }), h('dd', { text: ct.email + ' (masked)' }), h('dt', { text: 'City · since' }), h('dd', { text: ct.city + ' · ' + ct.since }), h('dt', { text: 'Profile' }), h('dd', { text: (ct.tier || '—') + ' · ★ ' + (ct.rating || '—') + ' · ' + (ct.stats || '') }),
        h('dt', { text: 'Linked' }), h('dd', { text: c.ref || 'No linked trip or order' }), h('dt', { text: 'Other cases' }), h('dd', { text: String(all().filter(function (x) { return x.contactId === ct.id && x.id !== c.id; }).length) })]));
      var rt = table(['Record', 'What', 'Amount', 'When']); fill(rt, (ct.records || []).map(function (r) { return { key: r.join(), cells: r }; }), 'No records.');
      cbody.appendChild(h('div', { class: 'ag-scroll' }, [rt]));
      cbody.appendChild(h('div', { class: 'ag-row' }, [btn('Call (masked)', function () { dial(ct.id, c.id); }, 'g', { disabled: !skill('call') || !R().outbound }), btn('Schedule call-back', function () { scheduleCallback(ct.id, c.id); }, 'g'), btn('Profile', function () { S.sel.contact = ct.id; go('G09'); }, 'g')]));
    }
    function actions(c) {
      var sig = [c.id, c.state, c.priority, c.assignee, S.me.role, P.version].join(':');
      if (abody.getAttribute('data-sig') === sig) return;
      abody.setAttribute('data-sig', sig); clear(abody);
      var pr = sel(PRIORITY, c.priority, 'Priority'); pr.addEventListener('change', function () { setPriority(c, pr.value); });
      var own = h('div', { class: 'ag-row' }, [h('label', { class: 'ag-field' }, ['Priority', pr])]);
      if (!mine(c) && isOpen(c)) own.appendChild(btn(c.assignee ? 'Take over' : 'Assign to me', function () { take(c); }));
      if (R().reassign && isOpen(c)) own.appendChild(btn('Reassign…', function () { pickAgent(c); }, 'g'));
      abody.appendChild(own);
      if (!isOpen(c)) {
        abody.appendChild(h('div', { class: 'ag-row' }, [st(STATE_LABEL[c.state] + (c.disposition ? ' · ' + c.disposition : ''), ''), btn('Reopen', function () { reopen(c); }, 'g'), c.state === 'RESOLVED' && R().close ? btn('Close', function () { closeCase(c); }, 'g') : null]));
        return;
      }
      var team = sel([['', 'Escalate to…']].concat(P.escalations.map(function (x) { return [x, x]; })), '', 'Escalate to');
      var why = h('input', { class: 'ag-inp', placeholder: 'Reason', maxlength: '300', 'aria-label': 'Escalation reason' });
      abody.appendChild(h('div', { class: 'ag-row' }, [team, why, btn('Escalate', function () { if (escalate(c, team.value, why.value)) { why.value = ''; } }, 'r')]));
      var amt = h('input', { class: 'ag-inp', type: 'number', min: '1', step: '1', placeholder: '₹', 'aria-label': 'Credit amount in rupees' });
      var rs = h('input', { class: 'ag-inp', placeholder: 'Reason for the credit', maxlength: '200', 'aria-label': 'Credit reason' });
      abody.appendChild(h('div', { class: 'ag-field' }, ['Goodwill credit · your limit ' + rupees(R().refundLimit) + ' (set by the admin; above it goes to Finance for approval)', h('div', { class: 'ag-row' }, [amt, rs, btn('Add credit', function () { if (credit(c, amt.value, rs.value)) { amt.value = ''; rs.value = ''; } }, 'g')])]));
      var dp = sel([['', 'Resolution…']].concat(P.dispositions.map(function (x) { return [x, x]; })), '', 'Resolution');
      var nt = h('input', { class: 'ag-inp', placeholder: 'Resolution notes', maxlength: '500', 'aria-label': 'Resolution notes' });
      abody.appendChild(h('div', { class: 'ag-row' }, [dp, nt, btn('Resolve', function () { resolve(c, dp.value, nt.value); })]));
    }
    return { update: function () {
      var c = cur();
      picker.hidden = !!c; grid.hidden = !c;
      if (!c) {
        fill(pt, myOpen().sort(function (a, b) { return a.priority.localeCompare(b.priority) || b.updatedAt - a.updatedAt; }).map(function (x) {
          var r = convRow(x, { short: true }); r.open = function () { S.sel.case = x.id; x.unread = false; changed(); }; return r;
        }), 'No open cases. Pick one from the unified inbox.');
        return;
      }
      text(q('[data-bind="title"]'), 'Case ' + c.id);
      refresh(); contactCard(c); actions(c);
      var hs = c.id + c.history.length;
      if (tl.getAttribute('data-sig') !== hs) {
        tl.setAttribute('data-sig', hs); clear(tl);
        c.history.slice().reverse().forEach(function (e) { tl.appendChild(h('div', { class: 'e' }, [h('span', { class: 'tm', text: hhmm(e.at) }), h('span', { class: 'dt2' }), h('span', { text: e.text + ' · ' + e.by })])); });
      }
    } };
  }

  // G09 Contacts
  function buildContacts(host) {
    var pg = page(host);
    var grid = h('div', { class: 'ag-grid g-12 ag-fill' }); pg.appendChild(grid);
    var lc = card('Customers, drivers and partners'); grid.appendChild(lc);
    var srch = h('input', { class: 'ag-inp', type: 'search', placeholder: 'Name, ID, city', 'aria-label': 'Search contacts' }); srch.value = S.ui.cq;
    var audBar = h('div', { class: 'ag-row' });
    lc.appendChild(h('div', { class: 'ag-row' }, [srch, audBar]));
    var t = table(['Name', 'Type', 'City', 'ID', 'Open cases']); lc.appendChild(h('div', null, [t]));
    var rc = h('div', { class: 'dcard' }); grid.appendChild(rc);
    srch.addEventListener('input', function () { S.ui.cq = srch.value; changed(); });
    function people() {
      var qy = S.ui.cq.trim().toLowerCase();
      return DATA.contacts.filter(function (c) { return (audOk(c.type) || R().team) && (S.ui.caud === 'all' || c.type === S.ui.caud) && (!qy || (c.name + ' ' + c.id + ' ' + c.city).toLowerCase().indexOf(qy) >= 0); });
    }
    return { update: function () {
      var asig = S.ui.caud + Object.keys(AUD).map(audOk).join();
      if (audBar.getAttribute('data-sig') !== asig) {
        audBar.setAttribute('data-sig', asig); clear(audBar);
        [['all', 'All']].concat(Object.keys(AUD).map(function (a) { return [a, AUD[a] + 's']; })).forEach(function (a) { audBar.appendChild(chip(a[1], S.ui.caud === a[0], function () { S.ui.caud = a[0]; changed(); }, a[0] !== 'all' && !audOk(a[0]) && !R().team ? 'off' : '')); });
      }
      var list = people();
      fill(t, list.map(function (c) { var n = all().filter(function (x) { return x.contactId === c.id && isOpen(x); }).length; return { key: c.id + n + (S.sel.contact === c.id), on: S.sel.contact === c.id, cells: [c.name, AUD[c.type], c.city, c.id, String(n)], open: function () { S.sel.contact = c.id; changed(); } }; }), 'No contacts match. You only see the user groups the admin gave you.');
      var ct = S.sel.contact && first(DATA.contacts, function (c) { return c.id === S.sel.contact; });
      var cases = ct ? all().filter(function (x) { return x.contactId === ct.id; }) : [];
      var sig = ct ? ct.id + cases.map(function (x) { return x.id + x.state; }).join() + skill('call') : 'none';
      if (rc.getAttribute('data-sig') === sig) return;
      rc.setAttribute('data-sig', sig); clear(rc);
      if (!ct) { rc.appendChild(h('div', { class: 'ag-empty', text: 'Choose a person to see their profile, records and conversations.' })); return; }
      rc.appendChild(h('div', { class: 'hd' }, [h('b', { text: ct.name + ' · ' + AUD[ct.type] }), h('span', { class: 'sp' }, [
        btn('Call (masked)', function () { dial(ct.id); }, '', { disabled: !skill('call') || !R().outbound }),
        btn('E-mail', function () { emailTo(ct); }, 'g', { disabled: !skill('email') }), btn('New case', function () { newCase(ct); }, 'g')])]));
      rc.appendChild(h('dl', { class: 'ag-kv' }, [h('dt', { text: 'ID' }), h('dd', { text: ct.id }), h('dt', { text: 'Phone' }), h('dd', { text: ct.phone + ' (masked)' }), h('dt', { text: 'E-mail' }), h('dd', { text: ct.email + ' (masked)' }),
        h('dt', { text: 'City' }), h('dd', { text: ct.city }), h('dt', { text: 'With us since' }), h('dd', { text: ct.since }), h('dt', { text: 'Profile' }), h('dd', { text: (ct.tier || '—') + ' · ★ ' + (ct.rating || '—') + ' · ' + (ct.stats || '') })]));
      var rt = table(['Record', 'What', 'Amount', 'When']); fill(rt, (ct.records || []).map(function (r) { return { key: r.join(), cells: r }; }), 'No records.');
      rc.appendChild(h('b', { class: 'ag-h3', text: 'Trips, orders, bookings and payouts' })); rc.appendChild(h('div', null, [rt]));
      var ctab = table(['Case', 'Channel', 'Subject', 'State', 'Updated']);
      fill(ctab, cases.map(function (x) { return { key: x.id + x.state, cells: [x.id, badge(x.channel), { wrap: x.subject }, st(STATE_LABEL[x.state], STATE_KIND[x.state]), ago(x.updatedAt)], open: function () { openConv(x); } }; }), 'No conversations yet.');
      rc.appendChild(h('b', { class: 'ag-h3', text: 'Conversations on every channel' })); rc.appendChild(h('div', null, [ctab]));
    } };
  }
  function emailTo(ct) {
    dialog('E-mail ' + ct.name + ' (' + ct.email + ', simulated)', [{ name: 'subject', label: 'Subject', type: 'text' }, { name: 'body', label: 'Message', type: 'textarea' }], 'Send').then(function (v) {
      if (!v) return;
      if (v.subject.trim().length < 3 || v.body.trim().length < 5) { toast('Write a subject and a message.', 'error'); return; }
      var c = newConv({ channel: 'email', contact: ct.id, subject: v.subject.trim(), category: 'Outbound e-mail', state: 'OPEN', assignee: S.me.id });
      c.unread = false; sendReply(c, v.body, 'email', { pending: true }); toast('E-mail sent (simulated).', 'info');
    });
  }
  function newCase(ct) {
    var chans = CH_ORDER.filter(function (x) { return skill(x) && x !== 'call'; });
    if (!chans.length) { toast('The admin has not given you a written channel.', 'error'); return; }
    dialog('New case for ' + ct.name, [{ name: 'ch', label: 'Channel', type: 'select', options: chans.map(function (x) { return [x, chLabel(x)]; }) }, { name: 'subject', label: 'Subject', type: 'text' },
      { name: 'priority', label: 'Priority', type: 'select', options: PRIORITY, value: 'P3' }, { name: 'note', label: 'Internal note', type: 'textarea' }], 'Create case').then(function (v) {
      if (!v) return;
      if (v.subject.trim().length < 3) { toast('Write a subject.', 'error'); return; }
      var c = newConv({ channel: v.ch, contact: ct.id, subject: v.subject.trim(), category: 'Agent created', priority: v.priority, state: 'OPEN', assignee: S.me.id });
      c.unread = false; if (v.note.trim()) addNote(c, v.note); S.sel.case = c.id; go('G08');
    });
  }

  // G10 Knowledge and templates (managed by the admin)
  function buildKb(host) {
    var pg = page(host);
    var bar = h('div', { class: 'ag-row' }); pg.appendChild(bar);
    var srch = h('input', { class: 'ag-inp', type: 'search', placeholder: 'Search articles and templates', 'aria-label': 'Search knowledge' }); srch.value = S.ui.kbq;
    srch.addEventListener('input', function () { S.ui.kbq = srch.value; changed(); });
    var chips = h('span', { class: 'ag-row' }); bar.appendChild(chips); bar.appendChild(srch);
    bar.appendChild(h('span', { class: 'ag-sp ag-small', text: 'Written and approved in the admin portal. Agents cannot edit them.' }));
    var c = card('Articles', [], 'ag-fill ag-scroll'); var body = h('div'); c.appendChild(body); pg.appendChild(c);
    return { update: function () {
      var sig = S.ui.kbTab + S.ui.kbAud + S.ui.kbq + P.version;
      if (body.getAttribute('data-sig') === sig) return;
      body.setAttribute('data-sig', sig); clear(body); clear(chips);
      [['kb', 'Articles'], ['tpl', 'Reply templates']].forEach(function (t) { chips.appendChild(chip(t[1], S.ui.kbTab === t[0], function () { S.ui.kbTab = t[0]; changed(); })); });
      if (S.ui.kbTab === 'kb') ['all', 'customer', 'driver', 'partner'].forEach(function (a) { chips.appendChild(chip(a === 'all' ? 'Everyone' : AUD[a] + 's', S.ui.kbAud === a, function () { S.ui.kbAud = a; changed(); })); });
      text(q('.hd b', c), S.ui.kbTab === 'kb' ? 'Articles' : 'Approved reply templates');
      var qy = S.ui.kbq.trim().toLowerCase();
      if (S.ui.kbTab === 'kb') {
        var arts = P.kb.filter(function (k) { return (S.ui.kbAud === 'all' || k.audience === S.ui.kbAud || k.audience === 'all') && (!qy || (k.title + ' ' + k.body).toLowerCase().indexOf(qy) >= 0); });
        if (!arts.length) body.appendChild(h('div', { class: 'ag-empty', text: 'No articles match.' }));
        arts.forEach(function (k) { body.appendChild(h('div', { class: 'ag-kb' }, [h('div', { class: 'ag-row' }, [h('b', { text: k.title }), st(k.audience === 'all' ? 'Everyone' : AUD[k.audience], 'info')]), h('p', { text: k.body })])); });
      } else {
        var tpls = P.macros.filter(function (m) { return m.on && (!qy || (m.title + ' ' + m.text).toLowerCase().indexOf(qy) >= 0); });
        if (!tpls.length) body.appendChild(h('div', { class: 'ag-empty', text: 'No templates match.' }));
        tpls.forEach(function (m) { body.appendChild(h('div', { class: 'ag-kb' }, [h('div', { class: 'ag-row' }, [h('b', { text: m.title }), h('span', { class: 'ag-sp' }, [btn('Use in my next reply', function () { S.ui.macro = m.text; toast('Template ready: it is filled into the next reply box you open.', 'info'); }, 'g')])]), h('p', { text: m.text })])); });
      }
    } };
  }

  // G11 My performance
  function buildPerf(host) {
    var pg = page(host);
    var kpis = h('div', { class: 'kpis' }); pg.appendChild(kpis);
    var c = card('By channel (this session)', [], 'ag-fill'); var t = table(['Channel', 'Assigned to me', 'Open', 'Resolved', 'Past SLA']); c.appendChild(h('div', null, [t])); pg.appendChild(c);
    return { update: function () {
      var s = S.stats, avg = s.calls ? mmss(s.talkMs / s.calls) : '—', csat = s.csat.length ? (s.csat.reduce(function (a, b) { return a + b; }, 0) / s.csat.length).toFixed(1) + ' / 5' : '—';
      kpiRow(kpis, [['Resolved', s.resolved], ['Replies sent', s.replies], ['Calls answered', s.calls], ['Outbound calls', s.out], ['Avg talk time', avg], ['Missed calls', S.calls.missed, null, S.calls.missed > 0],
        ['First reply in SLA', s.firstAll ? Math.round(100 * s.firstOk / s.firstAll) + '%' : '—'], ['Customer rating', csat]]);
      var mineAll = all().filter(mine);
      fill(t, CH_ORDER.map(function (ch) {
        var l = mineAll.filter(function (x) { return x.channel === ch; });
        return { key: ch + l.length + l.filter(isOpen).length + l.filter(breached).length, cells: [badge(ch), String(l.length), String(l.filter(isOpen).length), String(l.filter(function (x) { return !isOpen(x); }).length), String(l.filter(breached).length)] };
      }));
    } };
  }

  // G12 Team board (supervisors; permission from the admin)
  function buildTeam(host) {
    var pg = page(host);
    if (!R().team) {
      pg.appendChild(h('div', { class: 'rn-state err ag-denied' }, [h('b', { text: 'Team board is for supervisors' }), h('span', { text: 'Your role (' + R().label + ') does not include the team view. The admin portal assigns roles.' })]));
      return {};
    }
    var kpis = h('div', { class: 'kpis' }); pg.appendChild(kpis);
    var grid = h('div', { class: 'ag-grid g-2 ag-fill' }); pg.appendChild(grid);
    var ac = card('Agents'); var at = table(['Agent', 'Role', 'Team', 'Channels', 'Status', 'Open']); ac.appendChild(h('div', null, [at])); grid.appendChild(ac);
    var qc = card('Waiting for an agent'); var qt = table(['Case', 'Channel', 'From', 'Waiting', 'Assign']); qc.appendChild(h('div', null, [qt])); grid.appendChild(qc);
    return { update: function () {
      var w = all().filter(function (c) { return c.state === 'NEW' && !c.assignee; });
      kpiRow(kpis, [['Calls waiting', S.calls.queue.length], ['Unassigned', w.length], ['Past SLA', all().filter(breached).length, null, all().filter(breached).length > 0], ['Active agents', P.agents.filter(function (a) { return a.active; }).length], ['Escalated', all().filter(function (c) { return c.state === 'ESCALATED'; }).length]]);
      fill(at, P.agents.map(function (a) {
        var live = a.id === S.me.id ? STATUS_LABEL[S.status] + ' (you)' : S.peers[a.id] && Date.now() - S.peers[a.id].at < 20000 ? S.peers[a.id].status.replace('_', ' ').toLowerCase() + ' (live)' : a.active ? 'Not signed in here' : 'Suspended by admin';
        var open = all().filter(function (c) { return c.assignee === a.id && isOpen(c); }).length;
        return { key: a.id + live + open + a.role + a.active, cells: [a.name, (P.roles[a.role] || {}).label, a.team, a.channels.map(function (x) { return SHORT[x]; }).join(', '), a.active ? st(live, /available|you/i.test(live) ? 'ok' : /live/.test(live) ? 'info' : '') : st(live, 'err'), String(open)] };
      }));
      fill(qt, w.map(function (c) {
        var s2 = sel([['', 'Assign to…']].concat(P.agents.filter(function (a) { return a.active && a.channels.indexOf(c.channel) >= 0; }).map(function (a) { return [a.id, a.name]; })), '', 'Assign ' + c.id);
        s2.addEventListener('change', function () { if (s2.value) reassign(c, s2.value); });
        return { key: c.id + ago(c.createdAt), cells: [c.id, badge(c.channel), contact(c.contactId).name, ago(c.createdAt), s2] };
      }), 'Nothing is waiting.');
    } };
  }

  // G13 My access (read-only view of what the admin set)
  function buildAccess(host) {
    var pg = page(host);
    var grid = h('div', { class: 'ag-grid g-2' }); pg.appendChild(grid);
    var me = card('My account'); var meBody = h('div'); me.appendChild(meBody); grid.appendChild(me);
    var pol = card('Policy from the admin portal'); var polBody = h('div'); pol.appendChild(polBody); grid.appendChild(pol);
    var chc = card('Channels'); var cht = table(['Channel', 'Admin switch', 'In my skills', 'Reply within', 'Hours']); chc.appendChild(h('div', null, [cht])); grid.appendChild(chc);
    var pc = card('What my role may do'); var pt = table(['Permission', 'Allowed']); pc.appendChild(h('div', null, [pt])); grid.appendChild(pc);
    pg.appendChild(h('p', { class: 'ag-muted', text: 'These settings are read-only here. An administrator changes them in the admin portal (Agent portal control) and publishes them; open portals update at once on the same site, and the agent-policy.js file carries them to the agent portal server.' }));
    return { update: function () {
      var sig = JSON.stringify(P) + S.me.id + policySource + linkUp();
      if (pg.getAttribute('data-sig') === sig) return;
      pg.setAttribute('data-sig', sig);
      clear(meBody); clear(polBody);
      meBody.appendChild(h('dl', { class: 'ag-kv' }, [h('dt', { text: 'Agent' }), h('dd', { text: S.me.id + ' · ' + S.me.name }), h('dt', { text: 'Role' }), h('dd', { text: R().label }), h('dt', { text: 'Team' }), h('dd', { text: S.me.team }),
        h('dt', { text: 'Languages' }), h('dd', { text: S.me.langs || '—' }), h('dt', { text: 'User groups' }), h('dd', { text: S.me.audiences.map(function (a) { return AUD[a] + 's' + (P.audiences[a] ? '' : ' (switched off by admin)'); }).join(', ') || 'None' })]));
      var r = P.routing;
      polBody.appendChild(h('dl', { class: 'ag-kv' }, [h('dt', { text: 'Version' }), h('dd', { text: 'v' + P.version + ' · ' + fmtDate(P.publishedAt) }), h('dt', { text: 'Published by' }), h('dd', { text: P.publishedBy || '—' }),
        h('dt', { text: 'Source' }), h('dd', { text: policySource === 'live' ? 'Live from the admin portal' : 'agent-policy.js deployed with this portal' }), h('dt', { text: 'Admin link' }), h('dd', { text: linkUp() ? 'Connected' : SYNC.available ? 'Waiting for the admin portal (same site)' : 'Not available in this browser' }),
        h('dt', { text: 'Routing' }), h('dd', { text: { skills: 'Skills-based', 'longest-idle': 'Longest idle agent', 'round-robin': 'Round robin' }[r.strategy] + (r.autoAssign ? ' · auto-assign on' : ' · agents pick work') }),
        h('dt', { text: 'Live limit' }), h('dd', { text: r.maxChats + ' chats / social conversations at once' }), h('dt', { text: 'Calls' }), h('dd', { text: 'ring ' + r.ringSecs + ' s · wrap-up ' + r.wrapUpSecs + ' s · numbers masked' + (r.recordCalls ? ' · recorded' : '') })]));
      fill(cht, CH_ORDER.map(function (ch) { var x = P.channels[ch]; return { key: ch + x.on + skill(ch) + x.slaMins + x.hours, cells: [badge(ch), h('span', { class: x.on ? 'ag-yes' : 'ag-no', text: x.on ? 'On' : 'Off' }), h('span', { class: S.me.channels.indexOf(ch) >= 0 ? 'ag-yes' : 'ag-no', text: S.me.channels.indexOf(ch) >= 0 ? 'Yes' : 'No' }), x.slaMins < 60 ? x.slaMins + ' min' : Math.round(x.slaMins / 60) + ' h', x.hours] }; }));
      var ro = R();
      fill(pt, [['Goodwill credit without approval', 'up to ' + rupees(ro.refundLimit)], ['Outbound calls', ro.outbound], ['Reply in public on social media', ro.publicReply], ['Close conversations', ro.close], ['Reassign and take over work', ro.reassign], ['Team board', ro.team], ['Export data', ro.export]].map(function (x) {
        return { key: x.join(), cells: [x[0], typeof x[1] === 'string' ? x[1] : h('span', { class: x[1] ? 'ag-yes' : 'ag-no', text: x[1] ? 'Yes' : 'No' })] };
      }));
    } };
  }

  var PAGES = {
    G02: { title: 'Home', build: buildHome }, G03: { title: 'Unified inbox', build: buildInbox }, G04: { title: 'Calls', build: buildCalls },
    G05: { title: 'E-mail', build: buildEmail }, G06: { title: 'Social media', build: buildSocial }, G07: { title: 'Live chat & in-app', build: buildChat },
    G08: { title: 'Case workspace', build: buildCase }, G09: { title: 'Contacts', build: buildContacts }, G10: { title: 'Knowledge & templates', build: buildKb },
    G11: { title: 'My performance', build: buildPerf }, G12: { title: 'Team board', build: buildTeam }, G13: { title: 'My access (set by admin)', build: buildAccess }
  };

  // ------------------------------------------------------------------ chrome: header, navigation counts, call bar, footer
  function linkUp() { return Date.now() - S.adminAt < 30000; }
  function renderChrome() {
    if (!S.me) return;
    text(q('[data-bind="name"]'), S.me.name); text(q('[data-bind="role"]'), R().label + ' · ' + S.me.team); text(q('[data-bind="initials"]'), initials(S.me.name));
    var ss = q('[data-bind="status"]'); if (document.activeElement !== ss) ss.value = S.status;
    var a = S.calls.active, busy = q('[data-bind="busy"]');
    q('[data-bind="status-dot"]').className = 'ag-dot ' + (a ? 'BUSY' : S.status);
    busy.hidden = !a; if (a) text(busy, { RINGING: 'Call ringing', DIALING: 'Dialling', CONNECTED: 'On a call', HOLD: 'Caller on hold', WRAP: 'Wrap-up' }[a.state]);
    var counts = { all: waiting().length, call: skill('call') ? callsWaiting().length : 0, email: waiting(function (c) { return c.channel === 'email'; }).length,
      social: waiting(function (c) { return SOCIAL.indexOf(c.channel) >= 0; }).length, chat: waiting(function (c) { return c.channel === 'chat' || c.channel === 'app'; }).length };
    qa('[data-count]').forEach(function (n) { var v = counts[n.getAttribute('data-count')] || 0; n.hidden = !v; text(n, String(v)); });
    qa('.dsb a[data-ch]').forEach(function (n) {
      var ch = n.getAttribute('data-ch'), on = ch === 'social' ? SOCIAL.some(skill) : ch === 'chat' ? skill('chat') || skill('app') : skill(ch);
      n.classList.toggle('ag-off', !on); n.title = on ? '' : 'Not enabled for you by the admin';
    });
    qa('.dsb a[data-perm="team"]').forEach(function (n) { n.hidden = !R().team; });
    text(q('[data-bind="policy"]'), 'Policy v' + P.version + (policySource === 'live' ? ' · live from admin' : ' · from agent-policy.js'));
    text(q('[data-bind="link"]'), linkUp() ? 'Admin link: connected' : SYNC.available ? 'Admin link: waiting' : 'Admin link: not available');
    renderCallbar();
  }
  function renderCallbar() {
    var bar = q('[data-bind="callbar"]'), a = S.calls.active;
    if (!a) { bar.hidden = true; bar.removeAttribute('data-sig'); clear(bar); return; }
    bar.hidden = false;
    var sig = a.id + a.state + a.muted;
    if (bar.getAttribute('data-sig') !== sig) {
      bar.setAttribute('data-sig', sig); clear(bar);
      bar.className = 'ag-callbar' + (a.state === 'RINGING' ? ' ag-ring' : a.state === 'WRAP' ? ' ag-wrap' : '');
      var ct = contact(a.contactId);
      bar.appendChild(h('b', { class: a.state === 'RINGING' ? 'ag-pulse' : '', text: { RINGING: 'Incoming call', DIALING: 'Calling', CONNECTED: 'On call', HOLD: 'On hold', WRAP: 'Wrap-up' }[a.state] }));
      bar.appendChild(h('span', { text: ct.name + ' · ' + AUD[ct.type] + ' · ' + (a.dir === 'in' ? 'IVR ' + a.ivr : 'outbound') }));
      bar.appendChild(h('span', { class: 'ag-timer', 'data-bind': 'calltimer' }));
      var acts = h('span', { class: 'ag-row ag-sp' });
      if (a.state === 'RINGING') { acts.appendChild(btn('Answer', answer)); acts.appendChild(btn('Decline', function () { decline(false); }, 'g')); }
      else if (a.state === 'DIALING') acts.appendChild(btn('Cancel', cancelDial, 'g'));
      else if (a.state === 'WRAP') acts.appendChild(btn('Finish wrap-up', function () { go('G04'); }, 'g'));
      else { acts.appendChild(btn(a.muted ? 'Unmute' : 'Mute', toggleMute, 'g')); acts.appendChild(btn(a.state === 'HOLD' ? 'Resume' : 'Hold', toggleHold, 'g')); acts.appendChild(btn('Calls', function () { go('G04'); }, 'g')); acts.appendChild(btn('Hang up', hangUp, 'r')); }
      bar.appendChild(acts);
    }
    var now = Date.now();
    text(q('[data-bind="calltimer"]', bar), a.state === 'RINGING' ? 'rings ' + Math.max(0, Math.ceil((a.ringUntil - now) / 1000)) + ' s' : a.state === 'DIALING' ? mmss(now - a.at) : a.state === 'WRAP' ? mmss(a.wrapUntil - now) + ' left' : mmss(now - a.connectedAt));
  }

  // ------------------------------------------------------------------ router, sign-in, boot
  var current = null;
  function go(id) { if (location.hash === '#/' + id) route(); else location.hash = '#/' + id; }
  function showView(name) { qa('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; }); fit(); }
  function route() {
    var id = (location.hash.match(/^#\/(G\d\d)/) || [])[1];
    if (!S.me) {
      showView('login'); current = null;
      if (id !== 'G01') history.replaceState(null, '', '#/G01');
      document.title = 'Agent sign-in · ' + BRAND + ' Agent portal';
      return;
    }
    if (!PAGES[id]) { id = 'G02'; history.replaceState(null, '', '#/G02'); }
    S.route = id; showView('desk');
    var host = q('[data-bind="page"]'); clear(host); host.scrollTop = 0;
    current = PAGES[id].build(host) || {};
    qa('.dsb a[data-route]').forEach(function (a) { var on = a.getAttribute('data-route') === id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    text(q('[data-bind="title"]'), PAGES[id].title);
    document.title = PAGES[id].title + ' · ' + BRAND + ' Agent portal';
    render(); presence();
  }
  function render() { if (!S.me) return; renderChrome(); if (current && current.update) current.update(); }
  function fillLogin() {
    var s = q('#ag-agent'), keep = s.value; clear(s);
    P.agents.forEach(function (a) { s.appendChild(h('option', { value: a.id, text: a.id + ' · ' + a.name + ' · ' + (P.roles[a.role] || {}).label + ' · ' + a.team + (a.active ? '' : ' (suspended)') })); });
    if (keep && agent(keep)) s.value = keep;
    text(q('[data-bind="democode"]'), P.demoCode);
    text(q('[data-bind="policy-line"]'), 'Access policy v' + P.version + ' · published ' + fmtDate(P.publishedAt) + (P.publishedBy ? ' by ' + P.publishedBy : '') + (policySource === 'live' ? ' · live from the admin portal' : ''));
  }
  function fieldErr(name, msg) { var e = q('[data-err="' + name + '"]'), i = q('[name="' + name + '"]'); if (e) { e.hidden = !msg; text(e, msg || ''); } if (i) { if (msg) { i.setAttribute('aria-invalid', 'true'); i.focus(); } else i.removeAttribute('aria-invalid'); } }
  function signIn(ev) {
    ev.preventDefault();
    fieldErr('agent', ''); fieldErr('code', '');
    var a = agent(q('#ag-agent').value), code = q('#ag-code').value.trim();
    if (!a) { fieldErr('agent', 'Choose your agent account.'); return; }
    if (!a.active) { fieldErr('agent', 'This account is suspended by an administrator. Contact your supervisor.'); return; }
    if (!/^\d{6}$/.test(code)) { fieldErr('code', 'Enter the 6-digit code.'); return; }
    if (code !== P.demoCode) { fieldErr('code', 'That code is not correct.'); return; }
    q('#ag-code').value = '';
    S.me = a; S.status = 'AVAILABLE'; S.statusAt = Date.now(); S.nextIn = Date.now() + 15000;
    // conversations the demo hands to "the agent who signs in" go to the first agent whose channels fit, else to a teammate
    all().forEach(function (c) {
      if (c.assignee !== 'SELF') return;
      var to = canTake(c) ? a.id : peerFor(c.channel, contact(c.contactId).type) || 'AG-104';
      c.assignee = to; c.msgs.forEach(function (m) { if (m.by === 'SELF') m.by = to; });
    });
    toast('Signed in as ' + a.name + ' (' + R().label + '). Channels, limits and templates come from the admin portal.', 'info');
    hubSignIn(a);
    SYNC.send('hello', { agentId: a.id });
    go('G02');
  }
  function signOut(forced) {
    if (!S.me) return;
    var a = S.calls.active;
    if (!forced && a && ['CONNECTED', 'HOLD', 'WRAP', 'DIALING'].indexOf(a.state) >= 0) { toast('Finish the call and the wrap-up before signing out.', 'error'); return; }
    if (a && a.state === 'RINGING') S.calls.queue.unshift({ id: a.id, contactId: a.contactId, ivr: a.ivr, subject: a.subject, since: a.since });
    else if (a) endCall('Ended by sign-out');
    S.calls.active = null;
    SYNC.send('bye', { agentId: S.me.id });
    hubRun('agent.signOut', {});
    S.me = null; S.status = 'OFFLINE'; persist();
    q('[data-bind="banner"]').hidden = true;
    history.replaceState(null, '', '#/G01'); route();
  }
  function fit() {
    // below 1024 px the workspace is scaled down instead of being cut off (CSS zoom set through the CSSOM)
    var stage = q('#app-stage'), w = stage.clientWidth;
    qa('#app-stage > .desk').forEach(function (d) {
      d.style.zoom = ''; d.style.height = '';
      if (!d.hidden && w && w < 1024) { var z = w / 1024; d.style.zoom = z.toFixed(4); d.style.height = Math.floor(stage.clientHeight / z) + 'px'; }
    });
  }
  function tick() {
    var now = Date.now();
    var due = S.timers.filter(function (t) { return t.at <= now; });
    S.timers = S.timers.filter(function (t) { return t.at > now; });
    due.forEach(function (t) { try { t.fn(); } catch (err) { /* a timer must not stop the clock */ } });
    if (!S.me) return;
    if (now >= S.nextIn) { spawn(); S.nextIn = now + 25000 + Math.random() * 20000; }
    var a = S.calls.active;
    if (a && a.state === 'RINGING' && now > a.ringUntil) decline(true);
    else if (a && a.state === 'WRAP' && now > a.wrapUntil) finishWrap('', '', false, true);
    offerCall(); teammates(now); hubPoll();
    if (now - S.presenceAt > 5000) presence();
    render();
  }
  function boot() {
    var saved = restore(); if (!saved) seed(); fillLogin();
    qa('.brandname').forEach(function (n) { n.textContent = BRAND; });
    q('[data-form="signin"]').addEventListener('submit', signIn);
    q('[data-act="signout"]').addEventListener('click', function (e) { e.preventDefault(); signOut(false); });
    q('[data-bind="status"]').addEventListener('change', function (e) { setStatus(e.target.value); });
    var hs = q('[data-bind="search"]');
    hs.addEventListener('keydown', function (e) { if (e.key === 'Enter') { S.ui.search = hs.value; S.ui.scope = 'all'; S.ui.state = 'all'; go('G03'); } });
    qa('.dsb a[data-route]').forEach(function (a) { a.addEventListener('click', function (e) { if (a.classList.contains('ag-off')) toast('This channel is not enabled for you by the admin. You can still read your own conversations here.', 'warn'); }); });
    window.addEventListener('hashchange', route);
    window.addEventListener('resize', fit);
    window.addEventListener('pagehide', function () { if (S.me) SYNC.send('bye', { agentId: S.me.id }); });
    try { if (window.parent !== window && window.parent.RN_HUB) { window.parent.RN_HUB.register('support', window); window.addEventListener('pagehide', function () { window.parent.RN_HUB.unregister('support', window); }); } } catch (err) { /* not inside the connected demo */ }
    SYNC.send('hello', {});
    if (saved && saved.me && saved.until > Date.now()) { var ra = agent(saved.me); if (ra && ra.active) { S.me = ra; S.status = saved.status && saved.status !== 'OFFLINE' ? saved.status : 'AVAILABLE'; S.statusAt = Date.now(); S.nextIn = Date.now() + 15000; hubSignIn(ra); SYNC.send('hello', { agentId: ra.id }); if (!/^#\/G(0[2-9]|1\d)/.test(location.hash)) history.replaceState(null, '', '#/G02'); } }
    route();
    setInterval(tick, 1000);
    setInterval(persist, 5000);
    window.addEventListener('pagehide', persist);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
