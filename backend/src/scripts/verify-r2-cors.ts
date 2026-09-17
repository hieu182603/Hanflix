import { env } from '../config/env.js';
import { storageService } from '../services/storage/r2-storage.service.js';

async function main() {
  const origins = env.APP_ORIGINS;
  const { uploadUrl } = await storageService.createUploadUrl('diagnostics/cors-preflight-only.mp4', 'video/mp4');
  let failures = 0;

  for (const origin of origins) {
    const response = await fetch(uploadUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    const allowedOrigin = response.headers.get('access-control-allow-origin');
    const allowedMethods = response.headers.get('access-control-allow-methods')?.toUpperCase() ?? '';
    const allowedHeaders = response.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
    const ok = response.ok && allowedOrigin === origin && allowedMethods.includes('PUT') && allowedHeaders.includes('content-type');
    if (!ok) failures++;
    console.log(JSON.stringify({ origin, status: response.status, allowedOrigin, allowedMethods, allowedHeaders, ok }));
  }

  if (failures) {
    console.error(`${failures}/${origins.length} R2 CORS preflight checks failed. No object was uploaded.`);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
