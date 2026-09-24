param location string = resourceGroup().location
param name string = 'hanflix-media'
param environmentId string
param image string
param managedIdentityId string
param r2Endpoint string
param r2BucketName string
param r2AccessKeyVaultUrl string
@secure()
param r2SecretKeyVaultUrl string
@description('ACR hostname, empty for an image that can be pulled anonymously')
param registryServer string = ''

resource mediaJob 'Microsoft.App/jobs@2025-01-01' = {
  name: name
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${managedIdentityId}': {} }
  }
  properties: {
    environmentId: environmentId
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 900
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      registries: empty(registryServer) ? [] : [{ server: registryServer, identity: managedIdentityId }]
      secrets: [
        { name: 'r2-access', keyVaultUrl: r2AccessKeyVaultUrl, identity: managedIdentityId }
        { name: 'r2-secret', keyVaultUrl: r2SecretKeyVaultUrl, identity: managedIdentityId }
      ]
    }
    template: {
      containers: [{
        name: 'media'
        image: image
        args: ['r2-separate-vocals']
        resources: { cpu: 2, memory: '4Gi' }
        env: [
          { name: 'R2_ENDPOINT', value: r2Endpoint }
          { name: 'R2_BUCKET_NAME', value: r2BucketName }
          { name: 'R2_ACCESS_KEY_ID', secretRef: 'r2-access' }
          { name: 'R2_SECRET_ACCESS_KEY', secretRef: 'r2-secret' }
        ]
      }]
    }
  }
}
output resourceId string = mediaJob.id
