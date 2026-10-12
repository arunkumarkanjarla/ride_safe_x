'use strict';
/*
 * Visual parity check: screenshots the same page in two folders and compares pixels.
 * Usage: node tests/browser/visual-compare.js <reference-root> <candidate-root> [mocks|pages|all] [--out dir]
 * Compares `#mock > *` for every screen page ("mocks") and whole pages for site pages ("pages").
 * Exit code 1 if any page differs by more than the tolerance.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Browser, fileUrl } = require('./cdp');

const [ref, cand, mode = 'all'] = process.argv.slice(2);
const outIdx = process.argv.indexOf('--out');
const outDir = outIdx > 0 ? process.argv[outIdx + 1] : null;
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const TOL = Number(process.env.RN_VISUAL_TOLERANCE || 0); // differing pixels allowed

function screenPages(root) {
  const res = [];
  for (const app of ['rider', 'driver', 'partner', 'admin']) {
    for (const f of fs.readdirSync(path.join(root, 'screens', app)).sort()) if (/^[A-Z]\d\d-.*\.html$/.test(f)) res.push(`screens/${app}/${f}`);
  }
  return res;
}
const SITE = ['index.html', 'architecture/index.html', 'architecture/00-how-it-works.html', 'architecture/03-ride-booking.html',
  'architecture/26-fare-transparency.html', 'flows/index.html', 'images/index.html', 'screens/rider/index.html', 'screens/admin/index.html',
  'screens/rider/R12-driver-assigned.html', 'screens/admin/A04-ride-detail.html'];

// --isolate: render only the mock at the top-left of an empty body, so page chrome above it (for example
// the prototype demo bar) cannot shift it by a fraction of a pixel
const ISOLATE = process.argv.includes('--isolate');
async function isolate(page) {
  await page.eval(`(() => { const m = document.querySelector('#mock > *'); if (!m) return 0;
    const h = document.createElement('div'); h.id = 'mock'; h.appendChild(m);
    document.body.replaceChildren(h); document.body.style.margin = '0'; document.body.style.padding = '8px'; h.style.display = 'inline-block'; return 1; })()`);
}

async function settle(page) {
  // load lazy images so both screenshots show the same content
  await page.eval(`(async () => { document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
    await document.fonts.ready; })()`);
}

async function diff(page, a, b) {
  if (a.equals(b)) return 0;
  return page.eval(`(async () => {
    const load = (s) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = 'data:image/png;base64,' + s; });
    const [x, y] = await Promise.all([load(${JSON.stringify(a.toString('base64'))}), load(${JSON.stringify(b.toString('base64'))})]);
    if (x.width !== y.width || x.height !== y.height) return -1;
    const c = document.createElement('canvas'); c.width = x.width; c.height = x.height; const g = c.getContext('2d');
    g.drawImage(x, 0, 0); const d1 = g.getImageData(0, 0, c.width, c.height).data;
    g.clearRect(0, 0, c.width, c.height); g.drawImage(y, 0, 0); const d2 = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < d1.length; i += 4) if (d1[i] !== d2[i] || d1[i+1] !== d2[i+1] || d1[i+2] !== d2[i+2]) {
      n++; const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width);
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    return n ? n + ' px in box ' + [x0, y0, x1, y1].join(',') : 0; })()`);
}

(async () => {
  const b = await Browser.launch();
  const p = await b.newPage();
  await p.viewport(1500, 1000);
  // --nojs compares markup + CSS only (the prototype adds runtime panels on purpose)
  if (process.argv.includes('--nojs')) await p.send('Emulation.setScriptExecutionDisabled', { value: true });
  const jobs = [];
  if (mode !== 'pages') screenPages(ref).forEach((f) => jobs.push([f, '#mock > *']));
  if (mode !== 'mocks') SITE.forEach((f) => jobs.push([f, null]));
  let bad = 0;
  const todo = jobs.filter(([f]) => !ONLY.length || ONLY.some((o) => f.includes(o)));
  for (const [f, sel] of todo) {
    await p.goto(fileUrl(path.join(ref, f))); await settle(p); if (ISOLATE && sel) await isolate(p); const a = await p.screenshot(sel);
    await p.goto(fileUrl(path.join(cand, f))); await settle(p); if (ISOLATE && sel) await isolate(p); const c = await p.screenshot(sel);
    const n = await diff(p, a, c);   // same tab: a background tab can stall headless screenshots
    const ok = n !== -1 && (n === 0 || parseInt(n, 10) <= TOL);
    if (!ok) {
      bad++;
      if (outDir) { fs.mkdirSync(outDir, { recursive: true }); const base = f.replace(/[\\/]/g, '_'); fs.writeFileSync(path.join(outDir, base + '.ref.png'), a); fs.writeFileSync(path.join(outDir, base + '.new.png'), c); }
    }
    console.log((ok ? 'SAME ' : 'DIFF ') + f + (n ? ` (${n === -1 ? 'size differs' : n})` : ''));
  }
  console.log(`${todo.length} compared, ${bad} different`);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
