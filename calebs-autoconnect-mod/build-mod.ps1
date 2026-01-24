#!/usr/bin/env pwsh

Write-Host "Building Caleb's AutoConnect Mod..." -ForegroundColor Cyan

if (!(Test-Path "gradlew.bat")) {
    Write-Host "Error: gradlew.bat not found. Please ensure Gradle wrapper is set up." -ForegroundColor Red
    exit 1
}

Write-Host "Running Gradle build..." -ForegroundColor Yellow
& .\gradlew.bat build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild successful!" -ForegroundColor Green
    Write-Host "JAR file location: build\libs\calebs-autoconnect-1.0.0.jar" -ForegroundColor Green
    
    if (Test-Path "build\libs\calebs-autoconnect-1.0.0.jar") {
        $jarSize = (Get-Item "build\libs\calebs-autoconnect-1.0.0.jar").Length / 1KB
        Write-Host "JAR size: $([math]::Round($jarSize, 2)) KB" -ForegroundColor Cyan
    }
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}
