param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$clientDir = Join-Path $projectRoot "CalebsModClient"
$serverDir = Join-Path $projectRoot "calebs-mod-server"
$versionFile = Join-Path $serverDir "CalebsModClientVersion.txt"
$envFile = Join-Path $serverDir ".env"

Write-Host "=== Caleb's Mod Client - S3 Upload Script ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $versionFile)) {
    Write-Host "Error: Version file not found at $versionFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $envFile)) {
    Write-Host "Error: .env file not found at $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "Reading current version..." -ForegroundColor Yellow
$currentVersion = Get-Content $versionFile -Raw
$currentVersion = $currentVersion.Trim()
Write-Host "Current version: $currentVersion" -ForegroundColor Green

if ($currentVersion -notmatch '^(\d+)\.(\d+)$') {
    Write-Host "Error: Invalid version format. Expected format: X.YY (e.g., 0.01)" -ForegroundColor Red
    exit 1
}

$major = [int]$matches[1]
$minor = [int]$matches[2]

$minor++
if ($minor -gt 99) {
    $major++
    $minor = 0
}

$newVersion = "$major.{0:D2}" -f $minor
Write-Host "New version: $newVersion" -ForegroundColor Green
Write-Host ""

Write-Host "Loading AWS credentials from .env..." -ForegroundColor Yellow
$envContent = Get-Content $envFile
$s3AccessKey = ($envContent | Where-Object { $_ -match '^S3_ACCESS_KEY_ID=' }) -replace 'S3_ACCESS_KEY_ID=', ''
$s3SecretKey = ($envContent | Where-Object { $_ -match '^S3_SECRET_ACCESS_KEY=' }) -replace 'S3_SECRET_ACCESS_KEY=', ''

if ([string]::IsNullOrWhiteSpace($s3AccessKey) -or [string]::IsNullOrWhiteSpace($s3SecretKey)) {
    Write-Host "Error: S3 credentials not found in .env file" -ForegroundColor Red
    exit 1
}

$env:AWS_ACCESS_KEY_ID = $s3AccessKey
$env:AWS_SECRET_ACCESS_KEY = $s3SecretKey
$env:AWS_DEFAULT_REGION = "us-west-1"

Write-Host "AWS credentials loaded" -ForegroundColor Green
Write-Host ""

if (-not $SkipBuild) {
    Write-Host "Building Wails client..." -ForegroundColor Yellow
    Push-Location $clientDir
    
    try {
        Write-Host "Running: wails build" -ForegroundColor Cyan
        wails build
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Wails build failed with exit code $LASTEXITCODE" -ForegroundColor Red
            Pop-Location
            exit 1
        }
        
        Write-Host "Build completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "Error during build: $_" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    finally {
        Pop-Location
    }
    Write-Host ""
} else {
    Write-Host "Skipping build (using existing build output)..." -ForegroundColor Yellow
    Write-Host ""
}

$buildOutputDir = Join-Path $clientDir "build\bin"
if (-not (Test-Path $buildOutputDir)) {
    Write-Host "Error: Build output directory not found at $buildOutputDir" -ForegroundColor Red
    Write-Host "Please ensure the Wails build completed successfully" -ForegroundColor Red
    exit 1
}

$zipFileName = "CalebsModClient-$newVersion.zip"
$zipFilePath = Join-Path $projectRoot $zipFileName

if (Test-Path $zipFilePath) {
    Write-Host "Removing existing zip file..." -ForegroundColor Yellow
    Remove-Item $zipFilePath -Force
}

Write-Host "Creating zip archive..." -ForegroundColor Yellow
Write-Host "Source: $buildOutputDir" -ForegroundColor Gray
Write-Host "Output: $zipFilePath" -ForegroundColor Gray

try {
    Compress-Archive -Path "$buildOutputDir\*" -DestinationPath $zipFilePath -CompressionLevel Optimal
    
    $zipSize = (Get-Item $zipFilePath).Length / 1MB
    Write-Host "Zip created successfully (Size: $([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green
}
catch {
    Write-Host "Error creating zip: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# The bootstrapper and the client's self-updater both refuse a download whose
# digest does not match, but only if there is a digest to compare against. The
# sidecar next to the zip is where the server reads it from.
Write-Host "Computing checksum..." -ForegroundColor Yellow
$sha256 = (Get-FileHash -Path $zipFilePath -Algorithm SHA256).Hash.ToLower()
$checksumFilePath = "$zipFilePath.sha256"
Set-Content -Path $checksumFilePath -Value $sha256 -NoNewline -Encoding ascii
Write-Host "SHA256: $sha256" -ForegroundColor Green
Write-Host ""

Write-Host "Uploading to S3..." -ForegroundColor Yellow
$s3Key = "client-releases/$zipFileName"
$s3Bucket = "calebsmod-downloads"

Write-Host "Bucket: $s3Bucket" -ForegroundColor Gray
Write-Host "Key: $s3Key" -ForegroundColor Gray

try {
    $awsCliCheck = Get-Command aws -ErrorAction SilentlyContinue
    if (-not $awsCliCheck) {
        Write-Host "Error: AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
        Write-Host "Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
        exit 1
    }
    
    aws s3 cp $zipFilePath "s3://$s3Bucket/$s3Key" --no-progress
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: S3 upload failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
    
    # Uploaded after the zip so a release is never advertised with a digest
    # that describes a file that is not there yet.
    aws s3 cp $checksumFilePath "s3://$s3Bucket/$s3Key.sha256" --no-progress
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: checksum upload failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Upload completed successfully" -ForegroundColor Green
}
catch {
    Write-Host "Error uploading to S3: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "Updating version file..." -ForegroundColor Yellow
Set-Content -Path $versionFile -Value $newVersion -NoNewline
Write-Host "Version file updated to: $newVersion" -ForegroundColor Green
Write-Host ""

Write-Host "Cleaning up local artifacts..." -ForegroundColor Yellow
Remove-Item $zipFilePath -Force
Remove-Item $checksumFilePath -Force
Write-Host "Cleanup completed" -ForegroundColor Green
Write-Host ""

Write-Host "=== Upload Complete ===" -ForegroundColor Cyan
Write-Host "Version: $currentVersion -> $newVersion" -ForegroundColor Green
Write-Host "S3 Location: s3://$s3Bucket/$s3Key" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review the changes to $versionFile" -ForegroundColor White
Write-Host "2. Commit the version update to the repository" -ForegroundColor White
Write-Host "3. The client is now available at the S3 location above" -ForegroundColor White
Write-Host ""
