# HanFlix Backend - Hướng Dẫn Deploy

## Mục lục
- [Yêu cầu](#yêu-cầu)
- [Cấu hình Azure](#cấu-hình-azure)
- [Deploy lần đầu](#deploy-lần-đầu)
- [Deploy cập nhật](#deploy-cập-nhật)
- [Xem logs](#xem-logs)
- [Xử lý sự cố](#xử-lý-sự-cố)

---

## Yêu cầu

### Công cụ cần cài đặt

| Công cụ | Phiên bản | Link tải |
|---------|-----------|----------|
| Docker Desktop | 4.x+ | https://docker.com/products/docker-desktop |
| Azure CLI | 2.50+ | https://docs.microsoft.com/cli/azure/install-azure-cli |
| Node.js | 20+ | https://nodejs.org/ |
| PowerShell | 5.1+ | Đã có sẵn trên Windows |

### Kiểm tra cài đặt

```powershell
# Mở PowerShell và chạy:
docker --version
az --version
node --version
npm --version
```

---

## Cấu hình Azure

### 1. Đăng nhập Azure

```powershell
az login
az account set --subscription "Tên Subscription của bạn"
```

### 2. Tạo Resource Group (nếu chưa có)

```powershell
az group create --name hanflix-rg --location southeastasia
```

### 3. Tạo Azure Container Registry (ACR)

```powershell
# Tạo ACR (tên phải DUY NHẤT toàn cầu)
az acr create \
  --resource-group hanflix-rg \
  --name hanflixacr \
  --sku Basic

# Bật admin user (để push/pull images)
az acr update -n hanflixacr --admin-enabled true
```

### 4. Tạo Container Apps Environment

```powershell
az containerapp env create \
  --name hanflix-env \
  --resource-group hanflix-rg \
  --location southeastasia
```

### 5. Cập nhật script config

Mở file `scripts/deploy.ps1` và sửa các giá trị:

```powershell
$CONFIG = @{
    ResourceGroup       = "hanflix-rg"        # Resource Group của bạn
    ContainerAppName    = "hanflix-backend"    # Tên Container App
    ContainerAppsEnv    = "hanflix-env"        # Environment đã tạo
    RegistryName        = "hanflixacr"         # Tên ACR đã tạo
    RegistryLogin        = "hanflixacr.azurecr.io"
    ...
}
```

---

## Deploy lần đầu

### 1. Chuẩn bị file .env

```powershell
# Từ thư mục backend
cd backend
cp .env.example .env
```

Chỉnh sửa `.env` với các giá trị thực:
- MongoDB URI
- R2 credentials
- Azure Speech/Translator keys
- JWT secrets

### 2. Chạy script deploy

```powershell
# Từ thư mục backend
cd backend
.\scripts\deploy.ps1
```

Script sẽ tự động:
1. Build Docker image
2. Push lên ACR
3. Deploy lên Container Apps
4. Kiểm tra health endpoint

### 3. Cấu hình Environment Variables trên Azure

Sau khi deploy lần đầu, cấu hình secrets trên Azure Portal:

1. Mở **Azure Portal** → **Container Apps** → **hanflix-backend**
2. Chọn **Configuration** → **Secrets**
3. Thêm các secrets:
   - `MONGODB_URI`
   - `JWT_ACCESS_SECRET`
   - `JWT_REFRESH_SECRET`
   - `GEMINI_API_KEY`
   - `AZURE_TRANSLATOR_KEY`
   - `AZURE_SPEECH_KEY`
   - `R2_*` credentials
   - `SMTP_*` credentials

4. Chọn **Environment variables** → Map secrets vào environment variables

### 4. Kiểm tra deployment

```powershell
# Xem trạng thái
az containerapp show --name hanflix-backend --resource-group hanflix-rg --query "properties.fqdn"

# Mở URL để kiểm tra
# https://<fqdn>/health
```

---

## Deploy cập nhật

### Sau khi sửa code

```powershell
cd backend
.\scripts\deploy.ps1
```

### Các options

```powershell
# Skip build (dùng image đã có)
.\scripts\deploy.ps1 -SkipBuild

# Skip health check
.\scripts\deploy.ps1 -SkipHealthCheck

# Kết hợp
.\scripts\deploy.ps1 -SkipBuild -SkipHealthCheck
```

---

## Xem logs

### Logs trực tiếp

```powershell
az containerapp logs show --name hanflix-backend --resource-group hanflix-rg --follow
```

### Logs gần đây

```powershell
az containerapp logs show --name hanflix-backend --resource-group hanflix-rg --tail 100
```

### Logs theo thời gian

```powershell
az containerapp logs show \
  --name hanflix-backend \
  --resource-group hanflix-rg \
  --start-time "2026-09-19T10:00:00Z" \
  --end-time "2026-09-19T11:00:00Z"
```

---

## Xử lý sự cố

### Container App không start

```powershell
# Xem logs chi tiết
az containerapp logs show --name hanflix-backend --resource-group hanflix-rg

# Kiểm tra revision
az containerapp revision list --name hanflix-backend --resource-group hanflix-rg

# Restart
az containerapp restart --name hanflix-backend --resource-group hanflix-rg
```

### Image pull failed

```powershell
# Kiểm tra credentials
az acr credential show --name hanflixacr

# Login lại
az acr login --name hanflixacr
```

### Health check fail

```powershell
# Kiểm tra port
az containerapp show --name hanflix-backend --resource-group hanflix-rg --query "properties.template.containers[0].ports"

# Kiểm tra env vars
az containerapp show --name hanflix-backend --resource-group hanflix-rg --query "properties.template.containers[0].env"
```

---

## Commands hữu ích

```powershell
# List all container apps
az containerapp list --resource-group hanflix-rg

# Scale replicas
az containerapp update --name hanflix-backend --resource-group hanflix-rg --min-replicas 2 --max-replicas 4

# Disable/Enable
az containerapp update --name hanflix-backend --resource-group hanflix-rg --min-replicas 0

# Show metrics
az containerapp show --name hanflix-backend --resource-group hanflix-rg --query "properties.metrics"

# Cleanup old images in ACR
az acr purge --registry hanflixacr --filter "image:.*" --ago 30d
```

---

## Cấu trúc thư mục sau deploy

```
backend/
├── .env                    # Chứa secrets (KHÔNG commit lên git)
├── Dockerfile             # Docker image definition
├── dist/                  # Compiled code (tự động build)
├── scripts/
│   └── deploy.ps1         # Script deploy
└── ...
```

---

## Liên hệ hỗ trợ

Nếu gặp vấn đề không xử lý được:
1. Xem logs chi tiết: `az containerapp logs show --name hanflix-backend --resource-group hanflix-rg`
2. Kiểm tra Azure Portal → Container Apps → Diagnose and solve problems
3. Kiểm tra Azure Service Health
