import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { storageService } from '../../src/services/storage/r2-storage.service.js';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const objectKey = `diagnostics/cors-browser-${randomUUID()}.mp4`;
const body = 'HanFlix disposable browser CORS test';
const run = promisify(execFile);

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'hanflix-cors-browser-'));
  const { uploadUrl } = await storageService.createUploadUrl(objectKey, 'video/mp4');
  const page = `<!doctype html><html><body><div id="result">pending</div><script>
    fetch(${JSON.stringify(uploadUrl)}, {
      method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: ${JSON.stringify(body)}
    }).then(response => {
      document.getElementById('result').textContent = response.ok ? 'upload-ok' : 'upload-http-' + response.status;
    }).catch(error => {
      document.getElementById('result').textContent = 'upload-error-' + error.name;
    });
  </script></body></html>`;
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(page);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(3000, resolve);
    });
    const { stdout } = await run(chrome, [
      '--headless=new', '--no-first-run', '--disable-gpu', `--user-data-dir=${profile}`,
      '--virtual-time-budget=15000', '--dump-dom', 'http://localhost:3000/',
    ], { timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    const browserStatus = stdout.match(/<div id="result">([^<]+)<\/div>/)?.[1];
    const object = browserStatus === 'upload-ok' ? await storageService.headObject(objectKey) : undefined;
    console.log(JSON.stringify({ browserStatus, objectBytes: object?.sizeBytes, ok: browserStatus === 'upload-ok' && object?.sizeBytes === Buffer.byteLength(body) }));
    if (browserStatus !== 'upload-ok' || object?.sizeBytes !== Buffer.byteLength(body)) process.exitCode = 1;
  } finally {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    await storageService.deleteObject(objectKey);
    const relative = path.relative(os.tmpdir(), profile);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(profile).startsWith('hanflix-cors-browser-')) {
      throw new Error('Refusing to remove an unexpected Chrome profile path');
    }
    await fs.rm(profile, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
