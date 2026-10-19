# Controlled test-driver provisioning (Phase 3)

Phase 3 does **not** expose public driver onboarding/KYC. Eligible drivers are created with a CLI script that requires database access.

## Command

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
.\.venv\Scripts\python.exe -m app.scripts.provision_driver `
  --email driver1@example.com `
  --password 'CorrectHorseBattery1!' `
  --lat 17.385 --lon 78.4867 --online
```

Creates (or reuses auth user):

- `users` row with role `driver`
- `driver_profiles` (`status=eligible`, vehicle default `Cab`)
- `driver_availability` (optional `--online` with lat/lon)

Drivers then use the driver mobile app: sign in → go online → receive offers → accept/reject.

There is no public API that lets an arbitrary customer self-promote to verified driver.
