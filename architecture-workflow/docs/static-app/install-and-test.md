# Run and test the static applications

No backend, database, Docker or build step is needed to open the prototype. **Verified** = executed on Windows 11 with
Python 3.14.2, Node.js 24.18.0 and Microsoft Edge 155 in this phase. **Not executed** = standard tool behaviour, not run.

## Open the applications

**From the file system (Verified).** Open `index.html` in the repository root, or an application directly:
`customer-app/index.html`, `driver-app/index.html`, `patner-app/index.html`, `admin/index.html`,
`agent-portal/index.html`. Each application works on its own with its own in-memory demo.

**With a local web server (Verified on Windows; recommended, and required for the connected demo).** From the
repository root:

```bash
py -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/ and choose an application or the connected demo. Stop with Ctrl+C.

Linux (Not executed):

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

## Physical phones on the same Wi-Fi (Not executed on phones)

```bash
py -m http.server 8766 --bind 0.0.0.0
```

Find the computer's local address (Windows: `ipconfig`; Linux: `ip addr`) and open `http://<address>:8766/customer-app/`
on one phone and `http://<address>:8766/driver-app/` on another. Allow Python through the firewall for private networks
only. Only use this on a trusted network; the server is Python's plain static file server.

**Limitation (by design of this phase):** each phone runs its own in-memory demo. A ride booked on the customer phone
does not reach the driver phone, because sharing state between devices needs a server that keeps state, which is not
approved. To show both sides together, use the connected demo on one screen; on a single phone the other parties
(dispatcher, drivers, restaurant, support agents) act automatically.

## Deploy each application on its own server

**Verified by the browser test "Separate servers"** (four local servers laid out like the production servers).

| Server | Folder |
| --- | --- |
| xxx.xx.xx.123 | `admin/` (web root) |
| xxx.xx.xx.124 | `customer-app/` (web root) |
| xxx.xx.xx.125 | `driver-app/` and `patner-app/` (folders `/driver-app/` and `/patner-app/`) |
| xxx.xx.xx.126 | `agent-portal/` (web root) |

Copy the contents of each folder to its server; nothing else is needed there. Every folder loads only its own files and
contains no reference to another folder. Links to another application (for example the agent portal from admin A31)
open the address in that folder's `assets/js/config.js`:

```
window.RN_CONFIG = { brand: "RideNova", apps: { admin: "http://xxx.xx.xx.123/", rider: "http://xxx.xx.xx.124/", driver: "http://xxx.xx.xx.125/driver-app/", ... } };
```

Replace the placeholders with the real addresses (in every folder, or once in `SERVERS` in `source/build_apps.py` followed
by `py source/build.py --apps`). Full steps and an nginx example: [DEPLOYMENT.md](../../../DEPLOYMENT.md).

Each server's application has its own in-memory state; rides or tickets created on one server are not visible on another
(sharing needs the backend of the next phase). The connected demo and the root entry page are local tools only (all
folders on one local server) and are not deployed.

**Agent portal policy.** The agent portal's rules (agents, roles and limits, channels, routing, templates, announcements)
are in `agent-portal/assets/js/agent-policy.js`. After publishing on admin A31 *Agent portal control*, download the file
there and replace it on the agent portal's server. When the admin and the agent portal are served from the same site,
a publish also reaches open agent portals immediately (BroadcastChannel, same browser).

## Rebuild after changing the generator or runtime

From `architecture-workflow/` (Python 3.12+; verified with 3.14.2). The blueprint pages:

```bash
py source/build.py
```

All application folders, the entry page and the connected demo (overwrites edits made directly in the generated app
folders; the hand-written agent portal pages are kept, only its shared files are refreshed):

```bash
py source/build.py --apps
```

With `--apps` each folder receives its own files: only its screens, only its controllers
(`architecture-workflow/assets/js/controllers/<app>.js`) and only the layout rules its screens use.
New screen images: `node tools/shots.js --missing`.

## Automated tests (from `architecture-workflow/`)

```bash
py -m unittest discover -s tests -p "test_*.py" -v
```

```bash
node --test tests/engine/engine.test.js
```

```bash
node --test --test-concurrency=1 tests/browser/e2e.test.js
```

```bash
node tests/browser/agent-portal.test.js
```

The browser suite needs Edge or Chrome (set `RN_BROWSER` to the executable if it is not found) and starts Python's
static server itself for the connected-demo test. Results: [acceptance-checklist.md](acceptance-checklist.md).
