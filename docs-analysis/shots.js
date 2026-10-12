const path = require('path'), fs = require('fs');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../customer-app/index.html');
(async () => {
  const b = await Browser.launch(); const page = await b.newPage(); await page.viewport(1100, 900);
  await page.goto(fileUrl(APP)); await page.eval(`localStorage.clear(); RN.store.signIn('9848004321')`); await page.goto(fileUrl(APP));
  await page.eval(`new Promise(r=>{const t=setInterval(()=>{if(RN.ui.sid==='R29'){clearInterval(t);r(1)}},50)})`); await sleep(500);
  fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
  for (const sid of (process.argv[2] || 'R29,R33,R35,R44,R45,R52,R36,R28').split(',')) {
    await page.eval(`RN.ui.go('${sid}')`); await sleep(600);
    if (sid === 'R45') { await page.eval(`document.querySelectorAll('#mock .p-menu-item .p-step')[1].click()`); await sleep(200); }
    if (sid === 'R35') { await page.eval(`document.querySelectorAll('#mock .p-seat:not(.taken):not(.gap)')[0].click()`); }
    const png = await page.screenshot('.rn-screen[data-sid="' + sid + '"] .phone'); fs.writeFileSync(path.join(__dirname, 'shots', sid + '.png'), Buffer.from(png, 'base64'));
  }
  await b.close();
})();