# ==============================================================================
# Auto Tab Groups - Docker Build & Export Automation (PowerShell)
# ==============================================================================
[CmdletBinding()]
param (
    [switch]$RunTests,
    [switch]$Preview,
    [switch]$Prune,
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Building Auto Tab Groups via Docker Container...    " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Hermetic Multi-Stage Build & Direct Local Artifact Export
Write-Host "`n[1/3] Building extensions and exporting artifacts to .output/..." -ForegroundColor Yellow
$exportCmd = "docker build --target export --output type=local,dest=. ."
Invoke-Expression $exportCmd

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build and export failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Extension successfully built and exported to .output/:" -ForegroundColor Green
Get-ChildItem -Path ".output" | Format-Table Name, Length, LastWriteTime

# 2. Run Tests if requested
if ($RunTests) {
    Write-Host "`n[2/3] Running automated test suite inside Docker..." -ForegroundColor Yellow
    docker build --target test -t auto-tab-groups:test .
    docker run --rm auto-tab-groups:test bun run test
}

# 3. Clean up dangling builder images if requested
if ($Prune) {
    Write-Host "`n[3/3] Pruning dangling images..." -ForegroundColor Yellow
    docker image prune --filter "dangling=true" -f
}

# 4. Clean up all build cache and project images if requested
if ($Clean) {
    Write-Host "`nCleaning up project images and build cache..." -ForegroundColor Yellow
    foreach ($target in @("auto-tab-groups:builder", "auto-tab-groups:test")) {
        $id = docker images -q $target
        if ($id) {
            docker rmi -f $id 2>&1 | Out-Null
        }
    }
    docker builder prune -f
    docker image prune -f
}

# 4. Launch Preview Server if requested
if ($Preview) {
    Write-Host "`nStarting preview server on http://localhost:8080..." -ForegroundColor Cyan
    docker compose up -d preview
    Write-Host "Preview server active at http://localhost:8080" -ForegroundColor Green
}

Write-Host "`nDone!" -ForegroundColor Green
