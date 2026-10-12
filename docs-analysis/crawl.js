// generic dead-control crawler. usage: node crawl.js <app-folder> [signinScript]
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const app = process.argv[2];
const APP = path.resolve(__dirname, '../' + app + '/index.html');
(async () => {
  const b = await Browser.launch(); const page = await b.newPage(); await page.viewport(1100, 900);
  await page.goto(fileUrl(APP)); await page.eval(`try{localStorage.clear()}catch(e){}`); await page.goto(fileUrl(APP));
  await page.eval(`new Promise(r=>{const t=setInterval(()=>{if(window.RN&&RN.ui&&RN.ui.sid){clearInterval(t);r(1)}},50)})`); await sleep(400);
  const pre = process.argv[3]; if (pre) { await page.eval(pre); await sleep(600); }
  const sids = await page.eval(`[...document.querySelectorAll('.rn-screen')].map(s=>s.getAttribute('data-sid'))`);
  console.log('start sid', await page.eval('RN.ui.sid'), 'screens', sids.length);
  let dead = [], redirect = [];
  for (const sid of sids) {
    await page.eval(`RN.ui.go('${sid}')`); await sleep(250);
    const cur = await page.eval('RN.ui.sid'); if (cur !== sid) { redirect.push(sid + '->' + cur); continue; }
    const n = await page.eval(`document.querySelectorAll('.rn-screen[data-sid="${sid}"] [data-go],.rn-screen[data-sid="${sid}"] [data-do],.rn-screen[data-sid="${sid}"] [data-ui],.rn-screen[data-sid="${sid}"] [data-msg],.rn-screen[data-sid="${sid}"] button:not([data-go]):not([data-do]):not([data-ui]):not([data-msg]):not([data-back])').length`);
    for (let i = 0; i < n; i++) {
      await page.eval(`RN.ui.go('${sid}')`); await sleep(120);
      if ((await page.eval('RN.ui.sid')) !== sid) break;
      const r = await page.eval(`new Promise(res=>{
        const sec=document.querySelector('.rn-screen[data-sid="${sid}"]');
        const els=[...sec.querySelectorAll('[data-go],[data-do],[data-ui],[data-msg],button:not([data-go]):not([data-do]):not([data-ui]):not([data-msg]):not([data-back])')]; const el=els[${i}]; if(!el){res(JSON.stringify({skip:1}));return}
        const label=(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,30)+' ['+['go','do','ui','msg'].map(k=>el.dataset[k]?k+'='+el.dataset[k]:'').filter(Boolean).join(' ')+']';
        let muts=0; const mo=new MutationObserver(m=>{muts+=m.length}); mo.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
        const sid0=RN.ui.sid, h0=location.hash, toasts0=document.querySelectorAll('.rn-toast').length;
        if(el.disabled||el.closest('[hidden]')){res(JSON.stringify({label,hidden:1}));return}
        el.click();
        setTimeout(()=>{mo.disconnect(); res(JSON.stringify({label, changed: RN.ui.sid!==sid0||location.hash!==h0||muts>0||document.querySelectorAll('.rn-toast').length>toasts0, muts}))},450);
      })`);
      const o = JSON.parse(r); if (o.skip || o.hidden) continue;
      if (!o.changed) dead.push(sid + ': ' + o.label);
    }
  }
  console.log('redirected screens:', redirect.join(' '));
  console.log('DEAD controls (' + dead.length + '):'); dead.forEach(d => console.log('  ' + d));
  console.log('page errors:', JSON.stringify(page.errors.slice(0, 6)));
  await b.close();
})();