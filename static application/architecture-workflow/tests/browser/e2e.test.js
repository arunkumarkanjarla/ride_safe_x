'use strict';
/*
 * End-to-end tests of the static applications in a real headless browser (Edge/Chrome via the DevTools protocol).
 * Standalone apps are opened from the file system; the connected demo is served by Python's built-in static server
 * (browsers isolate frames of pages opened as files). No npm packages.
 * Run from architecture-workflow/:  node --test --test-concurrency=1 tests/browser/e2e.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { Browser, fileUrl, sleep } = require('./cdp');

const AW = path.resolve(__dirname, '..', '..');
const REPO = path.dirname(AW);
// applications built on the shared runtime (RN.ui); the agent portal (agent-portal/) is a separate web portal tested below
const DIR = { rider: 'customer-app', driver: 'driver-app', partner: 'patner-app', admin: 'admin' };
const AGENT_DIR = 'agent-portal';
const REG = JSON.parse(fs.readFileSync(path.join(AW, 'assets/js/generated/screens.js'), 'utf8').replace(/^[\s\S]*?window\.RN_SCREENS = /, '').replace(/;\s*$/, ''));
let browser, page;

async function ev(expr) {
  for (let i = 0; i < 40; i++) {
    try { return await page.eval(expr); } catch (e) { if (!/Execution context|Cannot find context|not defined|reading|null/.test(e.message)) throw e; await sleep(150); }
  }
  throw new Error('page did not settle: ' + expr);
}
async function until(expr, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await page.eval(expr)) return; } catch (e) { /* settling */ } await sleep(120); }
  throw new Error('timed out: ' + expr + ' (screen ' + (await ev('window.RN && RN.ui && RN.ui.sid')) + '; toasts: ' + (await ev(`[...document.querySelectorAll('.rn-toast')].map((t) => t.textContent).join(' | ')`)) + ')');
}
async function openApp(app, sid) {
  await page.goto(fileUrl(path.join(REPO, DIR[app], 'index.html')) + (sid ? '#/' + sid : ''));
  await until('window.RN && RN.ui && RN.ui.engine && RN.ui.sid');
}
const at = (sid, t) => until(`RN.ui.sid === ${JSON.stringify(sid)}`, t);
async function go(sid) { await ev(`(location.hash = '#/${sid}', 1)`); await at(sid); }
const click = (sel) => ev(`(() => { const n = document.querySelector('#mock ' + ${JSON.stringify(sel)}); if (!n) throw new Error('missing ${sel.replace(/'/g, '')} on ' + RN.ui.sid); n.click(); return 1; })()`);
const clickText = (sel, t) => ev(`(() => { const n = [...document.querySelectorAll('#mock ' + ${JSON.stringify(sel)})].find((x) => x.textContent.includes(${JSON.stringify(t)})); if (!n) throw new Error('missing ' + ${JSON.stringify(sel + ' ' + t)}); n.click(); return 1; })()`);
const setVal = (name, v) => ev(`(() => { const n = document.querySelector('#mock [name="${name}"]'); n.value = ${JSON.stringify(v)}; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
const otp = (v) => ev(`(() => { const n = document.querySelector('#mock .rn-otp-input'); n.value = ${JSON.stringify(v)}; n.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
const E = (code) => ev(`(() => { const e = RN.ui.engine; return ${code}; })()`);
const panel = () => ev(`(document.querySelector('#mock .rn-state') || {}).textContent || ''`);
const toasts = () => ev(`[...document.querySelectorAll('.rn-toast')].map((t) => t.textContent).join(' | ')`);
// waits for an error toast with this text and for the control that raised it to be enabled again
async function errorToast(re) { await until(`[...document.querySelectorAll('.rn-toast.error')].some((t) => ${re}.test(t.textContent)) && !document.querySelector('#mock .rn-busy')`); }
async function confirmDialog() { await until(`!!document.querySelector('dialog.rn-dialog[open]')`); await ev(`(document.querySelector('dialog.rn-dialog .primary').click(), 1)`); }
async function promptDialog(v) { await until(`!!document.querySelector('dialog.rn-dialog[open] input')`); await ev(`(() => { document.querySelector('dialog.rn-dialog input').value = ${JSON.stringify(v)}; document.querySelector('dialog.rn-dialog .primary').click(); return 1; })()`); }
async function scenario(id, opts = {}) { await E(`(e.reset(${JSON.stringify(id)}), 1)`); for (const [k, v] of Object.entries(opts)) await E(`(e.setOption(${JSON.stringify(k)}, ${JSON.stringify(v)}), 1)`); }

test.before(async () => { browser = await Browser.launch(); page = await browser.newPage(); await page.viewport(1280, 900); });
test.after(async () => { await browser.close(); });

test('Every app: no prototype chrome, every screen opens without errors, every control action has a handler', { timeout: 600000 }, async () => {
  const failures = [];
  for (const app of Object.keys(DIR)) {
    page.errors.length = 0;
    await openApp(app);
    if (await ev(`!!document.querySelector('.app-bar, .rn-demobar, .app-foot, [data-rn="scenario"]')`)) failures.push(app + ': prototype header or demo controls present');
    await scenario('A');   // signed in everywhere, so the route guard does not redirect
    for (const sid of Object.keys(REG).filter((s) => REG[s].app === app)) {
      await ev(`(location.hash = '#/${sid}', 1)`);
      await sleep(60);
      const missing = await ev(`(() => { const c = RN.screens[${JSON.stringify(sid)}]; return [...document.querySelectorAll('.rn-screen[data-sid="${sid}"] [data-do^="x."], .rn-screen[data-sid="${sid}"] [data-change^="x."]')]
        .map((n) => (n.getAttribute('data-do') || n.getAttribute('data-change')).slice(2)).filter((a) => !(c && c.actions && c.actions[a])); })()`);
      if (missing.length) failures.push(sid + ' has no handler for ' + missing.join(', '));
    }
    await sleep(300);
    if (page.errors.length) failures.push(app + ': ' + page.errors.join(' / '));
  }
  assert.deepEqual(failures, []);
});

test('Customer: welcome, registration with OTP and profile, sign-in guard, logout', { timeout: 90000 }, async () => {
  await openApp('rider');
  await at('R02', 6000);                         // splash forwards a signed-out user to onboarding
  await click('[data-go="R58"]'); await at('R58');
  await click('[data-do="x.demoAccount"][data-arg="new"]'); await at('R03');
  assert.equal(await ev(`RN.ui.val('phone')`), '90000 00001');
  await setVal('phone', '123'); await click('[data-do="x.sendOtp"]');
  await until(`document.querySelector('#mock [name=phone]').getAttribute('aria-invalid') === 'true'`);
  await setVal('phone', '90000 00001'); await click('[data-do="x.sendOtp"]'); await at('R04');
  await otp('111111'); await click('[data-do="x.verifyOtp"]');
  await until(`(document.querySelector('#mock [data-err="riderOtp"]') || {}).textContent.includes('attempts left')`);
  await otp('482716'); await click('[data-do="x.verifyOtp"]'); await at('R05');   // new customer completes a profile
  await setVal('name', '1'); await click('[data-do="x.profile"]');
  await until(`document.querySelector('#mock [name=name]').getAttribute('aria-invalid') === 'true'`);
  await setVal('name', 'Kavya Nair'); await click('[data-do="x.profile"]'); await at('R06');
  await click('[data-do="x.permissions"]'); await at('R29');
  await go('R28'); await clickText('[data-do="x.signOut"]', 'Log out'); await confirmDialog(); await at('R58');
  await ev(`(location.hash = '#/R29', 1)`); await at('R58');        // guard: signed out users cannot open the home screen
  assert.match(await toasts(), /Sign in first/);
});

test('Customer: city ride end to end, receipt, rating, history; no second charge', { timeout: 120000 }, async () => {
  await openApp('rider'); await scenario('A'); await go('R29');
  await click('a[data-go="R07"]'); await at('R07');
  await click('[data-go="R08"]'); await at('R08');
  await click('[data-do="x.destination"]'); await at('R09');
  await clickText('[data-do="x.vehicle"]', 'Auto');
  assert.match(await ev(`document.querySelector('#mock [data-bind=book]').textContent`), /Book Auto/);
  await click('[data-bind="book"]'); await at('R10');
  await click('[data-do="x.request"]'); await at('R11');
  await at('R12', 20000);
  assert.match(await ev(`document.querySelector('#mock [data-bind=otp]').textContent`), /4827/);
  await at('R15', 30000); await at('R17', 40000);
  await until(`document.querySelector('#mock [data-bind="payline"]').textContent.includes('Paid by UPI')`, 15000);
  await click('[data-go="R19"]'); await at('R19');
  await ev('(history.back(), 1)'); await at('R17');
  await click('[data-go="R18"]'); await at('R18');
  await click('[data-do="x.rate"]'); await at('R29');
  await go('R20');
  assert.match(await ev(`document.querySelector('#mock [data-live]').textContent`), /this session.*Closed/);
  await sleep(3000);
  assert.equal(await E(`e.state.events.filter((x) => x.type === 'payment.captured').length`), 1);
  assert.equal(await E(`e.lastRide().vehicle`), 'Auto');
});

test('Customer: rejection and expiry, no driver with retry, cancellation, failed payment', { timeout: 180000 }, async () => {
  await openApp('rider'); await scenario('B'); await go('R10');
  await click('[data-do="x.request"]');
  await until(`(document.querySelector('#mock .rn-state') || {}).textContent.includes('declined')`, 15000);
  await at('R12', 40000);
  assert.deepEqual(await E(`e.activeRide().offers.map((o) => o.state)`), ['DECLINED', 'EXPIRED', 'ACCEPTED']);

  await scenario('C'); await go('R10'); await click('[data-do="x.request"]'); await at('R11');
  await until(`(document.querySelector('#mock .rn-state') || {}).textContent.includes('No drivers available')`, 60000);
  await clickText('.rn-state button', 'Try again'); await at('R12', 30000);

  await scenario('D', { 'auto.driver': false }); await go('R10'); await click('[data-do="x.request"]'); await at('R11');
  await click('[data-do="x.cancelRide"]'); await confirmDialog();
  await until(`RN.ui.engine.lastRide().state === 'CANCELLED'`);
  assert.match(await toasts(), /No fee/);

  await scenario('E'); await go('R10'); await click('[data-do="x.request"]');
  await at('R17', 60000);
  const seen = new Set();
  for (let i = 0; i < 100; i++) { const tag = await ev(`document.querySelector('#mock [data-bind="payline"] .tag').textContent`); seen.add(tag); if (tag === 'Failed') break; await sleep(200); }
  assert.ok(seen.has('Failed') && !seen.has('Paid'), [...seen].join(','));
  assert.equal(await E(`e.run('rider', 'ride.request', {}).code`), 'payment_due');
  await clickText('.rn-state button', 'Pay by UPI');
  await until(`document.querySelector('#mock [data-bind="payline"] .tag').textContent === 'Paid'`);
});

test('Driver: login, onboarding documents, decision, going online, ride execution, invalid transitions', { timeout: 120000 }, async () => {
  await openApp('driver');
  await at('D01');
  await setVal('phone', '91234 56789'); await click('[data-do="x.driverLogin"]'); await at('D02');   // unknown number → registration
  await click('[data-do="x.register"]'); await at('D03');
  await scenario('F'); await go('D03');
  await click('[data-do="x.submitKyc"]'); await errorToast('/Upload or retake/');
  for (const k of ['insurance', 'permit', 'fitness']) { await click(`[data-do="x.uploadDoc"][data-arg="${k}"]`); await until(`RN.ui.engine.state.kyc.docs.find((d) => d.key === '${k}').state === 'uploaded'`); }
  await click('[data-do="x.submitKyc"]'); await at('D04');
  assert.match(await panel(), /In review/);
  await click('[data-do="x.training"]'); await errorToast('/Training unlocks/');   // not approved yet
  await E(`e.run('admin', 'kyc.decide', { decision: 'approve' }).ok`);                            // decision taken in the admin portal
  await until(`(document.querySelector('#mock .rn-state') || {}).textContent.includes('Approved')`);
  await click('[data-do="x.training"]'); await at('D05');
  await click('[data-do="x.goOnline"]'); await at('D06');
  assert.equal(await E(`e.run('driver', 'ride.start', { otp: '4827' }).code`), 'no_trip');        // no assignment yet
  await E(`(e.setOption('auto.driver', false), e.setOption('plan', 'happy'), e.run('rider', 'ride.request', {}).ok)`);
  await at('D07', 10000);
  await click('[data-do="x.accept"]'); await at('D08');
  await click('[data-do="x.arrive"]'); await at('D09');
  await otp('1111'); await click('[data-do="x.startTrip"]');
  await until(`(document.querySelector('#mock [data-err="tripOtp"]') || {}).textContent.includes('does not match')`);
  await otp('4827'); await click('[data-do="x.startTrip"]'); await at('D10');
  await click('[data-do="x.endTrip"]'); await confirmDialog(); await at('D11');
  assert.equal(await E(`e.run('driver', 'ride.end').code`), 'cannot_end');                        // cannot complete twice
  await click('[data-go="D12"]'); await at('D12'); await click('[data-do="x.rateRider"]'); await at('D06');
  await go('D16');
  assert.match(await ev(`document.querySelector('#mock [data-live]').textContent`), /this session/);
});

test('Driver: offline queue and reconnection (scenario I)', { timeout: 60000 }, async () => {
  await openApp('driver'); await scenario('I', { 'auto.driver': false });
  await go('D19'); await clickText('.rn-state button', 'Simulate losing network');       // network simulation lives on D19
  await until(`RN.ui.engine.state.net.driver === 'offline'`);
  await go('D10');
  await until(`!document.querySelector('[data-rn="offline"]').hidden`);
  await click('[data-do="x.endTrip"]'); await confirmDialog();
  await until(`RN.ui.engine.state.queue.length === 1`);
  await click('[data-do="x.endTrip"]'); await confirmDialog();
  await until(`[...document.querySelectorAll('.rn-toast.error')].some((t) => t.textContent.includes('Already saved'))`);
  await go('D21');
  assert.equal(await ev(`document.querySelector('#mock [data-do="x.goOnline"]').getAttribute('aria-disabled')`), 'true');
  await go('D19'); await clickText('.rn-state button', 'Network is back');
  await until(`RN.ui.engine.state.queue.length === 0`);
  assert.equal(await E(`e.lastRide().state`), 'PAYMENT_PENDING');
});

test('Partner: sign-in validation, food order accept and ready, hotel and rental bookings', { timeout: 90000 }, async () => {
  await openApp('partner'); await at('P08');
  await setVal('email', 'not-an-email'); await click('[data-do="x.partnerSignIn"]');
  await until(`document.querySelector('#mock [name=email]').getAttribute('aria-invalid') === 'true'`);
  await setVal('email', 'orders@biryanihouse.example'); await setVal('code', '482716'); await click('[data-do="x.partnerSignIn"]'); await at('P09');
  await E(`(e.setOption('auto.partner', false), e.setOption('auto.courier', false), e.state.session.rider.status = 'signed_in', e.run('rider', 'order.place', {}).ok)`);
  await click('[data-go="P02"]'); await at('P02');
  await clickText('.chip', '20 min'); await click('[data-do="x.orderAccept"]');
  await until(`RN.ui.engine.order().state === 'PREPARING'`);
  await clickText('.rn-state button', 'Mark ready'); await until(`RN.ui.engine.order().state === 'READY'`);
  await go('P04'); await clickText('.rn-state button', 'Confirm · Kiran'); await until(`RN.ui.engine.state.bookings['HB-7719'].state === 'CONFIRMED'`);
  await go('P05'); await clickText('.rn-state button', 'Hand over');
  await until(`[...document.querySelectorAll('.rn-toast.error')].some((t) => t.textContent.includes('handover photos'))`);
  for (const c of ['Left', 'Right', 'Fuel']) await clickText('.chip', c);
  await clickText('.rn-state button', 'Hand over'); await until(`RN.ui.engine.state.bookings['RB-3301'].state === 'CHECKED_IN'`);
  await go('P10'); await clickText('[data-do="x.signOut"]', 'Log out'); await confirmDialog(); await at('P08');
});

test('Admin: MFA, KYC approval with role denial, SOS lifecycle, manual dispatch, table search/filter/sort', { timeout: 120000 }, async () => {
  await openApp('admin'); await at('A01');
  await otp('000000'); await click('[data-do="x.mfa"]'); await errorToast('/Wrong code/');
  await otp('730951'); await click('[data-do="x.mfa"]'); await at('A02');
  await scenario('J'); await go('A07');
  await click('[data-do="x.kyc"][data-arg="approve"]');
  await until(`[...document.querySelectorAll('.rn-toast.error')].some((t) => /cannot/.test(t.textContent))`);
  await go('A19');
  assert.equal(await ev(`document.querySelector('#mock .dc').classList.contains('rn-denied')`), true);
  await scenario('G'); await E(`e.run('rider', 'sos.raise').ok`); await go('A13');
  await click('[data-do="incident.ack"]'); await until(`RN.ui.engine.incident().state === 'ACKNOWLEDGED'`);
  await clickText('.rn-state button', 'Start working'); await until(`RN.ui.engine.incident().state === 'IN_PROGRESS'`);
  await clickText('.rn-state button', 'Resolve'); await until(`RN.ui.engine.incident().state === 'RESOLVED'`);
  await go('A20'); await clickText('.rn-state button', 'Safety manager');                 // demo role switch lives on A20
  await until(`RN.ui.engine.state.session.admin.role === 'SAFETY_MANAGER'`);
  await go('A13'); await clickText('.rn-state button', 'Close after review'); await until(`RN.ui.engine.incident().state === 'CLOSED'`);
  await scenario('C'); await E(`e.run('rider', 'ride.request', {}).ok`); await go('A04');
  // A04 shows the engine's live demo ride on top of the rides list, with manual dispatch buttons while it searches
  await until(`!!document.querySelector('#mock .ops-live-card') && document.querySelector('#mock .ops-live-card').textContent.includes('Assign')`);
  await clickText('.ops-live-card button', 'Assign Arjun'); await until(`RN.ui.engine.activeRide() && RN.ui.engine.activeRide().driverId === 'DRV-1042'`);
  assert.ok(await ev(`document.querySelector('#mock .ops-live-card [data-bind=state]').textContent !== 'SEARCHING_DRIVER'`));
  await go('A05');
  await ev(`(() => { const s = document.querySelector('#mock .rn-search'); s.value = 'bengaluru'; s.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  assert.equal(await ev(`[...document.querySelectorAll('#mock table.dt tbody tr')].filter((r) => !r.hidden).length`), 2);
  await ev(`(() => { const s = document.querySelector('#mock .rn-search'); s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  await clickText('[data-filter]', 'Blocked');
  assert.ok(await ev(`[...document.querySelectorAll('#mock table.dt tbody tr')].filter((r) => !r.hidden).every((r) => /blocked/i.test(r.textContent))`));
  await ev(`(document.querySelectorAll('#mock table.dt th')[3].click(), 1)`);
  assert.equal(await ev(`document.querySelectorAll('#mock table.dt th')[3].getAttribute('aria-sort')`), 'ascending');
});

test('Admin operations: location masters, KPI links, live map filter, partner onboarding to live, refund by role, order flow', { timeout: 150000 }, async () => {
  page.errors.length = 0;
  const btn = (txt, scope = '#mock') => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(txt)}) && !x.disabled); if (!b) throw new Error('no button ' + ${JSON.stringify(txt)}); b.click(); return 1; })()`);
  const form = async (fill) => { await until(`!!document.querySelector('dialog.ops-dialog[open]')`); if (fill) await ev(`(() => { const d = document.querySelector('dialog.ops-dialog[open]'); ${fill}; return 1; })()`); await ev(`(document.querySelector('dialog.ops-dialog[open] .primary').click(), 1)`); await sleep(450); };
  await openApp('admin'); await scenario('A'); await go('A02');
  await until(`!!document.querySelector('#mock .ops-kpi') && document.querySelectorAll('#mock .om-m').length > 0`);
  const all = await ev(`document.querySelector('#mock .ops-kpi .v').textContent`);
  await ev(`(() => { const s = document.querySelector('#mock .ops-geo select'); s.value = 'IN'; s.dispatchEvent(new Event('change')); return 1; })()`);
  await until(`document.querySelectorAll('#mock .ops-geo select')[1].options.length > 1`);
  assert.notEqual(await ev(`document.querySelector('#mock .ops-kpi .v').textContent`), all, 'KPIs follow the country filter');
  await ev(`(document.querySelector('#mock .ops-kpi').click(), 1)`); await at('A04');
  assert.ok(await ev(`document.querySelector('#mock .ops-chip.on').textContent.startsWith('Active')`), 'Active rides KPI opens the active rides');
  await ev(`(RN.ops.geo.country = RN.ops.geo.state = RN.ops.geo.city = '', 1)`);
  await go('A03'); await until(`!!document.querySelector('#mock .ops-chip')`);
  await ev(`([...document.querySelectorAll('#mock .ops-chip')].find((c) => c.textContent.startsWith('SOS')).click(), 1)`); await sleep(400);
  assert.equal(await ev(`parseInt(document.querySelector('#mock .ops-found').textContent, 10)`), await ev(`RN.opsData.vehicles.filter((v) => v.status === 'SOS').length`));
  // partner onboarding: New → document review → site visit → agreement → approved → live
  const id = await ev(`RN.opsData.partners.find((x) => x.stage === 'SUBMITTED' && x.type === 'Restaurant').id`);
  await go('A24'); await ev(`(RN.opsPartners.state.stage = 'all', RN.opsPartners.state.sel = '${id}', RN.opsPartners.render(), 1)`);
  await btn('Assign to me & start review'); await until(`RN.opsData.partner('${id}').stage === 'IN_REVIEW'`);
  assert.equal(await ev(`[...document.querySelectorAll('#mock button')].find((b) => b.textContent === 'Send to site visit').disabled`), true, 'next step locked until documents are verified');
  for (let i = 0; i < 8 && await ev(`[...document.querySelectorAll('#mock .ops-doc button')].some((x) => x.textContent === 'Verify')`); i++) { await btn('Verify'); await sleep(400); }
  while (await ev(`RN.opsData.partner('${id}').checks.some((c) => c.state !== 'pass')`)) { await btn('Override'); await form(`d.querySelector('textarea').value = 'Checked with the owner'`); }
  await btn('Send to site visit'); await until(`RN.opsData.partner('${id}').stage === 'SITE_VISIT'`);
  await btn('Schedule visit'); await form(); await btn('Visit passed'); await until(`RN.opsData.partner('${id}').stage === 'AGREEMENT'`);
  await btn('Mark agreement signed'); await until(`RN.opsData.partner('${id}').stage === 'APPROVED'`);
  await btn('Go live'); await until(`RN.opsData.partner('${id}').stage === 'LIVE'`);
  // refund: denied for the Auditor role (audited), allowed for the Finance manager
  const rid = await ev(`RN.opsData.rides.find((r) => r.state === 'COMPLETED' && r.payment.state === 'CAPTURED').id`);
  await E(`(e.run('admin', 'admin.setRole', { role: 'AUDITOR', key: 'ops-r1' }), 1)`);
  await ev(`(RN.ops.nav.ride = '${rid}', location.hash = '#/A04', 1)`); await until(`!!document.querySelector('#mock .ops-dhead')`);
  await btn('Refund'); await form(); await sleep(300);
  assert.equal(await ev(`RN.opsData.ride('${rid}').refunds.length`), 0);
  assert.equal(await E(`e.state.audit.slice(-1)[0].result`), 'denied');
  await E(`(e.run('admin', 'admin.setRole', { role: 'FINANCE_MANAGER', key: 'ops-r2' }), 1)`); await sleep(500);
  await btn('Refund'); await form(); await until(`RN.opsData.ride('${rid}').refunds.length === 1`);
  await E(`(e.run('admin', 'admin.setRole', { role: 'OPS_MANAGER', key: 'ops-r3' }), 1)`);
  // food order: preparing → ready → courier → picked up
  const oid = await ev(`RN.opsData.orders.find((o) => o.state === 'PREPARING').id`);
  await ev(`(RN.ops.nav.order = '${oid}', location.hash = '#/A27', 1)`); await until(`!document.querySelector('#mock .ops-drawer').hidden`);
  await btn('Move to', '#mock .ops-drawer'); await until(`RN.opsData.order('${oid}').state === 'READY'`);
  if (!(await ev(`!!RN.opsData.order('${oid}').courierId`))) { await btn('Assign courier', '#mock .ops-drawer'); await form(); }
  await btn('Move to', '#mock .ops-drawer'); await until(`RN.opsData.order('${oid}').state === 'PICKED_UP'`);
  assert.deepEqual(page.errors, []);
});

test('Agent portal: admin-controlled sign-in, e-mail reply, social move-to-private, call with wrap-up, credit limit', { timeout: 120000 }, async () => {
  page.errors.length = 0;
  await page.viewport(1366, 768);
  await page.goto(fileUrl(path.join(REPO, AGENT_DIR, 'index.html')));
  await until(`window.RN && RN.agentSync && !!document.querySelector('#ag-agent option')`);
  const signIn = (id, code) => ev(`(() => { document.querySelector('#ag-agent').value = '${id}'; document.querySelector('#ag-code').value = '${code}'; document.querySelector('[data-form="signin"]').requestSubmit(); return 1; })()`);
  await signIn('AG-105', '246810');
  assert.match(await ev(`document.querySelector('[data-err="agent"]').textContent`), /suspended/);
  await signIn('AG-101', '000000');
  assert.match(await ev(`document.querySelector('[data-err="code"]').textContent`), /not correct/);
  await signIn('AG-101', '246810');
  await until(`location.hash === '#/G02' && !document.querySelector('[data-view="desk"]').hidden`);
  // Meera (L1, customer care) has no Facebook/Instagram/X: the social page only offers her own networks
  await ev(`(location.hash = '#/G05', 1)`); await sleep(200);
  await ev(`([...document.querySelectorAll('.ag-col button')].find((b) => /^All e-mail/.test(b.textContent)).click(), 1)`); await sleep(100);
  await ev(`(document.querySelector('.ag-item').click(), 1)`); await sleep(100);
  await ev(`(() => { document.querySelector('.ag-composer textarea').value = 'We are checking this for you.'; [...document.querySelectorAll('.ag-composer button')].find((b) => b.textContent === 'Send').click(); return 1; })()`);
  await until(`[...document.querySelectorAll('.ag-mail.agent')].some((m) => /checking this/.test(m.textContent))`);
  // credit above the L1 limit (₹200) is escalated to Finance instead of being issued
  await ev(`([...document.querySelectorAll('button')].find((b) => b.textContent === 'Case workspace').click(), 1)`);
  await until(`location.hash === '#/G08' && !!document.querySelector('input[aria-label="Credit amount in rupees"]')`);
  await ev(`(() => { document.querySelector('input[aria-label="Credit amount in rupees"]').value = '500'; document.querySelector('input[aria-label="Credit reason"]').value = 'Goodwill'; [...document.querySelectorAll('button')].find((b) => b.textContent === 'Add credit').click(); return 1; })()`);
  await until(`/Finance team/.test(document.querySelector('.ag-thread').textContent)`);
  // call: answer, hang up, wrap-up
  await ev(`(location.hash = '#/G04', 1)`);
  await until(`[...document.querySelectorAll('.ag-callbar button')].some((b) => b.textContent === 'Answer')`, 20000);
  await ev(`([...document.querySelectorAll('.ag-callbar button')].find((b) => b.textContent === 'Answer').click(), 1)`);
  await until(`/Connected/.test(document.querySelector('.ag-callstate').textContent)`, 5000);
  await ev(`([...document.querySelectorAll('.ag-callbtns button')].find((b) => b.textContent === 'Hang up').click(), 1)`);
  await until(`/Wrap-up/.test(document.querySelector('.ag-callstate').textContent)`);
  await ev(`(() => { document.querySelector('.ag-callcard select').value = 'Information given'; [...document.querySelectorAll('.ag-callcard button')].find((b) => b.textContent === 'Save wrap-up').click(); return 1; })()`);
  await until(`!/Wrap-up/.test((document.querySelector('.ag-callstate') || {}).textContent || '')`);
  // the page itself never scrolls
  assert.ok(await ev(`document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1`));
  await ev(`(document.querySelector('[data-act="signout"]').click(), 1)`);
  await until(`!document.querySelector('[data-view="login"]').hidden`);
  assert.deepEqual(page.errors, []);
  await page.viewport(1280, 900);
});

test('Layout: the page never scrolls; long content scrolls inside the app; desktop apps have header, body and footer', { timeout: 120000 }, async () => {
  const cases = [['rider', 'R29'], ['rider', 'R07'], ['driver', 'D06'], ['driver', 'D28'], ['partner', 'P09'], ['partner', 'P11'], ['admin', 'A02'], ['admin', 'A05'], ['admin', 'A31']];
  for (const [w, h, mobile] of [[375, 700, true], [1366, 600, false], [1920, 950, false]]) {
    await page.viewport(w, h, mobile);
    for (const [app, sid] of cases) {
      await openApp(app); await scenario('A'); await go(sid); await sleep(200);
      const m = await ev(`(() => { const s = document.scrollingElement, r = document.querySelector('#mock').firstElementChild.getBoundingClientRect();
        return { sw: s.scrollWidth, sh: s.scrollHeight, w: innerWidth, h: innerHeight, top: r.top, bottom: r.bottom }; })()`);
      const tag = `${app} ${sid} at ${w}x${h}`;
      assert.ok(m.sw <= m.w + 1, `${tag}: page scrolls sideways (${m.sw} > ${m.w})`);
      assert.ok(m.sh <= m.h + 1, `${tag}: page scrolls (${m.sh} > ${m.h})`);
      assert.ok(m.top >= -1 && m.bottom <= m.h + 1, `${tag}: app is cut off (${m.top}..${m.bottom})`);
      if (app === 'admin') {
        const d = await ev(`[...document.querySelector('#mock .dmain').children].map((n) => n.tagName.toLowerCase() + '.' + n.classList[0]).join(' ')`);
        assert.equal(d, 'header.dtop div.dc footer.dfoot', tag);
      }
    }
  }
  // a long list scrolls inside the screen while the header and bottom navigation stay in place
  await page.viewport(1366, 600);
  await openApp('rider'); await scenario('A'); await go('R28'); await sleep(200);
  const s = await ev(`(() => { const b = document.querySelector('#mock .body'), nav = document.querySelector('#mock .bnav').getBoundingClientRect();
    const before = nav.top; b.scrollTop = b.scrollHeight; return { scrolls: b.scrollHeight > b.clientHeight, moved: b.scrollTop > 0, navStays: document.querySelector('#mock .bnav').getBoundingClientRect().top === before }; })()`);
  assert.deepEqual(s, { scrolls: true, moved: true, navStays: true });
  await page.viewport(1280, 900);
});

test('Keyboard and reload: chips operable with Enter; reloading starts a fresh signed-out session', { timeout: 60000 }, async () => {
  await openApp('rider'); await scenario('A'); await go('R05');
  await ev(`(() => { const c = [...document.querySelectorAll('#mock [data-ui="pick"]')].find((x) => x.textContent.trim() === 'Man'); c.focus(); return 1; })()`);
  await page.key('Enter', 'Enter', 13);
  await until(`document.querySelector('#mock [data-ui="pick"].on').textContent.trim() === 'Man'`);
  await E(`e.run('rider', 'ride.request', {}).ok`);
  await page.send('Page.reload'); await sleep(500);
  await until(`window.RN && RN.ui && RN.ui.engine && RN.ui.engine.state.session.rider.status === 'signed_out' && RN.ui.engine.state.rideOrder.length === 0`);
  assert.equal(await ev('RN.ui.sid'), 'R58');                                               // the guard sends a fresh session to sign-in
});

test('Separate servers: each folder served on its own, loads only its own files, links reach the other server', { timeout: 120000 }, async () => {
  // lay the folders out as on the four servers (DEPLOYMENT.md) and serve each server root on its own port
  const py = spawnSync('py', ['--version']).status === 0 ? 'py' : 'python3';
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rn-servers-'));
  const SERVERS = { '123': [['admin', '']], '124': [['rider', '']], '125': [['driver', 'driver-app/'], ['partner', 'patner-app/']], '126': [['support', '']] };
  const base = 8700 + Math.floor(Math.random() * 50) * 2;
  const port = {}; const url = {}; const servers = [];
  Object.keys(SERVERS).forEach((s, i) => { port[s] = base + i * 3; SERVERS[s].forEach(([app, sub]) => { url[app] = `http://127.0.0.1:${port[s]}/${sub}`; }); });
  try {
    for (const [s, apps] of Object.entries(SERVERS)) {
      for (const [app, sub] of apps) {
        const dest = path.join(tmp, s, sub);
        fs.cpSync(path.join(REPO, DIR[app] || AGENT_DIR), dest, { recursive: true });
        // the deployer's only change: the real addresses in config.js
        const cfg = path.join(dest, 'assets/js/config.js');
        let text = fs.readFileSync(cfg, 'utf8');
        for (const [a, u] of Object.entries(url)) text = text.replace(new RegExp(`(${a}: )"[^"]*"`), `$1"${u}"`);
        fs.writeFileSync(cfg, text);
      }
      servers.push(spawn(py, ['-m', 'http.server', String(port[s]), '--bind', '127.0.0.1', '--directory', path.join(tmp, s)], { stdio: 'ignore' }));
    }
    const apps = Object.keys(DIR).concat(['support']);
    for (const app of apps) {
      for (let i = 0; i < 50; i++) { try { const r = await fetch(url[app] + 'index.html'); await r.text(); if (r.ok) break; } catch (e) { /* starting */ } await sleep(200); }
    }
    for (const app of apps) {
      page.errors.length = 0;
      await page.goto(url[app]);
      await until(app === 'support' ? `window.RN && RN.agentSync && !!document.querySelector('#ag-agent option')` : 'window.RN && RN.ui && RN.ui.engine && RN.ui.sid');
      const res = await ev(`performance.getEntriesByType('resource').map((r) => r.name)`);
      assert.ok(res.length >= (app === 'support' ? 9 : 12), app + ' loaded ' + res.length + ' files');
      for (const r of res) assert.ok(r.startsWith(url[app] + 'assets/'), `${app} loaded ${r} from outside its folder`);
      assert.deepEqual(page.errors, [], app);
    }
    // admin portal (server .123) → Agent portal control (A31) → agent portal (server .126)
    await page.goto(url.admin + '#/A01');
    await until('window.RN && RN.ui && RN.ui.engine && RN.ui.sid');
    await scenario('A'); await go('A31');
    await until(`!!document.querySelector('#mock [data-agentctl] a.dbtn')`);
    assert.equal(await ev(`document.querySelector('#mock [data-agentctl] a.dbtn').getAttribute('href')`), url.support);
    await page.goto(url.support);
    await until(`!document.querySelector('[data-view="login"]').hidden && /Agent sign-in/.test(document.body.textContent)`, 15000);
  } finally {
    servers.forEach((s) => s.kill());
    await sleep(300);
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  }
});

test('Connected demo: one scenario across customer, driver, admin and the agent portal (served over HTTP)', { timeout: 120000 }, async () => {
  const py = spawnSync('py', ['--version']).status === 0 ? 'py' : 'python3';
  const port = 8800 + Math.floor(Math.random() * 100);
  const server = spawn(py, ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', REPO], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/index.html`)).ok) break; } catch (e) { /* starting */ } await sleep(200); }
    await page.goto(`http://127.0.0.1:${port}/connected-demo/index.html`);
    await until(`window.RN_HUB && [...document.querySelectorAll('iframe')].every((f) => f.contentWindow.RN && f.contentWindow.RN.ui && f.contentWindow.RN.ui.engine === RN_HUB.engine)`, 20000);
    const F = (i, code) => ev(`(() => { const w = document.querySelectorAll('iframe')[${i}].contentWindow; return ${code}; })()`);
    await ev(`(() => { const e = RN_HUB.engine; e.reset('A'); ['driver','partner','courier','support'].forEach((k) => e.setOption('auto.' + k, false)); return 1; })()`);
    await F(0, `(w.location.hash = '#/R10', 1)`); await F(1, `(w.location.hash = '#/D06', 1)`); await F(2, `(w.location.hash = '#/A04', 1)`);
    await sleep(600);
    await F(0, `(w.document.querySelector('#mock [data-do="x.request"]').click(), 1)`);
    await until(`document.querySelectorAll('iframe')[1].contentWindow.RN.ui.sid === 'D07'`, 10000);
    await F(1, `(w.document.querySelector('#mock [data-do="x.accept"]').click(), 1)`);
    await until(`document.querySelectorAll('iframe')[0].contentWindow.RN.ui.sid === 'R12'`, 10000);
    assert.match(await F(2, `w.document.querySelector('#mock [data-bind=state]').textContent`), /DRIVER_A/);
    // the customer raises a ticket about this ride; an agent in the agent portal sees it and the reply reaches the ticket
    const rideId = await ev(`RN_HUB.engine.activeRide().id`);
    const created = await ev(`RN_HUB.engine.run('rider', 'ticket.create', { category: 'booking', issue: 'My driver never arrived', ref: ${JSON.stringify(rideId)}, description: 'Driver is taking too long to arrive.', priority: 'P2' })`);
    assert.equal(created.ok, true);
    assert.equal(await ev(`RN_HUB.engine.state.support.tickets['${created.ticketId}'].ref`), rideId);
    await ev(`(RN_HUB.open('support', 'G01'), 1)`);
    const AG = `[...document.querySelectorAll('iframe')].find((f) => /agent-portal/.test(f.src)).contentWindow`;
    await until(`(() => { const w = ${AG}; return w && w.RN && w.RN.agentSync && !!w.document.querySelector('#ag-agent option'); })()`, 15000);
    await ev(`(() => { const w = ${AG}, d = w.document; d.querySelector('#ag-agent').value = 'AG-104'; d.querySelector('#ag-code').value = '246810'; d.querySelector('[data-form="signin"]').requestSubmit(); return 1; })()`);
    await until(`RN_HUB.engine.state.support.agent.signedIn && RN_HUB.engine.state.support.agent.name === 'Rohan D.'`, 10000);
    await sleep(1500);   // the agent portal picks up connected-demo tickets on its 1-second clock
    await ev(`(() => { const w = ${AG}, s = w.document.querySelector('[data-bind="search"]'); s.value = 'My driver never arrived'; s.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()`);
    await until(`(() => { const d = ${AG}.document; return [...d.querySelectorAll('tbody tr')].some((tr) => /My driver never arrived/.test(tr.textContent)); })()`, 15000);
    const types = await ev(`RN_HUB.engine.state.events.map((x) => x.type)`);
    for (const t of ['ride.requested', 'ride.offer.accepted', 'ticket.created']) assert.ok(types.includes(t), t);
  } finally { server.kill(); }
});
