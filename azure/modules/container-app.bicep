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
//   • One replica for the embedded queue worker and bounded compute concurrency.
// ============================================================

@description('Azure region')
param location string

@description('Container App name')
param containerAppName string

@description('Container Apps environment name')
param containerAppsEnvName string

@description('Full Docker image URL (e.g. myacr.azurecr.io/hanflix-backend:v1.0.0)')
param dockerImage string = ''

var defaultImage = 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'
var actualImage = !empty(dockerImage) ? dockerImage : defaultImage

@description('ACR login server. Empty disables ACR pull (use when GHCR is configured).')
param acrLoginServer string = ''

@description('User-Assigned Managed Identity resource ID')
param managedIdentityId string

@description('Client ID used to select the user-assigned identity for ARM Job requests')
param managedIdentityClientId string

@description('NODE_ENV')
@allowed(['production', 'development'])
param nodeEnv string = 'production'

@description('Min replicas. Set to 1 so background queue worker keeps running.')
param minReplicas int = 1

@description('Max replicas')
param maxReplicas int = 1

@description('CPU cores (as string: "0.25", "0.5", "1.0", "2.0")')
param cpuCoreCount string = '0.5'

@description('Memory GB (as string: "0.5", "1.0", "2.0")')
param memoryGb string = '1.0'

@description('Health check HTTP path')
param healthCheckPath string = '/health'

@description('Comma-separated CORS allowed origins')
param allowedOrigins string = ''

@description('Public URL of the frontend (must be HTTPS in production)')
param appPublicUrl string = 'https://app.hanflix.vn'

// SECURITY/HARDENING: explicitly default to the existing MongoDB database name
// so we never try to create a new DB with the wrong case (DatabaseDifferCase).
@description('MongoDB logical database name. Must match the existing DB name on the cluster (case-sensitive).')
param mongodbDbName string = 'Hanflix'

@description('Azure Translator region (e.g. japaneast, southeastasia)')
param azureTranslatorRegion string = 'japaneast'

@description('Azure Speech region (e.g. japaneast, southeastasia)')
param azureSpeechRegion string = 'japaneast'

@description('Key Vault name')
param keyVaultName string

@description('Container Apps environment resource ID. Read from main.bicep to enforce deployment dependency.')
param containerAppsEnvResourceId string

@description('When true, secrets are resolved from Key Vault at provisioning time. When false, placeholder values are used so the app can be deployed before secrets are populated.')
param secretsReady bool = false

@description('GitHub Container Registry username. Empty disables GHCR pull (uses ACR).')
@secure()
param ghcrUsername string = ''

@description('GitHub Container Registry PAT (scope: packages:read). Empty disables GHCR pull.')
@secure()
param ghcrToken string = ''

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
    managedEnvironmentId: containerAppsEnvResourceId
    configuration: {
      registries: empty(ghcrUsername) ? (empty(acrLoginServer) ? [] : [
        {
          server: acrLoginServer
          identity: managedIdentityId
        }
      ]) : [
        // Public GHCR images don't require credentials. When the username is
        // empty we only pass `server`, which makes Container Apps do an
        // anonymous pull. If a username is provided we include credentials
        // for a private registry.
        empty(ghcrUsername) ? { server: 'ghcr.io' } : {
          server: 'ghcr.io'
          username: ghcrUsername
          passwordSecretRef: 'ghcr-token'
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
      // Always include the GHCR PAT secret when GHCR is configured; the
      // `registries` block above references `ghcr-token` and the Container
      // Apps runtime requires the secret to exist in the secrets array.
      secrets: concat(
        empty(ghcrUsername) ? [] : [
          { name: 'ghcr-token', value: ghcrToken }
        ],
        secretsReady ? [
        // ===== Key Vault refs (production secrets) =====
        // Core
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
          name: 'seed-admin-password'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SEED-ADMIN-PASSWORD'
          identity: managedIdentityId
        }
        // Email
        {
          name: 'smtp-host'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SMTP-HOST'
          identity: managedIdentityId
        }
        {
          name: 'smtp-port'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SMTP-PORT'
          identity: managedIdentityId
        }
        {
          name: 'smtp-secure'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SMTP-SECURE'
          identity: managedIdentityId
        }
        {
          name: 'smtp-user'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SMTP-USER'
          identity: managedIdentityId
        }
        {
          name: 'smtp-pass'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SMTP-PASS'
          identity: managedIdentityId
        }
        {
          name: 'smtp-from'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SMTP-FROM'
          identity: managedIdentityId
        }
        // Cloudflare R2
        {
          name: 'r2-account-id'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/R2-ACCOUNT-ID'
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
        {
          name: 'r2-bucket-name'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/R2-BUCKET-NAME'
          identity: managedIdentityId
        }
        {
          name: 'r2-public-base-url'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/R2-PUBLIC-BASE-URL'
          identity: managedIdentityId
        }
        // Google AI
        {
          name: 'gemini-api-key'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/GEMINI-API-KEY'
          identity: managedIdentityId
        }
        // Azure AI
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
        // Google OAuth (optional)
        {
          name: 'google-client-id'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/GOOGLE-CLIENT-ID'
          identity: managedIdentityId
        }
        // Metrics
        {
          name: 'metrics-token'
          keyVaultUrl: 'https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/METRICS-TOKEN'
          identity: managedIdentityId
        }
        // Redis — left empty by default; rate-limit middleware falls back to in-memory
        // when REDIS_URL is unset. Populate Key Vault REDIS-URL later if you need
        // shared counters across multiple replicas, then add the keyVaultUrl block.
      ] : [
        // Dummy placeholder values so the revision can provision before secrets exist.
        // Container Apps requires non-empty values; "" fails preflight validation.
        { name: 'mongodb-uri', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'jwt-access-secret', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'jwt-refresh-secret', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'seed-admin-password', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'smtp-host', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'smtp-port', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'smtp-secure', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'smtp-user', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'smtp-pass', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'smtp-from', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'r2-account-id', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'r2-access-key-id', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'r2-secret-access-key', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'r2-bucket-name', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'r2-public-base-url', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'gemini-api-key', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'azure-translator-key', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'azure-speech-key', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'google-client-id', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        { name: 'metrics-token', value: 'PLACEHOLDER_SET_AFTER_DEPLOY' }
        ]
      )
    }
    template: {
      containers: [
        {
          name: 'hanflix-backend'
          image: actualImage
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
            {
              name: 'APP_PUBLIC_URL'
              value: appPublicUrl
            }
            // ===== Required: Key Vault secrets via secretRef =====
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
            {
              name: 'SEED_ADMIN_PASSWORD'
              secretRef: 'seed-admin-password'
            }
            // ===== Email =====
            {
              name: 'SMTP_HOST'
              secretRef: 'smtp-host'
            }
            {
              name: 'SMTP_PORT'
              secretRef: 'smtp-port'
            }
            {
              name: 'SMTP_SECURE'
              secretRef: 'smtp-secure'
            }
            {
              name: 'SMTP_USER'
              secretRef: 'smtp-user'
            }
            {
              name: 'SMTP_PASS'
              secretRef: 'smtp-pass'
            }
            {
              name: 'SMTP_FROM'
              secretRef: 'smtp-from'
            }
            // ===== Cloudflare R2 =====
            {
              name: 'R2_ACCOUNT_ID'
              secretRef: 'r2-account-id'
            }
            {
              name: 'R2_ACCESS_KEY_ID'
              secretRef: 'r2-access-key-id'
            }
            {
              name: 'R2_SECRET_ACCESS_KEY'
              secretRef: 'r2-secret-access-key'
            }
            {
              name: 'R2_BUCKET_NAME'
              secretRef: 'r2-bucket-name'
            }
            {
              name: 'R2_PUBLIC_BASE_URL'
              secretRef: 'r2-public-base-url'
            }
            // R2_ENDPOINT is derived at runtime from R2_ACCOUNT_ID in env.ts.
            // Do NOT set it here; env.ts will build it: `${accountId}.r2.cloudflarestorage.com`
            // ===== Google Gemini =====
            {
              name: 'GEMINI_API_KEY'
              secretRef: 'gemini-api-key'
            }
            // ===== Azure AI =====
            {
              name: 'AZURE_TRANSLATOR_KEY'
              secretRef: 'azure-translator-key'
            }
            {
              name: 'AZURE_SPEECH_KEY'
              secretRef: 'azure-speech-key'
            }
            // ===== Google OAuth =====
            {
              name: 'GOOGLE_CLIENT_ID'
              secretRef: 'google-client-id'
            }
            // ===== Metrics =====
            {
              name: 'METRICS_TOKEN'
              secretRef: 'metrics-token'
            }
            // REDIS_URL intentionally unset — rate-limit middleware falls back to
            // in-memory when REDIS_URL is absent (see middleware/rate-limits.ts).
            // For shared multi-replica rate limiting, set REDIS_URL via env var
            // override after provisioning Redis/Upstash.
            // ===== Non-secret config =====
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
              value: azureTranslatorRegion
            }
            {
              name: 'AZURE_SPEECH_REGION'
              value: azureSpeechRegion
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
              name: 'AZURE_CLIENT_ID'
              value: managedIdentityClientId
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
              name: 'MONGODB_DB_NAME'
              value: mongodbDbName
            }
            {
              name: 'COOKIE_SECURE'
              value: nodeEnv == 'production' ? 'true' : 'false'
            }
            {
              name: 'COOKIE_SAME_SITE'
              value: 'none'
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
                scheme: 'HTTP'
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
                scheme: 'HTTP'
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

// ---------- Outputs ----------
output fqdn string = containerApp.properties.configuration.ingress.fqdn
output backendUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppId string = containerApp.id
output containerAppName string = containerApp.name
