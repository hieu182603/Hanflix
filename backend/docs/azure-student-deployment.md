# Azure Student deployment — Pipeline V2

Updated 2026-09-24. This is a deployment runbook, not evidence of a live deployment. Bicep compiles locally; Docker daemon and live Azure verification remain pending.

## Resources

- Speech resource with Batch Whisper available for zh-CN in the selected region; Translator resource.
- Existing backend Container App, Container Apps environment, Log Analytics, user-assigned managed identity, Key Vault.
- MongoDB replica set (Atlas or equivalent), Cloudflare R2 bucket and credentials.
- Optional manual Container Apps Job for music vocal separation. No GPU VM. Use the separate Python media image; the backend Node image does not include Python/Demucs.
- An image registry. The media Bicep supports public images or ACR with managed identity. Private GHCR authentication is not configured by this media module; publish an accessible image or use ACR.

No Redis queue is required: MongoDB holds the durable jobs. Redis remains optional for existing shared HTTP rate limiting.

## Environment actually consumed

Values are configured on the backend unless stated otherwise. Store secrets in Key Vault and reference them from Container Apps; do not commit actual values.

| Classification | Variables | Purpose/default |
|---|---|---|
| REQUIRED | MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET | Database and different strong auth secrets |
| REQUIRED for media processing | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME | Source and processing artifact access |
| REQUIRED for V2 | AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION | Provider access |
| REQUIRED V2 settings (defaults supplied) | VIDEO_PROCESSING_PIPELINE_V2=true, AZURE_SPEECH_BATCH_ENABLED=true, PROCESSING_PIPELINE_VERSION=2 | V2 deliberately rejects Batch disabled |
| OPTIONAL | AZURE_SPEECH_ENDPOINT, AZURE_TRANSLATOR_ENDPOINT, AZURE_SPEECH_WHISPER_MODEL_SELF | Endpoint override; model auto-discovered if absent |
| OPTIONAL | AZURE_SPEECH_LOCALE=zh-CN, AZURE_SPEECH_BATCH_API_VERSION=2024-11-15, AZURE_SPEECH_MODEL_CACHE_HOURS=24 | Batch settings; V2 validates locale |
| OPTIONAL | R2_ENDPOINT, R2_PUBLIC_BASE_URL, R2_ASR_SIGNED_URL_TTL_SECONDS=43200 | Endpoint derived from account; processing URLs always presigned, minimum 3600s |
| OPTIONAL | MAX_VIDEO_DURATION_SECONDS=420, MAX_VIDEO_BYTES=104857600 | Duration cannot exceed 420s in V2, all content modes |
| OPTIONAL | MUSIC_PRESEPARATE_VOCALS=false, ASR_GOOD_THRESHOLD=0.72, ASR_RETRY_THRESHOLD=0.42 | Music policy and quality thresholds |
| OPTIONAL | ALIGNMENT_ENABLED=true, ALIGNMENT_MODE=APPROXIMATE_ALLOWED, ALIGNMENT_ALLOW_APPROXIMATE=true | Explicit fallback; REQUIRED omits uncertain karaoke tokens because no fine aligner is installed |
| OPTIONAL | VIDEO_WORKER_MODE=embedded, VIDEO_PROCESSING_MAX_CONCURRENCY=1, VIDEO_PROCESSING_MAX_RETRIES=3, VIDEO_PROCESSING_TIMEOUT_MINUTES=30, VIDEO_PROCESSING_POLL_MS=5000 | Queue policy; concurrency one per worker process |
| OPTIONAL | VIDEO_LEASE_TTL_SECONDS=120, VIDEO_HEARTBEAT_INTERVAL_SECONDS=20, AZURE_PROVIDER_MAX_RETRIES=2 | Lease and bounded provider read retries |
| OPTIONAL | PROCESSING_ARTIFACT_TTL_HOURS=24, PLAYBACK_DERIVATIVE_ENABLED=true | Cleanup retention and web playback output |
| OPTIONAL local only | MEDIA_COMPUTE_PROVIDER=local | Requires Python/Demucs dependencies on host; not included in backend Docker image |
| PRODUCTION ONLY for remote Demucs | MEDIA_COMPUTE_PROVIDER=azure-container-apps, AZURE_MEDIA_JOB_RESOURCE_ID, MEDIA_JOB_TIMEOUT_SECONDS=900 | Full ARM Job ID; asynchronous compute adapter |
| PRODUCTION ONLY for user-assigned identity | AZURE_CLIENT_ID | Identity client UUID. Bicep sets it; omit only for a system-assigned identity |
| PRODUCTION ONLY | NODE_ENV=production, COOKIE_SECURE=true, APP_PUBLIC_URL, APP_ORIGINS, METRICS_TOKEN, SMTP_HOST, SMTP_FROM | Production validation; public URL/origins must be HTTPS |
| PRODUCTION database | MONGODB_TLS=true, MONGODB_TLS_ALLOW_INVALID=false, DISABLE_TRANSACTIONS=false | Use replica-set transactions. Standalone fallback is not multi-document atomic |

IDENTITY_ENDPOINT and IDENTITY_HEADER are supplied by Container Apps, never manually embedded as credentials. SMTP_USER/SMTP_PASS must be configured together if SMTP authentication is used. Full API settings remain in ../.env.example; Gemini is optional and is not part of the V2 ASR/translation path.

## Build and provision

From repository root, build-time verification without deploying:

```powershell
az bicep build --file azure/main.bicep
az bicep build --file azure/modules/media-job.bicep
docker build -t hanflix-media:v2 backend/workers/media-ai
docker run --rm hanflix-media:v2 --help
```

The media image installs pinned Demucs/Torch packages and downloads htdemucs weights during build. Build needs package/model network access. Runtime uses CPU and a non-root user. Validate a real 44.1k WAV sample locally in that image before publishing it; mocked Python tests do not measure separation quality, peak RAM or runtime.

Deploy the existing main template using an environment-specific parameter file. Keep minReplicas=1 and maxReplicas=1 with the embedded worker; the checked-in main parameters use these limits. Set secretsReady only after Key Vault secrets exist. Main does not automatically deploy the optional media Job.

Prepare a media parameter file outside version control with these module parameters: environmentId, image, managedIdentityId, r2Endpoint, r2BucketName, r2AccessKeyVaultUrl, r2SecretKeyVaultUrl, optional registryServer/name/location. Key Vault URLs reference existing R2 credential secrets.

```powershell
az deployment group create --resource-group YOUR_RESOURCE_GROUP --template-file azure/modules/media-job.bicep --parameters @media.parameters.json
```

Assign the Job identity access to the referenced Key Vault secrets (Key Vault Secrets User); for ACR, also grant AcrPull scoped to the registry. Assign the backend identity Container Apps Jobs Operator scoped to this media Job so the adapter can read its template, start an execution and poll it. This built-in role includes additional Job actions; scope it narrowly. The adapter uses client_id to select a user-assigned identity. See [Container Apps identities](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity) and [Jobs roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/containers).

On the backend, set MEDIA_COMPUTE_PROVIDER=azure-container-apps and AZURE_MEDIA_JOB_RESOURCE_ID to the deployment output. Main Bicep leaves the default provider local, so this configuration is necessary before testing music separation remotely.

The Job has manual trigger, 2 CPU/4 GiB, 900s timeout, replicaRetryLimit=0, parallelism=1 and replicaCompletionCount=1. Its normal environment contains R2_ENDPOINT/R2_BUCKET_NAME and secret references R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY. The adapter preserves the template and adds MEDIA_INPUT_KEY/MEDIA_OUTPUT_KEY for each execution. It records start intent and execution ID before polling; it does not blindly retry uncertain starts.

## Scaling and cleanup

Embedded mode needs one continuously running API replica to poll MongoDB without HTTP traffic. The manual Demucs Job is on demand and can be idle at zero replicas independently.

For API scale-to-zero, set VIDEO_WORKER_MODE=disabled on the API and provision a separate scheduled worker Job using the backend image, all queue/provider configuration, VIDEO_WORKER_MODE=standalone and command:

```text
node dist/workers/video-processing.worker.js --drain
```

Drain processes currently eligible jobs and exits. Schedule repeats must cover delayed retries. Ensure only one queue worker execution is active: per-process concurrency is not a global semaphore. The scheduled worker infrastructure is an alternative operational deployment, not automatically created by main.bicep. A crashed worker resumes from Mongo leases/checkpoints on the next execution.

Schedule cleanup daily from a maintenance environment containing backend source and dev dependencies:

```text
npm run cleanup:processing-artifacts
```

The script is TypeScript under scripts/, not copied into the production backend image. It removes processing/ artifacts only for old completed/failed jobs, with a 10-minute cleanup claim that blocks retry; active jobs are protected. It does not delete source, thumbnail, published subtitle or playback assets. Failed-job paid checkpoints remain; retry polls known Azure jobs or uses completed outputs instead of resubmitting. Do not configure an R2 lifecycle shorter than active-job/ASR retention.

## Staging acceptance

1. Configure both V2 and Batch true; never use Batch=false to test V2. Legacy requires VIDEO_PROCESSING_PIPELINE_V2=false explicitly.
2. Run unit/build/local checks listed in pipeline-v2-verification.md.
3. Use a short Chinese dialogue WAV reachable by Azure, with no sensitive query strings in logs. Set RUN_AZURE_INTEGRATION_TESTS=true and AZURE_TEST_AUDIO_URL, then run the dedicated azure-speech-batch.live.test.ts test. It stores durable intent in backend/.runtime/azure-live-state.json; keep that file across retries. This opt-in test can incur Speech usage.
4. Process a short dialogue, podcast, song and drama clip through the admin flow. Inspect safe status DTO, subtitle pinyin/translation, timing flags, metrics and READY_FOR_REVIEW. Drama speaker labels require admin review.
5. Restart the worker after Speech submit and verify the same transcription URL resumes with no second POST. Retry a translation failure with saved ASR output; verify completed steps remain completed.
6. Trigger BAD music to exercise one Demucs execution and at most one secondary ASR. Validate the real image's RAM/time/quality at the intended duration.
7. Verify expired artifact cleanup and retry locking against a staging bucket/database. Set budget alerts using observed usage; reported counters are bounds/confirmed usage, not Azure invoices.

SUBMISSION_UNCERTAIN means delivery could have succeeded. Reconcile the stored displayName/URL/execution or Translator outcome before changing state; never delete paid intent markers merely to make retry proceed.

Live Azure, R2, image execution and budget verification have not been performed in this workspace.
