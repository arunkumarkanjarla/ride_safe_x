/* RideNova prototype – state machines.
   Source of truth for every legal transition the mock engine allows. Derived from the architecture
   pages (03 ride, 04 dispatch, 06 payments, 08 incidents, 20 food) and documented in
   docs/workflows/state-machines.md. Each transition: [from(s), event, to, actors]. */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else { root.RN = root.RN || {}; root.RN.machines = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BEFORE_TRIP = ['REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'];

  var M = {
    ride: {
      initial: 'REQUESTED',
      final: ['CLOSED', 'CANCELLED', 'NO_DRIVER_FOUND'],
      t: [
        ['REQUESTED', 'search.start', 'SEARCHING_DRIVER', ['system']],
        ['SEARCHING_DRIVER', 'offer.sent', 'DRIVER_ASSIGNED', ['system']],
        ['SEARCHING_DRIVER', 'search.exhausted', 'NO_DRIVER_FOUND', ['system']],
        ['DRIVER_ASSIGNED', 'offer.accepted', 'DRIVER_ACCEPTED', ['driver']],
        ['DRIVER_ASSIGNED', 'offer.declined', 'SEARCHING_DRIVER', ['driver']],
        ['DRIVER_ASSIGNED', 'offer.expired', 'SEARCHING_DRIVER', ['system']],
        ['DRIVER_ACCEPTED', 'driver.en_route', 'DRIVER_ARRIVING', ['system']],
        [['DRIVER_ACCEPTED', 'DRIVER_ARRIVING'], 'driver.arrived', 'DRIVER_ARRIVED', ['driver', 'system']],
        [BEFORE_TRIP, 'ride.cancel', 'CANCELLED', ['rider', 'driver', 'admin']],
        ['DRIVER_ARRIVED', 'trip.start', 'TRIP_STARTED', ['driver']],
        ['TRIP_STARTED', 'trip.progress', 'TRIP_IN_PROGRESS', ['system']],
        [['TRIP_STARTED', 'TRIP_IN_PROGRESS'], 'trip.end', 'TRIP_COMPLETED', ['driver']],
        ['TRIP_COMPLETED', 'payment.request', 'PAYMENT_PENDING', ['system']],
        ['PAYMENT_PENDING', 'payment.captured', 'PAYMENT_COMPLETED', ['gateway', 'driver']],
        ['PAYMENT_PENDING', 'payment.failed', 'PAYMENT_FAILED', ['gateway']],
        ['PAYMENT_FAILED', 'payment.settled', 'PAYMENT_COMPLETED', ['rider', 'admin']],
        ['PAYMENT_COMPLETED', 'ride.close', 'CLOSED', ['system']]
      ]
    },
    offer: {
      initial: 'PENDING', final: ['ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'],
      t: [['PENDING', 'accept', 'ACCEPTED', ['driver']], ['PENDING', 'decline', 'DECLINED', ['driver']],
          ['PENDING', 'expire', 'EXPIRED', ['system']], ['PENDING', 'withdraw', 'WITHDRAWN', ['system']]]
    },
    payment: {
      initial: 'CREATED', final: ['SETTLED', 'REFUNDED'],
      t: [['CREATED', 'authorise', 'AUTHORISED', ['gateway']], [['CREATED', 'AUTHORISED'], 'capture', 'CAPTURED', ['gateway', 'driver']],
          [['CREATED', 'AUTHORISED'], 'fail', 'FAILED', ['gateway']], ['FAILED', 'retry', 'CREATED', ['system', 'rider']],
          ['CAPTURED', 'settle', 'SETTLED', ['gateway']], [['CAPTURED', 'SETTLED'], 'refund', 'REFUND_PENDING', ['admin']],
          ['REFUND_PENDING', 'refunded', 'REFUNDED', ['gateway']]]
    },
    incident: {
      initial: 'OPEN', final: ['CLOSED', 'FALSE_ALARM'],
      t: [['OPEN', 'acknowledge', 'ACKNOWLEDGED', ['admin']], ['ACKNOWLEDGED', 'work', 'IN_PROGRESS', ['admin']],
          [['ACKNOWLEDGED', 'IN_PROGRESS'], 'escalate', 'ESCALATED', ['admin']],
          [['IN_PROGRESS', 'ESCALATED'], 'resolve', 'RESOLVED', ['admin']], ['RESOLVED', 'close', 'CLOSED', ['admin']],
          [['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'], 'false_alarm', 'FALSE_ALARM', ['admin']]]
    },
    order: {
      initial: 'PLACED', final: ['DELIVERED', 'REJECTED', 'CANCELLED'],
      t: [['PLACED', 'accept', 'ACCEPTED', ['partner']], ['PLACED', 'reject', 'REJECTED', ['partner', 'system']],
          ['ACCEPTED', 'prepare', 'PREPARING', ['partner', 'system']], ['PREPARING', 'ready', 'READY', ['partner']],
          ['READY', 'pickup', 'PICKED_UP', ['driver']], ['PICKED_UP', 'deliver', 'DELIVERED', ['driver']],
          ['PLACED', 'cancel', 'CANCELLED', ['rider', 'admin']], [['ACCEPTED', 'PREPARING', 'READY'], 'cancel', 'CANCELLED', ['admin']]]
    },
    kyc: {
      initial: 'DRAFT', final: ['ACTIVE', 'REJECTED'],
      t: [[['DRAFT', 'REUPLOAD_REQUESTED'], 'submit', 'IN_REVIEW', ['driver']], ['IN_REVIEW', 'approve', 'APPROVED', ['admin']],
          ['IN_REVIEW', 'reupload', 'REUPLOAD_REQUESTED', ['admin']], ['IN_REVIEW', 'reject', 'REJECTED', ['admin']],
          ['APPROVED', 'activate', 'ACTIVE', ['driver']]]
    },
    // ---- support portal (new in the static application phase; policies are assumptions, see docs/static-app/workflows.md)
    ticket: {
      initial: 'OPEN', final: ['CLOSED'],
      t: [['OPEN', 'assign', 'IN_PROGRESS', ['agent']], [['IN_PROGRESS', 'ESCALATED', 'REOPENED'], 'assign', 'IN_PROGRESS', ['agent']],
          ['IN_PROGRESS', 'ask_user', 'WAITING_ON_USER', ['agent']], ['WAITING_ON_USER', 'user_reply', 'IN_PROGRESS', ['rider', 'driver', 'partner']],
          [['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'REOPENED'], 'escalate', 'ESCALATED', ['agent']],
          [['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'ESCALATED', 'REOPENED'], 'resolve', 'RESOLVED', ['agent']],
          [['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'REOPENED'], 'close', 'CLOSED', ['rider', 'driver', 'partner', 'agent']],
          [['RESOLVED', 'CLOSED'], 'reopen', 'REOPENED', ['rider', 'driver', 'partner', 'agent']]]
    },
    chat: {
      initial: 'QUEUED', final: ['ENDED', 'UNAVAILABLE'],
      t: [['QUEUED', 'assign', 'ACTIVE', ['agent', 'system']], ['QUEUED', 'no_agents', 'UNAVAILABLE', ['system']],
          [['QUEUED', 'ACTIVE'], 'end', 'ENDED', ['rider', 'driver', 'partner', 'agent']]]
    },
    call: {
      initial: 'QUEUED', final: ['ENDED', 'BUSY', 'MISSED', 'FAILED', 'CANCELLED'],
      t: [['QUEUED', 'ring', 'RINGING', ['system']], ['QUEUED', 'busy', 'BUSY', ['system']], [['QUEUED', 'RINGING'], 'fail', 'FAILED', ['system']],
          ['QUEUED', 'cancel', 'CANCELLED', ['rider', 'driver', 'partner']], ['RINGING', 'answer', 'CONNECTED', ['rider', 'driver', 'partner']],
          ['RINGING', 'decline', 'MISSED', ['rider', 'driver', 'partner']], ['RINGING', 'timeout', 'MISSED', ['system']],
          ['CONNECTED', 'hang_up', 'ENDED', ['rider', 'driver', 'partner', 'agent']]]
    },
    booking: {
      initial: 'PENDING', final: ['COMPLETED', 'DECLINED', 'CANCELLED'],
      t: [['PENDING', 'confirm', 'CONFIRMED', ['partner']], ['PENDING', 'decline', 'DECLINED', ['partner']],
          ['CONFIRMED', 'check_in', 'CHECKED_IN', ['partner']], ['CHECKED_IN', 'complete', 'COMPLETED', ['partner']],
          [['PENDING', 'CONFIRMED'], 'cancel', 'CANCELLED', ['rider', 'admin']]]
    },
    availability: {
      initial: 'OFFLINE', final: [],
      t: [['OFFLINE', 'go_online', 'ONLINE', ['driver']], ['ONLINE', 'go_offline', 'OFFLINE', ['driver', 'system']],
          ['ONLINE', 'assign', 'ON_TRIP', ['system']], ['ON_TRIP', 'release', 'ONLINE', ['system']]]
    }
  };

  function find(machine, from, event) {
    var m = M[machine];
    for (var i = 0; i < m.t.length; i++) {
      var tr = m.t[i], froms = Array.isArray(tr[0]) ? tr[0] : [tr[0]];
      if (tr[1] === event && froms.indexOf(from) >= 0) return { from: from, event: event, to: tr[2], actors: tr[3] };
    }
    return null;
  }

  /* Returns {ok:true,to} or {ok:false,code,error}. Never mutates. */
  function check(machine, from, event, actor) {
    var tr = find(machine, from, event);
    if (!tr) return { ok: false, code: 'illegal_transition', error: 'Not allowed now: "' + event + '" cannot happen while ' + machine + ' is ' + from + '.' };
    if (tr.actors.indexOf(actor) < 0) return { ok: false, code: 'wrong_actor', error: 'Only ' + tr.actors.join(' or ') + ' can do "' + event + '".' };
    return { ok: true, to: tr.to };
  }

  function events(machine, from) {
    return M[machine].t.filter(function (tr) { return (Array.isArray(tr[0]) ? tr[0] : [tr[0]]).indexOf(from) >= 0; })
      .map(function (tr) { return { event: tr[1], to: tr[2], actors: tr[3] }; });
  }

  function states(machine) {
    var s = [M[machine].initial];
    M[machine].t.forEach(function (tr) { (Array.isArray(tr[0]) ? tr[0] : [tr[0]]).concat([tr[2]]).forEach(function (x) { if (s.indexOf(x) < 0) s.push(x); }); });
    return s;
  }

  // The brief's simplified names, for documentation and the state inspector.
  var BRIEF_NAMES = { REQUESTED: 'REQUESTED', SEARCHING_DRIVER: 'MATCHING', DRIVER_ASSIGNED: 'MATCHING (offer out)', DRIVER_ACCEPTED: 'DRIVER_ASSIGNED',
    DRIVER_ARRIVING: 'DRIVER_ASSIGNED', DRIVER_ARRIVED: 'DRIVER_ARRIVED', TRIP_STARTED: 'IN_PROGRESS', TRIP_IN_PROGRESS: 'IN_PROGRESS',
    TRIP_COMPLETED: 'COMPLETED', PAYMENT_PENDING: 'COMPLETED', PAYMENT_COMPLETED: 'COMPLETED', PAYMENT_FAILED: 'COMPLETED', CLOSED: 'COMPLETED',
    NO_DRIVER_FOUND: 'NO_DRIVER_FOUND', CANCELLED: 'CANCELLED' };

  return { M: M, find: find, check: check, events: events, states: states, BEFORE_TRIP: BEFORE_TRIP, BRIEF_NAMES: BRIEF_NAMES };
});
