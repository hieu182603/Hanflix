#Requires -Version 5.1
<#
.SYNOPSIS
  HanFlix Backend - Quick redeploy script.

.DESCRIPTION
  Optimized for the inner-loop after infrastructure is already in place.
  Skips: resource group check, full Bicep deploy, Key Vault secret setup.

  Workflow (~30-90s end-to-end on cached layers):
    1. (Optional) build + push new image to GHCR
    2. `az containerapp update --image ...` (no infra re-deploy)
    3. Poll health endpoint until 200 (with exponential backoff)
    4. Print final status

.PARAMETER ResourcePrefix
  Azure resource prefix. Default: "hanflix"

.PARAMETER GhcrImage
  Full image reference, e.g. ghcr.io/hieu182603/hanflix-backend:latest.
  When set without -BuildLocal, the script only updates the Container App
  to this existing tag (no rebuild).

.PARAMETER BuildLocal
  Build the image from ./backend using Dockerfile and push to GHCR before
  updating the Container App.

.PARAMETER NoWait
  Skip the health-check polling after the update.

.EXAMPLE
  # Rebuild from ./backend + push + redeploy + wait for healthy
  .\deploy-quick.ps1 -BuildLocal

.EXAMPLE
  # Use an existing image tag without rebuilding
  .\deploy-quick.ps1 -GhcrImage "ghcr.io/hieu182603/hanflix-backend:v20260920-015338"

.EXAMPLE
  # Build + push only (don't update container app)
  .\deploy-quick.ps1 -BuildLocal -NoWait
#>

param(
  [string] $ResourcePrefix = "hanflix",
  [string] $GhcrImage = "",
  [switch] $BuildLocal,
  [switch] $NoWait
)

$ErrorActionPreference = "Stop"

function Write-Success($m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Info($m)    { Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m)    { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Fail($m)    { Write-Host "[FAIL] $m" -ForegroundColor Red }

# ---- Banner ----
Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "  HanFlix Backend - Quick Redeploy" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host ""

# ---- Prereq ----
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  Write-Fail "Azure CLI not found in PATH"; exit 1
}
if ($BuildLocal -and -not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Fail "Docker not found in PATH"; exit 1
}

$rgName = "rg-$ResourcePrefix"
$appName = "${ResourcePrefix}backend"

# Quick Azure session check
$account = az account show --query "id" -o tsv 2>$null
if (-not $account) {
  Write-Info "No Azure session - opening browser login..."
  az login --use-device-code | Out-Null
}

# ---- Resolve current image (so we can diff and skip no-op updates) ----
$currentImage = az containerapp show `
  --name $appName --resource-group $rgName `
  --query "properties.template.containers[0].image" -o tsv 2>$null

Write-Info "Current image: $currentImage"

# ---- (Optional) build + push ----
if ($BuildLocal -or (-not $GhcrImage)) {
  $acrLoginServer = az acr list -g $rgName --query "[0].loginServer" -o tsv 2>$null
  $backendDir = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) "backend"

  if ($acrLoginServer) {
    Write-Host ""
    Write-Host "-- Build & Push to ACR ----------------------------" -ForegroundColor Gray
    Write-Info "Logging into ACR: $acrLoginServer..."
    az acr login --name ($acrLoginServer.Split('.')[0]) | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "ACR login failed"; exit 1 }

    $tagVersion = "v$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $imageTag = "$acrLoginServer/hanflix-backend:$tagVersion"
    $imageLatest = "$acrLoginServer/hanflix-backend:latest"

    Write-Info "Building $imageTag..."
    docker build -t $imageTag -t $imageLatest $backendDir
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker build failed"; exit 1 }
    Write-Success "Built $imageTag"

    Write-Info "Pushing to ACR..."
    docker push $imageTag
    docker push $imageLatest
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker push failed"; exit 1 }
    Write-Success "Pushed to ACR"

    $GhcrImage = $imageTag
  } else {
    if (-not $env:GHCR_USERNAME -or -not $env:GHCR_TOKEN) {
      Write-Fail "GHCR_USERNAME / GHCR_TOKEN env vars required when ACR is not used"
      exit 1
    }

    Write-Host ""
    Write-Host "-- Build & Push to GHCR ---------------------------" -ForegroundColor Gray

    $env:GHCR_TOKEN | docker login ghcr.io -u $env:GHCR_USERNAME --password-stdin | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "GHCR login failed"; exit 1 }

    $tagVersion = "v$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $imageTag = "ghcr.io/$($env:GHCR_USERNAME)/hanflix-backend:$tagVersion"
    $imageLatest = "ghcr.io/$($env:GHCR_USERNAME)/hanflix-backend:latest"

    Write-Info "Building $imageTag..."
    $env:DOCKER_BUILDKIT = "1"
    docker build `
      --cache-from "type=registry,ref=ghcr.io/$($env:GHCR_USERNAME)/hanflix-backend:cache" `
      --cache-to   "type=registry,ref=ghcr.io/$($env:GHCR_USERNAME)/hanflix-backend:cache,mode=max" `
      -t $imageTag -t $imageLatest -t "ghcr.io/$($env:GHCR_USERNAME)/hanflix-backend:cache" `
      $backendDir | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker build failed"; exit 1 }
    Write-Success "Built $imageTag"

    Write-Info "Pushing to GHCR..."
    docker push $imageTag | Out-Null
    docker push $imageLatest | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker push failed"; exit 1 }
    Write-Success "Pushed"

    $GhcrImage = $imageTag
  }
}

if (-not $GhcrImage) {
  Write-Fail "Nothing to deploy. Pass -BuildLocal OR -GhcrImage '<existing-tag>'."
  exit 1
}

# ---- Idempotent update: skip if same tag ----
if ($currentImage -eq $GhcrImage) {
  Write-Info "Image unchanged ($GhcrImage) - no update needed."
  if ($NoWait) { return }
} else {
  Write-Host ""
  Write-Host "-- Update Container App --------------------------" -ForegroundColor Gray
  Write-Info "Updating $appName -> $GhcrImage"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  az containerapp update `
    --name $appName --resource-group $rgName `
    --image $GhcrImage `
    --output none 2>$null
  $sw.Stop()
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "containerapp update failed (took $($sw.Elapsed.TotalSeconds.ToString('0.0'))s)"
    exit 1
  }
  Write-Success "Updated in $($sw.Elapsed.TotalSeconds.ToString('0.0'))s"
}

# ---- Health polling ----
if (-not $NoWait) {
  Write-Host ""
  Write-Host "-- Health Check (polling) -------------------------" -ForegroundColor Gray

  $fqdn = az containerapp show `
    --name $appName --resource-group $rgName `
    --query "properties.configuration.ingress.fqdn" -o tsv 2>$null

  if (-not $fqdn) {
    Write-Warn "No public FQDN found - skipping health check."
  } else {
    $healthUrl = "https://$fqdn/health"
    Write-Info "Polling $healthUrl ..."

    $delays = @(3, 5, 8, 12, 20, 30)   # seconds - cumulative ~78s budget
    $totalSw = [System.Diagnostics.Stopwatch]::StartNew()
    $ok = $false
    foreach ($d in $delays) {
      Start-Sleep -Seconds $d
      try {
        $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
          Write-Success "Healthy after $("{0:0.0}" -f $totalSw.Elapsed.TotalSeconds)s - $($r.Content)"
          $ok = $true
          break
        }
      } catch { }
      Write-Info "  retrying in ${d}s..."
    }
    if (-not $ok) {
      Write-Warn "Not healthy within budget. Tail logs:"
      Write-Host "  az containerapp logs show -n $appName -g $rgName --tail 30"
    }
  }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "  Done" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "  App:    $appName" -ForegroundColor Green
Write-Host "  Image:  $GhcrImage" -ForegroundColor Green
Write-Host ""
