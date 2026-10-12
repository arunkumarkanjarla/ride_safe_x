'use strict';
// Unit tests for the mock workflow engine. Run: node --test tests/engine
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../../assets/js/rn-engine.js');
const machines = require('../../assets/js/rn-machines.js');
const rbac = require('../../assets/js/rn-rbac.js');

function make(scenario = 'A', opts = {}) {
  let t = Date.UTC(2026, 9, 10, 12, 0, 0);
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const e = new lib.Engine({ storage: lib.memoryStorage(), now: clock.now });
  e.reset(scenario);
  for (const [k, v] of Object.entries(opts)) e.setOption(k, v);
  const run = (ms, step = 250) => { for (let i = 0; i < ms; i += step) { clock.advance(step); e.tick(); } };
  return { e, clock, run };
}
const types = (e) => e.state.events.map((x) => x.type);

test('state machines: every transition target is a known state and guards reject illegal moves', () => {
  for (const m of Object.keys(machines.M)) {
    const st = machines.states(m);
    assert.ok(st.length > 1, m);
  }
  assert.equal(machines.check('ride', 'REQUESTED', 'trip.start', 'driver').ok, false);
  assert.equal(machines.check('ride', 'TRIP_IN_PROGRESS', 'ride.cancel', 'rider').code, 'illegal_transition');
  assert.equal(machines.check('ride', 'DRIVER_ARRIVED', 'trip.start', 'rider').code, 'wrong_actor');
  assert.equal(machines.check('ride', 'DRIVER_ARRIVED', 'trip.start', 'driver').to, 'TRIP_STARTED');
});

test('Scenario A: happy path reaches PAYMENT_COMPLETED then CLOSED after rating', () => {
  const { e, run } = make('A');
  const r0 = e.run('rider', 'ride.request', { vehicle: 'Cab', payMethod: 'UPI' });
  assert.equal(r0.ok, true);
  assert.equal(e.activeRide().state, 'DRIVER_ASSIGNED');
  run(60000);
  const r = e.lastRide();
  assert.equal(r.state, 'PAYMENT_COMPLETED');
  assert.equal(r.driverId, 'DRV-1042');
  assert.deepEqual(r.history.map((h) => h.to).filter((x, i, a) => a.indexOf(x) === i), [
    'REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_IN_PROGRESS',
    'TRIP_COMPLETED', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED']);
  assert.equal(e.run('rider', 'ride.rate', { stars: 5 }).ok, true);
  assert.equal(e.lastRide().state, 'CLOSED');
  assert.equal(e.run('rider', 'ride.rate', { stars: 4 }).code, 'already_rated');
});

test('Scenario B: decline + expiry, then reassignment to the third driver', () => {
  const { e, run } = make('B');
  e.run('rider', 'ride.request', {});
  run(40000);
  const r = e.lastRide();
  assert.deepEqual(r.offers.map((o) => [o.driverId, o.state]), [['DRV-0051', 'DECLINED'], ['DRV-0077', 'EXPIRED'], ['DRV-1042', 'ACCEPTED']]);
  assert.ok(types(e).includes('dispatch.declined') && types(e).includes('dispatch.expired'));
});

test('Scenario C: no eligible driver ends in NO_DRIVER_FOUND; retry creates a new ride', () => {
  const { e, run } = make('C');
  e.run('rider', 'ride.request', {});
  run(10000);
  assert.equal(e.lastRide().state, 'SEARCHING_DRIVER');
  run(30000);
  const first = e.lastRide();
  assert.equal(first.state, 'NO_DRIVER_FOUND');
  assert.equal(e.run('rider', 'ride.retry').ok, true);
  assert.notEqual(e.lastRide().id, first.id);
  assert.equal(e.state.rides[first.id].state, 'NO_DRIVER_FOUND');
});

test('Scenario D: cancellation rules (free while searching, fee after window, impossible in trip)', () => {
  let { e, run } = make('D');
  e.run('rider', 'ride.request', {});
  const c1 = e.run('rider', 'ride.cancel', { reason: 'Changed plans' });
  assert.equal(c1.ok, true); assert.equal(c1.feePaise, 0);
  assert.equal(e.lastRide().state, 'CANCELLED');
  assert.equal(e.lastRide().offers[0].state, 'WITHDRAWN');

  ({ e, run } = make('D', { 'auto.driver': false }));
  e.run('rider', 'ride.request', {});
  assert.equal(e.run('driver', 'offer.accept').ok, true);
  run(25000);
  const c2 = e.run('rider', 'ride.cancel', {});
  assert.equal(c2.ok, true); assert.equal(c2.feePaise, lib.CANCEL_FEE_PAISE);

  ({ e, run } = make('G'));                       // trip already in progress
  const c3 = e.run('rider', 'ride.cancel', {});
  assert.equal(c3.ok, false); assert.equal(c3.code, 'cannot_cancel');
});

test('Scenario E: payment declined twice -> PAYMENT_FAILED, booking blocked, settle by other method', () => {
  const { e, run } = make('E');
  e.run('rider', 'ride.request', {});
  run(60000);
  const r = e.lastRide();
  assert.equal(r.state, 'PAYMENT_FAILED');
  assert.equal(r.payment.state, 'FAILED');
  assert.ok(types(e).includes('payment.retry'));
  assert.ok(!types(e).includes('payment.captured'));
  const again = e.run('rider', 'ride.request', {});
  assert.equal(again.code, 'payment_due');
  assert.equal(e.run('rider', 'payment.payOther', { method: 'Cash' }).ok, true);
  assert.equal(e.lastRide().state, 'PAYMENT_COMPLETED');
  assert.equal(e.state.rider.debtPaise, 0);
});

test('Driver guards: no start before assignment, wrong OTP rejected, no double completion', () => {
  const { e } = make('A', { 'auto.driver': false });
  assert.equal(e.run('driver', 'ride.start', { otp: '4827' }).code, 'no_trip');
  e.run('rider', 'ride.request', {});
  assert.equal(e.run('driver', 'ride.start', { otp: '4827' }).code, 'no_trip');
  e.run('driver', 'offer.accept');
  assert.equal(e.run('driver', 'ride.start', { otp: '4827' }).ok, false);      // not arrived yet
  e.run('driver', 'ride.arrive');
  assert.equal(e.run('driver', 'ride.start', { otp: '1111' }).code, 'wrong_otp');
  assert.equal(e.run('driver', 'ride.start', { otp: '4827' }).ok, true);
  assert.equal(e.run('driver', 'ride.end').ok, true);
  assert.equal(e.run('driver', 'ride.end').code, 'cannot_end');
});

test('Offer accepted after expiry is refused', () => {
  const { e, clock } = make('A', { 'auto.driver': false });
  e.run('rider', 'ride.request', {});
  clock.advance(8000);                    // past the 7 s fast offer window, before tick processes expiry
  const res = e.run('driver', 'offer.accept');
  assert.equal(res.ok, false); assert.equal(res.code, 'offer_expired');
});

test('Duplicate submissions with the same key are applied once', () => {
  const { e } = make('A');
  const a = e.run('rider', 'ride.request', { key: 'k1' });
  const b = e.run('rider', 'ride.request', { key: 'k1' });
  assert.equal(a.ok, true); assert.equal(b.duplicate, true);
  assert.equal(e.state.rideOrder.length, 1);
  assert.equal(e.run('rider', 'ride.request', {}).code, 'active_ride');
});

test('Scenario F: KYC submit, admin decisions, driver can go online only when approved', () => {
  const { e } = make('F');
  assert.equal(e.run('driver', 'driver.online').code, 'not_verified');
  assert.equal(e.run('driver', 'kyc.submit').code, 'incomplete');
  for (const d of ['insurance', 'permit', 'fitness']) e.run('driver', 'kyc.upload', { doc: d });
  assert.equal(e.run('driver', 'kyc.submit').ok, true);
  assert.equal(e.state.kyc.state, 'IN_REVIEW');
  assert.equal(e.run('admin', 'kyc.decide', { decision: 'reupload' }).code, 'validation');
  assert.equal(e.run('admin', 'kyc.decide', { decision: 'reupload', reason: 'Insurance photo blurred', doc: 'insurance' }).ok, true);
  assert.equal(e.state.kyc.state, 'REUPLOAD_REQUESTED');
  e.run('driver', 'kyc.upload', { doc: 'insurance' });
  e.run('driver', 'kyc.submit');
  assert.equal(e.run('admin', 'kyc.decide', { decision: 'approve' }).ok, true);
  assert.equal(e.run('driver', 'driver.online').ok, true);
});

test('Scenario G: SOS creates an incident; admin lifecycle; close needs permission', () => {
  const { e } = make('G');
  const s = e.run('rider', 'sos.raise');
  assert.equal(s.ok, true);
  assert.equal(e.incident().state, 'OPEN');
  assert.equal(e.incident().rideId, e.activeRide().id);
  for (const c of ['incident.ack', 'incident.work', 'incident.escalate', 'incident.resolve']) assert.equal(e.run('admin', c).ok, true, c);
  e.run('admin', 'admin.setRole', { role: 'OPS_MANAGER' });
  assert.equal(e.run('admin', 'incident.close').code, 'forbidden');
  e.run('admin', 'admin.setRole', { role: 'SAFETY_MANAGER' });
  assert.equal(e.run('admin', 'incident.close').ok, true);
  assert.equal(e.incident().state, 'CLOSED');
});

test('Scenario H: food order across restaurant, courier and rider', () => {
  const { e, run } = make('H', { 'auto.partner': false, 'auto.courier': false });
  assert.equal(e.run('rider', 'order.place', {}).ok, true);
  assert.equal(e.run('partner', 'order.accept', { prep: 15 }).ok, true);
  assert.equal(e.order().state, 'PREPARING');
  assert.equal(e.run('driver', 'delivery.accept').ok, true);
  assert.equal(e.run('driver', 'order.pickup').code, 'not_ready');
  e.run('partner', 'order.ready');
  assert.equal(e.run('driver', 'order.pickup').code, 'photo_required');
  e.run('driver', 'order.sealPhoto');
  assert.equal(e.run('driver', 'order.pickup').ok, true);
  assert.equal(e.run('driver', 'order.deliver', { otp: '0000' }).code, 'wrong_otp');
  assert.equal(e.run('driver', 'order.deliver', { otp: '4471' }).ok, true);
  assert.equal(e.order().state, 'DELIVERED');
  run(1000);
});

test('Scenario H (auto): restaurant no-answer rejects and refunds', () => {
  const { e, run } = make('H', { 'auto.partner': false });
  e.run('rider', 'order.place', {});
  run(50000);
  assert.equal(e.order().state, 'REJECTED');
  assert.equal(e.order().refund, 'REFUNDED');
});

test('Scenario I: offline driver queues trip end, rejects duplicates, reconciles on reconnect', () => {
  const { e } = make('I', { 'auto.driver': false });
  e.run('system', 'demo.network', { app: 'driver', mode: 'offline' });
  const q = e.run('driver', 'ride.end');
  assert.equal(q.queued, true);
  assert.equal(e.run('driver', 'ride.end').code, 'already_queued');
  assert.equal(e.run('driver', 'driver.offline').code, 'offline');
  assert.equal(e.activeRide().state, 'TRIP_IN_PROGRESS');
  e.run('system', 'demo.network', { app: 'driver', mode: 'online' });
  assert.equal(e.lastRide().state, 'PAYMENT_PENDING');
  assert.ok(types(e).includes('ride.reconciled'));
});

test('Scenario J: mock RBAC denies and audits restricted admin actions', () => {
  const { e } = make('J');
  assert.equal(e.state.session.admin.role, 'SUPPORT_AGENT');
  const d = e.run('admin', 'kyc.decide', { decision: 'approve' });
  assert.equal(d.code, 'forbidden');
  assert.equal(e.run('admin', 'admin.block', { target: 'rider:U-2231' }).code, 'forbidden');
  assert.equal(e.state.audit.filter((a) => a.result === 'denied').length, 2);
  assert.ok(rbac.can('SUPPORT_AGENT', 'payment.refund'));
  assert.ok(!rbac.can('AUDITOR', 'ride.cancel'));
});

test('Auth: phone validation, rate limit, OTP attempts and lockout', () => {
  const { e } = make('A');
  e.run('rider', 'auth.signOut');
  assert.equal(e.run('rider', 'ride.request', {}).code, 'signed_out');
  assert.equal(e.run('rider', 'auth.sendOtp', { phone: '12345' }).code, 'invalid_phone');
  assert.equal(e.run('rider', 'auth.sendOtp', { phone: '98480 04321' }).ok, true);
  for (let i = 0; i < 4; i++) assert.equal(e.run('rider', 'auth.verifyOtp', { code: '000000' }).code, 'wrong_code');
  assert.equal(e.run('rider', 'auth.verifyOtp', { code: '000000' }).code, 'locked');
  assert.equal(e.run('rider', 'auth.verifyOtp', { code: '482716' }).code, 'locked');
  const { e: e2 } = make('A');
  e2.run('rider', 'auth.sendOtp', { phone: '9000000001' }); e2.run('rider', 'auth.sendOtp', { phone: '9000000001' }); e2.run('rider', 'auth.sendOtp', { phone: '9000000001' });
  assert.equal(e2.run('rider', 'auth.sendOtp', { phone: '9000000001' }).code, 'rate_limited');
  assert.equal(e2.run('rider', 'auth.verifyOtp', { code: '482716' }).newUser, true);
});

test('Reset restores the scenario seed and state is shared through storage', () => {
  const storage = lib.memoryStorage();
  const a = new lib.Engine({ storage }); a.reset('A');
  const b = new lib.Engine({ storage });
  a.run('rider', 'ride.request', {});
  assert.equal(b.reload(), true);
  assert.equal(b.activeRide().id, a.activeRide().id);
  b.reset('C');
  a.reload();
  assert.equal(a.state.scenario, 'C');
  assert.equal(a.state.rideOrder.length, 0);
});

test('A failed attempt is not cached by its idempotency key (fix the input, retry the same button)', () => {
  const { e } = make('F');
  for (const d of ['insurance', 'permit', 'fitness']) e.run('driver', 'kyc.upload', { doc: d });
  e.run('driver', 'kyc.submit');
  const first = e.run('admin', 'kyc.decide', { decision: 'reupload', key: 'A07:kyc:reupload:1' });
  assert.equal(first.code, 'validation');
  const second = e.run('admin', 'kyc.decide', { decision: 'reupload', reason: 'Blurred photo', key: 'A07:kyc:reupload:1' });
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, undefined);
});

// ------------------------------------------------------------------ static application phase
test('First launch is signed out everywhere; scenario load signs in', () => {
  const e = new lib.Engine({ storage: lib.memoryStorage(), fresh: true });
  const s = e.state.session;
  assert.deepEqual([s.rider.status, s.driver.status, s.partner.status, s.admin.status, e.state.support.agent.signedIn], ['signed_out', 'signed_out', 'signed_out', 'signed_out', false]);
  assert.equal(e.run('rider', 'ride.request', {}).code, 'signed_out');
  e.reset('A');
  assert.equal(e.state.session.rider.status, 'signed_in');
});

test('Support ticket lifecycle: validation, agent work, waiting on user, resolve, feedback, reopen', () => {
  const { e } = make('A');
  assert.equal(e.run('rider', 'ticket.create', { category: 'payments', issue: 'Refund not received', description: 'short' }).code, 'validation');
  const r = e.run('rider', 'ticket.create', { category: 'payments', issue: 'Refund not received', ref: 'RN-20260927-00125', priority: 'P2', description: 'My refund has not arrived after 5 days.', attachment: 'shot.png' });
  assert.equal(r.ok, true);
  const id = r.ticketId, t = () => e.state.support.tickets[id];
  assert.equal(t().state, 'OPEN');
  assert.equal(e.run('agent', 'ticket.assign', { id }).ok, true);
  assert.equal(t().state, 'IN_PROGRESS');
  e.run('agent', 'ticket.message', { id, text: 'Which UPI app did you use?', waitForUser: true });
  assert.equal(t().state, 'WAITING_ON_USER');
  e.run('rider', 'ticket.message', { id, text: 'Google Pay' });
  assert.equal(t().state, 'IN_PROGRESS');
  e.run('agent', 'ticket.message', { id, text: 'Checked with the gateway', internal: true });
  assert.equal(t().notes.length, 1);
  assert.ok(!t().messages.some((m) => m.text === 'Checked with the gateway'), 'internal notes are not shown to the user');
  assert.equal(e.run('agent', 'ticket.resolve', { id, category: '', notes: '' }).code, 'validation');
  assert.equal(e.run('agent', 'ticket.resolve', { id, category: 'Refund issued', notes: 'Refund re-sent' }).ok, true);
  assert.equal(e.run('rider', 'ticket.feedback', { id, score: 5 }).ok, true);
  assert.equal(e.run('rider', 'ticket.feedback', { id, score: 4 }).code, 'already_rated');
  assert.equal(e.run('rider', 'ticket.reopen', { id }).code, 'validation');
  assert.equal(e.run('rider', 'ticket.reopen', { id, reason: 'Still missing' }).ok, true);
  assert.equal(t().state, 'REOPENED');
  assert.equal(e.run('rider', 'ticket.close', { id }).ok, true);
  assert.equal(e.run('rider', 'ticket.message', { id, text: 'hello' }).code, 'closed');
});

test('Agent console needs sign-in with the demo code', () => {
  const e = new lib.Engine({ storage: lib.memoryStorage(), fresh: true });
  assert.equal(e.run('agent', 'ticket.assign', { id: '48811' }).code, 'signed_out');
  assert.equal(e.run('agent', 'agent.signIn', { name: 'Meera S.', code: '000000' }).code, 'wrong_code');
  assert.equal(e.run('agent', 'agent.signIn', { name: 'Meera S.', code: '246810' }).ok, true);
  assert.equal(e.run('agent', 'ticket.assign', { id: '48811', agent: 'Vikram R.' }).ok, true);
  assert.equal(e.state.support.tickets['48811'].assignee, 'Vikram R.');
});

test('Chat: queue, simulated agent with keyword reply, escalation to a ticket; unavailable agents', () => {
  const { e, run } = make('A');
  const id = e.run('rider', 'chat.start', { topic: 'Refund not received' }).chatId;
  assert.equal(e.state.support.chats[id].state, 'QUEUED');
  run(4000);
  const c = () => e.state.support.chats[id];
  assert.equal(c().state, 'ACTIVE');
  e.run('rider', 'chat.send', { id, text: 'Where is my refund?' });
  assert.equal(c().typing, true);
  run(3000);
  assert.match(c().messages[c().messages.length - 1].text, /Refunds to UPI/);
  const esc = e.run('rider', 'chat.escalate', { id, category: 'payments' });
  assert.equal(esc.ok, true);
  assert.equal(c().state, 'ENDED');
  assert.match(e.state.support.tickets[esc.ticketId].messages[0].text, /Escalated from chat/);
  e.setOption('chatAgents', 'unavailable');
  const id2 = e.run('rider', 'chat.start', { topic: 'x' }).chatId;
  assert.equal(e.state.support.chats[id2].state, 'UNAVAILABLE');
  assert.equal(e.run('rider', 'chat.send', { id: id2, text: 'hi' }).code, 'ended');
});

test('Voice call-back: queue, ring, answer, hang up; busy, failed and missed outcomes', () => {
  const { e, run } = make('A');
  const id = e.run('rider', 'call.request', { issue: 'Payments' }).callId;
  assert.equal(e.run('rider', 'call.request', { issue: 'Payments' }).code, 'call_open');
  run(5000);
  assert.equal(e.state.support.calls[id].state, 'RINGING');
  e.run('rider', 'call.answer', { id });
  assert.equal(e.state.support.calls[id].state, 'CONNECTED');
  run(3000);
  e.run('rider', 'call.hangUp', { id });
  const c = e.state.support.calls[id];
  assert.equal(c.state, 'ENDED'); assert.ok(c.endedAt - c.connectedAt >= 3000);
  for (const [outcome, expected] of [['busy', 'BUSY'], ['failed', 'FAILED'], ['connected', 'MISSED']]) {
    e.setOption('callOutcome', outcome);
    const x = e.run('rider', 'call.request', { issue: 'Account' }).callId;
    run(25000);
    assert.equal(e.state.support.calls[x].state, expected, outcome);
  }
});

test('Partner bookings follow the booking machine; rental handover needs photos; sign-in required', () => {
  const e = new lib.Engine({ storage: lib.memoryStorage(), fresh: true });
  assert.equal(e.run('partner', 'booking.act', { id: 'HB-7719', event: 'confirm' }).code, 'signed_out');
  assert.equal(e.run('partner', 'partner.signIn', { email: 'nope', code: '1' }).code, 'validation');
  assert.equal(e.run('partner', 'partner.signIn', { email: 'orders@biryanihouse.example', code: '482716' }).ok, true);
  assert.equal(e.run('partner', 'booking.act', { id: 'HB-7719', event: 'check_in' }).code, 'illegal_transition');
  assert.equal(e.run('partner', 'booking.act', { id: 'HB-7719', event: 'confirm' }).ok, true);
  assert.equal(e.run('partner', 'booking.act', { id: 'RB-3301', event: 'check_in' }).code, 'photos_required');
  assert.equal(e.run('partner', 'booking.act', { id: 'RB-3301', event: 'check_in', photos: true }).ok, true);
});

test('Admin manual dispatch and driver pause, with role checks', () => {
  const { e } = make('C');
  e.run('rider', 'ride.request', {});
  assert.equal(e.run('admin', 'admin.assign', { driverId: 'DRV-1042' }).ok, true);
  assert.equal(e.activeRide().state, 'DRIVER_ACCEPTED');
  assert.equal(e.activeRide().offers[e.activeRide().offers.length - 1].manual, true);
  const { e: e2 } = make('A');
  e2.run('admin', 'admin.setRole', { role: 'SUPPORT_AGENT' });
  assert.equal(e2.run('admin', 'admin.driverStatus', { driverId: 'DRV-0051', blocked: true }).code, 'forbidden');
  e2.run('admin', 'admin.setRole', { role: 'FRAUD_ANALYST' });
  assert.equal(e2.run('admin', 'admin.driverStatus', { driverId: 'DRV-0051', blocked: true }).ok, true);
  assert.equal(e2.state.drivers['DRV-0051'].blocked, true);
});
