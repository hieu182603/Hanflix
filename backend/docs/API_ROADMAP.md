# Backend API roadmap

This list is based on the current Express routes and frontend API usage. Keep `/api/v1` and existing response shapes while adding endpoints.

## Implemented in this iteration

- `POST /auth/google`: verify Google ID token, register or sign in, issue normal HanFlix tokens.
- `POST /auth/google/link`: link a verified Google subject to an authenticated existing account with matching email.
- `GET /admin/lessons/:id/review`: fetch subtitle and quiz drafts for review.
- `PUT /admin/lessons/:id/subtitles`: edit draft cues before publish.
- `PUT /admin/lessons/:id/quiz`: edit draft questions and answer keys before publish.
- `GET /admin/lessons/:id/media`: get a playback URL without exposing object keys. Keep `R2_PUBLIC_BASE_URL` unset for signed private URLs.
- `GET /lessons/:id/progress`: resume a published lesson and read coverage/completion/quiz score.
- `POST /auth/verify-email` and `/auth/resend-verification`: one-time email verification for password registrations.
- `POST /auth/forgot-password` and `/auth/reset-password`: generic recovery request plus single-use reset token.
- `POST /auth/change-password`: authenticated password change, old-session revocation and replacement session.

## P0 — Complete the core learning flow

1. `POST /admin/lessons/:id/hide` and `POST /admin/lessons/:id/restore`: hide published mistakes without deleting historical progress; learner catalog must exclude hidden lessons.
2. Add `GET /learning/activity?from=&to=` for daily study time, quiz attempts and completed lessons; dashboard can then render real charts/streaks.
3. Enforce or explicitly document the post-video quiz gate: currently quiz endpoint and attempt submission do not require 90% coverage. Decide whether quiz access is blocked until completion or merely suggested.

Recommended MVP behavior: offer the quiz after playback as a soft gate; keep the attempt endpoint accessible. A hard gate would need reliable watched-time telemetry, not just client-supplied ranges.

## P1 — Admin content quality and retry operations

1. `POST /admin/lessons/:id/subtitles/:cueId/words`: curate multi-character word boundaries and canonical meanings; current generated tokens are character-level and not pedagogically complete.
2. `POST /admin/lessons/:id/thumbnail/presign` and confirmation: thumbnail storage/preview if automated generation is not sufficient.
3. `GET /admin/processing-jobs?status=&page=`: operational queue view with filter and pagination.
4. `POST /admin/lessons/:id/reprocess`: create a new draft revision for published content, preserving active published revisions until review. Current retry is intended only for failed initial processing.
5. `POST /admin/lessons/:id/upload/cancel` or upload expiry recovery: clear lessons stuck in `uploading` after abandoned uploads.

## P2 — Account, sessions and retention

1. `POST /auth/google/unlink` only after user has a usable password or another login method; never leave an account with no credential.
2. `POST /auth/password/set` for authenticated Google-only users, with recent Google reauthentication before creating a password.
3. `GET /auth/sessions` and `DELETE /auth/sessions/:id` for session management.
4. Email-change flow with verification of the new address before replacing the current login email.
5. Account data export/deletion and media-retention endpoints after product policy is defined.

## P3 — Production reliability and operations

1. Move email delivery to a durable outbox/worker with bounded retries; add provider delivery/bounce webhooks and suppression handling.
2. Add admin audit events for lesson publish/hide/reprocess and account lock/unlock.
3. Add cursor pagination to admin users/lessons and learner activity history.
4. Add OpenAPI generation and contract tests for all `/api/v1` response/error shapes.
5. Add staging smoke tests for MongoDB indexes, SMTP delivery, R2 signed URLs, Azure Speech and Azure Translator.

## Cross-cutting acceptance criteria

- All admin routes require both auth and admin role; learner routes never return draft content or quiz answer keys.
- MongoDB indexes support new filters; mutations validate input with Zod.
- Replay/idempotency behavior is documented for uploads, quiz attempts, retries and Google linking.
- Integration tests cover MongoDB state transitions, R2 confirmation and worker restart recovery. Provider calls are mocked in CI; live staging tests require credentials.

## Delivery order

1. Complete P0 and add route/integration tests for hidden lessons, activity aggregation and progress resume.
2. Complete P1 on a staging R2/MongoDB environment with a real 1–5 minute video and an admin review pass.
3. Complete account/session APIs, frontend verification/reset-password pages, Google button wiring and `GOOGLE_LINK_REQUIRED` handling.
4. Complete production operations after email provider, privacy and retention policies are chosen.
