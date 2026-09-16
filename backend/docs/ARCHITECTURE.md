# HanFlix backend architecture

## Boundary

The API owns authentication, authorization, canonical learning content, progress, quiz scoring, SRS scheduling, AI request validation and R2 upload authorization. The browser owns video playback UI and sends bounded playback ranges; it never receives MongoDB, R2 or Gemini secrets.

## Main flows

### Learner

1. Register/login. Access JWT is returned to the client; refresh JWT is rotated in an HttpOnly cookie and its SHA-256 hash is stored in MongoDB.
2. Read a published lesson and its published subtitle/quiz revision.
3. Record continuous watched ranges. Completion requires at least 90% union coverage; seeking to the end is insufficient.
4. Save a word only when `wordId` is present in the selected published subtitle cue.
5. Quiz answers are graded server-side. Answer keys are not returned by the public quiz endpoint.
6. SRS dates are computed on the server from Again/Hard/Good/Easy ratings.
7. Recommendations are deterministic from profile/catalog/progress. Gemini explains language context but cannot select arbitrary database IDs or make authorization decisions.

### Admin/video

1. Create lesson metadata draft.
2. Request a short-lived R2 presigned PUT URL scoped to one object key and MIME type.
3. Browser uploads directly to R2 with the exact signed `Content-Type`.
4. Confirm the object; API verifies it with `HeadObject` and moves the lesson to `processing`.
5. A production worker must perform media inspection/transcription/Pinyin/translation and create draft subtitle/quiz revisions. This worker is intentionally outside the HTTP request and is not falsely simulated here.
6. Admin reviews content. Publish is blocked unless media, subtitle cues and quiz questions exist; publishing activates immutable revision numbers.

## Collections

- `users`: account, role/status and normalized learning profile.
- `refreshsessions`: rotated refresh-token hashes with TTL expiry.
- `lessons`: canonical catalog metadata, R2 object reference and active published revisions.
- `processingjobs`: persistent queue state for the future media worker; upload confirmation creates a queued job.
- `subtitletracks`: versioned, draft/published 3-layer cues and word-token references.
- `words`: canonical Hanzi/Pinyin/Vietnamese entries.
- `quizzes`: versioned questions and server-only answer keys.
- `progresses`: last position, merged watched ranges, completion and best score.
- `quizattempts`: idempotent graded submissions.
- `savedwords`: unique user-word record and SRS schedule.

## Production follow-ups

- Add a durable queue/worker (for example Redis + BullMQ) before implementing real video processing.
- Add an email provider and one-time reset-token collection before presenting password reset as delivered.
- Add R2 multipart upload for files above the current MVP limit.
- Add integration tests against a disposable MongoDB database and an R2 staging bucket.
- Add structured logs/metrics/traces, secret manager, backups and deployment health checks.
- Replace the in-memory rate-limit store with a shared store before running multiple API instances.
- Decide retention for hidden/deleted videos, raw uploads, AI prompts and account deletion.
