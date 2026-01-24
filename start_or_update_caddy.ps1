# start_or_update_caddy.ps1
# Fully detached background start/restart of Caddy on Windows

$ErrorActionPreference = "Stop"

$caddyDir = "C:\caddy"
$caddyExe = (Get-Command caddy.exe -ErrorAction Stop).Source
$caddyfile = Join-Path $caddyDir "Caddyfile"

$stdoutLog = Join-Path $caddyDir "caddy_stdout.log"
$stderrLog = Join-Path $caddyDir "caddy_stderr.log"

if (!(Test-Path $caddyDir)) { throw "Missing folder: $caddyDir" }
if (!(Test-Path $caddyfile)) { throw "Missing Caddyfile: $caddyfile" }

Write-Host "Killing existing caddy processes (if any)..."
Get-Process caddy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300

Write-Host "Starting Caddy detached..."

Start-Process -FilePath $caddyExe `
    -WorkingDirectory $caddyDir `
    -ArgumentList @("run", "--config", $caddyfile) `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

Write-Host "Started."
Write-Host "Stdout: $stdoutLog"
Write-Host "Stderr: $stderrLog"
