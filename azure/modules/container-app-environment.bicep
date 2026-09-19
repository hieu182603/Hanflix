// ============================================================
// Container App Environment Module
// ============================================================
// Managed environment for Azure Container Apps.
// Uses internal ingress (no public IP) for security.
// Log Analytics integration for centralized logging.
//
// Note: No vnet/zone-redundancy for free-tier student subscription.
// Add vnet integration for production workloads.
// ============================================================

@description('Azure region')
param location string

@description('Container Apps environment name')
param containerAppsEnvName string

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceId string

@description('Log Analytics shared key')
@secure()
param logAnalyticsSharedKey string

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2022-10-01').customerId
        sharedKey: logAnalyticsSharedKey
      }
    }
    zoneRedundant: false // Disable for cost savings on free tier
  }
}

output containerAppEnvId string = containerAppsEnv.id
output containerAppEnvName string = containerAppsEnv.name
