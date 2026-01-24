#!/usr/bin/env pwsh

Write-Host "Building all CalebsMod custom mods..." -ForegroundColor Cyan

$mods = Get-ChildItem -Directory | Where-Object { Test-Path "$($_.FullName)\build.gradle" }

if ($mods.Count -eq 0) {
    Write-Host "No mods found to build" -ForegroundColor Yellow
    exit 0
}

$built = @()
$failed = @()

foreach ($mod in $mods) {
    Write-Host "`nBuilding $($mod.Name)..." -ForegroundColor Yellow
    
    Push-Location $mod.FullName
    
    if (Test-Path "gradlew.bat") {
        & .\gradlew.bat build --quiet
        if ($LASTEXITCODE -eq 0) {
            $built += $mod.Name
            Write-Host "✓ $($mod.Name) built successfully" -ForegroundColor Green
        } else {
            $failed += $mod.Name
            Write-Host "✗ $($mod.Name) failed to build" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ No gradlew.bat found in $($mod.Name)" -ForegroundColor Red
        $failed += $mod.Name
    }
    
    Pop-Location
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Build Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Built: $($built.Count)" -ForegroundColor Green
Write-Host "Failed: $($failed.Count)" -ForegroundColor Red

if ($built.Count -gt 0) {
    Write-Host "`nSuccessfully built:" -ForegroundColor Green
    foreach ($name in $built) {
        Write-Host "  - $name" -ForegroundColor Green
    }
}

if ($failed.Count -gt 0) {
    Write-Host "`nFailed to build:" -ForegroundColor Red
    foreach ($name in $failed) {
        Write-Host "  - $name" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Copy JARs from each mod's build/libs/ to your modpack" -ForegroundColor White
Write-Host "2. Client mods go in the client modpack" -ForegroundColor White
Write-Host "3. Server mods go in calebs-mod-server/minecraft-data/mods/" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
