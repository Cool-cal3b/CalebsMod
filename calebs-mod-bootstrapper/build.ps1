$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$outputDir = Join-Path $projectRoot "dist"
$goFile = Join-Path $projectRoot "calebs-mod-bootstrapper.go"
$outputExe = Join-Path $outputDir "CalebsModBootstrapper.exe"

Write-Host "=== Building Caleb's Mod Bootstrapper ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $goFile)) {
    Write-Host "Error: Go source file not found at $goFile" -ForegroundColor Red
    exit 1
}

$goVersion = go version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Go is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Go from: https://golang.org/dl/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Go version: $goVersion" -ForegroundColor Green
Write-Host ""

if (Test-Path $outputDir) {
    Write-Host "Cleaning output directory..." -ForegroundColor Yellow
    Remove-Item -Path $outputDir -Recurse -Force
}

Write-Host "Creating output directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
Write-Host ""

Write-Host "Building bootstrapper executable..." -ForegroundColor Yellow
Write-Host "Source: $goFile" -ForegroundColor Gray
Write-Host "Output: $outputExe" -ForegroundColor Gray
Write-Host ""

Push-Location $projectRoot

try {
    $env:CGO_ENABLED = "0"
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    
    # Build the whole package, not a single file: the bootstrapper is split
    # across calebs-mod-bootstrapper.go and the platform-tagged shortcut_*.go
    # files, and naming one file makes `go build` ignore the rest.
    go build -ldflags="-s -w" -o $outputExe .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    $exeSize = (Get-Item $outputExe).Length / 1MB
    Write-Host "Output file: $outputExe" -ForegroundColor Green
    Write-Host "Size: $([math]::Round($exeSize, 2)) MB" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "=== Build Complete ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test the bootstrapper by running: $outputExe" -ForegroundColor White
    Write-Host "2. Distribute this EXE to your friends" -ForegroundColor White
    Write-Host "3. They should run it to download and launch the client" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "Error during build: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}
