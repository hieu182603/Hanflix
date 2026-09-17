# HanFlix backend architecture

## Runtime boundary

The Express API owns authentication, authorization, lesson metadata, R2 upload authorization, progress, quiz scoring, SRS and AI request validation. Video bytes remain in Cloudflare R2. MongoDB stores metadata, subtitle revisions and durable processing jobs. Temporary worker files live under the operating-system temp directory and are deleted after each attempt.

User accounts support password login, Google sign-in, or both. Google `sub` is the stable unique identity key. A verified Google email matching an existing password account is not linked automatically; linking requires an existing HanFlix session.

## Video processing flow

1. Admin creates a lesson draft.
2. API issues a short-lived R2 presigned PUT URL.
3. Admin browser uploads directly to R2 and confirms the object key.
4. API validates the R2 object, marks the lesson `processing`/`QUEUED`, creates one active MongoDB processing job and returns immediately.
5. The worker atomically claims the job, downloads the R2 object to a unique temp directory and uses FFmpeg to produce mono 16 kHz WAV audio.
6. Azure Speech fast transcription returns Mandarin phrase timestamps.
7. The local Pinyin service generates tone-mark Pinyin.
8. Azure Translator translates each Chinese cue to Vietnamese.
9. The worker upserts revision 1 subtitle and quiz drafts, marks the lesson `ready_for_review`/`READY`, and removes all temp files.
10. Admin review/publish activates immutable subtitle and quiz revisions. Learners only see published lessons.

No Speech or translation provider is called during learner playback.

## Processing durability

`processingjobs` is the queue. `findOneAndUpdate` atomically claims one queued record. `activeKey` prevents two active jobs for the same lesson. Failed transient attempts are requeued with bounded exponential delay; the maximum is controlled by `VIDEO_PROCESSING_MAX_RETRIES`. Running jobs whose heartbeat exceeds `VIDEO_PROCESSING_TIMEOUT_MINUTES` are recovered or terminally failed. Manual admin retry resets the attempt counter and reuses the same subtitle/quiz revision, so retry does not duplicate content.

For the student MVP the API starts the worker in the same container (`VIDEO_WORKER_MODE=embedded`), avoiding Redis and an always-on second service. The same image can later run a standalone worker with `VIDEO_WORKER_MODE=standalone` and `npm run worker`.

## Service abstractions

- `StorageService` → `R2StorageService`
- `SpeechToTextService` → `AzureSpeechToTextService`
- `TranslationService` → `AzureTranslationService`
- `PinyinService` → deterministic local `pinyin-pro`
- `processLessonVideoPipeline` orchestrates providers but contains no provider credentials.

## Collections

- `users`: account, role/status and learning profile.
- `refreshsessions`: rotated refresh token hashes with TTL.
- `lessons`: catalog metadata, private R2 key, processing summary and active revision numbers.
- `processingjobs`: durable queue state, lock, attempts, heartbeat and errors.
- `subtitletracks`: draft/published Chinese/Pinyin/Vietnamese cue revisions.
- `words`, `savedwords`: canonical vocabulary and SRS state.
- `quizzes`, `quizattempts`: revisioned quizzes and idempotent attempts.
- `progresses`: watched ranges, completion and scores.

## Health

- `GET /health`: lightweight process liveness; no external calls.
- `GET /api/v1/health`: readiness summary for MongoDB and MongoDB-backed queue counts.

## Deployment choice

Use one Azure Container App on the Consumption plan, external HTTP ingress, `minReplicas=0`, `maxReplicas=2`, and embedded worker mode. This is the lowest-complexity option for roughly 250 processing minutes per month. If processing must continue independently from HTTP scale-to-zero behavior, deploy the same image as a scheduled Container Apps Job or keep one standalone worker replica.
