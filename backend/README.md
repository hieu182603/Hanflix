# HanFlix backend

Express + TypeScript API for the HanFlix Student MVP. It implements the requested base stack: JWT, MongoDB Atlas, Cloudflare R2, Zod, rate limiting and Gemini.

## Requirements implemented

- Access JWT plus rotating refresh JWT in an HttpOnly cookie; refresh tokens are stored only as hashes.
- User/Admin authorization and account locking.
- Published lessons with Chinese/Pinyin/Vietnamese subtitle revisions and token-to-word references.
- Contextual word lookup foundation, saved vocabulary and server-side SRS.
- Server-scored, idempotent post-video quiz attempts.
- Playback position, continuous watched ranges and 90% completion policy.
- Dashboard metrics, deterministic fallback recommendations and Gemini-validated reranking.
- Gemini contextual explanation with bounded input, JSON-only response and Zod validation.
- Admin lesson drafts and R2 presigned direct upload/confirmation.
- Publish gate requiring media, reviewed subtitles and quiz content.

## Local setup

```powershell
cd E:\Hanflix\backend
Copy-Item .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Fill `.env` before starting. The API will refuse to boot when MongoDB/JWT settings are absent or weak. `GET /api/v1/health` returns `503` until MongoDB is connected.

### MongoDB Atlas

1. Create an Atlas cluster and a least-privilege database user.
2. Allow only the API deployment IP/network access; do not use an unrestricted list in production.
3. Put the SRV string in `MONGODB_URI` and database name in `MONGODB_DB_NAME`.
4. Run `npm run seed` only after changing `SEED_ADMIN_PASSWORD`. The seed imports only content-ready learning material as published; incomplete fixture lesson metadata remains draft.

### Cloudflare R2

1. Create a bucket and an R2 S3 API token limited to that bucket.
2. Configure `R2_ACCOUNT_ID`, key ID, secret and bucket name. Keep them only on the API/secret manager.
3. Apply [config/r2-cors.example.json](./config/r2-cors.example.json) after replacing origins.
4. Upload flow: create lesson → request `/admin/uploads/presign` → browser PUT with the returned exact `Content-Type` → call `/admin/uploads/confirm`.

### Gemini

Set `GEMINI_API_KEY` and a model available to your Google AI project in `GEMINI_MODEL`. Gemini is used only for bounded language explanations. Recommendations remain deterministic so unavailable AI never blocks core learning.

## API surface

| Area | Routes |
|---|---|
| Health | `GET /api/v1/health` |
| Auth | `POST /auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`; `GET /auth/me` |
| Profile | `GET /profile`, `PUT /profile/learning` |
| Catalog | `GET /lessons`, `/lessons/:id`, `/lessons/:id/subtitles`, `/lessons/:id/quiz` |
| Learning | `PATCH /lessons/:id/progress`, `POST /lessons/:id/attempts` |
| Vocabulary | `GET/POST /vocabulary`, `GET /vocabulary/due`, `DELETE /vocabulary/:wordId`, `POST /vocabulary/:wordId/review` |
| Dashboard | `GET /learning/dashboard`, `/learning/recommendations`; `POST /learning/recommendations/ai` |
| Gemini | `POST /ai/explain` |
| Admin | lesson draft/update/publish, R2 presign/confirm, user list/status |

Protected endpoints use `Authorization: Bearer <accessToken>`. Requests that mutate attempts include a client-generated `idempotencyKey` in the JSON body.

## Current limits

This setup does not claim working email delivery, real ASR/video transcription, Pinyin generation, translation, speech scoring, background jobs or production persistence tests. Those need external credentials/services and a worker. The current R2 route signs direct uploads and verifies stored objects; it does not proxy video bytes through Express.

Architecture decisions and the worker boundary are documented in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
