# Video Processing Pipeline V2

V2 is selected by `VIDEO_PROCESSING_PIPELINE_V2=true` in `processLessonVideoPipeline`. It requires Batch Whisper (`AZURE_SPEECH_BATCH_ENABLED=true`). Turning V2 off selects the preserved legacy content-mode pipeline. There is **no automatic fast/realtime ASR fallback in V2**.

## Actual flow

Admin presign/confirm → original in R2 → durable Mongo ProcessingJob → atomic lease claim → restore source locally → FFprobe → PCM WAV → Batch Whisper → quality evaluation → optional music-only Demucs/secondary Batch → normalization → timestamp validation → optional alignment fallback → segmentation → contextual Pinyin → batched Vietnamese translation → local vocabulary → subtitle validation → revision commit → READY_FOR_REVIEW.

The HTTP confirm request queues work and returns; it does not wait for AI. The worker downloads to a private temporary directory and removes that directory in `finally`. R2 originals, thumbnails and playback derivatives are permanent; intermediate objects use `processing/{lessonId}/{jobId}/v{version}/`.

## Durable steps and restart

`DurableSteps` stores status, attempt, started/completed times, errors, and `output.value` for each completed step. `COMPLETED` reuses its output; `SKIPPED` never runs; abandoned RUNNING and FAILED steps can resume. Job attempts are bounded (default 3); checkpoint writes require the current lease token, running status and unexpired lease. Source download is a restoration of ephemeral bytes on each process attempt; its completed checkpoint is preserved. Local FFmpeg transforms, thumbnail uploads, successful translations and ASR outputs are reused.

The stable step order is:

```
DOWNLOAD_SOURCE, EXTRACT_AUDIO, PRIMARY_TRANSCRIPTION,
EVALUATE_TRANSCRIPTION, SEPARATE_VOCALS, SECONDARY_TRANSCRIPTION,
NORMALIZE_TRANSCRIPT, VALIDATE_TIMESTAMPS, ALIGN_TIMESTAMPS,
SEGMENT_SUBTITLES, GENERATE_PINYIN, TRANSLATE, EXTRACT_VOCABULARY,
BUILD_SUBTITLES, VALIDATE_RESULT, CLEANUP, READY_FOR_REVIEW
```

Music pre-separation can execute SEPARATE_VOCALS before primary ASR. The UI still receives legacy `stage` and `video.processingStep` values, plus detailed `currentStep`, public step state, warnings and usage metrics. The status DTO omits lease tokens, provider URLs, raw transcripts and checkpoint outputs.

## Azure lifecycle and billing safety

The provider uses root-level `model.self`, `locale=zh-CN` and `displayFormWordLevelTimestampsEnabled=true`. If no model URL is configured, it searches paginated base models for Whisper, zh-CN, supported batch transcription and valid deprecation dates. The selected model is cached per worker process for 24 hours by default.

Before POST, the worker atomically persists an intent and increments conservative usage counters. It persists the returned transcription self URL before polling. Restart with a self URL only polls. Restart with an intent but no self URL lists transcriptions and finds the stable displayName containing lesson, job, pipeline version and primary/secondary role. Missing/ambiguous reconciliation stops with `AZURE_ASR_SUBMISSION_UNCERTAIN`; it never issues another POST. This deliberately favors avoiding duplicate billing over automatic recovery. Azure does not provide exactly-once submission semantics.

Successful jobs are read via `links.files`, then the `Transcription` file's `links.contentUrl`. Speech credentials are sent only to the configured Speech origin, never to result blob URLs. Raw JSON is persisted privately in R2 before parsing; displayWords, ISO durations and ticks are normalized to milliseconds. Read requests retry up to `AZURE_PROVIDER_MAX_RETRIES` attempts, with bounded backoff; submit is attempted once. Polling backs off 2 → 4 → 8 → 16 → 30 seconds, with abort/deadline support. A timeout retains the Azure ID for later resume. Batch queues can exceed one local worker deadline; an admin retry continues the existing transcription.

Authentication, not-found, rate-limit, server, network, timeout, failed transcription, unreachable audio, malformed and empty-result errors remain distinct. Expired R2 audio cannot cause automatic resubmission. Signed ASR URLs always use authenticated presigning even when public playback is configured; default TTL is 12 hours. Do not expose the `processing/` prefix through a public bucket/CDN route.

References: [Batch submit](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription-create), [result lifecycle](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/batch-transcription-get), [model features/deprecation](https://learn.microsoft.com/rest/api/speechtotext/models/get-base-model).

## Audio and media policy

V2 enforces at most 420 seconds regardless of legacy podcast limits. FFprobe has a bounded subprocess and cancellation; ASR audio must exist, be nonempty, PCM s16le WAV, 16 kHz, mono, with valid duration. Demucs receives 44.1 kHz stereo extracted from the original, never the 16 kHz ASR derivative.

MOVIE/PODCAST default to no Demucs, including poor background-music recognition. MUSIC is selected by explicit mediaType or song content mode. AUTO uses content mode and audio/video stream shape conservatively. For MUSIC, a BAD primary can trigger one separation and one secondary ASR. With MUSIC_PRESEPARATE_VOCALS=true, separation precedes primary and no secondary is added. The higher-quality transcript is retained; poor output remains reviewable with NEEDS_REVIEW warnings. Empty/no usable Chinese transcript fails instead of creating fake subtitles. Supplied timed LRC remains authoritative and can survive ASR failure.

Quality uses Chinese ratio, repetition, hallucination markers, union time coverage, invalid timestamps and abnormal reading speed. GOOD/QUESTIONABLE/BAD thresholds are configurable. Confidence is not required.

## Subtitles, alignment and content modes

Raw Azure JSON and cue rawText are preserved separately from NFKC normalized text. Segmentation uses punctuation, word timestamp boundaries, duration/length budgets and Chinese word segmentation for text-only fallback. Contextual Pinyin is generated for each full cue with pinyin-pro, then mapped to characters with a length check. Vocabulary reuses the existing local Vocabulary/Word services and cannot block completion.

Cue fields retain the existing contract (`cueId`, `startMs`, `endMs`, `zh`, `pinyin`, `vi`, `tokens`) and add `rawText`, `normalizedText`, `quality`, `needsFineAlignment`, and `karaokeTokens`. Karaoke tokens include `text`, `pinyin`, `startMs`, `endMs`, `timingSource`, `approximate`.

No trained fine aligner is included. Multi-Hanzi Azure units never become falsely precise per-character timing. With approximate timing allowed, interpolation is explicitly marked. With ALIGNMENT_MODE=REQUIRED or ALIGNMENT_ALLOW_APPROXIMATE=false, uncertain karaoke tokens are omitted and a review warning is retained; the subtitle pipeline still completes. ALIGNMENT_ENABLED=false / mode DISABLED skips fine alignment. Alignment counters are zero. This is the specified graceful fallback, not a claim that WhisperX/stable-ts runs.

Song LRC and podcast chapter metadata are preserved. V2 Whisper does not invent drama speaker labels or call an extra fast ASR for diarization; existing characters remain and a speaker-review warning is emitted. Legacy mode retains the old diarization path. Playback derivative generation remains optional, uses a stable job output key and reuses durable output on retry.

## Translation, persistence and failure behavior

Translator sends Chinese → Vietnamese in batches (100 cues / 50,000 characters maximum). Successfully checkpointed batches are reused. 429 retries are bounded. Network/5xx/timeout outcomes are treated as uncertain: the pending batch stays recorded and is not silently billed again on restart. Rejected 4xx requests clear the pending marker, so configuration repair and retry can proceed. Translator has no queryable request ID; ambiguous delivery requires operator review. Usage metrics record confirmed translated characters, not an exact invoice estimate for uncertain delivery.

Final validation requires nonempty subtitles, Chinese present in the transcript, nonempty translations/Pinyin, finite monotonic cue times within duration, token/text mapping and valid token boundaries. Vocabulary warnings do not fail validation.

`runGenerationCommit` reserves revision numbers on the job before upserts. Repeating a partial standalone commit uses the same revisions. On replica sets it commits SubtitleTrack, Quiz, Lesson and job together. Session queries are sequential (parallel operations in one transaction previously failed in real Mongo testing). Production should use transactions; standalone mode provides repairable sequential writes but cannot give multi-document atomicity. Existing unique indexes on activeKey and (lessonId, revision) are retained. Legacy checkpoint shapes adapt cached ASR and exact-text translations; if an old completed paid step has no recoverable output, `CHECKPOINT_OUTPUT_MISSING` stops rather than charging again.

## Cleanup and operation

Run `npm run cleanup:processing-artifacts` periodically. Only completed/failed jobs older than PROCESSING_ARTIFACT_TTL_HOURS (24 by default) are eligible. Cleanup claims a bounded job lock before deletion; retry cannot claim that job while the cleanup lock is active. Referenced active-job artifacts are excluded. Original media/final subtitles are not deleted. A failed job can regenerate expired reproducible audio; completed transcripts/translations remain in Mongo checkpoints. Expired raw data can be fetched again from an existing Azure transcription while Azure retains it; never submit a new transcription just to replace an expired result.

Metrics: azureAsrRequests/audioSeconds (submission-intent upper bound), translatorCharacters (confirmed batches), demucsRuns/processingSeconds, alignmentRuns/processingSeconds, qualitySummary and estimateProcessingUsage. They are usage estimates, not currency prices. Single processing slot per worker; deploy one active worker replica for Student budgets. The manual Demucs job has one replica and zero platform retries. R2 deletion/cleanup must be scheduled; TTL is not an automatic Mongo expiry index.

## Local verification

```
npm ci
npm run typecheck
npm test
npm run build
python -m unittest discover -s workers/media-ai -p test_main.py
```

There is no backend lint script; TypeScript strict checks and focused format/diff checks are used. Existing oxfmt 0.2.0 has an inline TypeScript member-separator bug; formatted files were repaired and re-typechecked. Do not blindly format the entire repository with that version.

For integration tests start a disposable Mongo replica set named `pipelineAudit` on loopback port 27029, then set RUN_LOCAL_PIPELINE_INTEGRATION_TESTS=true and run `vitest run src/services/pipeline/local-runtime.integration.test.ts`. It verifies real duplicate claims, stale-worker fencing, transactions, partial-write recovery, persisted karaoke and FFmpeg. Test databases have unique hanflix_pipeline_audit_ names. `node scripts/verify-pipeline-runtime.mjs` starts the compiled server against that local replica set with no provider credentials and checks both health endpoints.

Azure tests are skipped unless RUN_AZURE_INTEGRATION_TESTS=true. The opt-in test also requires AZURE_TEST_AUDIO_URL for its first submission, writes a durable intent under ignored .runtime/, and reuses that intent on later runs. Enabling it can incur one Azure ASR charge. Never remove its state file merely to retry a timeout.
