# Phase 12 Asterisk static validation (Windows)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$fail = 0

function Check-File([string]$Rel) {
  if (-not (Test-Path (Join-Path $Root $Rel))) { Write-Host "MISSING $Rel"; $script:fail = 1 } else { Write-Host "OK $Rel" }
}
function Check-Grep([string]$Rel, [string]$Pattern) {
  $text = Get-Content -Raw (Join-Path $Root $Rel)
  if ($text -notmatch $Pattern) { Write-Host "FAIL $Rel /$Pattern/"; $script:fail = 1 } else { Write-Host "OK $Rel ~ $Pattern" }
}

Check-File "extensions_japit_tollfraud.conf"
Check-File "docs/ON_DEMAND_RECORDING.md"
Check-File "docs/RECORDING_PIPELINE.md"
Check-File "docs/ANTI_TOLL_FRAUD.md"
Check-File "docs/CDR_CEL_DUAL_NODE.md"
Check-File "docs/FAILOVER_DRILL.md"
Check-File "scripts/failover_drill.sh"
Check-Grep "extensions_japit.conf" "extensions_japit_tollfraud.conf"
Check-Grep "extensions_japit.conf" "japit-tollfraud-check"
Check-Grep "extensions_japit.conf" "JAPIT_NODE_ID"

if ($fail -ne 0) { exit 1 }
Write-Host "Phase 12 Asterisk static validation PASS"
exit 0
