// ============================================================
// Azure Key Vault Module
// ============================================================
// Stores all sensitive configuration: MongoDB URI, JWT secrets,
// R2 credentials, Azure API keys, Gemini API key.
// Access via Managed Identity (no connection strings stored in code).
//
// RBAC model:
//   • Key Vault Secrets Officer — for deployments that SET secrets
//   • Key Vault Secrets User — for Container Apps that READ secrets
//
// Free tier: 10,000 secret operations/month
// ============================================================

@description('Azure region')
param location string

@description('Key Vault name')
@maxLength(24)
param kvName string


@description('User-Assigned Managed Identity resource ID')
param managedIdentityId string

@description('User-Assigned Managed Identity Principal ID (GUID). Used for role assignments.')
param managedIdentityPrincipalId string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard' // Free tier: 10K secrets ops, 50 ACLs
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true // RBAC, not access policies
    enableSoftDelete: true
    // enablePurgeProtection omitted: Azure requires it to be true (and immutable)
    // for new vaults. Default is true since 2024 — explicitly omitting it removes
    // the terminal "BadRequest: cannot set enablePurgeProtection to false" error.
    publicNetworkAccess: 'Enabled'
  }
}

// Role: Key Vault Secrets User — Container App reads secrets at runtime
resource secretsUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, managedIdentityPrincipalId, 'secretsuser')
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output keyVaultId string = kv.id
output keyVaultUri string = kv.properties.vaultUri
output keyVaultName string = kv.name
