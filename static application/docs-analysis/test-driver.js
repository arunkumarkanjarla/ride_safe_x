// partner app flows. usage: node test-partner.js
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../driver-app/index.html');
let page, fails = 0; const ev = (x) => page.eval(x), J = JSON.stringify;
const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' -> ' + i : '')); };
async function until(expr, t = 8000, why) { const end = Date.now() + t; while (Date.now() < end) { try { if (await page.eval(expr)) return true; } catch (e) {} await sleep(100); } throw new Error('timeout ' + (why || expr) + ' sid=' + await ev('RN.ui.sid')); }
const at = (s) => until(`RN.ui.sid==='${s}'`, 8000, 'at ' + s);
const go = async (s) => { await ev(`RN.ui.go('${s}')`); await at(s); await sleep(200); };
const setv = (n, v) => ev(`(()=>{const e=document.querySelector('#mock [name=${n}]'); if(!e) throw new Error('no field ${n} on '+RN.ui.sid); e.value=${J(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return 1})()`);
const clickText = (sel, txt) => ev(`(()=>{const n=[...document.querySelectorAll('#mock '+${J(sel)})].find(x=>x.textContent.includes(${J(txt)})); if(!n) throw new Error('missing '+${J(txt)}+' on '+RN.ui.sid); n.click(); return 1})()`);
const err = (n) => ev(`(document.querySelector('#mock [data-err=${n}]')||{textContent:''}).textContent`);
async function section(n, fn) { const e0 = page.errors.length; try { await fn(); } catch (e) { fails++; console.log('FAIL ' + n + ' -> ' + e.message); } if (page.errors.length > e0) { fails++; console.log('FAIL ' + n + ' page errors ' + J(page.errors.slice(e0)).slice(0, 300)); } }
const clk = (sel) => ev(`(()=>{const n=document.querySelector('#mock '+${J(sel)}); if(!n) throw new Error('missing '+${J(sel)}+' on '+RN.ui.sid); n.click(); return 1})()`);
const txt = () => ev(`document.querySelector('#mock').textContent`);
const reload = async () => { await sleep(1200); await page.goto(fileUrl(APP)); await until('window.RN&&RN.ui&&RN.ui.sid&&RN.lite'); };
(async () => {
  const b = await Browser.launch(); page = await b.newPage(); await page.viewport(1100, 900);
  await page.goto(fileUrl(APP)); await ev('localStorage.clear()'); await page.goto(fileUrl(APP)); await until('window.RN&&RN.ui&&RN.ui.sid&&RN.lite'); await sleep(300);
  await section('login + otp + registration', async () => {
    await at('D01'); await setv('phone', '12345'); await clk('[data-do*=driverLogin]'); await sleep(500); check('phone validation', /valid 10-digit/.test(await txt()));
    await setv('phone', '9876543210'); await clk('[data-do*=driverLogin]'); await until(`document.querySelector('.p-sheet')`, 5000, 'otp sheet');
    await clickText('.p-sheet button.btn', 'Verify'); await sleep(200); check('otp length validation', (await err('dotp')).length > 0);
    await setv('dotp', '111111'); await clickText('.p-sheet button.btn', 'Verify'); await sleep(500); check('wrong otp rejected', (await err('dotp')).length > 0 && (await ev('RN.ui.sid')) === 'D01');
    await setv('dotp', '482716'); await clickText('.p-sheet button.btn', 'Verify'); await at('D02'); check('new number goes to registration', true);
    check('name not prefilled with demo driver', (await ev(`document.querySelector('#mock [name=fullname]').value`)) === '');
    await clickText('button', 'Next'); await sleep(200); check('registration validation', (await err('fullname')).length > 0 && (await err('plate')).length > 0);
    await setv('fullname', 'Ravi Teja'); await setv('model', 'Maruti Dzire'); await setv('plate', 'TS 08 AB 1234'); await clickText('button', 'Next'); await at('D03');
  });
  await section('documents + review + training', async () => {
    const keys = await ev(`[...document.querySelectorAll('#mock [data-do="x.uploadDoc"]')].map(x=>x.getAttribute('data-arg')).join(',')`);
    check('doc list present', keys.split(',').length >= 5, keys);
    await clk('[data-do*=submitKyc]'); await sleep(500); check('submit blocked until all uploaded', (await ev('RN.ui.sid')) === 'D03');
    for (const k of keys.split(',')) { await ev(`document.querySelector('#mock [data-do="x.uploadDoc"][data-arg="${k}"]').click()`); await until(`RN.ui.engine.state.kyc.docs.find(d=>d.key==="${k}").state==="uploaded"`, 4000, "upload "+k); await sleep(150); }
    await sleep(800); console.log('DBG', await ev(`JSON.stringify(RN.ui.engine.state.kyc.docs.map(d=>d.key+':'+d.state))+RN.ui.engine.state.kyc.state`)); await clk('[data-do*=submitKyc]'); await sleep(800); console.log('DBG2', (await txt()).slice(0,300), await ev('RN.ui.sid')); await at('D04'); check('in review', /review/i.test(await txt()));
    await reload(); await until(`RN.ui.sid==='D04'`, 8000, 'restored to D04'); check('session + onboarding stage survive reload', true);
    await until(`/Approved/.test(document.querySelector('#mock').textContent)`, 40000, 'approved'); check('review approves', true);
    await clk('[data-do*=training]'); await until(`/D05|D06/.test(RN.ui.sid)`); check('training -> home', true);
    await reload(); await until(`/D05|D06/.test(RN.ui.sid)`, 8000, 'restored to home'); check('active driver restored on reload', true);
  });
  await section('earnings, wallet, quests, trips', async () => {
    await go('D13'); const e1 = await ev(`document.querySelector('#mock .big-num').textContent`); await clickText('.chip', 'Today'); await sleep(200); const e2 = await ev(`document.querySelector('#mock .big-num').textContent`); check('earnings period tabs change figures', e1 !== e2, e1 + ' vs ' + e2);
    await go('D14'); await clickText('button', 'Cash out now'); await sleep(150); await setv('camt', '99'); await clickText('.p-sheet button.btn', 'Cash out'); await sleep(150); check('cash-out min validation', (await err('camt')).length > 0);
    await setv('camt', '1000'); await clickText('.p-sheet button.btn', 'Cash out'); await sleep(300); check('cash-out in history', /Cash out to bank/.test(await txt()) && /5,470|5470/.test(await txt()), '');
    await go('D15'); await clickText('button', 'Claim'); await sleep(300); await go('D14'); check('quest bonus claimed to wallet', /bonus/.test(await txt()));
    await go('D16'); const r0 = await ev(`document.querySelectorAll('#mock .li').length`); await clickText('.chip', 'Today'); await sleep(200); check('trip tabs filter', (await ev(`document.querySelectorAll('#mock .li').length`)) < r0);
    await clickText('.li', 'T-'); await sleep(200); check('trip detail opens', /Rider paid/.test(await txt())); await ev(`document.querySelector('.p-x').click()`);
  });
  await section('account + publish trip', async () => {
    await go('D28'); check('account shows new driver', /Ravi Teja/.test(await txt()) && /Maruti Dzire/.test(await txt()));
    await clickText('.li', 'Maruti Dzire'); await sleep(150); await setv('vplate', 'BAD'); await clickText('.p-sheet button.btn', 'Save'); await sleep(150); check('plate validation', (await err('vplate')).length > 0); await ev(`document.querySelector('.p-x').click()`);
    await go('D24'); await setv('tto', 'Kozhikode'); await setv('tfrom', 'Kozhikode'); await clickText('button', 'Publish trip'); await sleep(200); check('publish validation', (await err('tprice')).length > 0 && (await err('tto')).length > 0);
    await setv('tfrom', 'Hyderabad'); await setv('tto', 'Bengaluru'); await setv('tprice', '900'); await clickText('button', 'Publish trip'); await at('D25'); check('trip published', /Hyderabad/.test(await txt()));
    await until(`/1 of/.test(document.querySelector('#mock').textContent)&&!/0 of/.test(document.querySelector('#mock').textContent)`, 40000, 'seat booked'); check('seats fill up live', true);
    for (const s of ['D21', 'D17', 'D20', 'D27', 'D26', 'D18', 'D19']) { await go(s); }
    await go('D28'); await clk('[data-do*=signOut]'); await sleep(500); await ev(`[...document.querySelectorAll('[role=dialog] button, .rn-dialog button, .dialog button')].find(b=>/log|yes|continue/i.test(b.textContent))?.click()`); await at('D01'); await reload(); await sleep(800); check('logout stays logged out', (await ev('RN.ui.sid')) === 'D01');
    await setv('phone', '9876543210'); await clk('[data-do*=driverLogin]'); await until(`document.querySelector('.p-sheet')`); await setv('dotp', '482716'); await clickText('.p-sheet button.btn', 'Verify'); await until(`/D05|D06/.test(RN.ui.sid)`); check('returning driver skips onboarding', true);
  });
  console.log('page errors:', J(page.errors.slice(0, 5))); console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); await b.close();
  process.exit(fails ? 1 : 0);
})();