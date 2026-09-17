# Azure Container Apps deployment

## MVP topology

Use one HTTP Container App with `VIDEO_WORKER_MODE=embedded`. The upload confirmation request wakes the app and the embedded MongoDB-backed worker claims the persistent job. A restart does not lose queued jobs; stale running jobs are recovered on the next worker start. This avoids Redis and a permanently running worker for the expected workload of at most 50 short videos per month.

If processing volume grows, deploy the same image as a separate Container App or scheduled Container Apps Job with `VIDEO_WORKER_MODE=standalone`, and set the API app to `VIDEO_WORKER_MODE=disabled`.

## Build and push

```powershell
cd E:\Hanflix\backend
docker build -t hanflix-backend:latest .
docker run --rm -p 4000:4000 --env-file .env hanflix-backend:latest
```

Push the image to Azure Container Registry:

```powershell
az acr build --registry <registry-name> --image hanflix-backend:latest .
```

## Create the Container App

Create a Consumption environment and deploy the image with external ingress on the environment `PORT`. Suggested MVP sizing:

- CPU: 0.5 to 1 vCPU
- Memory: 1 to 2 GiB
- Minimum replicas: 1 when `VIDEO_WORKER_MODE=embedded`
- Maximum replicas: 2
- HTTP concurrency: 10
- Health probe: `/health`

Store MongoDB, SMTP, R2, Azure Speech, Azure Translator and JWT values as Container Apps secrets. Map them to environment variables; never put credentials in the image. SMTP should normally use authenticated port 587 with STARTTLS; set `APP_PUBLIC_URL` to the public frontend origin so verification/reset links are correct.

Set `GOOGLE_CLIENT_ID` to the Web OAuth client ID and add the deployed frontend origin to Google Cloud's authorized JavaScript origins. The frontend reads this public ID from `GET /api/v1/auth/providers`. Set `GEMINI_MODEL` to an API model ID such as `gemini-3.5-flash-lite`; the human-facing model display name is not valid here.

With an embedded worker, keep at least one replica running so queued jobs and stale-job recovery continue without another HTTP request. If the platform stops or replaces a replica, MongoDB stale-job recovery returns unfinished work to the queue when a worker starts again. If the API must scale to zero, deploy a separate always-on worker; do not rely on another user request to wake pending video jobs.

## Manual cloud setup

1. MongoDB Atlas: create the database user, network access and indexes.
2. Cloudflare R2: create the bucket, scoped S3 token and CORS policy.
3. Azure Speech: create a Speech resource that supports fast transcription and copy its key, region and resource endpoint.
4. Azure Translator: create a Translator resource and copy its key, region and endpoint.
5. Azure Container Registry: build/push the image.
6. Azure Container Apps: create secrets, environment variables, ingress, scale limits and the `/health` probe.
7. Transactional email: configure SMTP credentials, verify with `npm run email:verify`, then test verification and password reset against a real inbox. Configure SPF, DKIM and DMARC with the provider.
