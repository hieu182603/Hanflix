// ============================================================
// HanFlix Azure Infrastructure — Main Entry Point
// ============================================================
// Deploys:
//   • Azure Container Registry (ACR) — stores Docker images
//   • Azure Container Apps Environment — hosting runtime
//   • Container App: hanflix-backend — Express API + embedded worker
//   • Log Analytics Workspace — centralized logging
//   • User-Assigned Managed Identity — access ACR + Key Vault
//   • Key Vault — secrets (DB, API keys, R2 credentials)
//
// Usage:
//   az deployment sub create \
//     --location southeastasia \
//     --template-file azure/main.bicep \
//     --parameters azure/main.parameters.json
// ============================================================

targetScope = 'resourceGroup'

// ---------- Parameters ----------
@description('Unique prefix for all resources (e.g. hanflix, hf-staging). Max 15 chars, lowercase.')
param resourcePrefix string = 'hanflix'

@description('Azure region for all resources.')
param location string = 'southeastasia'

@description('Docker image for backend (e.g. myacr.azurecr.io/hanflix-backend:v1.0.0)')
param dockerImage string = ''

@description('NODE_ENV: production or development')
@allowed(['production', 'development'])
param nodeEnv string = 'production'

@description('Minimum replica count for backend. Set 0 to scale-to-zero (no cost when idle; cold start ~5-10s on first request).')
param minReplicas int = 0

@description('Maximum replica count for backend')
param maxReplicas int = 3

@description('CPU cores per replica')
@allowed(['0.25', '0.5', '1.0', '2.0'])
param cpuCoreCount string = '0.5'

@description('Memory (GB) per replica')
@allowed(['0.5', '1.0', '2.0'])
param memoryGb string = '1.0'

@description('Health check HTTP endpoint path')
param healthCheckPath string = '/health'

@description('Comma-separated CORS allowed origins')
param allowedOrigins string = ''

@description('Public URL of the frontend (must be HTTPS in production)')
param appPublicUrl string = 'https://app.hanflix.vn'

@description('Azure Translator region (e.g. japaneast, southeastasia)')
param azureTranslatorRegion string = 'japaneast'

@description('Azure Speech region (e.g. japaneast, southeastasia)')
param azureSpeechRegion string = 'japaneast'

@description('When true, the container app binds to Key Vault secret refs at provisioning. Set true only after secrets are populated.')
param secretsReady bool = false

@description('GitHub Container Registry username (used to pull image from ghcr.io).')
@secure()
param ghcrUsername string = ''

@description('GitHub Container Registry personal access token (scope: read:packages or write:packages).')
@secure()
param ghcrToken string = ''

// ---------- Variables ----------
var suffix = uniqueString(resourceGroup().id)
var kvName = '${replace(resourcePrefix, '-', '')}kv${suffix}'
var logAnalyticsName = '${resourcePrefix}logs${suffix}'
var containerAppsEnvName = '${resourcePrefix}env${suffix}'
var backendAppName = '${resourcePrefix}backend'
var managedIdName = '${resourcePrefix}mid'
var backendFqdn = '${backendAppName}.${location}.azurecontainerapps.io'

// ---------- User-Assigned Managed Identity ----------
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdName
  location: location
}

// ---------- Modules ----------
// ACR is intentionally excluded from this template — we use GitHub Container
// Registry (GHCR) instead for $0 storage. The pre-existing ACR resource
// remains in the resource group but is no longer managed here. Delete it
// manually after verifying GHCR works:
//   az acr delete -n <acrName> -g <rg> -y
module kv 'modules/keyvault.bicep' = {
  name: 'kv-deployment'
  params: {
    location: location
    kvName: kvName
    managedIdentityId: managedIdentity.id
    managedIdentityPrincipalId: managedIdentity.properties.principalId
  }
}

module logAnalytics 'modules/loganalytics.bicep' = {
  name: 'loganalytics-deployment'
  params: {
    location: location
    logAnalyticsName: logAnalyticsName
  }
}

module containerAppEnv 'modules/container-app-environment.bicep' = {
  name: 'container-app-env-deployment'
  params: {
    location: location
    containerAppsEnvName: containerAppsEnvName
    logAnalyticsWorkspaceId: logAnalytics.outputs.logAnalyticsId
    logAnalyticsSharedKey: logAnalytics.outputs.logAnalyticsKey
  }
}

module backendApp 'modules/container-app.bicep' = {
  name: 'backend-app-deployment'
  params: {
    location: location
    containerAppName: backendAppName
    containerAppsEnvName: containerAppsEnvName
    containerAppsEnvResourceId: containerAppEnv.outputs.containerAppEnvId
    dockerImage: dockerImage
    managedIdentityId: managedIdentity.id
    nodeEnv: nodeEnv
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    cpuCoreCount: cpuCoreCount
    memoryGb: memoryGb
    healthCheckPath: healthCheckPath
    allowedOrigins: allowedOrigins
    appPublicUrl: appPublicUrl
    azureTranslatorRegion: azureTranslatorRegion
    azureSpeechRegion: azureSpeechRegion
    keyVaultName: kvName
    secretsReady: secretsReady
    ghcrUsername: ghcrUsername
    ghcrToken: ghcrToken
  }
}

// ---------- Outputs ----------
output backendUrl string = 'https://${backendFqdn}'
output backendFqdn string = backendFqdn
output keyVaultName string = kvName
output keyVaultUri string = kv.outputs.keyVaultUri
output containerAppEnvId string = containerAppEnv.outputs.containerAppEnvId
output resourceGroup string = resourceGroup().name
