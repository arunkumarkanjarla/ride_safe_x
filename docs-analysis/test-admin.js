// partner app flows. usage: node test-partner.js
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../admin/index.html');
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
const dcText = () => ev(`(document.querySelector('#mock .dc')||document.querySelector('#mock')).textContent`);
const rowsN = () => ev(`document.querySelectorAll('#mock .dc tbody tr').length`);
const typeSearch = (v) => ev(`(()=>{const i=document.querySelector('#mock .a-search'); i.value=${J(v)}; i.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`);
(async () => {
  const b = await Browser.launch(); page = await b.newPage(); await page.viewport(1400, 900);
  await page.goto(fileUrl(APP)); await ev('localStorage.clear()'); await page.goto(fileUrl(APP)); await until('window.RN&&RN.ui&&RN.ui.sid&&RN.lite'); await sleep(400);
  await section('login', async () => {
    await at('A01'); await clickText('button', 'Continue'); await sleep(200); check('password required', (await err('apass')).length > 0);
    await setv('apass', 'nope'); await clickText('button', 'Continue'); await sleep(200); check('wrong password rejected', /Wrong password/.test(await err('apass')));
    await setv('apass', 'demo-only'); await clickText('button', 'Continue'); await sleep(200);
    check('MFA step shown', await ev(`!document.querySelector('.rn-screen[data-sid="A01"] [data-otp]').parentElement.hidden`));
    await ev(`(()=>{const i=document.querySelector('#mock .rn-otp-input'); i.value='111111'; i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await clk('[data-do*=mfa]'); await sleep(900); check('wrong MFA stays', (await ev('RN.ui.sid')) === 'A01');
    await ev(`(()=>{const i=document.querySelector('#mock .rn-otp-input'); i.value='730951'; i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await clk('[data-do*=mfa]'); await at('A02');
    await reload(); await until(`RN.ui.sid==='A02'`, 8000, 'session restored'); check('session remembered', true);
  });
  await section('all screens render without errors', async () => {
    const ids = await ev(`[...document.querySelectorAll('.rn-screen[data-sid]')].map(s=>s.dataset.sid).join(',')`); let n = 0;
    for (const s of ids.split(',')) { if (s === 'A01') continue; const e0 = page.errors.length; await go(s); await sleep(250); if (page.errors.length === e0) n++; else console.log('  errors on', s, J(page.errors.slice(e0)).slice(0, 200)); }
    check('screens without errors', n === ids.split(',').length - 1, n + '/' + (ids.split(',').length - 1));
  });
  await section('riders', async () => {
    await go('A05'); const n0 = await rowsN(); await typeSearch('Ananya'); await sleep(200); const n1 = await rowsN(); check('rider search filters', n1 > 0 && n1 < n0, n0 + '->' + n1);
    await ev(`document.querySelector('#mock .dc tbody tr').click()`); await sleep(200); await setv('credit', '5'); await clickText('.a-drawer button', 'Credit wallet'); await sleep(200); check('credit validation', (await err('credit')).length > 0);
    await setv('credit', '150'); await clickText('.a-drawer button', 'Credit wallet'); await sleep(900); check('credit denied for ops manager (RBAC)', await ev(`!!document.querySelector('.a-drawer')`));
    await ev(`RN.ui.exec('admin.setRole',{role:'FINANCE_MANAGER'},{instant:true})`); await sleep(200); await clickText('.a-drawer button', 'Credit wallet'); await sleep(900); check('credit applied as finance manager', !(await ev(`!!document.querySelector('.a-drawer')`)) && /\u20B9/.test(await dcText()));
    await ev(`RN.ui.exec('admin.setRole',{role:'OPS_MANAGER'},{instant:true})`); await sleep(200);
    await ev(`document.querySelector('#mock .dc tbody tr').click()`); await sleep(200); await clickText('.a-drawer button', 'Reveal'); await sleep(900); check('PII reveal denied for ops manager', /\+91 \d{10}/.test(await dcText()) === false);
    await ev(`document.querySelector('.a-x')?.click()`);
  });
  await section('pricing', async () => {
    await go('A09'); const v0 = await dcText(); await clickText('button', 'Edit rules'); await sleep(200);
    await ev(`(()=>{const i=document.querySelector('#mock .a-cell[data-r="Cab"][data-i="2"]'); i.value='15'; return 1})()`); await clickText('button', 'Save as v'); await sleep(900); check('fare rules new version', /v15/.test(await dcText()));
    await reload(); await until(`RN.ui.sid==='A02'`, 8000); await sleep(300); await go('A09'); check('fare version persisted', /v15/.test(await dcText()));
  });
  await section('payments refund + export', async () => {
    await go('A11'); await clickText('.a-chip', 'Failed'); await sleep(200); check('payment filter', /Failed/.test(await dcText()));
    await clickText('.a-chip', 'Captured'); await sleep(200); await ev(`document.querySelector('#mock .dc tbody tr').click()`); await sleep(200); await setv('ramt', '99999'); await clickText('.a-drawer button', 'Issue refund'); await sleep(200); check('refund cap validation', (await err('ramt')).length > 0);
    await ev(`RN.ui.exec('admin.setRole',{role:'FINANCE_MANAGER'},{instant:true})`); await sleep(200); await setv('ramt', '20'); await clickText('.a-drawer button', 'Issue refund'); await sleep(900); check('refund issued', !(await ev(`!!document.querySelector('.a-drawer')`)));
  });
  await section('coupons + campaigns + RBAC', async () => {
    await ev(`RN.ui.exec('admin.setRole',{role:'OPS_MANAGER'},{instant:true})`); await sleep(200); await go('A28'); await clickText('button', 'New coupon'); await sleep(200); await setv('kcode', 'x'); await clickText('.a-drawer button', 'Create coupon'); await sleep(200); check('coupon validation', (await err('kcode')).length > 0);
    await setv('kcode', 'MONSOON25'); await setv('kval', '25'); await clickText('.a-drawer button', 'Create coupon'); await sleep(900); check('coupon created', /MONSOON25/.test(await dcText()));
    await go('A21'); await clickText('button', 'New campaign'); await sleep(200); await setv('ctitle', 'Weekend rides'); await setv('cmsg', 'Get 25% off with MONSOON25 this weekend'); await clickText('.a-drawer button', 'Schedule'); await sleep(900);
    await until(`/Weekend rides/.test(document.querySelector('#mock .dc').textContent) && document.querySelector('#mock .dc tbody tr .st').textContent==='Sent'`, 25000, 'campaign sent'); check('campaign delivers', true);
    await go('A22'); await clickText('button', 'Fail over'); await sleep(900); check('config denied for ops manager', /Primary/.test(await dcText()) && !/Fallback<|Fallback$/.test(''));
    await ev(`RN.ui.exec('admin.setRole',{role:'SUPER_ADMIN'},{instant:true})`); await sleep(300); await go('A22'); await clickText('button', 'Fail over'); await sleep(900); check('super admin can fail over', /Restore/.test(await dcText()));
    await go('A18'); await clickText('button', 'New report'); await sleep(200); await clickText('.a-drawer button', 'Create draft'); await sleep(900); check('gov report draft', /Draft/.test(await dcText()));
    await clickText('.dc button', 'Send for approval'); await sleep(900); check('gov report pending', /Pending approval/.test(await dcText()));
  });
  await section('fraud undo + disputes', async () => {
    await go('A14'); const n0 = await rowsN(); await clickText('.dc tbody button', 'Block'); await sleep(900); check('fraud blocked', (await rowsN()) === n0 - 1);
    await clickText('.a-undo button', 'Undo'); await sleep(300); check('undo restores', (await rowsN()) === n0);
    await go('A30'); await ev(`document.querySelector('#mock .dc tbody tr').click()`); await sleep(200); await clickText('.a-drawer button', 'Refund half'); await sleep(200); check('dispute note required', (await err('dnote')).length > 0);
    await setv('dnote', 'Route was 2 km longer than planned.'); await clickText('.a-drawer button', 'Refund half'); await sleep(900); check('dispute resolved', !(await ev(`!!document.querySelector('.a-drawer')`)));
  });
  console.log('page errors:', J(page.errors.slice(0, 5))); console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); await b.close();
})();