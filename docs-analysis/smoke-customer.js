// smoke: open every screen as the demo customer and report errors / empty screens. usage: node smoke-customer.js
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../customer-app/index.html');
(async () => {
  const b = await Browser.launch(); const page = await b.newPage(); await page.viewport(1100, 900);
  await page.goto(fileUrl(APP)); await page.eval(`localStorage.clear()`); await page.goto(fileUrl(APP));
  await page.eval(`new Promise(r=>{const t=setInterval(()=>{if(window.RN&&RN.ui&&RN.ui.sid&&RN.store&&RN.product){clearInterval(t);r(1)}},50)})`);
  await page.eval(`RN.store.signIn('9848004321')`); await page.goto(fileUrl(APP)); await page.eval(`new Promise(r=>{const t=setInterval(()=>{if(RN.ui.sid==='R29'){clearInterval(t);r(1)}},50)})`); await sleep(500);
  const sids = await page.eval(`[...document.querySelectorAll('.rn-screen')].map(s=>s.getAttribute('data-sid'))`);
  let bad = 0;
  for (const sid of sids) {
    const before = page.errors.length;
    await page.eval(`RN.ui.go('${sid}')`); await sleep(350);
    const info = await page.eval(`(()=>{const s=document.querySelector('.rn-screen[data-sid="${sid}"]'); const body=s&&s.querySelector('.body'); return JSON.stringify({vis:s&&!s.hidden, sid:RN.ui.sid, len:body?body.textContent.trim().length:0, btn:s?s.querySelectorAll('button,a').length:0, back:!!(s&&s.querySelector('[data-back]')), ovf: body ? body.scrollWidth-body.clientWidth : 0, nav: !!(s&&s.querySelector('.bnav'))})})()`);
    const o = JSON.parse(info); const errs = page.errors.slice(before);
    const flag = errs.length || !o.vis || o.len < 20 || o.sid !== sid;
    if (flag) bad++;
    console.log((flag ? 'BAD  ' : 'ok   ') + sid + ' len=' + o.len + ' btn=' + o.btn + ' back=' + o.back + ' nav=' + o.nav + (o.ovf > 2 ? ' OVERFLOW=' + o.ovf : '') + (o.sid !== sid ? ' landed=' + o.sid : '') + (errs.length ? ' ERR ' + JSON.stringify(errs).slice(0, 300) : ''));
  }
  console.log('screens', sids.length, 'bad', bad);
  await b.close();
})();