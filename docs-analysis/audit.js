// audit.js - static audit of an app's index.html: screens, controls, dead controls. usage: node audit.js <appFolder> [full]
const fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2]); const full = process.argv[3] === 'full';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
let ctl = '';
['controllers.js', 'kit.js', 'app.js', 'ops-ui.js'].forEach(f => { try { ctl += fs.readFileSync(path.join(dir, 'assets/js', f), 'utf8'); } catch (e) {} });
const engine = fs.readFileSync(path.join(dir, 'assets/js/engine.js'), 'utf8');
const parts = html.split(/<section class="rn-screen"/).slice(1);
const sids = parts.map(p => (p.match(/data-sid="([A-Z]\d\d)"/) || [])[1]);
let dead = 0, total = 0;
parts.forEach((p, i) => {
  const sid = sids[i], label = (p.match(/aria-label="([^"]*)"/) || [])[1];
  const body = p.split('</section>')[0];
  const out = []; const re = /<(button|a|span|div|li|tr|input|label)\b([^>]*\bdata-(?:go|do|ui|msg|back)\b[^>]*)>([\s\S]*?)(?=<\/\1>|$)/g; let m;
  while ((m = re.exec(body))) {
    const a = m[2]; const txt = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28);
    const g = k => (a.match(new RegExp('data-' + k + '="([^"]*)"')) || [])[1];
    const go = g('go'), d = g('do'), ui = g('ui'), msg = g('msg'), back = /data-back\b/.test(a);
    let status = 'ok';
    if (d) { if (d.startsWith('x.')) { if (!new RegExp('\\b' + d.slice(2) + '\\s*[:(]').test(ctl)) status = 'DEAD(no action)'; } else if (!engine.includes("'" + d + "'")) status = 'DEAD(no cmd)'; }
    else if (!go && !ui && !msg && !back) status = '?';
    if (go && !sids.includes(go) && !/^(S|A|D|P|R)\d\d$/.test(go)) status = 'BADGO';
    total++; if (status !== 'ok') dead++;
    out.push((status === 'ok' ? '  ' : '! ') + (m[1]) + ' "' + txt + '" ' + [go && 'go=' + go, d && 'do=' + d, ui && 'ui=' + ui, msg && 'msg', back && 'back'].filter(Boolean).join(' ') + (status !== 'ok' ? ' [' + status + ']' : ''));
  }
  const inputs = (body.match(/<(input|select|textarea)\b/g) || []).length;
  const hasCtl = new RegExp("def\\('" + sid + "'").test(ctl) || new RegExp("extend\\('" + sid + "'").test(ctl);
  console.log('== ' + sid + ' ' + label + ' | controls=' + out.length + ' inputs=' + inputs + ' controller=' + (hasCtl ? 'yes' : 'NO'));
  if (full) out.forEach(o => console.log(o)); else out.filter(o => o[0] === '!').forEach(o => console.log(o));
});
console.log('TOTAL controls ' + total + ', problematic ' + dead);
