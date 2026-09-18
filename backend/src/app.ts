import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { databaseState } from './config/database.js';
import { getVideoQueueMetrics } from './queue/video.queue.js';
import { getPrometheusMetrics, metricsMiddleware } from './services/metrics.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { globalLimiter } from './middleware/rate-limits.js';
import { requestId } from './middleware/request-id.js';
import adminRoutes from './routes/admin.routes.js';
import adminGrammarRoutes from './routes/admin-grammar.routes.js';
import adminVocabularyRoutes from './routes/admin-vocabulary.routes.js';
import aiRoutes from './routes/ai.routes.js';
import authRoutes from './routes/auth.routes.js';
import learningRoutes from './routes/learning.routes.js';
import lessonRoutes from './routes/lesson.routes.js';
import profileRoutes from './routes/profile.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import vocabularyRoutes from './routes/vocabulary.routes.js';

export const app = express();

app.disable('x-powered-by');
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(requestId);
app.use(metricsMiddleware);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Allow cross-origin window.postMessage by not setting COOP header.
  // If you need strict popup isolation, use crossOriginOpenerPolicy: { policy: 'same-origin' }
  crossOriginOpenerPolicy: false,
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.APP_ORIGINS.includes(origin)) callback(null, true);
    else callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());
app.use(globalLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (req, res) => {
  // SECURITY (SEC-04): /metrics is now ALWAYS protected.
  // - In production, METRICS_TOKEN is required (env validation enforces this).
  // - In staging/dev, METRICS_TOKEN must also be configured or the endpoint refuses.
  // - Optional METRICS_IP_ALLOWLIST (comma-separated CIDR ranges) restricts by source IP.
  if (!env.METRICS_TOKEN) {
    res.status(403).json({ error: { code: 'METRICS_DISABLED', message: 'Metrics endpoint is disabled without METRICS_TOKEN. Configure METRICS_TOKEN or restrict at the network layer.' } });
    return;
  }
  if (env.METRICS_IP_ALLOWLIST.length > 0) {
    const remoteIp = req.ip ?? '';
    const allowed = env.METRICS_IP_ALLOWLIST.some(entry => remoteIp.startsWith(entry));
    if (!allowed) {
      res.status(403).json({ error: { code: 'METRICS_IP_NOT_ALLOWED', message: 'Source IP is not in the metrics allowlist' } });
      return;
    }
  }
  const supplied = req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const expectedBuffer = Buffer.from(env.METRICS_TOKEN);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    res.status(401).json({ error: { code: 'METRICS_AUTH_REQUIRED', message: 'Metrics authentication required' } });
    return;
  }
  try {
    const { contentType, metrics } = await getPrometheusMetrics();
    res.setHeader('Content-Type', contentType);
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

app.get(`${env.API_PREFIX}/health`, async (_req, res) => {
  const db = databaseState();
  const queue = db === 'connected' ? await getVideoQueueMetrics() : { status: 'unavailable' };
  const healthy = db === 'connected';

  res.status(healthy ? 200 : 503).json({
    data: {
      service: 'hanflix-backend',
      status: healthy ? 'ok' : 'degraded',
      database: db,
      queue,
      timestamp: new Date().toISOString(),
    },
  });
});

app.get(env.API_PREFIX, (_req, res) => {
  res.json({ data: { name: 'HanFlix API', version: 'v1' } });
});

app.use(`${env.API_PREFIX}/auth`, authRoutes);
app.use(`${env.API_PREFIX}/profile`, profileRoutes);
app.use(`${env.API_PREFIX}/uploads`, uploadRoutes);
app.use(`${env.API_PREFIX}/lessons`, lessonRoutes);
app.use(`${env.API_PREFIX}/vocabulary`, vocabularyRoutes);
app.use(`${env.API_PREFIX}/learning`, learningRoutes);
app.use(`${env.API_PREFIX}/ai`, aiRoutes);
app.use(`${env.API_PREFIX}/admin`, adminRoutes);
app.use(`${env.API_PREFIX}/admin`, adminGrammarRoutes);
app.use(`${env.API_PREFIX}/admin`, adminVocabularyRoutes);

app.use(notFound);
app.use(errorHandler);
