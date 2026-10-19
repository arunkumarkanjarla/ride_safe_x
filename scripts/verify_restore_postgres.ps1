# Restore a dump into a disposable database and drop it.
# NEVER targets ride_safe_x.
#
# Usage:
#   $env:PGPASSWORD='...'
#   .\scripts\verify_restore_postgres.ps1 -DumpPath 'D:\ridenova-data\backups\ride_safe_x_....dump'

param(
    [Parameter(Mandatory = $true)][string]$DumpPath,
    [string]$HostName = "localhost",
    [string]$User = "postgres",
    [string]$TempDb = "ride_safe_x_restore_test"
)

$ErrorActionPreference = "Stop"
if (-not $env:PGPASSWORD) {
    Write-Error "Set PGPASSWORD in the environment."
    exit 2
}
if ($TempDb -eq "ride_safe_x") {
    Write-Error "Refusing to restore over live ride_safe_x."
    exit 2
}
if (-not (Test-Path $DumpPath)) {
    Write-Error "Dump not found: $DumpPath"
    exit 2
}

& psql -h $HostName -U $User -c "DROP DATABASE IF EXISTS $TempDb;"
& psql -h $HostName -U $User -c "CREATE DATABASE $TempDb;"
& pg_restore -h $HostName -U $User -d $TempDb --clean --if-exists $DumpPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_restore failed"
    exit $LASTEXITCODE
}
& psql -h $HostName -U $User -d $TempDb -c "SELECT version_num FROM alembic_version;"
& psql -h $HostName -U $User -c "DROP DATABASE $TempDb;"
Write-Host "OK restore-verify completed and disposable DB dropped"
exit 0
