'use strict';
/*
 * Renders screen PNGs from the specification pages (replacement for source/shots.py, which needs Playwright and
 * Linux paths). Captures the mock (#mock > *) of each page with scripts disabled, like the original images:
 * phones at 2x, admin and agent desktops at 1.25x.
 * Usage (from architecture-workflow/):  node tools/shots.js [IDs...]      e.g. node tools/shots.js R56 S01
 *                                         node tools/shots.js --missing    only screens without a PNG
 */
const fs = require('node:fs');
const path = require('node:path');
const { Browser, fileUrl } = require('../tests/browser/cdp');

const ROOT = path.resolve(__dirname, '..');
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/js/generated/screens.js'), 'utf8').replace(/^[\s\S]*?window\.RN_SCREENS = /, '').replace(/;\s*$/, ''));

(async () => {
  const args = process.argv.slice(2);
  let ids = args.filter((a) => /^[A-Z]\d\d$/.test(a));
  if (args.includes('--missing')) ids = Object.keys(reg).filter((id) => !fs.existsSync(path.join(ROOT, 'images/screens', reg[id].app, id + '.png')));
  if (!ids.length) { console.log('nothing to render'); return; }
  const b = await Browser.launch();
  const p = await b.newPage();
  await p.send('Emulation.setScriptExecutionDisabled', { value: true });
  for (const id of ids) {
    const desk = reg[id].app === 'admin' || /^S2\d$/.test(id);
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: desk ? 1.25 : 2, mobile: false });
    await p.goto(fileUrl(path.join(ROOT, reg[id].file)));
    const box = await p.eval(`(() => { const r = document.querySelector('#mock > *').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
    const r = await p.send('Page.captureScreenshot', { format: 'png', clip: Object.assign(box, { scale: 1 }), captureBeyondViewport: true });
    const out = path.join(ROOT, 'images/screens', reg[id].app, id + '.png');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
    console.log('wrote', path.relative(ROOT, out));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
