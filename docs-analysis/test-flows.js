// customer end-to-end flows (headless). usage: node test-flows.js
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../customer-app/index.html');
let page, fails = 0;
const ev = (x) => page.eval(x);
const J = JSON.stringify;
async function until(expr, t = 8000, why) { const end = Date.now() + t; while (Date.now() < end) { try { if (await page.eval(expr)) return true; } catch (e) {} await sleep(100); } throw new Error('timeout: ' + (why || expr) + ' | sid=' + await ev('RN.ui.sid') + ' toasts=' + await ev(`[...document.querySelectorAll('.rn-toast')].map(t=>t.textContent).join(' | ')`)); }
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' -> ' + info : '')); };
const at = (sid, t) => until(`RN.ui.sid==='${sid}'`, t, 'at ' + sid);
const clickText = (sel, txt, scope = '#mock') => ev(`(()=>{const n=[...document.querySelectorAll(${J(scope)}+' '+${J(sel)})].find(x=>x.textContent.includes(${J(txt)})&&!x.closest('[hidden]')); if(!n) throw new Error('missing '+${J(txt)}+' ('+${J(sel)}+') on '+RN.ui.sid); n.click(); return 1})()`);
const click = (sel) => ev(`(()=>{const n=document.querySelector('#mock '+${J(sel)}); if(!n) throw new Error('missing '+${J(sel)}+' on '+RN.ui.sid); n.click(); return 1})()`);
const setv = (name, val) => ev(`(()=>{const n=document.querySelector('#mock [name=${name}]'); if(!n) throw new Error('no field ${name} on '+RN.ui.sid); n.value=${J(String(val))}; n.dispatchEvent(new Event('input',{bubbles:true})); n.dispatchEvent(new Event('change',{bubbles:true})); return 1})()`);
const text = (sel) => ev(`(document.querySelector('#mock '+${J(sel)})||{textContent:''}).textContent`);
const go = async (sid) => { await ev(`RN.ui.go('${sid}')`); await at(sid); await sleep(150); };
const store = () => ev(`JSON.stringify(RN.store.user())`).then(JSON.parse);
const errsSince = (n) => page.errors.slice(n);
async function pay(method) { await until(`document.querySelector('#mock .p-sheet')`); await clickText('.p-sheet .li', method); await clickText('.p-sheet button.btn', 'Pay'); await sleep(150); if (await ev(`!!document.querySelector('#mock .p-pin')`)) { PIN_SEEN++; for (const k of '1234') await ev(`[...document.querySelectorAll('#mock .p-key')].find(b=>b.textContent==='${k}')?.click()`); await clickText('.p-sheet button.btn', 'Pay'); } await until(`!document.querySelector('#mock .p-sheet')`, 8000, 'sheet closed after pay'); await until(`!document.querySelector('#mock .p-success')`, 5000, 'success animation done'); }
let PIN_SEEN = 0;
async function section(name, fn) { const e0 = page.errors.length; try { await fn(); } catch (e) { fails++; console.log('FAIL ' + name + ' -> ' + e.message); } const er = errsSince(e0); if (er.length) { fails++; console.log('FAIL ' + name + ' page errors ' + J(er).slice(0, 400)); } }

(async () => {
  const b = await Browser.launch(); page = await b.newPage(); await page.viewport(1100, 900);
  try {
    await page.goto(fileUrl(APP)); await ev(`localStorage.clear()`); await page.goto(fileUrl(APP));
    await until('window.RN && RN.ui && RN.ui.sid');
    await section('onboarding', async () => {
      await at('R02'); await click('[data-go="R58"]'); await at('R58'); await clickText('button', 'Create an account'); await at('R03');
      await setv('phone', '90123 45678'); await click('[data-do="x.sendOtp"]'); await at('R04');
      await ev(`(()=>{const i=document.querySelector('#mock .rn-otp-input'); i.value='482716'; i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await click('[data-do="x.verifyOtp"]'); await at('R05');
      await setv('name', 'Kavya Nair'); await clickText('.chip', 'Female');
      await setv('ecname', 'Meera Nair'); await setv('ecphone', '9876501234'); await clickText('.chip', 'Mother').catch(() => {});
      const txt = await ev(`document.querySelector('#mock').textContent`);
      await clickText('button', 'Continue'); await sleep(300);
      const s = await ev('RN.ui.sid'); check('profile with emergency contact accepted', s === 'R06', s + ' ' + await text('[data-err]'));
      if (s === 'R05') { console.log((await ev(`[...document.querySelectorAll('#mock [data-err]')].map(e=>e.dataset.err+':'+e.textContent).join(' | ')`))); return; }
      await click('[data-do="x.permissions"]'); await at('R29');
      const u = await store(); check('emergency contact stored', u.emergency.length === 1, J(u.emergency));
    });
    await section('home tiles', async () => {
      const tiles = await ev(`[...document.querySelectorAll('#mock .svc a')].map(a=>a.textContent.trim())`);
      for (let i = 0; i < tiles.length; i++) {
        await go('R29'); const before = page.errors.length;
        await ev(`document.querySelectorAll('#mock .svc a')[${i}].click()`); await sleep(500);
        const sid = await ev('RN.ui.sid'); const len = await ev(`(document.querySelector('.rn-screen[data-sid="'+RN.ui.sid+'"] .body')||{textContent:''}).textContent.trim().length`);
        check('tile ' + tiles[i] + ' -> ' + sid, sid !== 'R29' && len > 30 && page.errors.length === before);
      }
      await go('R29');
      for (const [lab, sid] of [['Trips', 'R54'], ['Savings', 'R49'], ['Wallet', 'R21'], ['Account', 'R28'], ['Home', 'R29']]) { await clickText('.bnav a', lab); await at(sid); check('bottom nav ' + lab, true); }
    });
    await section('wallet add money', async () => {
      await go('R21'); const before = (await store()).walletPaise;
      await clickText('button', 'Add money'); await until(`document.querySelector('#mock .p-sheet')`);
      await setv('amount', '500'); await clickText('.p-sheet button.btn', 'Add');
      await sleep(300); await ev(`(()=>{const s=document.querySelector('#mock .p-sheet'); return s?1:0})()`);
      const hasPay = await ev(`!!document.querySelector('#mock .p-sheet .li')`);
      if (hasPay) { await clickText('.p-sheet .li', 'UPI').catch(() => {}); await clickText('.p-sheet button.btn', 'Pay').catch(() => {}); }
      await sleep(2500); const after = (await store()).walletPaise; check('wallet balance increased by 500', after - before === 50000, before + '->' + after);
    });
    await section('bus booking', async () => {
      await go('R32'); await setv('to', 'Bengaluru'); await clickText('button', 'Find options'); await at('R33');
      const n = await ev(`document.querySelectorAll('#mock .p-opts .opt').length`); check('R33 lists options', n >= 5, n);
      await clickText('.chip', 'Bus'); await sleep(200); await ev(`document.querySelector('#mock .p-opts .opt').click()`); await at('R35');
      await ev(`document.querySelector('#mock .p-seat:not(.taken):not(.gap)').click()`); await sleep(150);
      await clickText('button.btn', 'Continue to pay'); await pay('UPI'); await at('R62');
      const u = await store(); check('bus booking saved', u.bookings.some(x => x.type === 'bus' && x.status === 'Confirmed'), u.bookings.length);
      await go('R54'); check('R54 shows booking', /Bengaluru|Hyderabad/.test(await ev(`document.querySelector('.rn-screen[data-sid=R54] .body').textContent`)));
    });
    await section('shared seat + cab', async () => {
      await go('R32'); await clickText('button', 'Find options'); await at('R33'); await clickText('.chip', 'Shared'); await ev(`document.querySelector('#mock .p-opts .opt').click()`); await at('R34');
      await clickText('button.btn', 'Book'); await pay('UPI'); await at('R62'); check('shared seat booked', (await store()).bookings.some(x => x.type === 'share'));
    });
    await section('hotel', async () => {
      await go('R41'); await ev(`document.querySelector('#mock .li.tag, #mock .list button.li').click()`); await at('R42');
      await clickText('button.btn', 'Book'); await pay('UPI'); await at('R62'); check('hotel booked', (await store()).bookings.some(x => x.type === 'hotel'));
      await go('R41'); await setv('cout', ''); await sleep(200); check('hotel date validation', (await ev(`document.querySelector('#mock [data-err=cout]').textContent`)).length > 0);
    });
    await section('rental', async () => {
      await go('R43'); await ev(`document.querySelector('#mock .list button.li').click()`); await until(`document.querySelector('#mock .p-sheet')`);
      await clickText('.p-sheet button.btn', 'Continue'); await sleep(200); check('licence validation', (await ev(`document.querySelector('#mock [data-err=dl]').textContent`)).length > 0);
      await setv('dl', 'TS09 20110012345'); await clickText('.p-sheet button.btn', 'Continue'); await pay('UPI'); await at('R62'); check('rental booked', (await store()).bookings.some(x => x.type === 'rental'));
    });
    await section('food order', async () => {
      await go('R44'); await ev(`document.querySelector('#mock .p-restcard').click()`); await at('R45');
      await ev(`document.querySelectorAll('#mock .p-menu-item .p-step')[1].click()`); await ev(`document.querySelectorAll('#mock .p-menu-item .p-step')[1].click()`); await sleep(200);
      await clickText('button.btn', 'Pay'); await pay('UPI'); await at('R46', 8000);
      check('order placed -> tracking', /Arriving|Order/.test(await ev(`document.querySelector('.rn-screen[data-sid=R46] .body').textContent`)));
      await until(`/Delivered/.test(document.querySelector('.rn-screen[data-sid=R46] .body').textContent)`, 90000, 'order delivered');
      check('order delivered by simulation', true); check('booking mirrors delivery', (await ev(`JSON.stringify(RN.store.user().bookings.filter(b=>b.type==='food').map(b=>b.status))`)) !== '[]');
    });
    await section('parcel', async () => {
      await go('R47'); await clickText('button.btn', 'Book parcel'); await sleep(200);
      check('parcel validation errors', (await ev(`document.querySelectorAll('#mock [data-err]:not([hidden])').length`)) >= 4);
      await setv('pto', '12 MG Road, Indiranagar'); await setv('rname', 'Divya Rao'); await setv('rphone', '9930512345'); await setv('what', 'Birthday gift');
      await clickText('button.btn', 'Book parcel'); await pay('UPI'); await at('R48');
      await until(`/Picked up|Handed|On the way/.test(document.querySelector('.rn-screen[data-sid=R48] .body').textContent)`, 90000, 'parcel progresses'); check('parcel tracking progresses', true);
    });
    await section('city ride', async () => {
      await go('R07'); await ev(`document.querySelector('#mock [data-go=R08], #mock .searchbar, #mock .p-where')?.click()`); await sleep(300);
      if ((await ev('RN.ui.sid')) !== 'R08') await go('R08');
      await ev(`document.querySelector('#mock .p-picker .li').click()`); await sleep(400);
      const sid = await ev('RN.ui.sid'); check('destination -> options', sid === 'R09' || sid === 'R31', sid);
      if (sid === 'R31') { await ev(`document.querySelector('#mock .p-opts .opt, #mock .opt').click()`); await clickText('button.btn', 'Continue').catch(()=>{}); await sleep(300); }
      if ((await ev('RN.ui.sid')) === 'R09') { await ev(`document.querySelector('#mock .opt').click()`); await clickText('button.btn', 'Continue').catch(() => click('button.btn')); await at('R10'); }
      if ((await ev('RN.ui.sid')) === 'R10') {
        await clickText('.li, .opt', 'UPI').catch(() => {}); await clickText('button.btn', 'Confirm').catch(() => clickText('button.btn', 'Request')); 
        await until(`['R11','R12','R15','R17','R10'].includes(RN.ui.sid)`, 8000); console.log('after confirm sid=' + await ev('RN.ui.sid') + ' toasts=' + await ev(`[...document.querySelectorAll('.rn-toast')].map(t=>t.textContent).join('|')`));
        await until(`RN.ui.sid==='R17'`, 120000, 'ride completes -> R17'); check('ride reaches trip complete', true);
        await until(`RN.store.user().bookings.some(b=>b.type==='ride')`, 40000, 'ride mirrored').catch(async e=>console.log(e.message+' state='+(await ev('RN.ui.engine.lastRide().state')))); const u = await store(); check('ride mirrored into bookings', u.bookings.some(x => x.type === 'ride' && x.status === 'Completed'), u.bookings.filter(x=>x.type==='ride').length);
      }
    });
    await section('assistant + support', async () => {
      await go('R52'); await ev(`(()=>{const i=document.querySelector('#mock .p-compose input'); i.value='Weekend trip from Hyderabad to Mysuru for 2 people under 6000'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`);
      await until(`document.querySelector('#mock .p-chat .card-m')`, 6000, 'plan card'); await clickText('button.btn', 'Book this plan'); await at('R36');
      check('plan saved', (await store()).bookings.some(x => x.status === 'Planned'));
      await clickText('button.btn', 'Book all'); await pay('UPI'); await sleep(300); check('plan booked', !(await store()).bookings.some(x => x.status === 'Planned'));
      await go('R26'); await ev(`(()=>{const i=document.querySelector('#mock .p-compose input'); i.value='Lost my bag'; i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`);
      await until(`document.querySelectorAll('#mock .bubble.them').length>=2`, 6000, 'bot reply'); check('support bot replies', true);
      await go('R27'); await clickText('button.btn', 'Submit'); await sleep(200); check('report validation', (await ev(`document.querySelector('#mock [data-err=desc]').textContent`)).length > 0);
      await setv('desc', 'Left a black backpack on the back seat'); await clickText('button.btn', 'Submit'); await at('R26'); check('ticket created', ((await store()).tickets || []).length >= 1);
    });
    await section('emergency + notifications + contacts', async () => {
      await go('R51'); await clickText('button.btn', 'Share my location'); await sleep(200);
      await go('R24'); await clickText('button', 'Add').catch(() => {}); await sleep(200);
      await go('R56'); const n = await ev(`document.querySelectorAll('#mock .list .li').length`); check('notifications present', n >= 3, n);
    });
  } catch (e) { fails++; console.log('ERROR', e.message); }
  console.log('page errors:', J(page.errors.slice(0, 8)));
  check('UPI PIN sheet used', PIN_SEEN > 0, PIN_SEEN); console.log(fails ? 'FAILED ' + fails : 'ALL PASSED');
  await b.close();
})();