// shared UX layer checks for customer, driver and partner apps
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
let fails = 0, passes = 0; const J = JSON.stringify;
const check = (n, ok, i) => { if (!ok) fails++; else passes++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' -> ' + i : '')); };
const APPS = [
  ['customer-app', `localStorage.clear(); RN.store.signIn('9848004321')`, 'R28', 'R18'],
  ['driver-app', `localStorage.clear(); localStorage.setItem('ridenova.driver.v1', JSON.stringify({signedIn:true,phone:'9000012345',stage:'active',known:{'9000012345':true}}))`, 'D28', 'D13'],
  ['patner-app', `localStorage.clear(); localStorage.setItem('ridenova.partner.v1', JSON.stringify({signedIn:true,email:'owner@biryanihouse.example'}))`, 'P10', 'P03']
];
(async () => {
  const b = await Browser.launch();
  for (const [app, pre, settings, other] of APPS) {
    const page = await b.newPage(); await page.viewport(1100, 900); const ev = (x) => page.eval(x);
    const APP = path.resolve(__dirname, '../' + app + '/index.html');
    try {
      await page.goto(fileUrl(APP)); await ev(pre); await page.goto(fileUrl(APP)); await sleep(2200);
      await ev(`RN.ui.go('${other}')`); await sleep(120); check(app + ' skeleton on first visit', await ev(`!!document.querySelector('.rn-screen[data-sid="${other}"] .body.rn-skel')`));
      await sleep(600); check(app + ' skeleton clears', !(await ev(`!!document.querySelector('.rn-screen[data-sid="${other}"] .body.rn-skel')`)));
      await ev(`RN.ui.go('${settings}')`); await sleep(700);
      check(app + ' display block on ' + settings, await ev(`!!document.querySelector('.rn-screen[data-sid="${settings}"] .rn-display')`));
      await ev(`document.querySelector('.rn-screen[data-sid="${settings}"] .rn-display .toggle').click()`); await sleep(200);
      check(app + ' dark mode on', await ev(`document.documentElement.classList.contains('rn-dark') && !!document.querySelector('.rn-screen[data-sid="${settings}"] .scr.dark')`));
      await ev(`[...document.querySelectorAll('.rn-screen[data-sid="${settings}"] .rn-lang .chip')][1].click()`); await sleep(400);
      check(app + ' Hindi labels', /[\u0900-\u097F]/.test(await ev(`document.querySelector('.rn-screen[data-sid="${settings}"]').textContent`)));
      await page.goto(fileUrl(APP)); await sleep(2200); check(app + ' dark + language persist on reload', await ev(`document.documentElement.classList.contains('rn-dark') && RN.ux.prefs.lang==='hi'`));
      await ev(`RN.ux.setLang('en'); RN.ux.setDark(false)`); await sleep(300); check(app + ' back to English', !/[\u0900-\u097F]/.test(await ev(`(document.querySelector('#mock .bnav')||document.querySelector('#mock')).textContent`)));
      await ev(`RN.ux.forceOffline=true; window.dispatchEvent(new Event('offline'))`); await sleep(150); check(app + ' offline banner', await ev(`!!document.querySelector('#mock .rn-offline')`));
      await ev(`RN.ux.forceOffline=false; window.dispatchEvent(new Event('online'))`); await sleep(150); check(app + ' online removes banner', !(await ev(`!!document.querySelector('#mock .rn-offline')`)));
      await ev(`window.__u=0; RN.ux.undoToast('Item removed', ()=>{window.__u=1})`); await ev(`document.querySelector('#mock .rn-undo button').click()`); check(app + ' undo toast', (await ev('window.__u')) === 1);
      await ev(`RN.ui.go('${other}')`); await sleep(700);
      const r = await ev(`(()=>{const body=document.querySelector('.rn-screen[data-sid="${other}"] .body'); const bx=body.getBoundingClientRect(); const x=bx.left+bx.width/2, y=bx.top+20; const t=document.elementFromPoint(x,y)||body; const opt={bubbles:true,clientX:x,pointerType:'touch',button:0}; t.dispatchEvent(new PointerEvent('pointerdown',Object.assign({clientY:y},opt))); t.dispatchEvent(new PointerEvent('pointermove',Object.assign({clientY:y+140},opt))); const seen=!!document.querySelector('#mock .rn-ptr.ready'); t.dispatchEvent(new PointerEvent('pointerup',Object.assign({clientY:y+140},opt))); return seen;})()`);
      await sleep(900); check(app + ' pull-to-refresh', r && /Updated just now/.test(await ev(`document.body.textContent`)));
      const small = await ev(`[...document.querySelectorAll('.rn-screen:not([hidden]) .phone .btn, .rn-screen:not([hidden]) .phone .bnav a')].filter(e=>e.offsetParent && e.getBoundingClientRect().height<43.5).length`); check(app + ' tap targets >= 44px', small === 0, small);
      check(app + ' no page errors', page.errors.length === 0, J(page.errors.slice(0, 2)).slice(0, 300));
    } catch (e) { fails++; console.log('FAIL ' + app + ' ' + e.message); }
  }
  // ---- desktop apps (admin, agent portal): dark mode + language + trusted OTP auto-continue + undo
  for (const app of ['admin', 'agent-portal']) {
    const page = await b.newPage(); await page.viewport(1400, 900); const ev = (x) => page.eval(x);
    const APP = path.resolve(__dirname, '../' + app + '/index.html');
    const until = async (x, t = 8000) => { const end = Date.now() + t; while (Date.now() < end) { try { if (await ev(x)) return true; } catch (e) {} await sleep(100); } return false; };
    const typeTrusted = async (sel, text) => { await ev(`(()=>{const i=document.querySelector(${J(sel)}); i.value=''; i.focus(); return 1})()`); await page.send('Input.insertText', { text }); };
    try {
      await page.goto(fileUrl(APP)); await ev('localStorage.clear()'); await page.goto(fileUrl(APP)); await sleep(1800);
      const tel0 = await ev(`(()=>{const c=document.body.cloneNode(true); c.querySelector('#rnux-bar').remove(); return (c.textContent.match(/[\\u0C00-\\u0C7F]/g)||[]).length})()`);
      check(app + ' display bar', await ev(`!!document.querySelector('#rnux-bar #rnux-dark') && !!document.querySelector('#rnux-lang')`));
      await ev(`document.getElementById('rnux-dark').click()`); await sleep(100);
      check(app + ' dark mode on', await ev(`document.documentElement.classList.contains('rn-dark')`));
      await ev(`(()=>{const s=document.getElementById('rnux-lang'); s.value='te'; s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(200);
      check(app + ' Telugu labels', /[\u0C00-\u0C7F]/.test(await ev('document.body.textContent')));
      await page.goto(fileUrl(APP)); await sleep(1800);
      check(app + ' prefs persist on reload', await ev(`document.documentElement.classList.contains('rn-dark') && /[\u0C00-\u0C7F]/.test(document.body.textContent)`));
      await ev(`RNUX.setLang('en'); RNUX.setDark(false)`); await sleep(200);
      check(app + ' back to English', (await ev(`(()=>{const c=document.body.cloneNode(true); c.querySelector('#rnux-bar').remove(); return (c.textContent.match(/[\\u0C00-\\u0C7F]/g)||[]).length})()`)) === tel0 && !(await ev(`document.documentElement.classList.contains('rn-dark')`)));
      if (app === 'admin') {
        await until(`window.RN&&RN.ui&&RN.ui.sid==='A01'`);
        await ev(`(()=>{const e=document.querySelector('#mock [name=apass]'); e.value='demo-only'; e.dispatchEvent(new Event('input',{bubbles:true}))})()`);
        await ev(`[...document.querySelectorAll('#mock button')].find(x=>x.textContent.includes('Continue')).click()`); await sleep(300);
        await ev(`(()=>{const i=document.querySelector('#mock .rn-otp-input'); i.value='73x0'; i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
        check(app + ' OTP keeps digits only', (await ev(`document.querySelector('#mock .rn-otp-input').value`)) === '730');
        await typeTrusted('#mock .rn-otp-input', '730951');
        check(app + ' MFA auto-continues when complete', await until(`RN.ui.sid==='A02'`, 6000));
      } else {
        await typeTrusted('#ag-code', '246810');
        check(app + ' code auto-continues when complete', await until(`location.hash==='#/G02'`, 6000));
        await ev(`window.__u=0; RNUX.undoToast('x', ()=>{window.__u=1})`); await ev(`document.querySelector('.rnux-undo button').click()`);
        check(app + ' undo toast', (await ev('window.__u')) === 1);
      }
      check(app + ' no page errors', page.errors.length === 0, J(page.errors.slice(0, 2)).slice(0, 300));
    } catch (e) { fails++; console.log('FAIL ' + app + ' ' + e.message); }
  }
  console.log(passes + ' passed, ' + fails + ' failed'); console.log(fails ? 'FAILED' : 'ALL PASSED'); await b.close();
  process.exit(fails ? 1 : 0);
})();