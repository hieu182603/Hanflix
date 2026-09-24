# Pipeline V2 — báo cáo kiểm chứng cuối

Ngày 2026-09-24. Phạm vi: yêu cầu A–AN trong attachment của người dùng. Kết luận: code V2 build/test được và sẵn sàng kiểm thử Azure staging; chưa xác nhận vận hành Azure/Demucs thật. Không deploy, không gọi dịch vụ tính phí, không commit hoặc stage thay đổi.

## 1. Audit summary

- DONE BEFORE → PRESERVED: upload R2 bất đồng bộ, Mongo queue/activeKey, FFmpeg adapters, pinyin-pro theo ngữ cảnh, Translator batching, vocabulary DB, subtitle/quiz revision models, admin review và các content mode legacy.
- PARTIAL BEFORE → FIXED: chuẩn âm thanh và giới hạn thời lượng, Pinyin mapping, dịch theo checkpoint, vocabulary không chặn hoàn thành, metadata subtitle, cleanup TTL, env và worker runtime.
- MISSING BEFORE → IMPLEMENTED: DurableSteps có output, reconcile Speech submit không rõ kết quả, ACA adapter thật và storage contract Python, safe admin DTO, migration checkpoint cũ, local Mongo/FFmpeg integration, opt-in Azure live test.
- BROKEN BEFORE → FIXED: model.self sai vị trí, nhầm files list thành transcript, submit lại khi retry, Demucs chạy cho movie BAD, timestamp lồng nhau tạo interval âm, nullable confidence khiến build lỗi, parallel queries trong Mongo transaction, revision tăng khi retry partial write, stale worker update, standalone worker không khởi động, user-assigned identity thiếu client_id.
- DEFERRED EXTERNAL: Docker image build/run, benchmark Demucs thật, Azure Speech/Translator/ACA/R2 staging và xác nhận billing. Fine alignment dùng fallback được spec cho phép; không có engine aligner giả.

Audit trước khi sửa giữ tại [pipeline-v2-audit.md](pipeline-v2-audit.md).

## 2. Requirement coverage

DONE dưới đây nghĩa là code đã có và được kiểm tra ở mức ghi trong cột bằng chứng; không đồng nghĩa đã chạy cloud thật.

| Yêu cầu | Trạng thái cuối | Bằng chứng / giới hạn |
|---|---|---|
| A–E, B/C/D: đọc task, audit implementation, matrix | DONE | Đọc attachment đầy đủ, matrix trước sửa; task.md gốc trong repo là UI không liên quan |
| F: upload async, queue/worker | DONE | Admin confirm queue; worker restore source, claims atomic; API runtime health PASS |
| G: state machine 17 bước | DONE | DurableSteps, completed/skipped reuse, attempts, errors, READY commit; mocked orchestration |
| H: idempotency / duplicate / resume | DONE | Intent trước POST; URL trước poll; 5 local integration tests, mock restart/translation failure |
| I: Batch Whisper zh-CN/model discovery | DONE; live PENDING | Lifecycle tests: root model, features, pagination, expiry, cache; không silent fallback |
| J: submit→poll→files→content→parse | DONE; live PENDING | Persist raw JSON, ticks/ISO/displayWords, error taxonomy, cancel/backoff |
| K: R2 signed URL | DONE; live PENDING | processing prefix luôn presign; TTL/redaction; expired audio không làm submit lại |
| L: audio/FFmpeg | DONE | Real FFmpeg: 16k mono PCM, 44.1k source, corrupt input/duration validation |
| M: quality evaluator | DONE | Chinese ratio, union coverage, repetition/hallucination, invalid timestamps/speed; tests |
| N: Demucs policy | DONE | MUSIC BAD hoặc pre-separate; max một separation, chọn kết quả tốt hơn; tests |
| O: Python media worker | DONE code; image/runtime PENDING | Real subprocess, validation, R2, nonzero errors; 3 Python contract tests |
| P: ACA Job adapter | DONE code; deployment PENDING | Template/env override, managed identity client_id, start/resume/202 polling, durable output; 4 mock tests, Bicep compile |
| Q: timestamp/karaoke | DONE | Multi-Hanzi đánh dấu needsFineAlignment, INTERPOLATED/approximate; real persisted schema test |
| R: alignment fallback | DONE theo fallback cho phép | Không có fine aligner; giữ Azure timing + review flags; strict mode bỏ token không chắc chắn |
| S: normalization/segmentation | DONE | Raw giữ riêng; NFKC; punctuation/word/timing/length/duration; Chinese word segmentation |
| T: contextual Pinyin/mapping | DONE | pinyin-pro theo câu; mixed zh/en, length và token mapping checks |
| U: Translator | DONE; live PENDING | zh→vi, batch100/50k, checkpoint batches, bounded429, uncertain delivery gate |
| V: vocabulary | DONE | Reuse local DB; failure warning, không fail subtitles |
| W: final subtitle data | DONE | Additive fields, editor giữ provenance và quality; revision commit persists |
| X: validation | DONE | Nonempty Chinese transcript, pinyin/vi, finite monotonic times, token mapping, duration |
| Y: cost controls | DONE trong phạm vi một durable job | Bounds ở mục10; deployment một worker; manual new generation có ngân sách mới |
| Z: env | DONE | Parsing/defaults/relations; .env.example và deployment table khớp code |
| AA: baseline | DONE | Typecheck/build FAIL, 231 pass/1 fail/3 skip trước sửa |
| AB/AC: implementation, không stub production | DONE | Code thật cho providers; mock chỉ trong test; không TODO thay implementation |
| AD/AE: tests/scenarios | DONE offline; live PENDING | Matrix scenario bên dưới; Azure mặc định skip |
| AF: schema/migration | DONE | Additive defaults, checkpoint adapter, stable revisions, local DB tests |
| AG: frontend compatibility | DONE offline | TSC, 31 tests, Vite build; chưa browser E2E với staging provider |
| AH: security | DONE scoped review | URL origin guard, blob fetch không key, redaction, safe DTO, exec argv, private artifacts |
| AI: docs | DONE | Pipeline, Azure deployment, audit, verification và handoff |
| AJ: verification loop | DONE khả thi | Strict typecheck/tests/build/runtime/diff scan; không có lint script; Docker unavailable |
| AK: definition of done | READY FOR LIVE TEST | Các kiểm tra local đạt; cloud claims giữ PENDING |
| AL/AM/AN: 12 phần report, tự xử lý đến hoàn thành local | DONE | Báo cáo này và checklist external; không yêu cầu xác nhận lại việc đã cho phép |

Scenario AE: podcast, movie có nhạc, song, silence, corrupt, 401/429/500/timeout/empty, crash sau submit, restart, translation fail sau ASR, duplicate delivery, expired URL, >420s, mixed zh/en, BAD→Demucs, BAD secondary→review, alignment unavailable đều có mock/unit hoặc local integration coverage. Silence/provider transcription scenarios là mô phỏng, không phải nhận dạng một file im lặng trên Azure thật.

## 3. Important bugs found

1. POST Azure không có intent/URL durable: restart có thể tính phí lần nữa. Lưu intent trước gọi, reconcile displayName nếu chưa biết URL; không POST lại khi không rõ.
2. Batch request/result contract sai: model nằm sai chỗ và parser đọc files list. Sửa submit root model và fetch Transcription content URL.
3. Retry dịch làm chạy lại ASR/FFmpeg, completed step thiếu output. Persist output/checkpoint theo bước và migrate data cũ có thể khôi phục.
4. BAD movie kích hoạt Demucs và retry không giới hạn one-shot. Restrict MUSIC và sentinel bền vững, separate source 44.1k.
5. Overlap nested/NaN tạo timestamps không hợp lệ và metadata bị schema/editor bỏ. Validate/repair/drop invalid intervals và giữ provenance.
6. Promise.all trong transaction Mongo gây lỗi thật. Queries tuần tự; revision reservation sửa duplicate revision khi partial write.
7. Worker cũ ghi failure/status sau lease loss; heartbeat có thể hồi sinh lease hết hạn. Guard matchedCount/token/expiry; local regression xác nhận.
8. ACA production adapter thiếu start/poll/storage và identity selector. Implement adapter, 202 operation checkpoint, Python R2 và client_id.
9. Bicep cho nhiều replica với concurrency chỉ per process và tắt transactions. Default một replica, bật transactions.
10. Log/admin DTO có thể lộ signed URL, leases/checkpoints. Whitelist DTO, redact provider errors, không gửi Speech key tới blob.

## 4. Architecture final

Admin upload/confirm → R2 original → Mongo ProcessingJob → lease claim → download/probe → ASR WAV → Azure Batch Whisper → quality → optional MUSIC separation/secondary → normalization/timestamp fallback/segmentation → contextual Pinyin → Translator batches → local vocabulary → validate → SubtitleTrack/Quiz/Lesson/job commit → READY_FOR_REVIEW.

Paid intents và completed outputs ở Mongo; raw ASR/audio intermediates ở processing/{lesson}/{job}/v{version}/. Local work chỉ là temporary; remote Demucs Job on demand. Không tự chuyển sang Fast ASR trong V2. Xem [pipeline architecture](video-processing-pipeline.md) để biết lifecycle và restart.

## 5. Files changed

Danh sách dưới đây là nhóm file phục vụ pipeline; worktree còn nhiều thay đổi frontend/grammar có sẵn hoặc phát sinh từ công việc khác, không được nhận là thành quả của task này.

| File / nhóm | Thay đổi và lý do |
|---|---|
| src/services/pipeline/video-pipeline-v2.ts, durable-steps.ts, checkpoint-migration.ts | Orchestrate/resume/fence paid work và migrate checkpoint cũ |
| src/services/pipeline/processing-steps.ts, processing-status.ts | Step attempts/lease safety và DTO public an toàn |
| src/services/pipeline/asr-quality.ts, subtitle-quality.ts, timestamp-validator.ts | Quality, normalization, karaoke provenance, final validation |
| src/services/speech/azure-speech-batch.service.ts | Batch lifecycle thật, discovery, replay protection, parser/errors |
| src/services/media-compute.ts; workers/media-ai/ | Local subprocess/ACA adapter, Python storage contract, image model build |
| src/services/media-processor.ts, r2.ts, storage/ | Probe/cancel/audio validation và presign/download semantics |
| src/services/subtitle-pipeline.ts | Route V2 khi flag bật, giữ legacy |
| src/services/subtitle-splitter.ts, pinyin.ts, translator.ts | Word-aware split, contextual mapping, safe bounded translation |
| src/services/revision-commit.ts, models/subtitle-track.model.ts, processing-job.model.ts | Metadata, reserved revisions, transactions và cleanup lock |
| src/queue/video.queue.ts, workers/video-processing.worker.ts | Atomic failure, lease recovery, standalone/drain và cancellation |
| src/routes/admin.routes.ts, logger.ts, middleware/error-handler.ts | Safe status responses, editor metadata, redaction |
| src/config/env.ts, .env.example, package.json, .gitignore | Guardrails, cleanup command và ignored runtime data |
| scripts/cleanup-processing-artifacts.ts, verify-pipeline-runtime.mjs | Retention/retry lock và isolated compiled-server smoke |
| azure/main.bicep, main.parameters.json, modules/container-app.bicep, media-job.bicep | One worker replica, identity client ID, transactions và manual compute |
| Pipeline/Speech/media regression and local/live test files | Assertions cho paths ở matrix, cloud opt-in only |
| docs/pipeline-v2-*.md, video-processing-pipeline.md, azure-student-deployment.md | Traceability, operating limits và bàn giao |

Không thêm Node runtime dependency; reuse lockfile/package hiện có. Python dependencies pin riêng trong media image. Không chạy npm ci lại trên node_modules đang có.

## 6. Database changes

ProcessingJob có steps/checkpoint/artifacts/metrics, pipelineVersion default2, mediaType AUTO, Azure self/ID và artifactCleanupLockUntil. Dùng unique sparse activeKey, queue/status/lease indexes hiện có. Không TTL-delete job/checkpoint tự động.

Subtitle cue thêm rawText, normalizedText, quality, needsFineAlignment; karaoke token thêm pinyin/timingSource/approximate. Fields cũ giữ nguyên. Editor giữ metadata khi cue không đổi và invalidates karaoke timing khi sửa nội dung/thời gian.

Không bulk migrate destructive: checkpoint-migration chuyển cached segments/finalCues cũ khi đọc. Completed paid step thiếu output không thể khôi phục dừng CHECKPOINT_OUTPUT_MISSING thay vì submit mới. Commit giữ revision trong job, upsert theo lessonId+revision. Replica set transaction được test thật; standalone fallback chỉ đảm bảo retry repair, không multi-document atomicity. Tạo/check indexes staging trước rollout bằng quy trình db:indexes hiện có.

## 7. Env required

Danh sách REQUIRED / OPTIONAL / PRODUCTION ONLY đầy đủ và default thật nằm trong [deployment environment table](azure-student-deployment.md#environment-actually-consumed).

Tối thiểu cho V2: Mongo/auth/R2 config, AZURE_SPEECH_KEY/REGION, AZURE_TRANSLATOR_KEY/REGION, V2=true và Batch=true. Remote Demucs cần MEDIA_COMPUTE_PROVIDER=azure-container-apps, AZURE_MEDIA_JOB_RESOURCE_ID và AZURE_CLIENT_ID khi dùng user-assigned identity. Production dùng DISABLE_TRANSACTIONS=false và các biến HTTPS/cookie/SMTP/metrics do env validator yêu cầu.

AZURE_TEST_AUDIO_URL và RUN_AZURE_INTEGRATION_TESTS chỉ dành opt-in live test. Không lưu credentials thật trong báo cáo hoặc repository.

## 8. Azure resources required

Speech và Translator; backend Container App/environment, identity, Key Vault và logging theo IaC hiện có. Optional manual media Job nếu dùng Demucs production. MongoDB và R2 là dependencies ngoài Azure. Không cần persistent GPU/VM hoặc Redis queue. Module media không tự deploy từ main; runbook ghi command/parameters/RBAC cụ thể.

## 9. Test results

Chạy trên Windows, Node22.11.0, Python3.13.3; Mongo8.2 replica set local. Media image hướng Python3.11.

| Check | Command | Kết quả |
|---|---|---|
| Backend typecheck | npm run typecheck | PASS |
| Backend unit/mock | node node_modules/vitest/vitest.mjs run --pool=threads | PASS: 53 files, 273 tests; 9 skipped |
| Local DB/FFmpeg | RUN_LOCAL_PIPELINE_INTEGRATION_TESTS=true; node node_modules/vitest/vitest.mjs run src/services/pipeline/local-runtime.integration.test.ts --pool=threads | PASS: 5 tests |
| Backend build | npm run build | PASS |
| Backend runtime | node scripts/verify-pipeline-runtime.mjs | PASS: /health và /api/v1/health HTTP200, DB connected |
| Python contract | python -m unittest discover -s backend/workers/media-ai -p test_main.py | PASS: 3 tests; mock Demucs subprocess |
| Frontend typecheck | node node_modules/typescript/bin/tsc --noEmit | PASS |
| Frontend unit | node node_modules/vitest/vitest.mjs run | PASS: 8 files, 31 tests |
| Frontend build | node node_modules/vite/bin/vite.js build | PASS; existing large-chunk/Zod annotation warnings |
| IaC | az bicep build main.bicep và media-job.bicep | PASS; 2 unused-parameter warnings trong modules hiện có |
| Lint | Không có backend lint script/config workflow tương ứng | NOT RUN; không tuyên bố lint PASS |
| Whitespace/diff | git diff --check | PASS |
| Scoped source scan | TODO/FIXME/stub/debug/credential-pattern scan trên pipeline/media additions | Không thấy production stub hoặc hardcoded provider secret; không phải full security audit |
| Docker build | Docker CLI có, daemon unavailable | NOT RUN |
| Azure live | Dedicated opt-in test | PENDING; chưa gọi dịch vụ thật |

9 skipped gồm 5 local integration tests khi chưa bật flag, 1 Azure live test và 3 test skip có sẵn. Local5 đã chạy riêng thành công. Default npm test dùng forks gặp Windows kill EPERM khi teardown dù assertions pass; direct Vitest --pool=threads kết thúc exit0. PowerShell npm launcher không truyền pool argument như dự kiến, nên command trực tiếp ở trên là evidence chuẩn.

Runtime có hai warning khởi tạo Gemini thiếu API key trong env test; health vẫn đạt, không có provider call. pnpm launcher truy cập ngoài sandbox bị EPERM; frontend xác minh bằng local node entrypoints. Không chạy browser E2E với provider staging.

## 10. Cost safety check

| Guardrail | Bound/behavior |
|---|---|
| ASR submissions | MOVIE/PODCAST thường1; MUSIC tối đa2 (primary+secondary); pre-separation tối đa1 |
| Demucs | Tối đa1 intent/execution mỗi durable job; chỉ MUSIC; platform retries0 |
| Fine alignment | 0; fallback explicit, không compute ẩn |
| Retry | Queue tối đa3 attempts mặc định; GET/provider reads có giới hạn; POST Speech không replay |
| Poll | 2/4/8/16/30s Speech, deadline và abort; không loop vô hạn |
| Video | ≤420s cho mọi mode V2; audio format validation trước billing |
| Translation | Batch100 cues/50k chars; saved batches reused; uncertain outcome blocks replay |
| Concurrency | 1 mỗi process, main deployment1 worker replica; scheduled executions không được overlap |
| Retention | Default24h với cleanup schedule; active jobs và retry lock bảo vệ artifacts |
| Scale zero | Media Job on demand; embedded API min1 có lý do queue poll; API zero cần external scheduled drain worker |
| Metrics | ASR/Demucs intent upper bounds, confirmed translated chars, elapsed times/quality; không phải hóa đơn |

Các giới hạn là cho một durable job/generation. Retry job cũ giữ ngân sách/intents. Admin chủ động tạo generation mới có thể phát sinh chi phí mới; không cam kết giới hạn tính phí suốt vòng đời video. Crash giữa provider success và local persistence có thể tạo trạng thái không rõ kết quả; policy dừng để reconcile, không hứa exactly-once phía Azure.

## 11. Known limitations

- Chưa chạy image/weights Demucs thật: 2CPU/4Gi/900s là cấu hình khởi đầu, cần đo trên media mục tiêu.
- Chưa xác thực credentials, regional Whisper availability, remote signed-URL reachability, ACA/R2 permissions hoặc invoice.
- Fine alignment không có engine; token interpolation được đánh dấu, strict mode bỏ token chưa chắc chắn. Spec cho phép fallback review.
- V2 không tự tạo drama diarization labels; giữ characters hiện có, yêu cầu review. Legacy vẫn giữ diarization path.
- V2 tạo quiz fill_blank theo HSK/per-lesson count. Các bước Gemini rewrite/tips/quiz enhancement tự động thuộc legacy không chạy ngầm trong V2; công cụ admin AI hiện có vẫn riêng biệt.
- Translator không có reconciliation ID; outcome mạng không rõ cần operator xác nhận trước khi reset pending. Speech/ACA intent không có URL/execution cũng có thể cần đối soát thủ công.
- Standalone Mongo fallback không atomic; production cần replica set transaction. Concurrency bound là per worker, không có global semaphore cho nhiều replicas.
- Artifact deletion cần lịch chạy; không tự triển khai scheduler. Raw Azure results hết retention không được tự thay bằng một request tính phí mới.

## 12. Remaining manual actions

1. Bật Docker daemon/build runner, build media image và chạy separation với WAV44.1k thật; đo RAM/runtime/output.
2. Cấp Speech/Translator, R2, Mongo replica set và Key Vault secrets; xác nhận model zh-CN phù hợp khu vực.
3. Publish image, deploy optional media Job và cấu hình managed identity/RBAC/env theo runbook.
4. Chạy opt-in Azure live test, sau đó admin staging scenarios và restart/retry; giữ durable state file khi test lại.
5. Thiết lập lịch cleanup, budget alerts và single-worker deployment; nếu cần API scale-zero, provision scheduled drain worker.
6. Review thay đổi trong worktree cùng các thay đổi có sẵn trước commit/rollout.

Đây là các bước môi trường/triển khai/xác minh bên ngoài, không che giấu code TODO. Checklist tiếp tục tại [pipeline-v2-handoff.md](pipeline-v2-handoff.md).

