# Install and run the static prototype

No backend, database, package install or internet connection is needed. Status of each instruction:
**Verified** = executed on Windows 11 with Python 3.14.2, Node.js 24.18.0 and Microsoft Edge 155 during this phase;
**Not executed** = written from the standard tool behaviour but not run on that platform.

## 1. Requirements

| Purpose | Needed | Notes |
| --- | --- | --- |
| View the prototype | A current Chromium-based browser (Edge, Chrome) or Firefox ≥ 126 | Firefox not tested |
| Serve over HTTP (recommended) | Python 3.10+ | standard library only |
| Rebuild pages from `source/` | Python 3.10+ | verified with 3.14.2 (the original notes said 3.12) |
| Run JavaScript tests and browser tests | Node.js 22+ and Edge or Chrome | no npm packages |

## 2. Windows

**Open directly (Verified).** Double-click `index.html` in the repository folder, or open
`prototype\index.html` (demo console). Scripts, styles and the shared demo state work from `file://` in Edge.

**Local web server (Verified).** In PowerShell or Command Prompt, from the repository root:

```bash
py -m http.server 8766 --bind 127.0.0.1
```

Then open http://127.0.0.1:8766/prototype/index.html. Stop with Ctrl+C.

**Rebuild after changing `source/` (Verified).**

```bash
py source/build.py
```

## 3. Linux (Not executed)

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

```bash
python3 source/build.py
```

Open http://127.0.0.1:8766/prototype/index.html in Chromium, Chrome, Edge or Firefox. Opening files directly
(`file://`) should behave like Windows in Chromium-based browsers.

## 4. Two-phone demonstration (server Verified on Windows; phones not tested)

Two devices only share the simulated state through the optional demo server (each browser otherwise keeps its own
state). It holds the state in memory, has no authentication, and is for a trusted Wi-Fi network only.

1. On the computer, from the repository root:

   ```bash
   py tools/demo_server.py --lan
   ```

   It prints an address such as `http://192.168.1.20:8770/prototype/index.html`. (Linux: `python3 tools/demo_server.py --lan`.)
   Windows may ask to allow Python through the firewall for private networks.
2. Open that address on both phones (same Wi-Fi). On one phone choose a scenario in the console (for example A or
   H) and set **Other parties** to *Played by me in other tabs* and **Timers** to *As specified* (the 15 s offer window leaves time for the other phone to react; *Fast demo* gives only 7 s).
3. Phone 1: open the rider entry (R29 or the scenario's start screen). Phone 2: open the driver app (D06) or partner
   app (P02).
4. Play the journey: the rider books, the driver phone shows the offer (D07) and accepts, the rider phone follows
   to R12. Changes appear on the other device within about a second.
5. Stop the server with Ctrl+C; the shared state is discarded.

Automated check of the same flow with two isolated browser profiles: `node --test tests/browser/two-device.test.js`.

## 5. Using the prototype

* **Demo console** (`prototype/index.html`): load a scenario A–J, open the apps in tabs, change simulation
  options, inspect live state and the event history.
* **Demo bar** (top of every screen page): scenario, reset, this device online/offline, whether other parties act
  automatically, timer speed, mock admin role, *App view* (hides the specification) and a link to the console.
* Demo codes shown on screen: rider OTP **482716**, admin MFA **730951**, trip code **4827**, delivery code **4471**.
* Every screen page still shows the original specification (how it works, backend calls, events, edge cases).
