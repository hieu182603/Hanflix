# HanFlix Backend — Azure Deployment Guide

Complete guide to deploying HanFlix backend to Azure Container Apps using Infrastructure as Code (Bicep) + GitHub Actions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Azure Container Apps (Backend API)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Container App (Express.js + Video Worker embedded)  │   │
│  │  Scaling: 1-3 replicas (HTTP + CPU + Memory rules) │   │
│  │  Managed Identity → pulls images from ACR            │   │
│  │  Key Vault secrets via secretRef (no env vars)      │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴──────────┐
        ▼                   ▼
┌─────────────────┐  ┌────────────────────────┐
│  Azure          │  │  Azure Key Vault       │
│  Container      │  │  • MONGODB_URI         │
│  Registry       │  │  • JWT_ACCESS_SECRET   │
│  (ACR)          │  │  • R2 credentials      │
│  Docker images  │  │  • Azure API keys      │
└─────────────────┘  └────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐  ┌───────────┐  ┌──────────────┐
              │ MongoDB  │  │ Cloudflare │  │ Azure        │
              │ Atlas    │  │ R2         │  │ Speech/       │
              │ (M0)    │  │ Storage    │  │ Translator    │
              └──────────┘  └───────────┘  └──────────────┘
```

## Prerequisites

### Required Tools

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| Azure CLI | ≥ 2.50 | Deploy infrastructure | `winget install Microsoft.AzureCLI` |
| Docker | ≥ 24 | Build images locally | `winget install Docker.DockerDesktop` |
| Bicep | (auto) | IaC deployment | Included in Azure CLI |

### Azure Account Setup

1. **Create Azure for Students account** at [azure.microsoft.com/free/students](https://azure.microsoft.com/free/students)
2. **Get $100 credit** — valid for 12 months
3. **Enable required resource providers:**

```bash
az login --use-device-code
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.ManagedIdentity
```

## Quick Start

### Option A: One-Click Deploy (Recommended)

```powershell
# 1. Clone and navigate
cd E:\Hanflix\azure

# 2. Run deployment script (Windows)
.\deploy.ps1 -ResourcePrefix "hanflix" -Location "southeastasia"

# 3. Follow prompts to enter secrets
# 4. Wait ~5 minutes for deployment
# 5. Get backend URL from output
```

### Option B: Manual Deploy via Azure Portal

1. Create Resource Group: `rg-hanflix`
2. Deploy from Azure Portal → Create a resource → Search "Container App"
3. Fill in settings manually
4. Set secrets in Key Vault after creation

---

## Step-by-Step Deployment

### Step 1: Set Up GitHub Secrets

Add these secrets to your GitHub repository (`Settings → Secrets and variables → Actions`):

| Secret Name | Value | Where to Get |
|-------------|-------|--------------|
| `AZURE_CLIENT_ID` | Application (client) ID | Azure AD → App registrations |
| `AZURE_TENANT_ID` | Directory (tenant) ID | Azure AD → Overview |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID | Azure Portal → Subscriptions |
| `AZURE_MONGODB_URI` | MongoDB connection string | MongoDB Atlas → Connect |
| `AZURE_JWT_ACCESS_SECRET` | JWT access secret (min 32 chars) | Generate locally |
| `AZURE_JWT_REFRESH_SECRET` | JWT refresh secret (min 32 chars) | Generate locally |
| `AZURE_GEMINI_API_KEY` | Gemini API key | Google AI Studio |
| `AZURE_TRANSLATOR_KEY` | Azure Translator key | Azure Cognitive Services |
| `AZURE_SPEECH_KEY` | Azure Speech key | Azure Cognitive Services |
| `AZURE_R2_ACCOUNT_ID` | Cloudflare R2 account ID | Cloudflare Dashboard |
| `AZURE_R2_ACCESS_KEY_ID` | Cloudflare R2 access key ID | Cloudflare R2 → Manage API Keys |
| `AZURE_R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key | Cloudflare R2 → Manage API Keys |
| `AZURE_R2_BUCKET_NAME` | Cloudflare R2 bucket name | Cloudflare R2 → Buckets |

> **Generate JWT secrets locally:**
> ```powershell
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Step 2: Create Azure AD Application (Service Principal)

This creates the identity GitHub Actions uses to deploy:

```bash
# Log in to Azure
az login --use-device-code

# Create AD application
az ad app create \
  --display-name "HanFlix GitHub Actions" \
  --sign-audiences api://AzureADTokenExchange \
  --enable-id-token-issuance

# Get the app ID (this is AZURE_CLIENT_ID)
APP_ID=$(az ad app list --display-name "HanFlix GitHub Actions" --query "[0].appId" -o tsv)

# Create service principal with Contributor role
az ad sp create-for-rbac \
  --id "$APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/$(az account show --query id -o tsv)"

# Note: AZURE_CLIENT_ID = appId, AZURE_TENANT_ID = tenant from az account show
```

### Step 3: Configure GitHub Environment (Optional)

For production deployments, create a GitHub environment:

1. Go to `Settings → Environments`
2. Create `production` environment
3. Add required reviewers (optional)
4. Set environment secrets

### Step 4: Trigger Deployment

#### Via Git Tag (Production Release)

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers:
1. Build Docker image
2. Push to GHCR
3. Deploy to production Azure Container Apps
4. Health check verification

#### Via GitHub Actions (Manual)

1. Go to `Actions → Deploy to Azure → Run workflow`
2. Select `production` or `staging`
3. Optionally specify Docker image URL
4. Click `Run workflow`

#### Via Local Script

```powershell
# Staging deploy
.\deploy.ps1 -ResourcePrefix "hf-staging"

# Production deploy (after confirming staging works)
.\deploy.ps1 -ResourcePrefix "hanflix" -DockerImage "myacr.azurecr.io/hanflix-backend:v1.0.0"
```

---

## Infrastructure Details

### Resources Created

| Resource | Type | Purpose | Cost |
|----------|------|---------|------|
| `hanflixacr*` | Container Registry | Docker image storage | ~$0/free tier |
| `hanflixkv*` | Key Vault | Secrets management | ~$0/free tier |
| `hanflixlogs*` | Log Analytics | Centralized logging | ~$0/free tier |
| `hanflixenv*` | Container Apps Environment | Hosting runtime | ~$5-15/month |
| `hanflixbackend` | Container App | Backend API | included in env |
| `hanflixmid*` | Managed Identity | Secure auth | free |

### Scaling Configuration

| Metric | Min | Max | Threshold |
|--------|-----|-----|-----------|
| HTTP requests | 1 | 3 | 100 concurrent |
| CPU | 1 | 3 | 70% utilization |
| Memory | 1 | 3 | 80% utilization |

### Resource Limits

| Setting | Value | Reason |
|---------|-------|--------|
| CPU | 0.5 cores | Free tier friendly |
| Memory | 1.0 GB | Sufficient for API + worker |
| Min replicas | 1 | Always-on, no cold start |
| Max replicas | 3 | Cost control |

---

## Secrets Management

### Key Vault Secrets

All secrets are stored in Azure Key Vault, never in code or Container App config:

```
Key Vault: hanflixkv<unique-suffix>
├── MONGODB-URI              (required)
├── JWT-ACCESS-SECRET        (required)
├── JWT-REFRESH-SECRET       (required)
├── GEMINI-API-KEY           (optional)
├── AZURE-TRANSLATOR-KEY     (optional)
├── AZURE-TRANSLATOR-REGION  (optional)
├── AZURE-SPEECH-KEY         (optional)
├── AZURE-SPEECH-REGION      (optional)
├── R2-ACCOUNT-ID            (optional)
├── R2-ACCESS-KEY-ID         (optional)
├── R2-SECRET-ACCESS-KEY     (optional)
├── R2-BUCKET-NAME           (optional)
└── R2-ENDPOINT              (optional)
```

### Setting Secrets After Deployment

```bash
# Via Azure CLI
az keyvault secret set \
  --vault-name "hanflixkv<suffix>" \
  --name "MONGODB-URI" \
  --value "mongodb+srv://..."

# Via GitHub Actions (automated)
# Just add to GitHub Secrets and trigger redeploy
```

### Rotating Secrets

```powershell
# 1. Update secret in Key Vault
az keyvault secret set --vault-name "hanflixkv..." --name "JWT-ACCESS-SECRET" --value "new-secret"

# 2. Restart Container App to pick up new secret
az containerapp revision restart \
  --name "hanflixbackend" \
  --resource-group "rg-hanflix"

# 3. Verify health
curl https://your-backend.azurecontainerapps.io/health
```

---

## Post-Deployment Verification

### Health Check

```bash
# Via curl
curl https://your-backend.azurecontainerapps.io/health

# Expected: {"status":"ok","timestamp":"..."}

# Via Azure CLI
az containerapp show \
  --name "hanflixbackend" \
  --resource-group "rg-hanflix" \
  --query "properties.latestRevisionFqdn"
```

### View Logs

```bash
# Real-time logs
az containerapp logs --name "hanflixbackend" --resource-group "rg-hanflix" -f

# Last 100 lines
az containerapp logs --name "hanflixbackend" --resource-group "rg-hanflix" --tail 100

# Query Log Analytics
az monitor log-analytics query \
  --workspace "$(az monitor log-analytics workspace list -g rg-hanflix --query '[0].customerId' -o tsv)" \
  --analytics-query "ContainerAppConsoleLogs_CL | where TimeGenerated > ago(1h) | order by TimeGenerated desc"
```

### Test API Endpoints

```bash
# Get token (requires existing user)
curl -X POST https://your-backend.azurecontainerapps.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"..."}'

# Test notification endpoint
curl https://your-backend.azurecontainerapps.io/api/v1/notifications/unread-count \
  -H "Authorization: Bearer <token>"
```

---

## Troubleshooting

### Container App Fails to Start

```bash
# 1. Check logs
az containerapp logs --name "hanflixbackend" --resource-group "rg-hanflix" -f

# 2. Common issues:

# Missing secrets in Key Vault
# → Check Key Vault has all required secrets
az keyvault secret list --vault-name "hanflixkv<suffix>"

# MongoDB connection failure
# → Check MONGODB_URI is correct and IP whitelist includes Azure
# → Atlas: Network Access → Allow Azure IP ranges

# Image pull failure
# → Check Managed Identity has AcrPull role on ACR
# → Verify image exists in ACR
az acr repository show --name "hanflixacr<suffix>" --image "hanflix-backend:latest"
```

### Out of Memory / High CPU

```bash
# Scale up temporarily
az containerapp update \
  --name "hanflixbackend" \
  --resource-group "rg-hanflix" \
  --min-replicas 1 \
  --max-replicas 5

# Or increase resources (costs more)
# Update main.bicep: cpuCoreCount="1.0", memoryGb="2.0"
```

### Deployment Pipeline Fails

```bash
# 1. Check Azure login in GitHub Actions
# → Verify AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID are correct
# → Ensure Service Principal has Contributor role on the subscription

# 2. Check Bicep deployment
# → Run locally with Azure CLI to verify templates work
az deployment group validate \
  --resource-group "rg-hanflix" \
  --template-file azure/main.bicep \
  --parameters azure/main.parameters.json

# 3. Check ACR image push
# → Ensure GitHub Actions can log in to ACR
# → Check Azure login step uses correct subscription
```

### Azure Free Tier Limits Reached

```bash
# Check usage
az monitor metrics list \
  --resource "/subscriptions/.../containerAppEnvironments/hanflixenv..." \
  --metric "CpuUsage,MemoryUsage" \
  --interval PT1H

# If Log Analytics free tier (5GB) is full:
# → Reduce retention period
# → Or upgrade to Pay-as-you-go
```

---

## Updating the Deployment

### Redeploy with New Image

```bash
# Via GitHub Actions
# Go to Actions → Deploy to Azure → Run workflow
# Enter Docker image URL

# Via Azure CLI
az containerapp update \
  --name "hanflixbackend" \
  --resource-group "rg-hanflix" \
  --image "youracr.azurecr.io/hanflix-backend:v1.2.0"
```

### Update Infrastructure (Bicep)

```bash
# Validate changes
az deployment group validate \
  --resource-group "rg-hanflix" \
  --template-file azure/main.bicep \
  --parameters azure/main.parameters.json

# Deploy changes (incremental)
az deployment group create \
  --resource-group "rg-hanflix" \
  --name "hanflix-update-$(date +%Y%m%d)" \
  --template-file azure/main.bicep \
  --parameters azure/main.parameters.json \
  --parameters resourcePrefix=hanflix
```

### Add New Secrets

```bash
# 1. Add secret to Key Vault
az keyvault secret set \
  --vault-name "hanflixkv<suffix>" \
  --name "NEW-SECRET" \
  --value "secret-value"

# 2. Add to container-app.bicep secrets array
# (edit azure/modules/container-app.bicep, add new secretRef)

# 3. Redeploy infrastructure
az deployment group create ...
```

---

## Cost Optimization Tips

1. **Use embedded worker mode** — single container, no separate worker cost
2. **Set max replicas to 2** for staging — saves ~$5/month
3. **Disable logging** if not needed — saves Log Analytics storage
4. **Use free tier for all services** — ACR, Key Vault, Log Analytics all have free tiers
5. **Monitor usage** — Azure Portal → Cost Management
6. **Set budget alerts** — Azure Portal → Cost Management → Budgets

---

## Security Checklist

- [ ] Managed Identity used (no ACR admin credentials)
- [ ] Key Vault RBAC enabled (no access policies)
- [ ] HTTPS only (Container Apps enforces by default)
- [ ] No secrets in environment variables (all in Key Vault)
- [ ] CORS configured to specific origins (not `*` in production)
- [ ] COOKIE_SECURE=true in production
- [ ] JWT secrets are different for access and refresh
- [ ] MongoDB TLS enforced (MONGODB_TLS=true)
- [ ] Azure AD Service Principal with minimal permissions (Contributor on RG only)

---

## File Structure

```
E:\Hanflix\
├── azure\                          # Azure deployment files
│   ├── main.bicep                  # Main infrastructure template
│   ├── main.parameters.json         # Default parameters
│   ├── deploy.ps1                  # PowerShell deployment script
│   ├── deploy.sh                   # Bash deployment script
│   └── modules\                   # Bicep modules
│       ├── acr.bicep              # Container Registry
│       ├── keyvault.bicep         # Key Vault
│       ├── loganalytics.bicep     # Log Analytics
│       ├── container-app-environment.bicep
│       └── container-app.bicep    # Container App
│
├── .github\workflows\
│   ├── deploy-azure.yml           # Azure deployment pipeline
│   ├── release.yml                # Release pipeline (existing)
│   └── ci-backend.yml             # CI pipeline (existing)
│
└── backend\
    ├── Dockerfile                 # Multi-stage Docker build
    ├── .env.production.azure      # Production env reference
    └── .env.example               # Local dev reference
```

---

## Support

- **Azure Container Apps docs**: https://docs.microsoft.com/azure/container-apps/
- **Bicep documentation**: https://docs.microsoft.com/azure/azure-resource-manager/bicep/
- **Azure for Students**: https://azure.microsoft.com/free/students
- **Log Analytics query**: https://docs.microsoft.com/azure/azure-monitor/logs/log-analytics-tutorial
