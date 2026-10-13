// Admin control plane end-to-end: admin Platform control changes must take effect in the other apps.
// usage: node test-admin-control.js   (all pages share one browser profile, so file:// localStorage is shared)
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const U = (p) => fileUrl(path.resolve(__dirname, '..', p));
const J = JSON.stringify; let fails = 0, passes = 0;
const check = (n, ok, i) => { if (ok) passes++; else fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' -> ' + String(i).slice(0, 200) : '')); };
function helpers(page, name) {
  const ev = (x) => page.eval(x);
  const until = async (x, t = 8000, why) => { const end = Date.now() + t; while (Date.now() < end) { try { if (await ev(x)) return true; } catch (e) {} await sleep(120); } throw new Error(name + ': timeout ' + (why || x).slice(0, 120)); };
  const click = (sel) => ev(`(()=>{const n=document.querySelector(${J(sel)}); if(!n) throw new Error('missing ${sel.replace(/'/g, '')}'); n.click(); return 1})()`);
  const clickText = (sel, t) => ev(`(()=>{const n=[...document.querySelectorAll(${J(sel)})].find(x=>x.textContent.includes(${J(t)})); if(!n) throw new Error('missing text ' + ${J(t)}); n.click(); return 1})()`);
  const setv = (sel, v) => ev(`(()=>{const e=document.querySelector(${J(sel)}); if(!e) throw new Error('no field ' + ${J(sel)}); e.value=${J(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return 1})()`);
  return { ev, until, click, clickText, setv };
}
async function section(n, fn, pages) { const e0 = pages.map((p) => p.errors.length); try { await fn(); } catch (e) { fails++; console.log('FAIL ' + n + ' -> ' + e.message); } pages.forEach((p, i) => { if (p.errors.length > e0[i]) { fails++; console.log('FAIL ' + n + ' page errors ' + J(p.errors.slice(e0[i])).slice(0, 300)); } }); }
(async () => {
  const b = await Browser.launch();
  const ap = await b.newPage(); await ap.viewport(1400, 900); const A = helpers(ap, 'admin');
  await ap.goto(U('admin/control.html')); await A.ev('localStorage.clear(); sessionStorage.clear()'); await ap.goto(U('admin/control.html')); await sleep(600);
  check('control console needs an admin session', /Sign in required/.test(await A.ev('document.body.textContent')));
  await A.ev(`localStorage.setItem('ridenova.admin.v1', JSON.stringify({session:{on:true,until:Date.now()+8*3600e3,role:'OPS_MANAGER',email:'priya@ridenova.example',trust:false}}))`);
  await ap.goto(U('admin/control.html?s=1#pricing')); await A.until(`!!document.querySelector('[data-veh=Cab][data-k=base]')`, 6000, 'pricing tab');
  // customer
  const cp = await b.newPage(); await cp.viewport(1100, 900); const C = helpers(cp, 'customer');
  await cp.goto(U('customer-app/index.html')); await C.ev(`RN.store.signIn('9848004321')`); await cp.goto(U('customer-app/index.html')); await C.until('window.RN&&RN.ui&&RN.ui.sid==="R29"', 10000, 'customer home');
  const pages = [ap, cp];
  let q0, place = 'Hitec City Metro Station';
  await section('pricing: admin rate card -> customer fare', async () => {
    await C.ev(`RN.product.trip.drop = RN.product.PLACES.find(p=>p.n===${J(place)}); RN.ui.go('R09')`); await C.until(`RN.ui.sid==='R09'`);
    q0 = await C.ev(`JSON.stringify(RN.product.quote(RN.product.trip,'Cab'))`); q0 = JSON.parse(q0);
    check('customer R09 shows the quoted Cab fare', (await C.ev('document.querySelector("#mock").textContent')).includes(await C.ev(`RN.product.rs(${q0.total})`)));
    await A.setv('[data-veh=Cab][data-k=base]', 150); await A.clickText('.pc-card button', 'Save rate card'); await sleep(200);
    check('rate card change needs a reason', (await A.ev(`document.querySelector('[name=pnote]').getAttribute('aria-invalid')`)) === 'true');
    const v0 = await A.ev('RNPC.cfg.version');
    await A.setv('[data-veh=Cab][data-k=base]', 150); await A.setv('[name=pnote]', 'Festival test fare'); await A.clickText('.pc-card button', 'Save rate card'); await sleep(300);
    check('admin save bumps config version', (await A.ev('RNPC.cfg.version')) === v0 + 1);
    await C.until(`RN.product.quote(RN.product.trip,'Cab').total > ${q0.total + 9000}`, 6000, 'customer fare updated');
    const q1 = JSON.parse(await C.ev(`JSON.stringify(RN.product.quote(RN.product.trip,'Cab'))`));
    check('customer Cab fare rose by base delta x surge + GST', Math.abs(q1.total - q0.total - Math.round(10000 * q1.surge * 1.05)) <= 2, q0.total + ' -> ' + q1.total);
    await C.until(`document.querySelector('#mock').textContent.includes(RN.product.rs(${q1.total}))`, 6000, 'R09 redraw').catch(async e=>{console.log('DIAG', await C.ev(`JSON.stringify({sid:RN.ui.sid,v:RNPC.cfg.version,ae:document.activeElement&&document.activeElement.tagName,sheet:!!document.querySelector('#mock .sheet, #mock .p-sheet, #mock [role=dialog]'),veh:JSON.stringify(RN.product.VEH).slice(0,200),txt:document.querySelector('#mock').textContent.slice(0,300)})`));throw e}); check('open customer R09 refreshed live with the new price', true);
    await A.setv('[name=ckm]', q1.km); await A.setv('[name=cmin]', q1.mins); await A.setv('[name=chour]', new Date().getHours()); await sleep(150);
    check('admin fare calculator matches the customer quote', (await A.ev(`document.querySelector('[data-k=total]').textContent`)) === (await C.ev(`RN.product.rs(${q1.total})`)), await A.ev(`document.querySelector('[data-k=total]').textContent`));
  }, pages);
  await section('catalog: disable service tile and vehicle', async () => {
    await A.ev(`location.hash='services'`); await A.until(`!!document.querySelector('[aria-label="Food live"]')`);
    await C.ev(`RN.ui.go('R29')`); await C.until(`RN.ui.sid==='R29'`); await sleep(400);
    check('Food tile visible before', await C.ev(`[...document.querySelectorAll('.rn-screen[data-sid=R29] .svc a')].some(a=>a.textContent.trim()==='Food')`));
    await A.click('[aria-label="Food live"]'); await C.until(`![...document.querySelectorAll('.rn-screen[data-sid=R29] .svc a')].some(a=>a.textContent.trim()==='Food')`, 6000, 'food hidden').catch(async e=>{console.log('DIAG2', await C.ev(`JSON.stringify({sid:RN.ui.sid,svc:[...document.querySelectorAll('.svc a')].map(a=>a.textContent.trim()).join('|'),scr:[...document.querySelectorAll('.rn-screen')].map(x=>x.dataset.sid).join(',')})`));throw e});
    check('disabled Food tile hidden on open customer home', true);
    await A.click('[aria-label="Food live"]'); await C.until(`[...document.querySelectorAll('.rn-screen[data-sid=R29] .svc a')].some(a=>a.textContent.trim()==='Food')`, 6000, 'food back'); check('re-enabled tile comes back', true);
    await A.click('[aria-label="Premium live"]'); await C.until(`!('Premium' in RN.product.VEH)`, 5000, 'premium off');
    await C.ev(`RN.ui.go('R09')`); await C.until(`RN.ui.sid==='R09'`); await sleep(300);
    check('disabled Premium not offered in ride options', !(await C.ev(`document.querySelector('.rn-screen[data-sid=R09]').textContent.includes('Premium')`)));
    await A.click('[aria-label="Premium live"]'); await C.until(`'Premium' in RN.product.VEH`, 5000, 'premium back'); check('Premium back after re-enable', true);
  }, pages);
  await section('offers: expire coupon', async () => {
    check('RIDE50 valid in customer app', await C.ev(`!!RN.product.coupon('RIDE50')`));
    await A.ev(`location.hash='offers'`); await A.until(`!!document.querySelector('[aria-label="Expire RIDE50"]')`); await A.click('[aria-label="Expire RIDE50"]');
    await C.until(`!RN.product.coupon('RIDE50')`, 5000, 'coupon expired'); check('expired coupon rejected by customer app', true);
    await C.ev(`RN.ui.go('R22')`); await C.until(`RN.ui.sid==='R22'`); await sleep(300);
    check('expired coupon no longer listed in R22', !(await C.ev(`document.querySelector('.rn-screen[data-sid=R22]').textContent.includes('RIDE50')`)));
  }, pages);
  // driver + partner + agent pages
  const dp = await b.newPage(); await dp.viewport(1100, 900); const Dr = helpers(dp, 'driver');
  await dp.goto(U('driver-app/index.html')); await Dr.until('window.RN&&RN.ui&&RN.ui.sid', 10000);
  const pp = await b.newPage(); await pp.viewport(1100, 900); const Pa = helpers(pp, 'partner');
  await pp.goto(U('patner-app/index.html')); await Pa.ev(`localStorage.setItem('ridenova.partner.v1', JSON.stringify({signedIn:true,email:'owner@biryanihouse.example'}))`); await pp.goto(U('patner-app/index.html')); await Pa.until('window.RN&&RN.ui&&RN.ui.sid', 10000);
  const gp = await b.newPage(); await gp.viewport(1300, 900); const G = helpers(gp, 'agent');
  await gp.goto(U('agent-portal/index.html')); await sleep(1500);
  pages.push(dp, pp, gp);
  await section('broadcast banner -> apps', async () => {
    await A.ev(`location.hash='broadcasts'`); await A.until(`!!document.querySelector('[name=bctext]')`);
    await A.setv('[name=bctext]', 'Heavy rain in Hyderabad: pickups may take longer.');
    await A.ev(`document.querySelectorAll('[name=bcapp]').forEach(i=>{i.checked=['customer','driver','agent'].includes(i.value)})`); await A.click('[data-act=publish-broadcast]');
    const T = 'Heavy rain in Hyderabad';
    await C.until(`(document.querySelector('.rnpc-bc')||{textContent:''}).textContent.includes(${J(T)})`, 5000, 'customer banner'); check('broadcast shown in customer app', true);
    await Dr.until(`(document.querySelector('.rnpc-bc')||{textContent:''}).textContent.includes(${J(T)})`, 5000, 'driver banner'); check('broadcast shown in driver app', true);
    await G.until(`(document.querySelector('.rnpc-bc')||{textContent:''}).textContent.includes(${J(T)})`, 5000, 'agent banner'); check('broadcast shown in agent portal', true);
    check('broadcast not shown in partner app (not targeted)', !(await Pa.ev(`!!document.querySelector('.rnpc-bc')`)));
    await C.click('.rnpc-bc .rnpc-x'); await sleep(200); check('customer can dismiss the banner', !(await C.ev(`!!document.querySelector('.rnpc-bc')`)));
  }, pages);
  await section('maintenance mode', async () => {
    await A.ev(`location.hash='flags'`); await A.until(`!!document.querySelector('[aria-label="Maintenance for Partner"]')`); await A.click('[aria-label="Maintenance for Partner"]');
    await Pa.until(`!!document.querySelector('.rnpc-maint')`, 5000, 'maint on'); check('partner app shows maintenance screen', true);
    check('customer app unaffected', !(await C.ev(`!!document.querySelector('.rnpc-maint')`)));
    await A.click('[aria-label="Maintenance for Partner"]'); await Pa.until(`!document.querySelector('.rnpc-maint')`, 5000, 'maint off'); check('maintenance off restores the app', true);
  }, pages);
  await section('driver KYC: manual reject + approve, then suspend', async () => {
    await A.ev(`location.hash='drivers'`); await A.until(`!!document.querySelector('#pc-auto')`); await A.setv('#pc-auto', 0); await A.click('[aria-label="Save KYC auto-approve"]'); await sleep(200);
    check('auto-approve switched off', (await A.ev('RNPC.cfg.drivers.kycAutoApproveSecs')) === 0);
    await Dr.until(`RN.ui.sid==='D01'`); await Dr.setv('#mock [name=phone]', '9876543210'); await Dr.click('#mock [data-do*=driverLogin]'); await Dr.until(`document.querySelector('.p-sheet')`);
    await Dr.setv('#mock [name=dotp]', '482716'); await Dr.clickText('#mock .p-sheet button.btn', 'Verify'); await Dr.until(`RN.ui.sid==='D02'`);
    await Dr.setv('#mock [name=fullname]', 'Ravi Teja'); await Dr.setv('#mock [name=model]', 'Maruti Dzire'); await Dr.setv('#mock [name=plate]', 'TS 08 AB 1234'); await Dr.clickText('#mock button', 'Next'); await Dr.until(`RN.ui.sid==='D03'`);
    const upload = async () => { const keys = (await Dr.ev(`[...document.querySelectorAll('#mock [data-do="x.uploadDoc"]')].map(x=>x.getAttribute('data-arg')).join(',')`)).split(','); for (const k of keys) { await Dr.ev(`document.querySelector('#mock [data-do="x.uploadDoc"][data-arg="${k}"]').click()`); await Dr.until(`RN.ui.engine.state.kyc.docs.find(d=>d.key==="${k}").state==="uploaded"`, 4000, 'upload ' + k); await sleep(120); } await sleep(600); await Dr.click('#mock [data-do*=submitKyc]'); await Dr.until(`RN.ui.sid==='D04'`, 6000, 'D04'); };
    await upload();
    await A.until(`!!document.querySelector('[aria-label="Reject Ravi Teja"]')`, 6000, 'kyc row'); check('submitted KYC appears in admin queue', true);
    await sleep(2500); check('no auto-approval when manual review is on', (await Dr.ev(`RN.driverStore.data.stage`)) === 'submitted');
    await A.click('[aria-label="Reject Ravi Teja"]'); await A.until(`!!document.querySelector('.pc-dlg')`); await A.setv('.pc-dlg [name=reason]', 'Insurance has expired'); await A.click('.pc-dlg button[type=submit]');
    await Dr.until(`RN.ui.sid==='D03' && (document.querySelector('.rnpc-kyc')||{textContent:''}).textContent.includes('Insurance has expired')`, 8000, 'reject reason'); check('rejection reason shown to driver on D03', true);
    await upload();
    await A.until(`!!document.querySelector('[aria-label="Approve Ravi Teja"]')`, 6000, 'pending again'); await A.click('[aria-label="Approve Ravi Teja"]');
    await Dr.until(`/Approved/.test(document.querySelector('#mock').textContent)`, 8000, 'approved'); check('admin approval reaches driver', true);
    await Dr.click('#mock [data-do*=training]'); await Dr.until(`/D05|D06/.test(RN.ui.sid)`); check('approved driver proceeds to home', true);
    await A.until(`!!document.querySelector('[aria-label="Suspend Ravi Teja"]')`, 6000, 'driver row'); await A.click('[aria-label="Suspend Ravi Teja"]'); await A.until(`!!document.querySelector('.pc-dlg')`); await A.click('.pc-dlg button[type=submit]');
    await Dr.until(`RN.ui.engine.state.drivers[RN.ui.engine.state.persona].blocked===true`, 5000, 'blocked').catch(async e=>{console.log('DIAG4', await A.ev(`JSON.stringify({dlg:!!document.querySelector('.pc-dlg'),err:(document.querySelector('.pc-dlg')||{}).textContent,ops:JSON.stringify(RNPC.ops.drivers).slice(0,300)})`), await Dr.ev(`JSON.stringify({p:RN.ui.engine.state.persona,ph:(RN.driverStore&&RN.driverStore.data&&RN.driverStore.data.phone)})`));throw e}); 
    const r = JSON.parse(await Dr.ev(`RN.kit.exec('driver.online',{},null,{instant:true}).then(r=>JSON.stringify(r||{}))`));
    check('suspended driver cannot go online', r.ok === false, J(r));
    check('suspension banner shown', await Dr.ev(`!!document.querySelector('.rnpc-susp')`));
    await A.click('[aria-label="Reactivate Ravi Teja"]'); await Dr.until(`!RN.ui.engine.state.drivers[RN.ui.engine.state.persona].blocked`, 5000, 'unblocked');
    const r2 = JSON.parse(await Dr.ev(`RN.kit.exec('driver.online',{},null,{instant:true}).then(r=>JSON.stringify(r||{}))`)); check('reactivated driver can go online', r2.ok === true, J(r2));
  }, pages);
  await section('partners: commission + menu moderation', async () => {
    await A.ev(`location.hash='partners'`); await A.until(`!!document.querySelector('[aria-label="Hide Chicken dum biryani"]')`, 6000, 'menu listed'); check('partner menu visible to admin', true);
    await A.click('[aria-label="Hide Chicken dum biryani"]'); await A.until(`!!document.querySelector('.pc-dlg')`); await A.click('.pc-dlg button[type=submit]');
    await Pa.until(`RN.partnerStore.data.menu.find(m=>m.n==='Chicken dum biryani').on===false`, 5000, 'item hidden'); check('hidden item switched off in partner app', true);
    await A.ev(`(()=>{const i=[...document.querySelectorAll('.pc-field label')].find(l=>l.textContent==='Commission %'); const inp=document.getElementById(i.getAttribute('for')); inp.value=22; inp.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`); await A.ev(`[...document.querySelectorAll('.pc-card')].find(c=>c.textContent.includes('Commission & payouts')).querySelector('.pc-hd button').click()`);
    await Pa.ev(`RN.ui.go('P07')`); await Pa.until(`document.querySelector('#mock').textContent.includes('Commission (22%)')`, 6000, 'commission').catch(async e=>{console.log('DIAG3', await Pa.ev(`JSON.stringify({sid:RN.ui.sid,c:RN.partnerCommission&&RN.partnerCommission(),m:(document.querySelector('#mock').textContent.match(/Commission[^0-9]{0,5}\\(?[0-9.]+%?\\)?/g)||[]).join('|'),cfg:localStorage.getItem('ridenova.platform.v1')&&JSON.parse(localStorage.getItem('ridenova.platform.v1')).partners})`));throw e}); check('partner payouts use admin commission', true);
  }, pages);
  await section('customers: wallet credit + block', async () => {
    await A.ev(`location.hash='customers'`); await A.until(`!!document.querySelector('[aria-label="Adjust wallet of 9848004321"]')`, 6000, 'customer row'); check('customer registered in admin', true);
    const w0 = await C.ev('RN.store.user().walletPaise');
    await A.click('[aria-label="Adjust wallet of 9848004321"]'); await A.until(`!!document.querySelector('.pc-dlg')`); await A.setv('.pc-dlg [name=amt]', 250); await A.setv('.pc-dlg [name=note]', 'Goodwill for late pickup'); await A.click('.pc-dlg button[type=submit]');
    await C.until(`RN.store.user().walletPaise===${w0 + 25000}`, 6000, 'wallet credit'); check('admin wallet credit lands once in customer wallet', true);
    await sleep(2000); check('credit is not applied twice', (await C.ev('RN.store.user().walletPaise')) === w0 + 25000);
    await A.until(`!!document.querySelector('[aria-label="Block 9848004321"]')`); await A.click('[aria-label="Block 9848004321"]'); await A.until(`!!document.querySelector('.pc-dlg')`); await A.click('.pc-dlg button[type=submit]');
    await C.until(`!!document.querySelector('.rnpc-block')`, 5000, 'block'); check('blocked customer sees the account-on-hold screen', true);
    await A.until(`!!document.querySelector('[aria-label="Unblock 9848004321"]')`); await A.click('[aria-label="Unblock 9848004321"]'); await C.until(`!document.querySelector('.rnpc-block')`, 5000, 'unblock'); check('unblock restores access', true);
  }, pages);
  await section('rbac, audit, export/import', async () => {
    await A.ev(`(()=>{const s=document.getElementById('pc-role'); s.value='AUDITOR'; s.dispatchEvent(new Event('change'))})()`); await A.ev(`location.hash='pricing'`); await sleep(300);
    check('auditor sees pricing read-only', await A.ev(`document.querySelector('[data-veh=Cab][data-k=base]').disabled && /Read only/.test(document.body.textContent)`));
    await A.ev(`(()=>{const s=document.getElementById('pc-role'); s.value='OPS_MANAGER'; s.dispatchEvent(new Event('change'))})()`); await sleep(200);
    const acts = await A.ev(`RNPC.ops.audit.map(a=>a.action).join(',')`);
    check('audit log has pricing, service, coupon, kyc, suspend, wallet entries', ['pricing.rate_card', 'service.disable', 'coupon.expire', 'kyc.reject', 'kyc.approve', 'driver.suspend', 'wallet.adjust', 'customer.block', 'broadcast.publish'].every((x) => acts.includes(x)), acts.slice(0, 200));
    await A.ev(`location.hash='config'`); await A.until(`!!document.querySelector('[name=cfgpaste]')`);
    await A.setv('[name=cfgpaste]', '{"kind":"ridenova-platform-config","config":{"schema":9}}'); await A.clickText('button', 'Import pasted JSON'); await sleep(200);
    check('invalid import rejected with a reason', /Unsupported schema/.test(await A.ev(`document.getElementById('pc-import-msg').textContent`)));
    const exp = await A.ev('RNPC.export()'); const v = await A.ev('RNPC.cfg.version'); const obj = JSON.parse(exp); obj.config.pricing.cities.HYD.Auto.base = 33;
    await A.setv('[name=cfgpaste]', JSON.stringify(obj)); await A.clickText('button', 'Import pasted JSON'); await sleep(300);
    check('valid import goes live as a new version', (await A.ev('RNPC.cfg.version')) === v + 1 && (await A.ev('RNPC.cfg.pricing.cities.HYD.Auto.base')) === 33);
    await C.until(`RNPC.cfg.pricing.cities.HYD.Auto.base===33`, 5000, 'customer got import'); check('imported config reaches customer app', true);
  }, pages);
  // walk every tab for errors and dead buttons-free rendering
  await section('every Platform control tab renders', async () => {
    const tabs = (await A.ev(`[...document.querySelectorAll('#pc-nav a[data-tab]')].map(a=>a.dataset.tab).join(',')`)).split(',');
    let ok = 0; for (const t of tabs) { await A.ev(`location.hash=${J(t)}`); await sleep(150); if (await A.ev(`document.querySelector('#pc-main h1') && document.querySelectorAll('#pc-main .pc-card, #pc-main .pc-kpis').length>0`)) ok++; else console.log('  empty tab', t); }
    check('all ' + tabs.length + ' tabs render content', ok === tabs.length, ok + '/' + tabs.length);
  }, pages);
  pages.forEach((p, i) => check(['admin', 'customer', 'driver', 'partner', 'agent'][i] + ' page has no JS errors', p.errors.length === 0, J(p.errors.slice(0, 2))));
  console.log(passes + ' passed, ' + fails + ' failed'); console.log(fails ? 'FAILED' : 'ALL PASSED');
  await b.close(); process.exit(fails ? 1 : 0);
})();
