// ============================================================
// Log Analytics Workspace Module
// ============================================================
// Centralized logging for all Azure Container Apps.
// Free tier: 5 GB ingestion/month, 30-day retention (fixed, not configurable).
//
// Query logs with KQL:
//   ContainerAppConsoleLogs_CL  — container stdout/stderr
//   AppTraces_CL               — application traces
// ============================================================

@description('Azure region')
param location string

@description('Log Analytics workspace name')
param logAnalyticsName string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'Free' // Free tier: 5GB/month, 30-day retention (fixed)
    }
    // Note: retentionInDays is NOT configurable on Free tier
    features: {
      searchVersion: 2
      legacy: 0
    }
  }
}

// Shared key for Container Apps to configure diagnostics
var sharedKeys = logAnalytics.listKeys()

output logAnalyticsId string = logAnalytics.id
output logAnalyticsKey string = sharedKeys.primarySharedKey
output logAnalyticsWorkspace string = logAnalytics.properties.customerId
