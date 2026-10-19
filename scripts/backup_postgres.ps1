# Safe PostgreSQL dump for RideNova host DB.
# Usage:
#   $env:PGPASSWORD='...'
#   .\scripts\backup_postgres.ps1 [-HostName localhost] [-Db ride_safe_x] [-User postgres]
# Does NOT print the password. Does NOT write under the repo web roots.

param(
    [string]$HostName = "localhost",
    [string]$Db = "ride_safe_x",
    [string]$User = "postgres",
    [string]$BackupRoot = "D:\ridenova-data\backups"
)

$ErrorActionPreference = "Stop"
if (-not $env:PGPASSWORD) {
    Write-Error "Set PGPASSWORD in the environment (do not pass on the command line)."
    exit 2
}
if ($Db -eq "ride_safe_x_restore_test") {
    Write-Error "Refusing to dump disposable restore DB name as primary source."
    exit 2
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $BackupRoot "${Db}_$stamp.dump"

& pg_dump -h $HostName -U $User -d $Db -Fc -f $out
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit $LASTEXITCODE"
    exit $LASTEXITCODE
}
Write-Host "OK backup=$out"
exit 0
