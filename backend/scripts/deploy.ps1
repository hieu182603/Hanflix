# HanFlix Backend Deployment Script
# Chạy: .\deploy.ps1 -Environment Production
param(
    [ValidateSet("Development", "Staging", "Production")]
    [string]$Environment = "Production",

    [switch]$SkipBuild,
    [switch]$SkipHealthCheck,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# ============================================================
# CONFIGURATION - Cập nhật các giá trị này cho project của bạn
# ============================================================
$CONFIG = @{
    # Azure Container Apps
    ResourceGroup       = "hanflix-rg"
    ContainerAppName    = "hanflix-backend"
    ContainerAppsEnv    = "hanflix-env"

    # Azure Container Registry
    RegistryName        = "hanflixacr"  # Thay bằng tên ACR của bạn
    RegistryLogin        = "hanflixacr.azurecr.io"
    ImageName            = "hanflix-backend"
    ImageTag            = "latest"

    # Backend config
    BackendPath         = $PSScriptRoot
    Port                = 4000
    HealthEndpoint      = "/health"
    MaxRetries          = 30
    RetryIntervalSec    = 5
}

# ============================================================
# COLORS
# ============================================================
function Write-Step { param([string]$Message) Write-Host "`n▶ $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "  ✓ $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "  ⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "  ✗ $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) Write-Host "  $Message" -ForegroundColor Gray }

# ============================================================
# CHECKS
# ============================================================
function Test-RequiredTools {
    Write-Step "Kiểm tra công cụ cần thiết..."

    $tools = @{
        "Docker"      = "docker --version"
        "Azure CLI"   = "az --version"
        "Node.js"     = "node --version"
        "npm"         = "npm --version"
    }

    foreach ($tool in $tools.GetEnumerator()) {
        try {
            $result = Invoke-Expression $tool.Value 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "$($tool.Key): $($result.Split("`n")[0])"
            } else {
                throw
            }
        } catch {
            Write-Error "$($tool.Key) không tìm thấy. Vui lòng cài đặt $($tool.Key)."
            exit 1
        }
    }
}

function Test-AzureLogin {
    Write-Step "Kiểm tra đăng nhập Azure..."
    try {
        $account = az account show 2>$null | ConvertFrom-Json
        if ($account) {
            Write-Success "Đã đăng nhập: $($account.email)"
            return $account
        }
    } catch {
        Write-Error "Chưa đăng nhập Azure. Chạy: az login"
        exit 1
    }
}

function Test-EnvFile {
    Write-Step "Kiểm tra file môi trường..."
    $envFile = Join-Path $CONFIG.BackendPath ".env"

    if (-not (Test-Path $envFile)) {
        Write-Error "Không tìm thấy file .env trong thư mục backend"
        Write-Info "Tạo file .env từ .env.example:"
        Write-Info "  cp .env.example .env"
        Write-Info "Sau đó chỉnh sửa .env với các giá trị thực"
        exit 1
    }
    Write-Success "File .env tìm thấy"
    return $envFile
}

# ============================================================
# DOCKER BUILD
# ============================================================
function Build-DockerImage {
    Write-Step "Build Docker image..."

    $fullImageName = "$($CONFIG.RegistryLogin)/$($CONFIG.ImageName):$($CONFIG.ImageTag)"

    try {
        Push-Location $CONFIG.BackendPath

        # Build image
        Write-Info "Building image: $fullImageName"
        docker build -t $fullImageName .

        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
        Write-Success "Build thành công"

        # Tag for local testing
        docker tag $fullImageName "$($CONFIG.ImageName):local"
        Write-Info "Tagged as $($CONFIG.ImageName):local"

        return $fullImageName
    } finally {
        Pop-Location
    }
}

# ============================================================
# PUSH TO ACR
# ============================================================
function Push-ToACR {
    param([string]$ImageName)

    Write-Step "Push image lên Azure Container Registry..."

    # Login to ACR
    Write-Info "Đang đăng nhập ACR..."
    az acr login --name $CONFIG.RegistryName

    # Push image
    Write-Info "Pushing image..."
    docker push $ImageName

    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed"
    }

    Write-Success "Push thành công"
}

# ============================================================
# DEPLOY TO CONTAINER APPS
# ============================================================
function Deploy-ContainerApp {
    param([string]$ImageName)

    Write-Step "Deploy lên Azure Container Apps..."

    $acrCredentials = az acr credential show --name $CONFIG.RegistryName --query "passwords[0].value" -o tsv

    # Check if Container App exists
    $appExists = az containerapp show --name $CONFIG.ContainerAppName --resource-group $CONFIG.ResourceGroup 2>$null

    if ($appExists) {
        Write-Info "Container App đã tồn tại, đang cập nhật..."

        az containerapp update `
            --name $CONFIG.ContainerAppName `
            --resource-group $CONFIG.ResourceGroup `
            --image $ImageName `
            --set-env-vars "NODE_ENV=production" `
            2>&1 | Out-Null

        Write-Success "Cập nhật Container App thành công"
    } else {
        Write-Info "Tạo Container App mới..."

        # Tạo Container App mới
        az containerapp create `
            --name $CONFIG.ContainerAppName `
            --resource-group $CONFIG.ResourceGroup `
            --environment $CONFIG.ContainerAppsEnv `
            --image $ImageName `
            --target-port $CONFIG.Port `
            --ingress external `
            --cpu 0.5 `
            --memory 1Gi `
            --min-replicas 1 `
            --max-replicas 2 `
            --env-vars "NODE_ENV=production" `
            2>&1 | Out-Null

        Write-Success "Tạo Container App thành công"
    }
}

# ============================================================
# HEALTH CHECK
# ============================================================
function Wait-ForHealth {
    param([string]$AppUrl)

    Write-Step "Kiểm tra health endpoint..."

    $healthUrl = "$AppUrl$($CONFIG.HealthEndpoint)"

    for ($i = 1; $i -le $CONFIG.MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10 -UseBasicParsing

            if ($response.StatusCode -eq 200) {
                Write-Success "Health check OK (Attempt $i/$($CONFIG.MaxRetries))"
                return $true
            }
        } catch {
            # Thử với curl nếu Invoke-WebRequest fails
            try {
                $result = curl $healthUrl -s -o /dev/null -w "%{http_code}"
                if ($result -eq "200") {
                    Write-Success "Health check OK (Attempt $i/$($CONFIG.MaxRetries))"
                    return $true
                }
            } catch { }
        }

        Write-Info "Đang chờ... ($i/$($CONFIG.MaxRetries))"
        Start-Sleep -Seconds $CONFIG.RetryIntervalSec
    }

    Write-Warning "Health check timeout sau $($CONFIG.MaxRetries) attempts"
    return $false
}

# ============================================================
# GET APP URL
# ============================================================
function Get-AppUrl {
    Write-Step "Lấy URL của Container App..."

    $app = az containerapp show `
        --name $CONFIG.ContainerAppName `
        --resource-group $CONFIG.ResourceGroup `
        --query "properties.fqdn" `
        -o tsv

    if ($app) {
        $appUrl = "https://$app"
        Write-Success "App URL: $appUrl"
        return $appUrl
    }

    Write-Error "Không lấy được URL của Container App"
    return $null
}

# ============================================================
# SHOW STATUS
# ============================================================
function Show-Status {
    param([string]$AppUrl)

    Write-Step "Trạng thái deployment..."

    Write-Host ""
    Write-Host "  App URL:     $AppUrl" -ForegroundColor White
    Write-Host "  Registry:    $($CONFIG.RegistryLogin)" -ForegroundColor White
    Write-Host "  Image:       $($CONFIG.ImageName):$($CONFIG.ImageTag)" -ForegroundColor White
    Write-Host ""

    # Show recent logs
    Write-Info "Recent logs (last 10 lines):"
    try {
        $logs = az containerapp logs show `
            --name $CONFIG.ContainerAppName `
            --resource-group $CONFIG.ResourceGroup `
            --tail 10 2>$null

        if ($logs) {
            $logs -split "`n" | Select-Object -Last 10 | ForEach-Object {
                Write-Host "    $_" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Info "(Không lấy được logs)"
    }
}

# ============================================================
# MAIN
# ============================================================
function Main {
    Clear-Host
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Magenta
    Write-Host "  HanFlix Backend Deployment Script" -ForegroundColor Magenta
    Write-Host "  Environment: $Environment" -ForegroundColor Magenta
    Write-Host "===============================================" -ForegroundColor Magenta

    # Pre-flight checks
    Test-RequiredTools
    Test-AzureLogin
    $envFile = Test-EnvFile

    # Build and push
    if (-not $SkipBuild) {
        $imageName = Build-DockerImage
        Push-ToACR -ImageName $imageName
    } else {
        $imageName = "$($CONFIG.RegistryLogin)/$($CONFIG.ImageName):$($CONFIG.ImageTag)"
        Write-Info "Skip build, using existing image: $imageName"
    }

    # Deploy
    Deploy-ContainerApp -ImageName $imageName

    # Health check
    if (-not $SkipHealthCheck) {
        $appUrl = Get-AppUrl
        if ($appUrl) {
            Wait-ForHealth -AppUrl $appUrl
        }
        Show-Status -AppUrl $appUrl
    }

    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Green
    Write-Host "  Deployment hoàn tất!" -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Green
}

# Run
Main
