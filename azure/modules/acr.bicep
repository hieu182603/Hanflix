// ============================================================
// Azure Container Registry (ACR) Module
// ============================================================
// Stores Docker images for HanFlix backend and frontend.
// Managed Identity used for ACR pull (no username/password needed).
// ============================================================

@description('Azure region')
param location string

@description('ACR registry name')
@maxLength(50)
param acrName string

@description('User-Assigned Managed Identity resource ID')
param managedIdentityId string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic' // Free tier: 2 GiB storage, 10 webhooks
  }
  properties: {
    adminUserEnabled: false // Security: use Managed Identity, not admin user
    publicNetworkAccess: 'Enabled'
    networkRuleSet: {
      defaultAction: 'Allow' // Restrict via firewall rules in production
    }
  }
}

// Role Assignment: let Managed Identity pull images from ACR
resource acrPullRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, managedIdentityId, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: managedIdentityId
    principalType: 'ServicePrincipal'
  }
}

output acrId string = acr.id
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
