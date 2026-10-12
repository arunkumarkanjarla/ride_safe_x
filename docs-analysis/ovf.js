const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../customer-app/index.html');
(async () => {
  const b = await Browser.launch(); const page = await b.newPage(); await page.viewport(1100, 900);
  await page.goto(fileUrl(APP)); await page.eval(`localStorage.clear(); RN.store.signIn('9848004321')`); await page.goto(fileUrl(APP));
  await page.eval(`new Promise(r=>{const t=setInterval(()=>{if(RN.ui.sid==='R29'){clearInterval(t);r(1)}},50)})`); await sleep(500);
  for (const sid of ['R47','R25','R30']) {
    await page.eval(`RN.ui.go('${sid}')`); await sleep(500);
    console.log(sid, await page.eval(`(()=>{const body=document.querySelector('.rn-screen[data-sid="${sid}"] .body'); const W=body.getBoundingClientRect().right; return JSON.stringify([...body.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>W+1).slice(0,6).map(e=>e.tagName+'.'+e.className+' '+Math.round(e.getBoundingClientRect().width)+' "'+e.textContent.trim().slice(0,30)+'"')); })()`));
  }
  console.log(await page.eval(`document.querySelector('.rn-screen[data-sid="R30"] .scr').innerHTML.slice(0,600)`));
  await b.close();
})();