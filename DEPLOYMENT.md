# Deployment – one server per application

Each application folder is complete on its own (HTML, CSS and JavaScript only; no backend, no build step). No folder
loads a file from another folder, so each one is copied to its own server.

| Server | Folder → address |
| --- | --- |
| `xxx.xx.xx.123` | `admin/` → `http://xxx.xx.xx.123/` |
| `xxx.xx.xx.124` | `customer-app/` → `http://xxx.xx.xx.124/` |
| `xxx.xx.xx.125` | `driver-app/` → `http://xxx.xx.xx.125/driver-app/`<br>`patner-app/` → `http://xxx.xx.xx.125/patner-app/` |
| `xxx.xx.xx.126` | `agent-portal/` → `http://xxx.xx.xx.126/` |

## Steps

1. Replace the placeholder addresses (`xxx.xx.xx.…`) in `architecture-workflow/source/build_apps.py` (`SERVERS`) and run
   `py source/build.py --apps` from `architecture-workflow/` – or edit `assets/js/config.js` in each copied folder.
2. Copy the **contents** of each folder to its place:
   - `admin/` → web root of the admin server
   - `customer-app/` → web root of the customer server
   - `driver-app/` and `patner-app/` → the folders `/driver-app/` and `/patner-app/` of the same web root (both apps on one
     server, each in its own folder, still independent of each other)
   - `agent-portal/` → web root of the agent portal server
3. Make `index.html` the default document (nginx `index index.html;`, Apache `DirectoryIndex index.html`, IIS default
   document).
4. Recommended response header on every server (the pages also carry it as a `<meta>` tag):
   `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'`

Example nginx server block for the driver and partner server:

```nginx
server {
    listen 80;
    root /var/www/ridenova;          # contains driver-app/ and patner-app/
    index index.html;
    add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'" always;
    add_header X-Content-Type-Options nosniff always;
}
```

## What stays local

`index.html`, `assets/` and `connected-demo/` in the repository root are local tools (entry page and side-by-side demo)
and are **not** deployed. `architecture-workflow/` holds the blueprint and the generator and is not deployed either.

## Behaviour across servers

* Each application has its own copy of the simulated back office (`assets/js/engine.js`, data, rules) and keeps its state
  in memory in the browser tab. Rides, orders and tickets created on one server are not visible on another server –
  sharing them needs the backend of the next phase.
* Links between applications (for example *Open the agent portal* in the admin portal) open the other server's
  address from `assets/js/config.js`. If an address is removed, the link shows a message instead of opening.

## Agent portal and the admin portal

The agent portal (`agent-portal/`) is a web portal for RideNova agents. It is controlled by the admin portal
(*Agent portal control*, A31): agent accounts, roles and credit limits, channels, routing, reply templates, knowledge
articles and announcements.

* The agent portal reads its rules from `agent-portal/assets/js/agent-policy.js`. After publishing on A31, use
  **Download agent-policy.js** and copy the file into `assets/js/` of the agent portal on its server.
* When both portals are served from the same site (same scheme, host and port – for example behind one reverse proxy
  at `/admin/` and `/agent-portal/`), a publish reaches open agent portals at once and the admin sees the agents live
  (browser BroadcastChannel; nothing is stored and nothing is sent to a server).
* `py source/build.py --apps` refreshes the agent portal's shared files, including `agent-policy.js` (back to the
  version in `architecture-workflow/assets/js/agent-desk/`). Re-deploy a downloaded policy after a rebuild.
