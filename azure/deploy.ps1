#Requires -Version 5.1
<#
.SYNOPSIS
  HanFlix Backend - Azure Deployment Script (PowerShell)

.DESCRIPTION
  Deploys HanFlix backend to Azure Container Apps using Bicep templates.
  Handles the full workflow:
    1. Azure login + subscription selection
    2. Resource group creation
    3. Azure Container Registry (ACR) setup
    4. Azure Key Vault setup
    5. Push Docker image to ACR
    6. Set secrets in Key Vault
    7. Deploy infrastructure via Bicep
    8. Verify deployment health

.PARAMETER ResourcePrefix
  Unique prefix for all Azure resources (lowercase, max 15 chars). Default: "hanflix"

.PARAMETER Location
  Azure region. Default: "japaneast"

.PARAMETER DockerImage
  Full Docker image URL (e.g. ghcr.io/owner/hanflix-backend:v1.0.0).
  If not provided, script will try to build and push from local Dockerfile.

.PARAMETER SkipImageBuild
  Skip Docker image build and push steps. Use when image already exists.

.PARAMETER SkipSecrets
  Skip Key Vault secret setup. Use when secrets already configured.

.PARAMETER SkipInfra
  Skip infrastructure deployment (Bicep). Use when infra already exists.

.EXAMPLE
  # Full deployment with manual image
  .\deploy.ps1 -ResourcePrefix "hanflix" -DockerImage "ghcr.io/owner/hanflix-backend:v1.0.0"

  # Deploy using local Dockerfile build
  .\deploy.ps1 -ResourcePrefix "hanflix"

  # Skip image build (infra already exists, just redeploy)
  .\deploy.ps1 -ResourcePrefix "hanflix" -DockerImage "myregistry.azurecr.io/hanflix-backend:latest" -SkipImageBuild -SkipSecrets -SkipInfra
#>

param(
  [string] $ResourcePrefix = "hanflix",
  [string] $Location = "japaneast",
  [string] $DockerImage = "",
  [switch] $SkipImageBuild,
  [switch] $SkipSecrets,
  [switch] $SkipInfra
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "Continue"

# ---- Color helpers ----
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Get-LatestDeploymentName {
  param([string]$ResourceGroup)
  $jmesQuery = 'sort_by(@, &properties.timestamp)[-1].name'
  return (az deployment group list -g $ResourceGroup --query $jmesQuery -o tsv 2>$null)
}

# ---- Banner ----
Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "  HanFlix Backend - Azure Deployment" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host ""

# ============================================================
# STEP 0: Prerequisites check
# ============================================================
Write-Host "-- Checking prerequisites --------------------------" -ForegroundColor Gray

$requiredTools = @("az", "docker")
$missingTools = @()
foreach ($tool in $requiredTools) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    $missingTools += $tool
  }
}

if ($missingTools.Count -gt 0) {
  Write-Fail "Missing required tools: $($missingTools -join ', ')"
  Write-Host "  Azure CLI:  https://docs.microsoft.com/cli/azure/install-azure-cli"
  Write-Host "  Docker:     https://docs.docker.com/get-docker/"
  exit 1
}

$cliVer = (az version --output json 2>$null | ConvertFrom-Json).'azure-cli'
Write-Success "Azure CLI: $cliVer"
Write-Success "Docker: $(docker --version 2>$null)"

# ============================================================
# STEP 1: Azure Login & Subscription
# ============================================================
Write-Host ""
Write-Host "-- Step 1: Azure Login -----------------------------" -ForegroundColor Gray

$account = az account show --query "id" -o tsv 2>$null
if (-not $account) {
  Write-Info "No Azure session found. Opening browser for login..."
  az login --use-device-code
  $account = az account show --query "id" -o tsv
}

$subId = az account show --query "id" -o tsv
$subName = az account show --query "name" -o tsv
Write-Success "Logged in to Azure. Subscription: $subName ($subId)"

# ============================================================
# STEP 2: Resource Group
# ============================================================
Write-Host ""
Write-Host "-- Step 2: Resource Group ------------------------" -ForegroundColor Gray

$rgName = "rg-$ResourcePrefix"
$rgExists = az group exists --name $rgName

if ($rgExists -ne "true") {
  Write-Info "Creating resource group: $rgName ($Location)"
  az group create --name $rgName --location $Location --output none
  Write-Success "Resource group created"
} else {
  Write-Info "Resource group already exists: $rgName"
}

# ============================================================
# STEP 3: Infrastructure Deployment (Bicep)
# ============================================================
if (-not $SkipInfra) {
  Write-Host ""
  Write-Host "-- Step 3: Deploy Infrastructure (Bicep) ---------" -ForegroundColor Gray

  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  $bicepFile = Join-Path $scriptDir "main.bicep"
  $paramsFile = Join-Path $scriptDir "main.parameters.json"

  if (-not (Test-Path $bicepFile)) {
    Write-Fail "Bicep file not found: $bicepFile"
    exit 1
  }

  # Build deployment parameters
  $params = @(
    "--template-file", $bicepFile,
    "--parameters", "@$paramsFile",
    "--parameters", "resourcePrefix=$ResourcePrefix",
    "--parameters", "location=$Location",
    "--parameters", "nodeEnv=production",
    "--parameters", "allowedOrigins=*"
  )

  if ($DockerImage) {
    $params += @("--parameters", "dockerImage=$DockerImage")
  }

  Write-Info "Deploying Bicep templates..."
  $deployOutput = az deployment group create `
    --resource-group $rgName `
    --name "hanflix-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
    @params `
    --output json

  if ($LASTEXITCODE -ne 0 -or -not $deployOutput) {
    Write-Fail "Bicep deployment failed"
    exit 1
  }

  $deployResult = $deployOutput | ConvertFrom-Json

  $outputs = $deployResult.properties.outputs
  $acrLoginServer = $outputs.acrLoginServer.value
  $keyVaultName = $outputs.keyVaultName.value
  $backendFqdn = $outputs.backendFqdn.value

  Write-Success "Infrastructure deployed successfully"
  Write-Info "  ACR Login Server: $acrLoginServer"
  Write-Info "  Key Vault: $keyVaultName"
  Write-Info "  Backend URL: https://$backendFqdn"
} else {
  # Retrieve existing resources
  Write-Info "Skipping infrastructure deployment"
  $acrLoginServer = az deployment group show `
    --resource-group $rgName `
    --name "hanflix-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
    --query "properties.outputs.acrLoginServer.value" -o tsv 2>$null

  if (-not $acrLoginServer) {
    Write-Fail "Cannot retrieve outputs. Run without -SkipInfra first."
    exit 1
  }
}

# ============================================================
# STEP 4: Azure Container Registry Setup
# ============================================================
if (-not $SkipImageBuild) {
  Write-Host ""
  Write-Host "-- Step 4: ACR Login -------------------------------" -ForegroundColor Gray

  Write-Info "Logging in to ACR: $acrLoginServer"
  az acr login --name $acrLoginServer.Split('.')[0]
  Write-Success "ACR login successful"

  # ---- Build & Push Docker Image ----
  if (-not $DockerImage) {
    Write-Host ""
    Write-Host "-- Step 4b: Build & Push Docker Image --------------" -ForegroundColor Gray

    $tagVersion = "v$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $imageTag = "$acrLoginServer/hanflix-backend:$tagVersion"
    $imageLatest = "$acrLoginServer/hanflix-backend:latest"

    $backendDir = Split-Path -Parent (Split-Path -Parent $scriptDir)

    Write-Info "Building Docker image..."
    docker build -t $imageTag -t $imageLatest "$backendDir/backend"
    if ($LASTEXITCODE -ne 0) {
      Write-Fail "Docker build failed"
      exit 1
    }
    Write-Success "Docker image built: $imageTag"

    Write-Info "Pushing to ACR..."
    docker push $imageTag
    docker push $imageLatest
    if ($LASTEXITCODE -ne 0) {
      Write-Fail "Docker push failed"
      exit 1
    }
    Write-Success "Image pushed to ACR"

    $DockerImage = $imageTag
    Write-Info "Use this image in future deployments: $DockerImage"
  }
}

# ============================================================
# STEP 5: Set Secrets in Key Vault
# ============================================================
if (-not $SkipSecrets) {
  Write-Host ""
  Write-Host "-- Step 5: Configure Key Vault Secrets ---------------" -ForegroundColor Gray

  $keyVaultName = az deployment group show `
    --resource-group $rgName `
    --name (Get-LatestDeploymentName -ResourceGroup $rgName) `
    --query "properties.outputs.keyVaultName.value" -o tsv 2>$null

  Write-Info "Key Vault: $keyVaultName"

  # Check if user has Key Vault permissions
  Write-Info "Granting Key Vault permissions to current user..."
  $upn = az ad signed-in-user show --query "userPrincipalName" -o tsv 2>$null
  if ($upn) {
    az keyvault set-policy `
      --name $keyVaultName `
      --upn $upn `
      --secret-permissions list get set delete 2>$null | Out-Null
  }

  # Fetch all existing secrets in one call
  $existingSecrets = az keyvault secret list --vault-name $keyVaultName --query "[].name" -o tsv 2>$null
  if (-not $existingSecrets) { $existingSecrets = @() }

  function Set-SecretIfMissing {
    param($Name, $Prompt, $IsPath = $false)

    if ($existingSecrets -contains $Name) {
      Write-Info "  ${Name}: already set (skipping)"
      return
    }

    if ($IsPath) {
      Write-Host "  ${Name}:" -NoNewline
      $path = Read-Host " (path to $Prompt)"
      if ($path) {
        $value = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if ($value) {
          az keyvault secret set --vault-name $keyVaultName --name $Name --value $value --output none
          Write-Success "  ${Name}: set from file"
        }
      }
    } else {
      Write-Host "  ${Name}:" -NoNewline
      $value = Read-Host " ($Prompt)"
      if ($value) {
        az keyvault secret set --vault-name $keyVaultName --name $Name --value $value --output none
        Write-Success "  ${Name}: set"
      }
    }
  }

  Write-Host ""
  Write-Host "  Enter secrets below. Press Enter to skip optional fields." -ForegroundColor DarkGray
  Write-Host ""

  # Required secrets
  Set-SecretIfMissing -Name "MONGODB-URI" -Prompt "MongoDB connection string (mongodb+srv://...)"

  Set-SecretIfMissing -Name "JWT-ACCESS-SECRET" -Prompt "JWT access secret (min 32 chars)"
  Set-SecretIfMissing -Name "JWT-REFRESH-SECRET" -Prompt "JWT refresh secret (min 32 chars)"

  # Optional secrets
  Write-Host ""
  Write-Host "  Optional secrets:" -ForegroundColor DarkGray
  Set-SecretIfMissing -Name "GEMINI-API-KEY" -Prompt "Gemini API key"
  Set-SecretIfMissing -Name "AZURE-TRANSLATOR-KEY" -Prompt "Azure Translator key"
  Set-SecretIfMissing -Name "AZURE-TRANSLATOR-REGION" -Prompt "Azure Translator region (e.g. southeastasia)"
  Set-SecretIfMissing -Name "AZURE-SPEECH-KEY" -Prompt "Azure Speech key"
  Set-SecretIfMissing -Name "AZURE-SPEECH-REGION" -Prompt "Azure Speech region (e.g. southeastasia)"
  Set-SecretIfMissing -Name "R2-ACCOUNT-ID" -Prompt "Cloudflare R2 account ID"
  Set-SecretIfMissing -Name "R2-ACCESS-KEY-ID" -Prompt "Cloudflare R2 access key ID"
  Set-SecretIfMissing -Name "R2-SECRET-ACCESS-KEY" -Prompt "Cloudflare R2 secret access key"
  Set-SecretIfMissing -Name "R2-BUCKET-NAME" -Prompt "Cloudflare R2 bucket name"
  Set-SecretIfMissing -Name "R2-ENDPOINT" -Prompt "Cloudflare R2 endpoint (https://...)"
  Set-SecretIfMissing -Name "R2-PUBLIC-BASE-URL" -Prompt "Cloudflare R2 public base URL"
}

# ============================================================
# STEP 6: Update Container App with Docker Image
# ============================================================
Write-Host ""
Write-Host "-- Step 6: Update Container App Image ---------------" -ForegroundColor Gray

if ($DockerImage) {
  $backendAppName = "$ResourcePrefix" + "backend" # will be named via unique suffix, retrieve from outputs
  $latestDeploy = Get-LatestDeploymentName -ResourceGroup $rgName

  Write-Info "Updating Container App with image: $DockerImage"

  # Update via az containerapp update
  az containerapp update `
    --name "$($ResourcePrefix)backend" `
    --resource-group $rgName `
    --image $DockerImage `
    --output none 2>&1 | Out-Null

  if ($LASTEXITCODE -eq 0) {
    Write-Success "Container App updated"
  } else {
    Write-Warn "Could not update Container App directly. Redeploying infrastructure..."
    # Redeploy with new image parameter
    $bicepFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "main.bicep"
    az deployment group create `
      --resource-group $rgName `
      --name "hanflix-update-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
      --template-file $bicepFile `
      --parameters "@$paramsFile" `
      --parameters "resourcePrefix=$ResourcePrefix" `
      --parameters "dockerImage=$DockerImage" `
      --parameters "location=$Location" `
      --output none
    Write-Success "Container App redeployed with new image"
  }
}

# ============================================================
# STEP 7: Health Check
# ============================================================
Write-Host ""
Write-Host "-- Step 7: Verifying Deployment ---------------------" -ForegroundColor Gray

Start-Sleep -Seconds 10

$backendFqdn = az deployment group show `
  --resource-group $rgName `
  --name (Get-LatestDeploymentName -ResourceGroup $rgName) `
  --query "properties.outputs.backendFqdn.value" -o tsv 2>$null

$healthUrl = "https://$backendFqdn/health"
Write-Info "Checking health endpoint: $healthUrl"

try {
  $healthResponse = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
  if ($healthResponse.StatusCode -eq 200) {
    Write-Success "Backend is healthy! Status: $($healthResponse.StatusCode)"
  } else {
    Write-Warn "Backend responded with status: $($healthResponse.StatusCode)"
  }
} catch {
  Write-Warn "Could not reach backend yet. It may still be starting up."
  Write-Info "Check logs: az containerapp logs --name $($ResourcePrefix)backend --resource-group $rgName"
}

# ============================================================
# DONE
# ============================================================
Write-Host ""
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host "  Deployment Complete!" -ForegroundColor Magenta
Write-Host "==================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Backend URL:    https://$backendFqdn" -ForegroundColor Green
Write-Host "  ACR Server:     $acrLoginServer" -ForegroundColor Green
Write-Host "  Resource Group: $rgName" -ForegroundColor Green
Write-Host ""
Write-Host "  Useful commands:" -ForegroundColor Yellow
Write-Host "    View logs:     az containerapp logs --name $($ResourcePrefix)backend --resource-group $rgName -f"
Write-Host "    Restart:      az containerapp revision restart --name $($ResourcePrefix)backend --resource-group $rgName"
Write-Host "    Redeploy:     .\deploy.ps1 -ResourcePrefix $ResourcePrefix -DockerImage '$DockerImage' -SkipImageBuild -SkipSecrets"
Write-Host ""
