/* RideNova platform runtime (RNPC) - shared static config + ops layer used by all 5 apps.
   Config  (written by admin only, versioned): localStorage "ridenova.platform.v1"  (fallback: window.RN_PLATFORM_DEFAULT)
   Ops     (written by apps and admin):        localStorage "ridenova.ops.v1"
   Live updates: 'storage' event (other tabs) + BroadcastChannel + a 1.5 s cheap poll; RNPC.on(fn) fires on every change.
   Demo only: localStorage is not a trust boundary; a real backend enforces all of this server-side. */
(function () {
  'use strict';
  var KEY = 'ridenova.platform.v1', OPS = 'ridenova.ops.v1', SCHEMA = 1;
  var mem = {};
  function rd(k) { try { var v = localStorage.getItem(k); return v === null ? (mem[k] || null) : v; } catch (e) { return mem[k] || null; } }
  function wr(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  // stored values win; keys new in the bundle are filled in (so an old export keeps working after an upgrade)
  function merge(base, over) { if (!isObj(base) || !isObj(over)) return over === undefined ? base : over; var out = {}; Object.keys(base).forEach(function (k) { out[k] = k in over ? merge(base[k], over[k]) : base[k]; }); Object.keys(over).forEach(function (k) { if (!(k in out)) out[k] = over[k]; }); return out; }
  function defaults() { return clone(window.RN_PLATFORM_DEFAULT || { schema: SCHEMA, version: 1 }); }
  function blankOps() { return { kyc: {}, drivers: {}, customers: {}, wallet: [], partnerApps: {}, menuHidden: {}, bookings: {}, cmds: [], sos: {}, tickets: [], audit: [] }; }
  var rawC = null, rawO = null, cfg = null, ops = null;
  function unionById(baseList, overList) {
    var map = {}, out = [];
    (baseList || []).forEach(function (v) { if (v && v.id != null) map[v.id] = clone(v); });
    (overList || []).forEach(function (v) { if (v && v.id != null) map[v.id] = isObj(map[v.id]) ? merge(map[v.id], v) : clone(v); });
    Object.keys(map).forEach(function (k) { out.push(map[k]); });
    return out;
  }
  function loadCfg() {
    rawC = rd(KEY); var d = defaults(); if (!rawC) { cfg = d; return; }
    try {
      var s = JSON.parse(rawC);
      cfg = s && s.schema === SCHEMA ? merge(d, s) : d;
      if (cfg && d.vehicles) cfg.vehicles = unionById(d.vehicles, (s && s.vehicles) || cfg.vehicles);
    } catch (e) { cfg = d; }
  }
  function loadOps() { rawO = rd(OPS); var b = blankOps(); if (!rawO) { ops = b; return; } try { ops = merge(b, JSON.parse(rawO) || {}); } catch (e) { ops = b; } }
  loadCfg(); loadOps();
  var subs = [], chan = null;
  try { chan = new BroadcastChannel('ridenova-platform'); chan.onmessage = function () { refresh(true); }; } catch (e) { chan = null; }
  function emit(src) { subs.slice().forEach(function (f) { try { f(cfg, ops, src); } catch (e) { console.error(e); } }); }
  function refresh(force) { var c = rd(KEY), o = rd(OPS); if (force || c !== rawC || o !== rawO) { var changed = c !== rawC || o !== rawO; loadCfg(); loadOps(); if (changed || force) emit('remote'); } }
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === OPS || e.key === null) refresh(); });
  setInterval(function () { refresh(); }, 1500);
  function ping() { try { chan && chan.postMessage({ at: Date.now() }); } catch (e) {} }
  function audit(entry) { ops.audit.unshift(Object.assign({ id: 'AU-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now() }, entry)); if (ops.audit.length > 400) ops.audit.length = 400; }
  function saveOps() { rawO = JSON.stringify(ops); wr(OPS, rawO); }
  function saveCfg() { rawC = JSON.stringify(cfg); wr(KEY, rawC); }

  var RNPC = window.RNPC = {
    KEY: KEY, OPS_KEY: OPS, SCHEMA: SCHEMA,
    get cfg() { return cfg; }, get ops() { return ops; },
    on: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
    refresh: function () { refresh(true); },
    // admin write: fn mutates a draft; returns new version. meta {by, role, action, detail}
    update: function (fn, meta) {
      meta = meta || {}; var draft = clone(cfg); fn(draft); draft.schema = SCHEMA;
      draft.version = (cfg.version || 1) + 1; draft.updatedAt = Date.now(); draft.updatedBy = meta.by || 'admin';
      draft.history = [{ v: draft.version, at: draft.updatedAt, by: draft.updatedBy, note: meta.detail || meta.action || '' }].concat(cfg.history || []).slice(0, 40);
      cfg = draft; saveCfg(); audit({ by: meta.by || 'admin', role: meta.role || '', action: meta.action || 'config.update', detail: meta.detail || '', v: draft.version, area: meta.area || 'config' }); saveOps(); ping(); emit('local'); return draft.version;
    },
    // ops write (apps and admin). meta optional -> audit entry
    opsUpdate: function (fn, meta) { loadOps(); fn(ops); if (meta) audit(meta); saveOps(); ping(); emit('local'); },
    export: function () { var c = clone(cfg); return JSON.stringify({ kind: 'ridenova-platform-config', exportedAt: new Date().toISOString(), config: c }, null, 2); },
    validate: function (obj) {
      var c = obj && obj.kind === 'ridenova-platform-config' ? obj.config : obj;
      if (!isObj(c)) return { ok: false, error: 'Not a RideNova config file.' };
      if (c.schema !== SCHEMA) return { ok: false, error: 'Unsupported schema ' + c.schema + ' (expected ' + SCHEMA + ').' };
      var need = ['services', 'vehicles', 'pricing', 'offers', 'cities'];
      for (var i = 0; i < need.length; i++) if (!(need[i] in c)) return { ok: false, error: 'Missing section "' + need[i] + '".' };
      if (!Array.isArray(c.services) || !Array.isArray(c.vehicles)) return { ok: false, error: 'services and vehicles must be lists.' };
      if (!isObj(c.pricing.cities)) return { ok: false, error: 'pricing.cities is missing.' };
      return { ok: true, config: c };
    },
    import: function (text, meta) {
      var obj; try { obj = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: 'File is not valid JSON.' }; }
      var r = RNPC.validate(obj); if (!r.ok) return r;
      var v = RNPC.update(function (d) { var m = merge(defaults(), r.config); Object.keys(d).forEach(function (k) { delete d[k]; }); Object.assign(d, m); }, Object.assign({ action: 'config.import', detail: 'Imported config v' + (r.config.version || '?') }, meta || {}));
      return { ok: true, version: v };
    },
    reset: function (meta) { return RNPC.update(function (d) { var b = defaults(); Object.keys(d).forEach(function (k) { delete d[k]; }); Object.assign(d, b); }, Object.assign({ action: 'config.reset', detail: 'Reset to bundled defaults' }, meta || {})); },

    // ---------------- read helpers used by the apps
    city: function (id) { id = id || cfg.defaultCity; return (cfg.cities || []).filter(function (c) { return c.id === id; })[0] || (cfg.cities || [])[0] || { id: id, zones: [] }; },
    services: function () { return (cfg.services || []).filter(function (s) { return s.on; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); },
    vehicles: function (opts) {
      opts = opts || {}; var zones = RNPC.zonesFor(opts.places || [], opts.city);
      return (cfg.vehicles || []).filter(function (v) { return v.on && zones.every(function (z) { return !z.services || z.services[v.id] !== false; }); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    },
    vehicle: function (id) { return (cfg.vehicles || []).filter(function (v) { return v.id === id; })[0] || null; },
    rate: function (vehicle, city) { var pc = cfg.pricing.cities || {}, c = pc[city || cfg.defaultCity] || pc[Object.keys(pc)[0]] || {}; return c[vehicle] || c.Cab || null; },
    zonesFor: function (places, city) {
      var names = (places || []).map(function (p) { return String(p && (p.n || p.name || p) || '').toLowerCase(); }).join(' | ');
      return (RNPC.city(city).zones || []).filter(function (z) { return z.on && z.match && names.indexOf(String(z.match).toLowerCase()) >= 0; });
    },
    surge: function (hour, zoneIds) {
      var s = cfg.pricing.surge || { rules: [] }, best = 1;
      (s.rules || []).forEach(function (r) { if (!r.on) return; if (r.zone !== '*' && (zoneIds || []).indexOf(r.zone) < 0) return; var inH = r.from <= r.to ? hour >= r.from && hour < r.to : hour >= r.from || hour < r.to; if (inH && r.mult > best) best = r.mult; });
      return Math.min(best, s.cap || 3);
    },
    isNight: function (hour) { var n = cfg.pricing.night || { from: 23, to: 5 }; return n.from <= n.to ? hour >= n.from && hour < n.to : hour >= n.from || hour < n.to; },
    // the one fare formula used by admin preview and the customer app. Returns paise. opts {city, places, at, factor, hour}
    fare: function (vehicle, km, mins, opts) {
      opts = opts || {}; var r = RNPC.rate(vehicle, opts.city), f = opts.factor || 1, lines = [];
      if (!r) return null;
      var hour = opts.hour != null ? opts.hour : new Date(opts.at || Date.now()).getHours();
      var zones = RNPC.zonesFor(opts.places || [], opts.city), zids = zones.map(function (z) { return z.id; });
      var base = Math.round(r.base * 100 * f), dist = Math.round(km * r.perKm * 100 * f), time = Math.round(mins * r.perMin * 100 * f);
      lines.push(['Base fare', base], ['Distance ' + km + ' km', dist], ['Time ' + mins + ' min', time]);
      var pre = base + dist + time;
      if (r.bookingFee) { var bf = Math.round(r.bookingFee * 100); lines.push(['Booking fee', bf]); pre += bf; }
      var minF = Math.round((r.minFare || 0) * 100 * f); if (pre < minF) { lines.push(['Minimum fare top-up', minF - pre]); pre = minF; }
      var surge = RNPC.surge(hour, zids); if (surge > 1) { var s = Math.round(pre * (surge - 1)); lines.push(['High demand ' + surge + 'x', s]); pre += s; }
      if (r.nightPct && RNPC.isNight(hour)) { var nc = Math.round(pre * r.nightPct / 100); lines.push(['Night charge ' + r.nightPct + '%', nc]); pre += nc; }
      zones.forEach(function (z) { if (z.fee) { var zf = Math.round(z.fee * 100); lines.push([(z.type === 'airport' ? 'Airport fee' : 'Zone fee') + ' (' + z.name + ')', zf]); pre += zf; } });
      return { lines: lines, prePaise: pre, surge: surge, night: !!(r.nightPct && RNPC.isNight(hour)), zones: zids, taxPct: cfg.pricing.taxPct || 0, rate: r, commissionPct: r.commissionPct || 0 };
    },
    tax: function (paise) { return Math.round(paise * (cfg.pricing.taxPct || 0) / 100); },
    couponState: function (c, now) {
      if (!c) return 'missing'; if (!c.on) return 'paused';
      if (c.ends && new Date(c.ends + 'T23:59:59').getTime() < (now || Date.now())) return 'expired';
      if (c.limit && (c.used || 0) >= c.limit) return 'exhausted'; return 'active';
    },
    coupons: function () { return (cfg.offers.coupons || []).filter(function (c) { return RNPC.couponState(c) === 'active'; }); },
    coupon: function (code) { code = String(code || '').trim().toUpperCase(); return (cfg.offers.coupons || []).filter(function (c) { return c.code === code; })[0] || null; },
    broadcastsFor: function (app) { var now = Date.now(); return (cfg.broadcasts || []).filter(function (b) { return b.on && (!b.apps || !b.apps.length || b.apps.indexOf(app) >= 0) && (!b.ends || new Date(b.ends).getTime() > now); }); },
    flag: function (k) { return !!(cfg.flags || {})[k]; },
    rs: function (p) { return '\u20B9' + (Math.round(p) / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 }); },
    uid: function (p) { return (p || 'ID') + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); },
    // Safe booking upsert into ops (preserves admin "Cancelled by RideNova" overrides). Demo sync only.
    bookingUpsert: function (b) {
      if (!b || !b.id) return null;
      var out = null;
      RNPC.opsUpdate(function (o) {
        var old = o.bookings[b.id];
        if (old && /RideNova/.test(old.status || '') && !/RideNova/.test(b.status || '')) { out = old; return; }
        out = o.bookings[b.id] = Object.assign({}, old || {}, b);
      });
      return out;
    },
    bookingGet: function (id) { return (ops.bookings || {})[id] || null; }
  };

  // ---------------- shared app chrome: broadcast banners + maintenance overlay
  var APP = (function () { var p = location.pathname.replace(/\\/g, '/'); if (/customer-app/.test(p)) return 'customer'; if (/driver-app/.test(p)) return 'driver'; if (/patner-app|partner-app/.test(p)) return 'partner'; if (/agent-portal/.test(p)) return 'agent'; if (/admin/.test(p)) return 'admin'; return 'other'; })();
  RNPC.app = APP;
  function host() { return document.querySelector('#mock .scr') || document.body; }
  var SEEN = 'ridenova.pc.dismissed.' + APP;
  function dismissed() { try { return JSON.parse(rd(SEEN) || '[]'); } catch (e) { return []; } }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function paint() {
    if (!document.body || APP === 'admin' || APP === 'other') return;
    var h = host(), inPhone = h !== document.body;
    // broadcasts
    var list = RNPC.broadcastsFor(APP).filter(function (b) { return dismissed().indexOf(b.id) < 0; }), wrap = document.querySelector('.rnpc-bc');
    var sig = list.map(function (b) { return b.id + b.text + b.tone; }).join('|');
    if (!list.length) { if (wrap) wrap.remove(); } else if (!wrap || wrap.dataset.sig !== sig || wrap.parentNode !== h) {
      if (wrap) wrap.remove(); wrap = el('div', 'rnpc-bc' + (inPhone ? '' : ' rnpc-fixed')); wrap.dataset.sig = sig; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Announcements');
      list.forEach(function (b) {
        var row = el('div', 'rnpc-b ' + (b.tone || 'info')); row.setAttribute('role', b.tone === 'warn' ? 'alert' : 'status'); row.dataset.id = b.id;
        row.appendChild(el('span', 'rnpc-t', b.text));
        var x = el('button', 'rnpc-x', '\u00D7'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss announcement');
        x.addEventListener('click', function () { var d = dismissed(); d.push(b.id); wr(SEEN, JSON.stringify(d)); paint(); });
        row.appendChild(x); wrap.appendChild(row);
      });
      h.appendChild(wrap);
    }
    // maintenance
    var m = cfg.maintenance || {}, on = !!m[APP], ov = document.querySelector('.rnpc-maint');
    if (!on) { if (ov) ov.remove(); }
    else if (!ov || ov.parentNode !== h) {
      if (ov) ov.remove(); ov = el('div', 'rnpc-maint' + (inPhone ? '' : ' rnpc-fixed')); ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'rnpc-mt');
      var box = el('div', 'rnpc-mbox'); var t = el('b', null, 'Scheduled maintenance'); t.id = 'rnpc-mt'; box.appendChild(el('div', 'rnpc-ic', '\u2699')); box.appendChild(t); box.appendChild(el('p', null, m.message || 'We will be back shortly.'));
      var r = el('button', 'rnpc-retry', 'Try again'); r.type = 'button'; r.addEventListener('click', function () { RNPC.refresh(); paint(); if (cfg.maintenance && cfg.maintenance[APP] && window.RN && RN.ui && RN.ui.toast) RN.ui.toast('Still under maintenance. Please try again soon.', 'info'); });
      box.appendChild(r); ov.appendChild(box); h.appendChild(ov);
    }
  }
  RNPC.paint = paint;
  RNPC.on(function () { paint(); });
  function boot() { paint(); setInterval(paint, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // inject chrome CSS once (keeps every app's index.html to two script tags)
    try { var cs = document.currentScript, lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.id = 'rnpc-css'; lk.href = (cs && cs.src ? cs.src.replace(/platform\.js(\?.*)?$/, 'platform.css') : '../shared/platform.css'); (document.head || document.documentElement).appendChild(lk); } catch (e) {}
})();
