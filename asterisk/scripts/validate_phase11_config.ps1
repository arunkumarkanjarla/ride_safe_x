# AST-18 / Phase 11 static validation (Windows-friendly)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$fail = 0

function Check-File([string]$Rel) {
  $path = Join-Path $Root $Rel
  if (-not (Test-Path $path)) {
    Write-Host "MISSING $Rel"
    $script:fail = 1
  } else {
    Write-Host "OK $Rel"
  }
}

function Check-Grep([string]$Rel, [string]$Pattern) {
  $path = Join-Path $Root $Rel
  $text = Get-Content -Raw $path
  if ($text -notmatch $Pattern) {
    Write-Host "FAIL $Rel missing /$Pattern/"
    $script:fail = 1
  } else {
    Write-Host "OK $Rel ~ $Pattern"
  }
}

Check-File "extensions_japit_emergency.conf"
Check-File "acl_japit.conf"
Check-File "manager_japit.conf.sample"
Check-File "ari_japit.conf.sample"
Check-File "fail2ban/jail.japit-asterisk.conf.sample"
Check-File "fail2ban/filter.japit-asterisk-sip.conf"
Check-File "fail2ban/filter.japit-asterisk-ami.conf"
Check-File "ops/chrony/chrony.conf.sample"
Check-File "scripts/check_time_integrity.sh"
Check-File "scripts/sync_emergency_policy.sh"

Check-Grep "extensions_japit.conf" "extensions_japit_emergency.conf"
Check-Grep "extensions_japit.conf" "japit-emergency-detect"
Check-Grep "extensions_japit_emergency.conf" "\[japit-emergency\]"
Check-Grep "manager_japit.conf" "japitami-readonly"
Check-Grep "manager_japit.conf" "CHANGE-ME-SET-ASTERISK-AMI-SECRET"
Check-Grep "acl.conf" "acl_japit.conf"
Check-Grep "modules.conf" "chan_skinny.so"

$manager = Get-Content -Raw (Join-Path $Root "manager_japit.conf")
if ($manager -match "secret\s*=\s*JapitAMI!") {
  Write-Host "FAIL manager_japit.conf still contains committed live-looking secret"
  $fail = 1
} else {
  Write-Host "OK manager_japit.conf uses placeholder secret"
}

if ($fail -ne 0) { exit 1 }
Write-Host "Phase 11 Asterisk static validation PASS"
exit 0
