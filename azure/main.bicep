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

@description('Minimum replica count for backend')
param minReplicas int = 1

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

// ---------- Variables ----------
var suffix = uniqueString(resourceGroup().id)
var acrName = '${resourcePrefix}acr${suffix}'
var acrLoginServerVal = '${acrName}.azurecr.io'
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
module acr 'modules/acr.bicep' = {
  name: 'acr-deployment'
  params: {
    location: location
    acrName: acrName
    managedIdentityId: managedIdentity.id
  }
}

module kv 'modules/keyvault.bicep' = {
  name: 'kv-deployment'
  params: {
    location: location
    kvName: kvName
    resourcePrefix: resourcePrefix
    managedIdentityId: managedIdentity.properties.principalId
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
    dockerImage: dockerImage
    acrLoginServer: acrLoginServerVal
    managedIdentityId: managedIdentity.id
    nodeEnv: nodeEnv
    minReplicas: minReplicas
    maxReplicas: maxReplicas
    cpuCoreCount: cpuCoreCount
    memoryGb: memoryGb
    healthCheckPath: healthCheckPath
    allowedOrigins: allowedOrigins
    keyVaultUri: kv.outputs.keyVaultUri
    keyVaultName: kvName
  }
}

// ---------- Outputs ----------
output acrLoginServer string = acrLoginServerVal
output acrName string = acrName
output backendUrl string = 'https://${backendFqdn}'
output backendFqdn string = backendFqdn
output keyVaultName string = kvName
output keyVaultUri string = kv.outputs.keyVaultUri
output containerAppEnvId string = containerAppEnv.outputs.containerAppEnvId
output resourceGroup string = resourceGroup().name
