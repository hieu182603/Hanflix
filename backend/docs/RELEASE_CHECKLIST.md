# Backend release checklist

## 1. Required operator configuration

- Set the actual HTTPS frontend origin in `APP_PUBLIC_URL` and every permitted frontend origin in `APP_ORIGINS`; set `COOKIE_SECURE=true`. Choose `COOKIE_SAME_SITE=none` only if frontend and API are cross-site, and test refresh login in a real browser. Set `COOKIE_DOMAIN` only when both hosts should share it.
- Generate distinct production JWT secrets, a new `METRICS_TOKEN` (at least 32 characters), and a non-default `SEED_ADMIN_PASSWORD`. Keep all values in platform secrets, not Git or the image.
- Set production MongoDB, SMTP, R2, Azure Speech/Translator, Gemini and Google OAuth values. Use `VIDEO_WORKER_MODE=embedded` with at least one running API replica, or a separate always-on worker.
- Apply the exact frontend origins and `PUT`/`Content-Type` rule in the R2 bucket CORS policy; use [the example](../config/r2-cors.example.json) as a starting point. Keep `R2_PUBLIC_BASE_URL` blank for private videos.

The local development `.env` is intentionally not production-ready. `NODE_ENV=production` rejects insecure origins/cookies, missing metrics token and the default seed password.

## 2. Local and container gates

From `backend`: `npm run typecheck`, `npm test`, `npm run build`, `npm audit --omit=dev`, `npm run email:verify`, and `npm run r2:cors:verify`. The final command must succeed for every `APP_ORIGINS` value before browser upload can work.

Build the Docker image and check `/health` plus `/api/v1/health` with the actual runtime environment. Run a short video through the worker and verify the lesson reaches `ready_for_review`, subtitle/quiz drafts exist, and every non-null subtitle `wordId` resolves to `Word`. Check retry and restart behavior in an isolated database. The local-only `scripts/diagnostics/verify-docker-pipeline.ts` script requires a unique `HANFLIX_VERIFY_RUN_ID` and a matching `MONGODB_DB_NAME=hanflix_codex_verify_<run-id>`; `cleanup` removes only that diagnostic database and R2 object after validating scope. It is not included in the production Docker image.

## 3. Live release gates

- In a real browser, perform admin upload (presign → R2 PUT → confirm), preview, subtitle/quiz review, publish, learner playback, contextual word explanation, save word and SRS review. A CORS preflight test does not replace this.
- Use an authorized test inbox for registration verification, forgot-password and reset links; verify sender SPF/DKIM/DMARC. `npm run email:verify` checks only SMTP connectivity.
- Complete Google sign-in/link/unlink with an authorized account and the deployed frontend origin configured in Google Cloud.
- Exercise admin role denial, upload cancellation/retry, and protected `/metrics` with the operations token.
- Confirm MongoDB backup policy and perform a restore rehearsal into a separate test database. Set alerts for unhealthy API, failed jobs, queue age, provider errors and storage limits.

Do not mark production deployment complete until the platform, frontend/API domains, CORS rule, browser flow and restore target have been provided and verified.
