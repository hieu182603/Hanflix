#!/usr/bin/env bash
# ============================================================
# HanFlix Backend — Azure Deployment Script (Bash)
# ============================================================
# Full workflow:
#   1. Azure login
#   2. Resource group creation
#   3. Bicep infrastructure deployment
#   4. Docker image build + push to ACR
#   5. Key Vault secrets configuration
#   6. Container App update
#   7. Health check verification
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh [--resource-prefix hanflix] [--location southeastasia] \
#       [--docker-image "myacr.azurecr.io/hanflix-backend:v1.0.0"] \
#       [--skip-image-build] [--skip-secrets] [--skip-infra]
# ============================================================

set -euo pipefail

# ---- Defaults ----
RESOURCE_PREFIX="hanflix"
LOCATION="southeastasia"
DOCKER_IMAGE=""
SKIP_IMAGE_BUILD=false
SKIP_SECRETS=false
SKIP_INFRA=false

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# ---- Helpers ----
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }

# ---- Parse arguments ----
while [[ $# -gt 0 ]]; do
  case $1 in
    --resource-prefix)  RESOURCE_PREFIX="$2"; shift 2 ;;
    --location)          LOCATION="$2"; shift 2 ;;
    --docker-image)      DOCKER_IMAGE="$2"; shift 2 ;;
    --skip-image-build)  SKIP_IMAGE_BUILD=true; shift ;;
    --skip-secrets)      SKIP_SECRETS=true; shift ;;
    --skip-infra)        SKIP_INFRA=true; shift ;;
    *)                   fail "Unknown option: $1" ;;
  esac
done

RG_NAME="rg-$RESOURCE_PREFIX"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- Banner ----
echo ""
echo -e "${MAGENTA}══════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}  HanFlix Backend — Azure Deployment${NC}"
echo -e "${MAGENTA}══════════════════════════════════════════════════${NC}"
echo ""

# ============================================================
# STEP 1: Prerequisites
# ============================================================
echo -e "-- ${CYAN}Checking prerequisites${NC} ──────────────────────────"

command -v az   >/dev/null 2>&1 || fail "Azure CLI (az) not found. Install: https://docs.microsoft.com/cli/azure/install-azure-cli"
command -v jq   >/dev/null 2>&1 || fail "jq not found. Install: https://stedolan.github.io/jq/"
command -v docker>/dev/null 2>&1 || warn "Docker not found. Image build will be skipped."

success "Azure CLI: $(az version --query 'core' -o tsv 2>/dev/null)"

# ============================================================
# STEP 2: Azure Login
# ============================================================
echo ""
echo -e "-- ${CYAN}Step 1: Azure Login${NC} ───────────────────────────"

ACCOUNT_ID=$(az account show --query "id" -o tsv 2>/dev/null) || true
if [[ -z "$ACCOUNT_ID" ]]; then
  info "No Azure session. Opening browser for login..."
  az login --use-device-code
  ACCOUNT_ID=$(az account show --query "id" -o tsv)
fi

SUB_NAME=$(az account show --query "name" -o tsv)
success "Logged in. Subscription: $SUB_NAME"

# ============================================================
# STEP 3: Resource Group
# ============================================================
echo ""
echo -e "-- ${CYAN}Step 2: Resource Group${NC} ───────────────────────"

if ! az group show --name "$RG_NAME" &>/dev/null; then
  info "Creating resource group: $RG_NAME ($LOCATION)"
  az group create --name "$RG_NAME" --location "$LOCATION" --output none
  success "Resource group created"
else
  info "Resource group already exists: $RG_NAME"
fi

# ============================================================
# STEP 4: Infrastructure (Bicep)
# ============================================================
if [[ "$SKIP_INFRA" == "false" ]]; then
  echo ""
  echo -e "-- ${CYAN}Step 3: Deploy Infrastructure (Bicep)${NC} ─────────"

  BICEP_FILE="$SCRIPT_DIR/main.bicep"
  PARAMS_FILE="$SCRIPT_DIR/main.parameters.json"
  [[ -f "$BICEP_FILE" ]] || fail "Bicep file not found: $BICEP_FILE"

  DEPLOY_NAME="hanflix-$(date +%Y%m%d-%H%M%S)"

  info "Deploying Bicep templates..."
  DEPLOY_OUTPUT=$(az deployment group create \
    --resource-group "$RG_NAME" \
    --name "$DEPLOY_NAME" \
    --template-file "$BICEP_FILE" \
    --parameters "@$PARAMS_FILE" \
    --parameters "resourcePrefix=$RESOURCE_PREFIX" \
    --parameters "location=$LOCATION" \
    --parameters "nodeEnv=production" \
    --parameters "allowedOrigins=*" \
    ${DOCKER_IMAGE:+"--parameters dockerImage=$DOCKER_IMAGE"} \
    --output jsonc 2>&1) || fail "Bicep deployment failed"

  ACR_LOGIN_SERVER=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.acrLoginServer.value')
  KEY_VAULT_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.keyVaultName.value')
  BACKEND_FQDN=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.backendFqdn.value')

  success "Infrastructure deployed"
  info "  ACR Login Server: $ACR_LOGIN_SERVER"
  info "  Key Vault:        $KEY_VAULT_NAME"
  info "  Backend URL:      https://$BACKEND_FQDN"
else
  info "Skipping infrastructure deployment"
  DEPLOY_OUTPUT=$(az deployment group list -g "$RG_NAME" \
    --query "sort_by(@,&properties.timestamp)[-1]" -o json 2>/dev/null) || true
  ACR_LOGIN_SERVER=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.acrLoginServer.value // ""')
  KEY_VAULT_NAME=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.keyVaultName.value // ""')
  BACKEND_FQDN=$(echo "$DEPLOY_OUTPUT" | jq -r '.properties.outputs.backendFqdn.value // ""')
fi

# ============================================================
# STEP 5: Docker Image Build & Push
# ============================================================
if [[ "$SKIP_IMAGE_BUILD" == "false" ]] && command -v docker &>/dev/null; then
  echo ""
  echo -e "-- ${CYAN}Step 4: Build & Push Docker Image${NC} ─────────────"

  if [[ -z "$ACR_LOGIN_SERVER" ]]; then
    warn "Cannot determine ACR server. Skipping image push."
  else
    info "Logging in to ACR: $ACR_LOGIN_SERVER"
    az acr login --name "${ACR_LOGIN_SERVER%%.*}" 2>/dev/null || true

    if [[ -z "$DOCKER_IMAGE" ]]; then
      BACKEND_DIR="$(dirname "$SCRIPT_DIR")/backend"
      TAG_VERSION="v$(date +%Y%m%d-%H%M%S)"
      IMAGE_TAG="$ACR_LOGIN_SERVER/hanflix-backend:$TAG_VERSION"
      IMAGE_LATEST="$ACR_LOGIN_SERVER/hanflix-backend:latest"

      info "Building Docker image..."
      docker build -t "$IMAGE_TAG" -t "$IMAGE_LATEST" "$BACKEND_DIR" \
        || fail "Docker build failed"

      success "Docker image built: $IMAGE_TAG"

      info "Pushing to ACR..."
      docker push "$IMAGE_TAG"  || fail "Docker push failed"
      docker push "$IMAGE_LATEST" || warn "Push latest tag failed (non-fatal)"

      success "Image pushed to ACR"
      DOCKER_IMAGE="$IMAGE_TAG"
      info "Use in future: --docker-image '$DOCKER_IMAGE'"
    fi
  fi
fi

# ============================================================
# STEP 6: Key Vault Secrets
# ============================================================
if [[ "$SKIP_SECRETS" == "false" ]]; then
  echo ""
  echo -e "-- ${CYAN}Step 5: Configure Key Vault Secrets${NC} ────────────────"

  if [[ -z "$KEY_VAULT_NAME" ]]; then
    KEY_VAULT_NAME=$(az deployment group list -g "$RG_NAME" \
      --query "sort_by(@,&properties.timestamp)[-1].properties.outputs.keyVaultName.value" -o tsv)
  fi

  [[ -z "$KEY_VAULT_NAME" ]] && fail "Cannot determine Key Vault name"

  info "Key Vault: $KEY_VAULT_NAME"

  # Grant current user access to set secrets
  CURRENT_UPN=$(az ad signed-in-user show --query "userPrincipalName" -o tsv 2>/dev/null) || true
  if [[ -n "$CURRENT_UPN" ]]; then
    az keyvault set-policy \
      --name "$KEY_VAULT_NAME" \
      --upn "$CURRENT_UPN" \
      --secret-permissions list get set delete 2>/dev/null || true
  fi

  echo ""
  echo -e "  ${YELLOW}Enter secrets below. Press Enter to skip optional fields.${NC}"
  echo ""

  # Helper function
  set_secret_if_missing() {
    local NAME="$1"
    local PROMPT="$2"
    local VALUE="$3"

    if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$NAME" &>/dev/null; then
      info "  $NAME: already set (skipping)"
      return
    fi

    if [[ -n "$VALUE" ]]; then
      az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$NAME" --value "$VALUE" --output none
      success "  $NAME: set"
    else
      echo -n "  $NAME: "; read -r -p "($PROMPT) " VALUE
      if [[ -n "$VALUE" ]]; then
        az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$NAME" --value "$VALUE" --output none
        success "  $NAME: set"
      else
        info "  $NAME: skipped"
      fi
    fi
  }

  # Required secrets
  echo -e "  ${CYAN}Required secrets:${NC}"
  set_secret_if_missing "MONGODB-URI" "MongoDB connection string (mongodb+srv://...)" ""
  set_secret_if_missing "JWT-ACCESS-SECRET" "JWT access secret (min 32 chars)" ""
  set_secret_if_missing "JWT-REFRESH-SECRET" "JWT refresh secret (min 32 chars, DIFFERENT from access)" ""

  # Optional secrets
  echo ""
  echo -e "  ${CYAN}Optional secrets (press Enter to skip):${NC}"
  set_secret_if_missing "GEMINI-API-KEY" "Gemini API key" ""
  set_secret_if_missing "AZURE-TRANSLATOR-KEY" "Azure Translator key" ""
  set_secret_if_missing "AZURE-TRANSLATOR-REGION" "Azure Translator region" "southeastasia"
  set_secret_if_missing "AZURE-SPEECH-KEY" "Azure Speech key" ""
  set_secret_if_missing "AZURE-SPEECH-REGION" "Azure Speech region" "southeastasia"
  set_secret_if_missing "R2-ACCOUNT-ID" "Cloudflare R2 account ID" ""
  set_secret_if_missing "R2-ACCESS-KEY-ID" "Cloudflare R2 access key ID" ""
  set_secret_if_missing "R2-SECRET-ACCESS-KEY" "Cloudflare R2 secret access key" ""
  set_secret_if_missing "R2-BUCKET-NAME" "Cloudflare R2 bucket name" ""
  set_secret_if_missing "R2-ENDPOINT" "Cloudflare R2 endpoint (https://...)" ""
  set_secret_if_missing "R2-PUBLIC-BASE-URL" "Cloudflare R2 public base URL" ""
fi

# ============================================================
# STEP 7: Update Container App Image
# ============================================================
if [[ -n "$DOCKER_IMAGE" ]]; then
  echo ""
  echo -e "-- ${CYAN}Step 6: Update Container App Image${NC} ───────────────"

  # Get actual Container App name from outputs
  CONTAINER_APP_NAME=$(az deployment group list -g "$RG_NAME" \
    --query "sort_by(@,&properties.timestamp)[-1].properties.outputs.containerAppName.value" -o tsv 2>/dev/null) || true

  if [[ -z "$CONTAINER_APP_NAME" ]]; then
    # Try to find it by prefix
    CONTAINER_APP_NAME=$(az containerapp list \
      --resource-group "$RG_NAME" \
      --query "[?contains(name,'$RESOURCE_PREFIX')].name" -o tsv 2>/dev/null | awk '{print $1}') || true
  fi

  if [[ -n "$CONTAINER_APP_NAME" ]]; then
    info "Updating Container App: $CONTAINER_APP_NAME"
    az containerapp update \
      --name "$CONTAINER_APP_NAME" \
      --resource-group "$RG_NAME" \
      --image "$DOCKER_IMAGE" \
      --output none 2>&1 && success "Container App updated" \
      || warn "Update failed. Try redeploying with --docker-image flag."
  fi
fi

# ============================================================
# STEP 8: Health Check
# ============================================================
echo ""
echo -e "-- ${CYAN}Step 7: Verifying Deployment${NC} ─────────────────────"

if [[ -z "$BACKEND_FQDN" ]]; then
  BACKEND_FQDN=$(az deployment group list -g "$RG_NAME" \
    --query "sort_by(@,&properties.timestamp)[-1].properties.outputs.backendFqdn.value" -o tsv 2>/dev/null) || true
fi

if [[ -n "$BACKEND_FQDN" ]]; then
  sleep 10
  HEALTH_URL="https://$BACKEND_FQDN/health"
  info "Checking health endpoint: $HEALTH_URL"

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$HEALTH_URL" 2>/dev/null) || HTTP_STATUS="000"
  if [[ "$HTTP_STATUS" == "200" ]]; then
    success "Backend is healthy! Status: $HTTP_STATUS"
  else
    warn "Backend responded with status: $HTTP_STATUS"
    info "Check logs: az containerapp logs --name $CONTAINER_APP_NAME --resource-group $RG_NAME -f"
  fi
else
  warn "Cannot determine backend FQDN. Check Azure Portal."
fi

# ============================================================
# DONE
# ============================================================
echo ""
echo -e "${MAGENTA}══════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA}  Deployment Complete!${NC}"
echo -e "${MAGENTA}══════════════════════════════════════════════════${NC}"
echo ""
[[ -n "$BACKEND_FQDN" ]] && echo -e "  ${GREEN}Backend URL:${NC}    https://$BACKEND_FQDN"
[[ -n "$ACR_LOGIN_SERVER" ]] && echo -e "  ${GREEN}ACR Server:${NC}     $ACR_LOGIN_SERVER"
echo -e "  ${GREEN}Resource Group:${NC} $RG_NAME"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo "    View logs:     az containerapp logs --name $CONTAINER_APP_NAME --resource-group $RG_NAME -f"
echo "    Restart:      az containerapp revision restart --name $CONTAINER_APP_NAME --resource-group $RG_NAME"
echo "    Redeploy:     ./deploy.sh --resource-prefix $RESOURCE_PREFIX --docker-image '$DOCKER_IMAGE' --skip-image-build --skip-secrets"
echo ""
