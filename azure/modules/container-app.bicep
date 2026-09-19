// ============================================================
// Azure Container App Module (Backend)
// ============================================================
// Runs the HanFlix Express API with embedded video-processing worker.
//
// Security:
//   • Pulls images via Managed Identity (no ACR admin credentials)
//   • Secrets read from Key Vault at runtime via keyVaultRef
//   • HTTPS only, external ingress
//   • No secrets in environment variables (Key Vault references)
//
// Scaling:
//   • HTTP scaling: 1-3 replicas based on request count
//   • CPU scaling: scale out when CPU > 70%
//   • Memory scaling: scale out when memory > 80%
// ============================================================

@description('Azure region')
param location string

@description('Container App name')
param containerAppName string

@description('Container Apps environment name')
param containerAppsEnvName string

@description('Full Docker image URL (e.g. myacr.azurecr.io/hanflix-backend:v1.0.0)')
param dockerImage string

@description('ACR login server')
param acrLoginServer string

@description('User-Assigned Managed Identity resource ID')
param managedIdentityId string

@description('NODE_ENV')
@allowed(['production', 'development'])
param nodeEnv string = 'production'

@description('Min replicas')
param minReplicas int = 1

@description('Max replicas')
param maxReplicas int = 3

@description('CPU cores (as string: "0.25", "0.5", "1.0", "2.0")')
param cpuCoreCount string = '0.5'

@description('Memory GB (as string: "0.5", "1.0", "2.0")')
param memoryGb string = '1.0'

@description('Health check HTTP path')
param healthCheckPath string = '/health'

@description('Comma-separated CORS allowed origins')
param allowedOrigins string = ''

@description('Key Vault URI')
param keyVaultUri string

@description('Key Vault name')
param keyVaultName string

// The Container App uses the User-Assigned Managed Identity
// Role AcrPull is already assigned in acr.bicep
// Secrets are read from Key Vault via secretRef

// ---------- Container App ----------
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvId
    configuration: {
      registries: [
        {
          server: acrLoginServer
          identity: managedIdentityId
        }
      ]
      ingress: {
        external: true
        targetPort: 4000
        transport: 'http'
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      secrets: [
        // All secrets read from Key Vault — NOT stored in Container App config
        {
          name: 'mongodb-uri'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/MONGODB-URI'
          identity: managedIdentityId
        }
        {
          name: 'jwt-access-secret'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/JWT-ACCESS-SECRET'
          identity: managedIdentityId
        }
        {
          name: 'jwt-refresh-secret'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/JWT-REFRESH-SECRET'
          identity: managedIdentityId
        }
        {
          name: 'gemini-api-key'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/GEMINI-API-KEY'
          identity: managedIdentityId
        }
        {
          name: 'azure-translator-key'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/AZURE-TRANSLATOR-KEY'
          identity: managedIdentityId
        }
        {
          name: 'azure-speech-key'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/AZURE-SPEECH-KEY'
          identity: managedIdentityId
        }
        {
          name: 'r2-access-key-id'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/R2-ACCESS-KEY-ID'
          identity: managedIdentityId
        }
        {
          name: 'r2-secret-access-key'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/R2-SECRET-ACCESS-KEY'
          identity: managedIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'hanflix-backend'
          image: dockerImage
          resources: {
            cpu: json('"${cpuCoreCount}"')
            memory: '${memoryGb}Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: nodeEnv
            }
            {
              name: 'PORT'
              value: '4000'
            }
            // Required: Key Vault secrets via secretRef
            {
              name: 'MONGODB_URI'
              secretRef: 'mongodb-uri'
            }
            {
              name: 'MONGODB_TLS'
              value: 'true'
            }
            {
              name: 'JWT_ACCESS_SECRET'
              secretRef: 'jwt-access-secret'
            }
            {
              name: 'JWT_REFRESH_SECRET'
              secretRef: 'jwt-refresh-secret'
            }
            // Optional: Key Vault secrets
            {
              name: 'GEMINI_API_KEY'
              secretRef: 'gemini-api-key'
            }
            {
              name: 'AZURE_TRANSLATOR_KEY'
              secretRef: 'azure-translator-key'
            }
            {
              name: 'AZURE_SPEECH_KEY'
              secretRef: 'azure-speech-key'
            }
            {
              name: 'R2_ACCESS_KEY_ID'
              secretRef: 'r2-access-key-id'
            }
            {
              name: 'R2_SECRET_ACCESS_KEY'
              secretRef: 'r2-secret-access-key'
            }
            // Non-secret config
            {
              name: 'GEMINI_MODEL'
              value: 'gemini-3.5-flash-lite'
            }
            {
              name: 'GEMINI_TIMEOUT_MS'
              value: '15000'
            }
            {
              name: 'GEMINI_TRANSLATION_IMPROVE_ENABLED'
              value: 'true'
            }
            {
              name: 'AZURE_TRANSLATOR_REGION'
              value: 'southeastasia'
            }
            {
              name: 'AZURE_SPEECH_REGION'
              value: 'southeastasia'
            }
            {
              name: 'R2_ENDPOINT'
              value: '' // Set via Key Vault in production
            }
            {
              name: 'R2_BUCKET_NAME'
              value: '' // Set via Key Vault in production
            }
            {
              name: 'R2_ACCOUNT_ID'
              value: '' // Set via Key Vault in production
            }
            {
              name: 'R2_PUBLIC_BASE_URL'
              value: '' // Set via Key Vault in production
            }
            {
              name: 'PLAYBACK_DERIVATIVE_ENABLED'
              value: 'true'
            }
            {
              name: 'PLAYBACK_DERIVATIVE_MAX_HEIGHT'
              value: '720'
            }
            {
              name: 'VIDEO_WORKER_MODE'
              value: 'embedded'
            }
            {
              name: 'VIDEO_PROCESSING_MAX_RETRIES'
              value: '3'
            }
            {
              name: 'APP_ORIGINS'
              value: allowedOrigins
            }
            {
              name: 'COOKIE_SECURE'
              value: nodeEnv == 'production' ? 'true' : 'false'
            }
            {
              name: 'DISABLE_TRANSACTIONS'
              value: 'false'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: healthCheckPath
                port: 4000
                scheme: 'HTTPS'
              }
              initialDelaySeconds: 15
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: healthCheckPath
                port: 4000
                scheme: 'HTTPS'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
          {
            name: 'cpu-scaling'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '70'
              }
            }
          }
          {
            name: 'memory-scaling'
            custom: {
              type: 'memory'
              metadata: {
                type: 'Utilization'
                value: '80'
              }
            }
          }
        ]
      }
    }
  }
}

// Helper: reference the container apps env ID
var containerAppsEnvId = resourceId('Microsoft.App/managedEnvironments', containerAppsEnvName)

// ---------- Outputs ----------
output fqdn string = containerApp.properties.configuration.ingress.fqdn
output backendUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
