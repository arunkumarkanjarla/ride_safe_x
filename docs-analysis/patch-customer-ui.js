/* One-shot HTML patch for R58 / R03 customer screens. Run: node patch-customer-ui.js */
const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../customer-app/index.html');
let html = fs.readFileSync(file, 'utf8');

function replaceSection(sid, nextInnerBody) {
  const marker = 'data-sid="' + sid + '"';
  const i = html.indexOf(marker);
  if (i < 0) throw new Error('missing ' + sid);
  const start = html.lastIndexOf('<section', i);
  const end = html.indexOf('</section>', start) + '</section>'.length;
  const old = html.slice(start, end);
  // Keep section shell up to first .body, replace body contents carefully via full section rebuild
  const openEnd = old.indexOf('>', old.indexOf('<div class="body')) + 1;
  // Find body open tag
  const bodyOpen = old.indexOf('<div class="body');
  if (bodyOpen < 0) throw new Error('no body in ' + sid);
  const bodyTagEnd = old.indexOf('>', bodyOpen) + 1;
  // body closes before </div></div></div></section> phone structure: body -> scr -> phone -> mock-holder
  // Find matching close for body: after body content comes </div> for body
  let depth = 0, j = bodyOpen, closeAt = -1;
  while (j < old.length) {
    if (old.startsWith('<div', j)) { depth++; j += 4; continue; }
    if (old.startsWith('</div>', j)) {
      depth--;
      if (depth === 0) { closeAt = j; break; }
      j += 6; continue;
    }
    j++;
  }
  if (closeAt < 0) throw new Error('body close not found ' + sid);
  const rebuilt = old.slice(0, bodyTagEnd) + nextInnerBody + old.slice(closeAt);
  html = html.slice(0, start) + rebuilt + html.slice(end);
  console.log('patched', sid, 'delta', rebuilt.length - old.length);
}

const r58Body = [
  '<div class="center x-gap-8px x-margin-top-6px">',
  '<div class="x-width-64px x-height-64px x-border-radius-18px x-background-0b7a68 x-color-fff x-display-flex x-align-items-center x-justify-content-center">',
  '<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  '</div>',
  '<div class="h1">Welcome to RideNova</div>',
  '<div class="sub">Rides, long trips, food and parcels in one app.</div>',
  '</div>',
  '<div class="x-gap-10px x-margin-top-18px">',
  '<button class="btn" type="button" data-do="x.authMode" data-arg="register">Create an account</button>',
  '<button class="btn ghost" type="button" data-do="x.authMode" data-arg="login">I already have an account</button>',
  '</div>',
  '<div class="xs x-text-align-center x-margin-top-14px">By continuing you agree to the <a class="x-color-0b7a68 x-font-weight-700" href="#/R57" data-go="R57">Terms and Privacy Policy</a>.</div>'
].join('');

const r03Body = [
  '<div class="h1">Enter your phone number</div>',
  '<div class="sub">We\'ll send a one-time code to verify it. Location helps set your country code (browser permission · simulated map match).</div>',
  '<div class="banner info p-loc-banner" role="status">Allow location so we can suggest your country. You can change it below. This is a static demo — no Google Maps API key is used.</div>',
  '<div class="x-display-flex x-gap-8px">',
  '<div class="inp x-width-120px rn-field"><label for="in-R03-country">Country</label>',
  '<div class="box"><select id="in-R03-country" name="country" class="rn-input" aria-label="Country dial code"></select></div>',
  '<span class="rn-err" id="in-R03-country-err" data-err="country" hidden></span></div>',
  '<div class="inp rn-field x-flex-1"><label for="in-R03-phone">Mobile number</label>',
  '<div class="box focus"><input id="in-R03-phone" name="phone" class="rn-input" aria-describedby="in-R03-phone-err" type="tel" value="" inputmode="numeric" autocomplete="tel-national" maxlength="12" required></div>',
  '<span class="rn-err" id="in-R03-phone-err" data-err="phone" hidden></span></div>',
  '</div>',
  '<label class="p-terms-check"><input type="checkbox" name="terms" id="in-R03-terms" required> ',
  '<span>I agree to the <a class="x-color-0b7a68 x-font-weight-700" href="#/R57" data-go="R57">Terms and Privacy Policy</a> <span class="cx-req">*</span></span></label>',
  '<span class="rn-err" id="in-R03-terms-err" data-err="terms" hidden></span>',
  '<button class="btn rn-blk x-margin-top-12px" type="button" data-do="x.sendOtp">Continue</button>',
  '<button class="btn soft sm rn-blk x-margin-top-8px" type="button" data-do="x.requestLocation">Use my location for country</button>'
].join('');

replaceSection('R58', r58Body);
replaceSection('R03', r03Body);
fs.writeFileSync(file, html);
console.log('OK wrote', file);
