# Backend API roadmap

This list is based on the current Express routes and frontend API usage. Keep `/api/v1` and existing response shapes while adding endpoints.

## Implemented in this iteration

- `POST /auth/google`: verify Google ID token, register or sign in, issue normal HanFlix tokens.
- `POST /auth/google/link`: link a verified Google subject to an authenticated existing account with matching email.
- `GET /auth/providers`: expose the public Google Web client ID to the browser without duplicating configuration.
- `GET /admin/lessons/:id/review`: fetch subtitle and quiz drafts for review.
- `PUT /admin/lessons/:id/subtitles`: edit draft cues before publish.
- `PUT /admin/lessons/:id/quiz`: edit draft questions and answer keys before publish.
- `GET /admin/lessons/:id/media`: get a playback URL without exposing object keys. Keep `R2_PUBLIC_BASE_URL` unset for signed private URLs.
- `GET /lessons/:id/progress`: resume a published lesson and read coverage/completion/quiz score.
- `POST /auth/verify-email` and `/auth/resend-verification`: one-time email verification by link or six-digit OTP.
- `POST /auth/forgot-password` and `/auth/reset-password`: generic recovery request plus single-use link or six-digit OTP.
- `POST /auth/change-password`: authenticated password change, old-session revocation and replacement session.
- `POST /admin/lessons/:id/hide` and `/restore`: reversible catalog visibility without deleting progress.
- `GET /learning/activity?from=&to=`: UTC daily study time, progress updates, quiz attempts and completed lessons.
- `GET /admin/processing-jobs`: filtered, paginated operational queue view without object keys.
- `POST /admin/lessons/:id/upload/cancel`: abandon a pending upload, delete its exact R2 object and restore the draft.
- `GET /auth/sessions` and `DELETE /auth/sessions/:id`: list and revoke refresh sessions.
- `POST /auth/password/set` and `/auth/google/unlink`: preserve at least one usable login method.

## P0 — Complete the core learning flow

1. Keep the post-video quiz as a soft gate: the UI should recommend the quiz after playback, while the API remains accessible. A hard gate would depend too heavily on client-supplied telemetry.
2. Add integration coverage for concurrent progress completion and analytics event delivery.

Recommended MVP behavior: offer the quiz after playback as a soft gate; keep the attempt endpoint accessible. A hard gate would need reliable watched-time telemetry, not just client-supplied ranges.

## P1 — Admin content quality and retry operations

1. `POST /admin/lessons/:id/subtitles/:cueId/words`: curate multi-character word boundaries and canonical meanings; current generated tokens are character-level and not pedagogically complete.
2. `POST /admin/lessons/:id/thumbnail/presign` and confirmation: thumbnail storage/preview if automated generation is not sufficient.
3. `POST /admin/lessons/:id/reprocess`: create a new draft revision for published content, preserving active published revisions until review. Current retry is intended only for failed initial processing.
4. Add scheduled expiry recovery for abandoned uploads when an admin does not explicitly cancel them.

## P2 — Account, sessions and retention

1. Email-change flow with verification of the new address before replacing the current login email.
2. Account data export/deletion and media-retention endpoints after product policy is defined.

## P3 — Production reliability and operations

1. Move email delivery to a durable outbox/worker with bounded retries; add provider delivery/bounce webhooks and suppression handling.
2. Add admin audit events for lesson publish/hide/reprocess and account lock/unlock.
3. Add cursor pagination to admin users/lessons and learner activity history.
4. Add OpenAPI generation and contract tests for all `/api/v1` response/error shapes.
5. Keep provider smoke checks repeatable in staging and add them to a manual release checklist; CI must continue to use mocks.

## Cross-cutting acceptance criteria

- All admin routes require both auth and admin role; learner routes never return draft content or quiz answer keys.
- MongoDB indexes support new filters; mutations validate input with Zod.
- Replay/idempotency behavior is documented for uploads, quiz attempts, retries and Google linking.
- Integration tests cover MongoDB state transitions, R2 confirmation and worker restart recovery. Provider calls are mocked in CI; live staging tests require credentials.

## Delivery order

1. Complete P0 and add route/integration tests for hidden lessons, activity aggregation and progress resume.
2. Complete P1 on a staging R2/MongoDB environment with a real 1–5 minute video and an admin review pass.
3. Complete remaining account/session APIs and validate Google sign-in, OTP delivery and reset against real staging accounts.
4. Complete production operations after email provider, privacy and retention policies are chosen.
