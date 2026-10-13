const path = require('path'), fs = require('fs');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../customer-app/index.html');
(async () => {
  const b = await Browser.launch(); const page = await b.newPage(); await page.viewport(1100, 900);
  await page.goto(fileUrl(APP)); await page.eval(`localStorage.clear(); RN.store.signIn('9848004321')`); await page.goto(fileUrl(APP));
  await page.eval(`new Promise(r=>{const t=setInterval(()=>{if(RN.ui.sid==='R29'){clearInterval(t);r(1)}},50)})`); await sleep(500);
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  for (const sid of (process.argv[2] || 'R29,R33,R35,R44,R45,R52,R36,R28').split(',')) {
    if (sid === 'PIN') { await page.eval(`RN.ui.go('R21')`); await sleep(500); await page.eval(`RN.product.pay({title:'Hitec City ride',paise:24800,onPaid(){}})`); await sleep(300); await page.eval(`[...document.querySelectorAll('#mock .p-sheet .li')].find(x=>/UPI/.test(x.textContent)).click()`); await page.eval(`[...document.querySelectorAll('#mock .p-sheet button.btn')].find(x=>/Pay/.test(x.textContent)).click()`); await sleep(300); for (const k of '12') await page.eval(`[...document.querySelectorAll('#mock .p-key')].find(b=>b.textContent==='${k}').click()`); await sleep(200); const png = await page.screenshot('.rn-screen[data-sid=\"R21\"] .phone'); fs.writeFileSync(path.join(__dirname, 'shots', 'PIN.png'), Buffer.from(png, 'base64')); continue; }
    if (sid === 'DARK') { await page.eval(`RN.ux.setDark(true); RN.ui.go('R28')`); await sleep(700); const png = await page.screenshot('.rn-screen[data-sid=\"R28\"] .phone'); fs.writeFileSync(path.join(__dirname, 'shots', 'DARK.png'), Buffer.from(png, 'base64')); await page.eval('RN.ux.setDark(false)'); continue; }
    await page.eval(`RN.ui.go('${sid}')`); await sleep(600);
    if (sid === 'R45') { await page.eval(`document.querySelectorAll('#mock .p-menu-item .p-step')[1].click()`); await sleep(200); }
    if (sid === 'R35') { await page.eval(`document.querySelectorAll('#mock .p-seat:not(.taken):not(.gap)')[0].click()`); }
    const png = await page.screenshot('.rn-screen[data-sid="' + sid + '"] .phone'); fs.writeFileSync(path.join(__dirname, 'shots', sid + '.png'), Buffer.from(png, 'base64'));
  }
  await b.close();
})();