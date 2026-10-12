# Security baseline of the static prototype

This prototype demonstrates secure front-end engineering practices. **It is not production-secure** and must not be
deployed as a public service. A Content Security Policy does not make it secure; it reduces one class of risk.

## What is in place (verified by `tests/test_static.py`)

| Control | Implementation |
| --- | --- |
| Content Security Policy on every page | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'` (meta tag; no `unsafe-inline`, no `unsafe-eval`) |
| No inline code | 0 `style` attributes, 0 `<style>` blocks, 0 inline `<script>`, 0 `on*` handlers, 0 `javascript:` URLs – enforced by tests and by the build (inline styles are extracted) |
| No dynamic code | no `eval`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` in any script (tested) |
| Safe text rendering | all runtime text uses `textContent` / DOM creation; dynamic widths use the CSSOM (`el.style.width`), which CSP allows |
| No third parties | no CDN, font, analytics or external script; all assets local (tested) |
| No secrets | demo codes (OTP 482716, MFA 730951, trip code 4827, delivery code 4471) are public test values shown on screen; no keys, tokens or passwords exist anywhere |
| No real personal data | names, phone numbers and addresses are fictional and masked as in the designs |
| No real operations | payments, SMS, WhatsApp, e-mail, calls, maps, GPS, camera, contacts and KYC are simulated and labelled "Simulated" in the UI |
| Browser storage | only the synthetic demo state (`ridenova.demo.v1`) and a view preference (`ridenova.view`); never credentials |
| Accessible validation | inline errors linked with `aria-describedby`, `aria-invalid`, focus moved to the field |
| Mock authorization | clearly labelled as a demonstration on every admin page and in [rbac.md](../workflows/rbac.md) |

## Known limits (by design for this phase)

* CSP is delivered as a `<meta>` tag, so `frame-ancestors`, reporting and other header-only directives are not
  available. A real deployment must send CSP and the other security headers from the server.
* Anyone can change the demo state or the mock role in the browser. Nothing in the prototype protects data.
* `tools/demo_server.py` has no authentication and is meant for a trusted local network only (`--lan` must be
  chosen explicitly; the default is `127.0.0.1`). It keeps state in memory and accepts only JSON up to 2 MB.
* `localStorage` under `file://` is shared by all local files opened in that browser profile.

## Frontend demo permissions vs backend authorization

| | Prototype (now) | Production (later, approved phase) |
| --- | --- | --- |
| Identity | simulated OTP/MFA, public codes | OTP via SMS provider, OIDC + MFA for staff, device binding |
| Session | a flag in local demo state | short-lived JWT + rotating refresh tokens, idle timeout |
| Permission check | `rn-rbac.js` in the browser | enforced in every service, row-level rules, audited server-side |
| Audit | in-memory list in the browser | append-only, tamper-evident server log |
