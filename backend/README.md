# HanFlix backend

Express 5 + TypeScript API for learning Chinese through short videos. MongoDB Atlas stores application data and durable processing jobs; Cloudflare R2 stores media; Azure Speech produces Mandarin transcripts; `pinyin-pro` generates Pinyin; Azure Translator produces Vietnamese subtitles; Gemini is limited to contextual explanation and optional recommendation reranking.

## Implemented MVP

- JWT access token and rotating HttpOnly refresh sessions. Password registration requires email verification; Google ID-token sign-in uses Google's verified email.
- Nodemailer SMTP verification, resend, forgot/reset password and authenticated password change with one-time hashed tokens.
- User/admin authorization and account locking.
- Admin lesson drafts and direct R2 presigned video uploads.
- Admin draft review APIs for subtitles and quiz content before publication.
- Asynchronous MongoDB-backed processing with duplicate protection, retries and stale-job recovery.
- FFmpeg audio extraction, Azure Speech phrase timestamps, deterministic Pinyin and Azure Vietnamese translation.
- Draft subtitle/quiz review gate before publication.
- Learner catalog, playback progress, idempotent quiz grading, vocabulary/SRS, dashboard and recommendations.
- Lightweight liveness, readiness and Prometheus metrics.

## Local development

Requirements: Node.js 22+, MongoDB Atlas or a local replica-set-compatible MongoDB, and FFmpeg. The npm FFmpeg packages support local development; the Docker image also installs system FFmpeg.

```powershell
cd E:\Hanflix\backend
Copy-Item .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

The default `VIDEO_WORKER_MODE=embedded` starts the API and worker together. To run them separately:

```powershell
# API terminal
$env:VIDEO_WORKER_MODE='disabled'
npm run dev

# Worker terminal, after npm run build
$env:VIDEO_WORKER_MODE='standalone'
npm run worker
```

## Processing flow

```text
Admin creates lesson
  -> API signs R2 upload
  -> browser uploads directly to R2
  -> API confirms object and queues MongoDB job
  -> worker downloads to a temp directory
  -> FFmpeg extracts mono 16 kHz WAV
  -> Azure Speech fast transcription (zh-CN)
  -> local Pinyin
  -> Azure Translator (zh-Hans -> vi)
  -> MongoDB subtitle/quiz drafts
  -> admin review and publish
```

Temporary files are removed after success or failure. Learner playback reads stored data and never invokes Speech or translation APIs.

## Environment

Use [.env.example](./.env.example). Required production groups:

- Application: `PORT`, `NODE_ENV`, `APP_ORIGINS`.
- MongoDB: `MONGODB_URI`, `MONGODB_DB_NAME`.
- Auth: independent `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, secure cookie settings.
- Google sign-in: `GOOGLE_CLIENT_ID` is the Web OAuth client ID; the server verifies audience and issuer.
- Email: `APP_PUBLIC_URL`, SMTP host/port/TLS/user/password/from and verification/reset TTL values.
- R2: account ID, S3 key/secret, bucket, endpoint and optional public base URL.
- Azure Speech: key, region, resource endpoint, locale and API version.
- Azure Translator: key, region and endpoint.
- Processing: mode, maximum retries, timeout and poll interval.
- Gemini: optional for explanation and AI reranking; not used for transcription or translation.

Never expose backend secrets to the frontend or commit `.env`. The Google Web client ID is public and is returned by `GET /auth/providers`.

## API surface

| Area | Routes |
|---|---|
| Health | `GET /health`, `GET /api/v1/health`, `GET /metrics` |
| Auth | `POST /auth/register`, `/verify-email`, `/resend-verification`, `/login`, `/google`, `/google/link`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/change-password`; `GET /auth/me`, `/auth/providers` |
| Profile | `GET /profile`, `PUT /profile/learning` |
| Catalog | `GET /lessons`, `/lessons/:id`, `/lessons/:id/subtitles`, `/lessons/:id/quiz` |
| Learning | `GET/PATCH /lessons/:id/progress`, `POST /lessons/:id/attempts` |
| Vocabulary | `GET/POST /vocabulary`, `GET /vocabulary/due`, `DELETE /vocabulary/:wordId`, `POST /vocabulary/:wordId/review` |
| Dashboard | `GET /learning/dashboard`, `/learning/recommendations`; `POST /learning/recommendations/ai` |
| Gemini | `POST /ai/explain` |
| Admin | lesson create/list/detail/update/publish, draft review/update, private media preview, R2 presign/confirm, processing status/retry, user list/status |

Existing routes remain compatible. The alias `POST /admin/videos/:lessonId/retry-processing` is also available. Admin lesson responses expose `processingStatus`, `processingProgress`, `processingStep` and `processingError` without leaking provider-specific details.

Google Identity Services on the frontend sends its ID token as `{ "credential": "..." }` to `POST /api/v1/auth/google`. New Google users are registered automatically with role `user`; existing linked users receive the same `{ accessToken, user }` response as password login. A verified Google email can claim a still-unverified password signup. For an established password account, the API returns `GOOGLE_LINK_REQUIRED`: sign in with password, open Account Settings > Security and link Google with a fresh ID token. Configure the Web OAuth client ID in backend `GOOGLE_CLIENT_ID`; the frontend fetches it from `GET /auth/providers`. Add the frontend origin to Google Cloud's authorized JavaScript origins. No Google client secret is needed for ID-token verification.

Password registration returns `{ user, verificationRequired: true }` and does not create a session until the email is verified by OTP or link. Forgot-password responses are deliberately generic to avoid revealing whether an email exists. See [email auth setup](./docs/EMAIL_AUTH.md) for SMTP variables, endpoint contracts and Azure secret configuration. Gemini explanation and recommendation reranking use the configured `GEMINI_MODEL` API ID; the current tested choice is `gemini-3.5-flash-lite`.

Admin draft review: `GET /api/v1/admin/lessons/:lessonId/review` returns the current subtitle and quiz drafts, including answer keys. `PUT /api/v1/admin/lessons/:lessonId/subtitles` accepts `{ cues: [...] }`; `PUT /api/v1/admin/lessons/:lessonId/quiz` accepts `{ questions: [...] }`. Only admins can call these routes, and edits are blocked after publish. When Chinese cue text changes, token-to-word references are cleared for that cue to prevent stale lookups; the remaining vocabulary mapping can be curated in a later API phase.

`GET /api/v1/admin/lessons/:lessonId/media` gives an admin a playback URL for review without returning the R2 object key. `GET /api/v1/lessons/:lessonId/progress` returns the authenticated learner's saved position, watched coverage, completion state and best quiz score; it returns zero-valued defaults before the first progress update.

Before enabling Google login in production, verify MongoDB has built the unique sparse `users.googleSub` index. Existing password users require no data rewrite; they can link Google explicitly after signing in.

## R2 setup

1. Create one private bucket and an S3 API token scoped to that bucket.
2. Set R2 environment values only on the backend.
3. Apply [config/r2-cors.example.json](./config/r2-cors.example.json) with the real admin frontend origin.
4. The upload sequence is create lesson → presign → browser PUT with exact `Content-Type` → confirm.

Keep `R2_PUBLIC_BASE_URL` unset when media must remain private; download and admin-preview URLs will then be short-lived signed URLs.

## Azure setup

1. Create an Azure Speech resource in a region supporting fast transcription.
2. Set its resource-specific endpoint such as `https://RESOURCE.cognitiveservices.azure.com` and locale `zh-CN`.
3. Create Azure Translator and set its key/region/endpoint.
4. Store all keys as Container Apps secrets.

External provider failures never create sample subtitles. The job records an error code/message and moves to `FAILED` after bounded retries.

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

Automated Speech tests mock Azure. Live R2/Speech/Translator checks require staging credentials and a real video.

## Docker and Azure Container Apps

```powershell
docker build -t hanflix-backend:latest .
docker run --rm -p 4000:4000 --env-file .env hanflix-backend:latest
```

See [Azure Container Apps deployment](./docs/AZURE_CONTAINER_APPS.md) and [architecture](./docs/ARCHITECTURE.md).

The remaining API work is prioritized in [API roadmap](./docs/API_ROADMAP.md).

## Remaining production work

- Test OTP and reset delivery against a real inbox before launch; SMTP connection verification alone does not prove delivery.
- Run integration tests against disposable MongoDB and R2 staging resources.
- Add backup/retention policies and restrict `/metrics` at the platform/network layer.
- For strict background latency when the HTTP app is scaled to zero, schedule the worker as a Container Apps Job or run one standalone worker replica.
