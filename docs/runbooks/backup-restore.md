# RideNova — PostgreSQL backup & restore (Phase 10)

**Scope:** Host PostgreSQL `ride_safe_x` (outside Docker).  
**Never** restore over the live operator database.  
**Never** commit dump files or credentials to Git.

## Prerequisites

- `pg_dump` / `pg_restore` / `psql` matching the server major version
- Credentials via environment (not argv history when possible)
- Writable private directory, e.g. `D:\ridenova-data\backups\` (not under a web root)

## Backup (Windows PowerShell)

```powershell
$env:PGPASSWORD = "<from-secret-store>"   # do not commit
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dir = "D:\ridenova-data\backups"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$out = Join-Path $dir "ride_safe_x_$stamp.dump"
pg_dump -h localhost -U postgres -d ride_safe_x -Fc -f $out
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
Remove-Item Env:PGPASSWORD
Write-Host "Wrote $out"
```

Script (wrapper): `scripts/backup_postgres.ps1` — sets exit code on failure.

### Retention (recommended)

- Keep daily dumps 7 days; weekly dumps 4 weeks.
- Delete older files from the private backup directory only.
- Do not store dumps in `static application/`, `apps/`, or public buckets.

## Restore verification (disposable database only)

```powershell
$env:PGPASSWORD = "<from-secret-store>"
$dump = "D:\ridenova-data\backups\ride_safe_x_<stamp>.dump"
# Create disposable DB — NEVER use ride_safe_x here
psql -h localhost -U postgres -c "CREATE DATABASE ride_safe_x_restore_test;"
pg_restore -h localhost -U postgres -d ride_safe_x_restore_test --clean --if-exists $dump
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed" }
psql -h localhost -U postgres -d ride_safe_x_restore_test -c "SELECT version_num FROM alembic_version;"
psql -h localhost -U postgres -c "DROP DATABASE ride_safe_x_restore_test;"
Remove-Item Env:PGPASSWORD
```

## Uploads / telephony

- Application uploads under `RIDENOVA_STORAGE_PATH` / `D:\ridenova-data\uploads` need a separate filesystem backup.
- Asterisk recordings on the telephony host are **out of scope** for this application backup.

## Status for Phase 10

If an isolated restore was not executed in the session, report **NOT VERIFIED** with the prerequisite: working `pg_dump`/`pg_restore` and permission to create a disposable database.

## Status for Phase 11

**Verified** on the host (2026-10-19):

- Clients: PostgreSQL **18.2** (`pg_dump` / `pg_restore` / `psql`)
- Dump example: `D:\ridenova-data\backups\ride_safe_x_20261019-231850.dump` (custom format `-Fc`, TOC listable)
- Isolated restore into `ride_safe_x_restore_test` succeeded (`pg_restore` exit 0); Alembic `20261019_0007`; disposable DB dropped after checks
- Source database `ride_safe_x` was never overwritten

