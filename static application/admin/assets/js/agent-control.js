/* RideNova – Admin portal → Agent portal control (A31).
   The admin owns the agent portal: agent accounts, roles and limits, channels and routing, reply templates, knowledge
   articles and announcements. Changes are collected in a draft and published as a new policy version:
     * live to agent-portal tabs open on the same site (agent-sync.js, BroadcastChannel), and
     * as a file (Download agent-policy.js) to copy into agent-portal/assets/js/ on the agent portal server.
   Publishing and remote sign-out are permission-checked (agentdesk.manage) and written to the audit log (A19).
   Synthetic demo data in memory; a browser cannot enforce anything – the backend of the next phase must. */
(function () {
  'use strict';
  var RN = window.RN || {}, UI = RN.ui, SYNC = RN.agentSync, K = RN.kit;
  if (!UI || !SYNC || !K || !window.RN_AGENT_POLICY) return;

  var BASE = SYNC.cleanPolicy(window.RN_AGENT_POLICY, window.RN_AGENT_POLICY);
  var M = { published: SYNC.clone(BASE), draft: SYNC.clone(BASE), tab: 'monitor', presence: {}, history: [] };
  var PERM = 'agentdesk.manage';
  var TABS = [['monitor', 'Live monitor'], ['agents', 'Agents'], ['channels', 'Channels & routing'], ['roles', 'Roles & limits'],
    ['content', 'Templates & knowledge'], ['ann', 'Announcements'], ['publish', 'Publish']];
  var AUD = { customer: 'Customers', driver: 'Drivers', partner: 'Partners' };
  var SHORT = { call: 'Calls', email: 'E-mail', chat: 'Chat', app: 'In-app', whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', x: 'X' };
  var STATUS = { AVAILABLE: ['Available', 'ok'], ON_CALL: ['On a call', 'info'], RINGING: ['Ringing', 'info'], WRAP_UP: ['Wrap-up', 'info'],
    BREAK: ['On break', 'warn'], TRAINING: ['Training', 'warn'], AWAY: ['Away', 'warn'], OFFLINE: ['Signed out', ''] };
  var ONLINE_MS = 15000;

  // ------------------------------------------------------------------ small DOM helpers (no HTML strings)
  function h(tag, attrs, kids) {
    var hasText = !!attrs && attrs.text != null;
    var n = UI.el(tag, hasText ? omit(attrs, 'text') : attrs, hasText ? String(attrs.text) : null);
    [].concat(kids || []).forEach(function (k) { if (k == null || k === false) return; n.appendChild(k.nodeType ? k : document.createTextNode(String(k))); });
    return n;
  }
  function omit(o, key) { var r = {}; Object.keys(o).forEach(function (k) { if (k !== key) r[k] = o[k]; }); return r; }
  function btn(label, fn, cls, attrs) {
    var b = h('button', Object.assign({ type: 'button', class: 'dbtn ' + (cls || '') }, attrs || {}), [label]);
    b.addEventListener('click', function () { if (!b.disabled) fn(b); });
    return b;
  }
  function st(t, k) { return h('span', { class: 'st ' + (k || ''), text: t }); }
  function card(title, body, right) { return h('div', { class: 'dcard' }, [h('div', { class: 'hd' }, [h('b', { text: title }), h('span', { class: 'sp' }), right || null])].concat(body)); }
  function table(head, rows, empty) {
    var tb = h('tbody');
    rows.forEach(function (r) { tb.appendChild(h('tr', null, r.map(function (c) { return h('td', null, [c]); }))); });
    if (!rows.length) tb.appendChild(h('tr', null, [h('td', { colspan: String(head.length), class: 'agc-empty', text: empty || 'Nothing here yet.' })]));
    return h('table', { class: 'dt' }, [h('thead', null, [h('tr', null, head.map(function (t) { return h('th', { text: t }); }))]), tb]);
  }
  function check(label, on, fn, disabled) {
    var i = h('input', { type: 'checkbox', 'aria-label': label });
    i.checked = !!on; i.disabled = !!disabled;
    i.addEventListener('change', function () { fn(i.checked); });
    return i;
  }
  function numIn(label, val, lo, hi, fn) {
    var i = h('input', { type: 'number', class: 'agc-num', min: String(lo), max: String(hi), value: String(val), 'aria-label': label });
    i.addEventListener('change', function () {
      var n = Math.round(Number(i.value));
      if (!isFinite(n) || n < lo || n > hi) { UI.toast(label + ' must be between ' + lo + ' and ' + hi + '.', 'error'); i.value = String(val); return; }
      val = n; fn(n);
    });
    return i;
  }
  function txtIn(label, val, max, fn, cls) {
    var i = h('input', { type: 'text', class: 'agc-txt ' + (cls || ''), maxlength: String(max), value: val, 'aria-label': label });
    i.addEventListener('change', function () { var v = i.value.trim(); if (!v) { UI.toast(label + ' cannot be empty.', 'error'); i.value = val; return; } val = v; fn(v); });
    return i;
  }
  function select(label, options, val, fn) {
    var s = h('select', { class: 'agc-sel', 'aria-label': label });
    options.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); });
    s.value = val;
    s.addEventListener('change', function () { fn(s.value); });
    return s;
  }
  // modal form: fields [{name, label, type: text|textarea|select|checks|number, value, options, max}] → Promise(values|null)
  function form(title, fields, okLabel) {
    return new Promise(function (resolve) {
      var d = h('dialog', { class: 'rn-dialog agc-dialog', 'aria-label': title });
      d.appendChild(h('p', { class: 'agc-dtitle', text: title }));
      var get = {};
      fields.forEach(function (f) {
        var lab = h('label', { class: 'rn-f block' }, [f.label]), input;
        if (f.type === 'textarea') { input = h('textarea', { rows: '4', maxlength: String(f.max || 1000) }); input.value = f.value || ''; }
        else if (f.type === 'select') { input = h('select'); f.options.forEach(function (o) { input.appendChild(h('option', { value: o[0], text: o[1] })); }); input.value = f.value; }
        else if (f.type === 'checks') {
          input = h('span', { class: 'agc-checks' });
          f.options.forEach(function (o) {
            var c = h('input', { type: 'checkbox', value: o[0] }); c.checked = (f.value || []).indexOf(o[0]) >= 0;
            input.appendChild(h('label', { class: 'agc-check' }, [c, ' ' + o[1]]));
          });
          get[f.name] = function () { return Array.prototype.filter.call(input.querySelectorAll('input'), function (c) { return c.checked; }).map(function (c) { return c.value; }); };
        } else { input = h('input', { type: f.type === 'number' ? 'number' : 'text', maxlength: String(f.max || 80), value: f.value == null ? '' : String(f.value) }); }
        if (!get[f.name]) get[f.name] = function () { return input.value.trim(); };
        lab.appendChild(input); d.appendChild(lab);
      });
      var err = h('p', { class: 'agc-err', role: 'alert' }); err.hidden = true; d.appendChild(err);
      var no = h('button', { type: 'button', class: 'rn-dbtn', text: 'Cancel' }), yes = h('button', { type: 'button', class: 'rn-dbtn primary', text: okLabel || 'Save' });
      d.appendChild(h('div', { class: 'rn-dialog-row' }, [no, yes]));
      document.body.appendChild(d);
      function done(v) { d.close(); d.remove(); resolve(v); }
      no.addEventListener('click', function () { done(null); });
      d.addEventListener('cancel', function (e) { e.preventDefault(); done(null); });
      yes.addEventListener('click', function () {
        var v = {}; Object.keys(get).forEach(function (k) { v[k] = get[k](); });
        var missing = fields.filter(function (f) { return f.required && (!v[f.name] || (Array.isArray(v[f.name]) && !v[f.name].length)); })[0];
        if (missing) { err.textContent = missing.label + ' is required.'; err.hidden = false; return; }
        done(v);
      });
      d.showModal(); var first = d.querySelector('input,select,textarea'); if (first) first.focus();
    });
  }

  // ------------------------------------------------------------------ draft, permission, publishing
  var SECTIONS = [['agents', 'Agent accounts'], ['channels', 'Channels'], ['audiences', 'Who is supported'], ['routing', 'Routing'], ['roles', 'Roles & limits'],
    ['macros', 'Reply templates'], ['kb', 'Knowledge articles'], ['dispositions', 'Dispositions'], ['escalations', 'Escalation teams'], ['announcements', 'Announcements'], ['demoCode', 'Agent sign-in code']];
  function changes() {
    return SECTIONS.filter(function (s) { return JSON.stringify(M.draft[s[0]]) !== JSON.stringify(M.published[s[0]]); }).map(function (s) { return s[1]; });
  }
  function admin() { return UI.engine.state.session.admin; }
  function canManage() { return RN.rbac.can(admin().role, PERM); }
  function by() { return 'Admin ' + admin().adminId + ' · ' + RN.rbac.LABELS[admin().role]; }
  function edited(full) { refreshBar(); if (full) renderTab(); }
  function guard(label, event, el) {
    // audited permission check through the engine (allowed and denied attempts both go to the audit log)
    return UI.exec('admin.action', { perm: PERM, label: label, event: event, target: 'A31' }, { el: el }).then(function (r) { return r.ok; });
  }
  function publish(el) {
    var ch = changes();
    if (!ch.length) { UI.toast('Nothing to publish: the draft is the same as policy v' + M.published.version + '.', 'info'); return Promise.resolve(false); }
    if (!M.draft.agents.some(function (a) { return a.active; })) { UI.toast('At least one agent account must stay active.', 'error'); return Promise.resolve(false); }
    if (!Object.keys(M.draft.channels).some(function (k) { return M.draft.channels[k].on; })) { UI.toast('At least one channel must stay on.', 'error'); return Promise.resolve(false); }
    return guard('publish agent portal policy v' + (M.published.version + 1) + ' (' + ch.join(', ') + ')', 'agentdesk.policy_published', el).then(function (ok) {
      if (!ok) return false;
      var p = SYNC.clone(M.draft);
      p.version = M.published.version + 1; p.publishedAt = new Date().toISOString(); p.publishedBy = by();
      M.published = SYNC.cleanPolicy(p, BASE); M.draft = SYNC.clone(M.published);
      M.history.unshift({ at: Date.now(), version: M.published.version, by: M.published.publishedBy, what: ch.join(', ') });
      SYNC.send('policy', { policy: M.published, by: M.published.publishedBy });
      UI.toast('Policy v' + M.published.version + ' published. Agent portals open on this site follow it now; download agent-policy.js for the agent portal server.', 'info');
      edited(true);
      return true;
    });
  }
  function discard() {
    if (!changes().length) return;
    UI.confirm('Discard the unpublished changes (' + changes().join(', ') + ')?', 'Discard').then(function (y) { if (y) { M.draft = SYNC.clone(M.published); edited(true); } });
  }
  function policyFile(p) {
    return '/* RideNova – agent portal policy v' + p.version + ', published ' + p.publishedAt + ' by ' + p.publishedBy.replace(/\*\//g, '') + '.\n' +
      '   OWNED BY THE ADMIN PORTAL (Agent portal control, A31). Copy this file to agent-portal/assets/js/agent-policy.js on the\n' +
      '   agent portal server. Synthetic demo values; the backend of the next phase must enforce these rules. */\n' +
      'window.RN_AGENT_POLICY = ' + JSON.stringify(p, null, 2) + ';\n';
  }
  function download() {
    var blob = new Blob([policyFile(M.published)], { type: 'text/javascript' });
    var url = URL.createObjectURL(blob), a = h('a', { href: url, download: 'agent-policy.js' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    UI.toast('agent-policy.js (v' + M.published.version + ') downloaded. Copy it into agent-portal/assets/js/ on the agent portal server.', 'info');
  }
  function signOutAgent(id, el) {
    var a = M.published.agents.filter(function (x) { return x.id === id; })[0];
    return UI.prompt('Sign ' + (a ? a.name : id) + ' out of the agent portal now? Their open conversations go back to the queue.', 'Reason (shown to the agent)', 'Signed out by an administrator').then(function (reason) {
      if (reason == null) return false;
      return guard('sign out agent ' + id, 'agentdesk.agent_signed_out', el).then(function (ok) {
        if (!ok) return false;
        SYNC.send('signout', { agentId: id, reason: String(reason).slice(0, 160) });
        if (M.presence[id]) M.presence[id].d.status = 'OFFLINE';
        UI.toast(id + ' signed out of the agent portal.', 'info');
        renderTab();
        return true;
      });
    });
  }

  // ------------------------------------------------------------------ live link with the agent portals
  SYNC.on(function (type, d) {
    if (type === 'hello') { SYNC.send('policy', { policy: M.published, by: M.published.publishedBy }); SYNC.send('presence-request', {}); }
    else if (type === 'presence' && /^AG-\d{3,5}$/.test(d.agentId || '')) M.presence[d.agentId] = { d: d, at: Date.now() };
    else if (type === 'bye' && M.presence[d.agentId]) { M.presence[d.agentId].d.status = 'OFFLINE'; M.presence[d.agentId].at = Date.now(); }
    else return;
    if (UI.sid === 'A31' && M.tab === 'monitor') renderTab();
  });
  setInterval(function () {
    SYNC.send('presence-request', {});
    if (UI.sid === 'A31' && M.tab === 'monitor') renderTab();
  }, 5000);
  function online(id) { var p = M.presence[id]; return p && Date.now() - p.at < ONLINE_MS && p.d.status !== 'OFFLINE'; }

  // ------------------------------------------------------------------ rendering
  var host = null, bar = null, body = null;
  function mount() {
    var dc = UI.q('#mock .dc'); if (!dc) return false;
    UI.clear(dc);
    var tabs = h('div', { class: 'dtabs agc-tabs', role: 'tablist', 'aria-label': 'Agent portal control' });
    TABS.forEach(function (t) {
      var s = h('span', { role: 'tab', tabindex: '0', 'data-tab': t[0], 'aria-selected': String(M.tab === t[0]), class: M.tab === t[0] ? 'on' : '', text: t[1] });
      var go = function () { M.tab = t[0]; UI.qa('[data-tab]', tabs).forEach(function (x) { var on = x.getAttribute('data-tab') === M.tab; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); }); renderTab(); };
      s.addEventListener('click', go);
      s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      tabs.appendChild(s);
    });
    bar = h('div', { class: 'agc-bar', 'aria-live': 'polite' });
    body = h('div', { class: 'agc-body', role: 'tabpanel' });
    host = h('div', { class: 'agc', 'data-agentctl': '' }, [bar, tabs, body]);
    dc.appendChild(host);
    refreshBar(); renderTab();
    return true;
  }
  function refreshBar() {
    if (!bar) return;
    UI.clear(bar);
    var ch = changes(), url = (window.RN_CONFIG && window.RN_CONFIG.apps && window.RN_CONFIG.apps.support) || '';
    bar.appendChild(h('span', { class: 'agc-ver' }, [h('b', { text: 'Published policy v' + M.published.version }), ' · ' + fmt(M.published.publishedAt) + ' · ' + M.published.publishedBy]));
    bar.appendChild(ch.length ? st(ch.length + ' unpublished change' + (ch.length > 1 ? 's' : '') + ': ' + ch.join(', '), 'warn') : st('Draft = published', 'ok'));
    bar.appendChild(h('span', { class: 'sp' }));
    if (!canManage()) bar.appendChild(st('Read only · your role (' + RN.rbac.LABELS[admin().role] + ') cannot manage the agent portal', 'err'));
    if (ch.length) bar.appendChild(btn('Discard', discard, 'g'));
    bar.appendChild(btn('Publish to agents', function (b) { publish(b); }, '', { 'data-agc': 'publish' }));
    if (url) { var a = h('a', { class: 'dbtn g', href: url, target: '_blank', rel: 'noopener', text: 'Open the agent portal' }); bar.appendChild(a); }
  }
  function fmt(iso) { var d = new Date(iso); return isNaN(d) ? String(iso || '') : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function ro() { return !canManage(); }
  function renderTab() {
    if (!body || !document.body.contains(body)) return;
    UI.clear(body);
    ({ monitor: tabMonitor, agents: tabAgents, channels: tabChannels, roles: tabRoles, content: tabContent, ann: tabAnn, publish: tabPublish })[M.tab]();
  }

  // ---- live monitor
  function tabMonitor() {
    var D = M.draft, P = M.published, live = P.agents.filter(function (a) { return online(a.id); });
    var sum = function (k) { return live.reduce(function (n, a) { return n + (Number(M.presence[a.id].d.waiting && M.presence[a.id].d.waiting[k]) || 0); }, 0); };
    var breached = live.reduce(function (n, a) { return n + (Number(M.presence[a.id].d.breached) || 0); }, 0);
    var kpi = function (l, v, alert) { return h('div', { class: 'kpi' + (alert ? ' alert' : '') }, [h('span', { class: 'l', text: l }), h('span', { class: 'v', text: String(v) })]); };
    var onCalls = live.filter(function (a) { return /ON_CALL|RINGING|WRAP_UP/.test(M.presence[a.id].d.status); }).length;
    body.appendChild(h('div', { class: 'kpis' }, [kpi('Agents signed in', live.length + ' / ' + P.agents.filter(function (a) { return a.active; }).length + (onCalls ? ' · ' + onCalls + ' on calls' : '')),
      kpi('Calls waiting', sum('call')), kpi('E-mails waiting', sum('email')), kpi('Chats waiting', sum('chat')), kpi('Social waiting', sum('social')), kpi('Past SLA', breached, breached > 0)]));
    var rows = D.agents.map(function (a) {
      var p = online(a.id) ? M.presence[a.id].d : null, s = STATUS[p ? p.status : 'OFFLINE'] || [p.status, 'info'];
      var stale = p && p.policyVersion !== P.version;
      return [h('b', { text: a.name }), a.id, (P.roles[a.role] || {}).label || a.role, a.team, a.active ? st(s[0], s[1]) : st('Suspended', 'err'),
        p ? (p.page || '—') : '—', p ? String(p.open) : '—', p ? String(p.live) : '—', p ? String(p.calls || 0) + ' / ' + String(p.handled || 0) : '—',
        p ? (stale ? st('v' + p.policyVersion + ' · old', 'warn') : st('v' + p.policyVersion, 'ok')) : '—',
        p ? btn('Sign out', function (b) { signOutAgent(a.id, b); }, 'r', { disabled: ro() || null }) : '—'];
    });
    body.appendChild(card('Agents', [table(['Agent', 'ID', 'Role', 'Team', 'Status', 'Working on', 'Open', 'Live', 'Calls / resolved', 'Policy', ''], rows)],
      h('span', { class: 'agc-note', text: SYNC.available ? 'Live from agent portals open on this site · refreshed every 5 s' : 'Live link not available in this browser' })));
    body.appendChild(h('p', { class: 'agc-note' }, ['Agent portals report their status here while they run on the same site (same server address) as this admin portal. ',
      'On separate servers the live link is not available: publish, download agent-policy.js and deploy it with the agent portal. ',
      'Signing an agent out returns their open conversations to the queue.']));
  }

  // ---- agents
  function nextId() { var n = M.draft.agents.reduce(function (m, a) { return Math.max(m, Number(a.id.slice(3))); }, 100); return 'AG-' + (n + 1); }
  var CH_OPTS = function () { return SYNC.CHANNELS.map(function (k) { return [k, M.draft.channels[k].label]; }); };
  var ROLE_OPTS = function () { return SYNC.ROLES.map(function (k) { return [k, M.draft.roles[k].label]; }); };
  function editAgent(a) {
    var isNew = !a;
    a = a || { id: nextId(), name: '', role: 'L1', team: 'Customer care', channels: ['call', 'email', 'chat', 'app'], audiences: ['customer'], langs: 'English', active: true };
    form((isNew ? 'New agent account ' : 'Edit agent ') + a.id, [
      { name: 'name', label: 'Name', value: a.name, required: true, max: 60 },
      { name: 'role', label: 'Role', type: 'select', value: a.role, options: ROLE_OPTS() },
      { name: 'team', label: 'Team', value: a.team, required: true, max: 60 },
      { name: 'channels', label: 'Channels this agent works in', type: 'checks', value: a.channels, options: CH_OPTS(), required: true },
      { name: 'audiences', label: 'Supports', type: 'checks', value: a.audiences, options: SYNC.AUDIENCES.map(function (k) { return [k, AUD[k]]; }), required: true },
      { name: 'langs', label: 'Languages', value: a.langs, max: 80 }
    ], isNew ? 'Add agent' : 'Save').then(function (v) {
      if (!v) return;
      var rec = { id: a.id, name: v.name, role: v.role, team: v.team, channels: v.channels, audiences: v.audiences, langs: v.langs, active: a.active };
      if (isNew) M.draft.agents.push(rec); else M.draft.agents = M.draft.agents.map(function (x) { return x.id === a.id ? rec : x; });
      UI.toast((isNew ? 'Agent ' + rec.id + ' added' : rec.id + ' updated') + ' in the draft. Publish to apply it.', 'info');
      edited(true);
    });
  }
  function tabAgents() {
    var D = M.draft;
    var rows = D.agents.map(function (a) {
      return [h('b', { text: a.name }), a.id, (D.roles[a.role] || {}).label, a.team,
        a.channels.length === SYNC.CHANNELS.length ? 'All channels' : a.channels.map(function (k) { return SHORT[k]; }).join(', '),
        a.audiences.length === SYNC.AUDIENCES.length ? 'Everyone' : a.audiences.map(function (k) { return AUD[k]; }).join(', '),
        h('span', { class: 'agc-clip agc-langs', title: a.langs, text: a.langs }),
        a.active ? st('Active', 'ok') : st('Suspended', 'err'),
        h('span', { class: 'agc-acts' }, [btn('Edit', function () { editAgent(a); }, 'g', { disabled: ro() || null }),
          btn(a.active ? 'Suspend' : 'Activate', function () {
            if (a.active && online(a.id)) UI.toast(a.name + ' is signed in. After you publish, the agent portal signs them out.', 'warn');
            a.active = !a.active; edited(true);
          }, a.active ? 'r' : '', { disabled: ro() || null })])];
    });
    body.appendChild(card('Agent accounts', [table(['Name', 'ID', 'Role', 'Team', 'Channels', 'Supports', 'Languages', 'Account', ''], rows)],
      btn('Add agent', function () { editAgent(null); }, '', { disabled: ro() || null })));
    var code = h('input', { type: 'text', class: 'agc-txt agc-code', inputmode: 'numeric', maxlength: '6', value: D.demoCode, 'aria-label': 'Agent sign-in code (demo)', disabled: ro() || null });
    code.addEventListener('change', function () {
      if (!/^\d{6}$/.test(code.value)) { UI.toast('The sign-in code must be 6 digits.', 'error'); code.value = D.demoCode; return; }
      D.demoCode = code.value; edited(false);
    });
    body.appendChild(card('Agent sign-in', [h('div', { class: 'agc-row' }, [h('label', { class: 'rn-f' }, ['Demo sign-in code ', code]),
      h('span', { class: 'agc-note', text: 'Production uses single sign-on with MFA; this 6-digit code only exists in the demo. Suspended accounts cannot sign in.' })])]));
  }

  // ---- channels & routing
  function tabChannels() {
    var D = M.draft, R = D.routing;
    var rows = SYNC.CHANNELS.map(function (k) {
      var c = D.channels[k];
      return [h('b', { text: c.label }), check(c.label + ' on', c.on, function (v) { c.on = v; edited(false); }, ro()),
        numIn(c.label + ' first-reply target (minutes)', c.slaMins, 1, 10080, function (v) { c.slaMins = v; edited(false); }),
        txtIn(c.label + ' opening hours', c.hours, 40, function (v) { c.hours = v; edited(false); }),
        String(D.agents.filter(function (a) { return a.active && a.channels.indexOf(k) >= 0; }).length)];
    });
    body.appendChild(card('Channels', [table(['Channel', 'On', 'First reply target (min)', 'Hours', 'Active agents'], rows),
      h('p', { class: 'agc-note', text: 'A channel that is off disappears from every agent portal: no new conversations, and replies on it are refused.' })]));
    var aud = h('div', { class: 'agc-row' }, SYNC.AUDIENCES.map(function (k) {
      return h('label', { class: 'agc-check' }, [check('Support ' + AUD[k], D.audiences[k], function (v) { D.audiences[k] = v; edited(false); }, ro()), ' ' + AUD[k]]);
    }));
    var routing = h('div', { class: 'agc-form' }, [
      h('label', { class: 'rn-f' }, ['Routing ', select('Routing strategy', [['skills', 'By skills (channel, audience, language)'], ['longest-idle', 'Longest idle agent'], ['round-robin', 'Round robin']], R.strategy, function (v) { R.strategy = v; edited(false); })]),
      h('label', { class: 'agc-check' }, [check('Assign new conversations automatically', R.autoAssign, function (v) { R.autoAssign = v; edited(false); }, ro()), ' Assign new conversations automatically']),
      h('label', { class: 'rn-f' }, ['Live conversations per agent ', numIn('Live conversations per agent', R.maxChats, 1, 10, function (v) { R.maxChats = v; edited(false); })]),
      h('label', { class: 'rn-f' }, ['Ring time (s) ', numIn('Ring time in seconds', R.ringSecs, 5, 120, function (v) { R.ringSecs = v; edited(false); })]),
      h('label', { class: 'rn-f' }, ['Wrap-up time (s) ', numIn('Wrap-up time in seconds', R.wrapUpSecs, 0, 600, function (v) { R.wrapUpSecs = v; edited(false); })]),
      h('label', { class: 'agc-check' }, [check('Record calls for quality', R.recordCalls, function (v) { R.recordCalls = v; edited(false); }, ro()), ' Record calls for quality (simulated)']),
      h('label', { class: 'agc-check' }, [check('Mask phone numbers and e-mail addresses', true, function () {}, true), ' Mask phone numbers and e-mail addresses (always on)'])]);
    body.appendChild(h('div', { class: 'agc-grid' }, [card('Who the agents support', [aud]), card('Routing', [routing])]));
    if (ro()) UI.qa('input,select', body).forEach(function (i) { i.disabled = true; });
  }

  // ---- roles
  function tabRoles() {
    var D = M.draft, FL = [['outbound', 'Outbound calls'], ['publicReply', 'Public social replies'], ['close', 'Close cases'], ['reassign', 'Reassign'], ['team', 'Team view'], ['export', 'Export']];
    var rows = SYNC.ROLES.map(function (k) {
      var r = D.roles[k];
      return [h('b', { text: k }), txtIn(k + ' role name', r.label, 40, function (v) { r.label = v; edited(false); }),
        numIn(k + ' goodwill credit limit (₹)', r.refundLimit, 0, 100000, function (v) { r.refundLimit = v; edited(false); })]
        .concat(FL.map(function (f) { return check(k + ' ' + f[1], r[f[0]], function (v) { r[f[0]] = v; edited(false); }, ro()); }));
    });
    body.appendChild(card('What each agent role may do', [table(['Role', 'Name', 'Credit limit (₹)'].concat(FL.map(function (f) { return f[1]; })), rows),
      h('p', { class: 'agc-note', text: 'Credit above the role limit is not issued by the agent: the agent portal escalates it to the Finance team. Agents cannot change their own role or limits.' })]));
    if (ro()) UI.qa('input,select', body).forEach(function (i) { i.disabled = true; });
  }

  // ---- templates, knowledge, dispositions, escalations
  function nextKey(list, prefix) { return prefix + (list.reduce(function (m, x) { return Math.max(m, Number(String(x.id).slice(1)) || 0); }, 0) + 1); }
  function editMacro(m) {
    var isNew = !m; m = m || { id: nextKey(M.draft.macros, 'M'), title: '', text: '', on: true };
    form((isNew ? 'New reply template ' : 'Edit template ') + m.id, [{ name: 'title', label: 'Title', value: m.title, required: true, max: 80 },
      { name: 'text', label: 'Text sent to the customer, driver or partner', type: 'textarea', value: m.text, required: true, max: 1000 }]).then(function (v) {
      if (!v) return;
      var rec = { id: m.id, title: v.title, text: v.text, on: m.on };
      if (isNew) M.draft.macros.push(rec); else M.draft.macros = M.draft.macros.map(function (x) { return x.id === m.id ? rec : x; });
      edited(true);
    });
  }
  function editKb(k) {
    var isNew = !k; k = k || { id: nextKey(M.draft.kb, 'K'), audience: 'all', title: '', body: '' };
    form((isNew ? 'New knowledge article ' : 'Edit article ') + k.id, [{ name: 'title', label: 'Title', value: k.title, required: true, max: 120 },
      { name: 'audience', label: 'For', type: 'select', value: k.audience, options: [['all', 'Everyone'], ['customer', 'Customers'], ['driver', 'Drivers'], ['partner', 'Partners']] },
      { name: 'body', label: 'Guidance for agents', type: 'textarea', value: k.body, required: true, max: 2000 }]).then(function (v) {
      if (!v) return;
      var rec = { id: k.id, audience: v.audience, title: v.title, body: v.body };
      if (isNew) M.draft.kb.push(rec); else M.draft.kb = M.draft.kb.map(function (x) { return x.id === k.id ? rec : x; });
      edited(true);
    });
  }
  function listEditor(title, key, help) {
    var ta = h('textarea', { class: 'agc-ta', rows: '6', maxlength: '2400', 'aria-label': title + ' (one per line)', disabled: ro() || null });
    ta.value = M.draft[key].join('\n');
    ta.addEventListener('change', function () {
      var v = ta.value.split('\n').map(function (x) { return x.trim().slice(0, 60); }).filter(Boolean);
      if (!v.length) { UI.toast(title + ' needs at least one entry.', 'error'); ta.value = M.draft[key].join('\n'); return; }
      M.draft[key] = v; edited(false);
    });
    return card(title, [ta, h('p', { class: 'agc-note', text: help })]);
  }
  function tabContent() {
    var D = M.draft;
    body.appendChild(card('Reply templates', [table(['ID', 'Title', 'Text', 'In use', ''], D.macros.map(function (m) {
      return [m.id, h('b', { text: m.title }), h('span', { class: 'agc-clip', text: m.text }), check('Template ' + m.id + ' in use', m.on, function (v) { m.on = v; edited(false); }, ro()),
        btn('Edit', function () { editMacro(m); }, 'g', { disabled: ro() || null })];
    }))], btn('Add template', function () { editMacro(null); }, '', { disabled: ro() || null })));
    body.appendChild(card('Knowledge articles', [table(['ID', 'For', 'Title', 'Guidance', ''], D.kb.map(function (k) {
      return [k.id, k.audience === 'all' ? 'Everyone' : AUD[k.audience], h('b', { text: k.title }), h('span', { class: 'agc-clip', text: k.body }),
        h('span', { class: 'agc-acts' }, [btn('Edit', function () { editKb(k); }, 'g', { disabled: ro() || null }),
          btn('Remove', function () { M.draft.kb = M.draft.kb.filter(function (x) { return x.id !== k.id; }); edited(true); }, 'r', { disabled: ro() || null })])];
    }))], btn('Add article', function () { editKb(null); }, '', { disabled: ro() || null })));
    body.appendChild(h('div', { class: 'agc-grid' }, [
      listEditor('Dispositions', 'dispositions', 'Agents must pick one of these when they resolve a case or finish a call.'),
      listEditor('Escalation teams', 'escalations', 'Teams agents can escalate to. Safety and Finance escalations are used automatically.')]));
  }

  // ---- announcements
  function tabAnn() {
    var D = M.draft;
    var level = select('Announcement level', [['info', 'Information'], ['warn', 'Important'], ['err', 'Urgent']], 'info', function () {});
    var ta = h('textarea', { class: 'agc-ta', rows: '3', maxlength: '500', 'aria-label': 'Announcement text', placeholder: 'Shown at the top of every agent portal', disabled: ro() || null });
    var add = btn('Add and publish', function (b) {
      var t = ta.value.trim();
      if (t.length < 5) { UI.toast('Write the announcement first (at least 5 characters).', 'error'); ta.focus(); return; }
      D.announcements.push({ at: new Date().toISOString(), level: level.value, text: t });
      publish(b).then(function (ok) { if (!ok) { D.announcements.pop(); edited(false); } });
    }, '', { disabled: ro() || null });
    body.appendChild(card('New announcement', [h('div', { class: 'agc-form' }, [h('label', { class: 'rn-f' }, ['Level ', level]), ta, h('div', { class: 'agc-row' }, [add,
      h('span', { class: 'agc-note', text: 'Publishing also sends any other unpublished changes.' })])])]));
    body.appendChild(card('Announcements', [table(['When', 'Level', 'Text', ''], D.announcements.slice().reverse().map(function (a) {
      return [fmt(a.at), st({ info: 'Information', warn: 'Important', err: 'Urgent' }[a.level], { info: 'info', warn: 'warn', err: 'err' }[a.level]), a.text,
        btn('Remove', function () { D.announcements = D.announcements.filter(function (x) { return x !== a; }); edited(true); }, 'r', { disabled: ro() || null })];
    }), 'No announcements.')]));
  }

  // ---- publish
  function tabPublish() {
    var ch = changes(), P = M.published;
    body.appendChild(card('Publish', [
      h('dl', { class: 'agc-kv' }, [h('dt', { text: 'Published version' }), h('dd', { text: 'v' + P.version + ' · ' + fmt(P.publishedAt) + ' · ' + P.publishedBy }),
        h('dt', { text: 'Unpublished changes' }), h('dd', { text: ch.length ? ch.join(', ') : 'None' }),
        h('dt', { text: 'Live link' }), h('dd', { text: SYNC.available ? 'Agent portals open on this site receive a publish at once' : 'Not available in this browser' })]),
      h('div', { class: 'agc-row' }, [btn('Publish to agents', function (b) { publish(b); }, '', { disabled: !ch.length || null }), btn('Discard changes', discard, 'g', { disabled: !ch.length || null }),
        btn('Download agent-policy.js', download, 'g')]),
      h('p', { class: 'agc-note' }, ['Agent portal on its own server: after publishing, download ', h('b', { text: 'agent-policy.js' }),
        ' and copy it into ', h('b', { text: 'assets/js/' }), ' of the agent portal folder on that server. It is the only file the agent portal reads its rules from.'])]));
    body.appendChild(card('Published this session', [table(['Time', 'Version', 'By', 'What changed'], M.history.map(function (x) {
      return [UI.fmtTime(x.at), 'v' + x.version, x.by, x.what];
    }), 'Nothing published in this session yet.')]));
  }

  // ------------------------------------------------------------------ screen controller
  K.def('A31', {
    init: function () { mount(); },
    update: function () { if (bar) { var sig = admin().role; if (bar.getAttribute('data-role') !== sig) { bar.setAttribute('data-role', sig); refreshBar(); renderTab(); } } }
  });

  // test hooks used by tests/browser/agent-portal.test.js
  RN.agentControl = { state: M, test: {
    setChannel: function (k, on) { M.draft.channels[k].on = !!on; edited(true); },
    publish: function () { return publish(null); },
    signOut: function (id) {
      return guard('sign out agent ' + id, 'agentdesk.agent_signed_out', null).then(function (ok) { if (ok) SYNC.send('signout', { agentId: id, reason: 'Signed out by an administrator' }); return ok; });
    },
    policyFile: function () { return policyFile(M.published); }
  } };
})();
