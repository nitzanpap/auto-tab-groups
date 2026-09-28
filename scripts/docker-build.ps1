[CmdletBinding()]
param (
    [switch]$RunTests,
    [switch]$NoPrune
)

$ErrorActionPreference = "Stop"

# Locate Repository Root
$repoRoot = if (Test-Path (Join-Path $PSScriptRoot "..\docker\Dockerfile")) {
    (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    (Get-Location).Path
}

$dockerfilePath = Join-Path $repoRoot "docker\Dockerfile"
if (-not (Test-Path $dockerfilePath)) {
    $dockerfilePath = Join-Path $repoRoot "Dockerfile"
}

Write-Host "Building Auto Tab Groups via Docker Container..." -ForegroundColor Cyan
Write-Host "Repository Root: $repoRoot" -ForegroundColor Gray

Set-Location $repoRoot

docker build -f $dockerfilePath --target export --output type=local,dest=. .

if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker build and export failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Extension successfully built and exported to .output/" -ForegroundColor Green

if ($RunTests) {
    Write-Host "Running automated test suite inside Docker..." -ForegroundColor Yellow
    docker build -f $dockerfilePath --target test -t auto-tab-groups:test .
    docker run --rm auto-tab-groups:test bun run test
}

# Automatically clean up dangling build layers
if (-not $NoPrune) {
    Write-Host "Automatically cleaning up dangling build layers..." -ForegroundColor Gray
    docker image prune --filter "dangling=true" -f
}
