/* RideNova prototype – mock workflow engine (no backend, no network).
   Holds one shared, synthetic demo state for the Rider, Driver, Partner and Admin screens, applies
   commands through the state machines in rn-machines.js, simulates the other parties (dispatcher,
   drivers, restaurant, payment gateway) with timers, and records an event history and audit log.

   State is kept in memory only: the applications pass an in-memory store (memoryStorage), so the demo resets when
   the page is reloaded. Nothing here is secure or authoritative; see docs/static-app/security-rules.md. */
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { data: require('./rn-data.js'), machines: require('./rn-machines.js'), rbac: require('./rn-rbac.js') }
    : root.RN;
  var mod = factory(deps.data, deps.machines, deps.rbac);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.RN = root.RN || {}; root.RN.Engine = mod.Engine; root.RN.engineLib = mod; }
})(typeof self !== 'undefined' ? self : this, function (DATA, MACH, RBAC) {
  'use strict';

  var KEY = 'ridenova.demo.v1';
  var VERSION = 3;

  // Seconds. "spec" follows the architecture pages; "fast" keeps live demos short.
  var DUR = {
    spec: { offer: 15, search: 180, respond: 4, enRoute: 1, arrive: 12, start: 6, end: 15, webhook: 3, freeCancel: 180, cooldown: 30,
            partnerAnswer: 180, partnerAuto: 5, prep: 30, courierRespond: 4, courierPickup: 8, courierDeliver: 10, ops: 60,
            chatAssign: 8, chatReply: 4, callQueue: 10, callRing: 6, callNoAnswer: 30 },
    fast: { offer: 7, search: 35, respond: 2.5, enRoute: 1, arrive: 5, start: 4, end: 7, webhook: 2, freeCancel: 20, cooldown: 10,
            partnerAnswer: 45, partnerAuto: 3, prep: 6, courierRespond: 2.5, courierPickup: 4, courierDeliver: 5, ops: 20,
            chatAssign: 3, chatReply: 2, callQueue: 4, callRing: 2.5, callNoAnswer: 15 }
  };
  var CANCEL_FEE_PAISE = 5000;         // Assumed: ₹50 example fee after the free window (not specified)
  var MAX_OFFERS = 8;
  var ACTOR_APP = { rider: 'rider', driver: 'driver', partner: 'partner', admin: 'admin' };
  // Commands a device may queue while offline (architecture page 21: trip meter, OTP check, SOS by SMS work offline)
  var QUEUEABLE = { 'ride.arrive': 1, 'ride.start': 1, 'ride.end': 1, 'order.pickup': 1, 'order.deliver': 1, 'sos.raise': 1 };
  var ACTIVE_RIDE = ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED',
    'TRIP_STARTED', 'TRIP_IN_PROGRESS', 'TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function ok(data) { var r = { ok: true }; if (data) for (var k in data) r[k] = data[k]; return r; }
  function fail(code, error, extra) { var r = { ok: false, code: code, error: error }; if (extra) for (var k in extra) r[k] = extra[k]; return r; }
  function rupees(p) { var a = Math.abs(p); return (p < 0 ? '−' : '') + '₹' + Math.floor(a / 100).toLocaleString('en-IN') + (a % 100 ? '.' + String(a % 100).padStart(2, '0') : ''); }

  function memoryStorage() { var m = {}; return { get: function (k) { return m[k] || null; }, set: function (k, v) { m[k] = v; }, remove: function (k) { delete m[k]; } }; }

  // ------------------------------------------------------------------ seed
  function seed(scenarioId, now, fresh) {
    var sc = DATA.SCENARIOS.filter(function (s) { return s.id === scenarioId; })[0] || DATA.SCENARIOS[0];
    var drivers = {};
    Object.keys(DATA.DRIVERS).forEach(function (id) {
      drivers[id] = Object.assign(clone(DATA.DRIVERS[id]), { avail: 'ONLINE', kyc: 'ACTIVE', docsValid: true, blocked: false, cooldownUntil: 0, duesDays: 0 });
    });
    var s = {
      v: VERSION, rev: 0, seq: 0, scenario: sc.id, createdAt: now,
      opts: { fast: true, auto: { driver: true, partner: true, courier: true, ops: false, support: true }, payment: sc.payment, plan: sc.plan,
              chatAgents: 'available', callOutcome: 'connected' },
      net: { rider: 'online', driver: 'online', partner: 'online', admin: 'online' },
      session: {
        rider: { status: 'signed_in', phone: DATA.RIDER.phone, attempts: 0, lockedUntil: 0, sends: [] },
        driver: { status: 'signed_in', phone: '+91 90000 01042', attempts: 0, lockedUntil: 0, sends: [] },
        admin: { status: 'signed_in', role: sc.role || 'OPS_MANAGER', attempts: 0, lockedUntil: 0, adminId: 'ADM-7' },
        partner: { status: 'signed_in' }
      },
      rider: Object.assign(clone(DATA.RIDER), { debtPaise: 0, priority: 'bal', location: 'granted', profileDone: true }),
      drivers: drivers, persona: 'DRV-1042',
      rides: {}, rideOrder: [], activeRideId: null,
      orders: {}, orderOrder: [], activeOrderId: null,
      incidents: {}, incidentOrder: [],
      kyc: { state: 'ACTIVE', docs: clone(DATA.KYC_TEMPLATE.docs).map(function (d) { d.state = 'approved'; return d; }), reason: '' },
      queue: [], timers: [], events: [], audit: [], idem: {}, toasts: [],
      support: { tickets: {}, ticketOrder: [], chats: {}, chatOrder: [], calls: {}, callOrder: [], agent: { status: 'OFFLINE', signedIn: true, name: DATA.AGENTS[0] }, seq: 0 },
      bookings: {}
    };
    DATA.SUPPORT_TICKETS.forEach(function (t) {
      s.support.tickets[t.id] = { id: t.id, by: t.by, user: t.user, category: t.category, issue: t.issue, ref: t.ref, priority: t.priority, state: t.status,
        assignee: t.assignee, openedAt: now - t.ageMin * 60000, slaDue: now - t.ageMin * 60000 + SLA_MIN[t.priority] * 60000, history: [], notes: [],
        messages: [{ at: now - t.ageMin * 60000, from: 'user', name: t.user, text: t.issue + ' (sample ticket)' }], resolution: null, feedback: null, sample: true };
      s.support.ticketOrder.push(t.id);
    });
    DATA.BOOKINGS.forEach(function (b) { s.bookings[b.id] = Object.assign(clone(b), { history: [] }); });
    if (sc.kyc === 'draft') {
      s.kyc = { state: 'DRAFT', docs: clone(DATA.KYC_TEMPLATE.docs), reason: '' };
      s.drivers['DRV-1042'].kyc = 'DRAFT'; s.drivers['DRV-1042'].avail = 'OFFLINE';
    }
    if (sc.ride === 'in_progress') {
      var r = newRide(s, now, 'happy');
      r.state = 'TRIP_IN_PROGRESS'; r.driverId = 'DRV-1042'; r.acceptedAt = now; r.arrivedAt = now; r.startedAt = now;
      r.offers.push({ id: r.id + '-O1', driverId: 'DRV-1042', state: 'ACCEPTED', sentAt: now, expiresAt: now });
      r.history.push({ at: now, from: 'REQUESTED', to: 'TRIP_IN_PROGRESS', event: 'seed', actor: 'system' });
      s.drivers['DRV-1042'].avail = 'ON_TRIP';
      s.activeRideId = r.id;
      log(s, now, 'demo.seeded', 'system', 'ride:' + r.id, 'Scenario ' + sc.id + ' starts with a trip already in progress');
    }
    if (fresh) {
      // first launch of an app: nobody is signed in yet (scenarios loaded from the demo panel sign everyone in)
      ['rider', 'driver', 'partner'].forEach(function (k) { s.session[k].status = 'signed_out'; });
      s.session.admin.status = 'signed_out';
      s.support.agent.signedIn = false;
    }
    log(s, now, 'demo.reset', 'system', 'demo', 'Scenario ' + sc.id + ': ' + sc.title + (fresh ? ' (signed out)' : ''));
    return s;
  }
  var SLA_MIN = { P1: 60, P2: 240, P3: 1440 };   // Assumed SLA targets (not specified)

  function newRide(s, now, planName, details) {
    var n = s.rideOrder.length;
    var id = n === 0 ? DATA.RIDE_TEMPLATE.id : DATA.RIDE_TEMPLATE.id.replace(/\d{5}$/, function (m) { return String(Number(m) + n).padStart(5, '0'); });
    var r = Object.assign(clone(DATA.RIDE_TEMPLATE), details || {}, {
      id: id, state: 'REQUESTED', riderId: DATA.RIDER.id, driverId: null, plan: clone(DATA.DISPATCH_PLANS[planName] || []), planIdx: 0,
      offers: [], searchDeadline: 0, requestedAt: now, acceptedAt: 0, arrivedAt: 0, startedAt: 0, endedAt: 0, cancel: null,
      payment: { state: 'CREATED', attempts: 0, method: (details && details.payMethod) || DATA.RIDE_TEMPLATE.payMethod }, rating: null, history: [], incidentId: null
    });
    s.rides[id] = r; s.rideOrder.push(id);
    return r;
  }

  function log(s, now, type, actor, ref, note, extra) {
    s.seq += 1;
    var e = { seq: s.seq, at: now, type: type, actor: actor, ref: ref, note: note || '' };
    if (extra) for (var k in extra) e[k] = extra[k];
    s.events.push(e);
    if (s.events.length > 400) s.events.splice(0, s.events.length - 400);
    return e;
  }

  // ------------------------------------------------------------------ engine
  function Engine(opts) {
    opts = opts || {};
    this.storage = opts.storage || memoryStorage();
    this.now = opts.now || function () { return Date.now(); };
    this.key = opts.key || KEY;
    this.listeners = [];
    this.state = this._read() || seed('A', this.now(), !!opts.fresh);
    if (!this._read()) this._write();
  }

  Engine.prototype._read = function () {
    try {
      var raw = this.storage.get(this.key);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.v === VERSION ? s : null;
    } catch (e) { return null; }
  };
  Engine.prototype._write = function () {
    try { this.storage.set(this.key, JSON.stringify(this.state)); } catch (e) { /* storage unavailable: keep in memory */ }
  };
  Engine.prototype.reload = function () {
    var s = this._read();
    if (s && s.rev !== this.state.rev) { this.state = s; this._emit(); return true; }
    return false;
  };
  Engine.prototype.subscribe = function (fn) { this.listeners.push(fn); var l = this.listeners; return function () { l.splice(l.indexOf(fn), 1); }; };
  Engine.prototype._emit = function () { var s = this.state; this.listeners.slice().forEach(function (fn) { try { fn(s); } catch (e) { /* listener error must not break the engine */ } }); };
  Engine.prototype._mutate = function (fn) {
    var latest = this._read();
    if (latest && latest.rev > this.state.rev) this.state = latest;   // another tab changed it
    var result = fn(this.state, this.now());
    if (!result || result.ok !== false || result.persist) {
      this.state.rev += 1; this._write(); this._emit();
    }
    return result;
  };
  Engine.prototype.dur = function (name) { return DUR[this.state.opts.fast ? 'fast' : 'spec'][name] * 1000; };

  Engine.prototype.reset = function (scenarioId, fresh) {
    var s = seed(scenarioId || this.state.scenario || 'A', this.now(), !!fresh);
    s.rev = (this.state.rev || 0) + 1;
    this.state = s; this._write(); this._emit();
    return ok({ scenario: s.scenario });
  };
  Engine.prototype.clearStorage = function () { try { this.storage.remove(this.key); } catch (e) { /* ignore */ } };

  Engine.prototype.setOption = function (path, value) {
    return this._mutate(function (s, now) {
      var parts = path.split('.'), o = s.opts;
      for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
      o[parts[parts.length - 1]] = value;
      log(s, now, 'demo.option', 'system', 'demo', path + ' = ' + JSON.stringify(value));
      return ok();
    });
  };

  // ------------------------------------------------------------------ queries
  Engine.prototype.ride = function (id) { var s = this.state; return s.rides[id || s.activeRideId] || (id ? null : this.lastRide()); };
  Engine.prototype.lastRide = function () { var s = this.state; return s.rideOrder.length ? s.rides[s.rideOrder[s.rideOrder.length - 1]] : null; };
  Engine.prototype.activeRide = function () { var s = this.state; var r = s.rides[s.activeRideId]; return r && ACTIVE_RIDE.indexOf(r.state) >= 0 ? r : null; };
  Engine.prototype.order = function () { var s = this.state; return s.orders[s.activeOrderId] || null; };
  Engine.prototype.incident = function (id) { var s = this.state; return s.incidents[id || s.incidentOrder[s.incidentOrder.length - 1]] || null; };
  Engine.prototype.pendingOfferFor = function (driverId) {
    var r = this.activeRide(); if (!r) return null;
    var o = r.offers[r.offers.length - 1];
    return o && o.state === 'PENDING' && o.driverId === driverId ? { ride: r, offer: o } : null;
  };
  Engine.prototype.persona = function () { return this.state.drivers[this.state.persona]; };
  Engine.prototype.can = function (perm) { return RBAC.can(this.state.session.admin.role, perm); };

  // ------------------------------------------------------------------ transitions
  function move(s, now, machine, entity, event, actor, ref, note) {
    var c = MACH.check(machine, entity.state, event, actor);
    if (!c.ok) return c;
    var from = entity.state;
    entity.state = c.to;
    if (entity.history) entity.history.push({ at: now, from: from, to: c.to, event: event, actor: actor });
    log(s, now, machine + '.' + event, actor, ref, note, { from: from, to: c.to });
    return ok({ from: from, to: c.to });
  }

  function addTimer(s, at, type, ref, data) {
    s.timers.push({ id: type + ':' + ref + ':' + s.seq + ':' + s.timers.length, at: at, type: type, ref: ref, data: data || null });
  }
  function dropTimers(s, pred) { s.timers = s.timers.filter(function (t) { return !pred(t); }); }

  Engine.prototype.tick = function () {
    var self = this;
    var due = function (s, now) { return s.timers.some(function (t) { return t.at <= now; }); };
    var latest = this._read();
    if (latest && latest.rev > this.state.rev) { this.state = latest; this._emit(); }
    if (!due(this.state, this.now())) return false;
    this._mutate(function (s, now) {
      var guard = 0;
      while (due(s, now) && guard++ < 50) {
        s.timers.sort(function (a, b) { return a.at - b.at; });
        var t = s.timers.shift();
        self._fire(s, t.at <= now ? t.at : now, t);
      }
      return ok();
    });
    return true;
  };

  Engine.prototype._fire = function (s, now, t) {
    var r, o, ord, inc;
    switch (t.type) {
      case 'ride.enRoute':
        r = s.rides[t.ref]; if (r && r.state === 'DRIVER_ACCEPTED') move(s, now, 'ride', r, 'driver.en_route', 'system', 'ride:' + r.id, 'Driver started navigation to pickup');
        break;
      case 'offer.expire':
        r = s.rides[t.ref]; o = r && r.offers.filter(function (x) { return x.id === t.data; })[0];
        if (o && o.state === 'PENDING') {
          o.state = 'EXPIRED';
          log(s, now, 'dispatch.expired', 'system', 'ride:' + r.id, 'No answer from ' + s.drivers[o.driverId].short + ' in ' + Math.round((o.expiresAt - o.sentAt) / 1000) + ' s');
          move(s, now, 'ride', r, 'offer.expired', 'system', 'ride:' + r.id);
          this._nextOffer(s, now, r);
        }
        break;
      case 'offer.respond':
        r = s.rides[t.ref]; o = r && r.offers.filter(function (x) { return x.id === t.data.offer; })[0];
        if (o && o.state === 'PENDING') this._answerOffer(s, now, r, o, t.data.answer, 'driver');
        break;
      case 'search.deadline':
        r = s.rides[t.ref];
        if (r && r.state === 'SEARCHING_DRIVER') {
          move(s, now, 'ride', r, 'search.exhausted', 'system', 'ride:' + r.id, 'No driver accepted within the search window');
          s.activeRideId = r.id;
        }
        break;
      case 'search.next':
        r = s.rides[t.ref]; if (r && r.state === 'SEARCHING_DRIVER') this._nextOffer(s, now, r);
        break;
      case 'auto.arrive':
        r = s.rides[t.ref]; if (r && (r.state === 'DRIVER_ACCEPTED' || r.state === 'DRIVER_ARRIVING')) this._arrive(s, now, r, 'system');
        break;
      case 'auto.start':
        r = s.rides[t.ref]; if (r && r.state === 'DRIVER_ARRIVED') this._start(s, now, r, r.otp, 'driver');
        break;
      case 'auto.end':
        r = s.rides[t.ref]; if (r && (r.state === 'TRIP_IN_PROGRESS' || r.state === 'TRIP_STARTED')) this._end(s, now, r, 'driver');
        break;
      case 'payment.webhook':
        r = s.rides[t.ref]; if (r && r.state === 'PAYMENT_PENDING') this._webhook(s, now, r);
        break;
      case 'order.partnerAuto':
        ord = s.orders[t.ref]; if (ord && ord.state === 'PLACED') this._orderAccept(s, now, ord, 15, 'partner');
        break;
      case 'order.noAnswer':
        ord = s.orders[t.ref];
        if (ord && ord.state === 'PLACED') { move(s, now, 'order', ord, 'reject', 'system', 'order:' + ord.id, 'Restaurant did not answer in time'); this._refundOrder(s, now, ord); }
        break;
      case 'order.ready':
        ord = s.orders[t.ref]; if (ord && ord.state === 'PREPARING') move(s, now, 'order', ord, 'ready', 'partner', 'order:' + ord.id, 'Food ready, sealed bag photo taken');
        break;
      case 'courier.respond':
        ord = s.orders[t.ref]; if (ord && ord.courier && ord.courier.state === 'PENDING') this._courierAnswer(s, now, ord, 'accept');
        break;
      case 'courier.pickup':
        ord = s.orders[t.ref]; if (ord && ord.state === 'READY' && ord.courier && ord.courier.state === 'ACCEPTED') { ord.sealPhoto = true; move(s, now, 'order', ord, 'pickup', 'driver', 'order:' + ord.id, 'Picked up with sealed-bag photo'); addTimer(s, now + this.dur('courierDeliver'), 'courier.deliver', ord.id); }
        else if (ord && ord.state !== 'DELIVERED' && ord.courier && ord.courier.state === 'ACCEPTED' && s.opts.auto.courier) addTimer(s, now + 1500, 'courier.pickup', ord.id);
        break;
      case 'courier.deliver':
        ord = s.orders[t.ref]; if (ord && ord.state === 'PICKED_UP') this._orderDeliver(s, now, ord, ord.otp, 'driver');
        break;
      case 'chat.assign':
        var ch = s.support.chats[t.ref];
        if (ch && ch.state === 'QUEUED') {
          ch.agent = DATA.AGENTS[0];
          move(s, now, 'chat', ch, 'assign', 'system', 'chat:' + ch.id, ch.agent + ' (simulated agent) joined');
          ch.messages.push({ at: now, from: 'system', text: ch.agent + ' joined the chat.' });
          ch.messages.push({ at: now, from: 'agent', name: ch.agent, text: 'Hi ' + ch.user.split(' ')[0] + ', I am ' + ch.agent.split(' ')[0] + '. How can I help with "' + ch.topic + '"?' });
        }
        break;
      case 'chat.reply':
        var cr = s.support.chats[t.ref];
        if (cr && cr.state === 'ACTIVE') {
          var hit = DATA.CHAT_REPLIES.filter(function (x) { return x[0].test(String(t.data || '')); })[0];
          cr.messages.push({ at: now, from: 'agent', name: cr.agent, text: hit ? hit[1] : DATA.CHAT_FALLBACK });
          cr.typing = s.timers.some(function (x) { return x.type === 'chat.reply' && x.ref === cr.id; });
        }
        break;
      case 'call.queue':
        var cq = s.support.calls[t.ref]; if (cq && cq.state === 'QUEUED') { cq.position = 1; log(s, now, 'call.queue_moved', 'system', 'call:' + cq.id, 'Next in the queue'); }
        break;
      case 'call.dial':
        var cd = s.support.calls[t.ref];
        if (cd && cd.state === 'QUEUED') {
          var outcome = s.opts.callOutcome;
          if (outcome === 'busy') { move(s, now, 'call', cd, 'busy', 'system', 'call:' + cd.id, 'All agents busy'); cd.endedAt = now; }
          else if (outcome === 'failed') { move(s, now, 'call', cd, 'fail', 'system', 'call:' + cd.id, 'Call could not be placed (simulated network failure)'); cd.endedAt = now; }
          else { move(s, now, 'call', cd, 'ring', 'system', 'call:' + cd.id, 'Support is calling you back (simulated)'); addTimer(s, now + this.dur('callNoAnswer'), 'call.noanswer', cd.id); }
        }
        break;
      case 'call.noanswer':
        var cn = s.support.calls[t.ref]; if (cn && cn.state === 'RINGING') { move(s, now, 'call', cn, 'timeout', 'system', 'call:' + cn.id, 'Not answered'); cn.endedAt = now; }
        break;
      case 'ops.ack':
        inc = s.incidents[t.ref]; if (inc && inc.state === 'OPEN') { move(s, now, 'incident', inc, 'acknowledge', 'admin', 'incident:' + inc.id, 'Agent Meera acknowledged (automatic, simulated)'); inc.agent = 'Meera'; }
        break;
    }
  };

  // ---- dispatch
  Engine.prototype._nextOffer = function (s, now, r) {
    if (r.state !== 'SEARCHING_DRIVER') return;
    while (r.planIdx < r.plan.length && r.offers.length < MAX_OFFERS) {
      var step = r.plan[r.planIdx++], d = s.drivers[step[0]];
      if (!d || d.avail !== 'ONLINE' || d.blocked || d.cooldownUntil > now) {
        log(s, now, 'dispatch.skipped', 'system', 'ride:' + r.id, (d ? d.short : step[0]) + ' skipped (' + (d ? (d.blocked ? 'blocked' : d.avail !== 'ONLINE' ? d.avail.toLowerCase() : 'cool-down') : 'unknown') + ')');
        continue;
      }
      var o = { id: r.id + '-O' + (r.offers.length + 1), driverId: d.id, state: 'PENDING', sentAt: now, expiresAt: now + this.dur('offer'), planned: step[1] };
      r.offers.push(o);
      move(s, now, 'ride', r, 'offer.sent', 'system', 'ride:' + r.id, 'Offer to ' + d.short + ' (' + Math.round(this.dur('offer') / 1000) + ' s to answer)');
      addTimer(s, o.expiresAt, 'offer.expire', r.id, o.id);
      var manual = d.id === s.persona && !s.opts.auto.driver;
      if (!manual && step[1] !== 'ignore') addTimer(s, now + this.dur('respond'), 'offer.respond', r.id, { offer: o.id, answer: step[1] });
      return;
    }
    // Nobody left to offer: keep searching until the deadline (radius expansion is simulated as waiting)
    log(s, now, 'dispatch.waiting', 'system', 'ride:' + r.id, 'No more eligible drivers nearby; widening search');
  };

  Engine.prototype._answerOffer = function (s, now, r, o, answer, actor) {
    var d = s.drivers[o.driverId];
    if (answer === 'accept') {
      if (now > o.expiresAt) return fail('offer_expired', 'This offer has expired.');
      o.state = 'ACCEPTED';
      dropTimers(s, function (t) { return t.ref === r.id && (t.type === 'offer.expire' || t.type === 'search.deadline' || t.type === 'search.next'); });
      var res = move(s, now, 'ride', r, 'offer.accepted', 'driver', 'ride:' + r.id, d.short + ' accepted');
      r.driverId = d.id; r.acceptedAt = now; d.avail = 'ON_TRIP';
      log(s, now, 'call.proxy_bound', 'system', 'ride:' + r.id, 'Masked number bound to rider and driver (simulated)');
      addTimer(s, now + this.dur('enRoute'), 'ride.enRoute', r.id);
      if (d.id !== s.persona || s.opts.auto.driver) addTimer(s, now + this.dur('arrive'), 'auto.arrive', r.id);
      return res;
    }
    o.state = 'DECLINED';
    d.cooldownUntil = now + this.dur('cooldown');
    dropTimers(s, function (t) { return t.ref === r.id && t.type === 'offer.expire' && t.data === o.id; });
    log(s, now, 'dispatch.declined', actor, 'ride:' + r.id, d.short + ' declined; cool-down ' + Math.round(this.dur('cooldown') / 1000) + ' s');
    move(s, now, 'ride', r, 'offer.declined', 'driver', 'ride:' + r.id);
    this._nextOffer(s, now, r);
    return ok();
  };

  Engine.prototype._arrive = function (s, now, r, actor) {
    if (r.state === 'DRIVER_ACCEPTED') move(s, now, 'ride', r, 'driver.en_route', 'system', 'ride:' + r.id);
    var res = move(s, now, 'ride', r, 'driver.arrived', actor, 'ride:' + r.id, 'Driver at pickup (within 100 m)');
    if (res.ok) {
      r.arrivedAt = now;
      var d = s.drivers[r.driverId];
      if (d && (d.id !== s.persona || s.opts.auto.driver)) addTimer(s, now + this.dur('start'), 'auto.start', r.id);
    }
    return res;
  };

  Engine.prototype._start = function (s, now, r, otp, actor) {
    if (r.state !== 'DRIVER_ARRIVED') return MACH.check('ride', r.state, 'trip.start', actor);
    if (String(otp || '').replace(/\D/g, '') !== r.otp) {
      log(s, now, 'ride.otp_rejected', actor, 'ride:' + r.id, 'Wrong trip code entered');
      return fail('wrong_otp', 'That code does not match. Ask the rider for the 4-digit code shown in their app.', { persist: true });
    }
    var res = move(s, now, 'ride', r, 'trip.start', 'driver', 'ride:' + r.id, 'OTP verified, trip started');
    if (!res.ok) return res;
    r.startedAt = now;
    move(s, now, 'ride', r, 'trip.progress', 'system', 'ride:' + r.id, 'Location every 3 s (simulated)');
    var d = s.drivers[r.driverId];
    if (d && (d.id !== s.persona || s.opts.auto.driver)) addTimer(s, now + this.dur('end'), 'auto.end', r.id);
    return res;
  };

  Engine.prototype._end = function (s, now, r, actor) {
    var res = move(s, now, 'ride', r, 'trip.end', 'driver', 'ride:' + r.id, 'Trip ended; final fare ' + rupees(r.finalPaise) + ' from GPS trail');
    if (!res.ok) return res;
    r.endedAt = now;
    var d = s.drivers[r.driverId]; if (d) d.avail = 'ONLINE';
    dropTimers(s, function (t) { return t.ref === r.id && t.type === 'auto.end'; });
    move(s, now, 'ride', r, 'payment.request', 'system', 'ride:' + r.id, 'Charging ' + r.payment.method);
    if (r.payment.method === 'Cash') { log(s, now, 'payment.cash_due', 'system', 'ride:' + r.id, 'Driver to confirm cash received'); if (s.opts.auto.driver) addTimer(s, now + this.dur('webhook'), 'payment.webhook', r.id); }
    else addTimer(s, now + this.dur('webhook'), 'payment.webhook', r.id);
    return res;
  };

  Engine.prototype._webhook = function (s, now, r) {
    var outcome = s.opts.payment;
    if (r.payment.method === 'Cash') outcome = 'success';
    if (outcome === 'pending') { log(s, now, 'payment.pending', 'gateway', 'ride:' + r.id, 'Gateway has not confirmed yet'); return; }
    r.payment.attempts += 1;
    if (outcome === 'success') {
      r.payment.state = 'CAPTURED';
      log(s, now, 'payment.captured', 'gateway', 'ride:' + r.id, rupees(r.finalPaise) + ' captured (' + r.payment.method + ', signed webhook verified – simulated)');
      move(s, now, 'ride', r, 'payment.captured', 'gateway', 'ride:' + r.id);
      log(s, now, 'earning.credited', 'system', 'driver:' + r.driverId, rupees(r.driverEarnPaise) + ' credited (100% of fare)');
      return;
    }
    if (r.payment.attempts < 2) {
      log(s, now, 'payment.retry', 'gateway', 'ride:' + r.id, 'Attempt ' + r.payment.attempts + ' declined; retrying once');
      addTimer(s, now + this.dur('webhook'), 'payment.webhook', r.id);
      return;
    }
    r.payment.state = 'FAILED';
    move(s, now, 'ride', r, 'payment.failed', 'gateway', 'ride:' + r.id, 'Declined twice; rider must pay another way');
    s.rider.debtPaise = r.finalPaise;
  };

  // ---- food
  Engine.prototype._orderAccept = function (s, now, ord, prepMin, actor) {
    var res = move(s, now, 'order', ord, 'accept', actor, 'order:' + ord.id, 'Prep time ' + prepMin + ' min');
    if (!res.ok) return res;
    ord.prepMin = prepMin;
    dropTimers(s, function (t) { return t.ref === ord.id && (t.type === 'order.noAnswer' || t.type === 'order.partnerAuto'); });
    move(s, now, 'order', ord, 'prepare', 'system', 'order:' + ord.id);
    ord.courier = { id: s.opts.courierId || DATA.ORDER_TEMPLATE.courierId, state: 'PENDING', sentAt: now };
    log(s, now, 'delivery.offered', 'system', 'order:' + ord.id, 'Delivery job offered to ' + s.drivers[ord.courier.id].short + ' (timed to the ready time)');
    if (s.opts.auto.courier) addTimer(s, now + this.dur('courierRespond'), 'courier.respond', ord.id);
    if (s.opts.auto.partner) addTimer(s, now + this.dur('prep'), 'order.ready', ord.id);
    return res;
  };
  Engine.prototype._courierAnswer = function (s, now, ord, answer) {
    if (!ord.courier || ord.courier.state !== 'PENDING') return fail('no_offer', 'There is no delivery job waiting for you.');
    if (answer === 'accept') {
      ord.courier.state = 'ACCEPTED';
      log(s, now, 'delivery.accepted', 'driver', 'order:' + ord.id, s.drivers[ord.courier.id].short + ' accepted the delivery');
      if (s.opts.auto.courier) addTimer(s, now + this.dur('courierPickup'), 'courier.pickup', ord.id);
      return ok();
    }
    var next = ord.courier.id === 'DRV-2001' ? 'DRV-0077' : 'DRV-2001';
    log(s, now, 'delivery.declined', 'driver', 'order:' + ord.id, s.drivers[ord.courier.id].short + ' declined; offering to ' + s.drivers[next].short);
    ord.courier = { id: next, state: 'PENDING', sentAt: now };
    addTimer(s, now + this.dur('courierRespond'), 'courier.respond', ord.id);
    return ok();
  };
  Engine.prototype._orderDeliver = function (s, now, ord, otp, actor) {
    if (ord.state !== 'PICKED_UP') return MACH.check('order', ord.state, 'deliver', actor);
    if (String(otp || '').replace(/\D/g, '') !== ord.otp) {
      log(s, now, 'order.otp_rejected', actor, 'order:' + ord.id, 'Wrong delivery code');
      return fail('wrong_otp', 'Wrong code. Ask the customer for the 4-digit code in their app.', { persist: true });
    }
    var res = move(s, now, 'order', ord, 'deliver', 'driver', 'order:' + ord.id, 'Delivered with OTP');
    if (res.ok) log(s, now, 'payment.split', 'system', 'order:' + ord.id, 'Payment split: restaurant, delivery partner, platform (simulated)');
    return res;
  };
  Engine.prototype._refundOrder = function (s, now, ord) {
    ord.refund = 'REFUNDED';
    log(s, now, 'refund.issued', 'system', 'order:' + ord.id, rupees(ord.totalPaise) + ' refunded automatically (simulated)');
  };

  // ------------------------------------------------------------------ commands
  var COMMANDS = {};

  Engine.prototype.run = function (actor, cmd, payload) {
    var self = this;
    payload = payload || {};
    var handler = COMMANDS[cmd];
    if (!handler) return fail('unknown_command', 'Unknown action: ' + cmd);
    return this._mutate(function (s, now) {
      Object.keys(s.idem).forEach(function (k) { if (now - s.idem[k].at > 5 * 60 * 1000) delete s.idem[k]; });
      // duplicate submissions (double taps, retries) return the first result
      if (payload.key && s.idem[payload.key] && now - s.idem[payload.key].at < 5 * 60 * 1000) {
        var prev = clone(s.idem[payload.key].result); prev.duplicate = true; prev.persist = false;
        if (prev.ok) { log(s, now, 'request.duplicate_ignored', actor, cmd, 'Repeated "' + cmd + '" ignored'); prev.persist = true; }
        return prev;
      }
      var app = ACTOR_APP[actor];
      if (app && s.net[app] === 'offline' && !payload.fromQueue && cmd.indexOf('demo.') !== 0) {
        if (QUEUEABLE[cmd]) {
          var dup = s.queue.some(function (q) { return q.cmd === cmd && q.actor === actor; });
          if (dup) return fail('already_queued', 'Already saved on this phone; it will be sent when the connection is back.', { persist: false });
          s.queue.push({ actor: actor, cmd: cmd, payload: payload, at: now });
          log(s, now, 'sync.queued', actor, cmd, 'Saved offline; will sync when back online');
          return ok({ queued: true, message: 'Saved on this phone. It will sync when the connection is back.' });
        }
        return fail('offline', 'No connection. This needs the network; try again when you are back online.', { persist: false });
      }
      var res = handler.call(self, s, now, actor, payload) || ok();
      // only successful commands are de-duplicated; a failed attempt (e.g. a validation error) can be retried
      if (payload.key && res.ok !== false) { s.idem[payload.key] = { at: now, result: res }; }
      if (res.ok === false && !res.persist) res.persist = false;
      return res;
    });
  };

  function guardRole(self, s, now, perm, action, target) {
    var role = s.session.admin.role, allowed = RBAC.can(role, perm);
    s.audit.push({ at: now, admin: s.session.admin.adminId, role: role, action: action, perm: perm, target: target, result: allowed ? 'allowed' : 'denied' });
    if (allowed) return null;
    log(s, now, 'admin.denied', 'admin', target, role + ' tried "' + action + '" without ' + perm);
    return fail('forbidden', 'Your role (' + RBAC.LABELS[role] + ') cannot ' + action + '. Needs permission "' + perm + '" (held by ' +
      RBAC.rolesWith(perm).map(function (r) { return RBAC.LABELS[r]; }).join(', ') + '). Mock role check only.', { persist: true });
  }
  function needAdmin(s) { return s.session.admin.status !== 'signed_in' ? fail('signed_out', 'Sign in to the admin portal first (A01).') : null; }

  // ---- auth (simulated; codes are public demo values)
  function phoneDigits(p) { return String(p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''); }
  COMMANDS['auth.sendOtp'] = function (s, now, actor, p) {
    var ses = s.session[actor], digits = phoneDigits(p.phone);
    if (!/^[6-9]\d{9}$/.test(digits)) return fail('invalid_phone', 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.');
    ses.sends = (ses.sends || []).filter(function (t) { return now - t < 10 * 60 * 1000; });
    if (ses.sends.length >= 3) return fail('rate_limited', 'Too many codes requested. Wait 10 minutes and try again.', { persist: true });
    ses.sends.push(now); ses.status = 'otp_sent'; ses.phone = '+91 ' + digits.slice(0, 5) + ' ' + digits.slice(5); ses.attempts = 0;
    log(s, now, 'user.otp_requested', actor, actor + ':' + ses.phone, 'Code sent by simulated SMS (demo code ' + DATA.DEMO_CODES[actor === 'driver' ? 'driverOtp' : 'riderOtp'] + ')');
    return ok({ phone: ses.phone });
  };
  COMMANDS['auth.verifyOtp'] = function (s, now, actor, p) {
    var ses = s.session[actor];
    if (ses.lockedUntil > now) return fail('locked', 'Too many wrong codes. Try again in 30 minutes.');
    if (ses.status !== 'otp_sent') return fail('no_code', 'Request a code first.');
    var code = String(p.code || '').replace(/\D/g, '');
    if (code.length !== 6) return fail('invalid_code', 'Enter all 6 digits.');
    if (code !== DATA.DEMO_CODES[actor === 'driver' ? 'driverOtp' : 'riderOtp']) {
      ses.attempts += 1;
      if (ses.attempts >= 5) { ses.lockedUntil = now + 30 * 60 * 1000; log(s, now, 'auth.locked', actor, actor, 'Locked for 30 min after 5 wrong codes'); return fail('locked', 'Too many wrong codes. Locked for 30 minutes.', { persist: true }); }
      return fail('wrong_code', 'Wrong code. ' + (5 - ses.attempts) + ' attempts left.', { persist: true });
    }
    ses.status = 'signed_in';
    var known = actor === 'rider' ? ses.phone === DATA.RIDER.phone : true;
    log(s, now, known ? 'user.logged_in' : 'user.registered', actor, actor + ':' + ses.phone, 'Session created (simulated tokens, nothing stored)');
    if (actor === 'rider' && !known) s.rider.profileDone = false;
    return ok({ newUser: !known });
  };
  COMMANDS['auth.signOut'] = function (s, now, actor) {
    s.session[actor].status = 'signed_out';
    log(s, now, 'user.logged_out', actor, actor);
    return ok();
  };
  COMMANDS['rider.profile'] = function (s, now, actor, p) {
    var name = String(p.name || '').trim(), email = String(p.email || '').trim();
    var errors = {};
    if (!/^[\p{L}][\p{L} .'-]{1,49}$/u.test(name)) errors.name = 'Enter your name using letters (2–50 characters).';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email or leave it empty.';
    if (Object.keys(errors).length) return fail('validation', 'Please fix the highlighted fields.', { fields: errors });
    s.rider.name = name; s.rider.short = name.split(' ')[0] + (name.split(' ')[1] ? ' ' + name.split(' ')[1][0] + '.' : '');
    if (email) s.rider.email = email;
    s.rider.profileDone = true;
    log(s, now, 'rider.updated', 'rider', 'rider:' + s.rider.id, 'Profile saved');
    return ok();
  };
  COMMANDS['rider.permission'] = function (s, now, actor, p) {
    s.rider.location = p.location === 'denied' ? 'denied' : 'granted';
    log(s, now, 'rider.permission', 'rider', 'rider:' + s.rider.id, 'Location permission ' + s.rider.location + ' (simulated OS dialog)');
    return ok();
  };
  COMMANDS['admin.mfa'] = function (s, now, actor, p) {
    var ses = s.session.admin;
    if (ses.lockedUntil > now) return fail('locked', 'Too many wrong codes. Contact your security admin.');
    var code = String(p.code || '').replace(/\D/g, '');
    if (code.length !== 6) return fail('invalid_code', 'Enter the 6-digit code.');
    if (code !== DATA.DEMO_CODES.adminMfa) {
      ses.attempts += 1;
      log(s, now, 'admin.login_failed', 'admin', 'admin:' + ses.adminId, 'Wrong MFA code (' + ses.attempts + ')');
      if (ses.attempts >= 5) { ses.lockedUntil = now + 30 * 60 * 1000; return fail('locked', 'Too many wrong codes. Account locked; contact your security admin.', { persist: true }); }
      return fail('wrong_code', 'Wrong code. ' + (5 - ses.attempts) + ' attempts left.', { persist: true });
    }
    ses.status = 'signed_in'; ses.attempts = 0;
    log(s, now, 'admin.logged_in', 'admin', 'admin:' + ses.adminId, 'MFA verified (simulated), role ' + ses.role);
    return ok();
  };
  COMMANDS['admin.setRole'] = function (s, now, actor, p) {
    if (RBAC.ROLES.indexOf(p.role) < 0) return fail('bad_role', 'Unknown role');
    s.session.admin.role = p.role;
    log(s, now, 'admin.role_switched', 'admin', 'admin:' + s.session.admin.adminId, 'Demo role switched to ' + p.role + ' (mock, not security)');
    return ok();
  };

  // ---- rider ride commands
  COMMANDS['ride.quote'] = function (s, now, actor, p) {
    if (p.vehicle) s.quoteVehicle = p.vehicle;
    if (p.payMethod) s.quotePay = p.payMethod;
    return ok();
  };
  COMMANDS['ride.request'] = function (s, now, actor, p) {
    if (s.session.rider.status !== 'signed_in') return fail('signed_out', 'Sign in to book a ride.', { go: 'R03' });
    if (s.rider.debtPaise > 0) return fail('payment_due', 'Settle your unpaid fare of ' + rupees(s.rider.debtPaise) + ' before booking again.', { go: 'R17' });
    var active = this.activeRide();
    if (active) return fail('active_ride', 'You already have an active ride (' + active.state + ').', { go: rideScreen(active) });
    var r = newRide(s, now, p.plan || s.opts.plan, { vehicle: p.vehicle || s.quoteVehicle || 'Cab', payMethod: p.payMethod || s.quotePay || 'UPI' });
    if (s.rider.location === 'denied') log(s, now, 'ride.manual_pickup', 'rider', 'ride:' + r.id, 'Location denied: pickup chosen manually');
    s.activeRideId = r.id;
    log(s, now, 'ride.requested', 'rider', 'ride:' + r.id, r.vehicle + ' · quote ' + rupees(r.quotePaise) + ' · ' + r.payment.method, { to: 'REQUESTED' });
    r.history.push({ at: now, from: null, to: 'REQUESTED', event: 'ride.request', actor: 'rider' });
    move(s, now, 'ride', r, 'search.start', 'system', 'ride:' + r.id, 'Dispatch started (radius 2 → 4 → 6 km)');
    r.searchDeadline = now + this.dur('search');
    addTimer(s, r.searchDeadline, 'search.deadline', r.id);
    this._nextOffer(s, now, r);
    return ok({ rideId: r.id });
  };
  COMMANDS['ride.cancel'] = function (s, now, actor, p) {
    var r = this.activeRide();
    if (!r) return fail('no_ride', 'There is no active ride to cancel.');
    if (actor === 'admin') { var den = needAdmin(s) || guardRole(this, s, now, 'ride.cancel', 'cancel a ride', 'ride:' + r.id); if (den) return den; }
    if (MACH.BEFORE_TRIP.indexOf(r.state) < 0) return fail('cannot_cancel', r.state.indexOf('TRIP') === 0 ? 'A trip in progress cannot be cancelled. It can only be ended by the driver.' : 'This ride can no longer be cancelled.', { persist: false });
    var fee = 0;
    if (actor === 'rider' && r.acceptedAt && now - r.acceptedAt > this.dur('freeCancel')) fee = CANCEL_FEE_PAISE;
    r.offers.forEach(function (o) { if (o.state === 'PENDING') o.state = 'WITHDRAWN'; });
    var res = move(s, now, 'ride', r, 'ride.cancel', actor, 'ride:' + r.id, 'Cancelled by ' + actor + (p.reason ? ': ' + p.reason : '') + (fee ? ' · fee ' + rupees(fee) + ' (example)' : ' · no fee'));
    r.cancel = { by: actor, reason: p.reason || '', feePaise: fee, at: now };
    if (r.driverId && s.drivers[r.driverId]) s.drivers[r.driverId].avail = 'ONLINE';
    dropTimers(s, function (t) { return t.ref === r.id; });
    return Object.assign(res, { feePaise: fee });
  };
  COMMANDS['ride.retry'] = function (s, now, actor) {
    var r = s.rides[s.activeRideId];
    if (!r || r.state !== 'NO_DRIVER_FOUND') return fail('cannot_retry', 'Retry is only possible after no driver was found.');
    log(s, now, 'ride.rebooked', 'rider', 'ride:' + r.id, 'Rider retried; a driver came online (simulated)');
    return COMMANDS['ride.request'].call(this, s, now, 'rider', { vehicle: r.vehicle, payMethod: r.payment.method, plan: 'happy' });
  };
  COMMANDS['payment.payOther'] = function (s, now, actor, p) {
    var r = s.rides[s.activeRideId] || this.lastRide();
    if (!r || r.state !== 'PAYMENT_FAILED') return fail('nothing_due', 'There is no failed payment to settle.');
    r.payment.method = p.method || 'UPI'; r.payment.state = 'CAPTURED'; r.payment.attempts += 1;
    var res = move(s, now, 'ride', r, 'payment.settled', 'rider', 'ride:' + r.id, 'Paid ' + rupees(r.finalPaise) + ' by ' + r.payment.method + ' (simulated)');
    s.rider.debtPaise = 0;
    log(s, now, 'earning.credited', 'system', 'driver:' + r.driverId, rupees(r.driverEarnPaise) + ' credited (100% of fare)');
    return res;
  };
  COMMANDS['ride.rate'] = function (s, now, actor, p) {
    var r = this.lastRide();
    if (!r || ['TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'CLOSED'].indexOf(r.state) < 0) return fail('not_completed', 'You can rate a ride after it ends.');
    var stars = Number(p.stars || 0);
    if (!(stars >= 1 && stars <= 5)) return fail('validation', 'Choose 1 to 5 stars.', { fields: { stars: 'Choose a rating.' } });
    if (actor === 'rider') { if (r.rating) return fail('already_rated', 'You already rated this ride.'); r.rating = { stars: stars, tags: p.tags || [], tipPaise: p.tipPaise || 0 }; }
    else { if (r.riderRating) return fail('already_rated', 'You already rated this rider.'); r.riderRating = { stars: stars, tags: p.tags || [] }; }
    log(s, now, actor === 'rider' ? 'ride.rated' : 'ride.rider_rated', actor, 'ride:' + r.id, stars + '★' + (p.tipPaise ? ' + tip ' + rupees(p.tipPaise) : ''));
    if (r.state === 'PAYMENT_COMPLETED' && r.rating) move(s, now, 'ride', r, 'ride.close', 'system', 'ride:' + r.id, 'Rated and invoiced');
    return ok();
  };

  // ---- driver
  COMMANDS['driver.online'] = function (s, now, actor) {
    var d = s.drivers[s.persona];
    if (d.kyc !== 'ACTIVE' && d.kyc !== 'APPROVED') return fail('not_verified', 'Your documents are not approved yet. See verification status.', { go: 'D04' });
    if (!d.docsValid) return fail('doc_expired', 'A document has expired. Upload the new one to go online.', { go: 'D17' });
    if (d.blocked) return fail('blocked', 'Your account is paused. Contact driver support.', { go: 'D20' });
    if (d.avail !== 'OFFLINE') return ok({ already: true });
    d.avail = 'ONLINE';
    log(s, now, 'driver.status_changed', 'driver', 'driver:' + d.id, 'Online (selfie check passed – simulated)', { to: 'ONLINE' });
    return ok();
  };
  COMMANDS['driver.offline'] = function (s, now) {
    var d = s.drivers[s.persona];
    if (d.avail === 'ON_TRIP') return fail('on_trip', 'Finish the current trip before going offline.');
    d.avail = 'OFFLINE';
    log(s, now, 'driver.status_changed', 'driver', 'driver:' + d.id, 'Offline', { to: 'OFFLINE' });
    return ok();
  };
  COMMANDS['offer.accept'] = function (s, now, actor) {
    var po = this.pendingOfferFor(s.persona);
    if (!po) { var r0 = this.activeRide(); return fail('no_offer', r0 && r0.driverId === s.persona ? 'You already accepted this ride.' : 'This ride request is no longer available.'); }
    return this._answerOffer(s, now, po.ride, po.offer, 'accept', 'driver');
  };
  COMMANDS['offer.decline'] = function (s, now) {
    var po = this.pendingOfferFor(s.persona);
    if (!po) return fail('no_offer', 'This ride request is no longer available.');
    return this._answerOffer(s, now, po.ride, po.offer, 'decline', 'driver');
  };
  function personaRide(self, s) { var r = self.activeRide(); return r && r.driverId === s.persona ? r : null; }
  COMMANDS['ride.arrive'] = function (s, now, actor) {
    var r = personaRide(this, s); if (!r) return fail('no_trip', 'You have no assigned ride.');
    return this._arrive(s, now, r, 'driver');
  };
  COMMANDS['ride.start'] = function (s, now, actor, p) {
    var r = personaRide(this, s); if (!r) return fail('no_trip', 'You have no assigned ride.');
    return this._start(s, now, r, p.otp, 'driver');
  };
  COMMANDS['ride.end'] = function (s, now) {
    var r = personaRide(this, s); if (!r) return fail('no_trip', 'There is no trip in progress.');
    if (r.state !== 'TRIP_IN_PROGRESS' && r.state !== 'TRIP_STARTED') return fail('cannot_end', r.state === 'TRIP_COMPLETED' || r.state.indexOf('PAYMENT') === 0 ? 'This trip has already been completed.' : 'Start the trip with the rider’s code first.');
    return this._end(s, now, r, 'driver');
  };
  COMMANDS['payment.cashCollected'] = function (s, now) {
    var r = this.lastRide();
    if (!r || r.state !== 'PAYMENT_PENDING' || r.payment.method !== 'Cash') return fail('nothing_to_collect', 'Nothing to collect: this ride is paid online.');
    r.payment.state = 'CAPTURED';
    return move(s, now, 'ride', r, 'payment.captured', 'driver', 'ride:' + r.id, 'Cash ' + rupees(r.finalPaise) + ' collected by driver');
  };
  COMMANDS['kyc.upload'] = function (s, now, actor, p) {
    if (['DRAFT', 'REUPLOAD_REQUESTED'].indexOf(s.kyc.state) < 0) return fail('locked', 'Documents are locked while ' + s.kyc.state.replace('_', ' ').toLowerCase() + '.');
    var d = s.kyc.docs.filter(function (x) { return x.key === p.doc; })[0];
    if (!d) return fail('unknown_doc', 'Unknown document');
    d.state = 'uploaded'; d.reason = '';
    log(s, now, 'driver.document_uploaded', 'driver', 'kyc:' + s.persona, d.title + ' uploaded (synthetic file, nothing leaves the browser)');
    return ok();
  };
  COMMANDS['kyc.submit'] = function (s, now) {
    var missing = s.kyc.docs.filter(function (d) { return d.state === 'missing' || d.state === 'rejected'; });
    if (missing.length) return fail('incomplete', 'Upload or retake: ' + missing.map(function (d) { return d.title; }).join(', ') + '.', { fields: { docs: missing.map(function (d) { return d.key; }) } });
    var res = move(s, now, 'kyc', s.kyc, 'submit', 'driver', 'kyc:' + s.persona, 'Submitted for review');
    if (res.ok) { s.kyc.docs.forEach(function (d) { d.state = 'in_review'; }); s.drivers[s.persona].kyc = 'IN_REVIEW'; s.kyc.submittedAt = now; }
    return res;
  };
  COMMANDS['kyc.activate'] = function (s, now) {
    var res = move(s, now, 'kyc', s.kyc, 'activate', 'driver', 'kyc:' + s.persona, 'Training watched; account active');
    if (res.ok) s.drivers[s.persona].kyc = 'ACTIVE';
    return res;
  };
  COMMANDS['driver.expireDoc'] = function (s, now, actor, p) {
    var d = s.drivers[s.persona]; d.docsValid = !p.expired;
    log(s, now, p.expired ? 'driver.blocked_expired_document' : 'driver.document_renewed', 'system', 'driver:' + d.id, p.expired ? 'PUC expired: going online is blocked' : 'New PUC uploaded and approved (simulated)');
    if (p.expired && d.avail === 'ONLINE') { d.avail = 'OFFLINE'; }
    return ok();
  };

  // ---- safety
  COMMANDS['sos.raise'] = function (s, now, actor, p) {
    var r = this.activeRide() || this.lastRide();
    var open = s.incidentOrder.map(function (id) { return s.incidents[id]; }).filter(function (i) { return ['CLOSED', 'FALSE_ALARM', 'RESOLVED'].indexOf(i.state) < 0 && i.by === actor; })[0];
    if (open) return ok({ incidentId: open.id, existing: true });
    var id = 'INC-' + String(4810 + s.incidentOrder.length);
    var inc = { id: id, state: 'OPEN', by: actor, rideId: r ? r.id : null, priority: 'P1', openedAt: now, history: [], riderSafe: false, notes: [] };
    s.incidents[id] = inc; s.incidentOrder.push(id);
    if (r) r.incidentId = id;
    log(s, now, 'safety.sos_raised', actor, 'incident:' + id, (actor === 'driver' ? 'Driver' : 'Rider') + ' SOS' + (r ? ' on ' + r.id : '') + ' · P1 · GPS every 1 s (simulated)', { to: 'OPEN' });
    log(s, now, 'safety.contacts_alerted', 'system', 'incident:' + id, 'Live-trip link to emergency contacts (simulated – nothing sent)');
    if (s.opts.auto.ops) addTimer(s, now + this.dur('ops'), 'ops.ack', id);
    return ok({ incidentId: id });
  };
  COMMANDS['sos.safe'] = function (s, now, actor) {
    var inc = this.incident();
    if (!inc || ['CLOSED', 'FALSE_ALARM'].indexOf(inc.state) >= 0) return fail('no_incident', 'No open safety alert.');
    inc.riderSafe = true;
    log(s, now, 'safety.rider_safe', actor, 'incident:' + inc.id, 'Rider confirmed they are safe');
    return ok();
  };
  function incidentCmd(event, perm, label) {
    return function (s, now, actor, p) {
      var den = needAdmin(s); if (den) return den;
      var inc = s.incidents[p.id] || this.incident();
      if (!inc) return fail('no_incident', 'No incident selected.');
      den = guardRole(this, s, now, perm, label, 'incident:' + inc.id); if (den) return den;
      if (event === 'false_alarm' && !inc.riderSafe) return fail('needs_confirmation', 'Mark as false alarm only after the rider confirms they are safe.');
      var res = move(s, now, 'incident', inc, event, 'admin', 'incident:' + inc.id, p.note || label);
      if (res.ok && event === 'acknowledge') inc.agent = 'Priya K.';
      if (res.ok && event === 'escalate') inc.notes.push('Police/ambulance contact recorded by agent (simulated – nobody was contacted)');
      return res;
    };
  }
  COMMANDS['incident.ack'] = incidentCmd('acknowledge', 'incident.handle', 'acknowledge the incident');
  COMMANDS['incident.work'] = incidentCmd('work', 'incident.handle', 'start working the incident');
  COMMANDS['incident.escalate'] = incidentCmd('escalate', 'incident.handle', 'record a police/ambulance contact');
  COMMANDS['incident.resolve'] = incidentCmd('resolve', 'incident.handle', 'resolve the incident');
  COMMANDS['incident.close'] = incidentCmd('close', 'incident.close', 'close the incident');
  COMMANDS['incident.falseAlarm'] = incidentCmd('false_alarm', 'incident.close', 'mark a false alarm');

  // ---- admin
  COMMANDS['kyc.decide'] = function (s, now, actor, p) {
    var den = needAdmin(s) || guardRole(this, s, now, 'driver.verify', p.decision + ' a driver application', 'kyc:' + s.persona); if (den) return den;
    var ev = { approve: 'approve', reupload: 'reupload', reject: 'reject' }[p.decision];
    if (!ev) return fail('bad_decision', 'Unknown decision');
    if (ev !== 'approve' && !String(p.reason || '').trim()) return fail('validation', 'Give the driver a reason.', { fields: { reason: 'A reason is required.' } });
    var res = move(s, now, 'kyc', s.kyc, ev, 'admin', 'kyc:' + s.persona, ev === 'approve' ? 'Approved by ' + s.session.admin.role : p.reason);
    if (!res.ok) return res;
    s.kyc.reason = p.reason || '';
    if (ev === 'approve') { s.kyc.docs.forEach(function (d) { d.state = 'approved'; }); s.drivers[s.persona].kyc = 'APPROVED'; }
    if (ev === 'reupload') { var d = s.kyc.docs.filter(function (x) { return x.key === (p.doc || 'insurance'); })[0]; s.kyc.docs.forEach(function (x) { x.state = 'approved'; }); if (d) { d.state = 'rejected'; d.reason = p.reason; } s.drivers[s.persona].kyc = 'REUPLOAD_REQUESTED'; }
    if (ev === 'reject') s.drivers[s.persona].kyc = 'REJECTED';
    log(s, now, 'kyc.decided', 'admin', 'kyc:' + s.persona, ev.toUpperCase());
    return res;
  };
  COMMANDS['admin.refund'] = function (s, now, actor, p) {
    var r = this.lastRide();
    var den = needAdmin(s) || guardRole(this, s, now, 'payment.refund', 'issue a refund', 'ride:' + (r ? r.id : '-')); if (den) return den;
    if (!r || r.payment.state !== 'CAPTURED') return fail('not_refundable', 'Only captured payments can be refunded.');
    var amt = Math.round(Number(p.amount || 0) * 100);
    if (!(amt > 0 && amt <= r.finalPaise)) return fail('validation', 'Refund must be between ₹1 and ' + rupees(r.finalPaise) + '.', { fields: { amount: 'Invalid amount' } });
    r.payment.state = 'REFUND_PENDING';
    log(s, now, 'refund.issued', 'admin', 'ride:' + r.id, rupees(amt) + ' refund requested (simulated gateway)');
    r.payment.state = 'REFUNDED'; r.payment.refundPaise = amt;
    return ok();
  };
  COMMANDS['admin.block'] = function (s, now, actor, p) {
    var den = needAdmin(s) || guardRole(this, s, now, 'fraud.block_account', 'block an account', p.target || 'account'); if (den) return den;
    log(s, now, 'fraud.decided', 'admin', p.target || 'account', 'Account blocked (simulated)');
    return ok();
  };
  COMMANDS['admin.action'] = function (s, now, actor, p) {
    // Generic permission-checked admin action for controls without their own workflow
    var den = needAdmin(s) || guardRole(this, s, now, p.perm, p.label || p.perm, p.target || '-'); if (den) return den;
    log(s, now, p.event || 'admin.action', 'admin', p.target || '-', (p.label || p.perm) + ' (simulated)');
    return ok();
  };
  COMMANDS['admin.openIncident'] = function (s, now, actor) {
    var den = needAdmin(s) || guardRole(this, s, now, 'incident.handle', 'open an incident', 'ride'); if (den) return den;
    return COMMANDS['sos.raise'].call(this, s, now, 'admin', {});
  };

  // ---- food
  COMMANDS['order.place'] = function (s, now, actor, p) {
    if (s.session.rider.status !== 'signed_in') return fail('signed_out', 'Sign in to order.', { go: 'R03' });
    var cur = this.order();
    if (cur && ['DELIVERED', 'REJECTED', 'CANCELLED'].indexOf(cur.state) < 0) return fail('active_order', 'Order #' + cur.id + ' is still ' + cur.state.toLowerCase().replace('_', ' ') + '.', { go: 'R46' });
    var n = s.orderOrder.length;
    var ord = Object.assign(clone(DATA.ORDER_TEMPLATE), { id: String(Number(DATA.ORDER_TEMPLATE.id) + n), state: 'PLACED', placedAt: now, history: [], courier: null, delivery: p.delivery || 'Saver' });
    s.orders[ord.id] = ord; s.orderOrder.push(ord.id); s.activeOrderId = ord.id;
    log(s, now, 'order.placed', 'rider', 'order:' + ord.id, ord.restaurant + ' · ' + rupees(ord.totalPaise) + ' · ' + ord.delivery + ' delivery', { to: 'PLACED' });
    addTimer(s, now + this.dur('partnerAnswer'), 'order.noAnswer', ord.id);
    if (s.opts.auto.partner) addTimer(s, now + this.dur('partnerAuto'), 'order.partnerAuto', ord.id);
    return ok({ orderId: ord.id });
  };
  COMMANDS['order.accept'] = function (s, now, actor, p) {
    var ord = this.order(); if (!ord) return fail('no_order', 'No new order.');
    return this._orderAccept(s, now, ord, Number(p.prep || 15), 'partner');
  };
  COMMANDS['order.reject'] = function (s, now, actor, p) {
    var ord = this.order(); if (!ord) return fail('no_order', 'No new order.');
    var res = move(s, now, 'order', ord, 'reject', 'partner', 'order:' + ord.id, p.reason || 'Restaurant rejected');
    if (res.ok) { dropTimers(s, function (t) { return t.ref === ord.id; }); this._refundOrder(s, now, ord); }
    return res;
  };
  COMMANDS['order.ready'] = function (s, now) {
    var ord = this.order(); if (!ord) return fail('no_order', 'No order.');
    var res = move(s, now, 'order', ord, 'ready', 'partner', 'order:' + ord.id, 'Food ready');
    if (res.ok) dropTimers(s, function (t) { return t.ref === ord.id && t.type === 'order.ready'; });
    return res;
  };
  COMMANDS['order.cancel'] = function (s, now, actor) {
    var ord = this.order(); if (!ord) return fail('no_order', 'No order.');
    var res = move(s, now, 'order', ord, 'cancel', actor, 'order:' + ord.id, 'Cancelled by ' + actor);
    if (res.ok) { dropTimers(s, function (t) { return t.ref === ord.id; }); this._refundOrder(s, now, ord); }
    return res;
  };
  COMMANDS['delivery.accept'] = function (s, now) { var ord = this.order(); if (!ord) return fail('no_offer', 'No delivery job.'); return this._courierAnswer(s, now, ord, 'accept'); };
  COMMANDS['delivery.decline'] = function (s, now) { var ord = this.order(); if (!ord) return fail('no_offer', 'No delivery job.'); return this._courierAnswer(s, now, ord, 'decline'); };
  COMMANDS['order.sealPhoto'] = function (s, now) {
    var ord = this.order(); if (!ord) return fail('no_order', 'No delivery job.');
    ord.sealPhoto = true; log(s, now, 'order.photo', 'driver', 'order:' + ord.id, 'Sealed-bag photo taken (simulated camera)');
    return ok();
  };
  COMMANDS['order.pickup'] = function (s, now) {
    var ord = this.order(); if (!ord) return fail('no_order', 'No delivery job.');
    if (!ord.courier || ord.courier.state !== 'ACCEPTED') return fail('not_assigned', 'Accept the delivery job first.');
    var can = MACH.check('order', ord.state, 'pickup', 'driver');
    if (!can.ok) return ord.state === 'PREPARING' || ord.state === 'ACCEPTED' ? fail('not_ready', 'The food is not ready yet. Wait for the restaurant.') : can;
    if (!ord.sealPhoto) return fail('photo_required', 'Take a photo of the sealed bag first.', { fields: { photo: 'Required' } });
    var res = move(s, now, 'order', ord, 'pickup', 'driver', 'order:' + ord.id, 'Picked up with sealed-bag photo');
    if (res.ok) dropTimers(s, function (t) { return t.ref === ord.id && t.type === 'courier.pickup'; });
    return res;
  };
  COMMANDS['order.deliver'] = function (s, now, actor, p) {
    var ord = this.order(); if (!ord) return fail('no_order', 'No delivery job.');
    var res = this._orderDeliver(s, now, ord, p.otp, 'driver');
    if (res.ok) dropTimers(s, function (t) { return t.ref === ord.id; });
    return res;
  };

  // ---- support portal: tickets (user side and agent console)
  var USER_ACTORS = { rider: 1, driver: 1, partner: 1 };
  function ticketOf(s, id) { return s.support.tickets[id] || null; }
  function tmsg(s, now, t, from, text, extra) { var m = Object.assign({ at: now, from: from, text: text }, extra || {}); t.messages.push(m); return m; }
  function userName(s, actor) { return actor === 'driver' ? s.drivers[s.persona].short : actor === 'partner' ? 'Biryani House' : s.rider.short; }
  COMMANDS['ticket.create'] = function (s, now, actor, p) {
    if (!USER_ACTORS[actor]) return fail('wrong_actor', 'Tickets are raised by customers, drivers or partners.');
    var errors = {};
    var cat = DATA.SUPPORT_CATEGORIES.filter(function (c) { return c.key === p.category; })[0];
    if (!cat) errors.category = 'Choose a category.';
    if (!String(p.issue || '').trim()) errors.issue = 'Choose what went wrong.';
    var desc = String(p.description || '').trim();
    if (desc.length < 10) errors.description = 'Describe the problem in at least 10 characters.';
    if (desc.length > 1000) errors.description = 'Keep the description under 1000 characters.';
    if (['P1', 'P2', 'P3'].indexOf(p.priority || 'P3') < 0) errors.priority = 'Choose a priority.';
    if (Object.keys(errors).length) return fail('validation', 'Please fix the highlighted fields.', { fields: errors });
    s.support.seq += 1;
    var id = String(49000 + s.support.seq), pr = p.priority || 'P3';
    var t = { id: id, by: actor, user: userName(s, actor), category: cat.key, issue: p.issue, ref: p.ref || null, priority: pr, state: 'OPEN', assignee: null,
      openedAt: now, slaDue: now + SLA_MIN[pr] * 60000, history: [{ at: now, from: null, to: 'OPEN', event: 'create', actor: actor }], notes: [],
      messages: [], resolution: null, feedback: null, attachments: [] };
    tmsg(s, now, t, 'user', desc, { name: t.user });
    if (p.attachment) { t.attachments.push(p.attachment); tmsg(s, now, t, 'user', 'Attached ' + p.attachment + ' (synthetic file)', { name: t.user, attachment: p.attachment }); }
    tmsg(s, now, t, 'system', 'Ticket #' + id + ' created. Priority ' + pr + ', first response target ' + (SLA_MIN[pr] >= 60 ? SLA_MIN[pr] / 60 + ' h' : SLA_MIN[pr] + ' min') + ' (sample SLA).');
    s.support.tickets[id] = t; s.support.ticketOrder.push(id);
    log(s, now, 'ticket.created', actor, 'ticket:' + id, cat.title + ' · ' + p.issue + (t.ref ? ' · ' + t.ref : ''), { to: 'OPEN' });
    return ok({ ticketId: id });
  };
  COMMANDS['support.ticket'] = function (s, now, actor, p) {   // quick ticket from the apps' help screens
    return COMMANDS['ticket.create'].call(this, s, now, USER_ACTORS[actor] ? actor : 'rider',
      { category: p.category || 'booking', issue: p.arg || 'Support request', description: (p.arg || 'Support request') + ' – raised from the app', priority: 'P3', ref: p.ref || null });
  };
  function ticketMove(s, now, t, event, actor, note) {
    var r = move(s, now, 'ticket', t, event, actor, 'ticket:' + t.id, note);
    if (r.ok) tmsg(s, now, t, 'system', 'Status: ' + t.state.replace(/_/g, ' ').toLowerCase() + (note ? ' – ' + note : ''));
    return r;
  }
  COMMANDS['ticket.message'] = function (s, now, actor, p) {
    var t = ticketOf(s, p.id); if (!t) return fail('no_ticket', 'Ticket not found.');
    var text = String(p.text || '').trim();
    if (!text) return fail('validation', 'Write a message first.', { fields: { message: 'Write a message.' } });
    if (text.length > 1000) return fail('validation', 'Keep messages under 1000 characters.', { fields: { message: 'Too long.' } });
    if (t.state === 'CLOSED') return fail('closed', 'This ticket is closed. Reopen it to add a message.');
    if (actor === 'agent') {
      if (!s.support.agent.signedIn) return fail('signed_out', 'Sign in to the agent console first.');
      if (p.internal) { t.notes.push({ at: now, by: s.support.agent.name, text: text }); log(s, now, 'ticket.note_added', 'agent', 'ticket:' + t.id, 'Internal note'); return ok(); }
      tmsg(s, now, t, 'agent', text, { name: s.support.agent.name });
      if (p.waitForUser && t.state === 'IN_PROGRESS') ticketMove(s, now, t, 'ask_user', 'agent');
    } else {
      tmsg(s, now, t, 'user', text, { name: t.user, attachment: p.attachment || null });
      if (p.attachment) t.attachments = (t.attachments || []).concat([p.attachment]);
      if (t.state === 'WAITING_ON_USER') ticketMove(s, now, t, 'user_reply', actor);
    }
    log(s, now, 'ticket.message', actor, 'ticket:' + t.id, (actor === 'agent' ? 'Agent' : 'User') + ' replied');
    return ok();
  };
  function agentTicket(fn) {
    return function (s, now, actor, p) {
      if (!s.support.agent.signedIn) return fail('signed_out', 'Sign in to the agent console first.');
      var t = ticketOf(s, p.id); if (!t) return fail('no_ticket', 'Ticket not found.');
      return fn.call(this, s, now, t, p);
    };
  }
  COMMANDS['ticket.assign'] = agentTicket(function (s, now, t, p) {
    var to = p.agent || s.support.agent.name;
    if (DATA.AGENTS.indexOf(to) < 0) return fail('validation', 'Choose an agent.');
    var prev = t.assignee; t.assignee = to;
    if (t.state === 'IN_PROGRESS') { log(s, now, 'ticket.reassigned', 'agent', 'ticket:' + t.id, (prev || 'nobody') + ' → ' + to); tmsg(s, now, t, 'system', 'Reassigned to ' + to); return ok(); }
    return ticketMove(s, now, t, 'assign', 'agent', 'assigned to ' + to);
  });
  COMMANDS['ticket.priority'] = agentTicket(function (s, now, t, p) {
    if (['P1', 'P2', 'P3'].indexOf(p.priority) < 0) return fail('validation', 'Choose P1, P2 or P3.');
    t.priority = p.priority; t.slaDue = t.openedAt + SLA_MIN[p.priority] * 60000;
    tmsg(s, now, t, 'system', 'Priority changed to ' + p.priority);
    log(s, now, 'ticket.priority_changed', 'agent', 'ticket:' + t.id, p.priority);
    return ok();
  });
  COMMANDS['ticket.escalate'] = agentTicket(function (s, now, t, p) {
    if (!String(p.reason || '').trim()) return fail('validation', 'Give a reason for the escalation.', { fields: { reason: 'Required.' } });
    return ticketMove(s, now, t, 'escalate', 'agent', p.reason);
  });
  COMMANDS['ticket.resolve'] = agentTicket(function (s, now, t, p) {
    var errors = {};
    if (!p.category) errors.category = 'Choose a resolution category.';
    if (String(p.notes || '').trim().length < 5) errors.notes = 'Add resolution notes (at least 5 characters).';
    if (Object.keys(errors).length) return fail('validation', 'Resolution category and notes are required.', { fields: errors });
    var r = ticketMove(s, now, t, 'resolve', 'agent', p.category);
    if (r.ok) { t.resolution = { category: p.category, notes: p.notes, at: now, by: s.support.agent.name }; tmsg(s, now, t, 'agent', p.notes, { name: s.support.agent.name }); }
    return r;
  });
  COMMANDS['ticket.close'] = function (s, now, actor, p) {
    var t = ticketOf(s, p.id); if (!t) return fail('no_ticket', 'Ticket not found.');
    if (actor === 'agent' && !s.support.agent.signedIn) return fail('signed_out', 'Sign in to the agent console first.');
    return ticketMove(s, now, t, 'close', actor === 'agent' ? 'agent' : actor, actor === 'agent' ? 'closed by agent' : 'closed by ' + t.user);
  };
  COMMANDS['ticket.reopen'] = function (s, now, actor, p) {
    var t = ticketOf(s, p.id); if (!t) return fail('no_ticket', 'Ticket not found.');
    if (actor === 'agent' && !s.support.agent.signedIn) return fail('signed_out', 'Sign in to the agent console first.');
    if (USER_ACTORS[actor] && !String(p.reason || '').trim()) return fail('validation', 'Tell us why you are reopening the ticket.', { fields: { message: 'Required.' } });
    var r = ticketMove(s, now, t, 'reopen', actor === 'agent' ? 'agent' : actor, p.reason || 'reopened');
    if (r.ok) { t.resolution = null; if (p.reason && USER_ACTORS[actor]) tmsg(s, now, t, 'user', p.reason, { name: t.user }); }
    return r;
  };
  COMMANDS['ticket.feedback'] = function (s, now, actor, p) {
    var t = ticketOf(s, p.id); if (!t) return fail('no_ticket', 'Ticket not found.');
    if (['RESOLVED', 'CLOSED'].indexOf(t.state) < 0) return fail('not_resolved', 'Feedback opens once the ticket is resolved.');
    if (t.feedback) return fail('already_rated', 'You already rated this ticket.');
    var score = Number(p.score);
    if (!(score >= 1 && score <= 5)) return fail('validation', 'Choose 1 to 5 stars.', { fields: { score: 'Required.' } });
    t.feedback = { score: score, comment: String(p.comment || '').slice(0, 500), at: now };
    log(s, now, 'ticket.feedback', actor, 'ticket:' + t.id, score + '★');
    return ok();
  };
  COMMANDS['agent.signIn'] = function (s, now, actor, p) {
    if (DATA.AGENTS.indexOf(p.name) < 0) return fail('validation', 'Choose an agent profile.', { fields: { agent: 'Required.' } });
    if (String(p.code || '').replace(/\D/g, '') !== DATA.DEMO_CODES.agentCode) return fail('wrong_code', 'Wrong demo code.', { fields: { code: 'Wrong code.' }, persist: false });
    s.support.agent = { name: p.name, signedIn: true, status: 'AVAILABLE' };
    log(s, now, 'agent.signed_in', 'agent', 'agent:' + p.name, 'Agent console sign-in (simulated)');
    return ok();
  };
  COMMANDS['agent.signOut'] = function (s, now) {
    s.support.agent.signedIn = false; s.support.agent.status = 'OFFLINE';
    log(s, now, 'agent.signed_out', 'agent', 'agent:' + s.support.agent.name); return ok();
  };
  COMMANDS['agent.status'] = function (s, now, actor, p) {
    if (!s.support.agent.signedIn) return fail('signed_out', 'Sign in to the agent console first.');
    if (['AVAILABLE', 'AWAY', 'OFFLINE'].indexOf(p.status) < 0) return fail('validation', 'Unknown status');
    s.support.agent.status = p.status;
    log(s, now, 'agent.status', 'agent', 'agent:' + s.support.agent.name, p.status);
    return ok();
  };

  // ---- support: chat (simulated agent, keyword replies)
  function chatAgentsUp(s) { return s.opts.chatAgents !== 'unavailable'; }
  COMMANDS['chat.start'] = function (s, now, actor, p) {
    if (!USER_ACTORS[actor]) return fail('wrong_actor', 'Chats are started by customers, drivers or partners.');
    var open = s.support.chatOrder.map(function (id) { return s.support.chats[id]; }).filter(function (c) { return c.by === actor && ['QUEUED', 'ACTIVE'].indexOf(c.state) >= 0; })[0];
    if (open) return ok({ chatId: open.id, existing: true });
    s.support.seq += 1;
    var id = 'CH-' + (7000 + s.support.seq);
    var c = { id: id, by: actor, user: userName(s, actor), topic: p.topic || 'General question', ref: p.ref || null, state: 'QUEUED', agent: null, typing: false,
      startedAt: now, history: [], messages: [{ at: now, from: 'system', text: 'You are in the queue. An agent will join shortly (simulated).' }] };
    s.support.chats[id] = c; s.support.chatOrder.push(id);
    log(s, now, 'chat.started', actor, 'chat:' + id, c.topic, { to: 'QUEUED' });
    if (!chatAgentsUp(s)) {
      move(s, now, 'chat', c, 'no_agents', 'system', 'chat:' + id, 'No agents available');
      c.messages.push({ at: now, from: 'system', text: 'No agents are available right now. You can leave a ticket and we will reply by message.' });
    } else if (s.opts.auto.support) addTimer(s, now + this.dur('chatAssign'), 'chat.assign', id);
    return ok({ chatId: id });
  };
  COMMANDS['chat.send'] = function (s, now, actor, p) {
    var c = s.support.chats[p.id]; if (!c) return fail('no_chat', 'Chat not found.');
    if (['ENDED', 'UNAVAILABLE'].indexOf(c.state) >= 0) return fail('ended', 'This chat has ended. Start a new chat or raise a ticket.');
    var text = String(p.text || '').trim();
    if (!text) return fail('validation', 'Write a message first.', { fields: { message: 'Write a message.' } });
    if (text.length > 500) return fail('validation', 'Keep chat messages under 500 characters.', { fields: { message: 'Too long.' } });
    if (actor === 'agent') {
      if (c.state !== 'ACTIVE' || c.agent !== s.support.agent.name) return fail('not_assigned', 'Accept this chat before replying.');
      c.messages.push({ at: now, from: 'agent', name: c.agent, text: text }); c.typing = false;
    } else {
      c.messages.push({ at: now, from: 'user', name: c.user, text: text });
      if (c.state === 'ACTIVE' && s.opts.auto.support) { c.typing = true; addTimer(s, now + this.dur('chatReply'), 'chat.reply', c.id, text); }
    }
    log(s, now, 'chat.message', actor, 'chat:' + c.id, (actor === 'agent' ? 'Agent' : 'User') + ' message');
    return ok();
  };
  COMMANDS['chat.accept'] = function (s, now, actor, p) {
    if (!s.support.agent.signedIn) return fail('signed_out', 'Sign in to the agent console first.');
    var c = s.support.chats[p.id]; if (!c) return fail('no_chat', 'Chat not found.');
    var r = move(s, now, 'chat', c, 'assign', 'agent', 'chat:' + c.id, s.support.agent.name + ' joined');
    if (r.ok) { c.agent = s.support.agent.name; c.messages.push({ at: now, from: 'system', text: c.agent + ' joined the chat.' }); }
    return r;
  };
  COMMANDS['chat.end'] = function (s, now, actor, p) {
    var c = s.support.chats[p.id]; if (!c) return fail('no_chat', 'Chat not found.');
    var r = move(s, now, 'chat', c, 'end', actor === 'agent' ? 'agent' : actor, 'chat:' + c.id, 'Chat ended by ' + (actor === 'agent' ? 'agent' : 'user'));
    if (r.ok) { c.typing = false; c.endedAt = now; c.messages.push({ at: now, from: 'system', text: 'Chat ended. A transcript is kept in this demo session only.' }); }
    return r;
  };
  COMMANDS['chat.escalate'] = function (s, now, actor, p) {
    var c = s.support.chats[p.id]; if (!c) return fail('no_chat', 'Chat not found.');
    var transcript = c.messages.filter(function (m) { return m.from !== 'system'; }).map(function (m) { return (m.name || m.from) + ': ' + m.text; }).join('\n');
    var res = COMMANDS['ticket.create'].call(this, s, now, c.by, { category: p.category || 'booking', issue: c.topic, ref: c.ref,
      description: 'Escalated from chat ' + c.id + '\n' + (transcript || c.topic), priority: 'P2' });
    if (!res.ok) return res;
    if (['QUEUED', 'ACTIVE'].indexOf(c.state) >= 0) COMMANDS['chat.end'].call(this, s, now, actor, { id: c.id });
    c.ticketId = res.ticketId;
    c.messages.push({ at: now, from: 'system', text: 'Ticket #' + res.ticketId + ' created from this chat.' });
    return res;
  };

  // ---- support: voice call-back (simulated, no audio, no permissions)
  COMMANDS['call.request'] = function (s, now, actor, p) {
    if (!USER_ACTORS[actor]) return fail('wrong_actor', 'Call-backs are requested by customers, drivers or partners.');
    if (!String(p.issue || '').trim()) return fail('validation', 'Choose what the call is about.', { fields: { issue: 'Required.' } });
    var open = s.support.callOrder.map(function (id) { return s.support.calls[id]; }).filter(function (c) { return c.by === actor && ['QUEUED', 'RINGING', 'CONNECTED'].indexOf(c.state) >= 0; })[0];
    if (open) return fail('call_open', 'You already have a call in progress.', { callId: open.id });
    s.support.seq += 1;
    var id = 'CL-' + (3000 + s.support.seq);
    var c = { id: id, by: actor, user: userName(s, actor), issue: p.issue, ref: p.ref || null, state: 'QUEUED', position: 2, requestedAt: now, connectedAt: 0, endedAt: 0, history: [], agent: null };
    s.support.calls[id] = c; s.support.callOrder.push(id);
    log(s, now, 'call.requested', actor, 'call:' + id, 'Call-back: ' + c.issue + ' (simulated – no phone call is made)', { to: 'QUEUED' });
    addTimer(s, now + this.dur('callQueue') / 2, 'call.queue', id);
    addTimer(s, now + this.dur('callQueue'), 'call.dial', id);
    return ok({ callId: id });
  };
  function callCmd(event, note) {
    return function (s, now, actor, p) {
      var c = s.support.calls[p.id]; if (!c) return fail('no_call', 'Call not found.');
      var r = move(s, now, 'call', c, event, actor === 'agent' ? 'agent' : actor, 'call:' + c.id, note);
      if (r.ok && event === 'answer') { c.connectedAt = now; c.agent = DATA.AGENTS[1]; dropTimers(s, function (t) { return t.ref === c.id; }); }
      if (r.ok && (event === 'hang_up' || event === 'decline' || event === 'cancel')) { c.endedAt = now; dropTimers(s, function (t) { return t.ref === c.id; }); }
      return r;
    };
  }
  COMMANDS['call.answer'] = callCmd('answer', 'Connected to support (simulated)');
  COMMANDS['call.decline'] = callCmd('decline', 'Call declined');
  COMMANDS['call.cancel'] = callCmd('cancel', 'Call-back cancelled');
  COMMANDS['call.hangUp'] = callCmd('hang_up', 'Call ended');
  COMMANDS['call.escalate'] = function (s, now, actor, p) {
    var c = s.support.calls[p.id]; if (!c) return fail('no_call', 'Call not found.');
    var dur = c.connectedAt ? Math.round(((c.endedAt || now) - c.connectedAt) / 1000) : 0;
    var res = COMMANDS['ticket.create'].call(this, s, now, c.by, { category: p.category || 'booking', issue: c.issue, ref: c.ref, priority: 'P2',
      description: 'Follow-up from support call ' + c.id + ' (' + c.state.toLowerCase() + (dur ? ', ' + dur + ' s' : '') + ').' });
    if (res.ok) c.ticketId = res.ticketId;
    return res;
  };

  // ---- partner bookings (hotel, rental, bus)
  COMMANDS['booking.act'] = function (s, now, actor, p) {
    var b = s.bookings[p.id]; if (!b) return fail('no_booking', 'Booking not found.');
    if (s.session.partner.status !== 'signed_in') return fail('signed_out', 'Sign in to the partner app first.', { go: 'P08' });
    if (p.event === 'check_in' && b.kind === 'rental' && !p.photos) return fail('photos_required', 'Take the four handover photos and the fuel photo first.');
    return move(s, now, 'booking', b, p.event, 'partner', 'booking:' + b.id, p.note || (b.guest + ' · ' + p.event.replace('_', ' ')));
  };
  COMMANDS['partner.signIn'] = function (s, now, actor, p) {
    var errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email || ''))) errors.email = 'Enter the business e-mail you registered with.';
    if (String(p.code || '').replace(/\D/g, '') !== DATA.DEMO_CODES.riderOtp) errors.code = 'Enter the 6-digit demo code.';
    if (Object.keys(errors).length) return fail('validation', 'Please fix the highlighted fields.', { fields: errors });
    s.session.partner.status = 'signed_in';
    log(s, now, 'partner.logged_in', 'partner', 'partner:PTN-301', 'Partner sign-in (simulated)');
    return ok();
  };

  // ---- admin manual dispatch
  COMMANDS['admin.assign'] = function (s, now, actor, p) {
    var r = this.activeRide();
    var den = needAdmin(s) || guardRole(this, s, now, 'ride.dispatch', 'assign a driver manually', 'ride:' + (r ? r.id : '-')); if (den) return den;
    if (!r || ['SEARCHING_DRIVER', 'DRIVER_ASSIGNED'].indexOf(r.state) < 0) return fail('not_searching', 'Manual dispatch is possible only while a ride is searching for a driver.');
    var d = s.drivers[p.driverId];
    if (!d || d.avail !== 'ONLINE' || d.blocked) return fail('driver_unavailable', 'That driver is not online and available.');
    r.offers.forEach(function (o) { if (o.state === 'PENDING') o.state = 'WITHDRAWN'; });
    dropTimers(s, function (t) { return t.ref === r.id && (t.type === 'offer.expire' || t.type === 'offer.respond'); });
    if (r.state === 'DRIVER_ASSIGNED') move(s, now, 'ride', r, 'offer.expired', 'system', 'ride:' + r.id, 'Offer withdrawn for manual dispatch');
    var o = { id: r.id + '-O' + (r.offers.length + 1), driverId: d.id, state: 'PENDING', sentAt: now, expiresAt: now + this.dur('offer'), planned: 'accept', manual: true };
    r.offers.push(o);
    move(s, now, 'ride', r, 'offer.sent', 'system', 'ride:' + r.id, 'Manual dispatch by ' + s.session.admin.role + ' to ' + d.short);
    return this._answerOffer(s, now, r, o, 'accept', 'driver');
  };
  COMMANDS['admin.driverStatus'] = function (s, now, actor, p) {
    var d = s.drivers[p.driverId]; if (!d) return fail('no_driver', 'Driver not found.');
    var den = needAdmin(s) || guardRole(this, s, now, 'fraud.block_account', (p.blocked ? 'pause' : 'reactivate') + ' a driver', 'driver:' + d.id); if (den) return den;
    if (p.blocked && d.avail === 'ON_TRIP') return fail('on_trip', d.short + ' is on a trip. Pause after the trip ends.');
    d.blocked = !!p.blocked; if (d.blocked) d.avail = 'OFFLINE';
    log(s, now, p.blocked ? 'admin.driver_paused' : 'admin.driver_reactivated', 'admin', 'driver:' + d.id, d.short);
    return ok();
  };

  // ---- small simulated features (recorded so they appear in the event history)
  COMMANDS['rider.priority'] = function (s, now, actor, p) {
    var map = { urgent: 'urgent', balanced: 'bal', bal: 'bal', saver: 'saver', flexible: 'flex', flex: 'flex', deals: 'deals' };
    var k = map[String(p.arg || '').toLowerCase().split(' ')[0]];
    if (!k) return fail('validation', 'Unknown priority');
    s.rider.priority = k;
    log(s, now, 'user.priority_changed', 'rider', 'rider:' + s.rider.id, 'Priority: ' + p.arg);
    return ok();
  };
  COMMANDS['support.ticket'] = function (s, now, actor, p) {
    var id = 'T-' + String(52000 + s.seq);
    log(s, now, 'ticket.created', actor, 'ticket:' + id, (p.arg || 'Support request') + ' (simulated)');
    return ok({ ticketId: id });
  };
  COMMANDS['sim.note'] = function (s, now, actor, p) {
    log(s, now, p.event || 'sim.action', actor, p.ref || '-', p.arg || 'Simulated action');
    return ok();
  };

  // ---- demo controls
  COMMANDS['demo.network'] = function (s, now, actor, p) {
    var app = p.app, mode = p.mode === 'offline' ? 'offline' : 'online';
    if (!s.net[app]) return fail('bad_app', 'Unknown app');
    s.net[app] = mode;
    log(s, now, mode === 'offline' ? 'network.lost' : 'network.restored', 'system', 'device:' + app, app + ' app ' + mode + ' (simulated)');
    if (mode === 'online') {
      var mine = s.queue.filter(function (q) { return ACTOR_APP[q.actor] === app; });
      s.queue = s.queue.filter(function (q) { return ACTOR_APP[q.actor] !== app; });
      var self = this;
      mine.forEach(function (q) {
        var h = COMMANDS[q.cmd], payload = Object.assign({}, q.payload, { fromQueue: true });
        var res = h.call(self, s, now, q.actor, payload) || ok();
        log(s, now, res.ok ? 'sync.replayed' : 'sync.conflict', q.actor, q.cmd, res.ok ? 'Queued "' + q.cmd + '" from ' + new Date(q.at).toLocaleTimeString() + ' applied' : 'Queued "' + q.cmd + '" rejected: ' + res.error);
      });
      if (mine.length) log(s, now, 'ride.reconciled', 'system', 'device:' + app, mine.length + ' queued action(s) reconciled');
    }
    return ok({ replayed: mine ? mine.length : 0 });
  };
  COMMANDS['demo.webhook'] = function (s, now, actor, p) {
    var r = this.lastRide();
    if (!r || r.state !== 'PAYMENT_PENDING') return fail('nothing_pending', 'No payment is waiting for the gateway.');
    var keep = s.opts.payment; s.opts.payment = p.outcome || 'success'; r.payment.attempts = p.outcome === 'fail' ? 1 : r.payment.attempts;
    this._webhook(s, now, r); s.opts.payment = keep;
    return ok();
  };

  function rideScreen(r) {
    if (!r) return 'R07';
    switch (r.state) {
      case 'REQUESTED': case 'SEARCHING_DRIVER': case 'DRIVER_ASSIGNED': case 'NO_DRIVER_FOUND': return 'R11';
      case 'DRIVER_ACCEPTED': case 'DRIVER_ARRIVING': case 'DRIVER_ARRIVED': return 'R12';
      case 'TRIP_STARTED': case 'TRIP_IN_PROGRESS': return 'R15';
      default: return 'R17';
    }
  }
  function driverScreen(r, persona) {
    if (!r || r.driverId !== persona) return null;
    switch (r.state) {
      case 'DRIVER_ACCEPTED': case 'DRIVER_ARRIVING': return 'D08';
      case 'DRIVER_ARRIVED': return 'D09';
      case 'TRIP_STARTED': case 'TRIP_IN_PROGRESS': return 'D10';
      case 'TRIP_COMPLETED': case 'PAYMENT_PENDING': case 'PAYMENT_COMPLETED': case 'PAYMENT_FAILED': return 'D11';
      default: return null;
    }
  }

  return { Engine: Engine, seed: seed, KEY: KEY, DUR: DUR, COMMANDS: COMMANDS, ACTIVE_RIDE: ACTIVE_RIDE, QUEUEABLE: QUEUEABLE,
    rupees: rupees, rideScreen: rideScreen, driverScreen: driverScreen, memoryStorage: memoryStorage, CANCEL_FEE_PAISE: CANCEL_FEE_PAISE };
});
