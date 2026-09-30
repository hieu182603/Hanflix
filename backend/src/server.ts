import http from 'node:http';
import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { initializeBilling } from './services/premium.js';
import { startVideoProcessingWorker, stopVideoProcessingWorker } from './workers/video-processing.worker.js';

let server: http.Server | undefined;

async function start() {
  await connectDatabase();
  await initializeBilling();
  if (env.VIDEO_WORKER_MODE === 'embedded') startVideoProcessingWorker();
  server = app.listen(env.PORT, () => {
    console.log(`HanFlix API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
  });
}

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server?.close(async error => {
    await stopVideoProcessingWorker();
    await disconnectDatabase();
    process.exit(error ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', error => {
  console.error('Unhandled rejection', error);
  void shutdown('unhandledRejection');
});

start().catch(error => {
  console.error('Failed to start HanFlix API', error);
  process.exit(1);
});
