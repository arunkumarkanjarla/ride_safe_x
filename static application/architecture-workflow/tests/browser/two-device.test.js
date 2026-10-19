'use strict';
/*
 * Two-device demonstration test: two separate browser profiles (separate storage, like two phones) share the
 * simulated state through tools/demo_server.py. The rider books in one, the driver accepts in the other.
 * Run: node --test tests/browser/two-device.test.js   (needs Python on PATH as "py" or "python3")
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { Browser, sleep } = require('./cdp');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8790 + Math.floor(Math.random() * 100);
const PY = spawnSync('py', ['--version']).status === 0 ? 'py' : 'python3';

async function waitFor(page, expr, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { if (await page.eval(expr)) return; } catch (e) { /* navigating */ } await sleep(200); }
  throw new Error('timed out: ' + expr);
}

test('rider and driver on two devices share one simulated ride', { timeout: 120000, skip: 'retired in the static application phase: cross-device sharing needs tools/demo_server.py, which is not approved for use' }, async () => {
  const server = spawn(PY, [path.join(ROOT, 'tools', 'demo_server.py'), '--port', String(PORT)], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${PORT}`;
  let riderB, driverB;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(base + '/api/demo-state')).ok) break; } catch (e) { /* starting */ } await sleep(200); }
    riderB = await Browser.launch(); driverB = await Browser.launch();
    const rider = await riderB.newPage(), drv = await driverB.newPage();

    // rider device: load scenario A with the driver played by a person
    await rider.goto(base + '/screens/rider/R10-confirm-pickup.html');
    await waitFor(rider, 'window.RN && RN.ui && RN.ui.engine');
    await rider.eval(`(() => { const e = RN.ui.engine; e.reset('A'); ['driver','partner','courier'].forEach((k) => e.setOption('auto.' + k, false)); e.setOption('fast', false); return 1; })()`);
    await sleep(2500);   // let the state reach the server

    // driver device: online and waiting
    await drv.goto(base + '/screens/driver/D06-online.html');
    await waitFor(drv, `window.RN && RN.ui && RN.ui.engine && RN.ui.engine.state.opts.auto.driver === false`);

    // rider books
    await rider.eval(`document.querySelector('#mock button[data-do="x.request"]').click()`);
    await waitFor(rider, `document.body.dataset.screen === 'R11'`);

    // driver device receives the offer and accepts it
    await waitFor(drv, `document.body.dataset.screen === 'D07' && window.RN && RN.ui && RN.ui.engine`, 30000);
    await waitFor(drv, `!!document.querySelector('#mock button[data-do="x.accept"]:not([disabled])')`);
    await sleep(1000);   // let the redirected page settle, as a person would before tapping
    await drv.eval(`document.querySelector('#mock button[data-do="x.accept"]').click()`);
    try { await waitFor(drv, `document.body.dataset.screen === 'D08'`); }
    catch (e) {
      const why = await drv.eval(`JSON.stringify({ toasts: [...document.querySelectorAll('.rn-toast')].map((x) => x.textContent), ride: RN.ui.engine.activeRide() && RN.ui.engine.activeRide().state, offers: RN.ui.engine.activeRide() && RN.ui.engine.activeRide().offers.map((o) => o.state), events: RN.ui.engine.state.events.slice(-6).map((x) => x.type + ' ' + x.note) })`);
      throw new Error(e.message + ' :: ' + why);
    }

    // rider device follows to "driver assigned"
    await waitFor(rider, `document.body.dataset.screen === 'R12' && window.RN && RN.ui && RN.ui.engine`, 30000);
    const st = await rider.eval('RN.ui.engine.activeRide().state');
    assert.ok(['DRIVER_ACCEPTED', 'DRIVER_ARRIVING'].includes(st), st);
  } finally {
    if (riderB) await riderB.close();
    if (driverB) await driverB.close();
    server.kill();
  }
});
