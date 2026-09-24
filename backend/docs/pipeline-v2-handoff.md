# Pipeline V2 — bàn giao để tiếp tục

Cập nhật 2026-09-24. Phần triển khai và kiểm chứng local đã hoàn thành; sẵn sàng test Azure staging. Không diễn giải trạng thái này thành “đã chạy cloud production”.

## Đọc trước khi tiếp tục

- Báo cáo đủ 12 mục + matrix cuối: [pipeline-v2-verification.md](pipeline-v2-verification.md).
- Audit ban đầu và baseline: [pipeline-v2-audit.md](pipeline-v2-audit.md).
- Kiến trúc thực tế: [video-processing-pipeline.md](video-processing-pipeline.md).
- Env/resources/deployment: [azure-student-deployment.md](azure-student-deployment.md).
- Yêu cầu gốc: C:/Users/os/.codex/attachments/91c1db1b-f375-4124-90a1-ddf50271f906/Pasted text.txt (A–AN). task.md ở root là UI, không phải pipeline spec.

Người dùng yêu cầu tiếp tục tự xử lý và để lại checklist nếu hết context. Không cần audit lại từ đầu hoặc lặp lại những bước đã đạt nếu code không đổi.

## Mốc kiểm chứng cuối

- Backend typecheck/build PASS.
- Backend Vitest --pool=threads: 53 files PASS, 273 tests PASS, 9 SKIP. Trong skip có local5 + live1 + existing3.
- Local MongoDB/FFmpeg: 5 PASS, chạy riêng có flag.
- Frontend TSC + Vitest31 + Vite build PASS.
- Python worker contract: 3 PASS; chưa chạy model Demucs thật.
- Server compiled: /health=200, /api/v1/health=200, MongoDB connected, không cloud credentials.
- Bicep main/media-job compile PASS, 2 existing unused-param warnings.
- git diff --check PASS; scoped stub/secret-pattern scan không thấy production placeholder/key.
- Docker NOT RUN vì daemon unavailable. Azure live PENDING.

## Đã xong so với checklist cũ

1. Shared V2 checkpoint cho lesson/song/podcast/drama, legacy enum adapter và migration paid output cũ.
2. Lease token/expiry fencing, atomic queue failure, heartbeat không hồi sinh expired lease, retry step attempts, real duplicate/restart tests.
3. API DTO bỏ checkpoint/lease/provider URLs, redact metrics/errors; editor giữ quality/raw/normalized/karaoke provenance.
4. Cleanup10-minute lock chặn retry, local regression xác minh lock expiry vẫn giữ paid checkpoint.
5. Speech Batch submit/discover/poll/files/content/parser; root model; raw result persist; stable name reconcile; không blind POST retry.
6. Demucs MUSIC-only one-shot, source44.1k, local subprocess cancel/timeout và remote ACA start/resume/poll/storage.
7. Managed identity AZURE_CLIENT_ID được adapter/Bicep truyền đúng; production transactions=true (DISABLE_TRANSACTIONS=false).
8. Subtitle timing/mixed zh+en/Pinyin/Translator checkpoint/vocabulary nonblocking/final validation.
9. LRC fallback, podcast chapters, stable thumbnail/playback output và quiz count theo lesson/HSK.
10. Tài liệu và report12 mục hoàn tất.
11. Đã fix thực tế Azure Speech Model Discovery & Rate Limit: Thêm filter query `locale eq 'zh-CN'` tránh paginate 14 trang gây 429; fix check `supportsTranscriptionsSubmit` của Azure API 2024-11-15 và hỗ trợ multilingual Whisper Large V2 (`en-US` catalog base model). Live test đã nhận diện thành công model `20240228 Whisper Large V2` trên japaneast.
12. Lưu ý gói cước Azure Speech: Azure Batch Transcription (`transcriptions:submit`) yêu cầu subscription gói **Standard (S0)**. Gói Free (F0) sẽ trả về lỗi `InvalidSubscription: Only "Standard" subscriptions for the region of the called service are valid`. Nếu dùng F0 để test nhanh thì chuyển `VIDEO_PROCESSING_PIPELINE_V2=false` để dùng Fast Transcription (`transcriptions:transcribe`).

## Việc còn lại ở phiên tiếp theo — external verification

1. Docker: bật daemon hoặc dùng build runner; build backend/workers/media-ai/Dockerfile. Chạy image --help rồi separation WAV44.1k thật; kiểm tra weights đã bake, CPU/RAM/time và output vocals. Không coi Python mock tests là model validation.
2. Azure/R2: chuẩn bị Speech/Translator đúng region/model, bucket và Key Vault secrets. Không in secret/signed URLs ra log.
3. Deploy optional media-job.bicep với image accessible, identity Key Vault access + registry pull và backend Job permissions. Set MEDIA_COMPUTE_PROVIDER=azure-container-apps, AZURE_MEDIA_JOB_RESOURCE_ID, AZURE_CLIENT_ID.
4. Opt-in live Speech: RUN_AZURE_INTEGRATION_TESTS=true, AZURE_TEST_AUDIO_URL cho lần đầu, chạy riêng azure-speech-batch.live.test.ts. Giữ backend/.runtime/azure-live-state.json giữa retries; malformed state phải đối soát, không xóa để submit lại.
5. Staging admin scenarios: dialogue/podcast/music/drama, crash sau submit, translation retry, BAD music/secondary, cleanup và expired artifact. Xác nhận provider call counts với Azure thực tế.
6. Thiết lập cleanup scheduler và budget alerts. Embedded API một replica; nếu API scale-zero, dùng scheduled standalone --drain worker và không cho execution overlap.
7. Review/commit/rollout cùng người dùng sau khi kiểm tra toàn bộ worktree. Task này chưa commit/stage/deploy.

Không còn code TODO đã biết trong phạm vi fallback của spec. Nếu live verification phát hiện defect, sửa và thêm regression tương ứng; không đánh dấu cloud PASS chỉ từ mock.

## Giới hạn phải giữ nguyên trong báo cáo

- Không có trained fine aligner: Azure timing + explicit approximate/review; REQUIRED mode bỏ token không chắc chắn.
- V2 drama speaker labels cần review; legacy diarization còn nguyên.
- V2 basic quiz có per-lesson count; legacy Gemini auto polish/tips/quiz enhancement không tự chạy trong V2.
- Translator delivery không rõ không thể reconcile tự động; Speech/ACA intent thiếu ID cũng có thể cần operator.
- Bound chi phí áp dụng mỗi durable generation; admin generation mới có thể tính phí mới.
- Standalone Mongo chỉ repair partial write; production dùng replica set transactions.
- Concurrency1 là per process; không có global multi-replica semaphore.

## Workspace/runtime notes

- Repo E:/Hanflix, PowerShell, Node22.11.0, Python3.13.3; media image Python3.11.
- Dependencies Node đã có; không chạy lại install. pnpm launcher ngoài sandbox bị EPERM: frontend dùng local node entrypoints.
- npm test default forks gặp kill EPERM teardown trên Windows. Lệnh chắc chắn PASS: node node_modules/vitest/vitest.mjs run --pool=threads.
- Không có backend lint script. oxfmt0.2 đã gây mất inline TypeScript member separators; code đã sửa/typecheck lại. Không rerun formatter đó toàn repo.
- Local Mongo replica set pipelineAudit dùng port27029, bind127.0.0.1, dbpath backend/.runtime/mongo, log backend/.runtime/mongod.log. Replica set đã initialize. Có thể restart mongod với các tham số đó để chạy local integration; chỉ sử dụng test DB, không .env production.
- MongoDB test PID25612 đã được dừng sau kiểm chứng; compiled-server smoke cũng đã dừng child process. Dữ liệu test local nằm trong thư mục ignored .runtime/.
- verify-pipeline-runtime.mjs dùng env riêng, không provider creds; hai Gemini missing-key startup warnings không phát sinh API call.
- .runtime/ và __pycache__/ được ignore. Live test chưa chạy, không có Azure state cần reset.
- Worktree có nhiều frontend/grammar changes không thuộc task, một số thay đổi trong lúc đang làm. Không revert/stage tất cả theo danh sách git status.
