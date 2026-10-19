'use strict';
/*
 * Minimal Chrome DevTools Protocol driver for Microsoft Edge / Google Chrome.
 * No npm dependencies: uses Node's built-in WebSocket (Node 22+) and child_process.
 * Used by the browser tests and the screenshot comparison tool.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CANDIDATES = [
  process.env.RN_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);

function findBrowser() {
  for (const c of CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('No Chromium-based browser found. Set RN_BROWSER to the browser executable.');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Page {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = []; this.console = []; this.errors = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') this.console.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
        if (msg.method === 'Runtime.exceptionThrown') this.errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
        if (msg.method === 'Log.entryAdded') { if (msg.params.entry.level === 'error') this.errors.push(msg.params.entry.text + ' ' + (msg.params.entry.url || '')); }
        this.listeners.forEach((l) => l(msg));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  waitFor(method, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.listeners = this.listeners.filter((l) => l !== fn); reject(new Error('timeout waiting for ' + method)); }, timeout);
      const fn = (m) => { if (m.method === method) { clearTimeout(t); this.listeners = this.listeners.filter((l) => l !== fn); resolve(m.params); } };
      this.listeners.push(fn);
    });
  }
  async goto(url) {
    const loaded = this.waitFor('Page.loadEventFired');
    await this.send('Page.navigate', { url });
    await loaded;
    await sleep(80);
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + '\n' + expr.slice(0, 200));
    return r.result.value;
  }
  async waitUntil(expr, timeout = 10000, every = 100) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await this.eval(expr)) return true; await sleep(every); }
    throw new Error('condition not met: ' + expr);
  }
  async viewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  }
  async screenshot(selector) {
    let clip;
    if (selector) {
      const box = await this.eval(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height}; })()`);
      clip = { ...box, scale: 1 };
    }
    const r = await Promise.race([this.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true }),
      sleep(30000).then(() => { throw new Error('screenshot timed out'); })]);
    return Buffer.from(r.data, 'base64');
  }
  async key(key, code, keyCode) {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
  }
}

class Browser {
  static async launch(opts = {}) {
    const exe = findBrowser();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-cdp-'));
    const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--remote-debugging-port=0', '--user-data-dir=' + dir, '--allow-file-access-from-files', 'about:blank'];
    const proc = spawn(exe, args, { stdio: 'ignore' });
    const portFile = path.join(dir, 'DevToolsActivePort');
    for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await sleep(100);
    if (!fs.existsSync(portFile)) { proc.kill(); throw new Error('browser did not start: ' + exe); }
    let port;
    for (let i = 0; i < 50; i++) {
      try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim(); } catch (e) { port = ''; }   // EBUSY while the browser writes it
      if (port) break;
      await sleep(100);
    }
    const b = new Browser(); b.proc = proc; b.dir = dir; b.port = port;
    // if the test process is interrupted (timeout, Ctrl+C), do not leave the headless browser running
    const cleanup = () => { try { if (process.platform === 'win32') require('node:child_process').spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill(); } catch (e) { /* gone */ } };
    process.once('exit', cleanup);
    ['SIGINT', 'SIGTERM'].forEach((sig) => process.once(sig, () => { cleanup(); process.exit(130); }));
    return b;
  }
  async newPage() {
    const res = await fetch(`http://127.0.0.1:${this.port}/json/new?about:blank`, { method: 'PUT' });
    const info = await res.json();
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
    const p = new Page(ws); p.targetId = info.id; (this.pages = this.pages || []).push(p);
    await p.send('Page.enable'); await p.send('Runtime.enable'); await p.send('Log.enable');
    return p;
  }
  async close() {
    for (const p of this.pages || []) { try { await Promise.race([p.send('Browser.close'), sleep(1500)]); } catch (e) { /* closing */ } break; }
    for (const p of this.pages || []) { try { p.ws.close(); } catch (e) { /* closed */ } }
    try { this.proc.kill(); } catch (e) { /* already gone */ }
    // Chromium starts helper processes; on Windows end only this instance's process tree (never other browser windows)
    if (process.platform === 'win32' && this.proc.pid) {
      try { require('node:child_process').spawnSync('taskkill', ['/PID', String(this.proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* gone */ }
    }
    await sleep(300);
    try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch (e) { /* profile still locked on Windows; harmless */ }
  }
}

function fileUrl(p) {
  const abs = path.resolve(p).replace(/\\/g, '/');
  return 'file://' + (abs.startsWith('/') ? '' : '/') + encodeURI(abs);
}

module.exports = { Browser, Page, fileUrl, sleep };
