<#
.SYNOPSIS
    Manages the Caleb's Mod NestJS server as a background process.

.DESCRIPTION
    Start server: .\toggle-server.ps1
    Stop server:  .\toggle-server.ps1 -k
    Check status: .\toggle-server.ps1 -s
    Show help:    .\toggle-server.ps1 -help

.NOTES
    Files created in calebs-mod-server/:
    - .server.pid         (process ID)
    - server.log          (all server output)
    - start-background.ps1 (temp start script)

    View logs: cat calebs-mod-server\server.log
    Monitor:   while ($true) { cls; .\toggle-server.ps1 -s; sleep 5 }
#>

param(
    [switch]$k,
    [switch]$s,
    [switch]$help
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$serverPath = Join-Path $projectRoot "calebs-mod-server"
$pidFile = Join-Path $serverPath ".server.pid"
$logFile = Join-Path $serverPath "server.log"
$serverPort = 3000

function Show-Help {
    Write-Host "=== Caleb's Mod Server Manager ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\toggle-server.ps1         Start the server in background"
    Write-Host "  .\toggle-server.ps1 -k      Kill the running server"
    Write-Host "  .\toggle-server.ps1 -s      Show server status and health"
    Write-Host "  .\toggle-server.ps1 -help   Show this help message"
    Write-Host ""
    Write-Host "Files:" -ForegroundColor Yellow
    Write-Host "  PID file: $pidFile"
    Write-Host "  Log file: $logFile"
    Write-Host ""
}

function Get-ServerPID {
    if (Test-Path $pidFile) {
        $pid = Get-Content $pidFile -Raw
        return [int]$pid.Trim()
    }
    return $null
}

function Test-ServerRunning {
    $pid = Get-ServerPID
    if ($null -eq $pid) {
        return $false
    }
    
    try {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($null -eq $process) {
            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
            return $false
        }
        return $true
    }
    catch {
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
        return $false
    }
}

function Get-ServerHealth {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$serverPort/api/server/status" -TimeoutSec 5 -ErrorAction Stop
        return @{
            Healthy = $true
            StatusCode = $response.StatusCode
            Response = $response.Content | ConvertFrom-Json
        }
    }
    catch {
        return @{
            Healthy = $false
            Error = $_.Exception.Message
        }
    }
}

function Show-Status {
    Write-Host "=== Server Status ===" -ForegroundColor Cyan
    Write-Host ""
    
    $isRunning = Test-ServerRunning
    $pid = Get-ServerPID
    
    if (-not $isRunning) {
        Write-Host "Status: " -NoNewline
        Write-Host "STOPPED" -ForegroundColor Red
        Write-Host ""
        
        if (Test-Path $logFile) {
            $logSize = (Get-Item $logFile).Length / 1KB
            Write-Host "Log file: $logFile ($([math]::Round($logSize, 2)) KB)" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Last 10 lines of log:" -ForegroundColor Yellow
            Get-Content $logFile -Tail 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        }
        return
    }
    
    Write-Host "Status: " -NoNewline
    Write-Host "RUNNING" -ForegroundColor Green
    Write-Host "PID: $pid" -ForegroundColor Gray
    Write-Host ""
    
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($process) {
        $uptime = (Get-Date) - $process.StartTime
        $cpu = [math]::Round($process.CPU, 2)
        $memoryMB = [math]::Round($process.WorkingSet64 / 1MB, 2)
        
        Write-Host "Process Info:" -ForegroundColor Yellow
        Write-Host "  Uptime: $($uptime.Days)d $($uptime.Hours)h $($uptime.Minutes)m $($uptime.Seconds)s" -ForegroundColor Gray
        Write-Host "  CPU Time: ${cpu}s" -ForegroundColor Gray
        Write-Host "  Memory: ${memoryMB} MB" -ForegroundColor Gray
        Write-Host "  Start Time: $($process.StartTime)" -ForegroundColor Gray
        Write-Host ""
    }
    
    Write-Host "Health Check:" -ForegroundColor Yellow
    $health = Get-ServerHealth
    
    if ($health.Healthy) {
        Write-Host "  HTTP Status: " -NoNewline
        Write-Host "OK ($($health.StatusCode))" -ForegroundColor Green
        Write-Host "  Endpoint: http://localhost:$serverPort" -ForegroundColor Gray
        
        if ($health.Response) {
            Write-Host ""
            Write-Host "  Server Response:" -ForegroundColor Yellow
            $health.Response | ConvertTo-Json -Depth 3 | ForEach-Object {
                $_ -split "`n" | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
            }
        }
    }
    else {
        Write-Host "  HTTP Status: " -NoNewline
        Write-Host "UNHEALTHY" -ForegroundColor Red
        Write-Host "  Error: $($health.Error)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Note: Server process is running but not responding to HTTP requests" -ForegroundColor Yellow
    }
    
    if (Test-Path $logFile) {
        $logSize = (Get-Item $logFile).Length / 1KB
        Write-Host ""
        Write-Host "Log file: $logFile ($([math]::Round($logSize, 2)) KB)" -ForegroundColor Gray
        
        Write-Host ""
        Write-Host "Last 10 lines of log:" -ForegroundColor Yellow
        Get-Content $logFile -Tail 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
}

function Stop-Server {
    Write-Host "=== Stopping Server ===" -ForegroundColor Cyan
    Write-Host ""
    
    $isRunning = Test-ServerRunning
    if (-not $isRunning) {
        Write-Host "Server is not running" -ForegroundColor Yellow
        return
    }
    
    $pid = Get-ServerPID
    Write-Host "Stopping server (PID: $pid)..." -ForegroundColor Yellow
    
    try {
        Stop-Process -Id $pid -Force -ErrorAction Stop
        Start-Sleep -Seconds 1
        
        $stillRunning = Test-ServerRunning
        if ($stillRunning) {
            Write-Host "Warning: Process might still be running" -ForegroundColor Yellow
        }
        else {
            Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
            Write-Host "Server stopped successfully" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "Error stopping server: $_" -ForegroundColor Red
        Write-Host "You may need to manually kill the process" -ForegroundColor Yellow
        exit 1
    }
}

function Start-Server {
    Write-Host "=== Starting Server ===" -ForegroundColor Cyan
    Write-Host ""
    
    $isRunning = Test-ServerRunning
    if ($isRunning) {
        $pid = Get-ServerPID
        Write-Host "Server is already running (PID: $pid)" -ForegroundColor Yellow
        Write-Host "Use -k to stop it first" -ForegroundColor Yellow
        exit 0
    }
    
    if (-not (Test-Path $serverPath)) {
        Write-Host "Error: Server directory not found at $serverPath" -ForegroundColor Red
        exit 1
    }
    
    $envFile = Join-Path $serverPath ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "Error: .env file not found at $envFile" -ForegroundColor Red
        Write-Host "Please create it from .env.example" -ForegroundColor Yellow
        exit 1
    }
    
    if (-not (Test-Path (Join-Path $serverPath "node_modules"))) {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        Push-Location $serverPath
        npm install
        Pop-Location
        Write-Host ""
    }
    
    $distPath = Join-Path $serverPath "dist"
    if (-not (Test-Path $distPath)) {
        Write-Host "Building server..." -ForegroundColor Yellow
        Push-Location $serverPath
        npm run build
        Pop-Location
        Write-Host ""
    }
    
    Write-Host "Starting server in background..." -ForegroundColor Yellow
    
    Push-Location $serverPath
    
    $startScript = @"
`$ErrorActionPreference = 'Stop'
Set-Location '$serverPath'

`$logFile = '$logFile'
`$pidFile = '$pidFile'

`$env:NODE_ENV = 'production'

Start-Transcript -Path `$logFile -Append

Write-Host "Server starting at `$(Get-Date)" -ForegroundColor Green
Write-Host "PID: `$PID" -ForegroundColor Gray

`$PID | Out-File -FilePath `$pidFile -NoNewline

try {
    npm run start:prod
}
catch {
    Write-Host "Server crashed: `$_" -ForegroundColor Red
    Remove-Item `$pidFile -Force -ErrorAction SilentlyContinue
}
finally {
    Stop-Transcript
}
"@
    
    $startScriptPath = Join-Path $serverPath "start-background.ps1"
    $startScript | Out-File -FilePath $startScriptPath -Encoding UTF8 -Force
    
    $process = Start-Process powershell -ArgumentList "-NoProfile", "-WindowStyle", "Hidden", "-File", $startScriptPath -PassThru
    
    Pop-Location
    
    Write-Host "Server process started (PID: $($process.Id))" -ForegroundColor Green
    Write-Host "Waiting for server to be ready..." -ForegroundColor Yellow
    
    $maxWait = 30
    $waited = 0
    $ready = $false
    
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
        
        $health = Get-ServerHealth
        if ($health.Healthy) {
            $ready = $true
            break
        }
        
        if (-not (Test-ServerRunning)) {
            Write-Host ""
            Write-Host "Error: Server process died during startup" -ForegroundColor Red
            Write-Host "Check the log file for details: $logFile" -ForegroundColor Yellow
            exit 1
        }
        
        if ($waited % 5 -eq 0) {
            Write-Host "  Still waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    
    if ($ready) {
        Write-Host "Server is ready!" -ForegroundColor Green
        Write-Host "  URL: http://localhost:$serverPort" -ForegroundColor Cyan
        Write-Host "  PID: $($process.Id)" -ForegroundColor Gray
        Write-Host "  Log: $logFile" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Use -s to check status, -k to stop" -ForegroundColor Yellow
    }
    else {
        Write-Host "Warning: Server started but not responding yet" -ForegroundColor Yellow
        Write-Host "Check status with: .\toggle-server.ps1 -s" -ForegroundColor Yellow
    }
}

if ($help) {
    Show-Help
    exit 0
}

if ($s) {
    Show-Status
    exit 0
}

if ($k) {
    Stop-Server
    exit 0
}

Start-Server
