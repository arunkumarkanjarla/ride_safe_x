/* RideNova – live link between the admin portal and the agent portal (same file in both folders).
   Uses BroadcastChannel: tabs of the SAME site (same scheme, host and port) exchange messages while they are open.
   Nothing is stored and nothing leaves the browser. When the two portals run on different servers the link is not
   available and the agent portal uses the policy file it was deployed with (assets/js/agent-policy.js).
   Messages:  admin → agents  policy {policy} · signout {agentId, reason}
              agent → admin   hello {} · presence {agentId, name, status, open, waiting, activity} · bye {agentId} */
(function () {
  'use strict';
  var RN = window.RN = window.RN || {};
  var NAME = 'ridenova-agent-desk';
  var channel = null, subs = [];
  try { if (typeof BroadcastChannel === 'function') channel = new BroadcastChannel(NAME); } catch (err) { channel = null; }
  if (channel) {
    channel.onmessage = function (ev) {
      var m = ev.data;
      if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
      subs.forEach(function (fn) { try { fn(m.type, m.data || {}); } catch (err) { /* one listener must not break the others */ } });
    };
  }

  var CHANNELS = ['call', 'email', 'chat', 'app', 'whatsapp', 'facebook', 'instagram', 'x'];
  var AUDIENCES = ['customer', 'driver', 'partner'];
  var ROLES = ['L1', 'L2', 'SUP'];
  function str(v, max, dflt) { return typeof v === 'string' ? v.slice(0, max || 300) : (dflt || ''); }
  function num(v, lo, hi, dflt) { var n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : dflt; }
  function list(v, allowed) { return Array.isArray(v) ? v.filter(function (x) { return allowed.indexOf(x) >= 0; }) : []; }

  // accepts only the known shape and value ranges, so a malformed message cannot break or take over the portal
  function cleanPolicy(p, base) {
    if (!p || typeof p !== 'object') return null;
    base = base || {};
    var out = { version: num(p.version, 1, 1e6, 1), publishedAt: str(p.publishedAt, 40), publishedBy: str(p.publishedBy, 80), demoCode: str(p.demoCode, 12, base.demoCode || '246810') };
    out.channels = {};
    CHANNELS.forEach(function (k) {
      var c = (p.channels || {})[k] || {}, b = (base.channels || {})[k] || {};
      out.channels[k] = { on: c.on === true, label: str(c.label, 40, b.label || k), slaMins: num(c.slaMins, 1, 10080, b.slaMins || 60), hours: str(c.hours, 40, b.hours || '24 × 7') };
    });
    out.audiences = {}; AUDIENCES.forEach(function (k) { out.audiences[k] = !!(p.audiences || {})[k]; });
    var r = p.routing || {};
    out.routing = { strategy: ['skills', 'longest-idle', 'round-robin'].indexOf(r.strategy) >= 0 ? r.strategy : 'skills', autoAssign: !!r.autoAssign,
      maxChats: num(r.maxChats, 1, 10, 3), ringSecs: num(r.ringSecs, 5, 120, 20), wrapUpSecs: num(r.wrapUpSecs, 0, 600, 30), maskNumbers: true, recordCalls: !!r.recordCalls };
    out.roles = {};
    ROLES.forEach(function (k) {
      var x = (p.roles || {})[k] || {}, b = (base.roles || {})[k] || {};
      out.roles[k] = { label: str(x.label, 40, b.label || k), refundLimit: num(x.refundLimit, 0, 100000, 0), outbound: !!x.outbound, publicReply: !!x.publicReply,
        close: !!x.close, reassign: !!x.reassign, team: !!x.team, export: !!x.export };
    });
    out.agents = (Array.isArray(p.agents) ? p.agents : []).slice(0, 200).filter(function (a) { return a && /^AG-\d{3,5}$/.test(a.id); }).map(function (a) {
      return { id: a.id, name: str(a.name, 60, a.id), role: ROLES.indexOf(a.role) >= 0 ? a.role : 'L1', team: str(a.team, 60), channels: list(a.channels, CHANNELS),
        audiences: list(a.audiences, AUDIENCES), langs: str(a.langs, 80), active: a.active === true };
    });
    out.dispositions = (Array.isArray(p.dispositions) ? p.dispositions : []).slice(0, 40).map(function (x) { return str(x, 60); }).filter(Boolean);
    out.escalations = (Array.isArray(p.escalations) ? p.escalations : []).slice(0, 20).map(function (x) { return str(x, 60); }).filter(Boolean);
    out.macros = (Array.isArray(p.macros) ? p.macros : []).slice(0, 100).map(function (m) { return { id: str(m && m.id, 12), title: str(m && m.title, 80), text: str(m && m.text, 1000), on: !!(m && m.on) }; }).filter(function (m) { return m.id && m.title; });
    out.kb = (Array.isArray(p.kb) ? p.kb : []).slice(0, 200).map(function (k) { return { id: str(k && k.id, 12), audience: ['customer', 'driver', 'partner', 'all'].indexOf(k && k.audience) >= 0 ? k.audience : 'all', title: str(k && k.title, 120), body: str(k && k.body, 2000) }; }).filter(function (k) { return k.id && k.title; });
    out.announcements = (Array.isArray(p.announcements) ? p.announcements : []).slice(-20).map(function (a) { return { at: str(a && a.at, 40), level: ['info', 'warn', 'err'].indexOf(a && a.level) >= 0 ? a.level : 'info', text: str(a && a.text, 500) }; }).filter(function (a) { return a.text; });
    return out;
  }

  RN.agentSync = {
    available: !!channel,
    send: function (type, data) { if (channel) { try { channel.postMessage({ type: type, data: data || {}, at: Date.now() }); } catch (err) { /* closed */ } } },
    on: function (fn) { subs.push(fn); },
    cleanPolicy: cleanPolicy,
    clone: function (o) { return JSON.parse(JSON.stringify(o)); },
    CHANNELS: CHANNELS, AUDIENCES: AUDIENCES, ROLES: ROLES
  };
})();
