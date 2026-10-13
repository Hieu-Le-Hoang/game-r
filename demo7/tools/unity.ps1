# Chạy Unity batchmode cho demo7. VD:
#   ./tools/unity.ps1 -Method BuildScript.WebGL
#   ./tools/unity.ps1 -Tests PlayMode
param(
  [string]$Method,
  [ValidateSet('', 'EditMode', 'PlayMode')][string]$Tests = '',
  [string]$Unity = 'D:\Unity\Editors\6000.0.84f1\Editor\Unity.exe'
)
$proj = Split-Path $PSScriptRoot -Parent
$log = Join-Path $proj 'Logs\batch.log'
$ua = @('-batchmode', '-projectPath', "`"$proj`"", '-logFile', "`"$log`"")
if ($Tests) {
  $ua += @('-runTests', '-testPlatform', $Tests, '-testResults', "`"$(Join-Path $proj "Logs\tests-$Tests.xml")`"")
} else {
  $ua += '-quit'
  if ($Method) { $ua += @('-executeMethod', $Method) }
}
$p = Start-Process $Unity -ArgumentList $ua -Wait -PassThru -NoNewWindow
# Gom lỗi compile / exception để đọc nhanh
Select-String -Path $log -Pattern 'error CS|Exception|ERROR|Compilation failed|BUILD|PROBE|SETUP|Test run' -CaseSensitive |
  Where-Object { $_.Line -notmatch 'Curl error|Licensing|disk_cache' } | Select-Object -Last 40 | ForEach-Object Line
"exit: $($p.ExitCode)"
exit $p.ExitCode
