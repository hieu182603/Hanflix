# Pipeline V2 audit — 2026-09-23

Source: complete user attachment (A–AN). No separate original pipeline spec was supplied or found; root task.md concerns responsive UI. Preserve pre-existing uncommitted changes.

## Baseline (before edits)

Backend npm typecheck/build: FAIL (nullable Speech confidence). Tests: 231 passed, 1 failed, 3 skipped across 49 files. Failed test: legacy Speech empty response error contract. No backend lint script. Dependencies already installed; backend package-lock.json, frontend pnpm-lock.yaml.

## Initial requirement traceability

| Requirement | Status | Evidence | Problem | Action |
|---|---|---|---|---|
| Async upload / durable queue | PARTIAL | admin.routes upload confirm; video.queue | lease guarded claim exists; failure uses read/save race | preserve upload; fence failure writes |
| Steps / resume / duplicate delivery | BROKEN | processing-steps; subtitle-pipeline | resets attempt=1; missing steps; modes bypass checkpoints | durable per-step outputs |
| Azure submit idempotency | BROKEN | azure-speech-batch.service transcribeFromUrl | no intent or URL persistence before polling | persist intent before POST; reconcile uncertain submissions, never blindly resubmit |
| Batch Whisper discovery | BROKEN | getModelSelf | model nested in properties; no expiry/pagination | use documented model contract, cache |
| Batch lifecycle / errors | BROKEN | transcribeFromUrl | files list parsed as transcript; no resume | persist self; download transcription content URL; bounded reads |
| R2 signed URL | PARTIAL | storage/r2-storage.service | signed GET exists; duplicate upload in pipeline | stable job artifact keys; redact errors |
| Audio validation | PARTIAL | media-processor | 16k/44.1k extraction exists, duration cap bypassed | validate actual output streams; enforce 420s |
| Quality / Demucs policy | BROKEN | subtitle-pipeline | BAD movie triggers Demucs; retries can rerun; modes bypass | enforce music policy and one-shot claims |
| Python worker / ACA Job | PARTIAL | workers/media-ai; media-compute | local only; production adapter throws; model downloaded at runtime | implement storage contract and ACA adapter; bake model |
| Timestamp / karaoke / normalization | BROKEN | timestamp-validator; subtitle schema | overlap repair can invert interval; validator unused; metadata dropped | validate; preserve raw text; marked approximate tokens |
| Fine alignment | MISSING | ALIGNMENT env only | no actual fallback integration | explicit approximate fallback with warnings |
| Segmentation / Pinyin | PARTIAL | subtitle-splitter; pinyin | contextual library exists; mixed-text mapping unchecked | retain splitter, verify mappings |
| Translator / metrics | PARTIAL | translator | batching exists; no persisted chunk progress | checkpoint batches and usage |
| Vocabulary | BROKEN | resolveLearningWordIds call | failure blocks subtitles | warning and continue |
| Final validation / persistence | PARTIAL | revision-commit | incomplete validation; retry increments revisions | stable revision reservation; full V2 validation |
| Admin / frontend contract | PARTIAL | processing API; frontend api/admin | job spread exposes internal checkpoints | safe additive status DTO |
| Cleanup / cost | PARTIAL | cleanup-processing-artifacts | expired failed checkpoints may reference deleted audio | preserve retry semantics; document TTL |
| Env / Docker / Student IaC | PARTIAL | env; Dockerfiles; azure | flags unused; production provider missing | align config and deployment with real code |
| Tests / docs / runtime | PARTIAL | baseline above | only 2 Batch parser tests; docs claim unsupported behavior | regressions and mock scenarios; honest external verification |

No initial DONE designation is inferred from file existence.

## Final disposition — 2026-09-24

The initial gaps above have been implemented and verified locally. The final A–AN matrix, 12-part audit report, changed-file groups, test commands, cost bounds and exact limitations are in [pipeline-v2-verification.md](pipeline-v2-verification.md). Architecture and deployment documents now describe actual code, including explicit alignment fallback and uncertain-submission recovery.

Final checks: backend typecheck/build PASS; 273 unit/mock tests PASS; 5 local Mongo/FFmpeg tests PASS; frontend typecheck/31 tests/build PASS; Python contract3 PASS; Bicep main/media compile PASS; compiled API health/readiness PASS. Backend lint has no script (NOT RUN). Docker NOT RUN (daemon unavailable); Azure live PENDING. These external validations are the continuation checklist in [pipeline-v2-handoff.md](pipeline-v2-handoff.md).
