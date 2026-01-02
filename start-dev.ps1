# CalebsMod Development Startup Script
# Usage: .\start-dev.ps1        (launches services in separate windows, Ctrl+C stops all)
#        .\start-dev.ps1 -sw     (launches and exits, close windows manually)

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
	Write-Host "[WARN] Close windows manually when done" -ForegroundColor Yellow
	Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; npm run start:dev"
	Start-Sleep -Seconds 2
	Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$clientPath'; wails dev"
	Write-Host "[OK] Server: http://localhost:3000" -ForegroundColor Green
	Write-Host "[INFO] Close each window to stop (or just close this one)" -ForegroundColor Cyan
}
else {
	Write-Host "[INFO] Starting services in separate windows..." -ForegroundColor Cyan
	Write-Host "[INFO] This allows Ctrl+C to work properly" -ForegroundColor Yellow
	
	$serverProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; npm run start:dev" -PassThru
	Start-Sleep -Seconds 3
	$clientProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$clientPath'; wails dev" -PassThru
	
	Write-Host "[OK] Server window opened (PID: $($serverProcess.Id))" -ForegroundColor Green
	Write-Host "[OK] Client window opened (PID: $($clientProcess.Id))" -ForegroundColor Green
	Write-Host "[OK] Server: http://localhost:3000" -ForegroundColor Green
	Write-Host ""
	Write-Host "[INFO] Press Ctrl+C to stop all services and close windows" -ForegroundColor Yellow
	
	$cleanup = {
		param($sPid, $cPid)
		Write-Host "`n[INFO] Cleaning up..." -ForegroundColor Yellow
		Stop-Process -Id $sPid -Force -ErrorAction SilentlyContinue
		Stop-Process -Id $cPid -Force -ErrorAction SilentlyContinue
		Start-Sleep -Milliseconds 500
		Write-Host "[OK] All services stopped" -ForegroundColor Green
	}
	
	try {
		while ($true) {
			Start-Sleep -Seconds 1
			if ($serverProcess.HasExited -and $clientProcess.HasExited) {
				Write-Host "`n[INFO] Both service windows were closed" -ForegroundColor Cyan
				break
			}
		}
	}
	catch [System.Management.Automation.PipelineStoppedException] {
		& $cleanup $serverProcess.Id $clientProcess.Id
	}
	finally {
		if (-not $serverProcess.HasExited -or -not $clientProcess.HasExited) {
			& $cleanup $serverProcess.Id $clientProcess.Id
		}
	}
}
