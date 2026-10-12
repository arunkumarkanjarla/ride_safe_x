# Static prototype security rules

These rules apply to every application, the connected demo and the entry page. They are enforced by
`tests/test_apps.py` and `tests/test_static.py` (see the acceptance checklist for results).

| Rule | How it is met |
| --- | --- |
| HTML, CSS and vanilla JavaScript only | No frameworks, build tools or package files (tested) |
| External CSS and JavaScript only | No `style` attributes, `<style>` blocks, inline scripts, `on*` handlers or `javascript:` URLs (tested on every page) |
| Restrictive CSP | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'` (the connected demo adds `frame-src 'self'`); no `unsafe-*` (tested) |
| No dynamic code or HTML injection | No `eval`, `new Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` (tested); text is set with `textContent` |
| No persistence | No `localStorage`, `sessionStorage`, IndexedDB or cookies in any application script (tested); state lives in memory and resets on reload |
| No network | No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or beacons in any application script (tested); no third-party resources |
| One server per application | Each folder loads only its own files and contains no `../` reference (tested); links to other applications are plain navigations to the server addresses in `assets/js/config.js` (tested in the browser on four separate servers) |
| No device permissions | No microphone, camera, geolocation or notification permission requests (tested); voice support and calls are visual simulations |
| No secrets or real data | Demo codes are public test values; people, phone numbers, addresses and documents are fictional and masked |
| Simulated features are labelled | "Simulated" messages and notices on call, chat, upload, payment and demo-account screens; the entry page and READMEs state that all data is synthetic |
| Roles are not security | Mock role switching and sign-in are labelled as demonstrations; production authorization belongs to the backend |

## Known limits

* CSP is a `<meta>` tag; header-only directives (for example `frame-ancestors`) need a server in a real deployment –
  [DEPLOYMENT.md](../../../DEPLOYMENT.md) lists the recommended header for each server.
* Anyone can change the in-memory state or the mock role from the browser's developer tools.
* `architecture-workflow/tools/demo_server.py` (previous phase) is a small server; it is **not used** by any page in this
  phase and must not be started without approval. The previous phase's `rn-console.js` and `rn-sync.js` (which used
  `localStorage`) were removed.
