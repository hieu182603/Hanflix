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
      // Azure for Students / many subscriptions reject 'Free'/'Standard'/'Premium'.
      // Use 'PerGB2018' (Pay-as-you-go, charged per GB ingested).
      name: 'PerGB2018'
    }
    retentionInDays: 30
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
