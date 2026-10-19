// customer new-user flow test (headless Edge/Chrome via the repo's CDP helper). usage: node test-customer.js
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../customer-app/index.html');
let page, fails = 0;
const ev = (x) => page.eval(x);
async function until(expr, t = 8000) { const end = Date.now() + t; while (Date.now() < end) { try { if (await page.eval(expr)) return true; } catch (e) {} await sleep(100); } throw new Error('timeout: ' + expr + ' | sid=' + await ev('RN.ui.sid') + ' toasts=' + await ev(`[...document.querySelectorAll('.rn-toast')].map(t=>t.textContent).join(' | ')`)); }
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' -> ' + info : '')); };
const at = (sid) => until(`RN.ui.sid==='${sid}'`);
const click = (sel) => ev(`(()=>{const n=document.querySelector('#mock '+${JSON.stringify(sel)}); if(!n) throw new Error('missing '+${JSON.stringify(sel)}+' on '+RN.ui.sid); n.click(); return 1})()`);
const clickText = (sel, txt) => ev(`(()=>{const n=[...document.querySelectorAll('#mock '+${JSON.stringify(sel)})].find(x=>x.textContent.includes(${JSON.stringify(txt)})); if(!n) throw new Error('missing text '+${JSON.stringify(txt)}+' on '+RN.ui.sid); n.click(); return 1})()`);
module.exports = {};
(async () => {
  const b = await Browser.launch(); page = await b.newPage(); await page.viewport(1100, 900);
  try {
    await page.goto(fileUrl(APP));
    await ev(`localStorage.clear()`); await page.goto(fileUrl(APP));
    await until('window.RN && RN.ui && RN.ui.sid');
    await at('R02'); check('splash -> onboarding for a fresh browser', true);
    await click('[data-go="R58"]'); await at('R58');
    await clickText('button', 'Create an account'); await at('R03');
    check('phone field is empty for a new user', (await ev(`document.querySelector('#mock [name=phone]').value`)) === '');
    await ev(`document.querySelector('#mock [name=phone]').value='12345'`); await click('[data-do="x.sendOtp"]');
    await until(`document.querySelector('#mock [data-err=phone]').textContent.length>0`); check('invalid phone shows inline error', true, await ev(`document.querySelector('#mock [data-err=phone]').textContent`));
    await ev(`document.querySelector('#mock [name=phone]').value='90123 45678'`); await click('[data-do="x.sendOtp"]'); await at('R04'); check('OTP screen', true);
    await ev(`(()=>{const i=document.querySelector('#mock .rn-otp-input'); i.value='111111'; i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await click('[data-do="x.verifyOtp"]');
    await until(`document.querySelector('#mock [data-err=riderOtp]').textContent.length>0`); check('wrong OTP rejected', true, await ev(`document.querySelector('#mock [data-err=riderOtp]').textContent`));
    await ev(`(()=>{const i=document.querySelector('#mock .rn-otp-input'); i.value='482716'; i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await click('[data-do="x.verifyOtp"]'); await at('R05'); check('new user -> profile setup', true);
    await clickText('button', 'Continue'); await sleep(200);
    check('name required error', (await ev(`document.querySelector('#mock [data-err=name]').textContent`)).length > 0);
    check('gender required error', (await ev(`document.querySelector('#mock [data-err=gender]').textContent`)).length > 0);
    await ev(`(()=>{const n=document.querySelector('#mock [name=name]'); n.value='Kavya Nair'; n.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    await clickText('.chip', 'Female');
    await clickText('button', 'Skip emergency contact'); await at('R06'); check('profile saved (no emergency) -> permissions', true);
    await click('[data-do="x.permissions"]'); await at('R29');
    const home = await ev(`document.querySelector('#mock .p-name').textContent`); check('home greets by name', home === 'Kavya', home);
    const u = await ev(`JSON.stringify(JSON.parse(localStorage.getItem('ridenova.customer.v1')).users['9012345678'])`);
    check('profile persisted in localStorage', /Kavya Nair/.test(u) && /Female/.test(u), u.slice(0, 120));
    // tiles
    const tiles = await ev(`[...document.querySelectorAll('#mock .svc a')].map(a=>a.textContent.trim()).join(',')`); console.log('tiles:', tiles);
  } catch (e) { fails++; console.log('ERROR', e.message); }
  console.log('page errors:', JSON.stringify(page.errors.slice(0, 8)));
  console.log(fails ? 'FAILED ' + fails : 'ALL PASSED');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
