'use strict';
/* Agent portal and admin control (A31): smoke test in a headless Edge/Chrome.
   Run from architecture-workflow/:  node tests/browser/agent-portal.test.js
   Checks: sign-in rules, every page renders without script errors, replies on e-mail/social/chat, a full call
   (answer, hold, hang up, wrap-up), resolve with disposition, credit above the role limit escalates, and that a
   policy published by the admin portal reaches an open agent portal on the same site (BroadcastChannel). */
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { Browser, sleep } = require('./cdp');

const ROOT = path.resolve(__dirname, '../../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
let failures = 0;
function check(ok, label) { console.log((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) failures++; }

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await Browser.launch();
  try {
    const ag = await b.newPage();
    await ag.viewport(1366, 768);
    await ag.goto(base + '/agent-portal/index.html');
    check(await ag.eval('!document.querySelector(\'[data-view="login"]\').hidden'), 'agent portal opens on the sign-in page');
    // suspended account and wrong code are refused
    await ag.eval(`(() => { document.querySelector('#ag-agent').value = 'AG-105'; document.querySelector('#ag-code').value = '246810'; document.querySelector('[data-form="signin"]').requestSubmit(); })()`);
    check(/suspended/.test(await ag.eval('document.querySelector(\'[data-err="agent"]\').textContent')), 'suspended agent cannot sign in');
    await ag.eval(`(() => { document.querySelector('#ag-agent').value = 'AG-104'; document.querySelector('#ag-code').value = '111111'; document.querySelector('[data-form="signin"]').requestSubmit(); })()`);
    check(/not correct/.test(await ag.eval('document.querySelector(\'[data-err="code"]\').textContent')), 'wrong code is refused');
    await ag.eval(`(() => { document.querySelector('#ag-code').value = '246810'; document.querySelector('[data-form="signin"]').requestSubmit(); })()`);
    await ag.waitUntil('location.hash === "#/G02" && !document.querySelector(\'[data-view="desk"]\').hidden');
    check(true, 'supervisor signs in and lands on Home');

    for (const id of ['G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10', 'G11', 'G12', 'G13', 'G02']) {
      await ag.eval(`location.hash = '#/${id}'`); await sleep(150);
      const ok = await ag.eval(`document.querySelector('[data-bind="page"]').children.length > 0`);
      check(ok, 'page ' + id + ' renders');
    }
    // e-mail reply
    await ag.eval(`location.hash = '#/G05'`); await sleep(150);
    await ag.eval(`(() => { const it = document.querySelector('.ag-item'); it.click(); })()`); await sleep(100);
    await ag.eval(`(() => { document.querySelector('.ag-composer textarea').value = 'Thanks, we are checking this for you now.'; [...document.querySelectorAll('.ag-composer button')].find(b => b.textContent === 'Send').click(); })()`);
    await sleep(100);
    check(await ag.eval(`[...document.querySelectorAll('.ag-mail.agent')].some(m => /checking this/.test(m.textContent))`), 'e-mail reply appears in the thread');
    // social: public post can be moved to a private message
    await ag.eval(`location.hash = '#/G06'`); await sleep(150);
    await ag.eval(`(() => { const it = [...document.querySelectorAll('.ag-item')].find(i => /Public/.test(i.textContent)); it.click(); })()`); await sleep(100);
    await ag.eval(`[...document.querySelectorAll('.ag-composer button')].find(b => b.textContent === 'Move to private message').click()`); await sleep(100);
    check(await ag.eval(`/Moved to a private message/.test(document.querySelector('.ag-thread').textContent)`), 'public social post moved to a private message');
    // call: answer, hold, hang up, wrap-up
    await ag.eval(`location.hash = '#/G04'`);
    await ag.waitUntil(`[...document.querySelectorAll('.ag-callbar button')].some(b => b.textContent === 'Answer')`, 8000);
    await ag.eval(`[...document.querySelectorAll('.ag-callbar button')].find(b => b.textContent === 'Answer').click()`); await sleep(1200);
    check(await ag.eval(`/Connected/.test(document.querySelector('.ag-callstate').textContent)`), 'incoming call answered');
    await ag.eval(`[...document.querySelectorAll('.ag-callbtns button')].find(b => b.textContent === 'Hold').click()`); await sleep(150);
    check(await ag.eval(`/On hold/.test(document.querySelector('.ag-callstate').textContent)`), 'call put on hold');
    await ag.eval(`[...document.querySelectorAll('.ag-callbtns button')].find(b => b.textContent === 'Hang up').click()`); await sleep(150);
    check(await ag.eval(`/Wrap-up/.test(document.querySelector('.ag-callstate').textContent)`), 'hang up starts wrap-up');
    await ag.eval(`(() => { const s = document.querySelector('.ag-callcard select'); s.value = 'Information given'; document.querySelector('#ag-wrap-resolve').checked = true; document.querySelector('.ag-callcard textarea').value = 'Explained the payout schedule.'; [...document.querySelectorAll('.ag-callcard button')].find(b => b.textContent === 'Save wrap-up').click(); })()`);
    await sleep(200);
    check(await ag.eval(`!/Wrap-up/.test((document.querySelector('.ag-callstate') || {}).textContent || '')`), 'wrap-up saved, softphone ready again');
    // case: credit above the supervisor limit goes to Finance
    await ag.eval(`location.hash = '#/G03'`); await sleep(150);
    await ag.eval(`(() => { const r = [...document.querySelectorAll('tbody tr.ag-click')].find(tr => /E-mail/.test(tr.textContent) && /Open|Waiting/.test(tr.textContent)); r.click(); })()`); await sleep(150);
    await ag.eval(`(() => { const s = window.RN; location.hash = '#/G08'; })()`); await sleep(150);
    await ag.eval(`(() => { const i = document.querySelector('input[aria-label="Credit amount in rupees"]'); i.value = '9000'; document.querySelector('input[aria-label="Credit reason"]').value = 'Double charge'; [...document.querySelectorAll('button')].find(b => b.textContent === 'Add credit').click(); })()`);
    await sleep(200);
    check(await ag.eval(`/Finance team/.test(document.querySelector('.ag-thread').textContent)`), 'credit above the role limit is escalated to Finance');

    // admin publishes a policy: the open agent portal follows it live
    const ad = await b.newPage();
    await ad.viewport(1366, 768);
    await ad.goto(base + '/admin/index.html#/A01');
    await ad.eval(`(() => { const i = document.querySelector('#mock .rn-otp-input'); i.value = '730951'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#mock [data-do="x.mfa"]').click(); })()`);
    await ad.waitUntil('location.hash === "#/A02"', 8000);
    await ad.eval(`location.hash = '#/A31'`); await sleep(300);
    check(await ad.eval(`!!document.querySelector('#mock [data-agentctl]') && document.querySelector('#mock [data-agentctl]').children.length > 0`), 'admin A31 agent portal control renders');
    await ad.eval(`RN.agentControl.test.setChannel('x', false)`);
    await ad.eval(`RN.agentControl.test.publish()`);
    await ag.waitUntil(`/live from admin/.test(document.querySelector('[data-bind="policy"]').textContent)`, 5000);
    await ag.eval(`location.hash = '#/G13'`); await sleep(200);
    check(await ag.eval(`[...document.querySelectorAll('tbody tr')].some(tr => /^X/.test(tr.textContent) && /Off/.test(tr.textContent))`), 'channel switched off in admin shows as Off in the agent portal');
    await ad.waitUntil(`[...document.querySelectorAll('#mock [data-agentctl] tbody tr')].some(tr => /Rohan D\\./.test(tr.textContent) && /Available|On a call|Ringing|Wrap-up/.test(tr.textContent) && /v2/.test(tr.textContent))`, 8000);
    check(true, 'admin monitor shows the signed-in agent live, on policy v2');
    await ad.eval(`RN.agentControl.test.signOut('AG-104')`);
    await ag.waitUntil(`!document.querySelector('[data-view="login"]').hidden`, 5000);
    check(true, 'admin can sign an agent out remotely');

    const errs = ag.errors.concat(ad.errors).filter((e) => !/favicon/.test(e));
    check(errs.length === 0, 'no script errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  } catch (err) {
    console.log('FAIL ' + err.message); failures++;
  } finally {
    await b.close(); srv.close();
  }
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})();
