# RideSafe X / RideNova — Launch Instructions

## Recommended (static server)

```powershell
cd "D:\Arun Kumar\arun-git\ride_safe_x"
py -m http.server 8080
```

Open:

- Hub: http://localhost:8080/
- Customer: http://localhost:8080/customer-app/
- Driver: http://localhost:8080/driver-app/
- Partner: http://localhost:8080/patner-app/
- Admin: http://localhost:8080/admin/
- Platform control: http://localhost:8080/admin/control.html (sign in via admin first)
- Agent: http://localhost:8080/agent-portal/
- Connected demo: http://localhost:8080/connected-demo/

Same origin is required so apps share `localStorage` config/ops.

## Demo codes

| Role | Code |
|---|---|
| Customer / Partner OTP | `482716` |
| Admin MFA | `730951` |
| Agent portal | `246810` |
| Trip / delivery codes | `4827` / `4471` |

All data is synthetic. Auth is a **demo simulation**.

## Reset demo data

Clear site data for `localhost:8080` (or use in-app reset/logout flows where provided), then reload. Admin Platform Control can reset config to bundled defaults.

Trip simulation also uses `ridenova.demo.v1`. Connected-demo **Reset** clears that key; otherwise clear site data (or remove the key in DevTools) to wipe an in-progress demo trip.

## Run tests

```powershell
cd "D:\Arun Kumar\arun-git\ride_safe_x\docs-analysis"
node test-customer.js
node test-driver.js
node test-partner.js
node test-admin.js
node test-agent.js
node test-ux.js
node test-admin-control.js
node test-flows.js
```
