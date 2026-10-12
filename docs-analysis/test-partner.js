// partner app flows. usage: node test-partner.js
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../patner-app/index.html');
let page, fails = 0; const ev = (x) => page.eval(x), J = JSON.stringify;
const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' -> ' + i : '')); };
async function until(expr, t = 8000, why) { const end = Date.now() + t; while (Date.now() < end) { try { if (await page.eval(expr)) return true; } catch (e) {} await sleep(100); } throw new Error('timeout ' + (why || expr) + ' sid=' + await ev('RN.ui.sid')); }
const at = (s) => until(`RN.ui.sid==='${s}'`, 8000, 'at ' + s);
const go = async (s) => { await ev(`RN.ui.go('${s}')`); await at(s); await sleep(200); };
const setv = (n, v) => ev(`(()=>{const e=document.querySelector('#mock [name=${n}]'); if(!e) throw new Error('no field ${n} on '+RN.ui.sid); e.value=${J(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return 1})()`);
const clickText = (sel, txt) => ev(`(()=>{const n=[...document.querySelectorAll('#mock '+${J(sel)})].find(x=>x.textContent.includes(${J(txt)})); if(!n) throw new Error('missing '+${J(txt)}+' on '+RN.ui.sid); n.click(); return 1})()`);
const err = (n) => ev(`(document.querySelector('#mock [data-err=${n}]')||{textContent:''}).textContent`);
async function section(n, fn) { const e0 = page.errors.length; try { await fn(); } catch (e) { fails++; console.log('FAIL ' + n + ' -> ' + e.message); } if (page.errors.length > e0) { fails++; console.log('FAIL ' + n + ' page errors ' + J(page.errors.slice(e0)).slice(0, 300)); } }
(async () => {
  const b = await Browser.launch(); page = await b.newPage(); await page.viewport(1100, 900);
  await page.goto(fileUrl(APP)); await ev('localStorage.clear()'); await page.goto(fileUrl(APP)); await until('window.RN&&RN.ui&&RN.ui.sid&&RN.lite'); await sleep(300);
  await section('sign in + remember', async () => {
    await at('P08'); await ev(`document.querySelector('#mock [data-do*=partnerSignIn]').click()`); await sleep(200); check('sign-in validation', (await err('email')).length > 0);
    await setv('email', 'owner@biryanihouse.example'); await setv('code', '482716'); await ev(`document.querySelector('#mock [data-do*=partnerSignIn]').click()`); await at('P09');
    await sleep(1500); await page.goto(fileUrl(APP)); await until('window.RN&&RN.ui&&RN.ui.sid'); await until(`RN.ui.sid==='P09'`, 8000, 'restored to P09'); check('session remembered after reload', true);
  });
  await section('menu', async () => {
    await go('P03'); const n0 = await ev(`document.querySelectorAll('#mock .list .li').length`);
    await clickText('button', 'Add item'); await sleep(150); await clickText('.p-sheet button.btn', 'Add to menu'); await sleep(150); check('item validation', (await err('iname')).length > 0 && (await err('iprice')).length > 0);
    await setv('iname', 'Egg biryani'); await setv('iprice', '179'); await clickText('.p-sheet button.btn', 'Add to menu'); await sleep(300);
    check('item added', (await ev(`document.querySelectorAll('#mock .list .li').length`)) > n0); await page.goto(fileUrl(APP)); await until(`RN.ui.sid==='P09'`, 8000); await go('P03'); check('menu persisted', /Egg biryani/.test(await ev(`document.querySelector('#mock .body').textContent`)));
    await clickText('button', 'Pause 30 min'); await sleep(200); check('pause banner', /Paused until/.test(await ev(`document.querySelector('#mock .body').textContent`)));
  });
  await section('payouts', async () => {
    await go('P07'); await clickText('button', 'Request instant payout'); await sleep(150); await clickText('.p-sheet button.btn', 'Request payout'); await sleep(150); check('payout validation', (await err('pamt')).length > 0);
    await setv('pamt', '1000'); await clickText('.p-sheet button.btn', 'Request payout'); await sleep(300); check('payout in history', /Processing/.test(await ev(`document.querySelector('#mock .body').textContent`)));
    await until(`/Paid/.test(document.querySelector('#mock .body').textContent) && !/Processing/.test(document.querySelector('#mock .body').textContent)`, 30000, 'payout settles'); check('payout settles', true);
    await clickText('.li', 'Biryani was cold'); await sleep(150); await setv('rtext', 'ok'); await clickText('.p-sheet button.btn', 'Post reply'); await sleep(150); check('reply validation', (await err('rtext')).length > 0);
    await setv('rtext', 'Sorry about that, we will pack it hot.'); await clickText('.p-sheet button.btn', 'Post reply'); await sleep(300); check('reply saved', /Sorry about that/.test(await ev(`document.querySelector('#mock .body').textContent`)));
  });
  await section('settings + logout + onboarding', async () => {
    await go('P10'); await clickText('.li', 'Bank account'); await sleep(150); await setv('bifsc', 'BAD'); await clickText('.p-sheet button.btn', 'Save bank'); await sleep(150); check('IFSC validation', (await err('bifsc')).length > 0);
    await setv('bifsc', 'SBIN0001234'); await clickText('.p-sheet button.btn', 'Save bank'); await sleep(300); check('bank saved', /SBIN/.test(await ev(`document.querySelector('#mock .body').textContent`)));
    await clickText('button', 'Log out'); await sleep(500); await until(`document.querySelector('#mock .dialog, .rn-dialog, [role=dialog]')||RN.ui.sid==='P08'`, 3000).catch(() => {});
    if ((await ev('RN.ui.sid')) !== 'P08') { await ev(`[...document.querySelectorAll('[role=dialog] button, .rn-dialog button')].find(b=>/log|yes|sign/i.test(b.textContent))?.click()`); }
    await at('P08'); check('logged out', true); await go('P01');
    await clickText('button', 'Start application'); await sleep(200); check('onboarding validation', (await err('biz')).length > 0 && (await err('bphone')).length > 0);
    await setv('biz', 'Sea View Residency'); await setv('owner', 'Mohan Das'); await setv('bphone', '9812345678'); await setv('bemail', 'mohan@seaview.example'); await setv('baddr', '12 Beach Road, Goa 403001');
    await ev(`document.querySelector('#mock .toggle').click()`); await clickText('button', 'Start application'); await sleep(400); check('application submitted', /APP-/.test(await ev(`document.querySelector('#mock .body').textContent`)));
    await until(`/Approved and live/.test(document.querySelector('#mock .body').textContent) && /Go to sign in/.test(document.querySelector('#mock .body').textContent)`, 70000, 'application approved'); check('application progresses to approved', true);
  });
  console.log('page errors:', J(page.errors.slice(0, 5))); console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); await b.close();
})();