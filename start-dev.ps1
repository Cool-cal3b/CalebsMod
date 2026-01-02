# CalebsMod Development Startup Script
# Usage: .\start-dev.ps1                    (single window)
#        .\start-dev.ps1 -sw   (separate windows)

param([switch]$sw)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$serverPath = Join-Path $projectRoot "calebs-mod-server"
$clientPath = Join-Path $projectRoot "CalebsModClient"

$env:CALEBS_MOD_ENV = "dev"

Write-Host "CalebsMod Dev Environment" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
	Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
	exit 1
}

if (-not (Get-Command wails -ErrorAction SilentlyContinue)) {
	Write-Host "[ERROR] Wails not found. Install: go install github.com/wailsapp/wails/v2/cmd/wails@latest" -ForegroundColor Red
	exit 1
}

$envFile = Join-Path $serverPath ".env"
if (-not (Test-Path $envFile)) {
	Copy-Item (Join-Path $serverPath ".env.example") $envFile -ErrorAction Stop
	Write-Host "[WARN] Created .env - edit with your secrets before running" -ForegroundColor Yellow
	exit 1
}

$envContent = Get-Content $envFile -Raw
if ($envContent -match "your-super-secret-admin-key-change-this|your-jwt-secret-for-signing-tokens") {
	Write-Host "[WARN] Default secrets in .env" -ForegroundColor Yellow
	$continue = Read-Host "Continue? (y/n)"
	if ($continue -ne "y") { exit 0 }
}

if (-not (Test-Path (Join-Path $serverPath "node_modules"))) {
	Write-Host "[INFO] Installing server deps..." -ForegroundColor Cyan
	Push-Location $serverPath; npm install --legacy-peer-deps | Out-Null; Pop-Location
}

if (-not (Test-Path (Join-Path $clientPath "frontend/node_modules"))) {
	Write-Host "[INFO] Installing client deps..." -ForegroundColor Cyan
	Push-Location (Join-Path $clientPath "frontend"); npm install | Out-Null; Pop-Location
}

if ($sw) {
	Write-Host "[INFO] Starting in separate windows..." -ForegroundColor Cyan
	Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; npm run start:dev"
	Start-Sleep -Seconds 2
	Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$clientPath'; wails dev"
	Write-Host "[OK] Server: http://localhost:3000" -ForegroundColor Green
}
else {
	Write-Host "[INFO] Starting services..." -ForegroundColor Cyan
	$serverJob = Start-Job -ScriptBlock { param($p); Set-Location $p; npm run start:dev } -ArgumentList $serverPath
	Start-Sleep -Seconds 3
	$clientJob = Start-Job -ScriptBlock { param($p); Set-Location $p; wails dev } -ArgumentList $clientPath
    
	Write-Host "[OK] Running (Jobs: $($serverJob.Id), $($clientJob.Id)) - http://localhost:3000" -ForegroundColor Green
	Write-Host "[INFO] Press Ctrl+C to stop" -ForegroundColor Yellow
    
	try {
		while ($true) {
			Start-Sleep -Seconds 1
			if ($serverJob.State -ne "Running" -or $clientJob.State -ne "Running") {
				Write-Host "[ERROR] Service stopped" -ForegroundColor Red
				break
			}
		}
	}
 finally {
		Stop-Job $serverJob, $clientJob -ErrorAction SilentlyContinue
		Remove-Job $serverJob, $clientJob -Force -ErrorAction SilentlyContinue
		Write-Host "[OK] Stopped" -ForegroundColor Green
	}
}
