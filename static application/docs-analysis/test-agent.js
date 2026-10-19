// agent portal: sign-in, every page, click every button (dead-control + error crawl), persistence
const path = require('path');
const { Browser, fileUrl, sleep } = require('../architecture-workflow/tests/browser/cdp');
const APP = path.resolve(__dirname, '../agent-portal/index.html');
let page, fails = 0; const ev = (x) => page.eval(x), J = JSON.stringify;
const check = (n, ok, i) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? ' -> ' + i : '')); };
async function until(expr, t = 8000, why) { const end = Date.now() + t; while (Date.now() < end) { try { if (await page.eval(expr)) return true; } catch (e) {} await sleep(100); } throw new Error('timeout ' + (why || expr)); }
(async () => {
  const b = await Browser.launch(); page = await b.newPage(); await page.viewport(1400, 900);
  await page.goto(fileUrl(APP)); await ev('localStorage.clear()'); await page.goto(fileUrl(APP)); await sleep(800);
  try {
    check('starts on sign-in', /G01/.test(await ev('location.hash')));
    await ev(`document.querySelector('[data-form="signin"] button[type=submit], [data-form="signin"] button').click()`); await sleep(200);
    check('code required', /6-digit/.test(await ev(`document.querySelector('[data-view="login"]').textContent`)));
    await ev(`document.querySelector('#ag-code').value='123456'; document.querySelector('[data-form="signin"]').requestSubmit()`); await sleep(200);
    check('wrong code rejected', /not correct/.test(await ev(`document.querySelector('[data-view="login"]').textContent`)));
    await ev(`document.querySelector('#ag-code').value='246810'; document.querySelector('[data-form="signin"]').requestSubmit()`); await until(`location.hash==='#/G02'`, 5000, 'home'); check('signed in to G02', true);
    const pages = ['G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'G09', 'G10', 'G11', 'G12', 'G13']; let dead = [], clicked = 0;
    for (const g of pages) {
      await ev(`location.hash='#/${g}'`); await sleep(400);
      const n = await ev(`[...document.querySelectorAll('main button:not([disabled]), [data-view]:not([hidden]) button:not([disabled])')].filter(b=>b.offsetParent && !/sign out|log out/i.test(b.textContent)).length`);
      for (let i = 0; i < Math.min(n, 25); i++) {
        const r = await ev(`(()=>{const bs=[...document.querySelectorAll('[data-view]:not([hidden]) button:not([disabled])')].filter(b=>b.offsetParent && !/sign out|log out/i.test(b.textContent)); const b=bs[${i}]; if(!b) return null; if(!window.__mut){window.__mut=0; new MutationObserver(m=>{window.__mut+=m.length}).observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true}); document.addEventListener('input',()=>window.__mut++,true);} if(b.getAttribute('aria-selected')==='true'||b.getAttribute('aria-pressed')==='true'||/\b(on|active|ag-on|sel)\b/.test(b.className)) return {skip:1}; const ta=[...document.querySelectorAll('textarea,input')].map(x=>x.value).join('|'); const before=window.__mut+'|'+location.hash+'|'+ta; const label=b.textContent.trim().slice(0,30); b.click(); return {label, before};})()`);
        if (!r || r.skip) continue; clicked++; await sleep(150);
        const after = await ev(`window.__mut+'|'+location.hash+'|'+[...document.querySelectorAll('textarea,input')].map(x=>x.value).join('|')`);
        if (after === r.before) dead.push(g + ':' + r.label);
        await ev(`document.querySelectorAll('dialog[open], .ag-dialog, [role=dialog]').forEach(d=>{const c=[...d.querySelectorAll('button')].find(x=>/cancel|close|keep|no/i.test(x.textContent)); if(c) c.click();})`);
        await ev(`if(location.hash!=='#/${g}') location.hash='#/${g}'`); await sleep(120);
      }
    }
    check('buttons clicked across 12 pages', clicked > 60, clicked); check('no dead buttons', dead.length === 0, J(dead).slice(0, 600));
    const resolved = await ev(`JSON.parse(localStorage.getItem('ridenova.agent.v1')||'{}').order?.length||0`); check('workspace saved to localStorage', resolved > 0, resolved);
    await sleep(1200); await page.goto(fileUrl(APP)); await sleep(900); await ev(`location.hash='#/G03'`); await sleep(500); check('still signed in after reload', /G03/.test(await ev('location.hash')) && !(await ev(`!document.querySelector('[data-view="login"]').hidden`)));
  } catch (e) { fails++; console.log('FAIL ' + e.message); }
  check('no page errors', page.errors.length === 0, J(page.errors.slice(0, 3)).slice(0, 500));
  console.log(fails ? 'FAILED ' + fails : 'ALL PASSED'); await b.close();
  process.exit(fails ? 1 : 0);
})();